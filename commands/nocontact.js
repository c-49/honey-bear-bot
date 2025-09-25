const { SlashCommandBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const userDataManager = require('../utils/userDataManager');

const MILESTONE_CHANNEL_ID = '1420968791470506125';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nocontact')
        .setDescription('Track your no-contact streak')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your no-contact start date')
                .addStringOption(option =>
                    option
                        .setName('date')
                        .setDescription('Start date in MM-DD-YYYY format (optional, defaults to today)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check how many days since you started no-contact')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset your no-contact record')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        switch (subcommand) {
            case 'set':
                await this.handleSet(interaction, userId);
                break;
            case 'check':
                await this.handleCheck(interaction, userId);
                break;
            case 'reset':
                await this.handleReset(interaction, userId);
                break;
        }
    },

    async handleSet(interaction, userId) {
        const dateInput = interaction.options.getString('date');
        let startDate;

        if (dateInput) {
            // Parse MM-DD-YYYY format
            const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
            const match = dateInput.match(dateRegex);

            if (!match) {
                return interaction.reply({
                    content: 'Invalid date format! Please use MM-DD-YYYY format.',
                    ephemeral: true
                });
            }

            const [, month, day, year] = match;
            startDate = DateTime.fromObject({
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day)
            }, { zone: 'America/New_York' });

            if (!startDate.isValid) {
                return interaction.reply({
                    content: 'Invalid date! Please check your date and try again.',
                    ephemeral: true
                });
            }
        } else {
            // Use today's date in New York timezone
            startDate = DateTime.now().setZone('America/New_York');
        }

        // Store the date as ISO string
        userDataManager.setUserProperty(userId, 'noContactStartDate', startDate.toISODate());

        const formattedDate = startDate.toFormat('MMMM dd, yyyy');
        await interaction.reply({
            content: `✅ No-contact start date set to **${formattedDate}**!`,
            ephemeral: true
        });
    },

    async handleCheck(interaction, userId) {
        const startDateString = userDataManager.getUserProperty(userId, 'noContactStartDate');

        if (!startDateString) {
            return interaction.reply({
                content: 'You haven\'t set a no-contact start date yet! Use `/nocontact set` first.',
                ephemeral: true
            });
        }

        const startDate = DateTime.fromISO(startDateString, { zone: 'America/New_York' });
        const currentDate = DateTime.now().setZone('America/New_York');

        const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

        let message;
        let isMilestone = false;

        if (daysDiff < 0) {
            message = '⚠️ Your start date is in the future! Please set a valid start date with `/nocontact set`.';
        } else if (daysDiff === 0) {
            message = '🌟 You started your no-contact journey today! Stay strong!';
        } else {
            // Check for milestones
            const milestone = this.getMilestone(daysDiff);
            if (milestone) {
                const announcedMilestones = userDataManager.getUserProperty(userId, 'announcedMilestones') || [];

                if (announcedMilestones.includes(daysDiff)) {
                    message = `${milestone.emoji} You've completed **${this.getMilestoneName(daysDiff)}** of no-contact! (Milestone celebrated)`;
                } else {
                    message = `${milestone.emoji} **MILESTONE REACHED!** You've completed **${this.getMilestoneName(daysDiff)}** of no-contact! 🎉\n\n*Your achievement will be automatically announced soon!*`;
                }
                isMilestone = true;
            } else if (daysDiff === 1) {
                message = '💪 It\'s been **1 day** since you started no-contact! Keep going!';
            } else {
                message = `🔥 It's been **${daysDiff} days** since you started no-contact! You're doing amazing!`;
            }
        }

        await interaction.reply({
            content: message,
            ephemeral: true // All replies are now private, announcements go to channel
        });
    },

    getMilestone(days) {
        const milestones = [
            { days: 1, emoji: '🎉', message: 'has completed **1 full day** of no-contact! First milestone reached!' },
            { days: 7, emoji: '🌟', message: 'has completed **1 week** of no-contact! A full week strong!' },
            { days: 30, emoji: '🏆', message: 'has completed **1 month** of no-contact! Incredible dedication!' },
            { days: 90, emoji: '💎', message: 'has completed **3 months** of no-contact! Diamond strength!' },
            { days: 180, emoji: '🔥', message: 'has completed **6 months** of no-contact! Half a year of growth!' },
            { days: 365, emoji: '👑', message: 'has completed **1 FULL YEAR** of no-contact! Absolute legend!' }
        ];

        return milestones.find(milestone => milestone.days === days);
    },

    getMilestoneName(days) {
        const names = {
            1: '1 full day',
            7: '1 week',
            30: '1 month',
            90: '3 months',
            180: '6 months',
            365: '1 full year'
        };
        return names[days] || `${days} days`;
    },


    async handleReset(interaction, userId) {
        const startDateDeleted = userDataManager.deleteUserProperty(userId, 'noContactStartDate');
        const milestonesDeleted = userDataManager.deleteUserProperty(userId, 'announcedMilestones');

        if (startDateDeleted) {
            await interaction.reply({
                content: '🗑️ Your no-contact record has been reset. You can start fresh with `/nocontact set`!\n\n*All milestone celebrations will be available again when you reach them.*',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'You don\'t have a no-contact record to reset.',
                ephemeral: true
            });
        }
    }
};