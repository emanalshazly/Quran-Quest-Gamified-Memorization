const express = require('express');
const router = express.Router();
const { supabase, supabaseAuth } = require('../config/supabase');
const { authenticateUser } = require('../middlewares/auth.middleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register new parent account
 * @access  Public
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Register with Supabase Auth
        const { data, error } = await supabaseAuth.auth.signUp({
            email,
            password
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Ensure a public.users row exists (the on_auth_user_created DB
        // trigger also does this; the upsert makes it safe either way).
        if (data.user) {
            await supabase
                .from('users')
                .upsert({ id: data.user.id, email: data.user.email }, { onConflict: 'id', ignoreDuplicates: true });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email for verification.',
            user: data.user
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login parent account
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Login with Supabase Auth
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        res.json({
            success: true,
            message: 'Login successful',
            session: data.session,
            user: data.user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabaseAuth.auth.signOut();

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticateUser, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, subscription_tier, subscription_expires_at, created_at')
            .eq('id', req.user.id)
            .single();

        if (error) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user info'
        });
    }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const { error } = await supabaseAuth.auth.resetPasswordForEmail(email);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Password reset email sent'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Password reset failed'
        });
    }
});

module.exports = router;
