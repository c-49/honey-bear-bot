const { SlashCommandBuilder } = require('discord.js');
const { sendGifReply } = require('../utils/gifReply');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fart')
        .setDescription('Fart at a user or just fart with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to fart on (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const content = targetUser
            ? `${interaction.user} farted on ${targetUser}! 💨`
            : `${interaction.user} farted! 💨`;

        await sendGifReply(interaction, {
            category: 'fart',
            content,
            statKeys: {
                giver: 'fartsGiven',
                receiver: 'fartsReceived',
                receiverId: targetUser ? targetUser.id : null,
            },
        });
    },
};
