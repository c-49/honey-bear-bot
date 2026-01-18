const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('View all server moderation rules'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const rules = await moderationManager.getAllRules();

            if (!rules || rules.length === 0) {
                return interaction.editReply({
                    content: '📋 No moderation rules have been created yet.'
                });
            }

            // Group rules by severity
            const rulesBySeverity = {
                red: [],
                yellow: [],
                green: []
            };

            rules.forEach(rule => {
                if (rulesBySeverity[rule.severity]) {
                    rulesBySeverity[rule.severity].push(rule);
                }
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📋 Server Moderation Rules')
                .setDescription('Please review and follow all server rules.')
                .setFooter({ text: 'Violations may result in warnings and moderation actions' });

            // Add red (major) rules
            if (rulesBySeverity.red.length > 0) {
                let redText = '';
                rulesBySeverity.red.forEach((rule, index) => {
                    redText += `**${index + 1}. ${rule.rule_name}**\n${rule.description}\n\n`;
                });
                embed.addFields({
                    name: '🔴 Major Violations',
                    value: redText,
                    inline: false
                });
            }

            // Add yellow (medium) rules
            if (rulesBySeverity.yellow.length > 0) {
                let yellowText = '';
                rulesBySeverity.yellow.forEach((rule, index) => {
                    yellowText += `**${index + 1}. ${rule.rule_name}**\n${rule.description}\n\n`;
                });
                embed.addFields({
                    name: '🟡 Medium Violations',
                    value: yellowText,
                    inline: false
                });
            }

            // Add green (minor) rules
            if (rulesBySeverity.green.length > 0) {
                let greenText = '';
                rulesBySeverity.green.forEach((rule, index) => {
                    greenText += `**${index + 1}. ${rule.rule_name}**\n${rule.description}\n\n`;
                });
                embed.addFields({
                    name: '🟢 Minor Violations',
                    value: greenText,
                    inline: false
                });
            }

            return interaction.editReply({
                embeds: [embed]
            });
        } catch (error) {
            console.error('Error in rules command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching the rules.'
            });
        }
    }
};
