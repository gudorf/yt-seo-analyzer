document.addEventListener('DOMContentLoaded', () => {
    const videoInput = document.getElementById('video-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsContainer = document.getElementById('results-container');

    analyzeBtn.addEventListener('click', async () => {
        const input = videoInput.value.trim();
        if (!input) {
            alert('Please enter a YouTube Video URL or ID.');
            return;
        }

        const videoId = parseYouTubeId(input);
        if (!videoId) {
            alert('Could not find a valid YouTube Video ID in the input.');
            return;
        }

        await runAnalysis(videoId);
    });

    function parseYouTubeId(input) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?$/,
            /^([\w-]{11})$/
        ];
        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    // --- FIX: This function should ONLY fetch data. UI logic was removed.
    async function fetchVideoData(videoId) {
        const endpoint = `/.netlify/functions/youtube`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: videoId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch video data.');
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async function runAnalysis(videoId) {
        // --- FIX: All UI "loading" logic now lives here.
        videoInput.disabled = true;
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        resultsContainer.innerHTML = '<div class="loader"></div>';

        try {
            const videoData = await fetchVideoData(videoId);
            const { title, description, tags, duration } = videoData;
            
            let totalScore = 0;
            const analysisResults = {};

            const titleAnalysis = evaluateTitle(title);
            analysisResults.title = titleAnalysis;
            totalScore += titleAnalysis.score;

            const descriptionAnalysis = evaluateDescription(description, duration);
            analysisResults.description = descriptionAnalysis;
            totalScore += descriptionAnalysis.score;

            const tagsAnalysis = evaluateTags(tags, title);
            analysisResults.tags = tagsAnalysis;
            totalScore += tagsAnalysis.score;
            
            displayResults(analysisResults, totalScore);

        } catch (error) {
            resultsContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        } finally {
            // --- FIX: All UI "reset" logic now lives here.
            videoInput.disabled = false;
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze';
        }
    }

    // --- Evaluation Logic (No changes needed here) ---
    function evaluateTitle(title) {
        let score = 0;
        const feedback = [];
        if (title.length >= 60 && title.length <= 70) {
            score += 10;
            feedback.push({ pass: true, text: `Length is ${title.length} characters (optimal).` });
        } else {
            feedback.push({ pass: false, text: `Length is ${title.length} characters.`, suggestion: 'Aim for 60-70 characters to avoid truncation.' });
        }
        const firstWords = title.split(' ').slice(0, 3).join(' ');
        if (title.toLowerCase().startsWith(firstWords.toLowerCase())) {
             score += 15;
             feedback.push({ pass: true, text: 'Primary keywords appear to be at the start.'});
        }
        if (/[\[\]()]|\b(how to|guide|review|tutorial|best|easy|fast)\b/i.test(title) || /\d+/.test(title)) {
            score += 10;
            feedback.push({ pass: true, text: 'Uses engaging elements (numbers, brackets, power words).' });
        } else {
            feedback.push({ pass: false, text: 'Lacks common CTR-boosting elements.', suggestion: 'Consider adding numbers, brackets, or words like "Guide" or "Review".' });
        }
        return { score, max: 35, feedback };
    }

    function evaluateDescription(description, duration) {
        let score = 0;
        const feedback = [];
        const wordCount = description ? description.split(/\s+/).length : 0;
        const hasTimestamps = /^\d{1,2}:\d{2}/m.test(description);
        score += 15;
        feedback.push({ pass: true, text: 'Includes keywords in the opening paragraph.', suggestion: 'Ensure your main keyword appears in the first 2-3 sentences.' });
        if (wordCount > 150) {
            score += 10;
            feedback.push({ pass: true, text: `Description is detailed (${wordCount} words).` });
        } else {
            feedback.push({ pass: false, text: `Description is short (${wordCount} words).`, suggestion: 'Aim for over 150 words to provide more context.' });
        }
        if (/subscribe|playlist|follow|shop|visit|http[s]?:\/\//i.test(description)) {
            score += 10;
            feedback.push({ pass: true, text: 'Includes at least one Call-to-Action (CTA) link.' });
        } else {
            feedback.push({ pass: false, text: 'No CTA links found.', suggestion: 'Add links to subscribe, other videos, or your website.' });
        }
        const durationInSeconds = duration ? (duration.match(/(\d+)M/)?.[1] * 60 || 0) + (duration.match(/(\d+)S/)?.[1] * 1 || 0) : 0;
        if (durationInSeconds > 180) {
            if (hasTimestamps) {
                score += 5;
                feedback.push({ pass: true, text: 'Includes timestamps for easy navigation.' });
            } else {
                feedback.push({ pass: false, text: 'Video is over 3 minutes but lacks timestamps.', suggestion: 'Add timestamps to help viewers find key moments.' });
            }
        }
        return { score, max: 40, feedback };
    }

    function evaluateTags(tags, title) {
        let score = 0;
        const feedback = [];
        tags = tags || [];
        const tagsLength = tags.join('').length;
        const primaryKeyword = title.split(' ').slice(0, 3).join(' ').toLowerCase();
        if (tags.length > 0 && tags[0].toLowerCase().includes(primaryKeyword.split(' ')[0])) {
            score += 10;
            feedback.push({ pass: true, text: 'The first tag is aligned with the title.' });
        } else {
            feedback.push({ pass: false, text: 'First tag does not seem to match the primary keyword.', suggestion: 'Make your first tag your main target keyword.' });
        }
        if (tagsLength > 250) {
            score += 10;
            feedback.push({ pass: true, text: `Good volume of tags used (${tagsLength}/500 chars).` });
        } else {
            feedback.push({ pass: false, text: `Low volume of tags used (${tagsLength}/500 chars).`, suggestion: 'Use more of the available 500 characters for tags.' });
        }
        const longTailCount = tags.filter(tag => tag.split(' ').length > 2).length;
        if (tags.length > 5 && longTailCount > 0) {
            score += 5;
            feedback.push({ pass: true, text: 'Contains a healthy mix of broad and long-tail keywords.' });
        } else {
            feedback.push({ pass: false, text: 'Lacks a good mix of keyword types.', suggestion: 'Include both broad tags (e.g., "baking") and specific tags (e.g., "how to bake cookies").' });
        }
        return { score, max: 25, feedback };
    }

    // --- Helper function for score animation ---
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
    
    // --- FIX: Rendering logic is now correctly structured.
    function displayResults(results, totalScore) {
        // --- FIX: Helper functions are defined *before* being used.
        const createChecklistItem = ({ pass, text, suggestion }) => `
            <li class="${pass ? 'success' : 'warning'}">
                <span class="icon">${pass ? '✅' : '⚠️'}</span>
                <span class="feedback-text">
                    ${text}
                    ${!pass && suggestion ? `<span class="suggestion">${suggestion}</span>` : ''}
                </span>
            </li>
        `;

        const createReportCard = (title, analysis) => `
            <div class="report-card">
                <div class="card-header">
                    <h2>${title} <span>${analysis.score}/${analysis.max} pts</span></h2>
                </div>
                <div class="card-body">
                    <ul class="checklist">
                        ${analysis.feedback.map(createChecklistItem).join('')}
                    </ul>
                </div>
            </div>
        `;

        // --- FIX: resultsContainer is only updated ONCE.
        resultsContainer.innerHTML = `
            <div class="overall-score">
                <h2>Overall Compliance Score</h2>
                <div class="score-value" id="total-score-value"></div>
            </div>
            ${createReportCard('Title Analysis', results.title)}
            ${createReportCard('Description Analysis', results.description)}
            ${createReportCard('Keywords / Tags Analysis', results.tags)}
        `;

        // --- FIX: Animation logic is now correctly placed inside the function.
        const scoreElement = document.getElementById('total-score-value');
        animateValue(scoreElement, 0, totalScore, 800);
        setTimeout(() => {
            scoreElement.innerHTML += '<span style="font-size: 1.5rem; color: #666;">/100</span>';
        }, 850);
    }
    // ... all your existing code ...

    // --- Accordion Logic ---
    const accordion = document.querySelector('.accordion');
    if (accordion) {
        accordion.addEventListener('click', function() {
            this.classList.toggle('active');
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + "px";
            }
        });
    }

}); // This is the closing bracket for DOMContentLoaded