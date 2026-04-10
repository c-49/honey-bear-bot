# Honey Bear Bot

A Discord bot with modular commands and no-contact streak tracking system.

## Features

- **Modular Command System**: Easy to add new commands
- **No-Contact Tracking**: Track and celebrate no-contact streaks with automatic milestone announcements using an interactive dropdown date picker (supports all date formats - no format confusion!)
- **Daily Mood Tracker**: Log and visualize your emotional journey with analytics
- **Affirmation Sharing**: Post positive affirmations with community support threads
- **Personal Safety Plans**: Create fillable safety plans with emergency contacts and coping strategies
- **Random GIF Support**: `/bite`, `/bonk`, `/hug`, `/pet`, `/uppies` commands with random GIF selection
- **UWU Lock System**: A fun punishment feature that converts locked users' messages to cringe uwu speak 💜
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

4. **Pre-Resize GIFs (Optional but Recommended)**
   
   The bot includes a smart GIF caching system to avoid interaction timeouts during resizing. GIFs are cached in `gifs/resized/<WIDTH>x<HEIGHT>/` directories based on your `config.json` settings (default: 100x100).
   
   To pre-warm the cache and ensure instant GIF responses:
   
   - Install gifsicle (recommended for speed and quality):
     ```bash
     sudo apt-get update
     sudo apt-get install -y gifsicle
     ```
     Or ImageMagick's `convert` as a fallback:
     ```bash
     sudo apt-get install -y imagemagick
     ```
   
   - Run the pre-resize script:
     ```bash
     node scripts/preresize-gifs.js
     ```
   
   This will batch-resize all GIFs in `gifs/*/` to the configured size and save them to the cache directory. Subsequent bot commands will use cached GIFs for instant responses.
   
   If you skip this step, the bot will still work—GIFs will be resized on first request (falling back to original while generation happens in background).

5. **Deploy Commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the Bot**
   ```bash
   npm start
   ```

## Commands

### General Commands
- `/bite @user` - Bite a user with a random GIF
- `/bonk @user` - Bonk a user with a random GIF
- `/hug @user` - Hug a user with a random GIF
- `/pet @user` - Pet a user with a random GIF
- `/uppies @user` - Give a user uppies with a random GIF

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
- `/affirmationstats [period]` - View your affirmation tracking statistics
  - Periods: Last 7 days, Last 30 days, or All time
  - Shows total affirmations, current streak, and recent affirmations

### UWU Lock Commands (Moderators Only)
- `/uwulock @user` - UWU lock a user as a funny punishment! 🔒
  - Moderators can lock a user, preventing them from already being locked
  - All messages from locked users are automatically converted to uwu speak
  - Original message is deleted and replaced with a reply containing the uwu-ified version
  - Locked user receives a DM notification about their new status
  - Locked users see an interactive unlock button in the mod's message

**UWU Lock Features:**
- **Automatic Conversion**: All messages are converted to uwu speak with:
  - R/L → W conversion (e.g., "hello" → "hewwo")
  - Random stuttering effects (e.g., "s-s-sure")
  - 60+ cringe anime faces and actions (e.g., `*nuzzles*`, `*licks lips*`, `*notices bulge*`, `nyaa~`, etc.)
- **Non-Disruptive**: Original messages are deleted and replaced with replies, keeping chat flowing naturally
- **Unlock Options**:
  - Locked users can click their own "Unlock me! 🔓" button to free themselves
  - Moderators can unlock users at any time using the same button
  - Lock status persists in the database until unlocked
- **Database Tracking**: UWU lock status is stored per user for persistence across sessions

**Example UWU Conversions:**
- "hello my friend" → "hewwo my fwiend ~ ✨"
- "I really like this" → "I weawwy wike this *blushes*"
- "what's up" → "w-w-what's up (´・ω・`)"

### No-Contact Tracking Commands
- `/nocontact set` - Set your no-contact start date using interactive dropdowns
  - Select year, month, and day in sequence
  - Supports dates from 5 years ago to current year
  - Defaults to today if not set
- `/nocontact check` - Check your current no-contact streak
- `/nocontact reset` - Reset your no-contact record and start over

### Wellness Check-In Commands (Moderators Only)
- `/check [msg] [user] [autodm] [time] [customdate] [note]` - Flag a user or message for a wellness check
  - **msg**: Message ID or Discord link (optional, if not using user parameter)
  - **user**: User to check on (optional, if not using msg parameter)
  - **autodm**: Enable/disable automatic DM wellness check (true/false, required)
  - **time**: When to check or remind (1h, 3h, 6h, 24h, or custom)
  - **customdate**: Custom date for check (format: YYYY-MM-DD or YYYY-MM-DD HH:mm, only if time is "custom")
  - **note**: Optional note explaining why the wellness check is needed

**Wellness Check Features:**
- **Auto-DM Mode**: Bot DMs the user to check in, monitors for response hourly for 24 hours
  - If user responds to DM, check auto-resolves with green confirmation
  - If DMs are disabled, mod chat is notified
  - If 24 hours pass with no response, red timeout notification sent to mod chat
- **Reminder Mode**: At specified time, sends single reminder to mod chat
  - Mods can manually resolve with "Mark Resolved" button
- **User Response Tracking**: Automatically resolves check when user responds
- **Message Reference**: Can flag from specific messages to document concerns
- **Persistent Storage**: All checks logged for historical record and auditing

