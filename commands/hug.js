const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

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
        const isSelfTarget = targetUser.id === interaction.user.id;
        const content = isSelfTarget
            ? `${interaction.user} hugged themselves! 🤗`
            : `${interaction.user} hugged ${targetUser}! 🤗`;

        await sendGifReply(interaction, {
            category: 'hug',
            content,
            statKeys: {
                giver: 'hugsGiven',
                receiver: 'hugsReceived',
                receiverId: isSelfTarget ? null : targetUser.id,
            },
        });
    },
};
