const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrule')
        .setDescription('Add a new moderation rule (Admin only)')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Rule name (unique identifier)')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Rule description')
                .setRequired(true)
                .setMaxLength(500)
        )
        .addStringOption(option =>
            option
                .setName('severity')
                .setDescription('Rule severity level')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Green (Minor)', value: 'green' },
                    { name: '🟡 Yellow (Medium)', value: 'yellow' },
                    { name: '🔴 Red (Major)', value: 'red' }
                )
        ),

    async execute(interaction) {
        try {
            // Check if user has the admin role
            const adminRoleId = '1368995164470902967';
            const hasAdminRole = interaction.member.roles.cache.has(adminRoleId);

            if (!hasAdminRole) {
                return interaction.reply({
                    content: '❌ You need the admin role to use this command.',
                    ephemeral: true
                });
            }

            const ruleName = interaction.options.getString('name');
            const description = interaction.options.getString('description');
            const severity = interaction.options.getString('severity');

            // Add the rule
            const rule = await moderationManager.addRule(
                ruleName,
                description,
                severity,
                interaction.user.id
            );

            // Create embed for confirmation
            const emoji = severity === 'red' ? '🔴' : severity === 'yellow' ? '🟡' : '🟢';
            const embed = new EmbedBuilder()
                .setColor(
                    severity === 'red' ? 0xff0000 :
                    severity === 'yellow' ? 0xffff00 :
                    0x00ff00
                )
                .setTitle('✅ Rule Added Successfully')
                .setDescription(`${emoji} **${ruleName}**`)
                .addFields(
                    { name: 'Description', value: description, inline: false },
                    { name: 'Severity', value: severity.toUpperCase(), inline: true },
                    { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Rule ID', value: `${rule.id}`, inline: true }
                )
                .setFooter({ text: 'Escalation: warning → warning → [mute/kick/ban]' });

            return interaction.reply({
                embeds: [embed],
                ephemeral: false
            });
        } catch (error) {
            console.error('Error in addrule command:', error);

            // Check if it's a duplicate rule error
            if (error.message && error.message.includes('already exists')) {
                return interaction.reply({
                    content: `❌ ${error.message}`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: '❌ An error occurred while adding the rule.',
                ephemeral: true
            });
        }
    }
};