### Safety Plan Commands
- `/safetyplan [user]` - Create or update your personal safety plan
  - **user**: User to create/edit plan for (Mods/Admins only, optional)
  - Presents a modal with 5 fillable sections:
    - 🧠 **Warning Signs** (thoughts, feelings, situations that trigger you)
    - 💚 **Soothing Actions** (things that help you feel better)
    - 🤝 **Support Network** (trusted friends, safe places, online spaces)
    - 📞 **Emergency Support** (crisis lines, trusted contacts, resources)
    - 🌱 **Reasons to Live** (things you care about, goals, important people)
  - Plan is saved to database and automatically DMed to you for reference
  - Users can have only one active plan (new ones replace old ones)
  - Mods and admins can create/edit plans for other users to help them fill it out

- `/viewplan [user]` - View your safety plan or another user's (Mods/Admins only)
  - **user**: User to view plan for (optional, defaults to your own)
  - Displays the saved safety plan in an embed for easy reference
  - Users can only view their own plans
  - Mods and admins can view any user's plan
  - Shows when the plan was last updated

**Safety Plan Features:**
- **Multi-Section Coverage**: All 5 critical areas of a comprehensive safety plan
- **Auto-DM Reference**: Automatically sends you a copy via DM immediately after creation
- **Mod Assistance**: Moderators can help users fill out safety plans together
- **Persistent Storage**: Plans are saved to PostgreSQL for always-available reference
- **Easy Updates**: Simply re-run `/safetyplan` to update any section

### Moderation Commands

#### Admin Commands (Admin Role: 1368995164470902967)
- `/addrule [name] [description] [severity]` - Create a new moderation rule
  - **severity**: Green (minor), Yellow (medium), or Red (major)
  - Rule names must be unique
  - Only admins can add rules
- `/clearwarning @user [type] [rule]` - Clear warnings for a user
  - **type**: "Clear All" (remove all warnings) or "Clear Specific" (remove one rule's warning)
  - Warnings are tracked per rule/severity level
- `/userstatus @user` - View a user's complete moderation record (public)
  - Shows all active warnings with expiration dates
  - Displays next escalation action for each violation type

#### Moderator Commands (Mod Role: 1294078699687247882)
- `/warn @user [rule]` - Warn a user for breaking a rule
  - Uses autocomplete for easy rule selection
  - Tracks warnings per rule (not cumulative across rules)
  - Sends notification to warned user
  - Shows next escalation action
  - Warnings expire based on severity:
    - 🟢 Green: 7 days
    - 🟡 Yellow: 30 days
    - 🔴 Red: 6 months
  - **Restrictions**: Mods cannot warn other mods, admins, or themselves
  - **Restrictions**: Admins can warn mods, but not other admins or themselves

**Warning Escalation System:**
- 🟢 **Green (Minor)**: warning → warning → mute → kick (expires in 7 days)
- 🟡 **Yellow (Medium)**: warning → warning → kick → ban (expires in 30 days)
- 🔴 **Red (Major)**: warning → warning → ban (expires in 6 months)

Each user's warning count is tracked individually per rule. When a user accumulates warnings for the same rule, the escalation sequence progresses. Warnings automatically expire based on severity level.

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
│   ├── affirmationstats.js # Affirmation analytics
│   ├── nocontact.js      # No-contact tracking system
│   ├── check.js          # Wellness check-in command
│   ├── safetyplan.js     # Personal safety plan creation
│   ├── viewplan.js       # View safety plans
│   ├── addrule.js        # Add moderation rules (admin)
│   ├── warn.js           # Warn users for rule violations (mods)
│   ├── clearwarning.js   # Clear user warnings (admin)
│   ├── userstatus.js     # View user moderation status (admin)
│   └── admindata.js      # Admin database management
├── utils/                # Utility functions
│   ├── gifUtils.js       # GIF handling utilities
│   ├── userDataManager.js # PostgreSQL database manager
│   ├── moderationManager.js # Moderation system manager
│   ├── milestoneChecker.js # Automatic milestone detection
│   └── wellnessCheckManager.js # Wellness check monitoring
├── gifs/                 # GIF storage folder
│   ├── bonk/             # Bonk GIFs
│   ├── hug/              # Hug GIFs
│   ├── pet/              # Pet GIFs
│   └── welcome/          # Welcome GIFs
├── bot.js                # Main bot file with HTTP server
├── deploy-commands.js    # Command deployment script
├── config.json           # Configuration file
└── package.json          # Dependencies (includes pg, luxon, uuid)
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

CREATE TABLE wellness_checks (
    id SERIAL PRIMARY KEY,
    check_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    flagged_by VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    note TEXT,
    auto_dm BOOLEAN NOT NULL DEFAULT false,
    reminder_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    user_responded BOOLEAN DEFAULT false,
    response_text TEXT,
    dms_disabled BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE moderation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
);

CREATE TABLE user_warnings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    rule_id INTEGER NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(10) NOT NULL,
    warning_count INTEGER NOT NULL DEFAULT 1,
    warned_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES moderation_rules(id)
);

CREATE TABLE safety_plans (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    warning_signs TEXT,
    self_soothing TEXT,
    people_places TEXT,
    emergency_supports TEXT,
    reasons_to_stay TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

**wellness_checks table** tracks:
- Flagged user wellness checks with unique check IDs
- Auto-DM vs reminder mode configuration
- Response tracking and resolution status
- DM delivery failures for users with disabled DMs
- Historical record of all wellness check interactions

**safety_plans table** tracks:
- User's personal safety plans with 5 sections
- Warning signs, self-soothing actions, support networks, emergency resources, and reasons to stay grounded
- Creation and update timestamps for reference
- One plan per user (replaces older versions)

## Deployment

This bot is designed for deployment on platforms like Render.com:
- Includes HTTP server for port binding requirements
- PostgreSQL integration for persistent data
- Environment variable configuration
- Automatic database initialization