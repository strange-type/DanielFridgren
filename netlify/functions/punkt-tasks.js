import { timingSafeEqual, createHash } from 'node:crypto';
import {
    readTasksFile,
    writeTasksFile,
    parseTasks,
    serializeTasks,
    validateTasks,
    isIpBlocked,
    logFailedAuthAttempt
} from './lib/punkt-data.js';

const { PUNKT_GITHUB_TOKEN, PUNKT_ACCESS_TOKEN } = process.env;

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

    // Checking the auth log costs a GitHub API round-trip, so it only
    // runs once the (cheap, local) token check actually fails —
    // otherwise every ordinary request from the one legitimate user
    // would pay that cost for no reason.
    if (!isAuthorized(event)) {
        if (await isIpBlocked(clientIp)) {
            return respond(403, { error: 'Too many failed login attempts. Try again later.' });
        }
        const nowBlocked = await logFailedAuthAttempt(clientIp);
        return nowBlocked
            ? respond(403, { error: 'Too many failed login attempts. Try again later.' })
            : respond(401, { error: 'Unauthorized' });
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
            const content = serializeTasks(body.tasks);

            // tasks.md has two independent writers — this endpoint and
            // the scheduled reminders function, which stamps notifiedOn
            // on its own 10-minute cadence — so a stale sha here isn't
            // a real error, just two writes landing close together.
            // Re-reading the latest sha and retrying resolves it
            // without surfacing a save failure for an ordinary race.
            const MAX_ATTEMPTS = 3;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const { sha } = await readTasksFile();
                try {
                    await writeTasksFile(content, sha, 'Update Punkt tasks');
                    return respond(200, { ok: true });
                } catch (error) {
                    if (error.status !== 409 || attempt === MAX_ATTEMPTS) throw error;
                }
            }
        }

        return respond(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Punkt tasks error:', error);
        // This is a single-developer app (no other users to leak
        // internals to), so the real error is worth showing directly
        // rather than a generic message that gives nothing to act on.
        return respond(error.status === 409 ? 409 : 500, {
            error: error.status === 409 ? 'Save conflicted with another update — try again.' : error.message || 'Internal error'
        });
    }
};
