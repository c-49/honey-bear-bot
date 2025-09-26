const { SlashCommandBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const userDataManager = require('../utils/userDataManager');

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
        if (daysDiff < 0) {
            message = '⚠️ Your start date is in the future! Please set a valid start date with `/nocontact set`.';
        } else if (daysDiff === 0) {
            message = '🌟 You started your no-contact journey today! Stay strong!';
        } else if (daysDiff === 1) {
            message = '💪 It\'s been **1 day** since you started no-contact! Keep going!';
        } else {
            message = `🔥 It's been **${daysDiff} days** since you started no-contact! You're doing amazing!`;
        }

        await interaction.reply({
            content: message,
            ephemeral: true
        });
    },

    async handleReset(interaction, userId) {
        const deleted = userDataManager.deleteUserProperty(userId, 'noContactStartDate');

        if (deleted) {
            await interaction.reply({
                content: '🗑️ Your no-contact record has been reset. You can start fresh with `/nocontact set`!',
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