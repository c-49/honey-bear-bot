const { SlashCommandBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

const MOOD_CHANNEL_ID = '1424555152945451058';

// Predefined mood emojis
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mood')
        .setDescription('Share how you\'re feeling in your healing journey')
        .addStringOption(option =>
            option
                .setName('feeling')
                .setDescription('How are you doing today?')
                .setRequired(true)
                .addChoices(
                    { name: '😞 Struggling', value: 'struggling' },
                    { name: '😔 Difficult', value: 'difficult' },
                    { name: '😐 Managing', value: 'managing' },
                    { name: '🙂 Okay', value: 'okay' },
                    { name: '😊 Good', value: 'good' },
                    { name: '😄 Great', value: 'great' },
                    { name: '💚 Healing', value: 'healing' },
                    { name: '😌 Peaceful', value: 'peaceful' }
                )
        )
        .addStringOption(option =>
            option
                .setName('note')
                .setDescription('Optional: Add a note about how you\'re feeling (others can reach out)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const feeling = interaction.options.getString('feeling');
        const note = interaction.options.getString('note');
        const emoji = MOOD_EMOJIS[feeling];

        try {
            // Get the mood channel
            const channel = await interaction.client.channels.fetch(MOOD_CHANNEL_ID);

            if (!channel) {
                return interaction.reply({
                    content: 'The mood check-in channel is not available right now.',
                    ephemeral: true
                });
            }

            // Create the mood check-in message
            const timestamp = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let message = `${emoji} **${interaction.user}** is feeling **${feeling}** today (${timestamp})`;

            if (note) {
                message += `\n\n*"${note}"*`;
            }

            // Save to database
            await userDataManager.saveMoodEntry(interaction.user.id, feeling, note);

            // Post to the mood channel
            await channel.send(message);

            // Confirm to the user
            await interaction.reply({
                content: `Your mood has been shared in the check-in channel. ${emoji}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error posting mood check-in:', error);
            await interaction.reply({
                content: 'There was an error posting your mood check-in. Please try again later.',
                ephemeral: true
            });
        }
    },
};
