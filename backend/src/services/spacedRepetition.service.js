/**
 * SM-2 Spaced Repetition Algorithm Implementation
 * Used for optimal Quran memorization review scheduling
 *
 * Quality scale (0-5):
 * 0 - Complete blackout
 * 1 - Incorrect response, but remembered upon seeing correct answer
 * 2 - Incorrect response, but felt familiar
 * 3 - Correct response with serious difficulty
 * 4 - Correct response with hesitation
 * 5 - Perfect response
 */

class SpacedRepetitionService {
    /**
     * Calculate next review date based on SM-2 algorithm
     *
     * @param {Object} params - Parameters for calculation
     * @param {number} params.quality - Quality of recall (0-5)
     * @param {number} params.easeFactor - Current ease factor (default: 2.5)
     * @param {number} params.intervalDays - Current interval in days (default: 0)
     * @param {number} params.repetitionCount - Number of successful repetitions (default: 0)
     * @param {Date} params.now - When the review happened (default: now)
     * @returns {Object} Next review schedule
     */
    calculateNextReview({ quality, easeFactor = 2.5, intervalDays = 0, repetitionCount = 0, now = new Date() }) {
        // Validate quality
        if (quality < 0 || quality > 5) {
            throw new Error('Quality must be between 0 and 5');
        }

        // Calculate new ease factor
        let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

        // Ensure ease factor doesn't go below 1.3
        if (newEaseFactor < 1.3) {
            newEaseFactor = 1.3;
        }

        let newInterval;
        let newRepetitionCount;

        // If quality < 3, start over (failed recall)
        if (quality < 3) {
            newInterval = 0;
            newRepetitionCount = 0;
        } else {
            newRepetitionCount = repetitionCount + 1;

            // Calculate interval based on repetition number
            if (newRepetitionCount === 1) {
                newInterval = 1; // 1 day
            } else if (newRepetitionCount === 2) {
                newInterval = 6; // 6 days
            } else {
                newInterval = Math.round(intervalDays * newEaseFactor);
            }
        }

        // Calculate next review date
        const nextReviewDate = new Date(now);
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

        // Determine mastery level
        const masteryLevel = this.getMasteryLevel(newRepetitionCount, newEaseFactor);

        return {
            easeFactor: parseFloat(newEaseFactor.toFixed(2)),
            intervalDays: newInterval,
            repetitionCount: newRepetitionCount,
            nextReviewDate: nextReviewDate.toISOString(),
            masteryLevel
        };
    }

    /**
     * Determine mastery level based on repetition count and ease factor
     *
     * @param {number} repetitionCount - Number of successful repetitions
     * @param {number} easeFactor - Current ease factor
     * @returns {string} Mastery level
     */
    getMasteryLevel(repetitionCount, easeFactor) {
        if (repetitionCount >= 8 && easeFactor >= 2.5) {
            return 'master';
        } else if (repetitionCount >= 5 && easeFactor >= 2.0) {
            return 'advanced';
        } else if (repetitionCount >= 3 && easeFactor >= 1.8) {
            return 'intermediate';
        } else {
            return 'beginner';
        }
    }

    /**
     * Convert accuracy score to quality rating (0-5)
     *
     * @param {number} accuracyScore - Accuracy score from 0-100
     * @returns {number} Quality rating (0-5)
     */
    accuracyToQuality(accuracyScore) {
        if (accuracyScore >= 95) return 5; // Perfect
        if (accuracyScore >= 85) return 4; // Good with hesitation
        if (accuracyScore >= 70) return 3; // Correct with difficulty
        if (accuracyScore >= 50) return 2; // Incorrect but familiar
        if (accuracyScore >= 30) return 1; // Incorrect but remembered
        return 0; // Complete blackout
    }

    /**
     * Get verses due for review for a specific kid
     *
     * @param {string} kidId - Kid's UUID
     * @param {Date} currentDate - Current date (default: now)
     * @returns {Array} Array of verses due for review
     */
    async getVersuesDueForReview(kidId, currentDate = new Date()) {
        const { supabase } = require('../config/supabase');

        const { data: verses, error } = await supabase
            .from('memorized_verses')
            .select(`
                *,
                verses (
                    id,
                    surah_id,
                    verse_number,
                    text_ar,
                    audio_url,
                    surahs (
                        name_ar,
                        name_en
                    )
                )
            `)
            .eq('kid_id', kidId)
            .lte('next_review_date', currentDate.toISOString())
            .order('next_review_date', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch review verses: ${error.message}`);
        }

        return verses;
    }

    /**
     * Calculate weekly review statistics for a kid
     *
     * @param {string} kidId - Kid's UUID
     * @returns {Object} Review statistics
     */
    async getReviewStatistics(kidId) {
        const { supabase } = require('../config/supabase');

        // Get all memorized verses
        const { data: allVerses } = await supabase
            .from('memorized_verses')
            .select('mastery_level')
            .eq('kid_id', kidId);

        // Get verses due today
        const dueToday = await this.getVersuesDueForReview(kidId);

        // Get verses due this week
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        const dueThisWeek = await this.getVersuesDueForReview(kidId, oneWeekFromNow);

        // Count by mastery level
        const masteryCount = {
            beginner: 0,
            intermediate: 0,
            advanced: 0,
            master: 0
        };

        allVerses?.forEach(verse => {
            masteryCount[verse.mastery_level]++;
        });

        return {
            totalMemorized: allVerses?.length || 0,
            dueToday: dueToday.length,
            dueThisWeek: dueThisWeek.length,
            masteryDistribution: masteryCount
        };
    }
}

module.exports = new SpacedRepetitionService();
