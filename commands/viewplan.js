const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

// Constants
const MOD_ROLE_IDS = ['1368995164470902967', '1294078699687247882', '1359466436212559933'];
const ADMIN_ROLE_ID = '1368995164470902967';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewplan')
        .setDescription('View your safety plan or another user\'s (Mods/Admins only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to view plan for (Mods/Admins only)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isMod = interaction.member.roles.cache.some(role => MOD_ROLE_IDS.includes(role.id));
        const isAdmin = interaction.member.roles.cache.some(role => role.id === ADMIN_ROLE_ID);

        // Permission check: users can only view their own, mods/admins can view anyone
        if (targetUser.id !== interaction.user.id && !isMod && !isAdmin) {
            return await interaction.reply({
                content: '❌ You can only view your own safety plan. Mods and admins can view other users\' plans.',
                ephemeral: true
            });
        }

        // Defer as we're fetching from database
        await interaction.deferReply({ ephemeral: true });

        try {
            const plan = await userDataManager.getSafetyPlan(targetUser.id);

            if (!plan) {
                return await interaction.editReply({
                    content: `📋 No safety plan found for ${targetUser.username}. Use \`/safetyplan\` to create one!`
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#ff69b4')
                .setTitle(`🧾 Safety Plan for ${targetUser.username}`)
                .setDescription('Their personal safety plan is saved for reference. 💙')
                .addFields(
                    { name: '🧠 Warning Signs', value: plan.warningSigns || '*Not filled in*', inline: false },
                    { name: '💚 Self-Soothing Actions', value: plan.selfSoothing || '*Not filled in*', inline: false },
                    { name: '🤝 People or Places That Help', value: plan.peoplePlaces || '*Not filled in*', inline: false },
                    { name: '📞 Emergency Supports', value: plan.emergencySupports || '*Not filled in*', inline: false },
                    { name: '🌱 Reasons to Stay Grounded', value: plan.reasonsToStay || '*Not filled in*', inline: false }
                )
                .setFooter({ text: `Last updated: ${new Date(plan.updatedAt).toLocaleString()}` })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            console.log(`${interaction.user.tag} viewed safety plan for ${targetUser.tag}`);
        } catch (error) {
            console.error('Error fetching safety plan:', error);
            await interaction.editReply({
                content: '❌ There was an error retrieving the safety plan.'
            });
        }
    }
};
