const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationManager = require('../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user for breaking a rule')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('rule')
                .setDescription('The rule they broke')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const rules = await moderationManager.getAllRules();
            
            if (!rules || rules.length === 0) {
                return await interaction.respond([
                    { name: 'No rules created yet', value: 'none' }
                ]);
            }

            let choices = rules.map(rule => ({
                name: `[${rule.severity.toUpperCase()}] ${rule.rule_name}`,
                value: rule.rule_name
            }));

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
            console.error('Error in warn autocomplete:', error);
            await interaction.respond([
                { name: 'Error loading rules', value: 'error' }
            ]);
        }
    },

    async execute(interaction) {
        try {
            // Check if user has one of the mod/admin roles
            const modRoles = ['1359466436212559933', '1294078699687247882', '1368995164470902967'];
            const hasModRole = modRoles.some(roleId => interaction.member.roles.cache.has(roleId));

            if (!hasModRole && !interaction.member.permissions.has('ModerateMembers')) {
                return interaction.reply({
                    content: '❌ You need a moderation role to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const ruleName = interaction.options.getString('rule');

            // Defer reply since this might take a moment
            await interaction.deferReply();

            // Check if trying to warn themselves
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ You cannot warn yourself.'
                });
            }

            // Get target user's roles
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch (error) {
                return interaction.editReply({
                    content: '❌ Could not fetch target user information.'
                });
            }

            const targetHasModRole = modRoles.some(roleId => targetMember.roles.cache.has(roleId));

            // Mods cannot warn other mods or admins
            if (!targetHasModRole) {
                // User being warned doesn't have a mod role, proceed normally
            } else {
                // Target has a mod role, check if the warner can warn them
                if (hasModRole) {
                    // If both have mod roles, don't allow warning
                    return interaction.editReply({
                        content: '❌ You cannot warn other moderators or administrators.'
                    });
                }
            }

            // Check if user is trying to warn the bot
            if (targetUser.id === interaction.client.user.id) {
                return interaction.editReply({
                    content: '❌ Cannot warn the bot.'
                });
            }

            // Get the rule
            const rule = await moderationManager.getRule(ruleName);
            if (!rule) {
                return interaction.editReply({
                    content: `❌ Rule "${ruleName}" not found.`
                });
            }

            // Add the warning
            const warning = await moderationManager.warnUser(
                targetUser.id,
                rule.id,
                rule.rule_name,
                rule.severity,
                interaction.user.id
            );

            // Get the next action
            const nextAction = moderationManager.getNextAction(
                rule.severity,
                warning.warning_count
            );

            const emoji = rule.severity === 'red' ? '🔴' : 
                         rule.severity === 'yellow' ? '🟡' : '🟢';

            // Create warning embed
            const embed = new EmbedBuilder()
                .setColor(
                    rule.severity === 'red' ? 0xff0000 :
                    rule.severity === 'yellow' ? 0xffff00 :
                    0x00ff00
                )
                .setTitle(`${emoji} User Warned`)
                .setDescription(`<@${targetUser.id}> has been warned`)
                .addFields(
                    { name: 'Rule', value: `**${rule.rule_name}**`, inline: false },
                    { name: 'Description', value: rule.description, inline: false },
                    { name: 'Severity', value: rule.severity.toUpperCase(), inline: true },
                    { name: 'Warning Count', value: `${warning.warning_count}`, inline: true },
                    { name: 'Next Action', value: nextAction || 'None', inline: true },
                    { name: 'Warned By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Expires', value: `<t:${Math.floor(new Date(warning.expires_at).getTime() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: `User ID: ${targetUser.id}` });

            await interaction.editReply({
                embeds: [embed]
            });

            // Try to send a DM to the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(
                        rule.severity === 'red' ? 0xff0000 :
                        rule.severity === 'yellow' ? 0xffff00 :
                        0x00ff00
                    )
                    .setTitle(`${emoji} You've been warned`)
                    .setDescription(`You've been warned in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Rule', value: `**${rule.rule_name}**`, inline: false },
                        { name: 'Description', value: rule.description, inline: false },
                        { name: 'Severity', value: rule.severity.toUpperCase(), inline: true },
                        { name: 'Warning Count', value: `${warning.warning_count}/${moderationManager.escalationSequences[rule.severity].length}`, inline: true }
                    );

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not send DM to user ${targetUser.id}`);
            }
        } catch (error) {
            console.error('Error in warn command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while warning the user.'
            });
        }
    }
};
