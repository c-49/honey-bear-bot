const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');
const UserDataManager = require('../utils/userDataManager');

const userDataManager = new UserDataManager();

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
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/hug');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No hug GIFs found! Please add some GIFs to the gifs/hug folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} hugged themselves! 🤗`
                : `${interaction.user} hugged ${targetUser}! 🤗`;

            // Track stats
            await userDataManager.incrementGifStat(interaction.user.id, 'hugsGiven');
            if (!isSelfTarget) {
                await userDataManager.incrementGifStat(targetUser.id, 'hugsReceived');
            }

            await interaction.editReply({
                content: content,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error sending hug GIF:', error);
            const isSelfTarget = targetUser.id === interaction.user.id;
            const content = isSelfTarget
                ? `${interaction.user} hugged themselves! 🤗 (GIF failed to load)`
                : `${interaction.user} hugged ${targetUser}! 🤗 (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};