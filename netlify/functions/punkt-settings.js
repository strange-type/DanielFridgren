import { readSettings, writeSettings, isSessionValid } from './lib/punkt-data.js';

const { PUNKT_GITHUB_TOKEN, PUNKT_SESSION_SECRET } = process.env;
const DEFAULT_DIGEST_TIME = process.env.PUNKT_DIGEST_TIME || '07:00';

const SECURITY_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff'
};

function respond(statusCode, body) {
    return { statusCode, headers: SECURITY_HEADERS, body: JSON.stringify(body) };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * App-configurable Punkt settings — today just the daily digest's send
 * time. GET returns the stored value, or PUNKT_DIGEST_TIME/"07:00" if
 * it's never been set from the app; POST {digestTime: "HH:MM"} updates
 * it. punkt-send-digest.js reads the same stored value, so a change
 * here takes effect on its next scheduled run without a redeploy.
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
            const { settings } = await readSettings();
            return respond(200, { digestTime: settings.digestTime || DEFAULT_DIGEST_TIME });
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            if (typeof body.digestTime !== 'string' || !TIME_RE.test(body.digestTime)) {
                return respond(400, { error: 'digestTime must be an "HH:MM" string' });
            }
            const { settings, sha } = await readSettings();
            await writeSettings({ ...settings, digestTime: body.digestTime }, sha);
            return respond(200, { ok: true });
        }

        return respond(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Punkt settings error:', error);
        return respond(500, { error: 'Internal error' });
    }
};
