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
const ERROR_LOG_PATH = process.env.PUNKT_ERROR_LOG_PATH || 'punkt/data/last-reminder-error.json';
const AUTH_LOG_PATH = process.env.PUNKT_AUTH_LOG_PATH || 'punkt/data/auth-log.json';

const { PUNKT_GITHUB_TOKEN } = process.env;

// An IP is blocked once it has this many failed attempts within the
// window below — both numbers are deliberately generous for a
// single-user app, not a public login form.
const AUTH_BLOCK_WINDOW_MS = 10 * 60 * 1000;
const AUTH_BLOCK_THRESHOLD = 5;
// How long failed-attempt entries stick around in the log after they
// stop counting toward a block, purely so there's a short audit trail
// visible in the file — has no effect on blocking itself.
const AUTH_LOG_RETENTION_MS = 24 * 60 * 60 * 1000;

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
    const result = await githubRequest(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            sha,
            branch: BRANCH
        })
    });
    return result.content.sha;
}

async function readTasksFile() {
    return readFile(TASKS_PATH);
}

async function writeTasksFile(content, sha, message) {
    return writeFile(TASKS_PATH, content, sha, message);
}

/**
 * Combines the freshly-read server task list with the client's own,
 * for when a save hits a genuine conflict — another tab or device
 * saved a change since this client last loaded, so the two need
 * reconciling instead of one blindly overwriting the other's tasks
 * (previously always the case: the client posts its whole in-memory
 * list as one unit, so a save from a stale tab could silently erase
 * anything added or changed elsewhere in the meantime, most visibly a
 * just-added task simply vanishing).
 *
 * Keyed by id: a task only the server has (added or edited elsewhere
 * since this client loaded) is kept, a task only the client has (added
 * or edited here) is kept, and a task both have keeps the client's
 * copy — this client's in-memory state is what just triggered the
 * save, so it reflects the most recent edit made *on this device*.
 * This can resurrect a task deleted on the other device if this client
 * still had it locally; for a single-user app, that's a safer default
 * than the alternative (silently losing an add or edit instead).
 */
