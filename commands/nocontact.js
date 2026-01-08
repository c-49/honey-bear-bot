const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const userDataManager = require('../utils/userDataManager');

const MILESTONE_CHANNEL_ID = '1420968791470506125';
const TIMEZONE = 'America/New_York';

const MILESTONES = [
    { days: 1, emoji: '🎉', name: '1 full day', message: 'has completed **1 full day** of no-contact! First milestone reached!' },
    { days: 7, emoji: '🌟', name: '1 week', message: 'has completed **1 week** of no-contact! A full week strong!' },
    { days: 30, emoji: '🏆', name: '1 month', message: 'has completed **1 month** of no-contact! Incredible dedication!' },
    { days: 90, emoji: '💎', name: '3 months', message: 'has completed **3 months** of no-contact! Diamond strength!' },
    { days: 180, emoji: '🔥', name: '6 months', message: 'has completed **6 months** of no-contact! Half a year of growth!' },
    { days: 365, emoji: '👑', name: '1 full year', message: 'has completed **1 FULL YEAR** of no-contact! Absolute legend!' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nocontact')
        .setDescription('Track your no-contact streak')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your no-contact start date')
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
        const yearMenu = new StringSelectMenuBuilder()
            .setCustomId(`nocontact_year_${userId}`)
            .setPlaceholder('Select a year')
            .addOptions(this.getYearOptions());

        const row = new ActionRowBuilder().addComponents(yearMenu);

        await interaction.reply({
            content: '📅 **Select your start date**\n\n**Step 1:** Choose a year',
            components: [row],
            ephemeral: false
        });
    },

    getYearOptions() {
        const currentYear = new Date().getFullYear();
        const options = [];
        
        for (let year = currentYear; year >= currentYear - 5; year--) {
            options.push({
                label: year.toString(),
                value: year.toString()
            });
        }
        
        return options;
    },

    getMonthOptions() {
        const options = [];
        for (let month = 1; month <= 12; month++) {
            const monthName = DateTime.fromObject({ month }, { zone: TIMEZONE }).toFormat('MMMM');
            options.push({
                label: monthName,
                value: month.toString()
            });
        }
        return options;
    },

    getDayOptions(year, month) {
        const options = [];
        const daysInMonth = DateTime.fromObject({ year, month }, { zone: TIMEZONE }).daysInMonth;
        
        for (let day = 1; day <= daysInMonth; day++) {
            options.push({
                label: day.toString(),
                value: day.toString()
            });
        }
        
        return options;
    },

    parseCustomId(customId) {
        // Extract year, month, day from custom IDs like "nocontact_month_123456_2025"
        const parts = customId.split('_');
        return {
            type: parts[1], // 'year', 'month', or 'day'
            year: parts[3] ? parseInt(parts[3]) : null,
            month: parts[4] ? parseInt(parts[4]) : null
        };
    },

    async handleSelectMenu(interaction) {
        const customId = interaction.customId;
        const userId = interaction.user.id;
        const selectedValue = interaction.values[0];
        const parsed = this.parseCustomId(customId);

        if (parsed.type === 'year') {
            const year = parseInt(selectedValue);
            const monthMenu = new StringSelectMenuBuilder()
                .setCustomId(`nocontact_month_${userId}_${year}`)
                .setPlaceholder('Select a month')
                .addOptions(this.getMonthOptions());

            const row = new ActionRowBuilder().addComponents(monthMenu);

            await interaction.update({
                content: `📅 **Select your start date**\n\n**Step 1:** Year - ${year} ✓\n**Step 2:** Choose a month`,
                components: [row]
            });

        } else if (parsed.type === 'month') {
            const year = parsed.year;
            const month = parseInt(selectedValue);
            const monthName = DateTime.fromObject({ month }, { zone: TIMEZONE }).toFormat('MMMM');
            
            const dayMenu = new StringSelectMenuBuilder()
                .setCustomId(`nocontact_day_${userId}_${year}_${month}`)
                .setPlaceholder('Select a day')
                .addOptions(this.getDayOptions(year, month));

            const row = new ActionRowBuilder().addComponents(dayMenu);

            await interaction.update({
                content: `📅 **Select your start date**\n\n**Step 1:** Year - ${year} ✓\n**Step 2:** Month - ${monthName} ✓\n**Step 3:** Choose a day`,
                components: [row]
            });

        } else if (parsed.type === 'day') {
            const year = parsed.year;
            const month = parsed.month;
            const day = parseInt(selectedValue);

            const startDate = DateTime.fromObject({ year, month, day }, { zone: TIMEZONE });

            if (!startDate.isValid) {
                return await interaction.update({
                    content: '❌ Invalid date! Please try again.',
                    components: []
                });
            }

            await userDataManager.setUserProperty(userId, 'noContactStartDate', startDate.toISODate());

            const formattedDate = startDate.toFormat('MMMM dd, yyyy');
            await interaction.update({
                content: `✅ No-contact start date set to **${formattedDate}**!`,
                components: []
            });
        }
    },

    async handleCheck(interaction, userId) {
        const startDateString = await userDataManager.getUserProperty(userId, 'noContactStartDate');

        if (!startDateString) {
            return interaction.reply({
                content: 'You haven\'t set a no-contact start date yet! Use `/nocontact set` first.',
                ephemeral: false
            });
        }

        const startDate = DateTime.fromISO(startDateString, { zone: TIMEZONE });
        const currentDate = DateTime.now().setZone(TIMEZONE);
        const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

        let message;

        if (daysDiff < 0) {
            message = '⚠️ Your start date is in the future! Please set a valid start date with `/nocontact set`.';
        } else if (daysDiff === 0) {
            message = '🌟 You started your no-contact journey today! Stay strong!';
        } else if (daysDiff === 1) {
            message = '💪 It\'s been **1 day** since you started no-contact! Keep going!';
        } else {
            const milestone = MILESTONES.find(m => m.days === daysDiff);
            if (milestone) {
                const announcedMilestones = await userDataManager.getUserProperty(userId, 'announcedMilestones') || [];
                if (announcedMilestones.includes(daysDiff)) {
                    message = `${milestone.emoji} You've completed **${milestone.name}** of no-contact! (Milestone celebrated)`;
                } else {
                    message = `${milestone.emoji} **MILESTONE REACHED!** You've completed **${milestone.name}** of no-contact! 🎉\n\n*Your achievement will be automatically announced soon!*`;
                }
            } else {
                message = `🔥 It's been **${daysDiff} days** since you started no-contact! You're doing amazing!`;
            }
        }

        await interaction.reply({
            content: message,
            ephemeral: false
        });
    },

    async handleReset(interaction, userId) {
        const startDateDeleted = await userDataManager.deleteUserProperty(userId, 'noContactStartDate');
        const milestonesDeleted = await userDataManager.deleteUserProperty(userId, 'announcedMilestones');

        if (startDateDeleted) {
            await interaction.reply({
                content: '🗑️ Your no-contact record has been reset. You can start fresh with `/nocontact set`!\n\n*All milestone celebrations will be available again when you reach them.*',
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: 'You don\'t have a no-contact record to reset.',
                ephemeral: false
            });
        }
    }
};