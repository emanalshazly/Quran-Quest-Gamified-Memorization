const { supabase } = require('../config/supabase');

/**
 * Gamification Service
 * Manages points, badges, streaks, and rewards
 */
class GamificationService {
    // Points configuration
    POINTS = {
        VERSE_MEMORIZED: 10,
        VERSE_REVIEWED: 5,
        DAILY_STREAK: 20,
        CHALLENGE_COMPLETED: 50,
        BATTLE_WON: 30,
        PERFECT_SCORE: 15,
        SURAH_COMPLETED: 100
    };

    // Badge definitions
    BADGES = {
        FIRST_VERSE: {
            name: 'first_verse',
            nameAr: 'الآية الأولى',
            nameEn: 'First Verse',
            descriptionAr: 'حفظ أول آية',
            descriptionEn: 'Memorized your first verse',
            icon: '🌟'
        },
        FIVE_SURAHS: {
            name: 'five_surahs',
            nameAr: 'حافظ السور القصيرة',
            nameEn: 'Short Surahs Master',
            descriptionAr: 'حفظ 5 سور كاملة',
            descriptionEn: 'Memorized 5 complete surahs',
            icon: '📖'
        },
        JUZ_MASTER: {
            name: 'juz_master',
            nameAr: 'نجم الحفظ',
            nameEn: 'Juz Master',
            descriptionAr: 'حفظ جزء كامل',
            descriptionEn: 'Memorized a complete Juz',
            icon: '🏆'
        },
        WEEK_STREAK: {
            name: 'week_streak',
            nameAr: 'ملتزم ٧ أيام',
            nameEn: '7-Day Streak',
            descriptionAr: 'استمرار لمدة 7 أيام متتالية',
            descriptionEn: 'Maintained a 7-day streak',
            icon: '🔥'
        },
        MONTH_STREAK: {
            name: 'month_streak',
            nameAr: 'ملتزم شهر كامل',
            nameEn: '30-Day Streak',
            descriptionAr: 'استمرار لمدة 30 يوماً متتالية',
            descriptionEn: 'Maintained a 30-day streak',
            icon: '⭐'
        },
        FIFTY_REVIEWS: {
            name: 'fifty_reviews',
            nameAr: 'المُراجع الدؤوب',
            nameEn: 'Dedicated Reviewer',
            descriptionAr: 'إكمال 50 مراجعة',
            descriptionEn: 'Completed 50 reviews',
            icon: '💪'
        },
        PERFECT_TEN: {
            name: 'perfect_ten',
            nameAr: 'عشرة كاملة',
            nameEn: 'Perfect Ten',
            descriptionAr: 'الحصول على 10 تقييمات مثالية متتالية',
            descriptionEn: 'Achieved 10 perfect scores in a row',
            icon: '💯'
        },
        BATTLE_CHAMPION: {
            name: 'battle_champion',
            nameAr: 'بطل المعارك',
            nameEn: 'Battle Champion',
            descriptionAr: 'الفوز بـ 10 معارك',
            descriptionEn: 'Won 10 battles',
            icon: '⚔️'
        }
    };

    /**
     * Award points to a kid for an activity
     *
     * @param {string} kidId - Kid's UUID
     * @param {number} points - Points to award
     * @param {string} activityType - Type of activity
     * @param {string} activityDescription - Description of the activity
     * @param {string} referenceId - Optional reference to related record
     */
    async awardPoints(kidId, points, activityType, activityDescription, referenceId = null) {
        try {
            // Atomically add points (and recalculate level) via SQL function
            const { data: newTotal, error: rpcError } = await supabase
                .rpc('increment_kid_points', { p_kid_id: kidId, p_points: points });

            if (rpcError) throw rpcError;

            // Record in points history
            await supabase
                .from('points_history')
                .insert({
                    kid_id: kidId,
                    points_earned: points,
                    activity_type: activityType,
                    activity_description: activityDescription,
                    reference_id: referenceId != null ? String(referenceId) : null
                });

            return { success: true, totalPoints: newTotal, pointsEarned: points };
        } catch (error) {
            console.error('Error awarding points:', error);
            throw error;
        }
    }

    /**
     * Check and award badge if criteria met
     *
     * @param {string} kidId - Kid's UUID
     * @param {string} badgeName - Badge identifier
     */
    async checkAndAwardBadge(kidId, badgeName) {
        try {
            const badge = this.BADGES[badgeName.toUpperCase()];
            if (!badge) return { awarded: false };

            // Check if badge already exists
            const { data: existingBadge } = await supabase
                .from('badges')
                .select('id')
                .eq('kid_id', kidId)
                .eq('badge_name', badge.name)
                .single();

            if (existingBadge) {
                return { awarded: false, reason: 'already_earned' };
            }

            // Award the badge
            const { data: newBadge, error } = await supabase
                .from('badges')
                .insert({
                    kid_id: kidId,
                    badge_name: badge.name,
                    badge_type: badgeName.toLowerCase(),
                    badge_icon: badge.icon,
                    description_ar: badge.descriptionAr,
                    description_en: badge.descriptionEn
                })
                .select()
                .single();

            if (error) throw error;

            return {
                awarded: true,
                badge: newBadge
            };
        } catch (error) {
            console.error('Error awarding badge:', error);
            throw error;
        }
    }

