# Honey Bear Bot

A Discord bot with modular commands and no-contact streak tracking system.

## Features

- **Modular Command System**: Easy to add new commands
- **No-Contact Tracking**: Track and celebrate no-contact streaks with automatic milestone announcements
- **Daily Mood Tracker**: Log and visualize your emotional journey with analytics
- **Affirmation Sharing**: Post positive affirmations with community support threads
- **Random GIF Support**: `/bonk`, `/hug`, `/pet` commands with random GIF selection
- **PostgreSQL Database**: Persistent user data storage
- **Admin Tools**: Database management and user analytics
- **Automatic Milestone Celebrations**: Daily checks for achievements with channel announcements

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot credentials and database:
     ```
     DISCORD_TOKEN=your_bot_token_here
     CLIENT_ID=your_client_id_here
     GUILD_ID=your_guild_id_here
     DATABASE_URL=your_postgresql_connection_string
     NODE_ENV=production
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

### General Commands
- `/bonk @user` - Bonk a user with a random GIF
- `/hug @user` - Hug a user with a random GIF
- `/pet @user` - Pet a user with a random GIF

### Mood Tracking Commands
- `/mood [feeling] [note]` - Log your daily mood with an optional note
  - Feelings: struggling, difficult, managing, okay, good, great, healing, peaceful
  - Posts to the designated mood check-in channel for community support
  - Includes "💬 Reach Out" button to create support threads
- `/moodstats [period]` - View your mood analytics with visual charts
  - Periods: Last 7 days, Last 30 days, or All time
  - Shows mood distribution, trends, streaks, and statistics

### Affirmation Tracking
- `/affirmation [affirmation]` - Share a positive affirmation on your healing journey
  - Post your affirmations to inspire and encourage others
  - Automatically reacts with ✨ emoji
  - Includes "💬 Support" button to create support threads

### No-Contact Tracking Commands
- `/nocontact set [date]` - Set your no-contact start date (MM-DD-YYYY format, defaults to today)
- `/nocontact check` - Check your current no-contact streak
- `/nocontact reset` - Reset your no-contact record and start over

### Admin Commands (Administrator Permission Required)
- `/admindata list` - View all users with no-contact data, ranked by streak length
- `/admindata user @user` - View detailed data for a specific user
- `/admindata stats` - View database statistics and community overview

## No-Contact Milestones

The bot automatically celebrates these milestones with public announcements:
- 🎉 **1 Day** - First milestone reached!
- 🌟 **1 Week** - A full week strong!
- 🏆 **1 Month** - Incredible dedication!
- 💎 **3 Months** - Diamond strength!
- 🔥 **6 Months** - Half a year of growth!
- 👑 **1 Year** - Absolute legend!

Milestone announcements are automatically posted to a designated channel with clapping reactions for community celebration.

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
├── commands/              # Slash commands
│   ├── bonk.js           # Bonk command with random GIFs
│   ├── hug.js            # Hug command with random GIFs
│   ├── pet.js            # Pet command with random GIFs
│   ├── mood.js           # Daily mood tracking
│   ├── moodstats.js      # Mood analytics and visualization
│   ├── affirmation.js    # Affirmation sharing
│   ├── nocontact.js      # No-contact tracking system
│   └── admindata.js      # Admin database management
├── utils/                # Utility functions
│   ├── gifUtils.js       # GIF handling utilities
│   ├── userDataManager.js # PostgreSQL database manager
│   └── milestoneChecker.js # Automatic milestone detection
├── gifs/                 # GIF storage folder
│   ├── bonk/             # Bonk GIFs
│   ├── hug/              # Hug GIFs
│   ├── pet/              # Pet GIFs
│   └── welcome/          # Welcome GIFs
├── bot.js                # Main bot file with HTTP server
├── deploy-commands.js    # Command deployment script
├── config.json           # Configuration file
└── package.json          # Dependencies (includes pg, luxon)
```

## Database Schema

The bot uses PostgreSQL with these table structures:

```sql
CREATE TABLE user_data (
    user_id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE mood_entries (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    feeling VARCHAR(50) NOT NULL,
    note TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE affirmations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    affirmation TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**user_data table** stores JSONB with fields like:
- `noContactStartDate`: ISO date string
- `announcedMilestones`: Array of milestone days already celebrated

**mood_entries table** tracks:
- User's daily mood check-ins with optional notes
- Timestamp for trend analysis and streak calculation

**affirmations table** tracks:
- User's positive affirmations and thoughts
- Timestamp for tracking affirmation history

## Deployment

This bot is designed for deployment on platforms like Render.com:
- Includes HTTP server for port binding requirements
- PostgreSQL integration for persistent data
- Environment variable configuration
- Automatic database initialization