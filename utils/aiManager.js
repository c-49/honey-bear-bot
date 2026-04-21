const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

class AIManager {
    constructor() {
        this.client = new OpenAI({
            baseURL: process.env.AI_API_BASE_URL || 'https://api.pawan.krd/v1',
            apiKey: process.env.AI_API_KEY,
        });
        
        this.model = process.env.AI_MODEL || 'pkrd/cosmosrp-2.1';
        this.promptPath = path.join(__dirname, 'aiPrompt.txt');
        
        // Load system prompt
        try {
            this.systemPrompt = fs.readFileSync(this.promptPath, 'utf-8');
        } catch (error) {
            console.error('Failed to load AI system prompt:', error.message);
            this.systemPrompt = 'You are a helpful Discord bot assistant.';
        }
    }

    /**
     * Generate an AI response for a message
     * @param {string} userMessage - The user's message
     * @param {string} userName - The username for context
     * @returns {Promise<string>} The AI response
     */
    async generateResponse(userMessage, userName) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: this.systemPrompt
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI API Error:', error.message);
            throw error;
        }
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
}

module.exports = new AIManager();
