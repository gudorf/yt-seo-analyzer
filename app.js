document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const videoInput = document.getElementById('video-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const competeBtn = document.getElementById('compete-btn');
    const resultsContainer = document.getElementById('results-container');
    const competitorsContainer = document.getElementById('competitors-container');
    const analyzeTranscriptBtn = document.getElementById('analyze-transcript-btn');
    const transcriptInput = document.getElementById('transcript-input');
    const suggestionsContainerLive = document.getElementById('suggestions-container-live');
    const accordion = document.querySelector('.accordion');

    // --- Event Listeners ---
    if (analyzeBtn) {
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
    }

    if (competeBtn) {
        competeBtn.addEventListener('click', async () => {
            const input = videoInput.value.trim();
            if (!input) {
                alert('Please enter a YouTube Video URL or ID first.');
                return;
            }
            const videoId = parseYouTubeId(input);
            if (!videoId) {
                alert('Could not find a valid YouTube Video ID in the input.');
                return;
            }
            await runCompetitiveAnalysis(videoId);
        });
    }

    if (analyzeTranscriptBtn) {
        analyzeTranscriptBtn.addEventListener('click', () => {
            const transcriptText = transcriptInput.value;
            if (!transcriptText || transcriptText.trim() === '') {
                alert('Please paste a transcript into the text area first.');
                return;
            }
            const suggestions = analyzeTranscript(transcriptText);
            const advancedMetrics = getAdvancedTranscriptAnalysis(transcriptText);
            displaySuggestions(suggestions, advancedMetrics);
        });
    }

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

    // --- Core Logic ---
    function parseYouTubeId(input) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?$/,
            /^([\w-]{11})$/
        ];
        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    async function fetchVideoData(videoId) {
        const endpoint = `/.netlify/functions/youtube`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: videoId, action: 'analyze' }),
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
        videoInput.disabled = true;
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        resultsContainer.innerHTML = '<div class="loader"></div>';
        competitorsContainer.innerHTML = '';

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
            videoInput.disabled = false;
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Metadata';
        }
    }

    async function runCompetitiveAnalysis(videoId) {
        competeBtn.disabled = true;
        competeBtn.textContent = 'Analyzing...';
        competitorsContainer.innerHTML = '<div class="loader"></div>';
        resultsContainer.innerHTML = '';

        try {
            const userData = await fetchVideoData(videoId);
            let keyword = '';
            if (userData.tags && userData.tags.length > 0) {
                keyword = userData.tags[0];
            } else {
                keyword = userData.title.split(' ').slice(0, 3).join(' ');
            }

            const competitors = await fetchCompetitors(keyword, videoId);
            displayCompetitors(userData, competitors, keyword);
        } catch (error) {
            competitorsContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        } finally {
            competeBtn.disabled = false;
            competeBtn.textContent = 'Competitive Analysis';
        }
    }

    async function fetchCompetitors(keyword, videoId) {
        const endpoint = `/.netlify/functions/youtube`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search', keyword: keyword, videoId: videoId }), // videoId was missing
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch competitors.');
        }
        return await response.json();
    }

    // --- Evaluation Logic ---
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
            feedback.push({ pass: true, text: 'Primary keywords appear to be at the start.' });
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
        const durationInSeconds = duration ? (duration.match(/(\d+)M/)?.[1] * 60 || 0) + (duration.match(/(\d+)S/)?.[1] * 1 || 0) : 0;
        const isShort = durationInSeconds <= 61;
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
        if (!isShort) {
            if (durationInSeconds > 180) {
                if (hasTimestamps) {
                    score += 5;
                    feedback.push({ pass: true, text: 'Includes timestamps for easy navigation.' });
                } else {
                    feedback.push({ pass: false, text: 'Video is over 3 minutes but lacks timestamps.', suggestion: 'Add timestamps to help viewers find key moments.' });
                }
            }
        }
        return { score, max: isShort ? 35 : 40, feedback };
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

    // --- Rendering and Helper Functions ---
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    function displayResults(results, totalScore) {
        const createChecklistItem = ({ pass, text, suggestion }) => `
            <li class="${pass ? 'success' : 'warning'}">
                <span class="icon">${pass ? '✅' : '⚠️'}</span>
                <span class="feedback-text">${text}${!pass && suggestion ? `<span class="suggestion">${suggestion}</span>` : ''}</span>
            </li>`;
        const createReportCard = (title, analysis) => `
            <div class="report-card">
                <div class="card-header"><h2>${title} <span>${analysis.score}/${analysis.max} pts</span></h2></div>
                <div class="card-body"><ul class="checklist">${analysis.feedback.map(createChecklistItem).join('')}</ul></div>
            </div>`;
        resultsContainer.innerHTML = `
            <div class="overall-score">
                <h2>Overall Compliance Score</h2>
                <div class="score-value" id="total-score-value"></div>
            </div>
            ${createReportCard('Title Analysis', results.title)}
            ${createReportCard('Description Analysis', results.description)}
            ${createReportCard('Keywords / Tags Analysis', results.tags)}`;
        const scoreElement = document.getElementById('total-score-value');
        animateValue(scoreElement, 0, totalScore, 800);
        setTimeout(() => {
            scoreElement.innerHTML += `<span style="font-size: 1.5rem; color: #666;">/100</span>`;
        }, 850);
    }

    function displayCompetitors(userData, competitors, keyword) {
        const createCardHTML = (snippet, isUser = false) => {
            const tn = snippet.thumbnails;
            const thumbnailUrl = tn.high?.url || tn.medium?.url || tn.default?.url;
            return `
                <div class="competitor-card ${isUser ? 'is-user' : ''}">
                    <img src="${thumbnailUrl}" alt="Video thumbnail">
                    <div class="title">${snippet.title}</div>
                </div>`;
        };
        const userSnippet = {
            title: userData.title,
            thumbnails: { high: { url: userData.thumbnail } }
        };
        const userCardHTML = createCardHTML(userSnippet, true);
        const competitorCardsHTML = competitors.map(item => createCardHTML(item.snippet)).join('');
        competitorsContainer.innerHTML = `
            <div class="competitors-gallery">
                <h3>Your Video vs. Top 5 for "${keyword}"</h3>
                <div class="competitors-grid">
                    ${userCardHTML}
                    ${competitorCardsHTML}
                </div>
            </div>`;
    }

    function analyzeTranscript(text) {
        const commonWords = new Set(['the', 'a', 'an', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'out', 'is', 'are', 'was', 'were', 'be', 'being', 'been', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'so', 'also', 'about', 'like', 'just', 'gonna', 'really', 's']);
        const words = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
        const wordFrequencies = {};
        for (const word of words) {
            if (!commonWords.has(word) && word.length > 2) {
                wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
            }
        }
        return Object.keys(wordFrequencies).sort((a, b) => wordFrequencies[b] - wordFrequencies[a]).slice(0, 10);
    }
    
    function getAdvancedTranscriptAnalysis(text) {
        const cleanedText = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\[.*?\]/g, "");
        const sentences = cleanedText.split(/[.?!]+\s/).filter(s => s.length > 0);
        const numSentences = sentences.length > 0 ? sentences.length : 1;
        const words = cleanedText.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(w => w.length > 0);
        const numWords = words.length > 0 ? words.length : 1;
        const countSyllables = (word) => {
            word = word.toLowerCase();
            if (word.length <= 3) return 1;
            word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
            word = word.replace(/^y/, '');
            const syllables = word.match(/[aeiouy]{1,2}/g);
            return syllables ? syllables.length : 0;
        };
        let totalSyllables = 0;
        words.forEach(word => { totalSyllables += countSyllables(word); });
        totalSyllables = totalSyllables > 0 ? totalSyllables : 1;
        const readabilityScore = Math.max(0, Math.round(206.835 - 1.015 * (numWords / numSentences) - 84.6 * (totalSyllables / numWords)));
        const positiveWords = ['love', 'amazing', 'best', 'great', 'awesome', 'beautiful', 'easy', 'fun', 'helpful', 'thanks'];
        const negativeWords = ['bad', 'hate', 'terrible', 'problem', 'difficult', 'issue', 'hard', 'boring'];
        let sentimentScore = 0;
        words.forEach(word => {
            if (positiveWords.includes(word)) sentimentScore++;
            if (negativeWords.includes(word)) sentimentScore--;
        });
        const actionWords = ['subscribe', 'like', 'comment', 'share', 'download', 'click', 'visit'];
        const foundActionWords = actionWords.filter(actionWord => cleanedText.toLowerCase().includes(actionWord));
        return { readabilityScore, sentimentScore, foundActionWords };
    }

    function displaySuggestions(suggestions, metrics) {
        let pillsHTML = suggestions.length > 0 ? suggestions.map(word => `<span class="pill">${word}</span>`).join('') : '<span>No unique keywords found.</span>';
        let actionWordsHTML = metrics.foundActionWords.length > 0 ? metrics.foundActionWords.map(word => `<span class="pill">${word}</span>`).join('') : '<span>None detected.</span>';
        suggestionsContainerLive.className = 'keywords-suggestions';
        suggestionsContainerLive.innerHTML = `
            <h3>Advanced Transcript Analysis</h3>
            <div class="metrics-grid">
                <div><strong>Readability Score:</strong> ${metrics.readabilityScore} <span class="light-text">(60-80 is ideal)</span></div>
                <div><strong>Sentiment Score:</strong> ${metrics.sentimentScore > 0 ? `+${metrics.sentimentScore}` : metrics.sentimentScore} <span class="light-text">(Positive/Negative tone)</span></div>
            </div>
            <div class="action-words">
                <strong>Actionable Language Detected:</strong>
                <div>${actionWordsHTML}</div>
            </div>
            <hr style="margin: 1.5rem 0;">
            <h4>Suggested Keywords & Topics</h4>
            <p class="light-text">Based on your transcript, consider using these terms:</p>
            <div>${pillsHTML}</div>`;
    }
});