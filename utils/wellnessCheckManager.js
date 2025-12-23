const userDataManager = require('./userDataManager');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MOD_CHAT_ID = '1294668387322171475';
const DM_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const DM_CHECK_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class WellnessCheckManager {
    constructor(client) {
        this.client = client;
        this.activeChecks = new Map(); // Track active DM checks
    }

    // Start the wellness check manager
    start() {
        // Check for reminders every minute
        this.reminderInterval = setInterval(() => this.checkReminders(), 60 * 1000);
        
        // Start DM monitoring for existing pending checks
        this.startDMMonitoring();
        
        console.log('Wellness Check Manager started');
    }

    // Stop the wellness check manager
    stop() {
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
        }
        this.activeChecks.forEach(timeout => clearTimeout(timeout));
        this.activeChecks.clear();
        console.log('Wellness Check Manager stopped');
    }

    // Check for pending reminders
    async checkReminders() {
        try {
            const pendingChecks = await userDataManager.getPendingWellnessChecks();
            
            for (const check of pendingChecks) {
                // Skip checks that have already been sent a reminder
                if (check.status === 'reminder_sent') continue;

                // Send reminder to mod chat
                await this.sendReminderToModChat(check);

                // Mark as reminder sent
                await userDataManager.updateReminderSent(check.check_id);
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    // Send reminder to mod chat
    async sendReminderToModChat(check) {
        try {
            const modChat = await this.client.channels.fetch(MOD_CHAT_ID);
            
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔔 Wellness Check Reminder')
                .addFields(
                    { name: 'User', value: `<@${check.user_id}>`, inline: true },
                    { name: 'Flagged By', value: `<@${check.flagged_by}>`, inline: true },
                    { name: 'Time Elapsed', value: 'Reminder time reached', inline: true }
                );

            if (check.note) {
                embed.addFields({ name: 'Note', value: check.note });
            }

            if (check.user_responded) {
                embed.addFields({ name: 'User Response', value: check.response_text || 'Responded' });
            }

            const resolveButton = new ButtonBuilder()
                .setCustomId(`resolve_check_${check.check_id}`)
                .setLabel('Mark Resolved')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(resolveButton);

            embed.setFooter({ text: `Check ID: ${check.check_id}` });

            await modChat.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error sending reminder to mod chat:', error);
        }
    }

    // Start DM monitoring for auto-DM checks
    startDMMonitoring() {
        this.dmMonitorInterval = setInterval(() => this.monitorDMChecks(), DM_CHECK_INTERVAL);
    }

    // Monitor active DM checks and handle responses
    async monitorDMChecks() {
        try {
            // Get all pending auto-DM checks
            const checks = await userDataManager.getPendingWellnessChecks();
            const autoDMChecks = checks.filter(c => c.auto_dm && c.status === 'pending');

            for (const check of autoDMChecks) {
                const elapsedTime = Date.now() - new Date(check.created_at).getTime();
                
                // If 24 hours have passed and no response, timeout
                if (elapsedTime > DM_CHECK_DURATION) {
                    await this.handleDMTimeout(check);
                }
            }
        } catch (error) {
            console.error('Error monitoring DM checks:', error);
        }
    }

    // Handle DM timeout (24 hours passed without response)
    async handleDMTimeout(check) {
        try {
            // Resolve the check as timed out
            await userDataManager.resolveWellnessCheck(check.check_id, 'system', 'timeout');

            // Send timeout notification to mod chat
            const modChat = await this.client.channels.fetch(MOD_CHAT_ID);
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⏱️ Wellness Check Timed Out')
                .setDescription(`<@${check.user_id}> did not respond within 24 hours.`)
                .addFields(
                    { name: 'Flagged By', value: `<@${check.flagged_by}>`, inline: true },
                    { name: 'Status', value: 'Timed Out', inline: true }
                );

            if (check.note) {
                embed.addFields({ name: 'Note', value: check.note });
            }

            if (check.dms_disabled) {
                embed.addFields({ name: 'Note', value: '⚠️ User has DMs disabled' });
            }

            embed.setFooter({ text: `Check ID: ${check.check_id}` });
            embed.setTimestamp();

            await modChat.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling DM timeout:', error);
        }
    }

    // Handle user response to wellness check DM
    async handleUserResponse(userId, messageContent) {
        try {
            // Find the active check for this user
            const activeChecks = await userDataManager.getActiveWellnessChecks(userId);
            
            if (activeChecks.length === 0) return;

            const check = activeChecks[0]; // Get the most recent check

            // Update the check with response
            await userDataManager.updateWellnessCheckResponse(check.check_id, true, messageContent);

            // Notify mod chat that user responded
            await this.notifyModChatOfResponse(check, messageContent);

        } catch (error) {
            console.error('Error handling user response:', error);
        }
    }

    // Notify mod chat of user response
    async notifyModChatOfResponse(check, responseText) {
        try {
            const modChat = await this.client.channels.fetch(MOD_CHAT_ID);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Wellness Check - User Responded')
                .addFields(
                    { name: 'User', value: `<@${check.user_id}>`, inline: true },
                    { name: 'Status', value: 'Responded', inline: true },
                    { name: 'Response', value: responseText || 'User responded to check' }
                );

            if (check.note) {
                embed.addFields({ name: 'Original Note', value: check.note });
            }

            const resolveButton = new ButtonBuilder()
                .setCustomId(`resolve_check_${check.check_id}`)
                .setLabel('Mark Resolved')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(resolveButton);

            embed.setFooter({ text: `Check ID: ${check.check_id}` });
            embed.setTimestamp();

            await modChat.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error notifying mod chat of response:', error);
        }
    }
}

module.exports = WellnessCheckManager;
