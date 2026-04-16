(function () {
    const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const publicPages = new Set(['index.html', '']);
    const pageRegistry = {
        'dashboard.html': { moduleKey: 'dashboard', defaultHome: 'dashboard.html' },
        'students.html': { moduleKey: 'students', defaultHome: 'students.html' },
        'teachers.html': { moduleKey: 'teachers', defaultHome: 'dashboard.html' },
        'staff.html': { moduleKey: 'staff', defaultHome: 'dashboard.html' },
        'classes.html': { moduleKey: 'classes', defaultHome: 'dashboard.html' },
        'fees.html': { moduleKey: 'fees', defaultHome: 'dashboard.html' },
        'fee_challan.html': { moduleKey: 'fee_challan', defaultHome: 'dashboard.html' },
        'teacher_salaries.html': { moduleKey: 'teacher_salaries', defaultHome: 'dashboard.html' },
        'student_attendance.html': { moduleKey: 'student_attendance', defaultHome: 'dashboard.html' },
        'teacher_attendance.html': { moduleKey: 'teacher_attendance', defaultHome: 'dashboard.html' },
        'student_attendance_report.html': { moduleKey: 'student_attendance_report', defaultHome: 'dashboard.html' },
        'teacher_attendance_report.html': { moduleKey: 'teacher_attendance_report', defaultHome: 'dashboard.html' },
        'notifications.html': { moduleKey: 'notifications', defaultHome: 'dashboard.html' },
        'exams.html': { moduleKey: 'exams', defaultHome: 'dashboard.html' },
        'revenue.html': { moduleKey: 'revenue', defaultHome: 'dashboard.html' },
        'settings.html': { moduleKey: 'settings', defaultHome: 'dashboard.html' },
        'permissions.html': { moduleKey: 'permissions', defaultHome: 'dashboard.html' },
        'branch_registration.html': { moduleKey: 'branch_registration', defaultHome: 'dashboard.html' },
        'aboutme.html': { moduleKey: 'aboutme', defaultHome: 'dashboard.html' },
        'student_portal.html': { moduleKey: 'student_portal', defaultHome: 'student_portal.html' },
        'teacher_portal.html': { moduleKey: 'teacher_portal', defaultHome: 'teacher_portal.html' },
        'staff_portal.html': { moduleKey: 'staff_portal', defaultHome: 'staff_portal.html' },
        'principal_portal.html': { moduleKey: 'principal_portal', defaultHome: 'principal_portal.html' }
    };

    const defaultPermissions = {
        loginAccess: {
            admin: true,
            principal: true,
            branch: true,
            teacher: true,
            student: true,
            staff: true
        },
        roleGroups: {
            Admin: 'admin',
            Principal: 'principal',
            Branch: 'branch_manager',
            Teacher: 'teacher',
            Student: 'student',
            Staff: 'staff'
        },
        groups: {
            admin: {
                name: 'System Administrators',
                homePage: 'dashboard.html',
                permissions: {}
            }
        }
    };

    const rawUser = sessionStorage.getItem('loggedInUser');
    const authToken = sessionStorage.getItem('eduCore_token');
    let loggedInUser = null;

    try {
        loggedInUser = rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
        loggedInUser = null;
    }

    function normalizePermissionsConfig(input = {}) {
        const raw = input && typeof input === 'object' ? input : {};
        const moduleKeys = [...new Set(Object.values(pageRegistry).map((entry) => entry.moduleKey).filter(Boolean))];
        const rawGroups = raw.groups && typeof raw.groups === 'object'
            ? raw.groups
            : defaultPermissions.groups;
        const groups = Object.entries(rawGroups).reduce((acc, [groupKey, group]) => {
            const nextGroup = group && typeof group === 'object' ? group : {};
            const permissions = { ...(nextGroup.permissions || {}) };
            moduleKeys.forEach((moduleKey) => {
                if (!permissions[moduleKey]) permissions[moduleKey] = groupKey === 'admin' ? 'manage' : 'none';
            });
            if (groupKey === 'principal' && !nextGroup.permissions?.notifications) {
                permissions.notifications = 'view';
            }
            acc[groupKey] = {
                ...nextGroup,
                name: nextGroup.name || groupKey,
                homePage: nextGroup.homePage || (groupKey === 'admin' ? 'dashboard.html' : 'dashboard.html'),
                permissions
            };
            return acc;
        }, {});

        return {
            loginAccess: {
                ...defaultPermissions.loginAccess,
                ...(raw.loginAccess || {})
            },
            roleGroups: {
                ...defaultPermissions.roleGroups,
                ...(raw.roleGroups || {})
            },
            groups
        };
    }

    function getApiBaseUrl() {
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('10.') ||
            window.location.hostname.startsWith('172.') ||
            window.location.protocol === 'file:';

        const backendUrl = isLocalhost
            ? (window.location.protocol === 'file:' ? 'http://localhost:3000' : `${window.location.protocol}//${window.location.hostname}:3000`)
            : (window.ENV_BACKEND_URL || window.location.origin);

        return `${backendUrl}/api`;
    }

    function getUserGroupKey(user, permissions) {
        if (!user) return '';
        return user.groupKey || permissions.roleGroups[user.role] || String(user.role || '').toLowerCase();
    }

    function getGroupConfig(user, permissions) {
        const groupKey = getUserGroupKey(user, permissions);
        return permissions.groups[groupKey] || null;
    }

    function getHomePage(user, permissions) {
        const group = getGroupConfig(user, permissions);
        const registryEntry = pageRegistry[currentPage];
        if (group && group.homePage) return group.homePage;
        if (registryEntry && registryEntry.defaultHome) return registryEntry.defaultHome;

        if (user?.role === 'Admin') return 'dashboard.html';
        if (user?.role === 'Teacher') return 'teacher_portal.html';
        if (user?.role === 'Student') return 'student_portal.html';
        if (user?.role === 'Branch') return 'students.html';
        if (user?.role === 'Staff') return 'staff_portal.html';
        if (user?.role === 'Principal') return 'principal_portal.html';
        return 'index.html';
    }

    function getModuleAccess(user, permissions, pageName = currentPage) {
        if (user?.role === 'Admin') return 'manage';
        const registryEntry = pageRegistry[pageName];
        if (!registryEntry) return 'view';
        const group = getGroupConfig(user, permissions);
        return group?.permissions?.[registryEntry.moduleKey] || 'none';
    }

    function canAccessPage(user, permissions, pageName = currentPage) {
        if (publicPages.has(pageName)) return true;
        if (!user || !authToken) return false;

        const roleKey = String(user.role || '').toLowerCase();
        if (permissions.loginAccess[roleKey] === false) {
            return false;
        }

        if (user.role === 'Admin') return true;
        return getModuleAccess(user, permissions, pageName) !== 'none';
    }

    function redirectToAllowedHome(user, permissions) {
        window.location.replace(getHomePage(user, permissions));
    }

    function forceLoginRedirect() {
        sessionStorage.removeItem('loggedInUser');
        sessionStorage.removeItem('eduCore_token');
        sessionStorage.removeItem('eduCore_student_profile');
        sessionStorage.removeItem('eduCore_permissions_config');
        window.location.replace('index.html');
    }

    async function fetchPermissionsConfig() {
        const cached = sessionStorage.getItem('eduCore_permissions_config');
        if (cached) {
            try {
                return normalizePermissionsConfig(JSON.parse(cached));
            } catch (error) {
                sessionStorage.removeItem('eduCore_permissions_config');
            }
        }

        try {
            const response = await fetch(`${getApiBaseUrl()}/permissions`);
            const data = await response.json();
            const normalized = normalizePermissionsConfig(data);
            sessionStorage.setItem('eduCore_permissions_config', JSON.stringify(normalized));
            return normalized;
        } catch (error) {
            return normalizePermissionsConfig(defaultPermissions);
        }
    }

    function applyNavPermissions(user, permissions) {
        document.addEventListener('DOMContentLoaded', () => {
            const navLinks = document.querySelectorAll('.nav-links a[href]');
            navLinks.forEach((link) => {
                const href = String(link.getAttribute('href') || '').toLowerCase();
                if (!href || href === '#') return;
                if (href === 'settings.html' || href === 'aboutme.html') return;
                if (!pageRegistry[href]) return;
                if (!canAccessPage(user, permissions, href)) {
                    link.style.display = 'none';
                }
            });
        });
    }

    function startActiveSessionTracking() {
        if (!loggedInUser || !authToken || publicPages.has(currentPage)) return;

        const sendHeartbeat = () => {
            fetch(`${getApiBaseUrl()}/session/heartbeat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page: currentPage })
            }).catch(() => {});
        };

        sendHeartbeat();
        window.setInterval(sendHeartbeat, 30000);
    }

    window.eduCoreAuth = {
        pageRegistry,
        defaultPermissions,
        normalizePermissionsConfig,
        getUserGroupKey,
        getGroupConfig,
        getModuleAccess,
        canAccessPage
    };

    (async () => {
        const permissions = await fetchPermissionsConfig();
        applyNavPermissions(loggedInUser, permissions);

        if (publicPages.has(currentPage)) {
            if (loggedInUser && authToken) {
                redirectToAllowedHome(loggedInUser, permissions);
            }
            return;
        }

        if (!loggedInUser || !authToken) {
            forceLoginRedirect();
            return;
        }

        if (!canAccessPage(loggedInUser, permissions, currentPage)) {
            redirectToAllowedHome(loggedInUser, permissions);
        }

        startActiveSessionTracking();
    })();
})();

function logoutUser(event) {
    if (event) event.preventDefault();
    const token = sessionStorage.getItem('eduCore_token');
    if (token) {
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('10.') ||
            window.location.hostname.startsWith('172.') ||
            window.location.protocol === 'file:';
        const backendUrl = isLocalhost
            ? (window.location.protocol === 'file:' ? 'http://localhost:3000' : `${window.location.protocol}//${window.location.hostname}:3000`)
            : (window.ENV_BACKEND_URL || window.location.origin);

        fetch(`${backendUrl}/api/session/end`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
    }
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.removeItem('eduCore_token');
    sessionStorage.removeItem('eduCore_student_profile');
    sessionStorage.removeItem('eduCore_permissions_config');
    window.location.href = 'index.html';
}
