const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { DateTime } = require('luxon');
const userDataManager = require('../utils/userDataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admindata')
        .setDescription('View user data from the database (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with no-contact data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View specific user\'s data')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to check')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show database statistics')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Double-check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You need Administrator permissions to use this command.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'list':
                await this.handleList(interaction);
                break;
            case 'user':
                await this.handleUser(interaction);
                break;
            case 'stats':
                await this.handleStats(interaction);
                break;
        }
    },

    async handleList(interaction) {
        try {
            const allUsers = await userDataManager.getAllUsers();
            const noContactUsers = [];

            for (const [userId, userData] of Object.entries(allUsers)) {
                if (userData.noContactStartDate) {
                    try {
                        const user = await interaction.client.users.fetch(userId).catch(() => null);
                        const username = user ? user.tag : `Unknown User (${userId})`;

                        const startDate = DateTime.fromISO(userData.noContactStartDate, { zone: 'America/New_York' });
                        const currentDate = DateTime.now().setZone('America/New_York');
                        const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

                        const announcedMilestones = userData.announcedMilestones || [];

                        noContactUsers.push({
                            username,
                            userId,
                            days: daysDiff,
                            startDate: startDate.toFormat('MMM dd, yyyy'),
                            milestones: announcedMilestones.length
                        });
                    } catch (error) {
                        console.error(`Error processing user ${userId}:`, error);
                    }
                }
            }

            if (noContactUsers.length === 0) {
                return interaction.reply({
                    content: '📊 **Admin Data - User List**\n\nNo users have set no-contact start dates yet.',
                    ephemeral: true
                });
            }

            // Sort by days (highest first)
            noContactUsers.sort((a, b) => b.days - a.days);

            let message = '📊 **Admin Data - No-Contact Users**\n\n';

            noContactUsers.forEach((userData, index) => {
                const rank = index + 1;
                const emoji = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📍';

                message += `${emoji} **${userData.username}**\n`;
                message += `   └ ${userData.days} days (since ${userData.startDate})\n`;
                message += `   └ ${userData.milestones} milestones celebrated\n\n`;
            });

            // Split message if too long
            if (message.length > 2000) {
                message = message.substring(0, 1900) + '\n\n... (truncated)';
            }

            await interaction.reply({
                content: message,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in admindata list:', error);
            await interaction.reply({
                content: '❌ Error retrieving user data from database.',
                ephemeral: true
            });
        }
    },

    async handleUser(interaction) {
        try {
            const targetUser = interaction.options.getUser('target');
            const userData = await userDataManager.getUserData(targetUser.id);

            if (!userData.noContactStartDate) {
                return interaction.reply({
                    content: `📊 **Admin Data - ${targetUser.tag}**\n\n❌ This user has not set a no-contact start date.`,
                    ephemeral: true
                });
            }

            const startDate = DateTime.fromISO(userData.noContactStartDate, { zone: 'America/New_York' });
            const currentDate = DateTime.now().setZone('America/New_York');
            const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

            const announcedMilestones = userData.announcedMilestones || [];

            let message = `📊 **Admin Data - ${targetUser.tag}**\n\n`;
            message += `🗓️ **Start Date:** ${startDate.toFormat('MMMM dd, yyyy')}\n`;
            message += `📅 **Days Since:** ${daysDiff} days\n`;
            message += `🎉 **Milestones Celebrated:** ${announcedMilestones.length}\n`;

            if (announcedMilestones.length > 0) {
                message += `🏆 **Milestone Days:** ${announcedMilestones.join(', ')}\n`;
            }

            message += `🆔 **User ID:** \`${targetUser.id}\`\n`;
            message += `📄 **Raw Data:** \`${JSON.stringify(userData, null, 2)}\``;

            await interaction.reply({
                content: message,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in admindata user:', error);
            await interaction.reply({
                content: '❌ Error retrieving user data from database.',
                ephemeral: true
            });
        }
    },

    async handleStats(interaction) {
        try {
            const allUsers = await userDataManager.getAllUsers();
            const totalUsers = Object.keys(allUsers).length;

            let noContactUsers = 0;
            let totalDays = 0;
            let totalMilestones = 0;
            let longestStreak = 0;
            let longestStreakUser = null;

            for (const [userId, userData] of Object.entries(allUsers)) {
                if (userData.noContactStartDate) {
                    noContactUsers++;

                    const startDate = DateTime.fromISO(userData.noContactStartDate, { zone: 'America/New_York' });
                    const currentDate = DateTime.now().setZone('America/New_York');
                    const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

                    totalDays += daysDiff;

                    const milestones = userData.announcedMilestones || [];
                    totalMilestones += milestones.length;

                    if (daysDiff > longestStreak) {
                        longestStreak = daysDiff;
                        try {
                            const user = await interaction.client.users.fetch(userId).catch(() => null);
                            longestStreakUser = user ? user.tag : `Unknown User (${userId})`;
                        } catch (error) {
                            longestStreakUser = `Unknown User (${userId})`;
                        }
                    }
                }
            }

            const averageDays = noContactUsers > 0 ? Math.round(totalDays / noContactUsers) : 0;

            let message = '📊 **Admin Data - Database Statistics**\n\n';
            message += `👥 **Total Users in Database:** ${totalUsers}\n`;
            message += `🎯 **Users with No-Contact Data:** ${noContactUsers}\n`;
            message += `📈 **Total Combined Days:** ${totalDays}\n`;
            message += `📊 **Average Days per User:** ${averageDays}\n`;
            message += `🏆 **Total Milestones Celebrated:** ${totalMilestones}\n`;
            message += `🥇 **Longest Streak:** ${longestStreak} days`;

            if (longestStreakUser) {
                message += ` (${longestStreakUser})`;
            }

            await interaction.reply({
                content: message,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in admindata stats:', error);
            await interaction.reply({
                content: '❌ Error retrieving database statistics.',
                ephemeral: true
            });
        }
    }
};