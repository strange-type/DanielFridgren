import { timingSafeEqual, createHash } from 'node:crypto';
import { readSubscriptions, writeSubscriptions } from './lib/punkt-data.js';

const { PUNKT_GITHUB_TOKEN, PUNKT_ACCESS_TOKEN } = process.env;

function isAuthorized(event) {
    if (!PUNKT_ACCESS_TOKEN) return false;
    const provided = event.headers['x-punkt-token'] || '';
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

/**
 * Store (or refresh) a browser's PushSubscription so the scheduled
 * reminders function can send to it later. Upserts by endpoint —
 * re-subscribing the same device just replaces its keys.
 */
export const handler = async (event) => {
    if (!PUNKT_GITHUB_TOKEN || !PUNKT_ACCESS_TOKEN) {
        console.error('Punkt: missing PUNKT_GITHUB_TOKEN or PUNKT_ACCESS_TOKEN env vars');
        return respond(500, { error: 'Server not configured' });
    }

    if (!isAuthorized(event)) {
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

        const { subscriptions, sha } = await readSubscriptions();
        const withoutThis = subscriptions.filter((s) => s.endpoint !== subscription.endpoint);
        withoutThis.push(subscription);

        await writeSubscriptions(withoutThis, sha, 'Add Punkt push subscription');
        return respond(200, { ok: true });
    } catch (error) {
        console.error('Punkt subscribe error:', error);
        return respond(500, { error: 'Internal error' });
    }
};
