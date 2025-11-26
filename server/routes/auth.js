const express = require('express');
const bcrypt = require('bcrypt');
const DataService = require('../services/data-service');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();
const dataService = new DataService();

// Master Admin Credentials (from env or hardcoded fallback for dev)
const MASTER_USER = process.env.MASTER_ADMIN_USER || 'admin';
const MASTER_PASS = process.env.MASTER_ADMIN_PASS || 'admin123';

/**
 * Login Endpoint
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    // 1. Check Master Admin
    if (username === MASTER_USER && password === MASTER_PASS) {
        req.session.userId = 'master-admin';
        req.session.username = MASTER_USER;
        req.session.displayName = 'Master Admin';
        req.session.role = 'admin';
        req.session.isMaster = true;
        req.session.permissions = ['*']; // All permissions

        return res.json({ success: true, redirect: '/cms' });
    }

    // 2. Check Database Users
    const user = dataService.getUserByUsername(username);

    if (user && bcrypt.compareSync(password, user.password_hash)) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.displayName = user.displayName;
        req.session.role = user.role;
        req.session.permissions = user.permissions;
        req.session.allowedTabs = user.allowedTabs || [];
        req.session.isMaster = false;

        // Update last login
        dataService.updateLastLogin(user.id);

        return res.json({ success: true, redirect: '/cms' });
    }

    // Login Failed
    res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
});

/**
 * Logout Endpoint
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Çıkış yapılamadı.' });
        }
        res.clearCookie('connect.sid'); // Default cookie name
        res.json({ success: true, redirect: '/cms/login' });
    });
});

/**
 * Get Current User Info
 */
router.get('/me', requireAuth, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        displayName: req.session.displayName,
        role: req.session.role,
        permissions: req.session.permissions,
        allowedTabs: req.session.allowedTabs,
        isMaster: req.session.isMaster
    });
});

// ==========================================
// User Management Routes (Admin Only)
// ==========================================

/**
 * List Users
 */
router.get('/users', requirePermission('manage_users'), (req, res) => {
    try {
        const users = dataService.getAllUsers();
        // Filter out sensitive data just in case, though parseUser handles it
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
    }
});

/**
 * Create User
 */
router.post('/users', requirePermission('manage_users'), (req, res) => {
    try {
        const { username, password, displayName, role, permissions, allowedTabs } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
        }

        // Check if user exists
        const existing = dataService.getUserByUsername(username);
        if (existing) {
            return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }

        const newUser = dataService.createUser({
            username,
            password,
            displayName,
            role,
            permissions,
            allowedTabs
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
    }
});

/**
 * Update User
 */
router.put('/users/:id', requirePermission('manage_users'), (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Prevent modifying Master Admin via API (though it's not in DB anyway)
        if (id === 'master-admin') {
            return res.status(403).json({ error: 'Master Admin düzenlenemez.' });
        }

        const updatedUser = dataService.updateUser(id, updates);

        if (!updatedUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
    }
});

/**
 * Delete User
 */
router.delete('/users/:id', requirePermission('manage_users'), (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting yourself
        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
        }

        const success = dataService.deleteUser(id);

        if (!success) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Kullanıcı silinemedi.' });
    }
});

module.exports = router;
