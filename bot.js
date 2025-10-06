const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const MilestoneChecker = require('./utils/milestoneChecker');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
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
});

client.on('interactionCreate', async interaction => {
    // Handle button interactions
    if (interaction.isButton()) {
        if (interaction.customId === 'welcome_gif') {
            const { getRandomGif } = require('./utils/gifUtils');
            const { AttachmentBuilder } = require('discord.js');

            try {
                const gifPath = getRandomGif('./gifs/welcome');

                if (!gifPath) {
                    return interaction.reply({
                        content: 'No welcome GIFs found!',
                        ephemeral: true
                    });
                }

                const attachment = new AttachmentBuilder(gifPath);
                await interaction.reply({
                    content: `${interaction.user} welcomes you! 🎉`,
                    files: [attachment]
                });

                console.log(`${interaction.user.tag} sent a welcome GIF`);
            } catch (error) {
                console.error('Error sending welcome GIF:', error);
                await interaction.reply({
                    content: 'There was an error sending the welcome GIF!',
                    ephemeral: true
                });
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
    const UNDERAGE_ROLE_ID = '1304923945757184152';
    const NO_WELCOME_ROLE_ID = '1424557858153824327';

    try {
        // Check if the member has the underage role
        if (member.roles.cache.has(UNDERAGE_ROLE_ID)) {
            // Send DM before kicking
            try {
                await member.send({
                    content: `Hello ${member.user.username},\n\nWe noticed you selected that you're under 18 during server onboarding. This server is intended for adults (18+) only, so we've had to remove you from the server.\n\nWe appreciate your understanding and encourage you to find age-appropriate communities that better suit your needs.\n\nTake care! 💙`
                });
                console.log(`Sent DM to underage user: ${member.user.tag}`);
            } catch (dmError) {
                console.log(`Could not send DM to ${member.user.tag}:`, dmError.message);
            }

            // Kick the member
            await member.kick('User is under 18 - adult server policy');
            console.log(`Kicked underage user: ${member.user.tag}`);
            return; // Exit early, don't send welcome message
        }

        // Check if member has the "no welcome" role
        if (member.roles.cache.has(NO_WELCOME_ROLE_ID)) {
            console.log(`Skipping welcome message for ${member.user.tag} (has no-welcome role)`);
            return;
        }

        // Send welcome message with button
        const welcomeButton = new ButtonBuilder()
            .setCustomId('welcome_gif')
            .setLabel('Send Welcome GIF! 🎉')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(welcomeButton);

        const welcomeChannel = member.guild.systemChannel;
        if (welcomeChannel) {
            await welcomeChannel.send({
                content: `Welcome ${member}! Tell us about your story on <#1294734902998208564>. Make sure to check out the <#1294074223224033383>, and get some roles: <#1412922277942792233> & <#1412923346609377430>\n<@&1332093729691144263>`,
                components: [row]
            });
            console.log(`Sent welcome message for ${member.user.tag}`);
        }
    } catch (error) {
        console.error('Error handling new member:', error);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const UNDERAGE_ROLE_ID = '1304923945757184152';

    try {
        // Check if the underage role was just added
        const hadRole = oldMember.roles.cache.has(UNDERAGE_ROLE_ID);
        const hasRole = newMember.roles.cache.has(UNDERAGE_ROLE_ID);

        if (!hadRole && hasRole) {
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