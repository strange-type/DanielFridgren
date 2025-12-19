const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Validate environment variables
  const API_KEY = process.env.EMAIL_TOKEN;
  if (!API_KEY) {
    console.error('EMAIL_TOKEN environment variable is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Validate event body
  if (!event.body) {
    console.error('No event body provided');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }

  // Parse the submission data from Netlify Forms
  let submission;
  try {
    submission = JSON.parse(event.body).payload;
  } catch (error) {
    console.error('Failed to parse event body:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request format' }),
    };
  }

  // Validate email field
  const email = submission?.data?.email;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('Invalid or missing email address');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Valid email address is required' }),
    };
  }

  // ConvertKit API configuration
  const FORM_ID = 'd71b9186b4';
  const CONVERTKIT_API_URL = `https://api.convertkit.com/v3/forms/${FORM_ID}/subscribe`;

  try {
    // Make API request to ConvertKit to add subscriber
    const response = await fetch(CONVERTKIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: API_KEY,
        email: email,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ConvertKit API error:', data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to subscribe' }),
      };
    }

    console.log('Successfully subscribed:', email);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully subscribed!' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
