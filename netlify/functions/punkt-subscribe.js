import { readSubscriptions, writeSubscriptions, isSessionValid } from './lib/punkt-data.js';

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
 * Store a browser's PushSubscription so the scheduled reminders/digest
 * functions can send to it later — replacing whatever was stored
 * before, not upserting by endpoint. Punkt is single-user, so whoever
 * just (re)subscribed is the only intended recipient: iOS can issue a
 * new push endpoint for the same install (most visibly after removing
 * and re-adding the home-screen app) without the old one ever 404ing,
 * so keyed-by-endpoint storage just accumulated stale-but-still-live
 * entries — each one a duplicate notification landing on the same
 * phone. ensurePushSubscription() in the client calls this on every
 * app open specifically to keep this one entry current.
 */
export const handler = async (event) => {
    if (!PUNKT_GITHUB_TOKEN || !PUNKT_SESSION_SECRET) {
        console.error('Punkt: missing PUNKT_GITHUB_TOKEN or PUNKT_SESSION_SECRET env vars');
        return respond(500, { error: 'Server not configured' });
    }

    if (!isSessionValid(event.headers['x-punkt-token'])) {
        return respond(401, { error: 'Unauthorized' });
    }

    if (event.httpMethod !== 'POST') {
        return respond(405, { error: 'Method not allowed' });
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const subscription = body.subscription;
        if (!subscription || typeof subscription.endpoint !== 'string') {
            return respond(400, { error: 'subscription with an endpoint is required' });
        }

        const { sha } = await readSubscriptions();
        await writeSubscriptions([subscription], sha, 'Replace Punkt push subscription');
        return respond(200, { ok: true });
    } catch (error) {
        console.error('Punkt subscribe error:', error);
        return respond(500, { error: 'Internal error' });
    }
};
