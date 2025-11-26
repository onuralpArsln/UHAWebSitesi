/**
 * Authentication Middleware
 */

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }

    // For GET requests to /cms routes, always redirect to login (browser navigation)
    if (req.method === 'GET' && req.path.startsWith('/cms')) {
        return res.redirect('/cms/login');
    }

    // Check if this is an API-like request (non-GET requests or API routes)
    const isApiRequest = req.path.startsWith('/api/') ||
        req.xhr ||
        (req.path.startsWith('/cms/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method));

    // If it's an API request, return 401
    if (isApiRequest) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Otherwise redirect to login
    res.redirect('/cms/login');
};

const requirePermission = (permission) => {
    return (req, res, next) => {
        // Check if this is an API-like request (POST/PUT/DELETE to /cms routes or JSON accept)
        const isApiRequest = req.path.startsWith('/api/') ||
            req.xhr ||
            req.accepts('json') ||
            (req.path.startsWith('/cms/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method));

        if (!req.session || !req.session.userId) {
            if (isApiRequest) {
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
        if (isApiRequest) {
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
