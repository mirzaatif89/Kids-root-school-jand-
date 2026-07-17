(function () {
    const portalPages = new Set(['login', 'index', 'website', 'student_portal', 'teacher_portal']);
    const currentPage = String(window.location.pathname || '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.html$/i, '') || 'index';

    if (portalPages.has(currentPage)) return;

    const path = (page, hash = '') => `/${String(page || '').replace(/\.html$/i, '')}${hash || ''}`;
    const schedulingNavPages = {
        student_scheduling: new Set([
            'student_scheduling',
            'assignments',
            'assignment_uploading',
            'student_timetable',
            'student_diary',
            'student_leave_requests',
            'student_courses',
            'quiz_uploading',
            'lecture_uploading',
            'exam_schedule',
            'stuck_off'
        ]),
        teacher_scheduling: new Set([
            'teacher_scheduling',
            'teacher_timetable',
            'teacher_assigned_classes',
            'teacher_leave_requests'
        ])
    };
    const isActive = (page, hash = '') => {
        const cleanPage = String(page || '').replace(/\.html$/i, '');
        const activePages = schedulingNavPages[cleanPage];
        return (activePages ? activePages.has(currentPage) : cleanPage === currentPage)
            && (!hash || window.location.hash === hash);
    };
    const hasActiveChild = (children = []) => children.some((child) => (
        child.type === 'dropdown' ? hasActiveChild(child.children) : isActive(child.page, child.hash)
    ));

    const navItems = [
        { type: 'link', page: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { type: 'link', page: 'banners', label: 'Banners', icon: 'image' },
        { type: 'link', page: 'classes', label: 'Classes', icon: 'school' },
        { type: 'link', page: 'students', label: 'Students', icon: 'users' },
        { type: 'link', page: 'student_scheduling', label: 'Students Scheduling', icon: 'calendar-clock' },
        { type: 'link', page: 'families', label: 'Families', icon: 'home' },
        { type: 'link', page: 'teachers', label: 'Teachers', icon: 'book-open' },
        { type: 'link', page: 'teacher_scheduling', label: 'Teachers Scheduling', icon: 'calendar-days' },
        { type: 'link', page: 'staff', label: 'Staff', icon: 'briefcase' },
        {
            type: 'dropdown',
            label: 'Attendance',
            icon: 'clipboard-check',
            children: [
                { type: 'link', page: 'student_attendance', label: 'Student Attendance', icon: 'users' },
                { type: 'link', page: 'teacher_attendance', hash: '#teacher', label: 'Teacher Attendance', icon: 'user-check' },
                { type: 'link', page: 'teacher_attendance', hash: '#staff', label: 'Staff Attendance', icon: 'briefcase-business' }
            ]
        },
        {
            type: 'dropdown',
            label: 'Fee Structure',
            icon: 'credit-card',
            children: [
                { type: 'link', page: 'set_fee', label: 'Set Fees', icon: 'badge-dollar-sign' },
                { type: 'link', page: 'fees', label: 'Fees', icon: 'credit-card' },
                { type: 'link', page: 'fee_challan', label: 'Fee Challan', icon: 'file-text' },
                { type: 'link', page: 'remaining_charges', label: 'Remaining Charges', icon: 'circle-dollar-sign' },
                { type: 'link', page: 'payment_history', label: 'Payment Statement', icon: 'receipt-text' },
                { type: 'link', page: 'annual_charges', label: 'Annual Charges', icon: 'receipt' }
            ]
        },
        {
            type: 'dropdown',
            label: 'Examination',
            icon: 'clipboard-list',
            children: [
                { type: 'link', page: 'exam_result', label: 'Results', icon: 'file-badge' },
                { type: 'link', page: 'exam_result_history', label: 'Result History', icon: 'history' },
                { type: 'link', page: 'exams', label: 'Result Cards', icon: 'badge-check' }
            ]
        },
        {
            type: 'dropdown',
            label: 'Finance',
            icon: 'landmark',
            children: [
                { type: 'link', page: 'revenue', label: 'Revenue', icon: 'trending-up' },
                { type: 'link', page: 'teacher_salaries', label: 'Salaries', icon: 'wallet' },
                { type: 'link', page: 'bills', label: 'Bills', icon: 'receipt' }
            ]
        },
        { type: 'link', page: 'notifications', label: 'Notifications', icon: 'bell-ring' },
        {
            type: 'dropdown',
            label: 'Permissions',
            icon: 'shield',
            children: [
                { type: 'link', page: 'permissions', label: 'Permissions', icon: 'shield' },
                { type: 'link', page: 'designation-permissions', label: 'Designation Permissions', icon: 'shield-check' }
            ]
        },
        { type: 'link', page: 'library', label: 'Library', icon: 'library' },
        { type: 'link', page: 'complain_box', label: 'Complain Box', icon: 'message-square' },
        { type: 'link', page: 'branch_registration', label: 'Branch Registration', icon: 'building-2' },
        { type: 'link', page: 'visitor_books', label: 'Visitor Records', icon: 'clipboard-list' },
        { type: 'link', page: 'certificate', label: 'Certificates', icon: 'award' },
        { type: 'link', page: 'cafe', label: 'Cafe Records', icon: 'coffee' },
        { type: 'link', page: 'transport', label: 'Transport', icon: 'bus' },
        { type: 'link', page: 'aboutme', label: 'About', icon: 'info' },
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
