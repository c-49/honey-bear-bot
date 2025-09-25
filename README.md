# Honey Bear Bot

A simple, expandable Discord bot with a modular command system.

## Features

- **Modular Command System**: Easy to add new commands
- **Random GIF Support**: `/bonk` command with random GIF selection
- **Simple Configuration**: Environment-based setup

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot credentials:
     ```
     DISCORD_TOKEN=your_bot_token_here
     CLIENT_ID=your_client_id_here
     GUILD_ID=your_guild_id_here
     ```

3. **Add GIFs**
   - Place your bonk GIFs in the `gifs/` folder
   - Supported formats: `.gif`, `.png`, `.jpg`, `.jpeg`

4. **Deploy Commands**
   ```bash
   node deploy-commands.js
   ```

5. **Start the Bot**
   ```bash
   npm start
   ```

## Commands

- `/bonk @user` - Bonk a user with a random GIF

## Adding New Commands

1. Create a new file in the `commands/` folder
2. Use this template:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),

    async execute(interaction) {
        // Your command logic here
        await interaction.reply('Response');
    },
};
```

3. Run `node deploy-commands.js` to register the new command
4. Restart the bot

## File Structure

```
honey-bear-bot/
├── commands/           # Slash commands
│   └── bonk.js        # Bonk command
├── utils/             # Utility functions
│   └── gifUtils.js    # GIF handling utilities
├── gifs/              # GIF storage folder
├── bot.js             # Main bot file
├── deploy-commands.js # Command deployment script
├── config.json        # Configuration file
└── package.json       # Dependencies
```