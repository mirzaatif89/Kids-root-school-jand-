(function () {
    const portalPages = new Set(['login', 'index', 'website', 'student_portal', 'teacher_portal']);
    const currentPage = String(window.location.pathname || '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.html$/i, '') || 'index';

    if (portalPages.has(currentPage)) return;

    const path = (page, hash = '') => `/${String(page || '').replace(/\.html$/i, '')}${hash || ''}`;
    const isActive = (page, hash = '') => {
        const cleanPage = String(page || '').replace(/\.html$/i, '');
        return cleanPage === currentPage && (!hash || window.location.hash === hash);
    };
    const hasActiveChild = (children = []) => children.some((child) => (
        child.type === 'dropdown' ? hasActiveChild(child.children) : isActive(child.page, child.hash)
    ));

    const navItems = [
        { type: 'link', page: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { type: 'link', page: 'banners', label: 'Banners', icon: 'image' },
        { type: 'link', page: 'revenue', label: 'Reveneue', icon: 'trending-up' },
        { type: 'link', page: 'fees', label: 'Fees', icon: 'credit-card' },
        {
            type: 'dropdown',
            label: 'Students',
            icon: 'users',
            children: [
                { type: 'link', page: 'students', label: 'Students', icon: 'users' },
                {
                    type: 'dropdown',
                    label: 'Students Scheduling',
                    icon: 'calendar-clock',
                    children: [
                        { type: 'link', page: 'student_timetable', label: 'Class time table', icon: 'calendar-clock' },
                        { type: 'link', page: 'student_leave_requests', label: 'Leave requeste', icon: 'calendar-check' },
                        { type: 'link', page: 'student_diary', label: 'Diary', icon: 'book-open' },
                        { type: 'link', page: 'assignments', label: 'Assignments', icon: 'upload' },
                        { type: 'link', page: 'quiz_uploading', label: 'Quiz Class', icon: 'circle-help' }
                    ]
                }
            ]
        },
        { type: 'link', page: 'families', label: 'Families', icon: 'home' },
        { type: 'link', page: 'stuck_off', label: 'Stuck of students', icon: 'user-x' },
        { type: 'link', page: 'classes', label: 'Classes', icon: 'school' },
        {
            type: 'dropdown',
            label: 'Teachers',
            icon: 'book-open',
            children: [
                { type: 'link', page: 'teachers', label: 'Teahers', icon: 'book-open' },
                {
                    type: 'dropdown',
                    label: 'Teachers scheduling',
                    icon: 'calendar-days',
                    children: [
                        { type: 'link', page: 'teacher_scheduling', label: 'Teacher time table', icon: 'calendar-days' },
                        { type: 'link', page: 'teacher_leave_requests', label: 'Leave request', icon: 'calendar-check' }
                    ]
                }
            ]
        },
        { type: 'link', page: 'families', label: 'Families', icon: 'home' },
        {
            type: 'dropdown',
            label: 'Examination',
            icon: 'clipboard-list',
            children: [
                { type: 'link', page: 'exam_schedule', label: 'Exam schedule', icon: 'calendar-days' },
                { type: 'link', page: 'student_courses', label: 'sallabus', icon: 'library' },
                { type: 'link', page: 'exam_result', label: 'Result', icon: 'file-badge' },
                { type: 'link', page: 'exam_result_history', label: 'student result history', icon: 'history' }
            ]
        },
        {
            type: 'dropdown',
            label: 'Notifications',
            icon: 'bell-ring',
            children: [
                { type: 'link', page: 'notifications', label: 'Notifications', icon: 'bell' },
                { type: 'link', page: 'special_notices', label: 'Special Notifications', icon: 'megaphone' }
            ]
        },
        {
            type: 'dropdown',
            label: 'Finanace',
            icon: 'landmark',
            children: [
                { type: 'link', page: 'bills', label: 'Bills', icon: 'receipt' },
                { type: 'link', page: 'teacher_salaries', label: 'Salaries', icon: 'wallet' },
                { type: 'link', page: 'revenue', label: 'Revenue', icon: 'trending-up' }
            ]
        },
        { type: 'link', page: 'cafe', label: 'Cafe', icon: 'coffee' },
        { type: 'link', page: 'transport', label: 'Transport', icon: 'bus' },
        { type: 'link', page: 'library', label: 'Librart', icon: 'library' },
        {
            type: 'dropdown',
            label: 'permissions',
            icon: 'shield',
            children: [
                { type: 'link', page: 'permissions', label: 'Permissions', icon: 'shield' },
                { type: 'link', page: 'designation-permissions', label: 'Designation Permissions', icon: 'shield-check' }
            ]
        },
        { type: 'link', page: 'staff', label: 'Staff', icon: 'briefcase' },
        { type: 'link', page: 'annual_charges', label: 'Annual charges', icon: 'receipt' },
        {
            type: 'dropdown',
            label: 'Fee structure',
            icon: 'credit-card',
            children: [
                { type: 'link', page: 'set_fee', label: 'Set Fees', icon: 'badge-dollar-sign' },
                { type: 'link', page: 'fee_challan', label: 'Fee Challan', icon: 'file-text' },
                { type: 'link', page: 'annual_charges', label: 'Annual Charges', icon: 'receipt' }
            ]
        },
        {
            type: 'dropdown',
            label: 'complain box',
            icon: 'message-square',
            children: [
                { type: 'link', page: 'complain_box', label: 'Student complain', icon: 'graduation-cap', hash: '#student' },
                { type: 'link', page: 'complain_box', label: 'Teachers complain', icon: 'book-open', hash: '#teacher' },
                { type: 'link', page: 'complain_box', label: 'Parents Complain', icon: 'home', hash: '#parents' }
            ]
        },
        { type: 'link', page: 'special_notices', label: 'notices', icon: 'megaphone' },
        { type: 'link', page: 'visitor_books', label: 'visitors book', icon: 'clipboard-list' },
        { type: 'link', page: 'certificate', label: 'Certificates', icon: 'award' },
        { type: 'logout', label: 'Logout', icon: 'log-out' }
    ];

    function buildLink(item, className = 'nav-item') {
        return `
            <a href="${path(item.page, item.hash)}" class="${className}${isActive(item.page, item.hash) ? ' active' : ''}">
                <i data-lucide="${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        `;
    }

    function buildItem(item, nested = false) {
        if (item.type === 'link') return buildLink(item, nested ? 'nav-subitem' : 'nav-item');
        if (item.type === 'logout') {
            return `
                <a href="#" class="nav-item" onclick="logoutUser(event)">
                    <i data-lucide="${item.icon}"></i>
                    <span>${item.label}</span>
                </a>
            `;
        }

        const open = hasActiveChild(item.children);
        const toggleClass = nested ? 'nav-subitem nav-dropdown-toggle' : 'nav-item nav-dropdown-toggle';
        return `
            <div class="nav-dropdown${open ? ' open' : ''}" data-forced-sidebar-dropdown="true">
                <button type="button" class="${toggleClass}${open ? ' active' : ''}">
                    <span class="nav-item-main">
                        <i data-lucide="${item.icon}"></i>
                        <span>${item.label}</span>
                    </span>
                    <i data-lucide="chevron-down" class="dropdown-chevron"></i>
                </button>
                <div class="nav-submenu">
                    ${item.children.map((child) => buildItem(child, true)).join('')}
                </div>
            </div>
        `;
    }

    function applySidebarOrder() {
        const navLinks = document.querySelector('.sidebar .nav-links, .nav-links');
        if (!navLinks) return;
        if (navLinks.dataset.forcedRequestedOrder === 'true') return;

        navLinks.innerHTML = navItems.map((item) => buildItem(item)).join('');
        navLinks.dataset.forcedRequestedOrder = 'true';
        navLinks.querySelectorAll('[data-forced-sidebar-dropdown] > .nav-dropdown-toggle').forEach((toggle) => {
            toggle.addEventListener('click', () => {
                toggle.closest('.nav-dropdown')?.classList.toggle('open');
            });
        });

        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySidebarOrder, { once: true });
    } else {
        applySidebarOrder();
    }
    window.addEventListener('load', applySidebarOrder, { once: true });
    window.setTimeout(applySidebarOrder, 250);
    window.setTimeout(applySidebarOrder, 1000);
})();
