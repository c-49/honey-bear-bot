const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Pet a user with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to pet')
                .setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot pet yourself! 🤔',
                ephemeral: true
            });
        }

        const gifPath = getRandomGif('./gifs/pet');

        if (!gifPath) {
            return interaction.reply({
                content: 'No pet GIFs found! Please add some GIFs to the gifs/pet folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);

            await interaction.reply({
                content: `${interaction.user} petted ${targetUser}! 🐾`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending pet GIF:', error);

            await interaction.reply({
                content: `${interaction.user} petted ${targetUser}! 🐾 (GIF failed to load)`,
            });
        }
    },
};