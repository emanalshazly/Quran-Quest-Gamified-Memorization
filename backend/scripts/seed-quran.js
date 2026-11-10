#!/usr/bin/env node
/**
 * Loads the full Quran (114 surahs, 6236 verses) into Supabase through the
 * API — an alternative to pasting database/seeds/002_quran_data.sql into the
 * SQL editor, which can reject a file of that size.
 *
 *   cd backend && npm run seed:quran
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env, and
 * 001_initial_schema.sql already applied. Safe to run more than once.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { loadQuran, verseAudioUrl } = require('../../database/seeds/quran-source');

const BATCH_SIZE = 500;

async function main() {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });
    const { surahs, verses } = loadQuran();

    // Surahs: insert missing ones; on existing rows update only the factual
    // fields so name_en, virtue text and is_free are left as they are.
    const { data: existing, error: existingError } = await supabase
        .from('surahs')
        .select('id, surah_number');
    if (existingError) throw existingError;
    const existingNumbers = new Set(existing.map(s => s.surah_number));

    const toInsert = surahs
        .filter(s => !existingNumbers.has(s.surahNumber))
        .map(s => ({
            surah_number: s.surahNumber,
            name_ar: s.nameAr,
            name_en: s.nameEn,
            verses_count: s.versesCount,
            revelation_type: s.revelationType,
            juz_number: s.juzNumber
        }));
    if (toInsert.length > 0) {
        const { error } = await supabase.from('surahs').insert(toInsert);
        if (error) throw error;
    }

    for (const s of surahs.filter(s => existingNumbers.has(s.surahNumber))) {
        const { error } = await supabase
            .from('surahs')
            .update({
                name_ar: s.nameAr,
                verses_count: s.versesCount,
                revelation_type: s.revelationType,
                juz_number: s.juzNumber
            })
            .eq('surah_number', s.surahNumber);
        if (error) throw error;
    }
    console.log(`Surahs: ${toInsert.length} inserted, ${existingNumbers.size} updated`);

    const { data: allSurahs, error: mapError } = await supabase
        .from('surahs')
        .select('id, surah_number');
    if (mapError) throw mapError;
    const idByNumber = new Map(allSurahs.map(s => [s.surah_number, s.id]));

    const rows = verses.map(v => ({
        surah_id: idByNumber.get(v.surahNumber),
        verse_number: v.verseNumber,
        text_ar: v.text,
        bismillah_prefix: v.bismillahPrefix,
        audio_url: verseAudioUrl('minshawi', v.surahNumber, v.verseNumber)
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const { error } = await supabase
            .from('verses')
            .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: 'surah_id,verse_number' });
        if (error) throw error;
        console.log(`Verses: ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
    }

    const { count, error: countError } = await supabase
        .from('verses')
        .select('*', { count: 'exact', head: true });
    if (countError) throw countError;
    console.log(`Done. verses table now holds ${count} rows.`);
}

main().catch((error) => {
    console.error('Quran seed failed:', error.message || error);
    process.exit(1);
});
