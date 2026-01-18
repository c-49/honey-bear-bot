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
}

module.exports = new UserDataManager();