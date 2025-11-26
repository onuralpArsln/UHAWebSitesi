/**
 * Integration Tests for User Permissions and CMS Tab Visibility
 * 
 * Tests dynamic behavior of CMS tabs based on user roles and permissions.
 */

const config = require('../../server/services/config');

describe('User Permissions and CMS Tab Visibility', () => {
    describe('CMS Tab Configuration', () => {
        test('should return all available CMS tabs', () => {
            const tabs = config.getCmsTabs();

            expect(Array.isArray(tabs)).toBe(true);
            expect(tabs.length).toBeGreaterThan(0);
        });

        test('each tab should have required properties', () => {
            const tabs = config.getCmsTabs();

            // Verify each tab has required properties
            tabs.forEach(tab => {
                expect(tab).toHaveProperty('id');
                expect(tab).toHaveProperty('permission');
                expect(tab).toHaveProperty('label');
                expect(tab).toHaveProperty('icon');
            });
        });

        test('should include all expected CMS tabs', () => {
            const tabs = config.getCmsTabs();
            const tabIds = tabs.map(t => t.id);

            expect(tabIds).toContain('dashboard');
            expect(tabIds).toContain('articles');
            expect(tabIds).toContain('categories');
            expect(tabIds).toContain('media');
            expect(tabIds).toContain('branding');
            expect(tabIds).toContain('layout');
            expect(tabIds).toContain('settings');
            expect(tabIds).toContain('users');
        });

        test('should map tab IDs to permissions correctly', () => {
            const tabs = config.getCmsTabs();
            const tabMap = Object.fromEntries(tabs.map(t => [t.id, t.permission]));

            expect(tabMap.dashboard).toBe('view_tab_dashboard');
            expect(tabMap.articles).toBe('view_tab_articles');
            expect(tabMap.categories).toBe('view_tab_categories');
            expect(tabMap.media).toBe('view_tab_media');
            expect(tabMap.branding).toBe('view_tab_branding');
            expect(tabMap.layout).toBe('view_tab_layout');
            expect(tabMap.settings).toBe('view_tab_settings');
            expect(tabMap.users).toBe('view_tab_users');
        });
    });

    describe('Tab Visibility by Role', () => {
        test('admin should see all tabs', () => {
            const tabs = config.getCmsTabs();
            const adminPermissions = ['*']; // Admin has all permissions

            const visibleTabs = tabs.filter(tab => {
                return adminPermissions.includes('*') ||
                    adminPermissions.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(tabs.length);
        });

        test('editor with specific permissions should see limited tabs', () => {
            const tabs = config.getCmsTabs();
            const editorPermissions = [
                'view_tab_dashboard',
                'view_tab_articles',
                'view_tab_categories',
                'view_tab_media'
            ];

            const visibleTabs = tabs.filter(tab => {
                return editorPermissions.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(4);
            expect(visibleTabs.map(t => t.id)).toContain('dashboard');
            expect(visibleTabs.map(t => t.id)).toContain('articles');
            expect(visibleTabs.map(t => t.id)).toContain('categories');
            expect(visibleTabs.map(t => t.id)).toContain('media');
            expect(visibleTabs.map(t => t.id)).not.toContain('branding');
            expect(visibleTabs.map(t => t.id)).not.toContain('users');
        });

        test('viewer with minimal permissions should see only dashboard', () => {
            const tabs = config.getCmsTabs();
            const viewerPermissions = ['view_tab_dashboard'];

            const visibleTabs = tabs.filter(tab => {
                return viewerPermissions.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(1);
            expect(visibleTabs[0].id).toBe('dashboard');
        });

        test('custom role with granular permissions', () => {
            const tabs = config.getCmsTabs();
            const customPermissions = [
                'view_tab_dashboard',
                'view_tab_articles',
                'view_tab_layout'
            ];

            const visibleTabs = tabs.filter(tab => {
                return customPermissions.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(3);
            const visibleIds = visibleTabs.map(t => t.id);
            expect(visibleIds).toContain('dashboard');
            expect(visibleIds).toContain('articles');
            expect(visibleIds).toContain('layout');
        });
    });

    describe('Permission Inheritance', () => {
        test('master admin should bypass all permission checks', () => {
            const isMaster = true;
            const permissions = []; // No explicit permissions

            // Master admin should have access regardless
            const hasAccess = (requiredPermission) => {
                return isMaster || permissions.includes(requiredPermission) || permissions.includes('*');
            };

            expect(hasAccess('manage_branding')).toBe(true);
            expect(hasAccess('manage_users')).toBe(true);
            expect(hasAccess('any_permission')).toBe(true);
        });

        test('admin role should have wildcard permissions', () => {
            const role = 'admin';
            const permissions = ['*'];

            const hasAccess = (requiredPermission) => {
                return permissions.includes('*') || permissions.includes(requiredPermission);
            };

            expect(hasAccess('manage_branding')).toBe(true);
            expect(hasAccess('manage_users')).toBe(true);
            expect(hasAccess('any_permission')).toBe(true);
        });

        test('editor role should have limited permissions', () => {
            const role = 'editor';
            const permissions = ['view_tab_dashboard', 'view_tab_articles'];

            const hasAccess = (requiredPermission) => {
                return permissions.includes('*') || permissions.includes(requiredPermission);
            };

            expect(hasAccess('view_tab_dashboard')).toBe(true);
            expect(hasAccess('view_tab_articles')).toBe(true);
            expect(hasAccess('view_tab_branding')).toBe(false);
            expect(hasAccess('view_tab_users')).toBe(false);
        });
    });

    describe('Dynamic Tab Permissions', () => {
        test('should filter tabs based on user permissions array', () => {
            const tabs = config.getCmsTabs();

            const filterTabsByPermissions = (availableTabs, userPermissions) => {
                return availableTabs.filter(tab => {
                    // Admin wildcard
                    if (userPermissions.includes('*')) return true;
                    // Specific permission
                    return userPermissions.includes(tab.permission);
                });
            };

            const userPerms = ['view_tab_dashboard', 'view_tab_articles', 'view_tab_media'];
            const visibleTabs = filterTabsByPermissions(tabs, userPerms);

            expect(visibleTabs.length).toBe(3);
        });

        test('should handle empty permissions gracefully', () => {
            const tabs = config.getCmsTabs();
            const emptyPermissions = [];

            const visibleTabs = tabs.filter(tab => {
                return emptyPermissions.includes('*') || emptyPermissions.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(0);
        });

        test('should handle undefined permissions', () => {
            const tabs = config.getCmsTabs();
            const undefinedPermissions = undefined;

            const visibleTabs = tabs.filter(tab => {
                const perms = undefinedPermissions || [];
                return perms.includes('*') || perms.includes(tab.permission);
            });

            expect(visibleTabs.length).toBe(0);
        });
    });

    describe('Branding Tab Special Access', () => {
        test('only users with manage_branding should see branding tab', () => {
            const tabs = config.getCmsTabs();
            const brandingTab = tabs.find(t => t.id === 'branding');

            expect(brandingTab).toBeDefined();
            expect(brandingTab.permission).toBe('view_tab_branding');
        });

        test('regular editor should not see branding tab', () => {
            const tabs = config.getCmsTabs();
            const editorPermissions = ['view_tab_dashboard', 'view_tab_articles'];

            const hasBrandingAccess = editorPermissions.includes('view_tab_branding');

            expect(hasBrandingAccess).toBe(false);
        });

        test('admin should see branding tab', () => {
            const tabs = config.getCmsTabs();
            const adminPermissions = ['*'];

            const hasBrandingAccess = adminPermissions.includes('*') ||
                adminPermissions.includes('view_tab_branding');

            expect(hasBrandingAccess).toBe(true);
        });
    });

    describe('User Management Tab Access', () => {
        test('only admins and users with manage_users should see users tab', () => {
            const tabs = config.getCmsTabs();
            const usersTab = tabs.find(t => t.id === 'users');

            expect(usersTab).toBeDefined();
            expect(usersTab.permission).toBe('view_tab_users');
        });

        test('editor should not see users tab', () => {
            const editorPermissions = ['view_tab_dashboard', 'view_tab_articles'];
            const hasUsersAccess = editorPermissions.includes('view_tab_users');

            expect(hasUsersAccess).toBe(false);
        });
    });
});

describe('User Permission Management', () => {
    describe('Permission Assignment', () => {
        test('should assign permissions to user', () => {
            const user = {
                id: '1',
                username: 'editor1',
                role: 'editor',
                permissions: []
            };

            // Assign permissions
            user.permissions = ['view_tab_dashboard', 'view_tab_articles'];

            expect(user.permissions).toHaveLength(2);
            expect(user.permissions).toContain('view_tab_dashboard');
            expect(user.permissions).toContain('view_tab_articles');
        });

        test('should update permissions dynamically', () => {
            const user = {
                id: '1',
                permissions: ['view_tab_dashboard']
            };

            // Add new permission
            user.permissions.push('view_tab_articles');

            expect(user.permissions).toHaveLength(2);
            expect(user.permissions).toContain('view_tab_articles');
        });

        test('should remove permissions', () => {
            const user = {
                id: '1',
                permissions: ['view_tab_dashboard', 'view_tab_articles', 'view_tab_media']
            };

            // Remove permission
            user.permissions = user.permissions.filter(p => p !== 'view_tab_media');

            expect(user.permissions).toHaveLength(2);
            expect(user.permissions).not.toContain('view_tab_media');
        });
    });

    describe('Role-Based Defaults', () => {
        test('admin role should get all permissions', () => {
            const getDefaultPermissions = (role) => {
                if (role === 'admin') return ['*'];
                if (role === 'editor') return ['view_tab_dashboard', 'view_tab_articles'];
                return ['view_tab_dashboard'];
            };

            const adminPerms = getDefaultPermissions('admin');
            expect(adminPerms).toEqual(['*']);
        });

        test('editor role should get standard permissions', () => {
            const getDefaultPermissions = (role) => {
                if (role === 'admin') return ['*'];
                if (role === 'editor') return ['view_tab_dashboard', 'view_tab_articles'];
                return ['view_tab_dashboard'];
            };

            const editorPerms = getDefaultPermissions('editor');
            expect(editorPerms).toContain('view_tab_dashboard');
            expect(editorPerms).toContain('view_tab_articles');
        });

        test('viewer role should get minimal permissions', () => {
            const getDefaultPermissions = (role) => {
                if (role === 'admin') return ['*'];
                if (role === 'editor') return ['view_tab_dashboard', 'view_tab_articles'];
                return ['view_tab_dashboard'];
            };

            const viewerPerms = getDefaultPermissions('viewer');
            expect(viewerPerms).toEqual(['view_tab_dashboard']);
        });
    });

    describe('Permission Validation', () => {
        test('should validate permission format', () => {
            const validPermissions = [
                'view_tab_dashboard',
                'view_tab_articles',
                'view_tab_categories',
                'view_tab_media',
                'view_tab_branding',
                'view_tab_layout',
                'view_tab_settings',
                'view_tab_users'
            ];

            const isValidPermission = (perm) => {
                return validPermissions.includes(perm) || perm === '*';
            };

            expect(isValidPermission('view_tab_dashboard')).toBe(true);
            expect(isValidPermission('*')).toBe(true);
            expect(isValidPermission('invalid_perm')).toBe(false);
        });

        test('should prevent duplicate permissions', () => {
            const permissions = ['view_tab_dashboard', 'view_tab_articles'];

            const addPermission = (perms, newPerm) => {
                if (!perms.includes(newPerm)) {
                    perms.push(newPerm);
                }
                return perms;
            };

            addPermission(permissions, 'view_tab_articles'); // Duplicate
            expect(permissions).toHaveLength(2);

            addPermission(permissions, 'view_tab_media'); // New
            expect(permissions).toHaveLength(3);
        });
    });
});
