// Simple in-memory rate limiting
const submissionTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_SUBMISSIONS = 3;

// Minimum time to fill form (in milliseconds) to prevent instant bot submissions
const MIN_FORM_TIME = 3000; // 3 seconds

const { RESEND_API_KEY, CONTACT_FROM_EMAIL, CONTACT_EMAIL, TURNSTILE_SECRET_KEY } = process.env;

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Escape user input before placing it in the HTML email
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Verify the Cloudflare Turnstile token. Skipped with a warning while
 * TURNSTILE_SECRET_KEY is unset, so the form keeps working until the key is
 * added in Netlify; once it is set, a missing or invalid token is rejected.
 */
async function verifyCaptcha(token, ip) {
    if (!TURNSTILE_SECRET_KEY) {
        // Fail closed: only skip the check under `netlify dev`.
        if (process.env.NETLIFY_DEV === 'true') {
            console.warn('TURNSTILE_SECRET_KEY is not set, skipping captcha check (local dev)');
            return true;
        }
        console.error('TURNSTILE_SECRET_KEY is not set, rejecting submission');
        return false;
    }
    if (!token) return false;

    const params = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    if (ip && ip !== 'unknown') params.set('remoteip', ip);

    try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            body: params,
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) return false;
        const result = await response.json();
        return result.success === true;
    } catch (error) {
        console.error('Captcha verification failed:', error);
        return false;
    }
}

/**
 * Clean and validate rate limiting
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const submissions = submissionTracker.get(ip) || [];

    // Remove old submissions outside the window
    const recentSubmissions = submissions.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentSubmissions.length >= MAX_SUBMISSIONS) {
        return false;
    }

    recentSubmissions.push(now);
    submissionTracker.set(ip, recentSubmissions);
    return true;
}

/**
 * Validate form data
 */
function validateFormData(data) {
    const errors = [];

    // Check required fields
    if (!data.get('name') || data.get('name').trim().length < 2 || data.get('name').length > 100) {
        errors.push('A name is required and must be 2 to 100 characters');
    }

    if (!data.get('email') || data.get('email').length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email'))) {
        errors.push('A valid email is required');
    }

    if (!data.get('message') || data.get('message').trim().length < 10 || data.get('message').length > 5000) {
        errors.push('Message is required and must be 10 to 5000 characters');
    }

    // Check honeypot
    if (data.get('website') && data.get('website').trim() !== '') {
        errors.push('Spam detected');
    }

    // Check form submission time
    const timeTaken = Date.now() - parseInt(data.get('form-start-time') || '', 10);
    if (!Number.isFinite(timeTaken) || timeTaken < MIN_FORM_TIME) {
        errors.push('Form submitted too quickly');
    }

    return errors;
}

/**
 * Main handler
 */
export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = new URLSearchParams(event.body);

        // Get client IP for rate limiting
        const clientIp = event.headers['x-nf-client-connection-ip'] ||
            event.headers['client-ip'] ||
            'unknown';

        // Rate limiting check
        if (!checkRateLimit(clientIp)) {
            console.log(`Rate limit exceeded for IP: ${clientIp}`);
            return {
                statusCode: 429,
                body: JSON.stringify({
                    error: 'Too many submissions. Please try again later.'
                })
            };
        }

        // Validate form data
        const validationErrors = validateFormData(data);
        if (validationErrors.length > 0) {
            console.log('Validation errors:', validationErrors);
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Validation failed',
                    details: validationErrors
                })
            };
        }

        if (!(await verifyCaptcha(data.get('cf-turnstile-response'), clientIp))) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Captcha check failed. Please reload the page and try again.'
                })
            };
        }

        // Extract form data
        const name = data.get('name').trim();
        const email = data.get('email').trim();
        const message = data.get('message').trim();

        console.log(`Contact form submission from: ${name} <${email}>`);

        if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
            console.error(
                `Missing required env vars: ${!RESEND_API_KEY ? 'RESEND_API_KEY ' : ''}${!CONTACT_FROM_EMAIL ? 'CONTACT_FROM_EMAIL' : ''}`
            );
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to send message. Please try again later.'
                })
            };
        }

        // Prepare message for Resend
        const msg = {
            to: CONTACT_EMAIL || CONTACT_FROM_EMAIL,
            from: CONTACT_FROM_EMAIL, // Must be a verified sender/domain in Resend
            reply_to: email,
            subject: `New contact from ${name.replace(/[\r\n]+/g, ' ')}`,
            text: `
Name: ${name}
Email: ${email}

Message:
${message}

---
Sent from contact form at fridgren.se
IP: ${clientIp}
Time: ${new Date().toISOString()}
            `.trim(),
            html: `
<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
<hr>
<p style="color: #666; font-size: 12px;">
    Sent from contact form at fridgren.se<br>
    IP: ${clientIp}<br>
    Time: ${new Date().toISOString()}
</p>
            `.trim()
        };

        // Send email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(msg)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error(`Resend request failed (${response.status}):`, errorBody);
            return {
                statusCode: 502,
                body: JSON.stringify({
                    error: 'Failed to send message. Please try again later.',
                    ...(errorBody.message ? { details: [errorBody.message] } : {})
                })
            };
        }

        console.log('Email sent successfully');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Message sent successfully'
            })
        };

    } catch (error) {
        console.error('Error processing contact form:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to send message. Please try again later.'
            })
        };
    }
};
