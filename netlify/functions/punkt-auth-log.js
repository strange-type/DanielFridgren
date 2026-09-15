import { getAuthLogSummary, unblockIp, isSessionValid } from './lib/punkt-data.js';

const { PUNKT_GITHUB_TOKEN, PUNKT_SESSION_SECRET } = process.env;

const SECURITY_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff'
};

function respond(statusCode, body) {
    return { statusCode, headers: SECURITY_HEADERS, body: JSON.stringify(body) };
}

/**
 * Backs the in-app "someone tried to log in" indicator: GET lists
 * logged attempts per IP (see getAuthLogSummary), POST with
 * {action:"unblock", ip} clears one IP's entries. This isn't the
 * login gate itself (that's punkt-login.js, which is what actually
 * records failed attempts) — reaching this endpoint at all already
 * requires a valid session, so it doesn't duplicate that gate's own
 * IP-blocking logic.
 */
export const handler = async (event) => {
    if (!PUNKT_GITHUB_TOKEN || !PUNKT_SESSION_SECRET) {
        console.error('Punkt: missing PUNKT_GITHUB_TOKEN or PUNKT_SESSION_SECRET env vars');
        return respond(500, { error: 'Server not configured' });
    }

    if (!isSessionValid(event.headers['x-punkt-token'])) {
        return respond(401, { error: 'Unauthorized' });
    }

    try {
        if (event.httpMethod === 'GET') {
            const entries = await getAuthLogSummary();
            return respond(200, { entries });
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            if (body.action !== 'unblock' || typeof body.ip !== 'string' || !body.ip) {
                return respond(400, { error: 'Invalid request' });
            }
            await unblockIp(body.ip);
            return respond(200, { ok: true });
        }

        return respond(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Punkt auth-log error:', error);
        return respond(500, { error: 'Internal error' });
    }
};
