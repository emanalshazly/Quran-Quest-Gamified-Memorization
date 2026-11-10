const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser, verifyKidOwnership } = require('../middlewares/auth.middleware');
const spacedRepetitionService = require('../services/spacedRepetition.service');
const gamificationService = require('../services/gamification.service');

/**
 * @route   POST /api/memorization/record
 * @desc    Submit a recording for verse recitation
 * @access  Private
 */
router.post('/record', authenticateUser, async (req, res) => {
    try {
        const { kid_id, verse_id, audio_url, duration_seconds } = req.body;

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

        // Create recording record
        const { data: recording, error } = await supabase
            .from('recordings')
            .insert({
                kid_id,
                verse_id,
                audio_url,
                duration_seconds
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Recording submitted successfully',
            recording
        });
    } catch (error) {
        console.error('Submit recording error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit recording'
        });
    }
});

/**
 * @route   POST /api/memorization/analyze
 * @desc    Analyze recording and provide feedback (TensorFlow Lite integration point)
 * @access  Private
 */
router.post('/analyze', authenticateUser, async (req, res) => {
    try {
        // TODO(security): scores are currently computed on-device and sent by
        // the client, which is spoofable. When the on-device TFLite model is
        // integrated, move scoring server-side (or sign the on-device result).
        const { recording_id, errors_detected } = req.body;

        const clampScore = (value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return 0;
            return Math.min(100, Math.max(0, n));
        };

        const accuracy_score = clampScore(req.body.accuracy_score);
        const tajweed_score = clampScore(req.body.tajweed_score);
        const pronunciation_score = clampScore(req.body.pronunciation_score);

        // Get recording
        const { data: recording } = await supabase
            .from('recordings')
            .select('*, kids!inner(user_id)')
            .eq('id', recording_id)
            .single();

        if (!recording || recording.kids.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Determine if passed (accuracy >= 70%)
        const isPassed = accuracy_score >= 70;

        // Generate feedback
        let feedbackAr = '';
        let feedbackEn = '';

        if (accuracy_score >= 95) {
            feedbackAr = 'ممتاز! تلاوة رائعة بارك الله فيك';
            feedbackEn = 'Excellent! Wonderful recitation, may Allah bless you';
        } else if (accuracy_score >= 85) {
            feedbackAr = 'جيد جداً! استمر في الممارسة';
            feedbackEn = 'Very good! Keep practicing';
        } else if (accuracy_score >= 70) {
            feedbackAr = 'جيد، حاول تحسين التجويد';
            feedbackEn = 'Good, try to improve your tajweed';
        } else {
            feedbackAr = 'يحتاج إلى تحسين، استمع للتلاوة مرة أخرى';
            feedbackEn = 'Needs improvement, listen to the recitation again';
        }

        // Update recording with analysis results
        const { data: updatedRecording, error } = await supabase
            .from('recordings')
            .update({
                accuracy_score,
                tajweed_score,
                pronunciation_score,
                errors_detected,
                feedback_ar: feedbackAr,
                feedback_en: feedbackEn,
                is_passed: isPassed,
                analysis_completed_at: new Date().toISOString()
            })
            .eq('id', recording_id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Analysis completed',
            recording: updatedRecording,
            isPassed
        });
    } catch (error) {
        console.error('Analyze recording error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze recording'
        });
    }
});

/**
 * @route   POST /api/memorization/memorize
 * @desc    Mark verse as memorized (after successful recording)
 * @access  Private
 */
router.post('/memorize', authenticateUser, async (req, res) => {
    try {
        const { kid_id, verse_id, recording_id, accuracy_score } = req.body;

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

        // Check if already memorized
        const { data: existing } = await supabase
            .from('memorized_verses')
            .select('id')
            .eq('kid_id', kid_id)
            .eq('verse_id', verse_id)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Verse already memorized'
            });
        }

        // Calculate initial review schedule using SM-2
        const quality = spacedRepetitionService.accuracyToQuality(accuracy_score);
        const schedule = spacedRepetitionService.calculateNextReview({
            quality,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitionCount: 0
        });

        // Insert memorized verse
        const { data: memorizedVerse, error } = await supabase
            .from('memorized_verses')
            .insert({
                kid_id,
                verse_id,
                next_review_date: schedule.nextReviewDate,
                ease_factor: schedule.easeFactor,
                interval_days: schedule.intervalDays,
                repetition_count: schedule.repetitionCount,
                last_review_quality: quality,
                mastery_level: schedule.masteryLevel
            })
            .select()
            .single();

        if (error) throw error;

        // Award points for memorization
        await gamificationService.awardPoints(
            kid_id,
            gamificationService.POINTS.VERSE_MEMORIZED,
            'verse_memorized',
            `Memorized new verse`,
            verse_id
        );

        // Award extra points for perfect score
        if (accuracy_score >= 95) {
            await gamificationService.awardPoints(
                kid_id,
                gamificationService.POINTS.PERFECT_SCORE,
                'perfect_score',
                `Perfect recitation score`,
                recording_id
            );
        }

        // Update streak
        const streakResult = await gamificationService.updateStreak(kid_id);

        // Check for milestones and badges
        const badges = await gamificationService.checkMemorizationMilestones(kid_id);

        res.status(201).json({
            success: true,
            message: 'Verse marked as memorized',
            memorizedVerse,
            pointsEarned: gamificationService.POINTS.VERSE_MEMORIZED + (accuracy_score >= 95 ? gamificationService.POINTS.PERFECT_SCORE : 0) + streakResult.streakBonus,
            streak: streakResult.streakCount,
            badgesEarned: badges,
            nextReview: schedule.nextReviewDate
        });
    } catch (error) {
        console.error('Memorize verse error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark verse as memorized'
        });
    }
});

