const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removerule')
        .setDescription('Remove a moderation rule (Admin only)')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Rule name to remove')
                .setRequired(true)
                .setAutocomplete(true)
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

            // Remove the rule
            const rule = await moderationManager.deleteRule(ruleName);

            // Create embed for confirmation
            const emoji = rule.severity === 'red' ? '🔴' : rule.severity === 'yellow' ? '🟡' : '🟢';
            const embed = new EmbedBuilder()
                .setColor(0xff6b6b)
                .setTitle('✅ Rule Removed Successfully')
                .setDescription(`${emoji} **${rule.rule_name}**`)
                .addFields(
                    { name: 'Description', value: rule.description, inline: false },
                    { name: 'Severity', value: rule.severity.toUpperCase(), inline: true },
                    { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Rule ID', value: `${rule.id}`, inline: true }
                )
                .setFooter({ text: 'This rule has been deleted from the server.' });

            return interaction.reply({
                embeds: [embed],
                ephemeral: false
            });
        } catch (error) {
            console.error('Error in removerule command:', error);

            // Check if it's a not found error
            if (error.message && error.message.includes('not found')) {
                return interaction.reply({
                    content: `❌ ${error.message}`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: '❌ An error occurred while removing the rule.',
                ephemeral: true
            });
        }
    },

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const rules = await moderationManager.getAllRules();

            const choices = rules
                .map(rule => rule.rule_name)
                .filter(name => name.toLowerCase().includes(focusedValue))
                .slice(0, 25); // Discord limit

            await interaction.respond(
                choices.map(choice => ({ name: choice, value: choice }))
            );
        } catch (error) {
            console.error('Error in removerule autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
