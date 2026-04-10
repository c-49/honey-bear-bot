const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

// Constants
const MOD_ROLE_IDS = ['1368995164470902967', '1294078699687247882', '1359466436212559933'];
const ADMIN_ROLE_ID = '1368995164470902967';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('safetyplan')
        .setDescription('Create or update your personal safety plan')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to create/edit safety plan for (Mods/Admins only)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isMod = interaction.member.roles.cache.some(role => MOD_ROLE_IDS.includes(role.id));
        const isAdmin = interaction.member.roles.cache.some(role => role.id === ADMIN_ROLE_ID);

        // Permission check for mod/admin override
        if (targetUser.id !== interaction.user.id && !isMod && !isAdmin) {
            return await interaction.reply({
                content: '❌ Only mods and admins can edit another user\'s safety plan.',
                ephemeral: true
            });
        }

        // Get existing plan if any
        let existingPlan = {};
        try {
            existingPlan = await userDataManager.getSafetyPlan(targetUser.id) || {};
        } catch (error) {
            console.error('Error fetching existing plan:', error);
        }

        // Create modal with 5 text inputs for each section
        const modal = new ModalBuilder()
            .setCustomId(`safetyplan_${targetUser.id}`)
            .setTitle('Personal Safety Plan');

        const sections = [
            {
                customId: 'warning_signs',
                label: '🧠 Warning Signs (Thoughts, Feelings, Situations)',
                placeholder: 'e.g., Thoughts: Racing thoughts...\nFeelings: Anxious, overwhelmed...\nSituations: When stressed or alone...',
                value: existingPlan.warningSigns || ''
            },
            {
                customId: 'self_soothing',
                label: '💚 Self-Soothing Actions',
                placeholder: 'e.g., Take a warm shower, listen to music, go for a walk, breathing exercises...',
                value: existingPlan.selfSoothing || ''
            },
            {
                customId: 'people_places',
                label: '🤝 People or Places That Help',
                placeholder: 'e.g., Friends: Alice, Bob\nOnline: Discord community, support forums\nPlaces: Library, park, cozy café...',
                value: existingPlan.peoplePlaces || ''
            },
            {
                customId: 'emergency_supports',
                label: '📞 Emergency Supports',
                placeholder: 'Crisis line: 988 (US)\nTrusted adult: [Name/Contact]\nOther: [Therapist, hotline, resource]...',
                value: existingPlan.emergencySupports || ''
            },
            {
                customId: 'reasons_to_stay',
                label: '🌱 Reasons to Stay Grounded',
                placeholder: 'Things I care about: [Your passions]\nGoals: [Your aspirations]\nPeople who matter: [Loved ones]...',
                value: existingPlan.reasonsToStay || ''
            }
        ];

        sections.forEach(section => {
            const input = new TextInputBuilder()
                .setCustomId(section.customId)
                .setLabel(section.label)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(section.placeholder)
                .setMaxLength(1024)
                .setRequired(false);

            if (section.value) {
                input.setValue(section.value);
            }

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);
        });

        await interaction.showModal(modal);
    }
};
