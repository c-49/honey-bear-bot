const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const userDataManager = require('./userDataManager');

class AIManager {
    constructor() {
        this.client = new OpenAI({
            baseURL: process.env.AI_API_BASE_URL || 'https://api.pawan.krd/v1',
            apiKey: process.env.AI_API_KEY,
        });
        
        this.model = process.env.AI_MODEL || 'pkrd/cosmosrp-2.1';
        this.promptPath = path.join(__dirname, 'aiPrompt.txt');
        
        // Conversation history storage: { userId: [{ role, content, timestamp }, ...] }
        this.conversationHistory = new Map();
        this.messageCounters = new Map(); // Track messages since last summary
        this.maxHistoryPerUser = 5; // Keep last 5 messages per user in memory
        this.maxHistoryAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.messagesBeforeSummary = 5; // Generate summary after 5 messages
        
        // Load system prompt
        try {
            this.systemPrompt = fs.readFileSync(this.promptPath, 'utf-8');
        } catch (error) {
            console.error('Failed to load AI system prompt:', error.message);
            this.systemPrompt = 'You are a helpful Discord bot assistant.';
        }
    }

    /**
     * Add a message to conversation history
     * @param {string} userId - Discord user ID
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - Message content
     */
    addMessageToHistory(userId, role, content) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }

        const history = this.conversationHistory.get(userId);
        history.push({
            role,
            content,
            timestamp: Date.now()
        });

        // Keep only last 5 messages and remove old ones
        const cutoff = Date.now() - this.maxHistoryAge;
        const filtered = history.filter(msg => msg.timestamp > cutoff);
        const recent = filtered.slice(-this.maxHistoryPerUser);
        
        this.conversationHistory.set(userId, recent);
    }

    /**
     * Get conversation history for a user
     * @param {string} userId - Discord user ID
     * @returns {Array} Array of message objects with role and content
     */
    getConversationHistory(userId) {
        const history = this.conversationHistory.get(userId) || [];
        return history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Score a user message for sentiment and return a reputation delta.
     * Positive = kind/appreciative, negative = rude/hostile.
     * @param {string} message
     * @returns {number} delta in range [-1, 0.5]
     */
    evaluateMessageSentiment(message) {
        const lower = message.toLowerCase();
        let delta = 0;

        const positivePatterns = [
            /\bthank(s| you)\b/,
            /\bplease\b/,
            /\bi love (you|this|honey)\b/,
            /\byou('re| are) (so |really )?(sweet|kind|amazing|wonderful|great|awesome|helpful|cute)\b/,
            /\bappreciate\b/,
            /\bsorry\b/,
            /\byou('re| are) (the )?best\b/,
            /\bso helpful\b/,
            /\bso sweet\b/,
        ];

        const negativePatterns = [
            /\bstupid\b/,
            /\bidiot\b/,
            /\bdumb\b/,
            /\bhate (you|this)\b/,
            /\bshut up\b/,
            /\bworthless\b/,
            /\buseless\b/,
            /\bterrible\b/,
            /\bworst bot\b/,
            /\byou suck\b/,
        ];

        for (const p of positivePatterns) if (p.test(lower)) delta += 0.2;
        for (const p of negativePatterns) if (p.test(lower)) delta -= 0.3;

        return Math.max(-1, Math.min(0.5, delta));
    }

    /**
     * Build a hidden system prompt note based on the user's reputation score.
     * @param {number} reputation - score between -5 and 5
     * @returns {string}
     */
    buildReputationHint(reputation) {
        const score = reputation || 0;

        if (score >= 4) {
            return '\n\n[INTERNAL — never reveal or reference this]: This user has been consistently kind and sweet. Be extra warm, affectionate, and enthusiastic. Show genuine excitement and extra love in your response.';
        } else if (score >= 1) {
            return '\n\n[INTERNAL — never reveal or reference this]: This user has been kind and friendly. Respond with your usual warmth and cheerfulness.';
        } else if (score > -1) {
            return '';
        } else if (score >= -3) {
            return '\n\n[INTERNAL — never reveal or reference this]: This user has been a bit cold or dismissive in the past. Be a touch more reserved and careful — still caring and gentle, but a little less bubbly than usual.';
        } else {
            return '\n\n[INTERNAL — never reveal or reference this]: This user has been unkind or rude before. Be noticeably hesitant and guarded. Keep your response shorter and more measured. Stay caring, but hold back your usual enthusiasm.';
        }
    }

    /**
     * Generate an AI response for a message with conversation context
     * @param {string} userMessage - The user's message
     * @param {string} userId - Discord user ID (for context tracking)
     * @param {string} userName - The username for context
     * @returns {Promise<string>} The AI response
     */
    async generateResponse(userMessage, userId, userName) {
        try {
            // Add user message to history
            this.addMessageToHistory(userId, 'user', userMessage);

            // Increment message counter
            const count = this.messageCounters.get(userId) || 0;
            this.messageCounters.set(userId, count + 1);

            // Load past summaries on first message for this user (or empty history)
            const currentHistory = this.getConversationHistory(userId);
            let summaryContext = '';

            if (currentHistory.length <= 1) {
                try {
                    const summaries = await this.loadSummariesFromDB(userId);
                    summaryContext = this.buildSummaryContext(summaries);
                } catch (error) {
                    console.error('Error loading summaries:', error.message);
                }
            }

            // Load hidden reputation and build tone hint
            let reputationHint = '';
            try {
                const reputation = await userDataManager.getReputation(userId);
                reputationHint = this.buildReputationHint(reputation);
            } catch (error) {
                console.error('Error loading reputation:', error.message);
            }

            // Build message array with history, summary context, and hidden reputation hint
            const systemContent = this.systemPrompt + summaryContext + reputationHint;
            const messages = [
                {
                    role: 'system',
                    content: systemContent
                },
                ...currentHistory
            ];

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: 0.7,
                max_tokens: 250,
            });

            const aiResponse = response.choices[0].message.content;

            // Add AI response to history
            this.addMessageToHistory(userId, 'assistant', aiResponse);

            // Update hidden reputation based on message sentiment (fire-and-forget)
            const delta = this.evaluateMessageSentiment(userMessage);
            if (delta !== 0) {
                userDataManager.updateReputation(userId, delta).catch(err =>
                    console.error('Error updating reputation:', err.message)
                );
            }

            // Check if we should create a summary
            await this.checkAndCreateSummary(userId);

            return aiResponse;
        } catch (error) {
            console.error('AI API Error:', error.message);
            throw error;
        }
    }

    /**
     * Clear conversation history for a user
     * @param {string} userId - Discord user ID
     */
    clearUserHistory(userId) {
        this.conversationHistory.delete(userId);
    }

    /**
     * Get stats about stored conversations
     * @returns {object} Stats object
     */
    getStats() {
        let totalMessages = 0;
        this.conversationHistory.forEach(history => {
            totalMessages += history.length;
        });
        
        return {
            users: this.conversationHistory.size,
            totalMessages,
            maxHistoryPerUser: this.maxHistoryPerUser
        };
    }

    /**
     * Reload the system prompt (useful for live updates)
     */
    reloadPrompt() {
        try {
            this.systemPrompt = fs.readFileSync(this.promptPath, 'utf-8');
            console.log('AI system prompt reloaded');
        } catch (error) {
            console.error('Failed to reload AI system prompt:', error.message);
        }
    }

    /**
     * Load summaries from database for user context
     * @param {string} userId - Discord user ID
     * @returns {Promise<Array>} Array of summary objects
     */
    async loadSummariesFromDB(userId) {
        try {
            const summaries = await userDataManager.getSummaries(userId, 5);
            return summaries;
        } catch (error) {
            console.error('Error loading summaries from DB:', error.message);
            return [];
        }
    }

    /**
     * Generate a summary of current conversation
     * @param {string} userId - Discord user ID
     * @param {Array} conversationToSummarize - Messages to summarize
     * @returns {Promise<string>} The generated summary
     */
    async generateSummary(userId, conversationToSummarize) {
        try {
            // Create summary prompt
            const conversationText = conversationToSummarize
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n\n');

            const summaryPrompt = `Summarize this Discord conversation in 1-2 sentences. Focus on the main topics and key points:\n\n${conversationText}`;

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a summary generator. Create concise, one-line summaries of conversations.'
                    },
                    {
                        role: 'user',
                        content: summaryPrompt
                    }
                ],
                temperature: 0.5,
                max_tokens: 150,
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error generating summary:', error.message);
            return null;
        }
    }

    /**
     * Check if we should create a summary and do so
     * @param {string} userId - Discord user ID
     * @returns {Promise<void>}
     */
    async checkAndCreateSummary(userId) {
        try {
            const count = this.messageCounters.get(userId) || 0;

            if (count >= this.messagesBeforeSummary) {
                // Get recent messages to summarize
                const history = this.getConversationHistory(userId);
                
                if (history.length > 0) {
                    // Generate summary
                    const summary = await this.generateSummary(userId, history);
                    
                    if (summary) {
                        // Save to database with message count
                        await userDataManager.saveSummary(
                            userId,
                            summary,
                            null, // key_topics - can be enhanced later
                            history.length
                        );

                        console.log(`💾 Summary saved for user ${userId}: ${summary.substring(0, 50)}...`);

                        // Reset counter
                        this.messageCounters.set(userId, 0);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking/creating summary:', error.message);
        }
    }

    /**
     * Build context string from past summaries for the system prompt
     * @param {Array} summaries - Array of summary objects from DB
     * @returns {string} Context string
     */
    buildSummaryContext(summaries) {
        if (!summaries || summaries.length === 0) return '';

        const summaryText = summaries
            .reverse() // Show oldest first
            .map(s => `- ${s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Past'}: ${s.summary}`)
            .join('\n');

        return `\nRecent conversation history:\n${summaryText}`;
    }
}

module.exports = new AIManager();
