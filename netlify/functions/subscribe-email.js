const { EMAIL_TOKEN } = process.env;
import fetch from 'node-fetch';

exports.handler = async (event, context) => {
    const email = JSON.parse(event.body).data.email
    console.log(`Received a submission: ${email}`)

    const response = await fetch(
        'https://api.convertkit.com/v3/forms/d71b9186b4/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: EMAIL_TOKEN,
            email: email
        }),
    }
    );
    let responseText = await response.text();
    console.log('response:', responseText);
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
    }
}
