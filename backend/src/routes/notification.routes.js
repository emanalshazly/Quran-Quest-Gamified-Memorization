const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for user
 * @access  Private
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { limit = 50, unread_only = false } = req.query;

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (unread_only === 'true') {
            query = query.eq('is_read', false);
        }

        const { data: notifications, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            count: notifications.length,
            notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:notificationId/read', authenticateUser, async (req, res) => {
    try {
        const { data: notification, error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', req.params.notificationId)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Notification marked as read',
            notification
        });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', req.user.id)
            .eq('is_read', false);

        if (error) throw error;

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all as read'
        });
    }
});

/**
 * @route   POST /api/notifications/schedule
 * @desc    Schedule a notification (for review reminders)
 * @access  Private
 */
router.post('/schedule', authenticateUser, async (req, res) => {
    try {
        const { kid_id, notification_type, title_ar, title_en, message_ar, message_en, scheduled_for } = req.body;

        // Verify kid ownership if kid_id provided
        if (kid_id) {
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
        }

        const { data: notification, error } = await supabase
            .from('notifications')
            .insert({
                user_id: req.user.id,
                kid_id,
                notification_type,
                title_ar,
                title_en,
                message_ar,
                message_en,
                scheduled_for: scheduled_for || new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Notification scheduled',
            notification
        });
    } catch (error) {
        console.error('Schedule notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to schedule notification'
        });
    }
});

module.exports = router;
