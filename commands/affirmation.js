const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

const AFFIRMATION_CHANNEL_ID = '1424588560622682312';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('affirmation')
        .setDescription('Share a positive affirmation on your healing journey')
        .addStringOption(option =>
            option
                .setName('affirmation')
                .setDescription('Your affirmation or positive thought')
                .setRequired(true)
                .setMaxLength(500)
        ),

    async execute(interaction) {
        // Defer reply to prevent duplicate executions
        await interaction.deferReply({ ephemeral: true });

        console.log(`Affirmation command executed by ${interaction.user.tag} - Interaction ID: ${interaction.id}`);

        const affirmation = interaction.options.getString('affirmation');

        try {
            // Get the affirmation channel
            const channel = await interaction.client.channels.fetch(AFFIRMATION_CHANNEL_ID);

            if (!channel) {
                return interaction.editReply({
                    content: 'The affirmation channel is not available right now.'
                });
            }

            // Create the affirmation message
            const timestamp = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const message = `✨ **${interaction.user}** shares an affirmation (${timestamp})\n\n*"${affirmation}"*`;

            // Save to database
            await userDataManager.saveAffirmation(interaction.user.id, affirmation);

            // Create button for replies
            const replyButton = new ButtonBuilder()
                .setCustomId(`affirmation_reply_${interaction.user.id}`)
                .setLabel('💬 Support')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(replyButton);

            console.log(`Sending affirmation message to channel for ${interaction.user.tag}`);

            // Post to the channel with button
            const affirmationMessage = await channel.send({
                content: message,
                components: [row]
            });

            // Add reaction emoji
            await affirmationMessage.react('✨');

            console.log(`Affirmation message sent successfully for ${interaction.user.tag}`);

            // Confirm to the user
            await interaction.editReply({
                content: `Your affirmation has been shared! ✨`
            });

        } catch (error) {
            console.error('Error posting affirmation:', error);
            await interaction.editReply({
                content: 'There was an error posting your affirmation. Please try again later.'
            });
        }
    },
};
