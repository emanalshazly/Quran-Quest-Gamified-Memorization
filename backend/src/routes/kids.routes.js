const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser, verifyKidOwnership } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/kids
 * @desc    Get all kids for authenticated parent
 * @access  Private
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { data: kids, error } = await supabase
            .from('kids')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            kids
        });
    } catch (error) {
        console.error('Get kids error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch kids'
        });
    }
});

/**
 * @route   GET /api/kids/:kidId
 * @desc    Get single kid profile
 * @access  Private
 */
router.get('/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { data: kid, error } = await supabase
            .from('kids')
            .select('*')
            .eq('id', req.params.kidId)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            kid
        });
    } catch (error) {
        console.error('Get kid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch kid'
        });
    }
});

/**
 * @route   POST /api/kids
 * @desc    Create new kid profile
 * @access  Private
 */
router.post('/', authenticateUser, async (req, res) => {
    try {
        const { name, avatar, date_of_birth, preferred_reciter, language_preference } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }

        // Check if user already has 5 kids (subscription limit)
        const { count } = await supabase
            .from('kids')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id);

        if (count >= 5) {
            return res.status(403).json({
                success: false,
                message: 'Maximum number of kids (5) reached'
            });
        }

        const { data: kid, error } = await supabase
            .from('kids')
            .insert({
                user_id: req.user.id,
                name,
                avatar: avatar || 'default_avatar.png',
                date_of_birth,
                preferred_reciter: preferred_reciter || 'minshawi',
                language_preference: language_preference || 'ar'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Kid profile created successfully',
            kid
        });
    } catch (error) {
        console.error('Create kid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create kid profile'
        });
    }
});

/**
 * @route   PUT /api/kids/:kidId
 * @desc    Update kid profile
 * @access  Private
 */
router.put('/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { name, avatar, date_of_birth, preferred_reciter, language_preference } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (avatar) updateData.avatar = avatar;
        if (date_of_birth) updateData.date_of_birth = date_of_birth;
        if (preferred_reciter) updateData.preferred_reciter = preferred_reciter;
        if (language_preference) updateData.language_preference = language_preference;

        const { data: kid, error } = await supabase
            .from('kids')
            .update(updateData)
            .eq('id', req.params.kidId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Kid profile updated successfully',
            kid
        });
    } catch (error) {
        console.error('Update kid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update kid profile'
        });
    }
});

/**
 * @route   DELETE /api/kids/:kidId
 * @desc    Delete kid profile
 * @access  Private
 */
router.delete('/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { error } = await supabase
            .from('kids')
            .delete()
            .eq('id', req.params.kidId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Kid profile deleted successfully'
        });
    } catch (error) {
        console.error('Delete kid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete kid profile'
        });
    }
});

/**
 * @route   GET /api/kids/:kidId/stats
 * @desc    Get kid's statistics
 * @access  Private
 */
router.get('/:kidId/stats', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const gamificationService = require('../services/gamification.service');
        const spacedRepetitionService = require('../services/spacedRepetition.service');

        const [gamificationStats, reviewStats] = await Promise.all([
            gamificationService.getKidStats(req.params.kidId),
            spacedRepetitionService.getReviewStatistics(req.params.kidId)
        ]);

        res.json({
            success: true,
            stats: {
                ...gamificationStats,
                ...reviewStats
            }
        });
    } catch (error) {
        console.error('Get kid stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch kid statistics'
        });
    }
});

module.exports = router;
