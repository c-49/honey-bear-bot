const { EmbedBuilder } = require('discord.js');

class SpamDetectionManager {
    constructor(modChannelId = '1496246346372350033') {
        // Track user messages with timestamp and content
        // Structure: { userId: { messages: [{content, channelId, timestamp, messageId}] } }
        this.userMessageHistory = new Map();

        // Config for spam detection
        this.config = {
            timeWindow: 30000, // 30 seconds
            messageThreshold: 4, // 4+ messages
            similarityThreshold: 0.8, // Check if messages are similar (0-1 scale)
            cooldownPeriod: 300000, // 5 minutes - don't check same user repeatedly
            timeoutDuration: 86400000, // 24 hours in milliseconds
        };

        // Mod channel ID for notifications
        this.modChannelId = modChannelId;

        // Track when we last actioned a user to avoid duplicate actions
        this.recentlyActioned = new Map();
    }

    /**
     * Normalize message content for comparison (remove special chars, lowercase)
     */
    normalizeContent(content) {
        return content
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();
    }

    /**
     * Calculate similarity between two strings (simple Levenshtein-like comparison)
     */
    calculateSimilarity(str1, str2) {
        const s1 = this.normalizeContent(str1);
        const s2 = this.normalizeContent(str2);

        if (s1 === s2) return 1;
        if (s1.length === 0 || s2.length === 0) return 0;

        // Check if one contains the other (useful for slightly modified spam)
        if (s1.includes(s2) || s2.includes(s1)) {
            return Math.max(s1.length, s2.length) / Math.min(s1.length, s2.length);
        }

        // Simple character overlap similarity
        const set1 = new Set(s1);
        const set2 = new Set(s2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Check if message is likely to contain spam content (links, potential scams)
     */
    isSpamContent(content) {
        // Check for common spam indicators
        const spamIndicators = [
            /discord\.gg\/\w+/gi,           // Discord invite links
            /bit\.ly\/\w+/gi,               // Shortened links
            /tinyurl\.com\/\w+/gi,          // TinyURL links
            /https?:\/\/([a-z0-9\-]+\.)+/gi, // Generic URLs
            /free.*nitro/gi,                // Free nitro scams
            /claim.*reward/gi,              // Reward scams
            /verify.*account/gi,            // Account verification scams
        ];

        return spamIndicators.some(pattern => pattern.test(content));
    }

    /**
     * Check if message is spam and return spam detection result
     */
    async checkForSpam(message) {
        const userId = message.author.id;
        const channelId = message.channelId;
        const content = message.content;
        const now = Date.now();

        // Initialize user history if needed
        if (!this.userMessageHistory.has(userId)) {
            this.userMessageHistory.set(userId, {
                messages: []
            });
        }

        const userHistory = this.userMessageHistory.get(userId);

        // Add current message to history
        userHistory.messages.push({
            content,
            channelId,
            messageId: message.id,
            timestamp: now
        });

        // Clean up old messages outside time window
        userHistory.messages = userHistory.messages.filter(
            msg => now - msg.timestamp < this.config.timeWindow
        );

        // Check spam patterns - ONLY flag if:
        // 1. Messages are across multiple channels (NOT just one channel)
        // 2. AND messages are similar (indicating copy-paste spam)
        // 3. OR messages contain known spam content across channels
        if (userHistory.messages.length >= this.config.messageThreshold) {
            const uniqueChannels = new Set(userHistory.messages.map(m => m.channelId));

            // CRITICAL: Only consider it spam if across MULTIPLE channels
            // Single-channel rapid typing is legitimate user behavior
            if (uniqueChannels.size >= 2) {
                // Check if messages are similar (spam bots post identical messages)
                const firstMessage = userHistory.messages[0].content;
                let similarMessageCount = 0;
                let spamContentCount = 0;

                for (const msg of userHistory.messages) {
                    const similarity = this.calculateSimilarity(firstMessage, msg.content);
                    if (similarity >= this.config.similarityThreshold) {
                        similarMessageCount++;
                    }
                    if (this.isSpamContent(msg.content)) {
                        spamContentCount++;
                    }
                }

                // If we have enough similar messages across channels, it's spam
                if (similarMessageCount >= this.config.messageThreshold) {
                    return {
                        isSpam: true,
                        messageCount: userHistory.messages.length,
                        channelCount: uniqueChannels.size,
                        similarity: similarMessageCount,
                        type: 'cross_channel_identical'
                    };
                }

                // If multiple messages with spam content across channels, it's spam
                if (spamContentCount >= 2) {
                    return {
                        isSpam: true,
                        messageCount: userHistory.messages.length,
                        channelCount: uniqueChannels.size,
                        similarity: spamContentCount,
                        type: 'cross_channel_spam_content'
                    };
                }
            }
        }

        return { isSpam: false };
    }

    /**
     * Execute action against spam user
     */
    async executeSpamAction(message, spamData) {
        const userId = message.author.id;
        const now = Date.now();

        // Check if we've recently actioned this user
        if (this.recentlyActioned.has(userId)) {
            const lastActionTime = this.recentlyActioned.get(userId);
            if (now - lastActionTime < this.config.cooldownPeriod) {
                console.log(`[SpamDetection] Cooldown active for user ${userId}, skipping action`);
                return;
            }
        }

        try {
            // Get the member to timeout
            const member = await message.guild.members.fetch(userId);
            
            if (!member) {
                console.log(`[SpamDetection] Could not find member ${userId}`);
                return;
            }

            // Timeout for 24 hours
            const reason = `[AUTO] Suspected spam account - sent ${spamData.messageCount} similar messages across ${spamData.channelCount} channels`;
            await member.timeout(this.config.timeoutDuration, reason);

            // Record the action
            this.recentlyActioned.set(userId, now);

            console.log(`[SpamDetection] Timed out user ${userId} for spam`);

            // Send DM to the user
            await this.sendSpamWarningDM(message.author, spamData);

            // Send mod notification
            if (this.modChannelId) {
                await this.sendModNotification(message, member, spamData);
            }

            // Delete the spam messages
            await this.deleteSpamMessages(message, spamData);

            return true;
        } catch (error) {
            console.error(`[SpamDetection] Error executing spam action:`, error.message);
            return false;
        }
    }

    /**
     * Send warning DM to the user
     */
    async sendSpamWarningDM(user, spamData) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚠️ Account Security Alert')
                .setDescription(
                    'Your account has been temporarily muted due to spam activity detected on our server.'
                )
                .addFields(
                    {
                        name: 'What Happened?',
                        value: 'Our moderation system detected patterns consistent with either:\n' +
                               '• Automated spam/bot activity\n' +
                               '• Your account being compromised\n' +
                               '• Malicious account takeover'
                    },
                    {
                        name: 'Details',
                        value: `Similar messages sent: ${spamData.messageCount}\n` +
                               `Channels affected: ${spamData.channelCount}\n` +
                               `Duration: 24 hours`
                    },
                    {
                        name: 'What Should You Do?',
                        value: '1. **If this was you:** Contact a moderator to appeal (we can remove the timeout).\n' +
                               '2. **If it wasn\'t you:** Change your Discord password immediately and enable 2FA.\n' +
                               '3. **Then:** Message a mod to let them know so we can assist.'
                    },
                    {
                        name: 'Need Help?',
                        value: 'Please DM a moderator or post in the support channel with this message. We\'re here to help! 💙'
                    }
                )
                .setFooter({ text: 'This is an automated security measure' })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            console.log(`[SpamDetection] Sent warning DM to user ${user.id}`);
        } catch (error) {
            console.error(`[SpamDetection] Could not send DM to user ${user.id}:`, error.message);
        }
    }

