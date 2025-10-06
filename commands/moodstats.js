const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

const MOOD_EMOJIS = {
    'struggling': '😞',
    'difficult': '😔',
    'managing': '😐',
    'okay': '🙂',
    'good': '😊',
    'great': '😄',
    'healing': '💚',
    'peaceful': '😌'
};

// Mood values for trend calculation (1-8 scale)
const MOOD_VALUES = {
    'struggling': 1,
    'difficult': 2,
    'managing': 3,
    'okay': 4,
    'good': 5,
    'great': 6,
    'healing': 7,
    'peaceful': 8
};

function createTextChart(moodCounts, total) {
    const maxCount = Math.max(...Object.values(moodCounts));
    const barLength = 20;

    let chart = '';
    for (const [mood, count] of Object.entries(moodCounts)) {
        if (count === 0) continue;

        const percentage = ((count / total) * 100).toFixed(1);
        const bars = Math.round((count / maxCount) * barLength);
        const bar = '█'.repeat(bars) + '░'.repeat(barLength - bars);

        chart += `${MOOD_EMOJIS[mood]} **${mood}**: ${bar} ${count} (${percentage}%)\n`;
    }

    return chart;
}

function calculateTrend(moodHistory) {
    if (moodHistory.length < 2) return 'Not enough data';

    // Get last 7 entries
    const recent = moodHistory.slice(0, 7);
    const recentAvg = recent.reduce((sum, entry) => sum + MOOD_VALUES[entry.feeling], 0) / recent.length;

    // Get previous 7 entries if available
    const previous = moodHistory.slice(7, 14);
    if (previous.length === 0) return 'Tracking...';

    const previousAvg = previous.reduce((sum, entry) => sum + MOOD_VALUES[entry.feeling], 0) / previous.length;

    const diff = recentAvg - previousAvg;

    if (diff > 0.5) return '📈 Improving';
    if (diff < -0.5) return '📉 Declining';
    return '➡️ Stable';
}

function getStreakInfo(moodHistory) {
    if (moodHistory.length === 0) return 'No entries yet';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    for (const entry of moodHistory) {
        const entryDate = new Date(entry.timestamp);
        entryDate.setHours(0, 0, 0, 0);

        if (entryDate.getTime() === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (entryDate.getTime() < currentDate.getTime()) {
            break;
        }
    }

    return `${streak} day${streak !== 1 ? 's' : ''} 🔥`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moodstats')
        .setDescription('View your mood tracking statistics')
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
            // Get user's mood history
            const limit = period === 'all' ? 365 : parseInt(period);
            const moodHistory = await userDataManager.getUserMoodHistory(interaction.user.id, limit);

            if (moodHistory.length === 0) {
                return interaction.reply({
                    content: 'You haven\'t logged any moods yet! Use `/mood` to start tracking your journey.',
                    ephemeral: true
                });
            }

            // Calculate statistics
            const moodCounts = {
                'struggling': 0,
                'difficult': 0,
                'managing': 0,
                'okay': 0,
                'good': 0,
                'great': 0,
                'healing': 0,
                'peaceful': 0
            };

            moodHistory.forEach(entry => {
                moodCounts[entry.feeling]++;
            });

            const totalEntries = moodHistory.length;
            const averageMood = moodHistory.reduce((sum, entry) =>
                sum + MOOD_VALUES[entry.feeling], 0) / totalEntries;

            // Find most common mood
            let mostCommon = 'N/A';
            let maxCount = 0;
            for (const [mood, count] of Object.entries(moodCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommon = mood;
                }
            }

            // Create the chart
            const chart = createTextChart(moodCounts, totalEntries);

            // Calculate trend
            const trend = calculateTrend(moodHistory);

            // Get streak
            const streak = getStreakInfo(moodHistory);

            // Get average mood label
            const avgMoodLabel = Object.entries(MOOD_VALUES)
                .reduce((prev, curr) =>
                    Math.abs(curr[1] - averageMood) < Math.abs(prev[1] - averageMood) ? curr : prev
                )[0];

            const periodText = period === 'all' ? 'All Time' : `Last ${period} Days`;

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`${MOOD_EMOJIS[mostCommon]} Your Mood Statistics - ${periodText}`)
                .setDescription(`Here's how you've been feeling on your healing journey:`)
                .addFields(
                    {
                        name: '📊 Mood Distribution',
                        value: chart || 'No data',
                        inline: false
                    },
                    {
                        name: '📈 Trend',
                        value: trend,
                        inline: true
                    },
                    {
                        name: '🔥 Check-in Streak',
                        value: streak,
                        inline: true
                    },
                    {
                        name: '📝 Total Check-ins',
                        value: totalEntries.toString(),
                        inline: true
                    },
                    {
                        name: '⭐ Most Common',
                        value: `${MOOD_EMOJIS[mostCommon]} ${mostCommon}`,
                        inline: true
                    },
                    {
                        name: '📊 Average Mood',
                        value: `${MOOD_EMOJIS[avgMoodLabel]} ${avgMoodLabel}`,
                        inline: true
                    }
                )
                .setFooter({ text: 'Keep tracking your journey! Use /mood to log today\'s mood.' })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error fetching mood stats:', error);
            await interaction.reply({
                content: 'There was an error fetching your mood statistics. Please try again later.',
                ephemeral: true
            });
        }
    },
};
