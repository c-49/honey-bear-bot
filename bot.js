const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const MilestoneChecker = require('./utils/milestoneChecker');
const WellnessCheckManager = require('./utils/wellnessCheckManager');
const userDataManager = require('./utils/userDataManager');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.log(`Warning: Command at ${filePath} is missing required "data" or "execute" property.`);
        }
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    loadCommands();

    // Start automatic milestone checking
    const milestoneChecker = new MilestoneChecker(client);
    milestoneChecker.startDailyCheck();

    // Start wellness check manager
    const wellnessCheckManager = new WellnessCheckManager(client);
    wellnessCheckManager.start();
    client.wellnessCheckManager = wellnessCheckManager;
});

client.on('interactionCreate', async interaction => {
    // Handle button interactions
    if (interaction.isButton()) {
        const customId = interaction.customId;

        try {
            switch (true) {
                case customId.startsWith('wellness_check_ok_'): {
                    // Handle wellness check confirmation button
                    const checkId = customId.replace('wellness_check_ok_', '');
                    const REPORT_CHANNEL_ID = '1453170052462542879';

                    try {
                        // Update wellness check as user responded
                        const resolved = await userDataManager.resolveWellnessCheck(checkId, interaction.user.id, 'user_clicked_button');
                        
                        // Acknowledge the button click in DM
                        await interaction.reply({
                            content: '✅ Thanks for letting us know you\'re okay! Take care! 💙',
                            ephemeral: true
                        });

                        // Report to mod chat and try to update original message
                        if (resolved) {
                            const reportChannel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID);
                            const embed = new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('✅ Wellness Check - User Responded')
                                .addFields(
                                    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: 'Status', value: 'Confirmed', inline: true },
                                    { name: 'Response', value: 'User clicked "I\'m Okay" button' }
                                )
                                .setFooter({ text: `Check ID: ${checkId}` })
                                .setTimestamp();

                            await reportChannel.send({ embeds: [embed] });

                            // Try to find and update the original wellness check message in the report channel
                            try {
                                const messages = await reportChannel.messages.fetch({ limit: 50 });
                                const originalMessage = messages.find(msg => 
                                    msg.embeds.length > 0 && 
                                    msg.embeds[0].footer?.text?.includes(checkId) &&
                                    (msg.embeds[0].title?.includes('Wellness Check') || msg.embeds[0].title?.includes('Flagged'))
                                );

                                if (originalMessage) {
                                    const updatedEmbed = originalMessage.embeds[0].toJSON();
                                    updatedEmbed.color = 0x00FF00;
                                    updatedEmbed.title = '✅ Wellness Check - Resolved';
                                    updatedEmbed.fields = updatedEmbed.fields || [];
                                    
                                    await originalMessage.edit({
                                        embeds: [updatedEmbed],
                                        components: []
                                    });
                                }
                            } catch (updateError) {
                                console.error('Could not update original wellness check message:', updateError);
                            }
                        }
                    } catch (error) {
                        console.error('Error handling wellness check button:', error);
                        await interaction.reply({
                            content: '❌ There was an error processing your response.',
                            ephemeral: true
                        }).catch(() => {});
                    }
                    break;
                }

                case customId === 'welcome_gif': {
                    const { getRandomGif } = require('./utils/gifUtils');
                    const { AttachmentBuilder } = require('discord.js');

                    // Defer the reply immediately to prevent timeout
                    await interaction.deferReply();

                    const gifPath = getRandomGif('./gifs/welcome');

                    if (!gifPath) {
                        return interaction.editReply({
                            content: 'No welcome GIFs found!'
                        });
                    }

                    // Get the new user mention from the original message
                    const originalMessage = interaction.message;
                    const newUserMention = originalMessage.content.match(/<@!?\d+>/)?.[0] || '';

                    const attachment = new AttachmentBuilder(gifPath);
                    await interaction.editReply({
                        content: `${interaction.user} welcomes you${newUserMention ? ` ${newUserMention}` : ''}! 🎉`,
                        files: [attachment]
                    });

                    console.log(`${interaction.user.tag} sent a welcome GIF`);
                    break;
                }

                case customId.startsWith('resolve_check_'): {
                    // Handle wellness check resolution
                    const checkId = customId.replace('resolve_check_', '');
                    const MOD_ROLE_IDS = ['1368995164470902967', '1294078699687247882', '1359466436212559933'];
                    
                    // Verify the user is a mod
                    const isMod = MOD_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
                    
                    if (!isMod) {
                        return interaction.reply({
                            content: '❌ Only moderators can resolve wellness checks.',
                            ephemeral: true
                        });
                    }

                    // Resolve the check
                    const resolved = await userDataManager.resolveWellnessCheck(checkId, interaction.user.id);
                    
                    if (resolved) {
                        await interaction.reply({
                            content: `✅ Wellness check \`${checkId}\` has been marked as resolved.`,
                            ephemeral: true
                        });

                        // Update the original embed
                        const embed = interaction.message.embeds[0];
                        if (embed) {
                            const updatedEmbed = embed.toJSON();
                            updatedEmbed.color = 0x00FF00;
                            updatedEmbed.title = '✅ Wellness Check - Resolved';
                            
                            await interaction.message.edit({
                                embeds: [updatedEmbed],
                                components: []
                            }).catch(err => console.error('Error updating message:', err));
                        }
                    } else {
                        await interaction.reply({
                            content: '❌ Could not resolve the wellness check.',
                            ephemeral: true
                        });
                    }
                    break;
                }

                case customId.startsWith('mood_reply_'): {
                    // Handle mood reply button
                    const userId = customId.replace('mood_reply_', '');
                    const message = interaction.message;

                    // Check if thread already exists
                    let thread;
                    let isNewThread = false;

                    if (message.hasThread) {
                        thread = message.thread;
                    } else {
                        // Get the user from the message to get their display name
                        const mentionMatch = message.content.match(/<@!?(\d+)>/);
                        let userName = 'user';
                        if (mentionMatch) {
                            try {
                                const user = await interaction.client.users.fetch(mentionMatch[1]);
                                userName = user.username;
                            } catch (e) {
                                console.error('Could not fetch user for thread name:', e);
                            }
                        }

                        // Create a new thread
                        thread = await message.startThread({
                            name: `Support for ${userName}`,
                            autoArchiveDuration: 1440, // 24 hours
                            reason: 'Mood check-in support thread'
                        });
                        isNewThread = true;
                    }

                    // Only send initial message if it's a new thread
                    if (isNewThread) {
                        await thread.send(`${interaction.user} is reaching out to offer support 💙`);
                    }

                    // Acknowledge the button click
                    await interaction.reply({
                        content: isNewThread ? `Thread created! You can now chat in the thread to offer support.` : `You can chat in the existing thread to offer support.`,
                        flags: 64 // ephemeral
                    });

                    console.log(`${interaction.user.tag} reached out in mood thread for user ${userId}`);
                    break;
                }

                case customId.startsWith('affirmation_reply_'): {
                    // Handle affirmation reply button
                    const userId = customId.replace('affirmation_reply_', '');
                    const message = interaction.message;

                    // Check if thread already exists
                    let thread;
                    let isNewThread = false;

                    if (message.hasThread) {
                        thread = message.thread;
                    } else {
                        // Get the user from the message to get their display name
                        const mentionMatch = message.content.match(/<@!?(\d+)>/);
                        let userName = 'user';
                        if (mentionMatch) {
                            try {
                                const user = await interaction.client.users.fetch(mentionMatch[1]);
                                userName = user.username;
                            } catch (e) {
                                console.error('Could not fetch user for thread name:', e);
                            }
                        }

                        // Create a new thread
                        thread = await message.startThread({
                            name: `Support for ${userName}`,
                            autoArchiveDuration: 1440, // 24 hours
                            reason: 'Affirmation support thread'
                        });
                        isNewThread = true;
                    }

                    // Only send initial message if it's a new thread
                    if (isNewThread) {
                        await thread.send(`${interaction.user} is joining to support your affirmation 💙`);
                    }

                    // Acknowledge the button click
                    await interaction.reply({
                        content: isNewThread ? `Thread created! You can now chat in the thread to offer support.` : `You can chat in the existing thread to offer support.`,
                        flags: 64 // ephemeral
                    });

                    console.log(`${interaction.user.tag} reached out in affirmation thread for user ${userId}`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            // Only try to respond if we haven't replied yet
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error handling this interaction!',
                    flags: 64 // ephemeral flag
                }).catch(() => {});
            } else {
                await interaction.editReply({
                    content: 'There was an error handling this interaction!'
                }).catch(() => {});
            }
        }

        return;
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        try {
            // Handle no-contact date picker menus
            if (customId.startsWith('nocontact_year_') || customId.startsWith('nocontact_month_') || customId.startsWith('nocontact_day_')) {
                const command = client.commands.get('nocontact');
                if (command && command.handleSelectMenu) {
                    await command.handleSelectMenu(interaction);
                }
            }
        } catch (error) {
            console.error('Error handling select menu interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error handling this interaction!',
                    ephemeral: true
                }).catch(() => {});
            } else {
                await interaction.editReply({
                    content: 'There was an error handling this interaction!'
                }).catch(() => {});
            }
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);

        const reply = {
            content: 'There was an error while executing this command!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

client.on('guildMemberAdd', async member => {
    // Just log the new member, all logic happens in guildMemberUpdate
    console.log(`New member joined: ${member.user.tag}`);
});

client.on('guildMemberRemove', async member => {
    const WELCOME_ROLE_ID = '1294101382701256774';

    // Remove welcome role if they had it (for if they rejoin)
    if (member.roles.cache.has(WELCOME_ROLE_ID)) {
        console.log(`Member ${member.user.tag} left (had welcome role)`);
    } else {
        console.log(`Member ${member.user.tag} left`);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const UNDERAGE_ROLE_ID = '1304923945757184152';
    const NO_WELCOME_ROLE_ID = '1424557858153824327';
    const WELCOME_ROLE_ID = '1294101382701256774';
    const REQUIRED_ROLE_ID = '1424564701924298752';

    try {
        // Check if the underage role was just added
        const hadUnderageRole = oldMember.roles.cache.has(UNDERAGE_ROLE_ID);
        const hasUnderageRole = newMember.roles.cache.has(UNDERAGE_ROLE_ID);

        if (!hadUnderageRole && hasUnderageRole) {
            // Role was just assigned, kick the user
            try {
                await newMember.send({
                    content: `Hello ${newMember.user.username},\n\nWe noticed you selected that you're under 18 during server onboarding. This server is intended for adults (18+) only, so we've had to remove you from the server.\n\nWe appreciate your understanding and encourage you to find age-appropriate communities that better suit your needs.\n\nTake care! 💙`
                });
                console.log(`Sent DM to underage user: ${newMember.user.tag}`);
            } catch (dmError) {
                console.log(`Could not send DM to ${newMember.user.tag}:`, dmError.message);
            }

            // Kick the member
            await newMember.kick('User is under 18 - adult server policy');
            console.log(`Kicked underage user: ${newMember.user.tag}`);
            return;
        }

        // Check if a role was just added and user now has BOTH required roles
        const oldRoleCount = oldMember.roles.cache.size;
        const newRoleCount = newMember.roles.cache.size;
        const hasWelcomeRole = newMember.roles.cache.has(WELCOME_ROLE_ID);
        const hasRequiredRole = newMember.roles.cache.has(REQUIRED_ROLE_ID);
        const hadBothRoles = oldMember.roles.cache.has(WELCOME_ROLE_ID) && oldMember.roles.cache.has(REQUIRED_ROLE_ID);

        // Only send welcome if: role was just added, user has BOTH roles, and they didn't have both before
        if (newRoleCount > oldRoleCount && hasWelcomeRole && hasRequiredRole && !hadBothRoles && !hasUnderageRole) {
            // Check if they should skip welcome
            if (newMember.roles.cache.has(NO_WELCOME_ROLE_ID)) {
                console.log(`Skipping welcome for ${newMember.user.tag} (has no-welcome role)`);
                return;
            }

            // Send welcome message with button
            const welcomeButton = new ButtonBuilder()
                .setCustomId('welcome_gif')
                .setLabel('Send Welcome GIF! 🎉')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
                .addComponents(welcomeButton);

            const welcomeChannel = newMember.guild.systemChannel;
            if (welcomeChannel) {
                await welcomeChannel.send({
                    content: `Welcome ${newMember}! Tell us about your story on <#1294734902998208564>. Make sure to check out the <#1294074223224033383>, and get some roles: <#1412922277942792233> & <#1412923346609377430>\n<@&1332093729691144263>`,
                    components: [row]
                });
                console.log(`Sent welcome message for ${newMember.user.tag}`);
            }
        }
    } catch (error) {
        console.error('Error handling member role update:', error);
    }
});

// Create a simple HTTP server for Render.com deployment
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord bot is running!');
});

server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('No Discord token found. Please set DISCORD_TOKEN in your .env file');
    process.exit(1);
}

client.login(token);