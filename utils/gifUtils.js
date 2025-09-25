const fs = require('fs');
const path = require('path');

function getRandomGif(gifsFolder = './gifs') {
    try {
        const files = fs.readdirSync(gifsFolder);
        const gifFiles = files.filter(file =>
            file.toLowerCase().endsWith('.gif') ||
            file.toLowerCase().endsWith('.png') ||
            file.toLowerCase().endsWith('.jpg') ||
            file.toLowerCase().endsWith('.jpeg')
        );

        if (gifFiles.length === 0) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * gifFiles.length);
        return path.join(gifsFolder, gifFiles[randomIndex]);
    } catch (error) {
        console.error('Error reading gifs folder:', error);
        return null;
    }
}

module.exports = {
    getRandomGif
};