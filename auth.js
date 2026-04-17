(function installAppPopups() {
    if (window.showAppAlert && window.showAppConfirm) return;

    const nativeAlert = window.alert ? window.alert.bind(window) : null;
    let activePopup = null;

    function escapePopupText(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function ensurePopupElement() {
        if (activePopup) return activePopup;
        if (!document.body) return null;

        const overlay = document.createElement('div');
        overlay.className = 'app-popup-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="app-popup-modal">
                <div class="app-popup-icon"><i data-lucide="check-circle-2"></i></div>
                <h2 class="app-popup-title">Message</h2>
                <div class="app-popup-message"></div>
                <div class="app-popup-actions"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        activePopup = overlay;
        return activePopup;
    }

    function closePopup(resolve, value) {
        const popup = ensurePopupElement();
        if (popup) popup.classList.remove('active');
        if (resolve) resolve(value);
    }

    function showAppDialog({ message, title = 'Message', confirm = false, confirmText = 'OK', cancelText = 'Cancel' }) {
        const popup = ensurePopupElement();
        if (!popup) {
            if (nativeAlert) nativeAlert(message);
            return Promise.resolve(confirm ? false : undefined);
        }

        popup.querySelector('.app-popup-title').textContent = title;
        popup.querySelector('.app-popup-message').innerHTML = escapePopupText(message);
        popup.querySelector('.app-popup-actions').innerHTML = confirm
            ? `<button type="button" class="app-popup-button secondary" data-popup-cancel>${escapePopupText(cancelText)}</button><button type="button" class="app-popup-button" data-popup-confirm>${escapePopupText(confirmText)}</button>`
            : `<button type="button" class="app-popup-button" data-popup-confirm>${escapePopupText(confirmText)}</button>`;
        popup.classList.add('active');

        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

        const confirmButton = popup.querySelector('[data-popup-confirm]');
        const cancelButton = popup.querySelector('[data-popup-cancel]');
        confirmButton.focus();

        return new Promise((resolve) => {
            const cleanup = () => {
                confirmButton.removeEventListener('click', handleConfirm);
                if (cancelButton) cancelButton.removeEventListener('click', handleCancel);
                document.removeEventListener('keydown', handleKeydown);
            };

            const handleConfirm = () => {
                cleanup();
                closePopup(resolve, confirm ? true : undefined);
            };

            const handleCancel = () => {
                cleanup();
                closePopup(resolve, false);
            };

            const handleKeydown = (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancel();
                }
            };

            confirmButton.addEventListener('click', handleConfirm);
            if (cancelButton) cancelButton.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleKeydown);
        });
    }

    window.showAppAlert = (message, title = 'Message') => showAppDialog({ message, title, confirmText: 'OK' });
    window.showAppConfirm = (message, title = 'Confirm Action') => showAppDialog({
        message,
        title,
        confirm: true,
        confirmText: 'Confirm',
        cancelText: 'Cancel'
    });
    window.alert = (message) => {
        window.showAppAlert(message);
    };
})();

