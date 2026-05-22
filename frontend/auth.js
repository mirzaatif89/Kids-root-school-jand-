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
    const pageRegistry = {
        'dashboard.html': { moduleKey: 'dashboard', defaultHome: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
        'students.html': { moduleKey: 'students', defaultHome: 'students.html', label: 'Students', icon: 'users' },
        'families.html': { moduleKey: 'families', defaultHome: 'dashboard.html', label: 'Families', icon: 'home' },
        'student_scheduling.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Student Scheduling', icon: 'calendar-clock' },
        'assignments.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Assignments', icon: 'upload' },
        'assignment_uploading.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Upload Assignments', icon: 'file-up' },
        'student_timetable.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Class Timetable', icon: 'calendar-clock' },
        'student_diary.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Class Diary', icon: 'book-open' },
        'student_leave_requests.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Leave Requests', icon: 'calendar-check' },
        'student_courses.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Class Course', icon: 'library' },
        'quiz_uploading.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Quiz Uploading', icon: 'circle-help' },
        'lecture_uploading.html': { moduleKey: 'student_scheduling', defaultHome: 'dashboard.html', label: 'Lecture Uploading', icon: 'presentation' },
        'banners.html': { moduleKey: 'banners', defaultHome: 'dashboard.html', label: 'Banners', icon: 'image' },
        'teachers.html': { moduleKey: 'teachers', defaultHome: 'dashboard.html', label: 'Teachers', icon: 'book-open' },
        'stuck_off.html': { moduleKey: 'students', defaultHome: 'dashboard.html', label: 'Stuck Off', icon: 'user-x' },
        'teacher_scheduling.html': { moduleKey: 'teacher_scheduling', defaultHome: 'dashboard.html', label: 'Teacher Scheduling', icon: 'calendar-days' },
        'teacher_timetable.html': { moduleKey: 'teacher_scheduling', defaultHome: 'dashboard.html', label: 'Teacher Timetable', icon: 'calendar-days' },
        'teacher_assigned_classes.html': { moduleKey: 'teacher_scheduling', defaultHome: 'dashboard.html', label: 'Assigned Classes', icon: 'school' },
        'teacher_leave_requests.html': { moduleKey: 'teacher_scheduling', defaultHome: 'dashboard.html', label: 'Teacher Leave Requests', icon: 'calendar-check' },
        'staff.html': { moduleKey: 'staff', defaultHome: 'dashboard.html', label: 'Staff', icon: 'briefcase' },
        'classes.html': { moduleKey: 'classes', defaultHome: 'dashboard.html', label: 'Classes', icon: 'school' },
        'set_fee.html': { moduleKey: 'fees', defaultHome: 'dashboard.html', label: 'Set Fees', icon: 'badge-dollar-sign' },
        'fees.html': { moduleKey: 'fees', defaultHome: 'dashboard.html', label: 'Fees', icon: 'credit-card' },
        'fee_challan.html': { moduleKey: 'fee_challan', defaultHome: 'dashboard.html', label: 'Fee Challan', icon: 'file-text' },
        'fee_logos.html': { moduleKey: 'fees', defaultHome: 'dashboard.html', label: 'Logos', icon: 'image' },
        'bills.html': { moduleKey: 'bills', defaultHome: 'dashboard.html', label: 'Bills', icon: 'receipt' },
        'library.html': { moduleKey: 'library', defaultHome: 'dashboard.html', label: 'Library', icon: 'library' },
        'cafe.html': { moduleKey: 'cafe', defaultHome: 'dashboard.html', label: 'Cafe', icon: 'coffee' },
        'transport.html': { moduleKey: 'transport', defaultHome: 'dashboard.html', label: 'Transport', icon: 'bus' },
        'certificate.html': { moduleKey: 'certificate', defaultHome: 'dashboard.html', label: 'Certificate', icon: 'award' },
        'complain_box.html': { moduleKey: 'complain_box', defaultHome: 'dashboard.html', label: 'Complain Box', icon: 'message-square' },
        'diary.html': { moduleKey: 'diary', defaultHome: 'dashboard.html', label: 'Diary', icon: 'book-open' },
        'visitor_books.html': { moduleKey: 'visitor_books', defaultHome: 'dashboard.html', label: 'Visitor Books', icon: 'clipboard-list' },
        'annual_charges.html': { moduleKey: 'annual_charges', defaultHome: 'dashboard.html', label: 'Annual Charges', icon: 'receipt' },
        'teacher_salaries.html': { moduleKey: 'teacher_salaries', defaultHome: 'dashboard.html', label: 'Salaries', icon: 'wallet' },
        'student_attendance.html': { moduleKey: 'student_attendance', defaultHome: 'dashboard.html', label: 'Student Attendance', icon: 'calendar-check' },
        'teacher_attendance.html': { moduleKey: 'teacher_attendance', defaultHome: 'dashboard.html', label: 'Teacher Attendance', icon: 'clipboard-check' },
        'student_attendance_report.html': { moduleKey: 'student_attendance_report', defaultHome: 'dashboard.html', label: 'Student Attendance Report', icon: 'bar-chart-3' },
        'teacher_attendance_report.html': { moduleKey: 'teacher_attendance_report', defaultHome: 'dashboard.html', label: 'Teacher Attendance Report', icon: 'line-chart' },
        'notifications.html': { moduleKey: 'notifications', defaultHome: 'dashboard.html', label: 'Notifications', icon: 'bell' },
        'special_notices.html': { moduleKey: 'special_notices', defaultHome: 'dashboard.html', label: 'Special Notices', icon: 'megaphone' },
        'exams.html': { moduleKey: 'exams', defaultHome: 'dashboard.html', label: 'Exams', icon: 'clipboard-list' },
        'exam_schedule.html': { moduleKey: 'exams', defaultHome: 'dashboard.html', label: 'Exam Schedule', icon: 'calendar-days' },
        'exam_result.html': { moduleKey: 'exams', defaultHome: 'dashboard.html', label: 'Result', icon: 'file-badge' },
        'exam_result_history.html': { moduleKey: 'exams', defaultHome: 'dashboard.html', label: 'Student Result History', icon: 'history' },
        'revenue.html': { moduleKey: 'revenue', defaultHome: 'dashboard.html', label: 'Revenue', icon: 'trending-up' },
        'settings.html': { moduleKey: 'settings', defaultHome: 'dashboard.html', label: 'Settings', icon: 'settings' },
        'permissions.html': { moduleKey: 'permissions', defaultHome: 'dashboard.html', label: 'Permissions', icon: 'shield' },
        'designation-permissions.html': { moduleKey: 'permissions', defaultHome: 'dashboard.html', label: 'Designation Permissions', icon: 'shield-check' },
        'branch_registration.html': { moduleKey: 'branch_registration', defaultHome: 'dashboard.html', label: 'Branch Registration', icon: 'building-2' },
        'aboutme.html': { moduleKey: 'aboutme', defaultHome: 'dashboard.html', label: 'About Us', icon: 'info' },
        'student_portal.html': { moduleKey: 'student_portal', defaultHome: 'student_portal.html', label: 'Student Portal', icon: 'graduation-cap' },
        'teacher_portal.html': { moduleKey: 'teacher_portal', defaultHome: 'teacher_portal.html', label: 'Teacher Portal', icon: 'book-user' }
    };
    const portalPages = new Set();
    const routeToPageMap = Object.keys(pageRegistry).reduce((acc, pageName) => {
        const cleanKey = pageName.replace(/\.html$/i, '').toLowerCase();
        acc[cleanKey] = pageName;
        return acc;
    }, { login: 'login.html', index: 'index.html', home: 'index.html' });

    function normalizePageName(pageValue = '') {
        const rawValue = String(pageValue || '').trim().toLowerCase();
        if (!rawValue || rawValue === '/' || rawValue === '.') return 'index.html';

        const withoutHash = rawValue.split('#')[0];
        const withoutQuery = withoutHash.split('?')[0];
        const trimmedPath = withoutQuery.replace(/^\/+|\/+$/g, '');
        if (!trimmedPath) return 'index.html';

        const segment = trimmedPath.split('/').pop() || '';
        if (!segment) return 'index.html';

        if (routeToPageMap[segment]) return routeToPageMap[segment];

        if (segment.endsWith('.html')) {
            const cleanSegment = segment.replace(/\.html$/i, '');
            if (routeToPageMap[cleanSegment]) return routeToPageMap[cleanSegment];
            return segment;
        }

        const asHtml = `${segment}.html`;
        if (pageRegistry[asHtml]) return asHtml;
        return segment;
    }

    function toRoutePath(pageName = '') {
        const normalizedPage = normalizePageName(pageName);
        if (normalizedPage === 'login.html') return '/login';
        if (normalizedPage === 'index.html') return '/';
        if (pageRegistry[normalizedPage]) return `/${normalizedPage.replace(/\.html$/i, '')}`;
        return `/${String(pageName || '').replace(/^\/+/, '') || 'login'}`;
    }

    const currentPage = normalizePageName(window.location.pathname);
    const publicPages = new Set(['index.html', 'login.html']);

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
            Admin: 'superadmin',
            Principal: 'admin',
            Branch: 'computer_operator',
            Teacher: 'teacher',
            Student: 'student',
            Staff: 'computer_operator'
        },
        groups: {
            superadmin: {
                name: 'Superadmin',
                homePage: 'dashboard.html',
                permissions: {}
            },
            admin: {
                name: 'Admin',
                homePage: 'dashboard.html',
                permissions: {
                    dashboard: 'manage',
                    students: 'manage',
                    families: 'manage',
                    student_scheduling: 'manage',
                    banners: 'manage',
                    teachers: 'manage',
                    teacher_scheduling: 'manage',
                    staff: 'manage',
                    classes: 'manage',
                    set_fee: 'manage',
                    fees: 'manage',
                    fee_challan: 'manage',
                    library: 'manage',
                    cafe: 'manage',
                    transport: 'manage',
                    certificate: 'manage',
                    complain_box: 'manage',
                    diary: 'manage',
                    visitor_books: 'manage',
                    annual_charges: 'manage',
                    teacher_salaries: 'manage',
                    student_attendance: 'manage',
                    teacher_attendance: 'manage',
                    student_attendance_report: 'view',
                    teacher_attendance_report: 'view',
                    notifications: 'manage',
                    special_notices: 'manage',
                    exams: 'manage',
                    bills: 'manage',
                    revenue: 'view',
                    settings: 'view',
                    branch_registration: 'view',
                    aboutme: 'view',
                    permissions: 'view',
                    student_portal: 'manage',
                    teacher_portal: 'manage'
                }
            },
            computer_operator: {
                name: 'Computer Operator',
                homePage: 'dashboard.html',
                permissions: {
                    dashboard: 'view',
                    students: 'manage',
                    banners: 'none',
                    teachers: 'view',
                    staff: 'view',
                    classes: 'view',
                    fees: 'view',
                    fee_challan: 'manage',
                    library: 'view',
                    cafe: 'view',
                    transport: 'view',
                    certificate: 'view',
                    complain_box: 'view',
                    diary: 'view',
                    visitor_books: 'view',
                    annual_charges: 'view',
                    student_attendance: 'edit',
                    exams: 'view',
                    notifications: 'view',
                    aboutme: 'view'
                }
            },
            teacher: {
                name: 'Teachers',
                homePage: 'teacher_portal.html',
                permissions: {
                    teacher_portal: 'manage',
                    students: 'view',
                    classes: 'view',
                    student_attendance: 'edit',
                    student_attendance_report: 'view',
                    exams: 'view',
                    special_notices: 'view',
                    aboutme: 'view'
                }
            },
            student: {
                name: 'Students',
                homePage: 'student_portal.html',
                permissions: {
                    student_portal: 'manage',
                    fees: 'view',
                    fee_challan: 'view',
                    exams: 'view',
                    special_notices: 'view',
                    aboutme: 'view'
                }
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
        const rawGroups = raw.groups && typeof raw.groups === 'object' ? raw.groups : {};
        const groups = Object.entries({
            ...defaultPermissions.groups,
            ...rawGroups
        }).reduce((acc, [groupKey, groupValue]) => {
            const baseGroup = defaultPermissions.groups[groupKey] || { name: groupKey, homePage: 'dashboard.html', permissions: {} };
            const nextGroup = groupValue && typeof groupValue === 'object' ? groupValue : {};
            const permissions = { ...(baseGroup.permissions || {}), ...(nextGroup.permissions || {}) };
            moduleKeys.forEach((moduleKey) => {
                if (!permissions[moduleKey]) permissions[moduleKey] = groupKey === 'superadmin' ? 'manage' : 'none';
            });
            acc[groupKey] = {
                ...nextGroup,
                name: nextGroup.name || baseGroup.name || groupKey,
                homePage: pageRegistry[nextGroup.homePage] ? nextGroup.homePage : (baseGroup.homePage || 'dashboard.html'),
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
            ? (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin)
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
        if (user?.role === 'Student') return 'student_portal.html';
        if (user?.role === 'Teacher') return 'teacher_portal.html';
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
        if (user?.role === 'Teacher') return 'teacher_portal.html';
        if (user?.role === 'Staff' || user?.role === 'Principal') return 'dashboard.html';
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
        if (user.role === 'Student' && pageName === 'student_portal.html') return true;
        if (user.role === 'Teacher' && pageName === 'teacher_portal.html') return true;
        return getModuleAccess(user, permissions, pageName) !== 'none';
    }

    function redirectToAllowedHome(user, permissions) {
        window.location.replace(toRoutePath(getHomePage(user, permissions)));
    }

    function forceLoginRedirect() {
        sessionStorage.removeItem('loggedInUser');
        sessionStorage.removeItem('eduCore_token');
        sessionStorage.removeItem('eduCore_student_profile');
        sessionStorage.removeItem('eduCore_permissions_config');
        window.location.replace('/login');
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
                const rawHref = String(link.getAttribute('href') || '').trim();
                if (!rawHref || rawHref === '#') return;
                const href = normalizePageName(rawHref);
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

    function renderRequestedSidebarSequence(user, permissions) {
        if (!user || !authToken || publicPages.has(currentPage)) return;
        if (user.role === 'Student' || user.role === 'Teacher') return;

        runWhenReady(() => {
            const navLinks = document.querySelector('.sidebar .nav-links');
            if (!navLinks || navLinks.dataset.requestedSidebarSequence === 'true') return;

            const schedulingNavPages = {
                'student_scheduling.html': new Set([
                    'student_scheduling.html',
                    'assignments.html',
                    'assignment_uploading.html',
                    'student_timetable.html',
                    'student_diary.html',
                    'student_leave_requests.html',
                    'student_courses.html',
                    'quiz_uploading.html',
                    'lecture_uploading.html',
                    'exam_schedule.html',
                    'stuck_off.html'
                ]),
                'teacher_scheduling.html': new Set([
                    'teacher_scheduling.html',
                    'teacher_timetable.html',
                    'teacher_assigned_classes.html',
                    'teacher_leave_requests.html'
                ])
            };
            const isActivePage = (pageName, hash = '') => {
                const normalizedPage = normalizePageName(pageName);
                const activePages = schedulingNavPages[normalizedPage];
                if (activePages ? !activePages.has(currentPage) : normalizedPage !== currentPage) return false;
                return !hash || window.location.hash === hash;
            };
            const canShowPage = (pageName) => pageRegistry[normalizePageName(pageName)] && canAccessPage(user, permissions, pageName);
            const canShowAny = (children = []) => children.some((child) => child.type === 'dropdown' ? canShowAny(child.children) : canShowPage(child.page));
            const hasActiveChild = (children = []) => children.some((child) => (
                child.type === 'dropdown' ? hasActiveChild(child.children) : isActivePage(child.page, child.hash)
            ));

            const navItems = [
                { type: 'link', page: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
                { type: 'link', page: 'banners.html', label: 'Banners', icon: 'image' },
                { type: 'link', page: 'classes.html', label: 'Classes', icon: 'school' },
                { type: 'link', page: 'students.html', label: 'Students', icon: 'users' },
                { type: 'link', page: 'student_scheduling.html', label: 'Students Scheduling', icon: 'calendar-clock' },
                { type: 'link', page: 'families.html', label: 'Families', icon: 'home' },
                { type: 'link', page: 'teachers.html', label: 'Teachers', icon: 'book-open' },
                { type: 'link', page: 'teacher_scheduling.html', label: 'Teachers Scheduling', icon: 'calendar-days' },
                { type: 'link', page: 'staff.html', label: 'Staff', icon: 'briefcase' },
                {
                    type: 'dropdown',
                    label: 'Attendance',
                    icon: 'clipboard-check',
                    children: [
                        { page: 'student_attendance.html', label: 'Student Attendance', icon: 'users' },
                        { page: 'teacher_attendance.html', hash: '#teacher', label: 'Teacher Attendance', icon: 'user-check' },
                        { page: 'teacher_attendance.html', hash: '#staff', label: 'Staff Attendance', icon: 'briefcase-business' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'Fee Structure',
                    icon: 'credit-card',
                    children: [
                        { page: 'set_fee.html', label: 'Set Fees', icon: 'badge-dollar-sign' },
                        { page: 'fee_logos.html', label: 'Logos', icon: 'image' },
                        { page: 'fees.html', label: 'Fees', icon: 'credit-card' },
                        { page: 'fee_challan.html', label: 'Fee Challan', icon: 'file-text' },
                        { page: 'annual_charges.html', label: 'Annual Charges', icon: 'receipt' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'Examination',
                    icon: 'clipboard-list',
                    children: [
                        { page: 'exam_result.html', label: 'Results', icon: 'file-badge' },
                        { page: 'exam_result_history.html', label: 'Result History', icon: 'history' },
                        { page: 'exams.html', label: 'Result Cards', icon: 'badge-check' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'Finance',
                    icon: 'landmark',
                    children: [
                        { page: 'revenue.html', label: 'Revenue', icon: 'trending-up' },
                        { page: 'teacher_salaries.html', label: 'Salaries', icon: 'wallet' },
                        { page: 'bills.html', label: 'Bills', icon: 'receipt' }
                    ]
                },
                { type: 'link', page: 'notifications.html', label: 'Notifications', icon: 'bell-ring' },
                {
                    type: 'dropdown',
                    label: 'Permissions',
                    icon: 'shield',
                    children: [
                        { page: 'permissions.html', label: 'Permissions', icon: 'shield' },
                        { page: 'designation-permissions.html', label: 'Designation Permissions', icon: 'shield-check' }
                    ]
                },
                { type: 'link', page: 'library.html', label: 'Library', icon: 'library' },
                { type: 'link', page: 'complain_box.html', label: 'Complain Box', icon: 'message-square' },
                { type: 'link', page: 'branch_registration.html', label: 'Branch Registration', icon: 'building-2' },
                { type: 'link', page: 'visitor_books.html', label: 'Visitor Records', icon: 'clipboard-list' },
                { type: 'link', page: 'certificate.html', label: 'Certificates', icon: 'award' },
                { type: 'link', page: 'cafe.html', label: 'Cafe Records', icon: 'coffee' },
                { type: 'link', page: 'transport.html', label: 'Transport', icon: 'bus' },
                { type: 'link', page: 'aboutme.html', label: 'About', icon: 'info' },
                { type: 'logout', label: 'Logout', icon: 'log-out' }
            ];

            const buildLink = (item, className = 'nav-item') => {
                if (!canShowPage(item.page)) return '';
                const href = `${toRoutePath(item.page)}${item.hash || ''}`;
                return `
                    <a href="${href}" class="${className}${isActivePage(item.page, item.hash) ? ' active' : ''}">
                        <i data-lucide="${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `;
            };

            const buildDropdown = (item, nested = false, dataName = 'requested-sidebar-dropdown') => {
                const visibleChildren = item.children.filter((child) => child.type === 'dropdown' ? canShowAny(child.children) : canShowPage(child.page));
                if (!visibleChildren.length) return '';
                const open = hasActiveChild(visibleChildren);
                const toggleClass = nested ? 'nav-subitem nav-dropdown-toggle' : 'nav-item nav-dropdown-toggle';
                return `
                    <div class="nav-dropdown${open ? ' open' : ''}" data-${dataName}="true">
                        <button type="button" class="${toggleClass}${open ? ' active' : ''}">
                            <span class="nav-item-main">
                                <i data-lucide="${item.icon}"></i>
                                <span>${item.label}</span>
                            </span>
                            <i data-lucide="chevron-down" class="dropdown-chevron"></i>
                        </button>
                        <div class="nav-submenu">
                            ${visibleChildren.map((child) => buildItem(child, true)).join('')}
                        </div>
                    </div>
                `;
            };

            const buildItem = (item, nested = false) => {
                if (item.type === 'link' || item.page) return buildLink(item, nested ? 'nav-subitem' : 'nav-item');
                if (item.type === 'logout') {
                    return `
                        <a href="#" class="nav-item" onclick="logoutUser(event)">
                            <i data-lucide="${item.icon}"></i>
                            <span>${item.label}</span>
                        </a>
                    `;
                }
                return buildDropdown(item, nested);
            };

            navLinks.innerHTML = navItems.map((item) => buildItem(item)).join('');

            navLinks.dataset.requestedSidebarSequence = 'true';
            navLinks.querySelectorAll('[data-requested-sidebar-dropdown] > .nav-dropdown-toggle').forEach((toggle) => {
                toggle.addEventListener('click', () => {
                    toggle.closest('.nav-dropdown')?.classList.toggle('open');
                });
            });

            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        });
    }

    function renderDashboardPermissionCards(user, permissions) {
        if (currentPage !== 'dashboard.html' || !user || !authToken) return;

        runWhenReady(() => {
            const grid = document.getElementById('dashboardStatsGrid');
            if (!grid) return;

            const existingCards = Array.from(grid.querySelectorAll('a.card[href]'));
            const existingPages = new Set(existingCards.map((card) => normalizePageName(card.getAttribute('href') || '')));

            existingCards.forEach((card) => {
                const href = normalizePageName(card.getAttribute('href') || '');
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
        const getModuleLabel = (item) => String(item?.label || '').trim() || String(item?.pageName || '')
            .replace(/\.html$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (match) => match.toUpperCase());
        const searchableModules = modules.filter((item) => item.pageName !== currentPage);
        const cards = searchableModules.map((item) => `
            <a href="${escapeHtml(toRoutePath(item.pageName))}" class="card" data-portal-module-card>
                <div class="card-title">${escapeHtml(getModuleLabel(item))}</div>
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
        const getModuleLabel = (item) => String(item?.label || '').trim() || String(item?.pageName || '')
            .replace(/\.html$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (match) => match.toUpperCase());
        const navItems = modules.map((item) => `
            <a href="${escapeHtml(toRoutePath(item.pageName))}" class="nav-item ${item.pageName === currentPage ? 'active' : ''}">
                <i data-lucide="${escapeHtml(item.icon || 'circle')}"></i>
                <span>${escapeHtml(getModuleLabel(item))}</span>
            </a>
        `).join('');

        const displayName = user?.fullName || user?.username || user?.role || 'User';
        return `
            <aside class="sidebar" data-portal-sidebar>
                <div class="logo-section">
                    <img class="sidebar-logo-img" src="images/logo.png" alt="Apexiums School System logo">
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
            const getModuleLabel = (item) => String(item?.label || '').trim() || String(item?.pageName || '')
                .replace(/\.html$/i, '')
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, (match) => match.toUpperCase());
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
                            <a class="portal-access-card" href="${escapeHtml(toRoutePath(item.pageName))}">
                                <span class="portal-access-icon"><i data-lucide="${escapeHtml(item.icon || 'circle')}"></i></span>
                                <span>
                                    <span class="portal-access-title">${escapeHtml(getModuleLabel(item))}</span>
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

        const ensureSessionId = () => {
            const existing = sessionStorage.getItem('eduCore_session_id');
            if (existing) return existing;
            try {
                const payloadSegment = String(authToken || '').split('.')[1] || '';
                if (!payloadSegment) return '';
                const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = JSON.parse(atob(normalized));
                const sid = String(decoded?.sessionId || '').trim();
                if (sid) sessionStorage.setItem('eduCore_session_id', sid);
                return sid;
            } catch (_error) {
                return '';
            }
        };

        ensureSessionId();

        const sendHeartbeat = () => {
            fetch(`${getApiBaseUrl()}/session/heartbeat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page: currentPage })
            })
                .then((response) => {
                    if (response.status === 401 || response.status === 403) {
                        logoutUser();
                    }
                })
                .catch(() => {});
        };

        sendHeartbeat();
        window.setInterval(sendHeartbeat, 30000);
    }

    window.eduCoreAuth = {
        currentPage,
        pageRegistry,
        defaultPermissions,
        normalizePermissionsConfig,
        normalizePageName,
        resolvePageNameFromPath: normalizePageName,
        toRoutePath,
        getUserGroupKey,
        getGroupConfig,
        getModuleAccess,
        getAccessibleModules,
        getHomePage,
        canAccessPage
    };

    (async () => {
        const permissions = await fetchPermissionsConfig();
        renderRequestedSidebarSequence(loggedInUser, permissions);
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
    window.location.href = '/login';
}
