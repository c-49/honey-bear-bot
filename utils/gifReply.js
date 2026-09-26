'use strict';

const { EmbedBuilder } = require('discord.js');
const gifClient = require('./gifClient');
const userDataManager = require('./userDataManager');

async function sendGifReply(interaction, { category, content, statKeys }) {
    try {
        let url = gifClient.getRandomGifUrl(category);

        if (url) {
            await interaction.reply({
                content,
                embeds: [new EmbedBuilder().setImage(url)],
            });
        } else if (process.env.GIF_API_BASE) {
            await interaction.deferReply();
            url = await gifClient.getRandomGifUrlRemote(category);
            if (url) {
                await interaction.editReply({
                    content,
                    embeds: [new EmbedBuilder().setImage(url)],
                });
            } else {
                await interaction.editReply({ content: `${content} (GIF failed to load)` });
            }
        } else {
            await interaction.reply({ content: `${content} (GIF failed to load)` });
        }
    } catch (err) {
        console.error(`[gifReply] Error sending GIF reply (${category}):`, err);
        const fallback = `${content} (GIF failed to load)`;
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: fallback });
            } else {
                await interaction.reply({ content: fallback });
            }
        } catch {
            interaction.followUp({ content: fallback, ephemeral: true }).catch(() => {});
        }
        return;
    }

    if (!statKeys) return;

    userDataManager.incrementGifStat(interaction.user.id, statKeys.giver)
        .catch(err => console.error(`[gifReply] Error tracking ${statKeys.giver}:`, err));

    if (statKeys.receiverId) {
        userDataManager.incrementGifStat(statKeys.receiverId, statKeys.receiver)
            .catch(err => console.error(`[gifReply] Error tracking ${statKeys.receiver}:`, err));
    }
}

module.exports = { sendGifReply };
