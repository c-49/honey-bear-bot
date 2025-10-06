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
}

module.exports = new UserDataManager();