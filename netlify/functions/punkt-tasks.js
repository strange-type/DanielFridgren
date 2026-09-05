import { timingSafeEqual, createHash } from 'node:crypto';

const OWNER = process.env.PUNKT_GITHUB_OWNER || 'strange-type';
const REPO = process.env.PUNKT_GITHUB_REPO || 'DanielFridgren';
const BRANCH = process.env.PUNKT_GITHUB_BRANCH || 'main';
const FILE_PATH = process.env.PUNKT_DATA_PATH || 'punkt/data/tasks.md';

const { PUNKT_GITHUB_TOKEN, PUNKT_ACCESS_TOKEN } = process.env;

const TASK_LINE =
    /^- \[( |x)\] (.+?) \(id: ([^,)]+)(?:, when: ([^,)]+))?(?:, deadline: ([^,)]+))?(?:, done: ([^,)]+))?\)\s*$/;
const NOTE_LINE = /^ {2}> (.*)$/;

// In-memory rate limiting per IP, to slow down brute-forcing of
// PUNKT_ACCESS_TOKEN. Best-effort only — resets whenever the function
// cold-starts — but combined with a long random token that's enough
// for a low-value single-user target.
const REQUEST_LOG = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function isRateLimited(ip) {
    const now = Date.now();
    const recent = (REQUEST_LOG.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW);
    recent.push(now);
    REQUEST_LOG.set(ip, recent);
    return recent.length > MAX_REQUESTS_PER_WINDOW;
}

/**
 * Constant-time comparison of the shared-secret header against
 * PUNKT_ACCESS_TOKEN, so a wrong guess can't be timed to learn how
 * many leading characters matched.
 */
function isAuthorized(event) {
    if (!PUNKT_ACCESS_TOKEN) return false;
    const provided = event.headers['x-punkt-token'] || '';
    // Compare hashes of equal (fixed) length rather than the raw
    // strings, so differing input lengths don't short-circuit early.
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(PUNKT_ACCESS_TOKEN).digest();
    return timingSafeEqual(a, b);
}

/**
 * Call the GitHub Contents API for the tasks file.
 */
async function githubRequest(path, options = {}) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${PUNKT_GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
}

async function readTasksFile() {
    const data = await githubRequest(`contents/${FILE_PATH}?ref=${BRANCH}`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
}

async function writeTasksFile(content, sha, message) {
    await githubRequest(`contents/${FILE_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            sha,
            branch: BRANCH
        })
    });
}

/**
 * Parse the `## Tasks` markdown format into a flat task list.
 *
 * Only lines after the `## Tasks` heading are considered — the file's
 * leading HTML comment documents the format using lines that would
 * otherwise match TASK_LINE/NOTE_LINE themselves, so scanning the
 * whole file re-parses that example text as if it were real tasks.
 */
function parseTasks(markdown) {
    const lines = markdown.split('\n');
    const startIndex = lines.findIndex((l) => l.trim() === '## Tasks');
    const body = startIndex === -1 ? [] : lines.slice(startIndex + 1);

    const tasks = [];
    let last = null;
    for (const line of body) {
        const taskMatch = line.match(TASK_LINE);
        if (taskMatch) {
            const [, mark, title, id, when, deadline, done] = taskMatch;
            last = {
                id,
                title: title.trim(),
                note: '',
                when: when && when !== '-' ? when : null,
                deadline: deadline && deadline !== '-' ? deadline : null,
                done: mark === 'x',
                completedAt: done && done !== '-' ? done : null
            };
            tasks.push(last);
            continue;
        }
        const noteMatch = line.match(NOTE_LINE);
        if (noteMatch && last) {
            last.note = last.note ? `${last.note}\n${noteMatch[1]}` : noteMatch[1];
        }
    }
    return tasks;
}

const FILE_HEADER = `# Punkt — tasks

<!--
Maskingenererad datafil för Punkt-appen. Redigera gärna för hand, men
behåll formatet så att appen kan tolka filen:

- [ ] Titel (id: <id>, when: <today|YYYY-MM-DD|->, deadline: <YYYY-MM-DD|->)
  > Valfri anteckning på indragen rad direkt under uppgiften.

Klarmarkerade uppgifter får ett done-datum istället för when/deadline:

- [x] Titel (id: <id>, done: <ISO-datetime>)

Inbox/Today/Upcoming/Logbook är vyer som räknas fram från when/done —
uppgifter flyttas inte mellan sektioner i den här filen.
-->

## Tasks
`;

/**
 * Serialize a task list back into the `## Tasks` markdown format.
 */
function serializeTasks(tasks) {
    const lines = tasks.map((t) => {
        const parts = [`id: ${t.id}`];
        if (t.done) {
            parts.push(`done: ${t.completedAt || new Date().toISOString()}`);
        } else {
            parts.push(`when: ${t.when || '-'}`);
            if (t.deadline) parts.push(`deadline: ${t.deadline}`);
        }
        const mark = t.done ? 'x' : ' ';
        let line = `- [${mark}] ${t.title} (${parts.join(', ')})`;
        if (t.note) {
            line += '\n' + t.note.split('\n').map((n) => `  > ${n}`).join('\n');
        }
        return line;
    });
    return `${FILE_HEADER}\n${lines.join('\n')}${lines.length ? '\n' : ''}`;
}

/**
 * Validate a task list posted by the client before it's written to GitHub.
 */
function validateTasks(tasks) {
    if (!Array.isArray(tasks)) return 'tasks must be an array';
    for (const t of tasks) {
        if (typeof t.id !== 'string' || !t.id) return 'each task needs an id';
        if (typeof t.title !== 'string' || !t.title.trim()) return 'each task needs a title';
        if (t.title.includes('\n')) return 'title must be a single line';
    }
    return null;
}

const SECURITY_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff'
};

function respond(statusCode, body) {
    return { statusCode, headers: SECURITY_HEADERS, body: JSON.stringify(body) };
}

export const handler = async (event) => {
    if (!PUNKT_GITHUB_TOKEN || !PUNKT_ACCESS_TOKEN) {
        console.error('Punkt: missing PUNKT_GITHUB_TOKEN or PUNKT_ACCESS_TOKEN env vars');
        return respond(500, { error: 'Server not configured' });
    }

    const clientIp =
        event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(clientIp)) {
        return respond(429, { error: 'Too many requests. Try again shortly.' });
    }

    if (!isAuthorized(event)) {
        return respond(401, { error: 'Unauthorized' });
    }

    try {
        if (event.httpMethod === 'GET') {
            const { content } = await readTasksFile();
            return respond(200, { tasks: parseTasks(content) });
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const validationError = validateTasks(body.tasks);
            if (validationError) {
                return respond(400, { error: validationError });
            }
            const { sha } = await readTasksFile();
            await writeTasksFile(serializeTasks(body.tasks), sha, 'Update Punkt tasks');
            return respond(200, { ok: true });
        }

        return respond(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Punkt tasks error:', error);
        return respond(500, { error: 'Internal error' });
    }
};
