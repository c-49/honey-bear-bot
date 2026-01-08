const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bite')
        .setDescription('Bite a user with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to bite')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/bite');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No bite GIFs found! Please add some GIFs to the gifs/bite folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bit themselves! 🐱`
                : `${interaction.user} bit ${targetUser}! 🐱`;

            await interaction.editReply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending bite GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bit themselves! 🐱 (GIF failed to load)`
                : `${interaction.user} bit ${targetUser}! 🐱 (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};
