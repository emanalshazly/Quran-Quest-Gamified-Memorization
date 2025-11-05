const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser, checkSubscription } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/surahs
 * @desc    Get all surahs (with subscription check)
 * @access  Private
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('id', req.user.id)
            .single();

        const isFree = user.subscription_tier === 'free';

        // For free users, only show free surahs
        let query = supabase
            .from('surahs')
            .select('*')
            .order('surah_number', { ascending: true });

        if (isFree) {
            query = query.eq('is_free', true);
        }

        const { data: surahs, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            surahs,
            subscriptionTier: user.subscription_tier
        });
    } catch (error) {
        console.error('Get surahs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch surahs'
        });
    }
});

/**
 * @route   GET /api/surahs/:surahId
 * @desc    Get single surah with all verses
 * @access  Private
 */
router.get('/:surahId', authenticateUser, async (req, res) => {
    try {
        // Get surah details
        const { data: surah, error: surahError } = await supabase
            .from('surahs')
            .select('*')
            .eq('id', req.params.surahId)
            .single();

        if (surahError) throw surahError;

        // Check subscription if surah is not free
        if (!surah.is_free) {
            const { data: user } = await supabase
                .from('users')
                .select('subscription_tier')
                .eq('id', req.user.id)
                .single();

            if (user.subscription_tier === 'free') {
                return res.status(403).json({
                    success: false,
                    message: 'This surah requires a Pro or Family subscription',
                    subscriptionRequired: true
                });
            }
        }

        // Get all verses for this surah
        const { data: verses, error: versesError } = await supabase
            .from('verses')
            .select('*')
            .eq('surah_id', req.params.surahId)
            .order('verse_number', { ascending: true });

        if (versesError) throw versesError;

        res.json({
            success: true,
            surah: {
                ...surah,
                verses
            }
        });
    } catch (error) {
        console.error('Get surah error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch surah'
        });
    }
});

/**
 * @route   GET /api/surahs/:surahId/verses/:verseNumber
 * @desc    Get single verse
 * @access  Private
 */
router.get('/:surahId/verses/:verseNumber', authenticateUser, async (req, res) => {
    try {
        const { data: verse, error } = await supabase
            .from('verses')
            .select(`
                *,
                surahs (
                    name_ar,
                    name_en,
                    is_free
                )
            `)
            .eq('surah_id', req.params.surahId)
            .eq('verse_number', req.params.verseNumber)
            .single();

        if (error) throw error;

        // Check subscription if surah is not free
        if (!verse.surahs.is_free) {
            const { data: user } = await supabase
                .from('users')
                .select('subscription_tier')
                .eq('id', req.user.id)
                .single();

            if (user.subscription_tier === 'free') {
                return res.status(403).json({
                    success: false,
                    message: 'This verse requires a Pro or Family subscription',
                    subscriptionRequired: true
                });
            }
        }

        res.json({
            success: true,
            verse
        });
    } catch (error) {
        console.error('Get verse error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch verse'
        });
    }
});

/**
 * @route   GET /api/surahs/juz/:juzNumber
 * @desc    Get all surahs in a specific Juz
 * @access  Private
 */
router.get('/juz/:juzNumber', authenticateUser, async (req, res) => {
    try {
        const { data: surahs, error } = await supabase
            .from('surahs')
            .select('*')
            .eq('juz_number', req.params.juzNumber)
            .order('surah_number', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            juzNumber: parseInt(req.params.juzNumber),
            surahs
        });
    } catch (error) {
        console.error('Get Juz surahs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch Juz surahs'
        });
    }
});

/**
 * @route   GET /api/surahs/:surahId/progress/:kidId
 * @desc    Get kid's progress for a specific surah
 * @access  Private
 */
router.get('/:surahId/progress/:kidId', authenticateUser, async (req, res) => {
    try {
        // Verify kid belongs to user
        const { data: kid } = await supabase
            .from('kids')
            .select('user_id')
            .eq('id', req.params.kidId)
            .single();

        if (!kid || kid.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get surah info
        const { data: surah } = await supabase
            .from('surahs')
            .select('verses_count')
            .eq('id', req.params.surahId)
            .single();

        // Get memorized verses for this surah
        const { data: memorizedVerses } = await supabase
            .from('memorized_verses')
            .select(`
                *,
                verses!inner (
                    surah_id,
                    verse_number
                )
            `)
            .eq('kid_id', req.params.kidId)
            .eq('verses.surah_id', req.params.surahId);

        const totalVerses = surah.verses_count;
        const memorizedCount = memorizedVerses?.length || 0;
        const progressPercentage = ((memorizedCount / totalVerses) * 100).toFixed(2);

        res.json({
            success: true,
            progress: {
                totalVerses,
                memorizedCount,
                progressPercentage: parseFloat(progressPercentage),
                isCompleted: memorizedCount === totalVerses,
                memorizedVerses: memorizedVerses?.map(mv => mv.verses.verse_number) || []
            }
        });
    } catch (error) {
        console.error('Get surah progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch progress'
        });
    }
});

module.exports = router;
