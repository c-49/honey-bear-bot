const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/gifUtils');
const userDataManager = require('../utils/userDataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fart')
        .setDescription('Fart at a user or just fart with a random GIF!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to fart on (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer immediately to give time for resizing/IO
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');

        const gifPath = getRandomGif('./gifs/fart');

        if (!gifPath) {
            return interaction.editReply({
                content: 'No fart GIFs found! Please add some GIFs to the gifs/fart folder.'
            });
        }

        try {
            const attachment = new AttachmentBuilder(gifPath);
            const content = targetUser
                ? `${interaction.user} farted on ${targetUser}! 💨`
                : `${interaction.user} farted! 💨`;

            await interaction.editReply({
                content: content,
                files: [attachment]
            });

            // Track stats in the background (non-blocking)
            userDataManager.incrementGifStat(interaction.user.id, 'fartsGiven').catch(err => 
                console.error('Error tracking farts given:', err)
            );
            if (targetUser) {
                userDataManager.incrementGifStat(targetUser.id, 'fartsReceived').catch(err => 
                    console.error('Error tracking farts received:', err)
                );
            }
        } catch (error) {
            console.error('Error sending fart GIF:', error);
            const content = targetUser
                ? `${interaction.user} farted on ${targetUser}! 💨 (GIF failed to load)`
                : `${interaction.user} farted! 💨 (GIF failed to load)`;
            try {
                await interaction.editReply({ content });
            } catch (e) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
        }
    },
};
