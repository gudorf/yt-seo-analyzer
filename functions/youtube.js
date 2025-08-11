const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { videoId, action, keyword } = JSON.parse(event.body);
    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API key is not configured.' }) };
    }

    if (action === 'analyze') {
        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.items.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'Video not found.' }) };
            
            const item = data.items[0];
            const requiredData = {
                title: item.snippet.title,
                description: item.snippet.description,
                tags: item.snippet.tags,
                duration: item.contentDetails.duration,
                thumbnail: item.snippet.thumbnails.high.url
            };
            return { statusCode: 200, body: JSON.stringify(requiredData) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    if (action === 'search') {
        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=5&key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            
            // This is the crucial part: return the array of items.
            const items = data.items;
            return { statusCode: 200, body: JSON.stringify(items) };

        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action.' }) };
};