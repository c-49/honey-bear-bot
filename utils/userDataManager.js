const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'userData.json');

class UserDataManager {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const rawData = fs.readFileSync(DATA_FILE, 'utf8');
                return JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        return {};
    }

    saveData() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    getUserData(userId) {
        if (!this.data[userId]) {
            this.data[userId] = {};
        }
        return this.data[userId];
    }

    setUserProperty(userId, property, value) {
        const userData = this.getUserData(userId);
        userData[property] = value;
        this.saveData();
    }

    getUserProperty(userId, property) {
        const userData = this.getUserData(userId);
        return userData[property];
    }

    deleteUserProperty(userId, property) {
        const userData = this.getUserData(userId);
        if (property in userData) {
            delete userData[property];
            this.saveData();
            return true;
        }
        return false;
    }
}

module.exports = new UserDataManager();