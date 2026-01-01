const sgMail = require('@sendgrid/mail');

// Simple in-memory rate limiting
const submissionTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_SUBMISSIONS = 3;

// Minimum time to fill form (in milliseconds) to prevent instant bot submissions
const MIN_FORM_TIME = 3000; // 3 seconds

const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, CONTACT_EMAIL } = process.env;

// Configure SendGrid
sgMail.setApiKey(SENDGRID_API_KEY);
// Note: setDataResidency is only available if using EU regional sending
// sgMail.setDataResidency('eu');

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
    if (!data.get('name') || data.get('name').trim().length < 2) {
        errors.push('A name is required and must be at least 2 characters');
    }

    if (!data.get('email') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email'))) {
        errors.push('A valid email is required');
    }

    if (!data.get('message') || data.get('message').trim().length < 10) {
        errors.push('Message is required and must be at least 10 characters');
    }

    // Check honeypot
    if (data.get('website') && data.get('website').trim() !== '') {
        errors.push('Spam detected');
    }

    // Check form submission time
    const formStartTime = data.get('form-start-time');
    if (formStartTime) {
        const timeTaken = Date.now() - parseInt(formStartTime, 10);
        if (timeTaken < MIN_FORM_TIME) {
            errors.push('Form submitted too quickly');
        }
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

        // Extract form data
        const name = data.get('name').trim();
        const email = data.get('email').trim();
        const message = data.get('message').trim();

        console.log(`Contact form submission from: ${name} <${email}>`);

        // Prepare SendGrid message
        const msg = {
            to: CONTACT_EMAIL || SENDGRID_FROM_EMAIL,
            from: SENDGRID_FROM_EMAIL, // Must be a verified sender in SendGrid
            replyTo: email,
            subject: `New contact from ${name}`,
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
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
<hr>
<p style="color: #666; font-size: 12px;">
    Sent from contact form at fridgren.se<br>
    IP: ${clientIp}<br>
    Time: ${new Date().toISOString()}
</p>
            `.trim()
        };

        // Send email via SendGrid
        await sgMail.send(msg);

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
