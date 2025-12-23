const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const userDataManager = require('../utils/userDataManager');
const { v4: uuidv4 } = require('uuid');

// Constants
const MOD_ROLE_IDS = ['1368995164470902967', '1294078699687247882', '1359466436212559933'];
const MOD_CHAT_ID = '1294668387322171475';
const DM_CHECK_INTERVAL = 1; // Check every 1 hour
const DM_CHECK_DURATION = 24; // Check for 24 hours

// Helper function to calculate reminder time
function calculateReminderTime(timeInput) {
    const now = new Date();
    
    switch (timeInput) {
        case '1h':
            return new Date(now.getTime() + 1 * 60 * 60 * 1000);
        case '3h':
            return new Date(now.getTime() + 3 * 60 * 60 * 1000);
        case '6h':
            return new Date(now.getTime() + 6 * 60 * 60 * 1000);
        case '24h':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        default:
            // Try to parse as a date (custom date format: YYYY-MM-DD or YYYY-MM-DD HH:mm)
            const customDate = new Date(timeInput);
            if (!isNaN(customDate.getTime())) {
                return customDate;
            }
            return null;
    }
}

// Helper function to extract user ID from message link or ID
async function extractUserIdFromMessage(messageInput, interaction) {
    try {
        // Try direct ID first
        if (/^\d+$/.test(messageInput)) {
            const message = await interaction.channel.messages.fetch(messageInput).catch(() => null);
            if (message) {
                return message.author.id;
            }
        }

        // Try message link
        const linkMatch = messageInput.match(/https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/);
        if (linkMatch) {
            const channelId = linkMatch[1];
            const messageId = linkMatch[2];
            try {
                const channel = await interaction.client.channels.fetch(channelId);
                const message = await channel.messages.fetch(messageId);
                return message.author.id;
            } catch (error) {
                console.error('Error fetching message from link:', error);
                return null;
            }
        }

        return null;
    } catch (error) {
        console.error('Error extracting user ID from message:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check')
        .setDescription('Flag a user or message for a wellness check')
        .addStringOption(option =>
            option
                .setName('msg')
                .setDescription('Message ID or link to check from')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check on (optional if msg provided)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName('autodm')
                .setDescription('Should the bot auto-DM the user to check in?')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('time')
                .setDescription('When to check: 1h, 3h, 6h, 24h, or custom date (YYYY-MM-DD)')
                .setRequired(true)
                .addChoices(
                    { name: '1 hour', value: '1h' },
                    { name: '3 hours', value: '3h' },
                    { name: '6 hours', value: '6h' },
                    { name: '24 hours', value: '24h' },
                    { name: 'Custom date', value: 'custom' }
                )
        )
        .addStringOption(option =>
            option
                .setName('customdate')
                .setDescription('Custom date if selected (format: YYYY-MM-DD or YYYY-MM-DD HH:mm)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('note')
                .setDescription('Note about why this check is needed')
                .setRequired(false)
                .setMaxLength(500)
        ),

    async execute(interaction) {
        // Check if user is a mod
        const isMod = MOD_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        
        if (!isMod) {
            return interaction.reply({
                content: '❌ Only moderators can use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const messageInput = interaction.options.getString('msg');
            let userOption = interaction.options.getUser('user');
            const autoDM = interaction.options.getBoolean('autodm');
            const timeInput = interaction.options.getString('time');
            const customDate = interaction.options.getString('customdate');
            const note = interaction.options.getString('note');

            let targetUserId = userOption?.id;
            let messageId = messageInput;

            // If message provided, extract user from it
            if (messageInput && !targetUserId) {
                targetUserId = await extractUserIdFromMessage(messageInput, interaction);
                messageId = messageInput;
            }

            // Validate we have a target user
            if (!targetUserId) {
                return interaction.editReply({
                    content: '❌ Please provide either a user or a valid message ID/link.'
                });
            }

            // Calculate reminder time
            let reminderTime;
            if (timeInput === 'custom') {
                if (!customDate) {
                    return interaction.editReply({
                        content: '❌ Please provide a custom date when selecting "Custom date".'
                    });
                }
                reminderTime = calculateReminderTime(customDate);
            } else {
                reminderTime = calculateReminderTime(timeInput);
            }

            if (!reminderTime) {
                return interaction.editReply({
                    content: '❌ Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:mm'
                });
            }

            // Create wellness check record
            const checkId = uuidv4();
            const wellnessCheck = await userDataManager.createWellnessCheck(
                checkId,
                targetUserId,
                interaction.user.id,
                messageId,
                note,
                autoDM,
                reminderTime
            );

            if (!wellnessCheck) {
                return interaction.editReply({
                    content: '❌ Failed to create wellness check. Please try again.'
                });
            }

            // If autoDM is enabled, send DM to user
            if (autoDM) {
                await sendWellnessCheckDM(interaction.client, targetUserId, checkId);
            }

            // Notify mod chat
            await notifyModChat(interaction.client, wellnessCheck, interaction.user, autoDM);

            return interaction.editReply({
                content: `✅ Wellness check created for <@${targetUserId}>!\nCheck ID: \`${checkId}\``
            });

        } catch (error) {
            console.error('Error in check command:', error);
            return interaction.editReply({
                content: '❌ An error occurred while creating the wellness check.'
            });
        }
    }
};

// Helper function to send wellness check DM
async function sendWellnessCheckDM(client, userId, checkId) {
    try {
        const user = await client.users.fetch(userId);
        
        const dmEmbed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setTitle('🐻 Wellness Check-In')
            .setDescription('Hi there! We just wanted to check in and see how you\'re doing. Reply to this message to let us know you\'re okay!')
            .setFooter({ text: `Check ID: ${checkId}` })
            .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error(`Error sending DM to user ${userId}:`, error);
        // Mark DMs as disabled
        await userDataManager.markDMsDisabled(checkId);
    }
}

// Helper function to notify mod chat
async function notifyModChat(client, wellnessCheck, flaggedBy, autoDM) {
    try {
        const modChat = await client.channels.fetch(MOD_CHAT_ID);
        
        const embed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setTitle('🐻 Wellness Check Flagged')
            .addFields(
                { name: 'User', value: `<@${wellnessCheck.user_id}>`, inline: true },
                { name: 'Flagged By', value: `<@${wellnessCheck.flagged_by}>`, inline: true },
                { name: 'Type', value: autoDM ? 'Auto-DM Check' : 'Reminder', inline: true },
                { name: 'Reminder Time', value: `<t:${Math.floor(new Date(wellnessCheck.reminder_time).getTime() / 1000)}:F>`, inline: true },
                { name: 'Status', value: 'Pending', inline: true }
            );

        if (wellnessCheck.note) {
            embed.addFields({ name: 'Note', value: wellnessCheck.note });
        }

        if (wellnessCheck.message_id) {
            embed.addFields({ name: 'Message ID', value: `\`${wellnessCheck.message_id}\`` });
        }

        const resolveButton = new ButtonBuilder()
            .setCustomId(`resolve_check_${wellnessCheck.check_id}`)
            .setLabel('Mark Resolved')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(resolveButton);

        embed.setFooter({ text: `Check ID: ${wellnessCheck.check_id}` });

        await modChat.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error notifying mod chat:', error);
    }
}
