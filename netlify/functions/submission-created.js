const fetch = require('node-fetch');

const FORM_ID = 'd71b9186b4';
const CONVERTKIT_API_URL = `https://api.convertkit.com/v3/forms/${FORM_ID}/subscribe`;

exports.handler = async (event) => {
    // Only handle POST requests from Netlify form submissions
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Validate environment variable
        if (!process.env.EMAIL_TOKEN) {
            console.error('EMAIL_TOKEN environment variable is not set');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Parse the form submission payload
        const payload = JSON.parse(event.body);
        const email = payload?.payload?.data?.email;

        // Validate email input
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid email address' })
            };
        }

        // Subscribe to ConvertKit
        const response = await fetch(CONVERTKIT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: process.env.EMAIL_TOKEN,
                email: email
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('ConvertKit API error:', data);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Failed to subscribe to newsletter' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully subscribed to newsletter',
                subscription: data.subscription
            })
        };

    } catch (error) {
        console.error('Error processing subscription:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
