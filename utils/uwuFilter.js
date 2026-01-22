/**
 * UWU Filter - Converts text to uwu speak
 */

function uwuify(text) {
    // Replace certain patterns with uwu equivalents
    let result = text;

    // Random chance to add stuttering
    result = result.replace(/\b(\w)/g, (match, letter) => {
        if (Math.random() < 0.15) {
            return letter + '-' + letter.toLowerCase();
        }
        return match;
    });

    // Replace common words with uwu versions
    const replacements = {
        'r': 'w',
        'l': 'w',
        'R': 'W',
        'L': 'W',
    };

    for (const [from, to] of Object.entries(replacements)) {
        result = result.split(from).join(to);
    }

    // Add uwu faces and actions at the end sometimes
    const uwuFaces = [
        '~ ✨',
        ' *nuzzles*',
        ' ^w^',
        ' owo',
        ' uwu',
        ' *licks lips*',
        ' *runs away*',
        ' nyaa~',
        ' *blushes*',
        ' *wiggles*',
        ' *pounces*',
        ' *notices bulge*',
        ' *sweats*',
        ' >//<',
        ' >:3',
        ' (´・ω・`)',
        ' *screams*',
        ' *dies*',
        ' *ascends*',
        ' *does a twirl*',
        ' *spins around*',
        ' *gasps*',
        ' *clutches chest*',
        ' *faints*',
        ' (๑•́ ω •̀๑)',
        ' (´◉ ◞౪◟ ◉`)',
        ' *hops*',
        ' *bounces*',
        ' (*´∇`*)',
        ' (´• ω •̥`)',
        ' ✧･ﾟ: *✧･ﾟ:*',
        ' *cries*',
        ' *purrs*',
        ' *mewls*',
        ' *yawns*',
        ' *stretches*',
        ' (´∀｀)♡',
        ' *tail wags*',
        ' *ears droop*',
        ' ♪♫•*¨*•.¸¸♪♫',
        ' *plays with hair*',
        ' *bites lip*',
        ' *fidgets nervously*',
        ' *looks away*',
        ' >/w/<',
        ' (´⌒`)',
        ' (´｀)',
        ' ♡w♡',
        ' o(*´∇`*)o',
        ' *whispers*',
        ' *giggles*',
        ' (๑´ლ`๑)',
        ' *tilts head*',
        ' *does a flip*',
        ' (´• ◞౪◟ •́ ` )',
        ' *vanishes*',
        ' (´╭╮`)',
        ' *makes eye contact*',
        ' (´・ω・`)و',
        ' *sweats intensely*'
    ];
    if (Math.random() < 0.4 && result.length > 0) {
        result += uwuFaces[Math.floor(Math.random() * uwuFaces.length)];
    }

    return result;
}

/**
 * Convert a message to uwu speak
 */
function convertToUwu(content) {
    if (!content || content.length === 0) return '';

    // Split by newlines to preserve some formatting
    const lines = content.split('\n');
    const uwuLines = lines.map(line => {
        if (line.trim().length === 0) return line;
        return uwuify(line);
    });

    return uwuLines.join('\n');
}

module.exports = {
    uwuify,
    convertToUwu
};
