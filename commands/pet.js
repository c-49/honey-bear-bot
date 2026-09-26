const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

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
        const isSelfTarget = targetUser.id === interaction.user.id;
        const content = isSelfTarget
            ? `${interaction.user} petted themselves! 🐾`
            : `${interaction.user} petted ${targetUser}! 🐾`;

        await sendGifReply(interaction, {
            category: 'pet',
            content,
            statKeys: {
                giver: 'petsGiven',
                receiver: 'petsReceived',
                receiverId: isSelfTarget ? null : targetUser.id,
            },
        });
    },
};
