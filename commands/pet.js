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

        const gifPath = getRandomGif('./gifs/pet');

        if (!gifPath) {
            return interaction.reply({
                content: 'No pet GIFs found! Please add some GIFs to the gifs/pet folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} petted themselves! 🐾`
                : `${interaction.user} petted ${targetUser}! 🐾`;

            await interaction.reply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending pet GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} petted themselves! 🐾 (GIF failed to load)`
                : `${interaction.user} petted ${targetUser}! 🐾 (GIF failed to load)`;

            await interaction.reply({
                content: content,
            });
        }
    },
};