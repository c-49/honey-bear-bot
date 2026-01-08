const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');
const UserDataManager = require('../utils/userDataManager');

const userDataManager = new UserDataManager();

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
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/pet');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No pet GIFs found! Please add some GIFs to the gifs/pet folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} petted themselves! 🐾`
                : `${interaction.user} petted ${targetUser}! 🐾`;

            // Track stats
            await userDataManager.incrementGifStat(interaction.user.id, 'petsGiven');
            if (!isSelfTarget) {
                await userDataManager.incrementGifStat(targetUser.id, 'petsReceived');
            }

            await interaction.editReply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending pet GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} petted themselves! 🐾 (GIF failed to load)`
                : `${interaction.user} petted ${targetUser}! 🐾 (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};