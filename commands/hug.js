const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Hug a user with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to hug')
                .setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot hug yourself! 🤔',
                ephemeral: true
            });
        }

        const gifPath = getRandomGif('./gifs/hug');

        if (!gifPath) {
            return interaction.reply({
                content: 'No hug GIFs found! Please add some GIFs to the gifs/hug folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);

            await interaction.reply({
                content: `${interaction.user} hugged ${targetUser}! 🤗`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending hug GIF:', error);

            await interaction.reply({
                content: `${interaction.user} hugged ${targetUser}! 🤗 (GIF failed to load)`,
            });
        }
    },
};