/**
 * @route   POST /api/memorization/review
 * @desc    Submit review for a memorized verse
 * @access  Private
 */
router.post('/review', authenticateUser, async (req, res) => {
    try {
        const { kid_id, verse_id, accuracy_score } = req.body;

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

        // Get current memorization data
        const { data: memorizedVerse } = await supabase
            .from('memorized_verses')
            .select('*')
            .eq('kid_id', kid_id)
            .eq('verse_id', verse_id)
            .single();

        if (!memorizedVerse) {
            return res.status(404).json({
                success: false,
                message: 'Verse not memorized yet'
            });
        }

        // Calculate next review using SM-2
        const quality = spacedRepetitionService.accuracyToQuality(accuracy_score);
        const schedule = spacedRepetitionService.calculateNextReview({
            quality,
            easeFactor: memorizedVerse.ease_factor,
            intervalDays: memorizedVerse.interval_days,
            repetitionCount: memorizedVerse.repetition_count
        });

        // Update memorized verse
        const { data: updated, error } = await supabase
            .from('memorized_verses')
            .update({
                next_review_date: schedule.nextReviewDate,
                ease_factor: schedule.easeFactor,
                interval_days: schedule.intervalDays,
                repetition_count: schedule.repetitionCount,
                last_review_date: new Date().toISOString(),
                last_review_quality: quality,
                mastery_level: schedule.masteryLevel
            })
            .eq('kid_id', kid_id)
            .eq('verse_id', verse_id)
            .select()
            .single();

        if (error) throw error;

        // Award review points
        await gamificationService.awardPoints(
            kid_id,
            gamificationService.POINTS.VERSE_REVIEWED,
            'verse_reviewed',
            `Reviewed verse`,
            verse_id
        );

        // Dedicated reviewer badge after 50 reviews
        const { count: reviewCount } = await supabase
            .from('points_history')
            .select('*', { count: 'exact', head: true })
            .eq('kid_id', kid_id)
            .eq('activity_type', 'verse_reviewed');

        if (reviewCount >= 50) {
            await gamificationService.checkAndAwardBadge(kid_id, 'FIFTY_REVIEWS');
        }

        res.json({
            success: true,
            message: 'Review submitted successfully',
            memorizedVerse: updated,
            pointsEarned: gamificationService.POINTS.VERSE_REVIEWED,
            nextReview: schedule.nextReviewDate,
            masteryLevel: schedule.masteryLevel
        });
    } catch (error) {
        console.error('Review verse error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit review'
        });
    }
});

/**
 * @route   GET /api/memorization/due/:kidId
 * @desc    Get verses due for review
 * @access  Private
 */
router.get('/due/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const verses = await spacedRepetitionService.getVersuesDueForReview(req.params.kidId);

        res.json({
            success: true,
            count: verses.length,
            verses
        });
    } catch (error) {
        console.error('Get due verses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch due verses'
        });
    }
});

/**
 * @route   GET /api/memorization/stats/:kidId
 * @desc    Get memorization statistics
 * @access  Private
 */
router.get('/stats/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const stats = await spacedRepetitionService.getReviewStatistics(req.params.kidId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get memorization stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

/**
 * @route   GET /api/memorization/progress-map/:kidId
 * @desc    Memorized-verse counts per surah, for the Quest Map (one call)
 * @access  Private
 */
router.get('/progress-map/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('memorized_verses')
            .select('verse_id, verses!inner(surah_id)')
            .eq('kid_id', req.params.kidId);

        if (error) throw error;

        const progressBySurah = {};
        (rows || []).forEach(row => {
            const surahId = row.verses.surah_id;
            progressBySurah[surahId] = (progressBySurah[surahId] || 0) + 1;
        });

        res.json({
            success: true,
            progressBySurah
        });
    } catch (error) {
        console.error('Get progress map error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch progress map'
        });
    }
});

/**
 * @route   GET /api/memorization/history/:kidId
 * @desc    Get kid's recording history
 * @access  Private
 */
router.get('/history/:kidId', authenticateUser, verifyKidOwnership, async (req, res) => {
    try {
        const { data: recordings, error } = await supabase
            .from('recordings')
            .select(`
                *,
                verses (
                    verse_number,
                    text_ar,
                    surahs (
                        name_ar,
                        name_en
                    )
                )
            `)
            .eq('kid_id', req.params.kidId)
            .order('recorded_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({
            success: true,
            recordings
        });
    } catch (error) {
        console.error('Get recording history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recording history'
        });
    }
});

module.exports = router;