    /**
     * Send mod channel notification with full user details and spam sample
     */
    async sendModNotification(message, member, spamData) {
        try {
            const modChannel = await message.client.channels.fetch(this.modChannelId);
            if (!modChannel) return;

            const user = message.author;
            const accountCreated = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
            const joinedServer = member.joinedAt
                ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
                : 'Unknown';

            const spamSample = message.content.length > 1024
                ? message.content.slice(0, 1021) + '...'
                : message.content || '*(no text content)*';

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 Spam Detected — Auto Timeout Applied')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'User', value: `${user.tag}\n${user.toString()}\nID: \`${user.id}\``, inline: true },
                    { name: 'Account Created', value: accountCreated, inline: true },
                    { name: 'Joined Server', value: joinedServer, inline: true },
                    {
                        name: 'Spam Stats',
                        value: `Messages: **${spamData.messageCount}**\nChannels: **${spamData.channelCount ?? 'N/A'}**\nType: \`${spamData.type ?? 'cross_channel'}\``
                    },
                    { name: 'Sample Message', value: spamSample }
                )
                .setFooter({ text: 'User has been timed out for 24 hours' })
                .setTimestamp();

            await modChannel.send({ embeds: [embed] });
            console.log(`[SpamDetection] Sent mod notification for user ${user.id}`);
        } catch (error) {
            console.error(`[SpamDetection] Could not send mod notification:`, error.message);
        }
    }

    /**
     * Delete spam messages from the recent history using stored message IDs
     */
    async deleteSpamMessages(triggerMessage) {
        try {
            const userId = triggerMessage.author.id;
            const userHistory = this.userMessageHistory.get(userId);

            if (!userHistory) return;

            for (const msgData of userHistory.messages) {
                try {
                    const channel = await triggerMessage.client.channels.fetch(msgData.channelId);
                    if (!channel?.messages) continue;

                    const msg = await channel.messages.fetch(msgData.messageId);
                    if (msg) await msg.delete();
                } catch (deleteError) {
                    console.log(`[SpamDetection] Could not delete message ${msgData.messageId}: ${deleteError.message}`);
                }
            }

            console.log(`[SpamDetection] Deleted spam messages for user ${userId}`);
        } catch (error) {
            console.error(`[SpamDetection] Error deleting spam messages:`, error.message);
        }
    }

    /**
     * Clear history for a user (useful after action taken)
     */
    clearUserHistory(userId) {
        this.userMessageHistory.delete(userId);
    }

    /**
     * Get spam statistics for a user
     */
    getUserSpamStats(userId) {
        const userHistory = this.userMessageHistory.get(userId);
        if (!userHistory) return null;

        return {
            messageCount: userHistory.messages.length,
            channelCount: new Set(userHistory.messages.map(m => m.channelId)).size,
            timeSpan: userHistory.messages.length > 0 
                ? userHistory.messages[userHistory.messages.length - 1].timestamp - userHistory.messages[0].timestamp
                : 0
        };
    }
}

module.exports = SpamDetectionManager;
