const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middlewares/auth.middleware');
const gamificationService = require('../services/gamification.service');

/**
 * @route   POST /api/battle/challenge
 * @desc    Create a battle challenge
 * @access  Private
 */
router.post('/challenge', authenticateUser, async (req, res) => {
    try {
        const { challenger_id, opponent_id, verse_id } = req.body;

        // Verify both kids belong to user or their family
        const { data: challenger } = await supabase
            .from('kids')
            .select('user_id')
            .eq('id', challenger_id)
            .single();

        const { data: opponent } = await supabase
            .from('kids')
            .select('user_id')
            .eq('id', opponent_id)
            .single();

        if (!challenger || !opponent) {
            return res.status(404).json({
                success: false,
                message: 'Kids not found'
            });
        }

        // Ensure challenger belongs to authenticated user
        if (challenger.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Create battle challenge
        const { data: battle, error } = await supabase
            .from('battle_challenges')
            .insert({
                challenger_id,
                opponent_id,
                verse_id,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // TODO: Send notification to opponent

        res.status(201).json({
            success: true,
            message: 'Battle challenge created',
            battle
        });
    } catch (error) {
        console.error('Create battle error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create battle challenge'
        });
    }
});

/**
 * @route   POST /api/battle/:battleId/accept
 * @desc    Accept a battle challenge
 * @access  Private
 */
router.post('/:battleId/accept', authenticateUser, async (req, res) => {
    try {
        const { data: battle } = await supabase
            .from('battle_challenges')
            .select(`
                *,
                kids!battle_challenges_opponent_id_fkey(user_id)
            `)
            .eq('id', req.params.battleId)
            .single();

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        // Verify opponent owns the kid
        if (battle.kids.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Update battle status
        const { data: updated, error } = await supabase
            .from('battle_challenges')
            .update({ status: 'accepted' })
            .eq('id', req.params.battleId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Battle accepted',
            battle: updated
        });
    } catch (error) {
        console.error('Accept battle error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept battle'
        });
    }
});

/**
 * @route   POST /api/battle/:battleId/submit
 * @desc    Submit battle result (challenger or opponent)
 * @access  Private
 */
router.post('/:battleId/submit', authenticateUser, async (req, res) => {
    try {
        const { kid_id, score, time_seconds } = req.body;

        // Verify the submitting kid belongs to the authenticated user
        // (prevents submitting scores on behalf of someone else's kid).
        const { data: submittingKid } = await supabase
            .from('kids')
            .select('user_id')
            .eq('id', kid_id)
            .single();

        if (!submittingKid || submittingKid.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this kid profile'
            });
        }

        const { data: battle } = await supabase
            .from('battle_challenges')
            .select('*')
            .eq('id', req.params.battleId)
            .single();

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        if (battle.status === 'completed' || battle.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: `Battle is already ${battle.status}`
            });
        }

        // Determine if kid is challenger or opponent
        const isChallenger = battle.challenger_id === kid_id;
        const isOpponent = battle.opponent_id === kid_id;

        if (!isChallenger && !isOpponent) {
            return res.status(403).json({
                success: false,
                message: 'Kid not part of this battle'
            });
        }

        // Update appropriate fields
        const updateData = {};
        if (isChallenger) {
            updateData.challenger_score = score;
            updateData.challenger_time_seconds = time_seconds;
        } else {
            updateData.opponent_score = score;
            updateData.opponent_time_seconds = time_seconds;
        }

        // Check if battle is complete
        const otherScore = isChallenger ? battle.opponent_score : battle.challenger_score;
        const otherTime = isChallenger ? battle.opponent_time_seconds : battle.challenger_time_seconds;

        let winner_id = null;
        if (otherScore !== null) {
            // Both have submitted - determine winner
            const myScore = score;
            const myTime = time_seconds;

            if (myScore > otherScore) {
                winner_id = kid_id;
            } else if (otherScore > myScore) {
                winner_id = isChallenger ? battle.opponent_id : battle.challenger_id;
            } else {
                // Same score, compare time (faster wins)
                winner_id = myTime < otherTime ? kid_id : (isChallenger ? battle.opponent_id : battle.challenger_id);
            }

            updateData.winner_id = winner_id;
            updateData.status = 'completed';
            updateData.completed_at = new Date().toISOString();
        }

        // Update battle
        const { data: updated, error } = await supabase
            .from('battle_challenges')
            .update(updateData)
            .eq('id', req.params.battleId)
            .select()
            .single();

        if (error) throw error;

        // Award points to winner if battle is complete
        if (winner_id) {
            await gamificationService.awardPoints(
                winner_id,
                gamificationService.POINTS.BATTLE_WON,
                'battle_won',
                'Won a battle challenge',
                req.params.battleId
            );

            // Check for battle champion badge
            const { count: battlesWon } = await supabase
                .from('battle_challenges')
                .select('*', { count: 'exact', head: true })
                .eq('winner_id', winner_id)
                .eq('status', 'completed');

            if (battlesWon >= 10) {
                await gamificationService.checkAndAwardBadge(winner_id, 'BATTLE_CHAMPION');
            }
        }

        res.json({
            success: true,
            message: winner_id ? 'Battle completed' : 'Score submitted',
            battle: updated,
            isWinner: winner_id === kid_id
        });
    } catch (error) {
        console.error('Submit battle result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit battle result'
        });
    }
});

/**
 * @route   GET /api/battle/pending/:kidId
 * @desc    Get pending battles for a kid
 * @access  Private
 */
router.get('/pending/:kidId', authenticateUser, async (req, res) => {
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

        // Get pending battles where kid is challenger or opponent
        const { data: battles, error } = await supabase
            .from('battle_challenges')
            .select(`
                *,
                challenger:kids!battle_challenges_challenger_id_fkey(id, name, avatar),
                opponent:kids!battle_challenges_opponent_id_fkey(id, name, avatar),
                verses(verse_number, text_ar, surahs(name_ar, name_en))
            `)
            .or(`challenger_id.eq.${req.params.kidId},opponent_id.eq.${req.params.kidId}`)
            .in('status', ['pending', 'accepted'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            count: battles.length,
            battles
        });
    } catch (error) {
        console.error('Get pending battles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending battles'
        });
    }
});

/**
 * @route   GET /api/battle/history/:kidId
 * @desc    Get battle history for a kid
 * @access  Private
 */
router.get('/history/:kidId', authenticateUser, async (req, res) => {
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

        // Get completed battles
        const { data: battles, error } = await supabase
            .from('battle_challenges')
            .select(`
                *,
                challenger:kids!battle_challenges_challenger_id_fkey(id, name, avatar),
                opponent:kids!battle_challenges_opponent_id_fkey(id, name, avatar),
                verses(verse_number, text_ar, surahs(name_ar, name_en))
            `)
            .or(`challenger_id.eq.${req.params.kidId},opponent_id.eq.${req.params.kidId}`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Calculate win/loss stats
        const stats = {
            total: battles.length,
            wins: battles.filter(b => b.winner_id === req.params.kidId).length,
            losses: battles.filter(b => b.winner_id !== req.params.kidId).length
        };

        res.json({
            success: true,
            stats,
            battles
        });
    } catch (error) {
        console.error('Get battle history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch battle history'
        });
    }
});

module.exports = router;
