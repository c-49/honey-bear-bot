const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uppies')
        .setDescription('Give a user uppies with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give uppies')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/uppies');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No uppies GIFs found! Please add some GIFs to the gifs/uppies folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} gave themselves uppies! ⬆️`
                : `${interaction.user} gave ${targetUser} uppies! ⬆️`;

            await interaction.editReply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending uppies GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} gave themselves uppies! ⬆️ (GIF failed to load)`
                : `${interaction.user} gave ${targetUser} uppies! ⬆️ (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};
