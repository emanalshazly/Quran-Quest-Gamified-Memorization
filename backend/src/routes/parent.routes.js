const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/parent/dashboard
 * @desc    Get parent dashboard overview
 * @access  Private
 */
router.get('/dashboard', authenticateUser, async (req, res) => {
    try {
        // Get all kids for this parent
        const { data: kids, error: kidsError } = await supabase
            .from('kids')
            .select('id, name, avatar, total_points, streak_count, level')
            .eq('user_id', req.user.id);

        if (kidsError) throw kidsError;

        // Get stats for each kid
        const kidsWithStats = await Promise.all(kids.map(async (kid) => {
            // Count memorized verses
            const { count: versesMemorized } = await supabase
                .from('memorized_verses')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kid.id);

            // Get recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: recentRecordings } = await supabase
                .from('recordings')
                .select('accuracy_score, recorded_at')
                .eq('kid_id', kid.id)
                .gte('recorded_at', sevenDaysAgo.toISOString());

            // Calculate average accuracy
            const avgAccuracy = recentRecordings.length > 0
                ? recentRecordings.reduce((sum, r) => sum + (r.accuracy_score || 0), 0) / recentRecordings.length
                : 0;

            // Get badges count
            const { count: badgesCount } = await supabase
                .from('badges')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kid.id);

            return {
                ...kid,
                versesMemorized: versesMemorized || 0,
                weeklyActivity: recentRecordings.length,
                averageAccuracy: parseFloat(avgAccuracy.toFixed(2)),
                badgesEarned: badgesCount || 0
            };
        }));

        res.json({
            success: true,
            kidsCount: kids.length,
            kids: kidsWithStats
        });
    } catch (error) {
        console.error('Get parent dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard'
        });
    }
});

/**
 * @route   GET /api/parent/kid/:kidId/detailed-stats
 * @desc    Get detailed statistics for a specific kid
 * @access  Private
 */
router.get('/kid/:kidId/detailed-stats', authenticateUser, async (req, res) => {
    try {
        // Verify kid ownership
        const { data: kid } = await supabase
            .from('kids')
            .select('*')
            .eq('id', req.params.kidId)
            .single();

        if (!kid || kid.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get memorized verses with mastery levels
        const { data: memorizedVerses } = await supabase
            .from('memorized_verses')
            .select('mastery_level')
            .eq('kid_id', req.params.kidId);

        const masteryDistribution = {
            beginner: 0,
            intermediate: 0,
            advanced: 0,
            master: 0
        };

        memorizedVerses?.forEach(v => {
            masteryDistribution[v.mastery_level]++;
        });

        // Get recordings for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recordings } = await supabase
            .from('recordings')
            .select('accuracy_score, recorded_at, duration_seconds')
            .eq('kid_id', req.params.kidId)
            .gte('recorded_at', thirtyDaysAgo.toISOString())
            .order('recorded_at', { ascending: true });

        // Calculate daily stats
        const dailyStats = {};
        recordings?.forEach(r => {
            const date = r.recorded_at.split('T')[0];
            if (!dailyStats[date]) {
                dailyStats[date] = {
                    count: 0,
                    totalAccuracy: 0,
                    totalDuration: 0
                };
            }
            dailyStats[date].count++;
            dailyStats[date].totalAccuracy += r.accuracy_score || 0;
            dailyStats[date].totalDuration += r.duration_seconds || 0;
        });

        // Get points history for the month
        const { data: pointsHistory } = await supabase
            .from('points_history')
            .select('points_earned, activity_type, created_at')
            .eq('kid_id', req.params.kidId)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        // Get completed surahs
        const { data: completedSurahs } = await supabase
            .from('memorized_verses')
            .select('verses!inner(surah_id, surahs(id, name_ar, name_en, verses_count))')
            .eq('kid_id', req.params.kidId);

        // Group by surah and check completion
        const surahProgress = {};
        completedSurahs?.forEach(mv => {
            const surah = mv.verses.surahs;
            if (!surahProgress[surah.id]) {
                surahProgress[surah.id] = {
                    name_ar: surah.name_ar,
                    name_en: surah.name_en,
                    total_verses: surah.verses_count,
                    memorized_verses: 0
                };
            }
            surahProgress[surah.id].memorized_verses++;
        });

        const surahsList = Object.values(surahProgress).map(s => ({
            ...s,
            percentage: ((s.memorized_verses / s.total_verses) * 100).toFixed(2),
            isComplete: s.memorized_verses === s.total_verses
        }));

        res.json({
            success: true,
            stats: {
                kid,
                masteryDistribution,
                dailyStats,
                monthlyPointsHistory: pointsHistory,
                surahsProgress: surahsList,
                totalRecordings: recordings?.length || 0,
                averageAccuracy: recordings?.length > 0
                    ? (recordings.reduce((sum, r) => sum + (r.accuracy_score || 0), 0) / recordings.length).toFixed(2)
                    : 0
            }
        });
    } catch (error) {
        console.error('Get detailed stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch detailed statistics'
        });
    }
});

