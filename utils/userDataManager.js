const { Pool } = require('pg');

class UserDataManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        this.initDatabase();
    }

    async initDatabase() {
        try {
            // Create the user_data table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_data (
                    user_id VARCHAR(255) PRIMARY KEY,
                    data JSONB NOT NULL DEFAULT '{}'
                )
            `);

            // Create the mood_entries table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS mood_entries (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    feeling VARCHAR(50) NOT NULL,
                    note TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for faster lookups by user_id and timestamp
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_mood_entries_user_timestamp
                ON mood_entries(user_id, timestamp DESC)
            `);

            // Create the affirmations table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS affirmations (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    affirmation TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for faster lookups by user_id and timestamp
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_affirmations_user_timestamp
                ON affirmations(user_id, timestamp DESC)
            `);

            // Create the wellness_checks table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS wellness_checks (
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
                )
            `);

            // Create index for faster lookups by status and reminder_time
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_wellness_checks_status_time
                ON wellness_checks(status, reminder_time)
            `);

            // Create index for user lookups
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_wellness_checks_user_id
                ON wellness_checks(user_id)
            `);

            // Create the moderation_rules table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS moderation_rules (
                    id SERIAL PRIMARY KEY,
                    rule_name VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    severity VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(255) NOT NULL
                )
            `);

            // Create the user_warnings table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_warnings (
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
                )
            `);

            // Create index for faster lookups
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_warnings_user_severity
                ON user_warnings(user_id, severity, expires_at)
            `);

            // Create index for rule lookups
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_moderation_rules_severity
                ON moderation_rules(severity)
            `);

            // Create the safety_plans table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS safety_plans (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) UNIQUE NOT NULL,
                    warning_signs TEXT,
                    self_soothing TEXT,
                    people_places TEXT,
                    emergency_supports TEXT,
                    reasons_to_stay TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for user lookups
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_safety_plans_user_id
                ON safety_plans(user_id)
            `);

            // Create the conversation_summaries table if it doesn't exist
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS conversation_summaries (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    summary TEXT NOT NULL,
                    key_topics TEXT,
                    message_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for faster lookups by user_id and timestamp
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_created
                ON conversation_summaries(user_id, created_at DESC)
            `);

            // Create the user_profiles table to store username and AI observations
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255),
                    ai_observations TEXT DEFAULT '',
                    first_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for username lookups
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_profiles_username
                ON user_profiles(username)
            `);

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    }

    async getUserData(userId) {
        try {
            const result = await this.pool.query(
                'SELECT data FROM user_data WHERE user_id = $1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                // Create new user record
                await this.pool.query(
                    'INSERT INTO user_data (user_id, data) VALUES ($1, $2)',
                    [userId, JSON.stringify({})]
                );
                return {};
            }
            
            return result.rows[0].data;
        } catch (error) {
            console.error('Error getting user data:', error);
            return {};
        }
    }

    async setUserProperty(userId, property, value) {
        try {
            const userData = await this.getUserData(userId);
            userData[property] = value;
            
            await this.pool.query(
                `INSERT INTO user_data (user_id, data) VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE SET data = $2`,
                [userId, JSON.stringify(userData)]
            );
        } catch (error) {
            console.error('Error setting user property:', error);
        }
    }

    async getUserProperty(userId, property) {
        try {
            const userData = await this.getUserData(userId);
            return userData[property];
        } catch (error) {
            console.error('Error getting user property:', error);
            return undefined;
        }
    }

    async deleteUserProperty(userId, property) {
        try {
            const userData = await this.getUserData(userId);
            if (property in userData) {
                delete userData[property];
                await this.pool.query(
                    'UPDATE user_data SET data = $1 WHERE user_id = $2',
                    [JSON.stringify(userData), userId]
                );
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting user property:', error);
            return false;
        }
    }

    async incrementGifStat(userId, statType) {
        try {
            const userData = await this.getUserData(userId);
            if (!userData.gifStats) {
                userData.gifStats = {};
            }
            if (!userData.gifStats[statType]) {
                userData.gifStats[statType] = 0;
            }
            userData.gifStats[statType]++;
            
            const result = await this.pool.query(
                `INSERT INTO user_data (user_id, data) VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE SET data = $2`,
                [userId, JSON.stringify(userData)]
            );
            console.log(`Incremented ${statType} for user ${userId}, new value: ${userData.gifStats[statType]}`);
        } catch (error) {
            console.error('Error incrementing gif stat:', error);
        }
    }

    async getGifStats(userId) {
        try {
            const userData = await this.getUserData(userId);
            return userData.gifStats || {};
        } catch (error) {
            console.error('Error getting gif stats:', error);
            return {};
        }
    }

    // Method to get all users (for milestone checker)
    async getAllUsers() {
        try {
            const result = await this.pool.query('SELECT user_id, data FROM user_data');
            const allUsers = {};
            result.rows.forEach(row => {
                allUsers[row.user_id] = row.data;
            });
            return allUsers;
        } catch (error) {
            console.error('Error getting all users:', error);
            return {};
        }
    }

    // For backward compatibility with milestone checker
    get data() {
        // This should be replaced with async calls, but keeping for now
        console.warn('Synchronous data access is deprecated. Use async methods instead.');
        return {};
    }

    // Mood tracking methods
    async saveMoodEntry(userId, feeling, note = null) {
        try {
            await this.pool.query(
                'INSERT INTO mood_entries (user_id, feeling, note) VALUES ($1, $2, $3)',
                [userId, feeling, note]
            );
            return true;
        } catch (error) {
            console.error('Error saving mood entry:', error);
            return false;
        }
    }

    async getUserMoodHistory(userId, limit = 30) {
        try {
            const result = await this.pool.query(
                'SELECT feeling, note, timestamp FROM mood_entries WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
                [userId, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting user mood history:', error);
            return [];
        }
    }

    async getRecentMoodEntries(limit = 50) {
        try {
            const result = await this.pool.query(
                'SELECT user_id, feeling, note, timestamp FROM mood_entries ORDER BY timestamp DESC LIMIT $1',
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting recent mood entries:', error);
            return [];
        }
    }

    // Affirmation tracking methods
    async saveAffirmation(userId, affirmation) {
        try {
            await this.pool.query(
                'INSERT INTO affirmations (user_id, affirmation) VALUES ($1, $2)',
                [userId, affirmation]
            );
            return true;
        } catch (error) {
            console.error('Error saving affirmation:', error);
            return false;
        }
    }

    async getUserAffirmations(userId, limit = 30) {
        try {
            const result = await this.pool.query(
                'SELECT affirmation, timestamp FROM affirmations WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
                [userId, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting user affirmations:', error);
            return [];
        }
    }

    async getRecentAffirmations(limit = 50) {
        try {
            const result = await this.pool.query(
                'SELECT user_id, affirmation, timestamp FROM affirmations ORDER BY timestamp DESC LIMIT $1',
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting recent affirmations:', error);
            return [];
        }
    }

    // Wellness checks methods
    async createWellnessCheck(checkId, userId, flaggedBy, messageId, note, autoDm, reminderTime) {
        try {
            const result = await this.pool.query(
                `INSERT INTO wellness_checks (check_id, user_id, flagged_by, message_id, note, auto_dm, reminder_time, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                 RETURNING *`,
                [checkId, userId, flaggedBy, messageId, note, autoDm, reminderTime]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error creating wellness check:', error);
            return null;
        }
    }

    async getWellnessCheck(checkId) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM wellness_checks WHERE check_id = $1',
                [checkId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting wellness check:', error);
            return null;
        }
    }

    async getPendingWellnessChecks() {
        try {
            const result = await this.pool.query(
                `SELECT * FROM wellness_checks 
                 WHERE status = 'pending' AND reminder_time <= NOW()
                 ORDER BY reminder_time ASC`
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting pending wellness checks:', error);
            return [];
        }
    }

    async getActiveWellnessChecks(userId) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM wellness_checks 
                 WHERE user_id = $1 AND status = 'pending'
                 ORDER BY created_at DESC`,
                [userId]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting active wellness checks:', error);
            return [];
        }
    }

    async updateWellnessCheckResponse(checkId, userResponded, responseText = null) {
        try {
            const result = await this.pool.query(
                `UPDATE wellness_checks 
                 SET user_responded = $2, response_text = $3, resolved_at = NOW(), status = 'done'
                 WHERE check_id = $1
                 RETURNING *`,
                [checkId, userResponded, responseText]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error updating wellness check response:', error);
            return null;
        }
    }

    async resolveWellnessCheck(checkId, resolvedBy, reason = 'manual') {
        try {
            console.log(`Resolving wellness check: ${checkId} by ${resolvedBy}`);
            const result = await this.pool.query(
                `UPDATE wellness_checks 
                 SET status = 'done', resolved_at = NOW(), resolved_by = $2
                 WHERE check_id = $1
                 RETURNING *`,
                [checkId, resolvedBy]
            );
            console.log(`Wellness check update result:`, result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('Error resolving wellness check:', error);
            return null;
        }
    }

    async markDMsDisabled(checkId) {
        try {
            const result = await this.pool.query(
                `UPDATE wellness_checks 
                 SET dms_disabled = true, status = 'dms_disabled'
                 WHERE check_id = $1
                 RETURNING *`,
                [checkId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error marking DMs disabled:', error);
            return null;
        }
    }

    async getWellnessChecksByUser(userId) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM wellness_checks 
                 WHERE user_id = $1
                 ORDER BY created_at DESC`,
                [userId]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting wellness checks by user:', error);
            return [];
        }
    }

    async updateReminderSent(checkId) {
        try {
            const result = await this.pool.query(
                `UPDATE wellness_checks 
                 SET status = 'reminder_sent'
                 WHERE check_id = $1
                 RETURNING *`,
                [checkId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error updating reminder sent status:', error);
            return null;
        }
    }

    // UWU lock methods
    async setUwuLocked(userId, locked = true) {
        try {
            await this.setUserProperty(userId, 'uwuLocked', locked);
            return true;
        } catch (error) {
            console.error('Error setting uwu locked status:', error);
            return false;
        }
    }

    async isUwuLocked(userId) {
        try {
            const userData = await this.getUserData(userId);
            return userData.uwuLocked === true;
        } catch (error) {
            console.error('Error checking uwu locked status:', error);
            return false;
        }
    }

    async toggleUwuLock(userId) {
        try {
            const isLocked = await this.isUwuLocked(userId);
            await this.setUwuLocked(userId, !isLocked);
            return !isLocked;
        } catch (error) {
            console.error('Error toggling uwu lock:', error);
            return null;
        }
    }

    // Safety plan methods
    async saveSafetyPlan(userId, planData) {
        try {
            const result = await this.pool.query(
                `INSERT INTO safety_plans (user_id, warning_signs, self_soothing, people_places, emergency_supports, reasons_to_stay, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET 
                    warning_signs = $2,
                    self_soothing = $3,
                    people_places = $4,
                    emergency_supports = $5,
                    reasons_to_stay = $6,
                    updated_at = NOW()
                 RETURNING *`,
                [userId, planData.warningSigns || '', planData.selfSoothing || '', 
                 planData.peoplePlaces || '', planData.emergencySupports || '', 
                 planData.reasonsToStay || '']
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error saving safety plan:', error);
            return null;
        }
    }

    async getSafetyPlan(userId) {
        try {
            const result = await this.pool.query(
                'SELECT warning_signs, self_soothing, people_places, emergency_supports, reasons_to_stay, updated_at FROM safety_plans WHERE user_id = $1',
                [userId]
            );
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                warningSigns: row.warning_signs,
                selfSoothing: row.self_soothing,
                peoplePlaces: row.people_places,
                emergencySupports: row.emergency_supports,
                reasonsToStay: row.reasons_to_stay,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Error getting safety plan:', error);
            return null;
        }
    }

    // Conversation summary methods
    async saveSummary(userId, summary, keyTopics = null, messageCount = 0) {
        try {
            await this.pool.query(
                `INSERT INTO conversation_summaries (user_id, summary, key_topics, message_count)
                 VALUES ($1, $2, $3, $4)`,
                [userId, summary, keyTopics, messageCount]
            );
            
            // Cleanup: keep only last 10 summaries per user
            await this.cleanupOldSummaries(userId, 10);
            return true;
        } catch (error) {
            console.error('Error saving summary:', error);
            return false;
        }
    }

    async getSummaries(userId, limit = 10) {
        try {
            const result = await this.pool.query(
                `SELECT id, summary, key_topics, message_count, created_at 
                 FROM conversation_summaries 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting summaries:', error);
            return [];
        }
    }

    async getRecentSummary(userId) {
        try {
            const result = await this.pool.query(
                `SELECT id, summary, key_topics, message_count, created_at 
                 FROM conversation_summaries 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting recent summary:', error);
            return null;
        }
    }

    async cleanupOldSummaries(userId, maxKeep = 10) {
        try {
            // Get all summaries for user, ordered by date
            const allSummaries = await this.pool.query(
                `SELECT id FROM conversation_summaries 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );

            // If we have more than maxKeep, delete the oldest ones
            if (allSummaries.rows.length > maxKeep) {
                const toDelete = allSummaries.rows.slice(maxKeep).map(row => row.id);
                const placeholders = toDelete.map((_, i) => `$${i + 1}`).join(',');
                
                await this.pool.query(
                    `DELETE FROM conversation_summaries WHERE id IN (${placeholders})`,
                    toDelete
                );
            }
        } catch (error) {
            console.error('Error cleaning up old summaries:', error);
        }
    }

    async getSummaryStats(userId) {
        try {
            const result = await this.pool.query(
                `SELECT COUNT(*) as count, SUM(message_count) as total_messages
                 FROM conversation_summaries
                 WHERE user_id = $1`,
                [userId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error getting summary stats:', error);
            return { count: 0, total_messages: 0 };
        }
    }

    // Hidden reputation methods — internal only, never exposed to users
    async getReputation(userId) {
        try {
            const userData = await this.getUserData(userId);
            return typeof userData._reputation === 'number' ? userData._reputation : 0;
        } catch (error) {
            console.error('Error getting reputation:', error);
            return 0;
        }
    }

    async updateReputation(userId, delta) {
        try {
            const current = await this.getReputation(userId);
            const updated = Math.max(-5, Math.min(5, parseFloat((current + delta).toFixed(2))));
            await this.setUserProperty(userId, '_reputation', updated);
            return updated;
        } catch (error) {
            console.error('Error updating reputation:', error);
            return 0;
        }
    }

    // ============= USER PROFILE METHODS =============
    // These ensure single user entries with consolidated data

    /**
     * Save or update user profile with username
     * @param {string} userId - Discord user ID
     * @param {string} username - Discord username
     */
    async saveUserProfile(userId, username) {
        try {
            await this.pool.query(
                `INSERT INTO user_profiles (user_id, username, first_interaction, last_interaction)
                 VALUES ($1, $2, NOW(), NOW())
                 ON CONFLICT (user_id) DO UPDATE SET 
                    username = $2,
                    last_interaction = NOW()`,
                [userId, username]
            );
            return true;
        } catch (error) {
            console.error('Error saving user profile:', error);
            return false;
        }
    }

    /**
     * Get user profile (username, AI observations)
     * @param {string} userId - Discord user ID
     * @returns {Promise<Object>} Profile object or null
     */
    async getUserProfile(userId) {
        try {
            const result = await this.pool.query(
                `SELECT user_id, username, ai_observations, first_interaction, last_interaction, updated_at
                 FROM user_profiles 
                 WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    /**
     * Update or append AI observations about a user
     * @param {string} userId - Discord user ID
     * @param {string} observation - New observation/thought about the user
     * @param {boolean} append - Whether to append (true) or replace (false)
     */
    async updateAIObservations(userId, observation, append = true) {
        try {
            let newObservations = observation;
            
            if (append) {
                const profile = await this.getUserProfile(userId);
                if (profile && profile.ai_observations) {
                    // Append with timestamp if appending
                    const timestamp = new Date().toISOString().split('T')[0];
                    newObservations = profile.ai_observations + `\n[${timestamp}] ${observation}`;
                }
            }

            await this.pool.query(
                `INSERT INTO user_profiles (user_id, ai_observations, last_interaction)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET 
                    ai_observations = $2,
                    updated_at = NOW()`,
                [userId, newObservations]
            );
            
            return true;
        } catch (error) {
            console.error('Error updating AI observations:', error);
            return false;
        }
    }

    /**
     * Get AI observations about a user (for passing context to AI)
     * @param {string} userId - Discord user ID
     * @returns {Promise<string>} AI observations or empty string
     */
    async getAIObservations(userId) {
        try {
            const profile = await this.getUserProfile(userId);
            return profile && profile.ai_observations ? profile.ai_observations : '';
        } catch (error) {
            console.error('Error getting AI observations:', error);
            return '';
        }
    }

    /**
     * Look up a user by username (for @mention parsing)
     * @param {string} username - Username to search for
     * @returns {Promise<Object>} User profile or null
     */
    async lookupUserByUsername(username) {
        try {
            // Discord usernames are case-insensitive
            const result = await this.pool.query(
                `SELECT user_id, username, ai_observations, first_interaction, last_interaction
                 FROM user_profiles 
                 WHERE LOWER(username) = LOWER($1)
                 LIMIT 1`,
                [username]
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error looking up user by username:', error);
            return null;
        }
    }

    /**
     * Find mentioned users in a message and retrieve their summaries
     * Looks for patterns like @username or <@user_id>
     * @param {string} message - Message content
     * @param {Array} mentionedUserIds - Discord API mentioned user IDs
     * @returns {Promise<Array>} Array of mentioned user info with summaries
     */
    async findMentionedUsers(message, mentionedUserIds = []) {
        try {
            if (!message || typeof message !== 'string') {
                console.warn('findMentionedUsers: Invalid message format');
                return [];
            }

            const mentionedUsers = [];

            // First, handle Discord's built-in mentions (IDs)
            if (Array.isArray(mentionedUserIds)) {
                for (const userId of mentionedUserIds) {
                    try {
                        const profile = await this.getUserProfile(userId);
                        if (profile) {
                            const summaries = await this.getSummaries(userId, 2); // Get recent summaries
                            const observations = await this.getAIObservations(userId);
                            
                            mentionedUsers.push({
                                userId,
                                username: profile.username,
                                observations,
                                recentSummaries: summaries,
                                firstInteraction: profile.first_interaction
                            });
                        }
                    } catch (err) {
                        console.error(`Error processing mentioned user ${userId}:`, err.message);
                        // Continue with next user
                    }
                }
            }

            // Parse text for @username mentions (case-insensitive)
            const atMentionRegex = /@([\w]+)/g;
            let match;
            const processedUsernames = new Set(); // Avoid duplicates

            while ((match = atMentionRegex.exec(message)) !== null) {
                try {
                    const username = match[1];
                    
                    // Skip if already processed
                    if (processedUsernames.has(username.toLowerCase())) {
                        continue;
                    }

                    const profile = await this.lookupUserByUsername(username);
                    if (profile) {
                        processedUsernames.add(username.toLowerCase());
                        
                        const summaries = await this.getSummaries(profile.user_id, 2);
                        const observations = profile.ai_observations;
                        
                        mentionedUsers.push({
                            userId: profile.user_id,
                            username: profile.username,
                            observations,
                            recentSummaries: summaries,
                            firstInteraction: profile.first_interaction
                        });
                    }
                } catch (err) {
                    console.error(`Error processing @mention ${match[1]}:`, err.message);
                    // Continue with next mention
                }
            }

            return mentionedUsers;
        } catch (error) {
            console.error('Error finding mentioned users:', error.message);
            return [];
        }
    }

    /**
     * Get a summary card for a mentioned user (for AI context)
     * @param {Object} mentionedUser - User object from findMentionedUsers
     * @returns {string} Formatted summary for AI context
     */
    buildMentionedUserSummary(mentionedUser) {
        if (!mentionedUser) return '';

        let summary = `\n**@${mentionedUser.username}**:`;

        if (mentionedUser.observations) {
            summary += `\n - AI Notes: ${mentionedUser.observations.substring(0, 150)}...`;
        }

        if (mentionedUser.recentSummaries && mentionedUser.recentSummaries.length > 0) {
            summary += '\n - Recent: ' + mentionedUser.recentSummaries
                .map(s => s.summary)
                .join('; ')
                .substring(0, 100);
        }

        return summary;
    }
}

module.exports = new UserDataManager();