    /**
     * Update daily streak for a kid
     *
     * @param {string} kidId - Kid's UUID
     */
    async updateStreak(kidId) {
        try {
            const { data: kid, error } = await supabase
                .from('kids')
                .select('last_activity_date, streak_count')
                .eq('id', kidId)
                .single();

            if (error) throw error;

            const today = new Date().toISOString().split('T')[0];
            const lastActivity = kid.last_activity_date;

            let newStreakCount = kid.streak_count;

            if (!lastActivity) {
                // First activity ever
                newStreakCount = 1;
            } else {
                const lastDate = new Date(lastActivity);
                const todayDate = new Date(today);
                const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    // Same day, no change
                    return { streakCount: newStreakCount, streakBonus: 0 };
                } else if (diffDays === 1) {
                    // Consecutive day, increment streak
                    newStreakCount++;
                } else {
                    // Streak broken, reset
                    newStreakCount = 1;
                }
            }

            // Update kid record
            await supabase
                .from('kids')
                .update({
                    streak_count: newStreakCount,
                    last_activity_date: today
                })
                .eq('id', kidId);

            // Award streak bonus points if applicable
            let streakBonus = 0;
            if (newStreakCount > 1) {
                streakBonus = this.POINTS.DAILY_STREAK;
                await this.awardPoints(
                    kidId,
                    streakBonus,
                    'daily_streak',
                    `Maintained ${newStreakCount}-day streak`
                );
            }

            // Check for streak badges
            if (newStreakCount === 7) {
                await this.checkAndAwardBadge(kidId, 'WEEK_STREAK');
            } else if (newStreakCount === 30) {
                await this.checkAndAwardBadge(kidId, 'MONTH_STREAK');
            }

            return { streakCount: newStreakCount, streakBonus };
        } catch (error) {
            console.error('Error updating streak:', error);
            throw error;
        }
    }

    /**
     * Check for milestone badges after verse memorization
     *
     * @param {string} kidId - Kid's UUID
     */
    async checkMemorizationMilestones(kidId) {
        try {
            const badges = [];

            // Count total memorized verses
            const { count: versesCount } = await supabase
                .from('memorized_verses')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kidId);

            // First verse badge
            if (versesCount === 1) {
                const result = await this.checkAndAwardBadge(kidId, 'FIRST_VERSE');
                if (result.awarded) badges.push(result.badge);
            }

            // Count completed surahs
            const { data: completedSurahs } = await supabase
                .from('memorized_verses')
                .select('verse_id, verses!inner(surah_id)')
                .eq('kid_id', kidId);

            // Group by surah and check if all verses are memorized
            const surahCounts = {};
            completedSurahs?.forEach(mv => {
                const surahId = mv.verses.surah_id;
                surahCounts[surahId] = (surahCounts[surahId] || 0) + 1;
            });

            // Get verse counts for each surah
            const surahIds = Object.keys(surahCounts);
            if (surahIds.length > 0) {
                const { data: surahs } = await supabase
                    .from('surahs')
                    .select('id, verses_count')
                    .in('id', surahIds);

                let completedSurahsCount = 0;
                surahs?.forEach(surah => {
                    if (surahCounts[surah.id] === surah.verses_count) {
                        completedSurahsCount++;
                    }
                });

                // Five surahs badge
                if (completedSurahsCount >= 5) {
                    const result = await this.checkAndAwardBadge(kidId, 'FIVE_SURAHS');
                    if (result.awarded) badges.push(result.badge);
                }
            }

            return badges;
        } catch (error) {
            console.error('Error checking memorization milestones:', error);
            throw error;
        }
    }

    /**
     * Get kid's gamification stats
     *
     * @param {string} kidId - Kid's UUID
     */
    async getKidStats(kidId) {
        try {
            const { data: kid } = await supabase
                .from('kids')
                .select('total_points, streak_count, level')
                .eq('id', kidId)
                .single();

            const { data: badges } = await supabase
                .from('badges')
                .select('*')
                .eq('kid_id', kidId)
                .order('earned_at', { ascending: false });

            const { data: leaderboard } = await supabase
                .from('leaderboard')
                .select('global_rank, family_rank')
                .eq('kid_id', kidId)
                .single();

            const { count: versesMemorized } = await supabase
                .from('memorized_verses')
                .select('*', { count: 'exact', head: true })
                .eq('kid_id', kidId);

            return {
                totalPoints: kid?.total_points || 0,
                streakCount: kid?.streak_count || 0,
                level: kid?.level || 1,
                badges: badges || [],
                badgeCount: badges?.length || 0,
                globalRank: leaderboard?.global_rank || null,
                familyRank: leaderboard?.family_rank || null,
                versesMemorized: versesMemorized || 0
            };
        } catch (error) {
            console.error('Error getting kid stats:', error);
            throw error;
        }
    }
}

module.exports = new GamificationService();
