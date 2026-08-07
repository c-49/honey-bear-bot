const userDataManager = require('./userDataManager');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MOD_CHAT_ID } = require('./constants');
const DM_CHECK_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class WellnessCheckManager {
    constructor(client) {
        this.client = client;
        // Map of checkId → { reminderTimeout, dmTimeout }
        this.activeChecks = new Map();
    }

    // Load existing active checks from DB and schedule their timeouts
    async start() {
        try {
            const checks = await userDataManager.getAllActiveWellnessChecks();
            for (const check of checks) {
                this.scheduleCheck(check);
            }
            console.log(`Wellness Check Manager started (${checks.length} active check(s) scheduled)`);
        } catch (error) {
            console.error('Error loading wellness checks on startup:', error);
        }
    }

    stop() {
        for (const timers of this.activeChecks.values()) {
            if (timers.reminderTimeout) clearTimeout(timers.reminderTimeout);
            if (timers.dmTimeout) clearTimeout(timers.dmTimeout);
        }
        this.activeChecks.clear();
        console.log('Wellness Check Manager stopped');
    }

    // Schedule timeouts for a check. Call this when a check is created or on startup.
    scheduleCheck(check) {
        this.cancelCheck(check.check_id);

        const timers = {};

        if (check.status === 'pending' && check.reminder_time) {
            const reminderMs = Math.max(0, new Date(check.reminder_time) - Date.now());
            timers.reminderTimeout = setTimeout(() => this._fireReminder(check), reminderMs);
        }

        // Schedule 24h auto-DM timeout if applicable
        if (check.auto_dm && !check.user_responded) {
            const timeoutAt = new Date(check.created_at).getTime() + DM_CHECK_DURATION;
            const dmMs = timeoutAt - Date.now();
            if (dmMs > 0) {
                timers.dmTimeout = setTimeout(() => this._fireDmTimeout(check), dmMs);
            } else if (check.status === 'reminder_sent') {
                // Overdue — fire now (async, non-blocking)
                this._fireDmTimeout(check);
            }
        }

        if (timers.reminderTimeout || timers.dmTimeout) {
            this.activeChecks.set(check.check_id, timers);
        }
    }

    cancelCheck(checkId) {
        const timers = this.activeChecks.get(checkId);
        if (timers) {
            if (timers.reminderTimeout) clearTimeout(timers.reminderTimeout);
            if (timers.dmTimeout) clearTimeout(timers.dmTimeout);
            this.activeChecks.delete(checkId);
        }
    }

    async _fireReminder(checkSnapshot) {
        const checkId = checkSnapshot.check_id;
        try {
            const check = await userDataManager.getWellnessCheck(checkId);
            if (!check || check.status !== 'pending') return;
            if (check.auto_dm) {
                await this.sendAutoCheckDM(check);
            } else {
                await this.sendReminderToModChat(check);
            }
            await userDataManager.updateReminderSent(checkId);
        } catch (error) {
            console.error(`Error firing reminder for check ${checkId}:`, error);
        } finally {
            const timers = this.activeChecks.get(checkId);
            if (timers) {
                delete timers.reminderTimeout;
                if (!timers.dmTimeout) this.activeChecks.delete(checkId);
            }
        }
    }

    async _fireDmTimeout(check) {
        // Re-fetch to make sure the user hasn't already responded
        try {
            const current = await userDataManager.getWellnessCheck(check.check_id);
            if (!current || current.status === 'done' || current.user_responded) return;
            await this.handleAutoCheckTimeout(current);
        } catch (error) {
            console.error(`Error firing DM timeout for check ${check.check_id}:`, error);
        } finally {
            this.activeChecks.delete(check.check_id);
        }
    }

    // Send auto-DM check to user
    async sendAutoCheckDM(check) {
        try {
            const user = await this.client.users.fetch(check.user_id);

            const dmEmbed = new EmbedBuilder()
                .setColor('#FFB6C1')
                .setTitle('🐻 Wellness Check-In')
                .setDescription('Hi there! We just wanted to check in and see how you\'re doing. Click the button below to let us know you\'re okay!')
                .setFooter({ text: `Check ID: ${check.check_id}` })
                .setTimestamp();

            const okayButton = new ButtonBuilder()
                .setCustomId(`wellness_check_ok_${check.check_id}`)
                .setLabel('I\'m Okay ✨')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(okayButton);

            await user.send({ embeds: [dmEmbed], components: [row] });
        } catch (error) {
            console.error(`Error sending DM to user ${check.user_id}:`, error);
            await userDataManager.markDMsDisabled(check.check_id);
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

    // Handle timeout for auto-DM checks (24 hours passed without response)
    async handleAutoCheckTimeout(check) {
        try {
            await userDataManager.resolveWellnessCheck(check.check_id, 'system', 'timeout');

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
            const activeChecks = await userDataManager.getActiveWellnessChecks(userId);

            if (activeChecks.length === 0) return;

            const check = activeChecks[0];

            // Cancel any pending timeouts for this check
            this.cancelCheck(check.check_id);

            await userDataManager.updateWellnessCheckResponse(check.check_id, true, messageContent);
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
