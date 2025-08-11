// This function needs `node-fetch`. If deploying to Netlify/Vercel, 
// add it to your package.json: `npm install node-fetch`
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { videoId } = JSON.parse(event.body);
        const API_KEY = process.env.YOUTUBE_API_KEY;

        if (!API_KEY) {
            throw new Error('API key is not configured.');
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Video not found.' })
            };
        }

        const snippet = data.items[0].snippet;
        const contentDetails = data.items[0].contentDetails;
        
        const requiredData = {
            title: snippet.title,
            description: snippet.description,
            tags: snippet.tags,
            duration: contentDetails.duration
        };
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requiredData)
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal server error occurred.' })
        };
    }
};