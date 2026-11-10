const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser, verifyKidOwnership } = require('../middlewares/auth.middleware');
const gamificationService = require('../services/gamification.service');

/**
 * @route   GET /api/gamification/badges/:kidId
 * @desc    Get all badges for a kid
 * @access  Private
 */
router.get('/badges/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { data: badges, error } = await supabase
            .from('badges')
            .select('*')
            .eq('kid_id', req.params.kidId)
            .order('earned_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            count: badges.length,
            badges
        });
    } catch (error) {
        console.error('Get badges error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch badges'
        });
    }
});

/**
 * @route   GET /api/gamification/leaderboard
 * @desc    Get global leaderboard
 * @access  Private
 */
router.get('/leaderboard', authenticateUser, async (req, res) => {
    try {
        const { limit = 10, type = 'global' } = req.query;

        let query = supabase
            .from('leaderboard')
            .select(`
                *,
                kids (
                    name,
                    avatar,
                    level
                )
            `)
            .order('total_points', { ascending: false })
            .limit(parseInt(limit));

        // Filter by family if requested
        if (type === 'family') {
            query = query.eq('user_id', req.user.id);
        }

        const { data: leaderboard, error } = await query;

        if (error) throw error;

        // Privacy (COPPA): on the global leaderboard, never expose other
        // families' children's names/avatars. Own kids keep their names;
        // everyone else is anonymized to "Hafiz #rank".
        const sanitized = (leaderboard || []).map((entry, index) => {
            const isOwnKid = entry.user_id === req.user.id;
            const rank = entry.global_rank || index + 1;
            return {
                rank,
                total_points: entry.total_points,
                level: entry.kids?.level || 1,
                name: isOwnKid ? entry.kids?.name : `حافظ #${rank}`,
                avatar: isOwnKid ? entry.kids?.avatar : 'anonymous_avatar.png',
                isOwnKid
            };
        });

        res.json({
            success: true,
            type,
            leaderboard: type === 'family' ? leaderboard : sanitized
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard'
        });
    }
});

/**
 * @route   GET /api/gamification/points-history/:kidId
 * @desc    Get points history for a kid
 * @access  Private
 */
router.get('/points-history/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const { data: history, error } = await supabase
            .from('points_history')
            .select('*')
            .eq('kid_id', req.params.kidId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;

        // Calculate total points from history
        const totalPoints = history.reduce((sum, record) => sum + record.points_earned, 0);

        res.json({
            success: true,
            totalPoints,
            history
        });
    } catch (error) {
        console.error('Get points history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch points history'
        });
    }
});

/**
 * @route   GET /api/gamification/daily-challenge/:kidId
 * @desc    Get today's daily challenge for a kid
 * @access  Private
 */
router.get('/daily-challenge/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: challenge, error } = await supabase
            .from('daily_challenges')
            .select('*')
            .eq('kid_id', req.params.kidId)
            .eq('challenge_date', today)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // If no challenge exists for today, create one
        if (!challenge) {
            const newChallenge = await createDailyChallenge(req.params.kidId);
            return res.json({
                success: true,
                challenge: newChallenge
            });
        }

        res.json({
            success: true,
            challenge
        });
    } catch (error) {
        console.error('Get daily challenge error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily challenge'
        });
    }
});

/**
 * @route   POST /api/gamification/daily-challenge/:kidId/progress
 * @desc    Update progress on daily challenge
 * @access  Private
 */
router.post('/daily-challenge/:kidId/progress', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { progress_increment = 1 } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // Get current challenge
        const { data: challenge } = await supabase
            .from('daily_challenges')
            .select('*')
            .eq('kid_id', req.params.kidId)
            .eq('challenge_date', today)
            .single();

        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'No challenge found for today'
            });
        }

        const newProgress = challenge.current_progress + progress_increment;
        const isCompleted = newProgress >= challenge.target_value;

        // Update challenge
        const { data: updated, error } = await supabase
            .from('daily_challenges')
            .update({
                current_progress: newProgress,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null
            })
            .eq('id', challenge.id)
            .select()
            .single();

        if (error) throw error;

        // Award points if completed
        if (isCompleted && !challenge.is_completed) {
            await gamificationService.awardPoints(
                req.params.kidId,
                challenge.reward_points,
                'daily_challenge',
                'Completed daily challenge',
                challenge.id
            );
        }

        res.json({
            success: true,
            challenge: updated,
            pointsEarned: isCompleted && !challenge.is_completed ? challenge.reward_points : 0
        });
    } catch (error) {
        console.error('Update challenge progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update challenge progress'
        });
    }
});

/**
 * @route   GET /api/gamification/stats/:kidId
 * @desc    Get comprehensive gamification stats
 * @access  Private
 */
router.get('/stats/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const stats = await gamificationService.getKidStats(req.params.kidId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get gamification stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
});

/**
 * Helper function to create daily challenge
 */
async function createDailyChallenge(kidId) {
    // Random challenge types
    const challengeTypes = [
        {
            type: 'memorize_verses',
            descriptionAr: 'احفظ 5 آيات اليوم',
            descriptionEn: 'Memorize 5 verses today',
            target: 5
        },
        {
            type: 'review_verses',
            descriptionAr: 'راجع 3 آيات قديمة',
            descriptionEn: 'Review 3 old verses',
            target: 3
        },
        {
            type: 'record_recitations',
            descriptionAr: 'سجّل تلاوتك 10 مرات',
            descriptionEn: 'Record your recitation 10 times',
            target: 10
        },
        {
            type: 'perfect_scores',
            descriptionAr: 'احصل على 3 تقييمات مثالية',
            descriptionEn: 'Get 3 perfect scores',
            target: 3
        }
    ];

    const randomChallenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

    const { data: challenge, error } = await supabase
        .from('daily_challenges')
        .insert({
            kid_id: kidId,
            challenge_type: randomChallenge.type,
            challenge_description_ar: randomChallenge.descriptionAr,
            challenge_description_en: randomChallenge.descriptionEn,
            target_value: randomChallenge.target,
            current_progress: 0,
            reward_points: 50
        })
        .select()
        .single();

    if (error) throw error;

    return challenge;
}

module.exports = router;
