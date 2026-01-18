const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarning')
        .setDescription('Clear warnings for a user (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Clear all warnings or a specific one')
                .setRequired(true)
                .addChoices(
                    { name: 'Clear All Warnings', value: 'all' },
                    { name: 'Clear Specific Warning', value: 'specific' }
                )
        )
        .addStringOption(option =>
            option
                .setName('rule')
                .setDescription('The specific rule to clear (only if type is "specific")')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const targetUser = interaction.options.getUser('user');
            
            if (!targetUser) {
                await interaction.respond([]);
                return;
            }

            const userWarnings = await moderationManager.getUserWarnings(targetUser.id);
            
            if (!userWarnings || userWarnings.length === 0) {
                return await interaction.respond([
                    { name: 'No warnings for this user', value: 'none' }
                ]);
            }

            let choices = userWarnings.map(warning => ({
                name: `[${warning.severity.toUpperCase()}] ${warning.rule_name} (${warning.warning_count} warning${warning.warning_count > 1 ? 's' : ''})`,
                value: warning.rule_name
            }));

            // Remove duplicates
            choices = Array.from(new Map(choices.map(item => [item.value, item])).values());

            // Filter based on input
            if (focusedValue) {
                choices = choices.filter(choice =>
                    choice.name.toLowerCase().includes(focusedValue.toLowerCase())
                );
            }

            // Discord limits to 25 choices
            choices = choices.slice(0, 25);

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in clearwarning autocomplete:', error);
            await interaction.respond([
                { name: 'Error loading warnings', value: 'error' }
            ]);
        }
    },

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
            const clearType = interaction.options.getString('type');

            // Defer reply
            await interaction.deferReply();

            if (clearType === 'all') {
                // Clear all warnings
                const clearedWarnings = await moderationManager.clearAllWarnings(
                    targetUser.id,
                    interaction.user.id
                );

                if (clearedWarnings.length === 0) {
                    return interaction.editReply({
                        content: `✅ <@${targetUser.id}> has no active warnings to clear.`
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ All Warnings Cleared')
                    .setDescription(`All warnings for <@${targetUser.id}> have been cleared.`)
                    .addFields(
                        { name: 'Warnings Cleared', value: `${clearedWarnings.length}`, inline: true },
                        { name: 'Cleared By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setFooter({ text: `User ID: ${targetUser.id}` });

                return interaction.editReply({
                    embeds: [embed]
                });
            } else if (clearType === 'specific') {
                const ruleName = interaction.options.getString('rule');

                if (!ruleName) {
                    return interaction.editReply({
                        content: '❌ Please specify which rule\'s warning to clear.'
                    });
                }

                // Get the user's warning for this rule
                const rule = await moderationManager.getRule(ruleName);
                if (!rule) {
                    return interaction.editReply({
                        content: `❌ Rule "${ruleName}" not found.`
                    });
                }

                const warning = await moderationManager.getActiveWarning(targetUser.id, rule.id);
                if (!warning) {
                    return interaction.editReply({
                        content: `❌ <@${targetUser.id}> has no active warnings for the rule "${ruleName}".`
                    });
                }

                // Clear the specific warning
                const clearedWarning = await moderationManager.clearSpecificWarning(
                    warning.id,
                    interaction.user.id
                );

                const emoji = rule.severity === 'red' ? '🔴' : 
                             rule.severity === 'yellow' ? '🟡' : '🟢';

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Warning Cleared')
                    .setDescription(`Warning cleared for <@${targetUser.id}>`)
                    .addFields(
                        { name: 'Rule', value: `${emoji} **${rule.rule_name}**`, inline: false },
                        { name: 'Severity', value: rule.severity.toUpperCase(), inline: true },
                        { name: 'Cleared By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setFooter({ text: `User ID: ${targetUser.id}` });

                return interaction.editReply({
                    embeds: [embed]
                });
            }
        } catch (error) {
            console.error('Error in clearwarning command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while clearing the warning.'
            });
        }
    }
};
