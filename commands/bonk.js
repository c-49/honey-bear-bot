const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bonk')
        .setDescription('Bonk a user with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to bonk')
                .setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/bonk');

        if (!gifPath) {
            return interaction.reply({
                content: 'No bonk GIFs found! Please add some GIFs to the gifs folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bonked themselves! 💥`
                : `${interaction.user} bonked ${targetUser}! 💥`;

            await interaction.reply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending bonk GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bonked themselves! 💥 (GIF failed to load)`
                : `${interaction.user} bonked ${targetUser}! 💥 (GIF failed to load)`;

            await interaction.reply({
                content: content,
            });
        }
    },
};