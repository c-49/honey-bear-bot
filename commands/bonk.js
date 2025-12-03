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
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = await getRandomGif('./gifs/bonk');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No bonk GIFs found! Please add some GIFs to the gifs folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bonked themselves! 💥`
                : `${interaction.user} bonked ${targetUser}! 💥`;

            await interaction.editReply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending bonk GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} bonked themselves! 💥 (GIF failed to load)`
                : `${interaction.user} bonked ${targetUser}! 💥 (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};