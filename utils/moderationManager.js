const { Pool } = require('pg');
const { DateTime } = require('luxon');

class ModerationManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Define escalation sequences for each severity
        this.escalationSequences = {
            green: ['warning', 'warning', 'mute', 'kick'],
            yellow: ['warning', 'warning', 'kick', 'ban'],
            red: ['warning', 'warning', 'ban']
        };
    }

    /**
     * Create a new moderation rule
     */
    async addRule(ruleName, description, severity, createdBy) {
        try {
            if (!['green', 'yellow', 'red'].includes(severity)) {
                throw new Error('Invalid severity. Must be green, yellow, or red.');
            }

            const result = await this.pool.query(
                `INSERT INTO moderation_rules (rule_name, description, severity, created_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (rule_name) DO NOTHING
                 RETURNING *`,
                [ruleName, description, severity, createdBy]
            );

            if (result.rows.length === 0) {
                throw new Error(`Rule "${ruleName}" already exists.`);
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error adding rule:', error);
            throw error;
        }
    }

    /**
     * Get a rule by name
     */
    async getRule(ruleName) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM moderation_rules WHERE rule_name = $1',
                [ruleName]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting rule:', error);
            return null;
        }
    }

    /**
     * Get all rules
     */
    async getAllRules() {
        try {
            const result = await this.pool.query(
                'SELECT * FROM moderation_rules ORDER BY severity DESC, rule_name ASC'
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting all rules:', error);
            return [];
        }
    }

    /**
     * Get rules by severity
     */
    async getRulesBySeverity(severity) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM moderation_rules WHERE severity = $1 ORDER BY rule_name ASC',
                [severity]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting rules by severity:', error);
            return [];
        }
    }

    /**
     * Add a warning to a user for a specific rule
     */
    async warnUser(userId, ruleId, ruleName, severity, warnedBy) {
        try {
            // Check if user already has a warning for this rule that hasn't expired
            const existingWarning = await this.getActiveWarning(userId, ruleId);

            // Calculate expiration based on severity
            let expiresAtDate;
            if (severity === 'green') {
                expiresAtDate = DateTime.now().plus({ days: 7 }).toJSDate();
            } else if (severity === 'yellow') {
                expiresAtDate = DateTime.now().plus({ days: 30 }).toJSDate();
            } else if (severity === 'red') {
                expiresAtDate = DateTime.now().plus({ months: 6 }).toJSDate();
            }

            if (existingWarning) {
                // Increment warning count
                const newCount = existingWarning.warning_count + 1;
                const result = await this.pool.query(
                    `UPDATE user_warnings
                     SET warning_count = $1, expires_at = $2
                     WHERE id = $3
                     RETURNING *`,
                    [newCount, expiresAtDate, existingWarning.id]
                );
                return result.rows[0];
            } else {
                // Create new warning with severity-based expiration
                const result = await this.pool.query(
                    `INSERT INTO user_warnings (user_id, rule_id, rule_name, severity, warning_count, warned_by, expires_at)
                     VALUES ($1, $2, $3, $4, 1, $5, $6)
                     RETURNING *`,
                    [userId, ruleId, ruleName, severity, warnedBy, expiresAtDate]
                );
                return result.rows[0];
            }
        } catch (error) {
            console.error('Error warning user:', error);
            throw error;
        }
    }

    /**
     * Get the active warning for a user on a specific rule
     */
    async getActiveWarning(userId, ruleId) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM user_warnings
                 WHERE user_id = $1 AND rule_id = $2 AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [userId, ruleId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting active warning:', error);
            return null;
        }
    }

    /**
     * Get all active warnings for a user for a specific severity level
     */
    async getUserWarningsBySeverity(userId, severity) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM user_warnings
                 WHERE user_id = $1 AND severity = $2 AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY created_at DESC`,
                [userId, severity]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting user warnings by severity:', error);
            return [];
        }
    }

    /**
     * Get all active warnings for a user
     */
    async getUserWarnings(userId) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM user_warnings
                 WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY severity DESC, created_at DESC`,
                [userId]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting user warnings:', error);
            return [];
        }
    }

    /**
     * Get the next action based on warning count and severity
     */
    getNextAction(severity, warningCount) {
        const sequence = this.escalationSequences[severity];
        if (!sequence) return null;

        if (warningCount > sequence.length) {
            return sequence[sequence.length - 1];
        }

        return sequence[warningCount - 1] || null;
    }

    /**
     * Clear all warnings for a user
     */
    async clearAllWarnings(userId, clearedBy) {
        try {
            const result = await this.pool.query(
                `UPDATE user_warnings
                 SET expires_at = NOW()
                 WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
                 RETURNING *`,
                [userId]
            );
            return result.rows;
        } catch (error) {
            console.error('Error clearing all warnings:', error);
            throw error;
        }
    }

    /**
     * Clear a specific warning for a user
     */
    async clearSpecificWarning(warningId, clearedBy) {
        try {
            const result = await this.pool.query(
                `UPDATE user_warnings
                 SET expires_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [warningId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error clearing specific warning:', error);
            throw error;
        }
    }

    /**
     * Format warnings for display
     */
    formatUserStatus(warnings) {
        if (warnings.length === 0) {
            return '✅ This user has no active warnings!';
        }

        let status = '⚠️ **User Warnings Status:**\n\n';

        // Group by severity
        const byRule = {};
        warnings.forEach(warning => {
            if (!byRule[warning.rule_name]) {
                byRule[warning.rule_name] = {
                    severity: warning.severity,
                    count: warning.warning_count,
                    created_at: warning.created_at,
                    expires_at: warning.expires_at
                };
            }
        });

        const severityOrder = { red: 0, yellow: 1, green: 2 };
        const sortedRules = Object.entries(byRule).sort((a, b) => {
            return severityOrder[a[1].severity] - severityOrder[b[1].severity];
        });

        sortedRules.forEach(([ruleName, data]) => {
            const emoji = data.severity === 'red' ? '🔴' : data.severity === 'yellow' ? '🟡' : '🟢';
            const expiresDate = new Date(data.expires_at);
            const expiresStr = expiresDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            status += `${emoji} **${ruleName}** (${data.severity.toUpperCase()})\n`;
            status += `   Warnings: ${data.count} | Expires: ${expiresStr}\n\n`;
        });

        return status;
    }

    /**
     * Get warning summary for a user
     */
    async getWarningSummary(userId) {
        try {
            const warnings = await this.getUserWarnings(userId);
            const summary = {
                total: warnings.length,
                byRule: {},
                nextActions: {}
            };

            for (const severity of ['red', 'yellow', 'green']) {
                const severityWarnings = warnings.filter(w => w.severity === severity);
                if (severityWarnings.length > 0) {
                    const totalCount = severityWarnings.reduce((sum, w) => sum + w.warning_count, 0);
                    summary.nextActions[severity] = this.getNextAction(severity, totalCount);
                }
            }

            warnings.forEach(warning => {
                if (!summary.byRule[warning.rule_name]) {
                    summary.byRule[warning.rule_name] = {
                        severity: warning.severity,
                        count: warning.warning_count,
                        created_at: warning.created_at,
                        expires_at: warning.expires_at
                    };
                }
            });

            return summary;
        } catch (error) {
            console.error('Error getting warning summary:', error);
            return { total: 0, byRule: {}, nextActions: {} };
        }
    }
}

module.exports = new ModerationManager();
