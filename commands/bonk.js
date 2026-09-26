const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

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
        const targetUser = interaction.options.getUser('user');
        const isSelfTarget = targetUser.id === interaction.user.id;
        const content = isSelfTarget
            ? `${interaction.user} bonked themselves! 💥`
            : `${interaction.user} bonked ${targetUser}! 💥`;

        await sendGifReply(interaction, {
            category: 'bonk',
            content,
            statKeys: {
                giver: 'bonksGiven',
                receiver: 'bonksReceived',
                receiverId: isSelfTarget ? null : targetUser.id,
            },
        });
    },
};
