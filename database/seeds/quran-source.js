/**
 * Parses the verbatim Tanzil source files in database/data/ into surah and
 * verse records. The Quran text is never typed or edited by hand here: every
 * character comes from quran-uthmani.txt.
 *
 * Source: Tanzil Project (https://tanzil.net) — Uthmani text v1.1, CC BY 3.0.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, '..', 'data');

const EXPECTED_SURAHS = 114;
const EXPECTED_VERSES = 6236;

// Per-verse recitation audio (everyayah.com), keyed by kids.preferred_reciter.
const RECITER_AUDIO_FOLDERS = {
    minshawi: 'Minshawy_Murattal_128kbps',
    abdulbasit: 'Abdul_Basit_Murattal_64kbps',
    maher: 'MaherAlMuaiqly128kbps'
};
const AUDIO_BASE_URL = 'https://everyayah.com/data';

const pad3 = (n) => String(n).padStart(3, '0');

function verseAudioUrl(reciter, surahNumber, verseNumber) {
    const folder = RECITER_AUDIO_FOLDERS[reciter] || RECITER_AUDIO_FOLDERS.minshawi;
    return `${AUDIO_BASE_URL}/${folder}/${pad3(surahNumber)}${pad3(verseNumber)}.mp3`;
}

function loadMetadata() {
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync(path.join(DATA_DIR, 'quran-data.js'), 'utf8'), sandbox);
    return sandbox.QuranData;
}

function juzOfVerse(juzStarts, surahNumber, verseNumber) {
    let juz = 1;
    for (let j = 1; j <= 30; j++) {
        const [s, a] = juzStarts[j];
        if (surahNumber > s || (surahNumber === s && verseNumber >= a)) juz = j;
    }
    return juz;
}

function loadQuran() {
    const meta = loadMetadata();
    const lines = fs.readFileSync(path.join(DATA_DIR, 'quran-uthmani.txt'), 'utf8').split('\n');

    const verses = [];
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        const match = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
        if (!match) continue;
        verses.push({
            surahNumber: Number(match[1]),
            verseNumber: Number(match[2]),
            text: match[3],
            bismillahPrefix: null
        });
    }

    // Tanzil prepends the basmala to verse 1 of every surah except Al-Fatiha
    // (where it IS verse 1) and At-Tawbah (which has none). It is not part of
    // that verse, and the per-verse audio does not include it, so it is moved
    // to its own field. prefix + ' ' + text reproduces the source line exactly.
    const basmalaWordCount = verses[0].text.split(' ').length;
    for (const verse of verses) {
        if (verse.verseNumber !== 1 || verse.surahNumber === 1 || verse.surahNumber === 9) continue;
        const words = verse.text.split(' ');
        const original = verse.text;
        verse.bismillahPrefix = words.slice(0, basmalaWordCount).join(' ');
        verse.text = words.slice(basmalaWordCount).join(' ');
        if (`${verse.bismillahPrefix} ${verse.text}` !== original || !verse.text) {
            throw new Error(`Basmala split is not lossless for surah ${verse.surahNumber}`);
        }
    }

    const surahs = [];
    for (let n = 1; n <= EXPECTED_SURAHS; n++) {
        const [, ayas, , , nameAr, nameEn, , type] = meta.Sura[n];
        surahs.push({
            surahNumber: n,
            nameAr,
            nameEn,
            versesCount: ayas,
            revelationType: type === 'Meccan' ? 'makki' : 'madani',
            juzNumber: juzOfVerse(meta.Juz, n, 1)
        });
    }

    // Integrity checks against Tanzil's own metadata
    if (verses.length !== EXPECTED_VERSES) {
        throw new Error(`Expected ${EXPECTED_VERSES} verses, parsed ${verses.length}`);
    }
    for (const surah of surahs) {
        const count = verses.filter(v => v.surahNumber === surah.surahNumber).length;
        if (count !== surah.versesCount) {
            throw new Error(`Surah ${surah.surahNumber}: expected ${surah.versesCount} verses, parsed ${count}`);
        }
    }

    return { surahs, verses };
}

module.exports = { loadQuran, verseAudioUrl, RECITER_AUDIO_FOLDERS };
