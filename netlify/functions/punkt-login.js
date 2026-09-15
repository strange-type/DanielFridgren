import { timingSafeEqual, createHash } from 'node:crypto';
import { verify as verifyTotp } from 'otplib';
import { isIpBlocked, logFailedAuthAttempt, createSessionToken } from './lib/punkt-data.js';

const { PUNKT_ACCESS_TOKEN, PUNKT_TOTP_SECRET, PUNKT_SESSION_SECRET } = process.env;

/**
 * Constant-time comparison of the submitted access code against
 * PUNKT_ACCESS_TOKEN, so a wrong guess can't be timed to learn how
 * many leading characters matched.
 */
function isCodeCorrect(provided) {
    if (!PUNKT_ACCESS_TOKEN) return false;
    const a = createHash('sha256').update(provided || '').digest();
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
 * The only place the access code and a 2FA (TOTP) code are actually
 * checked — every other endpoint (punkt-tasks.js and friends) trusts
 * the session token this hands back instead, via isSessionValid(). IP
 * blocking lives here rather than there too: those are the guessable
 * secrets a brute-force actually targets, a session token itself is a
 * 256-bit HMAC output that isn't a realistic guessing target.
 */
export const handler = async (event) => {
    if (!PUNKT_ACCESS_TOKEN || !PUNKT_TOTP_SECRET || !PUNKT_SESSION_SECRET) {
        console.error(
            'Punkt: missing PUNKT_ACCESS_TOKEN, PUNKT_TOTP_SECRET, or PUNKT_SESSION_SECRET env vars'
        );
        return respond(500, { error: 'Server not configured' });
    }

    if (event.httpMethod !== 'POST') {
        return respond(405, { error: 'Method not allowed' });
    }

    const clientIp =
        event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
    if (await isIpBlocked(clientIp)) {
        return respond(403, { error: 'Too many failed login attempts. Try again later.' });
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return respond(400, { error: 'Invalid request' });
    }

    const code = typeof body.code === 'string' ? body.code : '';
    const totp = typeof body.totp === 'string' ? body.totp.trim() : '';

    // Checked in order so a wrong access code (the far more common
    // typo) skips verifying TOTP entirely — no point checking a code
    // that's about to be rejected anyway.
    const codeOk = isCodeCorrect(code);
    let totpOk = false;
    if (codeOk && /^\d{6}$/.test(totp)) {
        try {
            totpOk = (await verifyTotp({ token: totp, secret: PUNKT_TOTP_SECRET })).valid;
        } catch (err) {
            console.error('Punkt: TOTP verification failed', err);
        }
    }

    if (!codeOk || !totpOk) {
        const nowBlocked = await logFailedAuthAttempt(clientIp);
        if (nowBlocked) {
            return respond(403, { error: 'Too many failed login attempts. Try again later.' });
        }
        return respond(401, { error: 'Unauthorized', reason: codeOk ? 'totp' : 'code' });
    }

    return respond(200, { sessionToken: createSessionToken() });
};
