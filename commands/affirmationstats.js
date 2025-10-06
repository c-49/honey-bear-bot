const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('affirmationstats')
        .setDescription('View your affirmation tracking statistics')
        .addStringOption(option =>
            option
                .setName('period')
                .setDescription('Time period to analyze')
                .setRequired(false)
                .addChoices(
                    { name: 'Last 7 days', value: '7' },
                    { name: 'Last 30 days', value: '30' },
                    { name: 'All time', value: 'all' }
                )
        ),

    async execute(interaction) {
        const period = interaction.options.getString('period') || '30';

        try {
            // Get user's affirmation history
            const limit = period === 'all' ? 365 : parseInt(period);
            const affirmations = await userDataManager.getUserAffirmations(interaction.user.id, limit);

            if (affirmations.length === 0) {
                return interaction.reply({
                    content: 'You haven\'t shared any affirmations yet! Use `/affirmation` to start sharing positive thoughts.',
                    ephemeral: true
                });
            }

            // Calculate statistics
            const totalAffirmations = affirmations.length;

            // Get streak (consecutive days with affirmations)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let streak = 0;
            let currentDate = new Date(today);

            for (const entry of affirmations) {
                const entryDate = new Date(entry.timestamp);
                entryDate.setHours(0, 0, 0, 0);

                if (entryDate.getTime() === currentDate.getTime()) {
                    streak++;
                    currentDate.setDate(currentDate.getDate() - 1);
                } else if (entryDate.getTime() < currentDate.getTime()) {
                    break;
                }
            }

            // Get most recent affirmation
            const mostRecent = affirmations[0];
            const recentDate = new Date(mostRecent.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            // Show last few affirmations
            const recentAffirmations = affirmations.slice(0, 3).map((aff, index) => {
                const date = new Date(aff.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
                const preview = aff.affirmation.length > 100
                    ? aff.affirmation.substring(0, 100) + '...'
                    : aff.affirmation;
                return `**${date}**: *"${preview}"*`;
            }).join('\n\n');

            const periodText = period === 'all' ? 'All Time' : `Last ${period} Days`;

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`✨ Your Affirmation Statistics - ${periodText}`)
                .setDescription(`Here's your journey of positive affirmations:`)
                .addFields(
                    {
                        name: '📊 Total Affirmations',
                        value: totalAffirmations.toString(),
                        inline: true
                    },
                    {
                        name: '🔥 Current Streak',
                        value: `${streak} day${streak !== 1 ? 's' : ''}`,
                        inline: true
                    },
                    {
                        name: '📅 Most Recent',
                        value: recentDate,
                        inline: true
                    },
                    {
                        name: '💭 Recent Affirmations',
                        value: recentAffirmations || 'None yet',
                        inline: false
                    }
                )
                .setFooter({ text: 'Keep sharing positive affirmations! Use /affirmation to add more.' })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error fetching affirmation stats:', error);
            await interaction.reply({
                content: 'There was an error fetching your affirmation statistics. Please try again later.',
                ephemeral: true
            });
        }
    },
};
