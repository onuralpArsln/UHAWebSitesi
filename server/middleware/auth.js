/**
 * Authentication Middleware
 */

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }

    // If it's an API request, return 401
    if (req.path.startsWith('/api/') || req.xhr) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Otherwise redirect to login
    res.redirect('/cms/login');
};

const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            if (req.path.startsWith('/api/') || req.xhr) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/cms/login');
        }

        // Master admin has all permissions
        if (req.session.isMaster || req.session.role === 'admin') {
            return next();
        }

        // Check specific permission
        if (req.session.permissions && req.session.permissions.includes(permission)) {
            return next();
        }

        // Forbidden
        if (req.path.startsWith('/api/') || req.xhr) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        res.status(403).render('cms/pages/error.njk', {
            error: 'Bu işlemi yapmaya yetkiniz yok.'
        });
    };
};

module.exports = {
    requireAuth,
    requirePermission
};
