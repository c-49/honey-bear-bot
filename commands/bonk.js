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

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot bonk yourself! 🤔',
                ephemeral: true
            });
        }

        const gifPath = getRandomGif();

        if (!gifPath) {
            return interaction.reply({
                content: 'No bonk GIFs found! Please add some GIFs to the gifs folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);

            await interaction.reply({
                content: `${interaction.user} bonked ${targetUser}! 💥`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending bonk GIF:', error);

            await interaction.reply({
                content: `${interaction.user} bonked ${targetUser}! 💥 (GIF failed to load)`,
            });
        }
    },
};