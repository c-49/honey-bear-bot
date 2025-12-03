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

        const gifPath = await getRandomGif('./gifs/hug');

        if (!gifPath) {
            return interaction.reply({
                content: 'No hug GIFs found! Please add some GIFs to the gifs/hug folder.',
                ephemeral: true
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} hugged themselves! 🤗`
                : `${interaction.user} hugged ${targetUser}! 🤗`;

            await interaction.reply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending hug GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} hugged themselves! 🤗 (GIF failed to load)`
                : `${interaction.user} hugged ${targetUser}! 🤗 (GIF failed to load)`;

            await interaction.reply({
                content: content,
            });
        }
    },
};