function mergeTasks(serverTasks, clientTasks) {
    const clientIds = new Set(clientTasks.map((t) => t.id));
    const serverOnly = serverTasks.filter((t) => !clientIds.has(t.id));
    return [...clientTasks, ...serverOnly];
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

- [ ] Titel (id: <id>, when: <today|evening|YYYY-MM-DD|->, deadline: <YYYY-MM-DD|->, remind: <HH:MM|->)
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

/**
 * Best-effort diagnostic log for push-send failures, so the actual
 * push-service error (statusCode + body) can be inspected directly in
 * the repo instead of only in Netlify's function logs.
 */
async function writeLastReminderError(info) {
    try {
        let sha = null;
        try {
            const existing = await readFile(ERROR_LOG_PATH);
            sha = existing.sha;
        } catch (err) {
            if (err.status !== 404) throw err;
        }
        const content = JSON.stringify({ ...info, loggedAt: new Date().toISOString() }, null, 2) + '\n';
        if (sha) {
            await writeFile(ERROR_LOG_PATH, content, sha, 'Log Punkt reminder error');
        } else {
            await githubRequest(`contents/${ERROR_LOG_PATH}`, {
                method: 'PUT',
                body: JSON.stringify({
                    message: 'Log Punkt reminder error',
                    content: Buffer.from(content, 'utf-8').toString('base64'),
                    branch: BRANCH
                })
            });
        }
    } catch (err) {
        console.error('Punkt: failed to write reminder error log', err);
    }
}

async function readAuthLog() {
    try {
        const { content, sha } = await readFile(AUTH_LOG_PATH);
        const attempts = JSON.parse(content || '[]');
        return { attempts: Array.isArray(attempts) ? attempts : [], sha };
    } catch (err) {
        if (err.status === 404) return { attempts: [], sha: null };
        throw err;
    }
}

async function writeAuthLog(attempts, sha, message) {
    const content = JSON.stringify(attempts, null, 2) + '\n';
    if (sha) {
        await writeFile(AUTH_LOG_PATH, content, sha, message);
    } else {
        await githubRequest(`contents/${AUTH_LOG_PATH}`, {
            method: 'PUT',
            body: JSON.stringify({
                message,
                content: Buffer.from(content, 'utf-8').toString('base64'),
                branch: BRANCH
            })
        });
    }
}

function countRecentFailures(attempts, ip, now) {
    return attempts.filter((a) => a.ip === ip && now - Date.parse(a.at) < AUTH_BLOCK_WINDOW_MS).length;
}

/**
 * Whether `ip` is currently blocked, purely by counting its own recent
 * entries in the auth log — there's no separate "blocked" flag to
 * reset, so deleting (or backdating) an IP's entries in
 * punkt/data/auth-log.json on GitHub un-blocks it immediately.
 */
async function isIpBlocked(ip) {
    try {
        const { attempts } = await readAuthLog();
        return countRecentFailures(attempts, ip, Date.now()) >= AUTH_BLOCK_THRESHOLD;
    } catch (err) {
        console.error('Punkt: failed to read auth log', err);
        return false;
    }
}

/**
 * Records a failed login attempt for `ip` and reports whether this
 * attempt just tipped it over into being blocked. Best-effort, like
 * writeLastReminderError below — a hiccup writing the log (including a
 * write conflict from several bad guesses landing at once) should
 * never itself break the login flow, just skip logging that one.
 */
async function logFailedAuthAttempt(ip) {
    try {
        const { attempts, sha } = await readAuthLog();
        const now = Date.now();
        const pruned = attempts.filter((a) => now - Date.parse(a.at) < AUTH_LOG_RETENTION_MS);
        pruned.push({ ip, at: new Date(now).toISOString() });
        await writeAuthLog(pruned, sha, 'Log Punkt failed login attempt');
        return countRecentFailures(pruned, ip, now) >= AUTH_BLOCK_THRESHOLD;
    } catch (err) {
        console.error('Punkt: failed to log auth attempt', err);
        return false;
    }
}

/**
 * One row per IP with any logged attempt still within retention,
 * newest first — for the in-app "someone tried to log in" indicator.
 * `blocked` mirrors isIpBlocked()'s own math (recent-within-window
 * count vs the threshold) so the UI and the actual gate never
 * disagree about which IPs are currently blocked.
 */
async function getAuthLogSummary() {
    const { attempts } = await readAuthLog();
    const now = Date.now();
    const byIp = new Map();
    for (const a of attempts) {
        const list = byIp.get(a.ip) || [];
        list.push(a.at);
        byIp.set(a.ip, list);
    }
    return Array.from(byIp.entries())
        .map(([ip, times]) => {
            const lastAttempt = times.reduce((latest, t) => (t > latest ? t : latest));
            return {
                ip,
                totalAttempts: times.length,
                recentAttempts: countRecentFailures(attempts, ip, now),
                blocked: countRecentFailures(attempts, ip, now) >= AUTH_BLOCK_THRESHOLD,
                lastAttempt
            };
        })
        .sort((a, b) => (a.lastAttempt < b.lastAttempt ? 1 : -1));
}

/**
 * Clears every logged attempt for `ip`, the same effect as manually
 * deleting its entries from auth-log.json on GitHub (see isIpBlocked's
 * own comment) — un-blocks it immediately since there's no separate
 * "blocked" flag to reset.
 */
async function unblockIp(ip) {
    const { attempts, sha } = await readAuthLog();
    const remaining = attempts.filter((a) => a.ip !== ip);
    await writeAuthLog(remaining, sha, `Unblock Punkt IP ${ip}`);
}

export {
    readTasksFile,
    writeTasksFile,
    parseTasks,
    serializeTasks,
    validateTasks,
    mergeTasks,
    readSubscriptions,
    writeSubscriptions,
    writeLastReminderError,
    isIpBlocked,
    logFailedAuthAttempt,
    getAuthLogSummary,
    unblockIp
};
