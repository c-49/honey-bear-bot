const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View gif stats for yourself or another user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to check stats for (defaults to you)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const stats = await userDataManager.getGifStats(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setTitle(`${targetUser.username}'s Gif Stats`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '🤗 Hugs',
                    value: `Received: **${stats.hugsReceived || 0}** | Given: **${stats.hugsGiven || 0}**`,
                    inline: true
                },
                {
                    name: '⬆️ Uppies',
                    value: `Received: **${stats.uppiesReceived || 0}** | Given: **${stats.uppiesGiven || 0}**`,
                    inline: true
                },
                {
                    name: '💥 Bonks',
                    value: `Received: **${stats.bonksReceived || 0}** | Given: **${stats.bonksGiven || 0}**`,
                    inline: true
                },
                {
                    name: '🐱 Bites',
                    value: `Received: **${stats.bitesReceived || 0}** | Given: **${stats.bitesGiven || 0}**`,
                    inline: true
                },
                {
                    name: '🐾 Pets',
                    value: `Received: **${stats.petsReceived || 0}** | Given: **${stats.petsGiven || 0}**`,
                    inline: true
                }
            )
            .setTimestamp();

        // Calculate totals
        const totalReceived = (stats.hugsReceived || 0) + (stats.uppiesReceived || 0) + 
                             (stats.bonksReceived || 0) + (stats.bitesReceived || 0) + (stats.petsReceived || 0);
        const totalGiven = (stats.hugsGiven || 0) + (stats.uppiesGiven || 0) + 
                          (stats.bonksGiven || 0) + (stats.bitesGiven || 0) + (stats.petsGiven || 0);

        embed.addFields(
            {
                name: '📊 Totals',
                value: `Received: **${totalReceived}** | Given: **${totalGiven}**`,
                inline: false
            }
        );

        await interaction.reply({ embeds: [embed] });
    },
};
