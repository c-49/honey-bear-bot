const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userstatus')
        .setDescription('Check a user\'s moderation status (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to check')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            // Check if user has the admin role
            const adminRoleId = '1368995164470902967';
            const hasAdminRole = interaction.member.roles.cache.has(adminRoleId);

            if (!hasAdminRole && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '❌ You need the admin role to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');

            // Defer reply
            await interaction.deferReply({ ephemeral: false });

            // Get user's warnings
            const warnings = await moderationManager.getUserWarnings(targetUser.id);
            const summary = await moderationManager.getWarningSummary(targetUser.id);

            // Create main embed
            const embed = new EmbedBuilder()
                .setColor(warnings.length === 0 ? 0x00ff00 : 0xff0000)
                .setTitle(`Moderation Status: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `User ID: ${targetUser.id}` })
                .setTimestamp();

            if (warnings.length === 0) {
                embed.setDescription('✅ This user has no active warnings.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Group warnings by rule
            const byRule = {};
            warnings.forEach(warning => {
                if (!byRule[warning.rule_name]) {
                    byRule[warning.rule_name] = warning;
                }
            });

            const severityOrder = { red: 0, yellow: 1, green: 2 };
            const sortedRules = Object.entries(byRule).sort((a, b) => {
                return severityOrder[a[1].severity] - severityOrder[b[1].severity];
            });

            // Add warning details as fields
            let warningDescription = '';
            let redCount = 0, yellowCount = 0, greenCount = 0;

            sortedRules.forEach(([ruleName, warning]) => {
                const emoji = warning.severity === 'red' ? '🔴' : 
                             warning.severity === 'yellow' ? '🟡' : '🟢';

                if (warning.severity === 'red') redCount++;
                else if (warning.severity === 'yellow') yellowCount++;
                else greenCount++;

                const expiresDate = new Date(warning.expires_at);
                const daysUntilExpiry = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));

                warningDescription += `${emoji} **${ruleName}** (${warning.severity.toUpperCase()})\n`;
                warningDescription += `   • Warnings: ${warning.warning_count}\n`;
                warningDescription += `   • Next Action: ${moderationManager.getNextAction(warning.severity, warning.warning_count)}\n`;
                warningDescription += `   • Expires in: ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}\n\n`;
            });

            embed.setDescription(warningDescription);

            // Add summary field
            let summaryText = '';
            if (redCount > 0) {
                const action = moderationManager.getNextAction('red', redCount) || 'Final Action';
                summaryText += `🔴 Red violations: ${redCount} (Next: ${action})\n`;
            }
            if (yellowCount > 0) {
                const action = moderationManager.getNextAction('yellow', yellowCount) || 'Final Action';
                summaryText += `🟡 Yellow violations: ${yellowCount} (Next: ${action})\n`;
            }
            if (greenCount > 0) {
                const action = moderationManager.getNextAction('green', greenCount) || 'Final Action';
                summaryText += `🟢 Green violations: ${greenCount} (Next: ${action})\n`;
            }

            if (summaryText) {
                embed.addFields({
                    name: 'Summary',
                    value: summaryText,
                    inline: false
                });
            }

            // Add total warnings field
            embed.addFields({
                name: 'Total Warnings',
                value: `${warnings.length}`,
                inline: true
            });

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in userstatus command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while checking the user\'s status.'
            });
        }
    }
};
