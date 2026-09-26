'use strict';

const { EmbedBuilder } = require('discord.js');
const gifClient = require('./gifClient');
const userDataManager = require('./userDataManager');

// Returns the post-action count (current + 1) for a stat, or null if DB is unavailable.
async function fetchStatCount(userId, statKey) {
    try {
        const stats = await Promise.race([
            userDataManager.getGifStats(userId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
        ]);
        return (stats[statKey] || 0) + 1;
    } catch {
        return null;
    }
}

// "bonksGiven" → singular: "bonk", plural: "bonks"
function statNoun(key) {
    const plural = key.replace(/Given$|Received$/, ''); // bonks, uppies, …
    if (plural.endsWith('ies')) return { singular: plural.slice(0, -3) + 'y', plural };
    return { singular: plural.slice(0, -1), plural };
}

function label(count, key) {
    const { singular, plural } = statNoun(key);
    return `${count} ${count === 1 ? singular : plural}`;
}

async function buildStatLine(interaction, statKeys) {
    if (!statKeys) return '';

    const [giverCount, receiverCount] = await Promise.all([
        fetchStatCount(interaction.user.id, statKeys.giver),
        statKeys.receiverId ? fetchStatCount(statKeys.receiverId, statKeys.receiver) : Promise.resolve(null),
    ]);

    if (giverCount === null) return '';

    let line = `-# You've given ${label(giverCount, statKeys.giver)}`;
    if (statKeys.receiverId && receiverCount !== null) {
        line += ` · <@${statKeys.receiverId}> has received ${label(receiverCount, statKeys.receiver)}`;
    }
    return line;
}

async function sendGifReply(interaction, { category, content, statKeys }) {
    const statLine = await buildStatLine(interaction, statKeys);
    const fullContent = statLine ? `${content}\n${statLine}` : content;

    try {
        let url = gifClient.getRandomGifUrl(category);

        if (url) {
            await interaction.reply({
                content: fullContent,
                embeds: [new EmbedBuilder().setImage(url)],
            });
        } else if (process.env.GIF_API_BASE) {
            await interaction.deferReply();
            url = await gifClient.getRandomGifUrlRemote(category);
            if (url) {
                await interaction.editReply({
                    content: fullContent,
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
