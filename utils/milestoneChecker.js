const { DateTime } = require('luxon');
const userDataManager = require('./userDataManager');

const MILESTONE_CHANNEL_ID = '1420968791470506125';

class MilestoneChecker {
    constructor(client) {
        this.client = client;
        this.milestones = [
            { days: 1, emoji: '🎉', message: 'has completed **1 full day** of no-contact! First milestone reached!' },
            { days: 7, emoji: '🌟', message: 'has completed **1 week** of no-contact! A full week strong!' },
            { days: 30, emoji: '🏆', message: 'has completed **1 month** of no-contact! Incredible dedication!' },
            { days: 90, emoji: '💎', message: 'has completed **3 months** of no-contact! Diamond strength!' },
            { days: 180, emoji: '🔥', message: 'has completed **6 months** of no-contact! Half a year of growth!' },
            { days: 365, emoji: '👑', message: 'has completed **1 FULL YEAR** of no-contact! Absolute legend!' }
        ];
    }

    startDailyCheck() {
        // Check immediately on startup
        this.checkAllUsers();

        // Then check every 24 hours (86400000 ms)
        setInterval(() => {
            this.checkAllUsers();
        }, 86400000);

        console.log('Milestone checker started - checking every 24 hours');
    }

    async checkAllUsers() {
        try {
            const allUserData = await userDataManager.getAllUsers();
            const currentDate = DateTime.now().setZone('America/New_York');

            for (const [userId, userData] of Object.entries(allUserData)) {
                if (userData.noContactStartDate) {
                    await this.checkUserMilestones(userId, userData, currentDate);
                }
            }
        } catch (error) {
            console.error('Error checking milestones:', error);
        }
    }

    async checkUserMilestones(userId, userData, currentDate) {
        try {
            const startDate = DateTime.fromISO(userData.noContactStartDate, { zone: 'America/New_York' });
            const daysDiff = Math.floor(currentDate.diff(startDate, 'days').days);

            if (daysDiff < 0) return; // Future start date

            const milestone = this.milestones.find(m => m.days === daysDiff);
            if (!milestone) return; // Not a milestone day

            const announcedMilestones = userData.announcedMilestones || [];
            if (announcedMilestones.includes(daysDiff)) return; // Already announced

            // Get user object
            const user = await this.client.users.fetch(userId).catch(() => null);
            if (!user) return;

            // Send milestone announcement
            await this.sendMilestoneAnnouncement(user, milestone, daysDiff);

            // Track that this milestone was announced
            announcedMilestones.push(daysDiff);
            await userDataManager.setUserProperty(userId, 'announcedMilestones', announcedMilestones);

            console.log(`Milestone announced for ${user.tag}: ${daysDiff} days`);
        } catch (error) {
            console.error(`Error checking milestones for user ${userId}:`, error);
        }
    }

    async sendMilestoneAnnouncement(user, milestone, days) {
        try {
            const channel = await this.client.channels.fetch(MILESTONE_CHANNEL_ID);
            if (!channel) {
                console.error('Milestone channel not found');
                return;
            }

            const announcementMessage = await channel.send({
                content: `${milestone.emoji} **MILESTONE CELEBRATION!** ${milestone.emoji}\n\n${user} ${milestone.message}\n\nLet's celebrate this amazing achievement! 👏`
            });

            // Add clapping hands reaction
            await announcementMessage.react('👏');
        } catch (error) {
            console.error('Error sending milestone announcement:', error);
        }
    }
}

module.exports = MilestoneChecker;