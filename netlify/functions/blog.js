import { timingSafeEqual } from 'node:crypto';

const { BLOG_API_TOKEN, BLOG_PUBLISH_TOKEN, GITHUB_TOKEN, INKFLOW_ORIGIN } = process.env;
const GITHUB_REPO = process.env.GITHUB_REPO || 'strange-type/danielfridgren';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const BLOG_DIR = 'src/content/blog';
const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.mdx?$/;
// MDX can run code at build time, so posts can only be written as plain Markdown
const WRITABLE_FILE_NAME = /^[a-z0-9][a-z0-9-]*\.md$/;
const MAX_CONTENT_BYTES = 200 * 1024;

/**
 * CORS headers for the one origin allowed to call this function (Inkflow)
 */
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': INKFLOW_ORIGIN || '',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Publish-Token',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

/**
 * Build a JSON response
 */
function respond(statusCode, body) {
    return {
        statusCode,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

/**
 * Compare a given secret against the expected one without leaking timing
 */
function matches(given, expected) {
    if (!given || !expected) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Check the bearer token against BLOG_API_TOKEN
 */
function isAuthorized(header) {
    const match = /^Bearer (.+)$/.exec(header || '');
    return match ? matches(match[1], BLOG_API_TOKEN) : false;
}

/**
 * Call the GitHub contents API for a path in the blog directory
 */
async function github(path, init = {}) {
    return fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'fridgren-blog-function',
            ...init.headers,
        },
    });
}

/**
 * Pull the fields the post list needs out of a post's frontmatter
 */
function summarize(content) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
    const field = (key) => {
        const value = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(frontmatter)?.[1].trim() ?? '';
        return value.replace(/^["']|["']$/g, '');
    };
    return {
        title: field('title'),
        pubDate: field('pubDate'),
        draft: field('draft').toLowerCase() === 'true',
    };
}

/**
 * True when the frontmatter has exactly one draft line and it says true.
 * A duplicated key is rejected rather than guessed at, since parsers disagree on it.
 */
function isSafeDraft(content) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
    return (frontmatter.match(/^draft:/gim) || []).length === 1 && summarize(content).draft;
}

/**
 * A post that breaks the content schema would break the whole site build
 */
function validateContent(content) {
    if (typeof content !== 'string' || !content.trim()) return 'Content is empty';
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) return 'Content is too large';
    const { title, pubDate } = summarize(content);
    if (!/^---\r?\n[\s\S]*?\r?\n---/.test(content)) return 'Frontmatter is missing';
    if (!title) return 'Frontmatter needs a title';
    if (!pubDate) return 'Frontmatter needs a pubDate';
    return null;
}

/**
 * List all posts with title, date and draft state
 */
async function listPosts() {
    const response = await github(`${BLOG_DIR}?ref=${GITHUB_BRANCH}`);
    if (!response.ok) return respond(502, { error: 'Could not list posts' });

    const entries = (await response.json()).filter((entry) => entry.type === 'file' && FILE_NAME.test(entry.name));
    const posts = await Promise.all(
        entries.map(async (entry) => {
            const raw = await fetch(entry.download_url);
            const content = raw.ok ? await raw.text() : '';
            return { file: entry.name, sha: entry.sha, ...summarize(content) };
        })
    );
    return respond(200, { posts });
}

/**
 * Read one post
 */
async function readPost(file) {
    const response = await github(`${BLOG_DIR}/${file}?ref=${GITHUB_BRANCH}`);
    if (response.status === 404) return respond(404, { error: 'Post not found' });
    if (!response.ok) return respond(502, { error: 'Could not read the post' });

    const data = await response.json();
    return respond(200, {
        file,
        sha: data.sha,
        content: Buffer.from(data.content, 'base64').toString('utf8'),
    });
}

/**
 * Response telling the client to retry with the publish token
 */
function needsPublishToken() {
    return respond(403, {
        error: 'This change affects the public site. The publish token is needed.',
        needsPublishToken: true,
    });
}

/**
 * Create a post (no sha) or update one (sha of the version being edited).
 * GitHub refuses a stale or missing sha, which surfaces as a conflict.
 */
async function writePost(file, content, sha, canPublish) {
    const invalid = validateContent(content);
    if (invalid) return respond(400, { error: invalid });

    if (!canPublish) {
        // Without the publish token only drafts may be written, and a post that
        // is already public may not be touched.
        const existing = await github(`${BLOG_DIR}/${file}?ref=${GITHUB_BRANCH}`);
        if (existing.ok) {
            const current = Buffer.from((await existing.json()).content, 'base64').toString('utf8');
            if (!isSafeDraft(current)) return needsPublishToken();
        } else if (existing.status !== 404) {
            return respond(502, { error: 'Could not check the existing post' });
        }
        if (!isSafeDraft(content)) return needsPublishToken();
    }

    const response = await github(`${BLOG_DIR}/${file}`, {
        method: 'PUT',
        body: JSON.stringify({
            message: sha ? `Edit blog post: ${file}` : `New blog post: ${file}`,
            content: Buffer.from(content).toString('base64'),
            branch: GITHUB_BRANCH,
            ...(sha ? { sha } : {}),
        }),
    });

    if (response.status === 409 || response.status === 422) {
        return respond(409, { error: 'The post changed or already exists' });
    }
    if (!response.ok) return respond(502, { error: 'Could not save the post' });

    const data = await response.json();
    return respond(200, { file, sha: data.content.sha });
}

/**
 * Main handler
 */
export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    if (!BLOG_API_TOKEN || !GITHUB_TOKEN || !INKFLOW_ORIGIN) {
        return respond(503, { error: 'Blog editing is not set up' });
    }

    if (!isAuthorized(event.headers.authorization)) {
        return respond(401, { error: 'Unauthorized' });
    }

    try {
        if (event.httpMethod === 'GET') {
            const file = event.queryStringParameters?.file;
            if (!file) return await listPosts();
            if (!FILE_NAME.test(file)) return respond(400, { error: 'Invalid file name' });
            return await readPost(file);
        }

        if (event.httpMethod === 'PUT') {
            const { file, content, sha } = JSON.parse(event.body || '{}');
            if (typeof file !== 'string' || !WRITABLE_FILE_NAME.test(file)) {
                return respond(400, { error: 'Invalid file name' });
            }
            if (sha !== undefined && typeof sha !== 'string') {
                return respond(400, { error: 'Invalid sha' });
            }

            const given = event.headers['x-publish-token'];
            if (given && !matches(given, BLOG_PUBLISH_TOKEN)) {
                return respond(401, { error: 'The publish token is wrong or publishing is not set up.' });
            }
            return await writePost(file, content, sha, Boolean(given));
        }

        return respond(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Blog function error:', error);
        return respond(500, { error: 'Something went wrong' });
    }
};