(function () {
    const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const publicPages = new Set(['index.html', '']);
    const pageRegistry = {
        'dashboard.html': { moduleKey: 'dashboard', defaultHome: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
        'students.html': { moduleKey: 'students', defaultHome: 'students.html', label: 'Students', icon: 'users' },
        'teachers.html': { moduleKey: 'teachers', defaultHome: 'dashboard.html', label: 'Teachers', icon: 'book-open' },
        'staff.html': { moduleKey: 'staff', defaultHome: 'dashboard.html', label: 'Staff', icon: 'briefcase' },
        'classes.html': { moduleKey: 'classes', defaultHome: 'dashboard.html', label: 'Classes', icon: 'school' },
        'fees.html': { moduleKey: 'fees', defaultHome: 'dashboard.html', label: 'Fees', icon: 'credit-card' },
        'fee_challan.html': { moduleKey: 'fee_challan', defaultHome: 'dashboard.html', label: 'Fee Challan', icon: 'file-text' },
        'teacher_salaries.html': { moduleKey: 'teacher_salaries', defaultHome: 'dashboard.html', label: 'Salaries', icon: 'wallet' },
        'student_attendance.html': { moduleKey: 'student_attendance', defaultHome: 'dashboard.html', label: 'Student Attendance', icon: 'calendar-check' },
        'teacher_attendance.html': { moduleKey: 'teacher_attendance', defaultHome: 'dashboard.html', label: 'Teacher Attendance', icon: 'clipboard-check' },
        'student_attendance_report.html': { moduleKey: 'student_attendance_report', defaultHome: 'dashboard.html', label: 'Student Attendance Report', icon: 'bar-chart-3' },
        'teacher_attendance_report.html': { moduleKey: 'teacher_attendance_report', defaultHome: 'dashboard.html', label: 'Teacher Attendance Report', icon: 'line-chart' },
        'notifications.html': { moduleKey: 'notifications', defaultHome: 'dashboard.html', label: 'Notifications', icon: 'bell' },
        'special_notices.html': { moduleKey: 'special_notices', defaultHome: 'dashboard.html', label: 'Special Notices', icon: 'megaphone' },
        'exams.html': { moduleKey: 'exams', defaultHome: 'dashboard.html', label: 'Exams', icon: 'clipboard-list' },
        'revenue.html': { moduleKey: 'revenue', defaultHome: 'dashboard.html', label: 'Revenue', icon: 'trending-up' },
        'settings.html': { moduleKey: 'settings', defaultHome: 'dashboard.html', label: 'Settings', icon: 'settings' },
        'permissions.html': { moduleKey: 'permissions', defaultHome: 'dashboard.html', label: 'Permissions', icon: 'shield' },
        'branch_registration.html': { moduleKey: 'branch_registration', defaultHome: 'dashboard.html', label: 'Branch Registration', icon: 'building-2' },
        'aboutme.html': { moduleKey: 'aboutme', defaultHome: 'dashboard.html', label: 'About Us', icon: 'info' },
        'student_portal.html': { moduleKey: 'student_portal', defaultHome: 'student_portal.html', label: 'Student Portal', icon: 'graduation-cap' }
    };
    const portalPages = new Set(['student_portal.html']);

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
            },
            principal: {
                name: 'Principal Group',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', teachers: 'view', staff: 'view' }
            },
            branch_manager: {
                name: 'Branch Managers',
                homePage: 'students.html',
                permissions: { students: 'manage', dashboard: 'view', classes: 'view' }
            },
            teacher: {
                name: 'Teachers',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', classes: 'view', student_attendance: 'edit', exams: 'edit' }
            },
            senior_teacher: {
                name: 'Senior Teachers',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', teachers: 'view', classes: 'view', student_attendance: 'edit', exams: 'edit' }
            },
            coordinator: {
                name: 'Coordinators',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', teachers: 'view', classes: 'manage', student_attendance: 'manage', exams: 'edit' }
            },
            student: {
                name: 'Students',
                homePage: 'student_portal.html',
                permissions: { student_portal: 'manage', fees: 'view', fee_challan: 'view', exams: 'view' }
            },
            staff: {
                name: 'Staff',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view' }
            },
            accountant: {
                name: 'Accountants',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', fees: 'manage', fee_challan: 'manage', revenue: 'view' }
            },
            receptionist: {
                name: 'Receptionists',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', fees: 'view', fee_challan: 'view' }
            },
            office_assistant: {
                name: 'Office Assistants',
                homePage: 'dashboard.html',
                permissions: { dashboard: 'view', students: 'view', classes: 'view' }
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

    function normalizeCustomModules(modules = []) {
        const builtInPages = new Set(Object.entries(pageRegistry)
            .filter(([, config]) => !config.custom)
            .map(([page]) => page));
        const seen = new Set();
        return (Array.isArray(modules) ? modules : []).map((module) => {
            const key = String(module.key || module.page || module.label || '')
                .trim()
                .toLowerCase()
                .replace(/\.html$/i, '')
                .replace(/[^a-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '');
            const page = String(module.page || `${key}.html`).trim();
            return {
                key,
                label: String(module.label || key).trim(),
                page,
                category: String(module.category || 'Custom').trim() || 'Custom',
                icon: String(module.icon || 'folder').trim() || 'folder',
                custom: true
            };
        }).filter((module) => {
            if (!module.key || !module.page || builtInPages.has(module.page) || seen.has(module.key)) return false;
            seen.add(module.key);
            return true;
        });
    }

    function registerCustomModules(customModules = []) {
        normalizeCustomModules(customModules).forEach((module) => {
            pageRegistry[module.page] = {
                moduleKey: module.key,
                defaultHome: 'dashboard.html',
                label: module.label,
                icon: module.icon,
                custom: true
            };
        });
    }

    function normalizePermissionsConfig(input = {}) {
        const raw = input && typeof input === 'object' ? input : {};
        registerCustomModules(raw.customModules || []);
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
            if (groupKey === 'principal' && !nextGroup.permissions?.special_notices) {
                permissions.special_notices = 'manage';
            }
            acc[groupKey] = {
                ...nextGroup,
                name: nextGroup.name || groupKey,
                homePage: pageRegistry[nextGroup.homePage] ? nextGroup.homePage : 'dashboard.html',
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
            customModules: normalizeCustomModules(raw.customModules || []),
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

    function runWhenReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
            return;
        }
        callback();
    }

    function getHomePage(user, permissions) {
        const group = getGroupConfig(user, permissions);
        const registryEntry = pageRegistry[currentPage];
        if (user?.role === 'Admin' && group?.homePage) return group.homePage;
        if (group && group.homePage) {
            const homeEntry = pageRegistry[group.homePage];
            if (!homeEntry || group.permissions?.[homeEntry.moduleKey] !== 'none') {
                return group.homePage;
            }
        }
        if (group) {
            const firstAllowed = Object.entries(pageRegistry).find(([, entry]) => group.permissions?.[entry.moduleKey] !== 'none');
            if (firstAllowed) return firstAllowed[0];
        }
        if (registryEntry && registryEntry.defaultHome) return registryEntry.defaultHome;

        if (user?.role === 'Admin') return 'dashboard.html';
        if (user?.role === 'Student') return 'student_portal.html';
        if (user?.role === 'Branch') return 'students.html';
        if (user?.role === 'Teacher' || user?.role === 'Staff' || user?.role === 'Principal') return 'dashboard.html';
        return 'index.html';
    }

    function getModuleAccess(user, permissions, pageName = currentPage) {
        if (user?.role === 'Admin') return 'manage';
        const registryEntry = pageRegistry[pageName];
        if (!registryEntry) return 'view';
        const group = getGroupConfig(user, permissions);
        return group?.permissions?.[registryEntry.moduleKey] || 'none';
    }

    function getAccessibleModules(user, permissions) {
        return Object.entries(pageRegistry)
            .map(([pageName, pageConfig]) => ({
                pageName,
                ...pageConfig,
                access: getModuleAccess(user, permissions, pageName)
            }))
            .filter((item) => item.access !== 'none');
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
        try {
            const response = await fetch(`${getApiBaseUrl()}/permissions`);
            const data = await response.json();
            const normalized = normalizePermissionsConfig(data);
            sessionStorage.setItem('eduCore_permissions_config', JSON.stringify(normalized));
            return normalized;
        } catch (error) {
            if (cached) {
                try {
                    return normalizePermissionsConfig(JSON.parse(cached));
                } catch (cacheError) {
                    sessionStorage.removeItem('eduCore_permissions_config');
                }
            }
            return normalizePermissionsConfig(defaultPermissions);
        }
    }

    function applyNavPermissions(user, permissions) {
        runWhenReady(() => {
            const navLinks = document.querySelectorAll('.nav-links a[href], .user-profile[href]');
            navLinks.forEach((link) => {
                const href = String(link.getAttribute('href') || '').toLowerCase();
                if (!href || href === '#') return;
                if (!pageRegistry[href]) return;
                if (!canAccessPage(user, permissions, href)) {
                    link.style.display = 'none';
                }
            });

            document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
                const visibleLinks = Array.from(dropdown.querySelectorAll('a[href]'))
                    .filter((item) => item.style.display !== 'none');
                if (!visibleLinks.length) dropdown.style.display = 'none';
            });
        });
    }

    function renderDashboardPermissionCards(user, permissions) {
        if (currentPage !== 'dashboard.html' || !user || !authToken) return;

        runWhenReady(() => {
            const grid = document.getElementById('dashboardStatsGrid');
            if (!grid) return;

            const existingCards = Array.from(grid.querySelectorAll('a.card[href]'));
            const existingPages = new Set(existingCards.map((card) => String(card.getAttribute('href') || '').toLowerCase()));

            existingCards.forEach((card) => {
                const href = String(card.getAttribute('href') || '').toLowerCase();
                if (!href || !pageRegistry[href]) return;
                if (!canAccessPage(user, permissions, href)) {
                    card.remove();
                    existingPages.delete(href);
                }
            });

            grid.querySelectorAll('[data-admin-only-card]').forEach((card) => {
                if (user.role !== 'Admin') card.remove();
            });

            // Keep only the first 5 dashboard cards and prevent permission modules from adding additional cards.
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

            if (!grid.querySelector('.card')) {
                const empty = document.createElement('div');
                empty.className = 'card';
                empty.innerHTML = `
                    <div class="card-title">No Options Enabled</div>
                    <div class="card-value">0</div>
                    <div class="card-trend">Ask admin to assign permissions</div>
                    <div class="card-icon"><i data-lucide="shield-alert"></i></div>
                `;
                grid.appendChild(empty);
            }

            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        });
    }

    function applySignedInUserLabels(user) {
        if (!user) return;

        runWhenReady(() => {
            const displayName = user.fullName || user.username || user.role || 'User';
            const initials = displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('') || 'U';

            document.querySelectorAll('.user-profile .avatar').forEach((avatar) => {
                avatar.textContent = initials;
            });
            document.querySelectorAll('.user-profile .user-info h4').forEach((name) => {
                name.textContent = displayName;
            });
            document.querySelectorAll('.user-profile .user-info p').forEach((role) => {
                role.textContent = user.role || 'User';
            });
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getAccessLabel(access) {
        if (access === 'manage') return 'Full';
        if (access === 'edit') return 'Edit';
        if (access === 'view') return 'View';
        return 'No Access';
    }

    function injectPortalAccessStyles() {
        if (document.getElementById('portalAccessStyles')) return;
        const style = document.createElement('style');
        style.id = 'portalAccessStyles';
        style.textContent = `
            body.portal-dashboard-body {
                background: var(--bg-color) !important;
                height: 100vh;
                overflow: hidden;
            }
            body.portal-dashboard-body .portal-header,
            body.portal-dashboard-body .portal-banner,
            body.portal-dashboard-body .hero {
                display: none;
            }
            body.portal-dashboard-body .portal-container,
            body.portal-dashboard-body .portal-shell,
            body.portal-dashboard-body .principal-wrap {
                max-width: 100%;
                margin: 0;
                padding: 0;
            }
            .portal-dashboard-main {
                flex: 1;
                overflow-y: auto;
                padding: 2rem;
                background: var(--bg-color);
            }
            .portal-dashboard-main .logout-btn {
                display: none;
            }
            .portal-dashboard-overview {
                margin-bottom: 2rem;
            }
            .portal-dashboard-overview .header {
                margin-bottom: 1.5rem;
            }
            .portal-dashboard-overview .stats-grid {
                margin-bottom: 0;
            }
            .portal-dashboard-overview .card {
                min-height: 130px;
            }
            .portal-dashboard-overview .portal-card-access {
                text-transform: capitalize;
            }
            .portal-sidebar-user {
                margin: 1rem;
                padding: 0.9rem;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.92);
            }
            .portal-sidebar-user strong {
                display: block;
                color: #fff;
                font-size: 0.95rem;
                margin-bottom: 0.15rem;
            }
            .portal-sidebar-user span {
                font-size: 0.8rem;
                opacity: 0.82;
            }
            .portal-access-panel {
                background: #fff;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-sm);
                padding: 1.5rem;
                margin: 0 0 1.5rem;
            }
            .portal-access-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;
                margin-bottom: 1rem;
            }
            .portal-access-header h3 { margin: 0; }
            .portal-access-count {
                color: var(--text-secondary);
                font-size: 0.85rem;
                font-weight: 700;
            }
            .portal-access-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                gap: 0.85rem;
            }
            .portal-access-card {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0.8rem;
                align-items: center;
                text-decoration: none;
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 0.95rem;
                background: #f8fafc;
                min-height: 76px;
            }
            .portal-access-card:hover {
                border-color: var(--primary-color);
                background: #f0fdfa;
            }
            .portal-access-icon {
                width: 38px;
                height: 38px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #e0f2fe;
                color: #0369a1;
            }
            .portal-access-title {
                display: block;
                font-weight: 800;
                margin-bottom: 0.25rem;
            }
            .portal-access-meta {
                display: block;
                color: var(--text-secondary);
                font-size: 0.82rem;
                font-weight: 700;
            }
            .portal-access-empty {
                color: var(--text-secondary);
                background: #f8fafc;
                border: 1px dashed var(--border-color);
                border-radius: 8px;
                padding: 1rem;
            }
        `;
        document.head.appendChild(style);
    }

    function buildPortalDashboardOverview(user, permissions) {
        const modules = getAccessibleModules(user, permissions);
        const searchableModules = modules.filter((item) => item.pageName !== currentPage);
        const cards = searchableModules.map((item) => `
            <a href="${escapeHtml(item.pageName)}" class="card" data-portal-module-card>
                <div class="card-title">${escapeHtml(item.label || item.pageName)}</div>
                <div class="card-value">${escapeHtml(getAccessLabel(item.access))}</div>
                <div class="card-trend trend-up">
                    <i data-lucide="trending-up" size="16"></i>
                    <span class="portal-card-access">${escapeHtml(item.access)}</span> Access
                </div>
                <div class="card-icon">
                    <i data-lucide="${escapeHtml(item.icon || 'circle')}"></i>
                </div>
            </a>
        `).join('');

        return `
            <section class="portal-dashboard-overview" id="portalDashboardOverview">
                <header class="header">
                    <div>
                        <h1>Overview</h1>
                        <p style="color:var(--text-secondary); margin-top:0.25rem;">
                            ${escapeHtml(user?.role || 'User')} dashboard
                        </p>
                    </div>
                    <div class="header-actions">
                        <div class="search-bar">
                            <i data-lucide="search" size="18" style="color: var(--text-secondary);"></i>
                            <input type="text" id="portalModuleSearch" placeholder="Search options...">
                        </div>
                    </div>
                </header>
                <div class="stats-grid" id="portalModuleGrid">
                    ${cards || `
                        <div class="card">
                            <div class="card-title">No Options Enabled</div>
                            <div class="card-value">0</div>
                            <div class="card-trend">Ask admin to assign permissions</div>
                            <div class="card-icon"><i data-lucide="shield-alert"></i></div>
                        </div>
                    `}
                </div>
            </section>
        `;
    }

    function attachPortalDashboardSearch() {
        const input = document.getElementById('portalModuleSearch');
        const cards = Array.from(document.querySelectorAll('[data-portal-module-card]'));
        if (!input || !cards.length) return;

        input.addEventListener('input', () => {
            const term = input.value.trim().toLowerCase();
            cards.forEach((card) => {
                card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        });
    }

    function buildPortalSidebar(user, permissions) {
        const modules = getAccessibleModules(user, permissions);
        const navItems = modules.map((item) => `
            <a href="${escapeHtml(item.pageName)}" class="nav-item ${item.pageName === currentPage ? 'active' : ''}">
                <i data-lucide="${escapeHtml(item.icon || 'circle')}"></i>
                <span>${escapeHtml(item.label || item.pageName)}</span>
            </a>
        `).join('');

        const displayName = user?.fullName || user?.username || user?.role || 'User';
        return `
            <aside class="sidebar" data-portal-sidebar>
                <div class="logo-section">
                    <i data-lucide="graduation-cap"></i> Apexiums School System
                </div>
                <div class="portal-sidebar-user">
                    <strong>${escapeHtml(displayName)}</strong>
                    <span>${escapeHtml(user?.role || 'Portal')} Dashboard</span>
                </div>
                <nav class="nav-links">
                    ${navItems}
                    <a href="#" class="nav-item" onclick="logoutUser(event)">
                        <i data-lucide="log-out"></i>
                        <span>Logout</span>
                    </a>
                </nav>
            </aside>
        `;
    }

    function renderPortalDashboardShell(user, permissions) {
        if (!portalPages.has(currentPage) || !user || !authToken) return;

        runWhenReady(() => {
            if (document.querySelector('[data-portal-dashboard-shell]')) return;

            injectPortalAccessStyles();
            const shell = document.createElement('div');
            shell.className = 'dashboard-container';
            shell.dataset.portalDashboardShell = 'true';
            shell.innerHTML = buildPortalSidebar(user, permissions);

            const main = document.createElement('main');
            main.className = 'main-content portal-dashboard-main';
            main.innerHTML = buildPortalDashboardOverview(user, permissions);

            const movableNodes = Array.from(document.body.childNodes).filter((node) => {
                if (node === shell) return false;
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    return tagName !== 'script' && tagName !== 'style';
                }
                return node.nodeType === Node.TEXT_NODE && node.textContent.trim();
            });

            movableNodes.forEach((node) => main.appendChild(node));
            shell.appendChild(main);
            document.body.insertBefore(shell, document.body.firstChild);
            document.body.classList.add('portal-dashboard-body');
            attachPortalDashboardSearch();
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        });
    }

    function renderPortalAccessPanel(user, permissions) {
        if (!portalPages.has(currentPage) || !user || !authToken) return;

        runWhenReady(() => {
            if (document.getElementById('portalDashboardOverview')) return;
            const host = document.querySelector('.portal-container, .portal-shell, .principal-wrap, main');
            if (!host || document.getElementById('portalAccessPanel')) return;

            const modules = getAccessibleModules(user, permissions)
                .filter((item) => item.pageName !== currentPage);
            const panel = document.createElement('section');
            panel.id = 'portalAccessPanel';
            panel.className = 'portal-access-panel';
            panel.innerHTML = `
                <div class="portal-access-header">
                    <h3>Allowed Pages</h3>
                    <div class="portal-access-count">${modules.length} permission${modules.length === 1 ? '' : 's'} enabled</div>
                </div>
                ${modules.length ? `
                    <div class="portal-access-grid">
                        ${modules.map((item) => `
                            <a class="portal-access-card" href="${escapeHtml(item.pageName)}">
                                <span class="portal-access-icon"><i data-lucide="${escapeHtml(item.icon || 'circle')}"></i></span>
                                <span>
                                    <span class="portal-access-title">${escapeHtml(item.label || item.pageName)}</span>
                                    <span class="portal-access-meta">${escapeHtml(getAccessLabel(item.access))} Access</span>
                                </span>
                            </a>
                        `).join('')}
                    </div>
                ` : '<div class="portal-access-empty">No extra pages are enabled for this account.</div>'}
            `;

            injectPortalAccessStyles();
            const firstCard = host.querySelector('.user-card, .profile-card, .overview-grid, .portal-grid, .portal-card');
            if (firstCard && firstCard.nextSibling) {
                host.insertBefore(panel, firstCard.nextSibling);
            } else {
                host.appendChild(panel);
            }
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
        getAccessibleModules,
        getHomePage,
        canAccessPage
    };

    (async () => {
        const permissions = await fetchPermissionsConfig();
        applyNavPermissions(loggedInUser, permissions);
        applySignedInUserLabels(loggedInUser);
        renderDashboardPermissionCards(loggedInUser, permissions);
        renderPortalDashboardShell(loggedInUser, permissions);
        renderPortalAccessPanel(loggedInUser, permissions);

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
