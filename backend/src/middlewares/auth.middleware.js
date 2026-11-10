const { supabase, supabaseAuth } = require('../config/supabase');

/**
 * Middleware to verify JWT token from Supabase Auth
 */
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No authorization token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token with Supabase
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

/**
 * Middleware to verify kid belongs to authenticated user
 */
const verifyKidOwnership = async (req, res, next) => {
    try {
        const kidId = req.params.kidId || req.body.kid_id;
        const userId = req.user.id;

        const { data: kid, error } = await supabase
            .from('kids')
            .select('id, user_id')
            .eq('id', kidId)
            .single();

        if (error || !kid) {
            return res.status(404).json({
                success: false,
                message: 'Kid profile not found'
            });
        }

        if (kid.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this kid profile'
            });
        }

        req.kid = kid;
        next();
    } catch (error) {
        console.error('Kid ownership verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification error'
        });
    }
};

/**
 * Middleware to check subscription tier
 */
const checkSubscription = (requiredTier = 'free') => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;

            const { data: user, error } = await supabase
                .from('users')
                .select('subscription_tier, subscription_expires_at')
                .eq('id', userId)
                .single();

            if (error || !user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if subscription is expired
            if (user.subscription_expires_at) {
                const expirationDate = new Date(user.subscription_expires_at);
                if (expirationDate < new Date()) {
                    return res.status(403).json({
                        success: false,
                        message: 'Subscription expired'
                    });
                }
            }

            // Check tier hierarchy: free < pro < family
            const tierHierarchy = { free: 0, pro: 1, family: 2 };
            const userTierLevel = tierHierarchy[user.subscription_tier] || 0;
            const requiredTierLevel = tierHierarchy[requiredTier] || 0;

            if (userTierLevel < requiredTierLevel) {
                return res.status(403).json({
                    success: false,
                    message: `This feature requires ${requiredTier} subscription`,
                    currentTier: user.subscription_tier,
                    requiredTier
                });
            }

            req.userSubscription = user;
            next();
        } catch (error) {
            console.error('Subscription check error:', error);
            res.status(500).json({
                success: false,
                message: 'Subscription verification error'
            });
        }
    };
};

module.exports = {
    authenticateUser,
    verifyKidOwnership,
    checkSubscription
};
