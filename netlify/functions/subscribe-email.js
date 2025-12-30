const { EMAIL_TOKEN } = process.env;

export const handler = async (event, context) => {
    const email = JSON.parse(event.body).data.email
    console.log(`Received a submission: ${email}`)

    // Use ConvertKit's subscriber API endpoint instead of form endpoint
    // This prevents ConvertKit from triggering redirects
    const response = await fetch(
        `https://api.convertkit.com/v3/forms/8889037/subscribe?api_key=${EMAIL_TOKEN}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email
        }),
    }
    );
    let responseText = await response.text();
    console.log('response:', responseText);

    // Return success - Netlify will redirect to the action="/confirmation" page
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
    }
};
