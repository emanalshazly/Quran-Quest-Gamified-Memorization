// Per-verse recitation audio from everyayah.com.
// Keep the folder names in sync with database/seeds/quran-source.js.
const AUDIO_BASE_URL = 'https://everyayah.com/data';

const RECITER_AUDIO_FOLDERS = {
  minshawi: 'Minshawy_Murattal_128kbps',
  abdulbasit: 'Abdul_Basit_Murattal_64kbps',
  maher: 'MaherAlMuaiqly128kbps',
};

const pad3 = (n) => String(n).padStart(3, '0');

export const getVerseAudioUrl = (reciter, surahNumber, verseNumber) => {
  const folder = RECITER_AUDIO_FOLDERS[reciter] || RECITER_AUDIO_FOLDERS.minshawi;
  return `${AUDIO_BASE_URL}/${folder}/${pad3(surahNumber)}${pad3(verseNumber)}.mp3`;
};
