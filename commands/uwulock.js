const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const userDataManager = require('../utils/userDataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uwulock')
        .setDescription('UWU lock a user as a funny punishment! 🔒')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to uwu lock')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName('lock')
                .setDescription('Lock (true) or unlock (false) the user')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Check if user is a moderator
            const MOD_ROLE_IDS = ['1368995164470902967', '1294078699687247882', '1359466436212559933'];
            const isMod = MOD_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));

            if (!isMod) {
                return await interaction.reply({
                    content: '❌ Only moderators can uwu lock users!',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const lockParam = interaction.options.getBoolean('lock');
            const isCurrentlyLocked = await userDataManager.isUwuLocked(targetUser.id);

            // Determine action: if lock param provided, use it; otherwise default to locking
            const shouldLock = lockParam !== null ? lockParam : !isCurrentlyLocked;

            // If trying to lock and already locked
            if (shouldLock && isCurrentlyLocked) {
                return await interaction.reply({
                    content: `${targetUser} is already uwu locked! 🔒`,
                    ephemeral: true
                });
            }

            // If trying to unlock and not locked
            if (!shouldLock && !isCurrentlyLocked) {
                return await interaction.reply({
                    content: `${targetUser} is not uwu locked!`,
                    ephemeral: true
                });
            }

            if (shouldLock) {
                // Lock the user
                await userDataManager.setUwuLocked(targetUser.id, true);

                // Create embed with unlock button
                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🔒 UWU LOCKED 🔒')
                    .setDescription(`${targetUser} has been uwu locked!`)
                    .addFields(
                        { name: 'What does this mean?', value: 'Everything you say will be converted to uwu speak (sowwie!)' },
                        { name: 'How to escape?', value: 'React with the unlock button or have a moderator unlock you' }
                    )
                    .setFooter({ text: `Locked by ${interaction.user.username}` })
                    .setTimestamp();

                const unlockButton = new ButtonBuilder()
                    .setCustomId(`uwu_unlock_${targetUser.id}`)
                .setLabel('Unlock me! 🔓')
                .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(unlockButton);

                await interaction.reply({
                    embeds: [embed],
                    components: [row]
                });

                // Try to notify the target user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle('You\'ve been UWU Locked!')
                        .setDescription('A moderator has uwu locked you as a funny punishment.')
                        .addFields(
                            { name: 'What happens now?', value: 'All your messages will be converted to uwu speak! 😆' },
                            { name: 'How to unlock?', value: 'Ask your moderators or react with the unlock button on their message' }
                        );

                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not send DM to ${targetUser.tag}: ${dmError.message}`);
                }
            } else {
                // Unlock the user
                await userDataManager.setUwuLocked(targetUser.id, false);

                await interaction.reply({
                    content: `✅ ${targetUser} has been freed from uwu lock! 🎉`,
                    ephemeral: false
                });

                // Try to notify the target user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('You\'ve been UWU Unlocked!')
                        .setDescription('A moderator has freed you from uwu lock! 🎉')
                        .addFields(
                            { name: 'You are free!', value: 'Your messages will no longer be converted to uwu speak.' }
                        );

                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not send DM to ${targetUser.tag}: ${dmError.message}`);
                }
            }

        } catch (error) {
            console.error('Error in uwulock command:', error);
            await interaction.reply({
                content: '❌ There was an error processing this command.',
                ephemeral: true
            });
        }
    }
};