/**
 * @route   POST /api/parent/goal
 * @desc    Create a goal for a kid
 * @access  Private
 */
router.post('/goal', authenticateUser, async (req, res) => {
    try {
        const { kid_id, goal_type, goal_description, target_value, deadline } = req.body;

        // Verify kid ownership
        const { data: kid } = await supabase
            .from('kids')
            .select('user_id')
            .eq('id', kid_id)
            .single();

        if (!kid || kid.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const { data: goal, error } = await supabase
            .from('parent_goals')
            .insert({
                kid_id,
                goal_type,
                goal_description,
                target_value,
                deadline
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Goal created successfully',
            goal
        });
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create goal'
        });
    }
});

/**
 * @route   GET /api/parent/goals/:kidId
 * @desc    Get goals for a kid
 * @access  Private
 */
router.get('/goals/:kidId', authenticateUser, async (req, res) => {
    try {
        // Verify kid ownership
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

        const { data: goals, error } = await supabase
            .from('parent_goals')
            .select('*')
            .eq('kid_id', req.params.kidId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            goals
        });
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch goals'
        });
    }
});

/**
 * @route   PUT /api/parent/goal/:goalId
 * @desc    Update goal progress
 * @access  Private
 */
router.put('/goal/:goalId', authenticateUser, async (req, res) => {
    try {
        const { current_progress } = req.body;

        // Get goal and verify ownership
        const { data: goal } = await supabase
            .from('parent_goals')
            .select('*, kids!inner(user_id)')
            .eq('id', req.params.goalId)
            .single();

        if (!goal || goal.kids.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const isCompleted = current_progress >= goal.target_value;

        const { data: updated, error } = await supabase
            .from('parent_goals')
            .update({
                current_progress,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null
            })
            .eq('id', req.params.goalId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Goal updated successfully',
            goal: updated
        });
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goal'
        });
    }
});

/**
 * @route   GET /api/parent/weekly-report
 * @desc    Get weekly report for all kids
 * @access  Private
 */
router.get('/weekly-report', authenticateUser, async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get all kids
        const { data: kids } = await supabase
            .from('kids')
            .select('id, name')
            .eq('user_id', req.user.id);

        const reports = await Promise.all(kids.map(async (kid) => {
            // Verses memorized this week
            const { count: versesMemorized } = await supabase
                .from('memorized_verses')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kid.id)
                .gte('memorized_at', sevenDaysAgo.toISOString());

            // Reviews completed this week
            const { count: reviewsCompleted } = await supabase
                .from('memorized_verses')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kid.id)
                .gte('last_review_date', sevenDaysAgo.toISOString());

            // Points earned this week
            const { data: points } = await supabase
                .from('points_history')
                .select('points_earned')
                .eq('kid_id', kid.id)
                .gte('created_at', sevenDaysAgo.toISOString());

            const totalPoints = points?.reduce((sum, p) => sum + p.points_earned, 0) || 0;

            // Activity days count
            const { data: recordings } = await supabase
                .from('recordings')
                .select('recorded_at')
                .eq('kid_id', kid.id)
                .gte('recorded_at', sevenDaysAgo.toISOString());

            const uniqueDays = new Set(recordings?.map(r => r.recorded_at.split('T')[0])).size;

            return {
                kidId: kid.id,
                kidName: kid.name,
                versesMemorized: versesMemorized || 0,
                reviewsCompleted: reviewsCompleted || 0,
                pointsEarned: totalPoints,
                activeDays: uniqueDays
            };
        }));

        res.json({
            success: true,
            period: {
                from: sevenDaysAgo.toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0]
            },
            reports
        });
    } catch (error) {
        console.error('Get weekly report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate weekly report'
        });
    }
});

module.exports = router;
