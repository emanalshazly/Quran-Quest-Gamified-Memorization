#!/usr/bin/env node
/**
 * Generates database/seeds/002_quran_data.sql from the Tanzil source files.
 *
 *   node database/seeds/generate-quran-seed.js
 *
 * The output is idempotent: it can be run more than once on the same database.
 */
const fs = require('fs');
const path = require('path');
const { loadQuran, verseAudioUrl } = require('./quran-source');

const OUTPUT = path.join(__dirname, '002_quran_data.sql');
const VERSES_PER_STATEMENT = 500;

const sql = (value) => (value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);

const { surahs, verses } = loadQuran();
const out = [];

out.push(`-- Quran Quest: full Quran text (${surahs.length} surahs, ${verses.length} verses)
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   node database/seeds/generate-quran-seed.js
--
-- Run AFTER 001_initial_schema.sql. Safe to run more than once.
--
-- ====================================================================
--  Quran text: Tanzil Quran Text (Uthmani, Version 1.1)
--  Copyright (C) 2007-2026 Tanzil Project — https://tanzil.net
--  License: Creative Commons Attribution 3.0
--
--  This copy of the Quran text is carefully produced, highly verified
--  and continuously monitored by a group of specialists at Tanzil Project.
--
--  TERMS OF USE:
--  - Permission is granted to copy and distribute verbatim copies of
--    this text, but CHANGING IT IS NOT ALLOWED.
--  - This Quran text can be used in any website or application, provided
--    that its source (Tanzil Project) is clearly indicated, and a link is
--    made to tanzil.net to enable users to keep track of changes.
--  - This copyright notice shall be included in all verbatim copies of
--    the text, and shall be reproduced appropriately in all files derived
--    from or containing substantial portion of this text.
--
--  Please check updates at: http://tanzil.net/updates/
-- ====================================================================
--
-- The basmala that Tanzil prepends to verse 1 of each surah (except 1 and 9)
-- is stored unchanged in verses.bismillah_prefix instead of inside text_ar,
-- so verse text matches verse numbering and the per-verse audio.
--
-- Verse audio: everyayah.com (default reciter: Al-Minshawi, murattal).

BEGIN;

ALTER TABLE verses ADD COLUMN IF NOT EXISTS bismillah_prefix TEXT;
`);

out.push(`-- Surahs (existing rows keep their name_en, virtue text and is_free flag)
INSERT INTO surahs (surah_number, name_ar, name_en, verses_count, revelation_type, juz_number) VALUES`);
out.push(
    surahs
        .map(s => `(${s.surahNumber}, ${sql(s.nameAr)}, ${sql(s.nameEn)}, ${s.versesCount}, ${sql(s.revelationType)}, ${s.juzNumber})`)
        .join(',\n')
);
out.push(`ON CONFLICT (surah_number) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    verses_count = EXCLUDED.verses_count,
    revelation_type = EXCLUDED.revelation_type,
    juz_number = EXCLUDED.juz_number;
`);

for (let i = 0; i < verses.length; i += VERSES_PER_STATEMENT) {
    const chunk = verses.slice(i, i + VERSES_PER_STATEMENT);
    out.push(`INSERT INTO verses (surah_id, verse_number, text_ar, bismillah_prefix, audio_url)
SELECT s.id, v.verse_number, v.text_ar, v.bismillah_prefix, v.audio_url
FROM (VALUES`);
    out.push(
        chunk
            .map(v => `(${v.surahNumber}, ${v.verseNumber}, ${sql(v.text)}, ${sql(v.bismillahPrefix)}, ${sql(verseAudioUrl('minshawi', v.surahNumber, v.verseNumber))})`)
            .join(',\n')
    );
    out.push(`) AS v(surah_number, verse_number, text_ar, bismillah_prefix, audio_url)
JOIN surahs s ON s.surah_number = v.surah_number
ON CONFLICT (surah_id, verse_number) DO UPDATE SET
    text_ar = EXCLUDED.text_ar,
    bismillah_prefix = EXCLUDED.bismillah_prefix,
    audio_url = EXCLUDED.audio_url;
`);
}

out.push('COMMIT;\n');

fs.writeFileSync(OUTPUT, out.join('\n'));
console.log(`Wrote ${OUTPUT}: ${surahs.length} surahs, ${verses.length} verses`);
