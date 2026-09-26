const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

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
        const targetUser = interaction.options.getUser('user');
        const isSelfTarget = targetUser.id === interaction.user.id;
        const content = isSelfTarget
            ? `${interaction.user} bit themselves! 🐱`
            : `${interaction.user} bit ${targetUser}! 🐱`;

        await sendGifReply(interaction, {
            category: 'bite',
            content,
            statKeys: {
                giver: 'bitesGiven',
                receiver: 'bitesReceived',
                receiverId: isSelfTarget ? null : targetUser.id,
            },
        });
    },
};
