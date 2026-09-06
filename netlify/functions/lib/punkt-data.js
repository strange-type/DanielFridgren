// Shared GitHub-Contents-API storage + markdown parsing for Punkt's
// Netlify functions. Kept in one place after a parser bug (fixed
// separately) showed how easy it is for two copies of this logic to
// drift out of sync.

const OWNER = process.env.PUNKT_GITHUB_OWNER || 'strange-type';
const REPO = process.env.PUNKT_GITHUB_REPO || 'DanielFridgren';
const BRANCH = process.env.PUNKT_GITHUB_BRANCH || 'main';
const TASKS_PATH = process.env.PUNKT_DATA_PATH || 'punkt/data/tasks.md';
const SUBSCRIPTIONS_PATH =
    process.env.PUNKT_SUBSCRIPTIONS_PATH || 'punkt/data/subscriptions.json';

const { PUNKT_GITHUB_TOKEN } = process.env;

const TASK_LINE =
    /^- \[( |x)\] (.+?) \(id: ([^,)]+)(?:, when: ([^,)]+))?(?:, deadline: ([^,)]+))?(?:, remind: ([^,)]+))?(?:, notified: ([^,)]+))?(?:, done: ([^,)]+))?\)\s*$/;
const NOTE_LINE = /^ {2}> (.*)$/;

/**
 * Call the GitHub Contents API for a file in this repo.
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
        const err = new Error(`GitHub API ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function readFile(path) {
    const data = await githubRequest(`contents/${path}?ref=${BRANCH}`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
}

async function writeFile(path, content, sha, message) {
    await githubRequest(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            sha,
            branch: BRANCH
        })
    });
}

async function readTasksFile() {
    return readFile(TASKS_PATH);
}

async function writeTasksFile(content, sha, message) {
    return writeFile(TASKS_PATH, content, sha, message);
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
            const [, mark, title, id, when, deadline, remind, notified, done] = taskMatch;
            last = {
                id,
                title: title.trim(),
                note: '',
                when: when && when !== '-' ? when : null,
                deadline: deadline && deadline !== '-' ? deadline : null,
                remind: remind && remind !== '-' ? remind : null,
                notifiedOn: notified && notified !== '-' ? notified : null,
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

- [ ] Titel (id: <id>, when: <today|YYYY-MM-DD|->, deadline: <YYYY-MM-DD|->, remind: <HH:MM|->)
  > Valfri anteckning på indragen rad direkt under uppgiften.

Klarmarkerade uppgifter får ett done-datum istället för when/deadline/remind:

- [x] Titel (id: <id>, done: <ISO-datetime>)

Inbox/Today/Upcoming/Logbook är vyer som räknas fram från when/done —
uppgifter flyttas inte mellan sektioner i den här filen. "notified"
håller reda på vilket datum en påminnelse senast skickades, så att den
inte skickas flera gånger samma dag.
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
            if (t.remind) parts.push(`remind: ${t.remind}`);
            if (t.notifiedOn) parts.push(`notified: ${t.notifiedOn}`);
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

async function readSubscriptions() {
    try {
        const { content, sha } = await readFile(SUBSCRIPTIONS_PATH);
        const subscriptions = JSON.parse(content || '[]');
        return { subscriptions: Array.isArray(subscriptions) ? subscriptions : [], sha };
    } catch (err) {
        if (err.status === 404) return { subscriptions: [], sha: null };
        throw err;
    }
}

async function writeSubscriptions(subscriptions, sha, message) {
    const content = JSON.stringify(subscriptions, null, 2) + '\n';
    if (sha) {
        await writeFile(SUBSCRIPTIONS_PATH, content, sha, message);
    } else {
        // File doesn't exist yet — create it (PUT without `sha` creates).
        await githubRequest(`contents/${SUBSCRIPTIONS_PATH}`, {
            method: 'PUT',
            body: JSON.stringify({
                message,
                content: Buffer.from(content, 'utf-8').toString('base64'),
                branch: BRANCH
            })
        });
    }
}

export {
    readTasksFile,
    writeTasksFile,
    parseTasks,
    serializeTasks,
    validateTasks,
    readSubscriptions,
    writeSubscriptions
};
