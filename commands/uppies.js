const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

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
        const targetUser = interaction.options.getUser('user');
        const isSelfTarget = targetUser.id === interaction.user.id;
        const content = isSelfTarget
            ? `${interaction.user} gave themselves uppies! ⬆️`
            : `${interaction.user} gave ${targetUser} uppies! ⬆️`;

        await sendGifReply(interaction, {
            category: 'uppies',
            content,
            statKeys: {
                giver: 'uppiesGiven',
                receiver: 'uppiesReceived',
                receiverId: isSelfTarget ? null : targetUser.id,
            },
        });
    },
};
