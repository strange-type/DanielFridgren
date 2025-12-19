import fetch from 'node-fetch';

exports.handler = async (event) => {
  // Parse the submission data from Netlify Forms
  const submission = JSON.parse(event.body).payload;
  const email = submission.data.email;

  // ConvertKit API configuration
  const FORM_ID = 'd71b9186b4';
  const API_KEY = process.env.EMAIL_TOKEN;
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
