// === KEYS ===
const STORAGE_KEY_STUDENTS = 'eduCore_students';
const STORAGE_KEY_TEACHERS = 'eduCore_teachers';
const STORAGE_KEY_CLASSES = 'eduCore_classes';
const STORAGE_KEY_SETTINGS = 'eduCore_settings';
const STORAGE_KEY_NOTIFICATIONS = 'eduCore_notifications';
const STORAGE_KEY_AUTH = 'eduCore_auth';
const STORAGE_KEY_TEACHER_ATTENDANCE = 'eduCore_teacher_attendance';
const STORAGE_KEY_STUDENT_ATTENDANCE_CACHE = 'eduCore_student_attendance';
const STORAGE_KEY_STAFF = 'eduCore_staff';
const STORAGE_KEY_FAMILIES = 'eduCore_families';
const STORAGE_KEY_TEACHER_SALARIES = 'eduCore_teacher_salaries';
const STORAGE_KEY_USERS = 'eduCore_users'; // New Key for student/teacher credentials
const STORAGE_KEY_PROMOTION_HISTORY = 'eduCore_promotion_history';
const STORAGE_KEY_SPECIAL_NOTICES = 'eduCore_special_notices';
const STORAGE_KEY_ALUMNI = 'eduCore_alumni';
const STORAGE_KEY_COMPLAINTS = 'eduCore_complaints';
const SIDEBAR_SCROLL_KEY = 'eduCore_sidebar_scroll_position';
let teacherScheduleDraft = [];

// === REAL-TIME SQL CONFIGURATION ===
// Auto-detect environment: Use localhost for development, or environment variable for production
const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.') ||
    window.location.protocol === 'file:';

const BACKEND_URL = isLocalhost
    ? (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin)
    : (window.ENV_BACKEND_URL || window.location.origin);

const API_BASE_URL = `${BACKEND_URL}/api`;
let socket;
let activePortalSessionsCache = [];
let dashboardActiveSessionsInterval = null;
let activeSessionsModalEventsBound = false;
const DEFAULT_CAMPUS_NAMES = ['Main Campus'];
const DEFAULT_STUDENT_CLASS_ORDER = [
    'Play Group', 'Nursery', 'Prep',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];
let studentQuickFilterBranchCampuses = [];
let studentColumnSearchFilter = null;
let classFeeDefaults = {};
let classFeeHistory = [];
let classFeeEditingHistoryId = '';
const STORAGE_KEY_CLASS_FEES = 'eduCore_class_fees';
const STORAGE_KEY_CLASS_FEE_HISTORY = 'eduCore_class_fee_history';
let branchRecordsCache = [];
const FALLBACK_ROUTE_TO_PAGE = {
    login: 'login.html',
    index: 'index.html',
    home: 'index.html',
    dashboard: 'dashboard.html',
    students: 'students.html',
    families: 'families.html',
    student_scheduling: 'student_scheduling.html',
    assignments: 'assignments.html',
    assignment_uploading: 'assignment_uploading.html',
    student_timetable: 'student_timetable.html',
    student_diary: 'student_diary.html',
    student_leave_requests: 'student_leave_requests.html',
    student_courses: 'student_courses.html',
    quiz_uploading: 'quiz_uploading.html',
    lecture_uploading: 'lecture_uploading.html',
    banners: 'banners.html',
    teachers: 'teachers.html',
    stuck_off: 'stuck_off.html',
    teacher_scheduling: 'teacher_scheduling.html',
    teacher_timetable: 'teacher_timetable.html',
    teacher_assigned_classes: 'teacher_assigned_classes.html',
    teacher_leave_requests: 'teacher_leave_requests.html',
    staff: 'staff.html',
    classes: 'classes.html',
    set_fee: 'set_fee.html',
    fees: 'fees.html',
    fee_challan: 'fee_challan.html',
    fee_logos: 'fee_logos.html',
    bills: 'bills.html',
    certificate: 'certificate.html',
    complain_box: 'complain_box.html',
    diary: 'diary.html',
    visitor_books: 'visitor_books.html',
    annual_charges: 'annual_charges.html',
    teacher_salaries: 'teacher_salaries.html',
    student_attendance: 'student_attendance.html',
    teacher_attendance: 'teacher_attendance.html',
    student_attendance_report: 'student_attendance_report.html',
    teacher_attendance_report: 'teacher_attendance_report.html',
    notifications: 'notifications.html',
    special_notices: 'special_notices.html',
    exams: 'exams.html',
    exam_schedule: 'exam_schedule.html',
    exam_result: 'exam_result.html',
    exam_result_history: 'exam_result_history.html',
    revenue: 'revenue.html',
    settings: 'settings.html',
    permissions: 'permissions.html',
    branch_registration: 'branch_registration.html',
    aboutme: 'aboutme.html',
    student_portal: 'student_portal.html',
    teacher_portal: 'teacher_portal.html'
};

function normalizeClientPageName(pageValue = '') {
    if (window.eduCoreAuth?.resolvePageNameFromPath) {
        return window.eduCoreAuth.resolvePageNameFromPath(pageValue);
    }

    const rawValue = String(pageValue || '').trim().toLowerCase();
    if (!rawValue || rawValue === '/' || rawValue === '.') return 'index.html';

    const withoutHash = rawValue.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const trimmedPath = withoutQuery.replace(/^\/+|\/+$/g, '');
    if (!trimmedPath) return 'index.html';

    const segment = trimmedPath.split('/').pop() || '';
    if (!segment) return 'index.html';
    if (FALLBACK_ROUTE_TO_PAGE[segment]) return FALLBACK_ROUTE_TO_PAGE[segment];
    if (segment.endsWith('.html')) return segment;
    return `${segment}.html`;
}

function getCurrentPageName() {
    return normalizeClientPageName(window.location.pathname);
}

function isCurrentPage(...pageNames) {
    const currentPage = getCurrentPageName();
    return pageNames.some((pageName) => normalizeClientPageName(pageName) === currentPage);
}

function toRoutePath(pageName = '') {
    if (window.eduCoreAuth?.toRoutePath) {
        return window.eduCoreAuth.toRoutePath(pageName);
    }
    const normalizedPage = normalizeClientPageName(pageName);
    if (normalizedPage === 'login.html') return '/login';
    if (normalizedPage === 'index.html') return '/';
    return `/${normalizedPage.replace(/\.html$/i, '')}`;
}

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
                <div class="app-popup-actions">
                    <button type="button" class="app-popup-button">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        activePopup = overlay;
        return activePopup;
    }

    function closePopup(resolve, value) {
        const popup = ensurePopupElement();
        if (!popup) {
            if (resolve) resolve(value);
            return;
        }

        popup.classList.remove('active');
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
        const actions = popup.querySelector('.app-popup-actions');
        actions.innerHTML = confirm
            ? `<button type="button" class="app-popup-button secondary" data-popup-cancel>${escapePopupText(cancelText)}</button><button type="button" class="app-popup-button" data-popup-confirm>${escapePopupText(confirmText)}</button>`
            : `<button type="button" class="app-popup-button" data-popup-confirm>${escapePopupText(confirmText)}</button>`;
        popup.classList.add('active');

        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }

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

    function showAppAlert(message, title = 'Message') {
        return showAppDialog({ message, title, confirmText: 'OK' });
    }

    function showAppConfirm(message, title = 'Confirm Action') {
        return showAppDialog({
            message,
            title,
            confirm: true,
            confirmText: 'Confirm',
            cancelText: 'Cancel'
        });
    }

    window.showAppAlert = showAppAlert;
    window.showAppConfirm = showAppConfirm;
    window.alert = (message) => {
        showAppAlert(message);
    };
})();

if (typeof io !== 'undefined') {
    socket = io(BACKEND_URL);

    // Listen for Real-Time SQL Updates
    socket.on('students_update', (data) => {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(mergeStudentRecords(data)));
        if (isCurrentPage('students.html')) renderStudents();
        if (isCurrentPage('stuck_off.html')) renderStuckOffPage();
        if (isCurrentPage('dashboard.html')) updateDashboardStats();
    });

    socket.on('teachers_update', (data) => {
        localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(mergeTeacherRecords(data)));
        if (isCurrentPage('teachers.html')) renderTeachers();
        if (isCurrentPage('stuck_off.html')) renderStuckOffPage();
        if (isCurrentPage('dashboard.html')) updateDashboardStats();
    });

    socket.on('staff_update', (data) => {
        localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(mergeStaffRecords(data)));
        if (isCurrentPage('staff.html')) renderStaff();
        if (isCurrentPage('dashboard.html')) updateDashboardStats();
    });

    socket.on('banners_update', (data) => {
        if (isCurrentPage('dashboard.html')) updateDashboardBannerStats(data);
    });

    socket.on('fee_payment_update', () => {
        if (isCurrentPage('dashboard.html')) updateDashboardRevenueStats();
    });

    socket.on('session_forced_logout', (payload) => {
        const targetSessionId = String(payload?.sessionId || '').trim();
        const currentSessionId = String(sessionStorage.getItem('eduCore_session_id') || '').trim();
        if (!targetSessionId || !currentSessionId || targetSessionId !== currentSessionId) return;

        showAppAlert('This login session has been logged out by admin.', 'Session Ended')
            .finally(() => {
                logoutUser();
            });
    });
}

async function parseJsonResponse(response, fallbackMessage = 'The server returned an unexpected response.') {
    const responseText = await response.text();
    let result = null;

    try {
        result = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
        const bodyPreview = responseText.trim().slice(0, 160);
        throw new Error(bodyPreview || fallbackMessage);
    }

    return result;
}

// Helper to sync local data to SQL
async function syncToSQL(endpoint, data) {
    const result = await syncToSQLDetailed(endpoint, data);
    return result.success;
}

async function syncToSQLDetailed(endpoint, data) {
    try {
        const token = sessionStorage.getItem('eduCore_token') || '';
        console.log(`Syncing ${endpoint}: Sending ${Array.isArray(data) ? data.length : 1} items`);
        
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(data)
        });

        console.log(`API response status for ${endpoint}: ${response.status}`);
        
        const result = await parseJsonResponse(response, 'Server sync failed.');

        if (!response.ok || result?.success === false) {
            const errorMsg = result?.message || result?.error || 'Server sync failed.';
            console.error(`Sync failed for ${endpoint}:`, errorMsg);
            throw new Error(errorMsg);
        }

        console.log(`Sync successful for ${endpoint}:`, result);
        return { success: true, result };
    } catch (e) {
        console.error(`SQL sync failed for ${endpoint}: ${e.message}`);
        return { success: false, error: e.message };
    }
}

function getMissingRecords(localRecords, serverRecords) {
    const localList = Array.isArray(localRecords) ? localRecords : [];
    const serverList = Array.isArray(serverRecords) ? serverRecords : [];
    const serverIds = new Set(serverList.map((item) => item.id));

    return localList.filter((item) => item?.id && !serverIds.has(item.id));
}

async function initialSQLSync() {
    try {
        const token = sessionStorage.getItem('eduCore_token') || '';
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const sRes = await fetch(`${API_BASE_URL}/students`, { headers: authHeaders });
        if (sRes.ok) {
            const data = await sRes.json();
            const mergedStudents = mergeStudentRecords(data);
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(mergedStudents));
            const missingStudents = getMissingRecords(mergedStudents, data);
            if (missingStudents.length) {
                await syncToSQL('students', missingStudents);
            }
            if (typeof renderStudents === 'function') renderStudents();
            if (typeof renderStuckOffPage === 'function') renderStuckOffPage();
            if (typeof updateDashboardStats === 'function' && isCurrentPage('dashboard.html')) updateDashboardStats();
        }

        const tRes = await fetch(`${API_BASE_URL}/teachers`, { headers: authHeaders });
        if (tRes.ok) {
            const data = await tRes.json();
            const mergedTeachers = mergeTeacherRecords(data);
            localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(mergedTeachers));
            const missingTeachers = getMissingRecords(mergedTeachers, data);
            if (missingTeachers.length) {
                await syncToSQL('teachers', missingTeachers);
            }
            if (typeof renderTeachers === 'function') renderTeachers();
            if (typeof renderStuckOffPage === 'function') renderStuckOffPage();
            if (typeof updateDashboardStats === 'function' && isCurrentPage('dashboard.html')) updateDashboardStats();
        }

        const staffRes = await fetch(`${API_BASE_URL}/staff`, { headers: authHeaders });
        if (staffRes.ok) {
            const data = await staffRes.json();
            const mergedStaff = mergeStaffRecords(data);
            localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(mergedStaff));
            const missingStaff = getMissingRecords(mergedStaff, data);
            if (missingStaff.length) {
                await syncToSQL('staff', missingStaff);
            }
            if (typeof renderStaff === 'function') renderStaff();
            if (typeof updateDashboardStats === 'function' && isCurrentPage('dashboard.html')) updateDashboardStats();
        }

        await Promise.all([
            loadStudentAttendanceFromSQL(),
            loadTeacherAttendanceFromSQL(),
            loadTeacherSalariesFromSQL()
        ]);
    } catch (e) {
        console.warn("SQL Server Connection Failed: Ensure 'node server.js' is running and MySQL is active.");
        console.log("SQL Initial Sync skipped (server offline). Using LocalStorage fallback.");
        if (typeof updateDashboardStats === 'function' && isCurrentPage('dashboard.html')) updateDashboardStats();
    }
}

async function refreshStudentsFromSQL() {
    const token = sessionStorage.getItem('eduCore_token') || '';
    console.log('Fetching students from SQL API...');
    
    const response = await fetch(`${API_BASE_URL}/students`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    console.log(`API response status: ${response.status}`);
    
    const result = await parseJsonResponse(response, 'Students could not be loaded.');
    
    if (!response.ok || !Array.isArray(result)) {
        throw new Error(result?.message || result?.error || 'Students could not be loaded.');
    }
    
    console.log(`API returned ${Array.isArray(result) ? result.length : 0} students`);
    
    const mergedStudents = mergeStudentRecords(result);
    console.log(`After merge: ${mergedStudents.length} students total`);
    
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(mergedStudents));
    return mergedStudents;
}

async function refreshTeachersFromSQL() {
    const token = sessionStorage.getItem('eduCore_token') || '';
    const response = await fetch(`${API_BASE_URL}/teachers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const result = await parseJsonResponse(response, 'Teachers could not be loaded.');
    if (!response.ok || !Array.isArray(result)) {
        throw new Error(result?.message || result?.error || 'Teachers could not be loaded.');
    }
    const mergedTeachers = mergeTeacherRecords(result);
    localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(mergedTeachers));
    return mergedTeachers;
}

async function refreshStaffFromSQL() {
    const token = sessionStorage.getItem('eduCore_token') || '';
    const response = await fetch(`${API_BASE_URL}/staff`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const result = await parseJsonResponse(response, 'Staff could not be loaded.');
    if (!response.ok || !Array.isArray(result)) {
        throw new Error(result?.message || result?.error || 'Staff could not be loaded.');
    }
    const mergedStaff = mergeStaffRecords(result);
    localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(mergedStaff));
    return mergedStaff;
}

function normalizeAttendanceStatus(status) {
    if (status === 'P') return 'Present';
    if (status === 'A') return 'Absent';
    if (status === 'Present' || status === 'Late' || status === 'Absent' || status === 'Leave') return status;
    return 'Not Marked';
}

function normalizeStudentAttendanceStore(store) {
    const source = store && typeof store === 'object' ? store : {};
    return Object.fromEntries(Object.entries(source).map(([studentId, records]) => [
        studentId,
        (Array.isArray(records) ? records : [])
            .filter(item => item && item.date)
            .map(item => ({ date: item.date, status: normalizeAttendanceStatus(item.status) }))
    ]));
}

function normalizeTeacherAttendanceStore(store) {
    const source = store && typeof store === 'object' ? store : {};
    return Object.fromEntries(Object.entries(source).map(([recordKey, monthRecord]) => [
        recordKey,
        (Array.isArray(monthRecord) ? monthRecord : []).map(normalizeAttendanceStatus)
    ]));
}

async function loadStudentAttendanceFromSQL() {
    try {
        const response = await fetch(`${API_BASE_URL}/student-attendance`);
        const result = await parseJsonResponse(response, 'Student attendance load failed.');
        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Student attendance load failed.');
        }

        const attendance = normalizeStudentAttendanceStore(result?.attendance);
        localStorage.setItem(STORAGE_KEY_STUDENT_ATTENDANCE_CACHE, JSON.stringify(attendance));
        return attendance;
    } catch (error) {
        console.warn(`Student attendance load failed: ${error.message}`);
        return normalizeStudentAttendanceStore(getData(STORAGE_KEY_STUDENT_ATTENDANCE_CACHE));
    }
}

async function loadTeacherAttendanceFromSQL() {
    try {
        const response = await fetch(`${API_BASE_URL}/teacher-attendance`);
        const result = await parseJsonResponse(response, 'Teacher attendance load failed.');
        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Teacher attendance load failed.');
        }

        const attendance = normalizeTeacherAttendanceStore(result?.attendance);
        localStorage.setItem(STORAGE_KEY_TEACHER_ATTENDANCE, JSON.stringify(attendance));
        return attendance;
    } catch (error) {
        console.warn(`Teacher attendance load failed: ${error.message}`);
        return normalizeTeacherAttendanceStore(getData(STORAGE_KEY_TEACHER_ATTENDANCE));
    }
}

async function saveStudentAttendanceToSQLRecord(studentId, date, status) {
    const normalizedStatus = normalizeAttendanceStatus(status);
    const result = await syncToSQLDetailed('student-attendance', [{ studentId, date, status: normalizedStatus }]);
    if (result.success && result.result?.attendance) {
        localStorage.setItem(
            STORAGE_KEY_STUDENT_ATTENDANCE_CACHE,
            JSON.stringify(normalizeStudentAttendanceStore(result.result.attendance))
        );
    }
    return result;
}

async function saveTeacherAttendanceToSQLRecord(teacherId, date, status) {
    const normalizedStatus = normalizeAttendanceStatus(status);
    const result = await syncToSQLDetailed('teacher-attendance', [{ teacherId, date, status: normalizedStatus }]);
    if (result.success && result.result?.attendance) {
        localStorage.setItem(
            STORAGE_KEY_TEACHER_ATTENDANCE,
            JSON.stringify(normalizeTeacherAttendanceStore(result.result.attendance))
        );
    }
    return result;
}

// === LEGACY LOCAL AUTH CLEANUP ===
(function forceResetAuth() {
    let existing = {};
    try {
        existing = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTH) || '{}') || {};
    } catch (_error) {
        existing = {};
    }
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ ...existing, email: existing.email || 'admin' }));
    sessionStorage.removeItem('login_attempts');
})();

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboardHome();

    // Perform initial sync from SQL Server
    if (sessionStorage.getItem('eduCore_token')) {
        initialSQLSync();
    }
    populateCampusDropdowns();
    [
        ensureBranchRegistrationNav,
        ensureBannersNav,
        ensureSchedulingNav,
        ensureAdminRecordsNav,
        ensureFacilityNav,
        ensureAdminSidebarCompleteness,
        ensureAttendanceNav,
        ensureNotificationsNav,
        ensureSpecialNoticesNav
    ].forEach((initializer) => {
        try {
            initializer();
        } catch (error) {
            console.warn('Sidebar initializer skipped:', error);
        }
    });
    renderAdminSidebarSequence();
    window.setTimeout(renderAdminSidebarSequence, 0);
    window.setTimeout(renderAdminSidebarSequence, 250);
    initializeSidebarScrollMemory();
    applyBranchScopedStudentsView();
    if (sessionStorage.getItem('eduCore_token')) {
        loadDesignationPermissionsForCurrentUser()
            .catch(() => null)
            .finally(() => {
                applyStudentActionPermissions();
                if (typeof renderStudents === 'function') renderStudents();
            });
    }

    // === INIT ICONS ===
    if (typeof lucide !== 'undefined' && window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }

    showWelcomeAnimationIfNeeded();

    // === NOTIFICATION SYSTEM ===
    const bell = document.getElementById('notificationBell');
    const panel = document.getElementById('notificationPanel');

    if (bell && panel) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = panel.classList.contains('active');

            if (isActive) {
                // If the user clicks the bell to close, we clear the seen alerts and hide it
                clearAllNotifications();
                panel.classList.remove('active');
            } else {
                // Only open if there are notifications to see
                const notifications = getData(STORAGE_KEY_NOTIFICATIONS);
                if (notifications.length > 0) {
                    panel.classList.add('active');
                } else {
                    // Optional: You could show a small "No Notifications" toast here if desired
                    console.log('Notification tray is empty.');
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (panel.classList.contains('active') && !panel.contains(e.target)) {
                clearAllNotifications();
                panel.classList.remove('active');
            }
        });

        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    renderNotifications();

    // === LOGIN PAGE ===
    const loginForm = document.getElementById('loginForm');

    // === PASSWORD TOGGLE ===
    document.querySelectorAll('[data-toggle-password]').forEach((toggleBtn) => {
        const targetId = toggleBtn.getAttribute('data-toggle-password');
        const passwordInput = document.getElementById(targetId);

        if (!passwordInput) return;

        toggleBtn.addEventListener('click', () => {
            const shouldShowPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', shouldShowPassword ? 'text' : 'password');
            toggleBtn.setAttribute('aria-label', shouldShowPassword ? 'Hide password' : 'Show password');
            toggleBtn.setAttribute('aria-pressed', shouldShowPassword ? 'true' : 'false');
            toggleBtn.innerHTML = `<i data-lucide="${shouldShowPassword ? 'eye-off' : 'eye'}"></i>`;
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons({
                    attrs: {
                        width: 18,
                        height: 18
                    }
                });
            }
        });
    });

    if (loginForm) {
        bindAdminForgotPassword();
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = btn.innerText;

            btn.innerText = 'Verifying...';
            btn.disabled = true;

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const responseText = await response.text();
                let result = null;

                try {
                    result = responseText ? JSON.parse(responseText) : null;
                } catch (parseError) {
                    throw new Error(responseText || 'The server returned an unexpected response.');
                }

                if (response.ok && result.success) {
                    console.log("Login Success:", result.user.role);

                    // Store JWT and User Info
                    sessionStorage.setItem('eduCore_token', result.token);
                    sessionStorage.setItem('loggedInUser', JSON.stringify(result.user));
                    if (result.sessionId) {
                        sessionStorage.setItem('eduCore_session_id', String(result.sessionId));
                    } else {
                        sessionStorage.removeItem('eduCore_session_id');
                    }
                    sessionStorage.removeItem('eduCore_permissions_config');
                    if (result.permissions) {
                        sessionStorage.setItem('eduCore_permissions_config', JSON.stringify(result.permissions));
                    }

                    // Track login for statistics
                    const loginTracking = JSON.parse(localStorage.getItem('EDUCORE_LOGIN_TRACKING')) || { count: 0, lastLogin: null };
                    loginTracking.count += 1;
                    loginTracking.lastLogin = new Date().toISOString();
                     localStorage.setItem('EDUCORE_LOGIN_TRACKING', JSON.stringify(loginTracking));
 
                     pushNotification('System Access', `${result.user.role} logged in: ${result.user.fullName}`, 'login');
                    queueWelcomeAnimationForNextPage(result.user);
 
                     btn.innerText = 'Redirecting...';

                    const getDefaultRoleHome = () => {
                        if (result.user.role === 'Admin') return 'dashboard.html';
                        if (result.user.role === 'Branch') return 'students.html';
                        if (result.user.role === 'Student') return 'student_portal.html';
                        if (result.user.role === 'Teacher') return 'teacher_portal.html';
                        return 'dashboard.html';
                    };

                    const getPermissionHome = () => {
                        if (!result.permissions) return '';
                        if (result.user.role === 'Student') return 'student_portal.html';
                        if (result.user.role === 'Teacher') return 'teacher_portal.html';
                        const groupKey = result.user.groupKey || result.permissions.roleGroups?.[result.user.role];
                        const group = result.permissions.groups?.[groupKey];
                        const pageRegistry = window.eduCoreAuth?.pageRegistry || {};
                        const homePage = group?.homePage || '';
                        const homeModule = pageRegistry[homePage]?.moduleKey;
                        if (homePage && homeModule && group?.permissions?.[homeModule] !== 'none') {
                            return homePage;
                        }
                        const firstAllowed = Object.entries(pageRegistry).find(([, page]) => group?.permissions?.[page.moduleKey] !== 'none');
                        return firstAllowed ? firstAllowed[0] : '';
                    };

                    setTimeout(() => {
                        window.location.href = toRoutePath(getPermissionHome() || getDefaultRoleHome());
                    }, 800);
                } else {
                    throw new Error(result.message || 'Invalid Username or Password');
                }
            } catch (error) {
                console.error("Login Error:", error);

                let errorMsg = error.message;
                if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                    errorMsg = "🔴 Connection Failed! Please ensure the Backend Server is running.\n\nRun 'node server.js' in your terminal.";
                }

                alert(errorMsg);
                btn.innerText = originalBtnText;
                btn.disabled = false;
                pushNotification('Security Alert', `Failed login attempt for ${username}`, 'alert');
            }
        });
    }

    // === STUDENT PAGE ===
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        const existingStudents = getArrayData(STORAGE_KEY_STUDENTS);
        const normalizedStudents = mergeStudentRecords(existingStudents);
        if (JSON.stringify(existingStudents) !== JSON.stringify(normalizedStudents)) {
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(normalizedStudents));
        }
        renderStudents(); // Initial Load
        refreshStudentsFromSQL()
            .then(() => renderStudents())
            .catch((error) => {
                console.warn('Students could not be refreshed from database:', error.message);
                renderStudents();
            });
        loadStudentQuickFilterBranchCampuses();
        loadClassFeeDefaults().then(() => {
            bindStudentClassFeeAutoFill();
            applyClassFeeDefaultToStudentForm();
        }).catch(() => {
            bindStudentClassFeeAutoFill();
        });
        bindStudentFormSubmit();
        const studentSearch = document.getElementById('studentSearchInput');
        const quickFilter = document.getElementById('studentQuickFilter');
        const printMode = document.getElementById('studentPrintMode');
        const studentProfileImage = document.getElementById('studentProfileImage');
        const studentNameInput = document.getElementById('fullName');
        populateStudentFamilyOptions();
        bindStudentQuickFilterMultiSelect();
        if (studentProfileImage) {
            studentProfileImage.addEventListener('change', handleStudentPhotoSelection);
        }
        if (studentNameInput) {
            studentNameInput.addEventListener('input', () => {
                const currentImage = document.querySelector('#studentPhotoPreview img')?.getAttribute('src') || '';
                setStudentPhotoPreview(currentImage, studentNameInput.value);
            });
        }
        if (studentSearch) {
            studentSearch.addEventListener('input', () => {
                studentColumnSearchFilter = null;
                studentSearch.placeholder = 'Search';
                renderStudents();
            });
        }
        if (quickFilter) {
            quickFilter.addEventListener('change', renderStudents);
        }
        if (printMode) {
            const saved = String(localStorage.getItem('eduCore_student_print_mode') || '').trim();
            printMode.value = (saved === 'outer' || saved === 'school') ? saved : 'school';
            printMode.addEventListener('change', () => {
                localStorage.setItem('eduCore_student_print_mode', String(printMode.value || 'school'));
            });
        }
    }

    // === TEACHER PAGE ===
    const teacherForm = document.getElementById('teacherForm');
    if (teacherForm) {
        renderTeachers(); // Initial Load
        refreshTeachersFromSQL()
            .then(() => renderTeachers())
            .catch((error) => {
                console.warn('Teachers could not be refreshed from database:', error.message);
                renderTeachers();
            });
        bindTeacherFormSubmit();
        const tSearch = document.getElementById('teacherSearchInput');
        const tCampusFilter = document.getElementById('teacherCampusFilter');
        const tGenderFilter = document.getElementById('teacherGenderFilter');
        const teacherProfileImage = document.getElementById('tProfileImage');
        const teacherNameInput = document.getElementById('tFullName');
        if (teacherProfileImage) {
            teacherProfileImage.addEventListener('change', handleTeacherPhotoSelection);
        }
        if (teacherNameInput) {
            teacherNameInput.addEventListener('input', () => {
                const currentImage = document.querySelector('#teacherPhotoPreview img')?.getAttribute('src') || '';
                setTeacherPhotoPreview(currentImage, teacherNameInput.value);
            });
        }
        if (tSearch) {
            tSearch.addEventListener('input', (e) => renderTeachers(e.target.value.toLowerCase()));
        }
        if (tCampusFilter) {
            tCampusFilter.addEventListener('change', () => {
                renderTeachers((tSearch?.value || '').toLowerCase());
            });
        }
        if (tGenderFilter) {
            tGenderFilter.addEventListener('change', () => {
                renderTeachers((tSearch?.value || '').toLowerCase());
            });
        }
    }

    // === STAFF PAGE ===
    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        renderStaff(); // Initial Load
        refreshStaffFromSQL()
            .then(() => renderStaff())
            .catch((error) => {
                console.warn('Staff could not be refreshed from database:', error.message);
                renderStaff();
        });
        bindStaffFormSubmit();
        const sSearch = document.getElementById('staffSearchInput');
        const staffProfileImage = document.getElementById('sProfileImage');
        const staffNameInput = document.getElementById('sFullName');
        if (staffProfileImage) {
            staffProfileImage.addEventListener('change', handleStaffPhotoSelection);
        }
        if (staffNameInput) {
            staffNameInput.addEventListener('input', () => {
                const currentImage = document.querySelector('#staffPhotoPreview img')?.getAttribute('src') || '';
                setStaffPhotoPreview(currentImage, staffNameInput.value);
            });
        }
        if (sSearch) {
            sSearch.addEventListener('input', (e) => renderStaff(e.target.value.toLowerCase()));
        }
    }

    // === CLASSES PAGE ===
    const classForm = document.getElementById('classForm');
    if (classForm) {
        renderClasses(); // Initial Load
        classForm.addEventListener('submit', handleClassFormSubmit);
        const cSearch = document.getElementById('classSearchInput');
        if (cSearch) {
            cSearch.addEventListener('input', (e) => renderClasses(e.target.value.toLowerCase()));
        }
    }

    // === SETTINGS PAGE ===
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        loadSettings();
        settingsForm.addEventListener('submit', handleSettingsSubmit);
        document.getElementById('sSchoolLogo')?.addEventListener('change', handleBrandingLogoSelection);
        document.getElementById('clearBrandingLogoBtn')?.addEventListener('click', clearBrandingLogo);
    }

    const branchRegistrationForm = document.getElementById('branchRegistrationForm');
    if (branchRegistrationForm) {
        renderBranches();
        branchRegistrationForm.addEventListener('submit', handleBranchRegistrationSubmit);
    }

    const stuckOffTable = document.getElementById('stuckOffRecordsBody');
    if (stuckOffTable) {
        renderStuckOffPage();
        document.getElementById('stuckOffTypeFilter')?.addEventListener('change', renderStuckOffPage);
        document.getElementById('stuckOffSearchInput')?.addEventListener('input', renderStuckOffPage);
    }

    // === DASHBOARD HOME LOGIC ===
    initializeDashboardHome();

    // === FINANCE PAGE ===
    const financeTable = document.getElementById('financeTable');
    if (financeTable) {
        renderFinance();
        const fSearch = document.getElementById('financeSearchInput');
        if (fSearch) {
            fSearch.addEventListener('input', (e) => renderFinance(e.target.value.toLowerCase()));
        }
    }


});

// =======================================================
// ==================== GENERIC HELPERS ==================
// =======================================================

function getData(key) {
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (error) {
        console.warn(`Invalid local data for ${key}: ${error.message}`);
        return [];
    }
}

function getArrayData(key) {
    const value = getData(key);
    return Array.isArray(value) ? value : [];
}

function getUniqueCampusNames(extraCampuses = []) {
    const campusMap = new Map();
    const addCampus = (campusName) => {
        const normalized = String(campusName || '').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (!campusMap.has(key)) campusMap.set(key, normalized);
    };

    DEFAULT_CAMPUS_NAMES.forEach(addCampus);
    extraCampuses.forEach(addCampus);
    getArrayData(STORAGE_KEY_STUDENTS).forEach((student) => addCampus(student.campusName));
    getArrayData(STORAGE_KEY_TEACHERS).forEach((teacher) => addCampus(teacher.campusName || teacher.bankBranch));
    getData(STORAGE_KEY_STAFF).forEach((staff) => addCampus(staff.campusName || staff.bankBranch));

    return Array.from(campusMap.values()).sort((a, b) => a.localeCompare(b));
}

function populateCampusSelect(selectId, campuses, placeholder, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const previousValue = selectedValue || select.value || '';
    select.innerHTML = `<option value="">${placeholder}</option>`;

    campuses.forEach((campusName) => {
        const option = document.createElement('option');
        option.value = campusName;
        option.textContent = campusName;
        select.appendChild(option);
    });

    if (previousValue && !campuses.some((campusName) => campusName.toLowerCase() === previousValue.toLowerCase())) {
        const option = document.createElement('option');
        option.value = previousValue;
        option.textContent = previousValue;
        select.appendChild(option);
    }

    select.value = previousValue;

    if (!select.value && (selectId === 'campusName' || selectId === 'tCampusName') && campuses.length === 1) {
        select.value = campuses[0];
    }
}

async function loadRegisteredCampusNames() {
    try {
        const response = await fetch(`${API_BASE_URL}/branches`);
        const result = await parseJsonResponse(response, 'Branches could not be loaded.');
        if (!response.ok || !Array.isArray(result)) {
            throw new Error('Branches could not be loaded.');
        }
        return getUniqueCampusNames(result.map((branch) => branch.campusName));
    } catch (error) {
        return getUniqueCampusNames();
    }
}

async function populateCampusDropdowns() {
    const campuses = await loadRegisteredCampusNames();
    populateCampusSelect('campusName', campuses, campuses.length ? 'Select Campus' : 'Add campus in Branch Registration first');
    populateCampusSelect('tCampusName', campuses, campuses.length ? 'Select Campus' : 'Add campus in Branch Registration first');
    populateCampusSelect('teacherCampusFilter', campuses, 'All Campuses');
    populateCampusSelect('tBankBranch', campuses, campuses.length ? 'Select Branch' : 'Add campus in Branch Registration first');
    populateCampusSelect('sBankBranch', campuses, campuses.length ? 'Select Branch' : 'Add campus in Branch Registration first');
}

function ensureStudentCampusDefault() {
    const campusSelect = document.getElementById('campusName');
    if (!campusSelect) return;

    const campuses = getUniqueCampusNames();
    const defaultCampus = campuses[0] || DEFAULT_CAMPUS_NAMES[0] || 'Main Campus';
    if (![...campusSelect.options].some((option) => option.value === defaultCampus)) {
        const option = document.createElement('option');
        option.value = defaultCampus;
        option.textContent = defaultCampus;
        campusSelect.appendChild(option);
    }
    if (!campusSelect.value) campusSelect.value = defaultCampus;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function getBrandingSettings() {
    const fallback = {
        schoolName: 'My own Science school',
        schoolTitle: 'Apexiums School System',
        session: '',
        phone: '',
        logoDataUrl: ''
    };
    try {
        return { ...fallback, ...(JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}') || {}) };
    } catch (_error) {
        return fallback;
    }
}

function getBrandingLogoSrc() {
    const branding = getBrandingSettings();
    return branding.logoDataUrl || 'images/logo.png';
}

function getBrandingLogoMarkup(className = 'print-logo', alt = 'School logo') {
    return `<img class="${escapeHtml(className)}" src="${escapeHtml(getBrandingLogoSrc())}" alt="${escapeHtml(alt)}">`;
}

function isHashedPassword(value) {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

function normalizeTeacherSchedule(schedule) {
    if (Array.isArray(schedule)) return schedule;
    if (typeof schedule === 'string' && schedule.trim()) {
        try {
            const parsed = JSON.parse(schedule);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
}

function formatScheduleTime(startTime = '', endTime = '') {
    if (!startTime && !endTime) return '-';
    return `${startTime || '-'} - ${endTime || '-'}`;
}

function mergeStudentRecords(incomingStudents) {
    const existingStudents = getArrayData(STORAGE_KEY_STUDENTS);
    const incomingList = Array.isArray(incomingStudents) ? incomingStudents : [];
    let nextStudentCodeNumber = 1;

    existingStudents.forEach(student => {
        const match = String(student.studentCode || '').trim().match(/^STU-(\d{1,5})$/i);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed >= nextStudentCodeNumber) {
                nextStudentCodeNumber = parsed + 1;
            }
        }
    });

    const mergedStudents = incomingList.map(student => {
        const localStudent = existingStudents.find(item => item.id === student.id) || {};
        let studentCode = student.studentCode || localStudent.studentCode || '';

        if (!studentCode) {
            studentCode = `STU-${String(nextStudentCodeNumber).padStart(3, '0')}`;
            nextStudentCodeNumber += 1;
        }

        return {
            ...student,
            studentCode,
            profileImage: student.profileImage || localStudent.profileImage || '',
            admissionDate: student.admissionDate || localStudent.admissionDate || '',
            gender: student.gender || localStudent.gender || '',
            campusName: student.campusName || localStudent.campusName || '',
            familyId: student.familyId || localStudent.familyId || '',
            familyName: student.familyName || localStudent.familyName || '',
            familyNo: student.familyNo || localStudent.familyNo || '',
            familyContact: student.familyContact || localStudent.familyContact || '',
            enrollmentStatus: student.enrollmentStatus || localStudent.enrollmentStatus || (student.isTerminated ? 'Terminated' : 'Active'),
            terminatedAt: student.terminatedAt || localStudent.terminatedAt || '',
            terminationNote: student.terminationNote || localStudent.terminationNote || '',
            plainPassword: student.plainPassword || localStudent.plainPassword ||
                (localStudent.password && !isHashedPassword(localStudent.password) ? localStudent.password : '')
        };
    });

    return mergedStudents;
}

function mergeTeacherRecords(incomingTeachers) {
    const existingTeachers = getArrayData(STORAGE_KEY_TEACHERS);
    const incomingList = Array.isArray(incomingTeachers) ? incomingTeachers : [];
    const mergedTeachers = incomingList.map((teacher) => {
        const localTeacher = existingTeachers.find(item => item.id === teacher.id) || {};
        const normalizedDesignation = normalizeTeacherDesignation(
            teacher.designation || localTeacher.designation,
            teacher.groupKey || localTeacher.groupKey
        );

        return {
            ...localTeacher,
            ...teacher,
            designation: normalizedDesignation.designation,
            groupKey: normalizedDesignation.groupKey,
            profileImage: teacher.profileImage || localTeacher.profileImage || '',
            employmentStatus: teacher.employmentStatus || localTeacher.employmentStatus || 'Active',
            stuckOffAt: teacher.stuckOffAt || localTeacher.stuckOffAt || '',
            stuckOffNote: teacher.stuckOffNote || localTeacher.stuckOffNote || '',
            schedule: normalizeTeacherSchedule(teacher.schedule || localTeacher.schedule),
            plainPassword: teacher.plainPassword || localTeacher.plainPassword ||
                (localTeacher.password && !isHashedPassword(localTeacher.password) ? localTeacher.password : '')
        };
    });

    existingTeachers.forEach((teacher) => {
        if (!mergedTeachers.some(item => item.id === teacher.id)) {
            mergedTeachers.push(teacher);
        }
    });

    return mergedTeachers;
}

function isStudentTerminated(student) {
    const enrollmentStatus = String(student?.enrollmentStatus || '').trim().toLowerCase();
    if (enrollmentStatus === 'terminated' || enrollmentStatus === 'left' || enrollmentStatus === 'inactive' || enrollmentStatus === 'stuck off' || enrollmentStatus === 'stuck-off' || enrollmentStatus === 'stuckoff') return true;
    if (student?.isTerminated === true) return true; // legacy
    return String(student?.feesStatus || '').trim().toLowerCase() === 'terminated';
}

function isStudentStuckOff(student) {
    const enrollmentStatus = String(student?.enrollmentStatus || '').trim().toLowerCase();
    return enrollmentStatus === 'stuck off' || enrollmentStatus === 'stuck-off' || enrollmentStatus === 'stuckoff';
}

function isTeacherStuckOff(teacher) {
    const status = String(teacher?.employmentStatus || '').trim().toLowerCase();
    return status === 'stuck off' || status === 'stuck-off' || status === 'stuckoff';
}

function stuckOffStudent(studentId) {
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const index = students.findIndex((s) => String(s?.id || '') === String(studentId || ''));
    if (index === -1) return;

    const student = students[index];
    if (isStudentStuckOff(student)) {
        showAppAlert('Student is already marked as stuck off.', 'No Changes');
        return;
    }

    const confirmText = `Mark "${student.fullName || 'Student'}" as stuck off?\n\nThis student will be removed from the active student list and shown in Stuck Off records.`;
    const ok = typeof showAppConfirm === 'function' ? showAppConfirm(confirmText) : Promise.resolve(window.confirm(confirmText));

    Promise.resolve(ok).then((confirmed) => {
        if (!confirmed) return;

        const today = new Date().toISOString().split('T')[0];
        const updatedStudent = {
            ...student,
            enrollmentStatus: 'Stuck Off',
            stuckOffAt: today,
            terminatedAt: today,
            terminationNote: student.terminationNote || ''
        };

        students[index] = updatedStudent;
        saveData(STORAGE_KEY_STUDENTS, students, { skipSync: true });
        syncToSQLDetailed('students', [updatedStudent]).catch(() => {});
        pushNotification('Student Updated', `"${updatedStudent.fullName || 'Student'}" marked as stuck off.`, 'info');
        renderStudents();
        renderAdminRecordPanels();
        renderStuckOffPage();
    }).catch(() => {});
}

function terminateStudent(studentId) {
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const index = students.findIndex((s) => String(s?.id || '') === String(studentId || ''));
    if (index === -1) return;

    const student = students[index];
    if (isStudentTerminated(student)) {
        showAppAlert('Student is already marked as terminated.', 'No Changes');
        return;
    }

    const confirmText = `Mark "${student.fullName || 'Student'}" as terminated (left school)?\n\nAfter termination, fee calculation and challan generation will be disabled for this student.`;
    const ok = typeof showAppConfirm === 'function' ? showAppConfirm(confirmText) : Promise.resolve(window.confirm(confirmText));

    Promise.resolve(ok).then((confirmed) => {
        if (!confirmed) return;

        const today = new Date().toISOString().split('T')[0];
        const updatedStudent = {
            ...student,
            enrollmentStatus: 'Terminated',
            terminatedAt: today,
            terminationNote: student.terminationNote || ''
        };

        students[index] = updatedStudent;
        saveData(STORAGE_KEY_STUDENTS, students, { skipSync: true });
        syncToSQLDetailed('students', [updatedStudent]).catch(() => {});
        pushNotification('Student Updated', `"${updatedStudent.fullName || 'Student'}" marked as terminated.`, 'info');
        renderStudents();
        renderAdminRecordPanels();
    }).catch(() => {});
}

function reactivateStudent(studentId) {
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const index = students.findIndex((s) => String(s?.id || '') === String(studentId || ''));
    if (index === -1) return;

    const student = students[index];
    if (!isStudentTerminated(student)) {
        showAppAlert('Student is not marked as terminated.', 'No Changes');
        return;
    }

    const confirmText = `Reactivate "${student.fullName || 'Student'}"?\n\nThis will include the student again in fee calculations and challan generation.`;
    const ok = typeof showAppConfirm === 'function' ? showAppConfirm(confirmText) : Promise.resolve(window.confirm(confirmText));

    Promise.resolve(ok).then((confirmed) => {
        if (!confirmed) return;

        const updatedStudent = {
            ...student,
            enrollmentStatus: 'Active',
            stuckOffAt: '',
            terminatedAt: '',
            terminationNote: ''
        };

        students[index] = updatedStudent;
        saveData(STORAGE_KEY_STUDENTS, students, { skipSync: true });
        syncToSQLDetailed('students', [updatedStudent]).catch(() => {});
        pushNotification('Student Updated', `"${updatedStudent.fullName || 'Student'}" reactivated.`, 'success');
        renderStudents();
        renderAdminRecordPanels();
        renderStuckOffPage();
    }).catch(() => {});
}

function mergeStaffRecords(incomingStaff) {
    const existingStaff = getData(STORAGE_KEY_STAFF);
    const incomingList = Array.isArray(incomingStaff) ? incomingStaff : [];

    const mergedStaff = incomingList.map((member) => {
        const localStaff = existingStaff.find(item => item.id === member.id) || {};

        return {
            ...localStaff,
            ...member,
            groupKey: member.groupKey || localStaff.groupKey || 'staff',
            plainPassword: member.plainPassword || localStaff.plainPassword ||
                (localStaff.password && !isHashedPassword(localStaff.password) ? localStaff.password : '')
        };
    });

    existingStaff.forEach((member) => {
        if (!mergedStaff.some(item => item.id === member.id)) {
            mergedStaff.push(member);
        }
    });

    return mergedStaff;
}

function getStudentInitial(name) {
    return (String(name || 'S').trim().charAt(0) || 'S').toUpperCase();
}

function getTeacherInitial(name) {
    return (String(name || 'T').trim().charAt(0) || 'T').toUpperCase();
}

function buildStudentAvatarMarkup(student) {
    if (student.profileImage) {
        return `<img src="${student.profileImage}" alt="${student.fullName || 'Student'}">`;
    }
    return getStudentInitial(student.fullName);
}

function buildTeacherAvatarMarkup(teacher) {
    if (teacher.profileImage) {
        return `<img src="${teacher.profileImage}" alt="${teacher.fullName || 'Teacher'}">`;
    }
    return getTeacherInitial(teacher.fullName);
}

function setStudentPhotoPreview(imageSrc = '', fullName = '') {
    const preview = document.getElementById('studentPhotoPreview');
    if (!preview) return;

    if (imageSrc) {
        preview.innerHTML = `<img src="${imageSrc}" alt="${fullName || 'Student'}">`;
        return;
    }

    preview.innerHTML = '';
}

function setTeacherPhotoPreview(imageSrc = '', fullName = '') {
    const preview = document.getElementById('teacherPhotoPreview');
    if (!preview) return;

    if (imageSrc) {
        preview.innerHTML = `<img src="${imageSrc}" alt="${fullName || 'Teacher'}">`;
        return;
    }

    preview.innerHTML = '';
}

function getStaffInitial(fullName = '') {
    const value = String(fullName || '').trim();
    return value ? value.charAt(0).toUpperCase() : 'S';
}

function setStaffPhotoPreview(imageSrc = '', fullName = '') {
    const preview = document.getElementById('staffPhotoPreview');
    if (!preview) return;

    if (imageSrc) {
        preview.innerHTML = `<img src="${imageSrc}" alt="${fullName || 'Staff'}">`;
        return;
    }

    preview.textContent = getStaffInitial(fullName);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('There was a problem reading the image.'));
        reader.readAsDataURL(file);
    });
}

async function readImageInputDataUrl(inputId, existingImage = '') {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file) return existingImage || '';

    if (!file.type.startsWith('image/')) {
        if (input) input.value = '';
        throw new Error('Please upload an image file only.');
    }

    return readFileAsDataUrl(file);
}

async function handleStudentPhotoSelection(event) {
    const file = event.target?.files?.[0];
    const fullName = document.getElementById('fullName')?.value || '';

    if (!file) {
        setStudentPhotoPreview('', fullName);
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file only.');
        event.target.value = '';
        setStudentPhotoPreview('', fullName);
        return;
    }

    try {
        const imageSrc = await readFileAsDataUrl(file);
        setStudentPhotoPreview(imageSrc, fullName);
    } catch (error) {
        alert(error.message);
    }
}

async function handleTeacherPhotoSelection(event) {
    const file = event.target?.files?.[0];
    const fullName = document.getElementById('tFullName')?.value || '';

    if (!file) {
        setTeacherPhotoPreview('', fullName);
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file only.');
        event.target.value = '';
        setTeacherPhotoPreview('', fullName);
        return;
    }

    try {
        const imageSrc = await readFileAsDataUrl(file);
        setTeacherPhotoPreview(imageSrc, fullName);
    } catch (error) {
        alert(error.message);
    }
}

function getVisibleStudentPassword(student) {
    if (student.plainPassword) return student.plainPassword;
    if (student.password && !isHashedPassword(student.password)) return student.password;
    return 'Reset required';
}

function formatDateForDisplay(value) {
    const raw = String(value || '').trim();
    if (!raw) return '-';

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return raw;
    }

    return parsed.toLocaleDateString('en-GB');
}

function isStudentBelowAge(student, maxAgeYears) {
    const rawDob = String(student?.dob || '').trim();
    if (!rawDob) return false;

    const dob = new Date(rawDob);
    if (Number.isNaN(dob.getTime())) return false;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age -= 1;
    }

    return age < maxAgeYears;
}

function saveData(key, data, options = {}) {
    const { skipSync = false } = options;
    localStorage.setItem(key, JSON.stringify(data));

    if (skipSync) return;

    // Auto-Sync to Real-Time SQL
    if (key === STORAGE_KEY_STUDENTS) syncToSQL('students', data);
    if (key === STORAGE_KEY_TEACHERS) syncToSQL('teachers', data);
    if (key === STORAGE_KEY_STAFF) syncToSQL('staff', data);
}

function getPromotionHistory() {
    return getData(STORAGE_KEY_PROMOTION_HISTORY);
}

function savePromotionHistory(history) {
    localStorage.setItem(STORAGE_KEY_PROMOTION_HISTORY, JSON.stringify(history));
}

function generateUniqueRecordId(prefix = 'REC') {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOptionalIdentityValue(value, mode = 'text') {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return mode === 'email' ? normalized.toLowerCase() : normalized;
}

function validateTeacherIdentityInputs({ teacherId = '', username = '', email = '' }) {
    let teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const staffMembers = getArrayData(STORAGE_KEY_STAFF);
    const normalizedUsername = normalizeOptionalIdentityValue(username);
    const normalizedEmail = normalizeOptionalIdentityValue(email, 'email');

    const usernameConflict = teachers.find(teacher =>
        teacher.id !== teacherId &&
        normalizeOptionalIdentityValue(teacher.username) === normalizedUsername
    );

    if (usernameConflict) {
        return 'This teacher username is already assigned to another teacher.';
    }

    const crossRoleUsernameConflict = [...students, ...staffMembers].find(account =>
        normalizeOptionalIdentityValue(account.username) === normalizedUsername
    );

    if (crossRoleUsernameConflict) {
        return 'This username is already used by another account.';
    }

    if (normalizedEmail) {
        const emailConflict = teachers.find(teacher =>
            teacher.id !== teacherId &&
            normalizeOptionalIdentityValue(teacher.email, 'email') === normalizedEmail
        );

        if (emailConflict) {
            return 'This teacher email is already assigned to another teacher.';
        }

        const crossRoleEmailConflict = [...students, ...staffMembers].find(account =>
            normalizeOptionalIdentityValue(account.email, 'email') === normalizedEmail
        );

        if (crossRoleEmailConflict) {
            return 'This email is already used by another account.';
        }
    }

    return '';
}

function getDesignationGroup(selectId, fallbackGroupKey) {
    const select = document.getElementById(selectId);
    if (!select) return fallbackGroupKey;
    const option = select.options[select.selectedIndex];
    return option?.dataset?.groupKey || fallbackGroupKey;
}

function normalizeTeacherDesignation(designationValue = '', groupKeyValue = '') {
    const designation = String(designationValue || '').trim().toLowerCase();
    const groupKey = String(groupKeyValue || '').trim().toLowerCase();

    if (designation === 'superadmin' || designation === 'super admin' || designation === 'super_admin' || groupKey === 'superadmin' || groupKey === 'super_admin') {
        return { designation: 'Superadmin', groupKey: 'superadmin' };
    }

    if (designation === 'computer operator' || designation === 'computer_operator' || designation === 'computer opetaor' || groupKey === 'computer_operator' || groupKey === 'computeroperator') {
        return { designation: 'Computer Operator', groupKey: 'computer_operator' };
    }

    if (
        designation === 'admin' ||
        designation === 'system administrator' ||
        designation === 'principal' ||
        designation === 'branch manager' ||
        groupKey === 'admin' ||
        groupKey === 'principal' ||
        groupKey === 'branch_manager'
    ) {
        return { designation: 'Admin', groupKey: 'admin' };
    }

    return { designation: 'Teacher', groupKey: 'teacher' };
}

function setDesignationSelectValue(selectId, value, fallbackGroupKey) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const normalized = String(value || '').trim();
    if (!normalized) {
        select.selectedIndex = 0;
        return;
    }

    const existingOption = Array.from(select.options).find((option) => option.value === normalized);
    if (!existingOption) {
        const option = document.createElement('option');
        option.value = normalized;
        option.textContent = normalized;
        option.dataset.groupKey = fallbackGroupKey;
        select.appendChild(option);
    }
    select.value = normalized;
}

function validateStudentIdentityInputs({ studentId = '', username = '', email = '' }) {
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    let teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const staffMembers = getArrayData(STORAGE_KEY_STAFF);
    const normalizedUsername = normalizeOptionalIdentityValue(username);
    const normalizedEmail = normalizeOptionalIdentityValue(email, 'email');

    if (normalizedUsername) {
        const usernameConflict = students.find(student =>
            student.id !== studentId &&
            normalizeOptionalIdentityValue(student.username) === normalizedUsername
        );

        if (usernameConflict) {
            return 'This student username is already assigned to another student.';
        }

        const crossRoleUsernameConflict = [...teachers, ...staffMembers].find(account =>
            normalizeOptionalIdentityValue(account.username) === normalizedUsername
        );

        if (crossRoleUsernameConflict) {
            return 'This username is already used by another account.';
        }
    }

    const classFeeForm = document.getElementById('classFeeForm');
    if (classFeeForm) {
        setupClassFeeSettings();
    }

    if (normalizedEmail) {
        const emailConflict = students.find(student =>
            student.id !== studentId &&
            normalizeOptionalIdentityValue(student.email, 'email') === normalizedEmail
        );

        if (emailConflict) {
            return 'This student email is already assigned to another student.';
        }

        const crossRoleEmailConflict = [...teachers, ...staffMembers].find(account =>
            normalizeOptionalIdentityValue(account.email, 'email') === normalizedEmail
        );

        if (crossRoleEmailConflict) {
            return 'This email is already used by another account.';
        }
    }

    return '';
}

function generateEntityCode(storageKey, prefix) {
    const records = getData(storageKey);
    let nextNumber = 1;

    records.forEach((record) => {
        const match = String(record.employeeCode || '').match(/(\d+)$/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed >= nextNumber) {
                nextNumber = parsed + 1;
            }
        }
    });

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

async function getOptionalFilePayload(inputId, existingPayload = null) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];

    if (!file) return existingPayload || null;

    return JSON.stringify({
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file)
    });
}

function parseStoredFilePayload(payload) {
    if (!payload) return null;

    if (typeof payload === 'object' && payload.dataUrl) {
        return payload;
    }

    if (typeof payload === 'string') {
        if (payload.startsWith('data:')) {
            const mimeMatch = payload.match(/^data:([^;]+);/);
            return {
                name: 'document',
                type: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
                dataUrl: payload
            };
        }

        try {
            const parsed = JSON.parse(payload);
            if (parsed && parsed.dataUrl) return parsed;
        } catch (error) {
            return null;
        }
    }

    return null;
}

function sanitizeDownloadFileName(fileName) {
    return String(fileName || 'document')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function triggerDownloadFromDataUrl(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = sanitizeDownloadFileName(fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function triggerDownloadFromBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = sanitizeDownloadFileName(fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function dataUrlToBytes(dataUrl) {
    const encodedData = String(dataUrl || '').split(',')[1] || '';
    const binaryData = atob(encodedData);
    const bytes = new Uint8Array(binaryData.length);

    for (let index = 0; index < binaryData.length; index += 1) {
        bytes[index] = binaryData.charCodeAt(index);
    }

    return bytes;
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('The document image could not be loaded.'));
        img.src = dataUrl;
    });
}

async function downloadStoredDocumentAsPdf(entityType, recordId, fieldName, fallbackLabel = 'document') {
    const storageKey = entityType === 'teacher' ? STORAGE_KEY_TEACHERS : STORAGE_KEY_STAFF;
    const records = getData(storageKey);
    const record = records.find((item) => String(item.id) === String(recordId));
    const payload = parseStoredFilePayload(record?.[fieldName]);

    if (!payload?.dataUrl) {
        alert('Document not found for download.');
        return;
    }

    const baseName = sanitizeDownloadFileName(`${fallbackLabel}-${record?.employeeCode || record?.fullName || recordId}`);
    const fileType = String(payload.type || '').toLowerCase();
    const originalName = sanitizeDownloadFileName(payload.name || `${baseName}.pdf`);

    if (fileType.includes('pdf') || originalName.toLowerCase().endsWith('.pdf')) {
        triggerDownloadFromDataUrl(payload.dataUrl, originalName.toLowerCase().endsWith('.pdf') ? originalName : `${originalName}.pdf`);
        return;
    }

    if (!fileType.startsWith('image/')) {
        triggerDownloadFromDataUrl(payload.dataUrl, originalName);
        return;
    }

    if (!window.jspdf?.jsPDF) {
        triggerDownloadFromDataUrl(payload.dataUrl, originalName);
        return;
    }

    try {
        const image = await loadImageFromDataUrl(payload.dataUrl);
        const pdf = new window.jspdf.jsPDF({
            orientation: image.width >= image.height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 28;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
        const renderWidth = image.width * scale;
        const renderHeight = image.height * scale;
        const offsetX = (pageWidth - renderWidth) / 2;
        const offsetY = (pageHeight - renderHeight) / 2;

        pdf.addImage(payload.dataUrl, fileType.includes('png') ? 'PNG' : 'JPEG', offsetX, offsetY, renderWidth, renderHeight);
        pdf.save(`${baseName}.pdf`);
    } catch (error) {
        alert('The document could not be converted to PDF.');
    }
}

async function getPdfCompatibleImageData(payload) {
    const fileType = String(payload.type || '').toLowerCase();

    if (fileType.includes('png')) {
        return { bytes: dataUrlToBytes(payload.dataUrl), format: 'png' };
    }

    if (fileType.includes('jpg') || fileType.includes('jpeg')) {
        return { bytes: dataUrlToBytes(payload.dataUrl), format: 'jpg' };
    }

    const image = await loadImageFromDataUrl(payload.dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

    return { bytes: dataUrlToBytes(canvas.toDataURL('image/png')), format: 'png' };
}

async function addImagePayloadToPdf(pdfDocument, payload) {
    const imageData = await getPdfCompatibleImageData(payload);
    const pdfImage = imageData.format === 'png'
        ? await pdfDocument.embedPng(imageData.bytes)
        : await pdfDocument.embedJpg(imageData.bytes);
    const page = pdfDocument.addPage([595.28, 841.89]);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const margin = 28;
    const scale = Math.min(
        (pageWidth - margin * 2) / pdfImage.width,
        (pageHeight - margin * 2) / pdfImage.height,
        1
    );
    const renderWidth = pdfImage.width * scale;
    const renderHeight = pdfImage.height * scale;

    page.drawImage(pdfImage, {
        x: (pageWidth - renderWidth) / 2,
        y: (pageHeight - renderHeight) / 2,
        width: renderWidth,
        height: renderHeight
    });
}

async function addStoredPayloadToPdf(pdfDocument, payload) {
    const fileType = String(payload.type || '').toLowerCase();
    const originalName = String(payload.name || '').toLowerCase();

    if (fileType.includes('pdf') || originalName.endsWith('.pdf')) {
        const sourcePdf = await window.PDFLib.PDFDocument.load(dataUrlToBytes(payload.dataUrl));
        const pages = await pdfDocument.copyPages(sourcePdf, sourcePdf.getPageIndices());
        pages.forEach((page) => pdfDocument.addPage(page));
        return;
    }

    if (fileType.startsWith('image/')) {
        await addImagePayloadToPdf(pdfDocument, payload);
        return;
    }

    throw new Error('Only PDF and image files can be combined.');
}

async function downloadTeacherDocumentsAsPdf(recordId) {
    const teacher = getData(STORAGE_KEY_TEACHERS)
        .find((item) => String(item.id) === String(recordId));
    const documents = ['idCardFront', 'idCardBack', 'cvFile']
        .map((fieldName) => parseStoredFilePayload(teacher?.[fieldName]))
        .filter((payload) => payload?.dataUrl);

    if (!documents.length) {
        alert('No teacher documents found for download.');
        return;
    }

    if (!window.PDFLib?.PDFDocument) {
        alert('PDF combiner is still loading. Try Download PDFs again.');
        return;
    }

    try {
        const combinedPdf = await window.PDFLib.PDFDocument.create();

        for (const payload of documents) {
            await addStoredPayloadToPdf(combinedPdf, payload);
        }

        const fileName = `teacher-documents-${teacher?.employeeCode || teacher?.fullName || recordId}.pdf`;
        const pdfBytes = await combinedPdf.save();
        triggerDownloadFromBlob(new Blob([pdfBytes], { type: 'application/pdf' }), fileName);
    } catch (error) {
        alert('Combined PDF could not be created. Upload CV as PDF or image to include it with the ID documents.');
    }
}

function toggleStepPanel(panelId) {
    const panel = document.getElementById(panelId);
    const btnId = panelId === 'feePanel' ? 'btnSetFee' : (panelId === 'salaryPanel' ? 'btnSetSalary' : 'btnCreateCreds');
    const btn = document.getElementById(btnId);

    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        if (btn) btn.classList.remove('active');
    } else {
        // Close others
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.action-step-btn').forEach(b => b.classList.remove('active'));

        panel.classList.add('active');
        if (btn) btn.classList.add('active');
    }
}

function showSuccessModal(title, message) {
    const modal = document.getElementById('successModal');
    const titleEl = document.getElementById('successTitle');
    const msgEl = document.getElementById('successMessage');
    if (modal && titleEl && msgEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;
        modal.style.display = 'flex';
        // Re-init icons to show check-circle in modal
        if (window.lucide) window.lucide.createIcons();
    } else {
        alert(message);
    }
}

const EDUCORE_WELCOME_SESSION_KEY = 'eduCore_welcome_payload';

function queueWelcomeAnimationForNextPage(user) {
    try {
        const displayName = user?.fullName || user?.username || user?.role || 'User';
        const role = user?.role || 'User';
        sessionStorage.setItem(
            EDUCORE_WELCOME_SESSION_KEY,
            JSON.stringify({ displayName, role, at: Date.now() })
        );
    } catch (error) {
        // Ignore
    }
}

function showWelcomeAnimationIfNeeded() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) return;

    const token = sessionStorage.getItem('eduCore_token');
    if (!token) return;

    let payload = null;
    try {
        payload = JSON.parse(sessionStorage.getItem(EDUCORE_WELCOME_SESSION_KEY) || 'null');
    } catch (error) {
        payload = null;
    }

    if (!payload || !payload.at) return;
    if (Date.now() - Number(payload.at) > 5 * 60 * 1000) {
        sessionStorage.removeItem(EDUCORE_WELCOME_SESSION_KEY);
        return;
    }

    sessionStorage.removeItem(EDUCORE_WELCOME_SESSION_KEY);

    const existing = document.getElementById('eduWelcomeOverlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'eduWelcomeOverlay';
    overlay.className = 'edu-welcome-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const safeName = String(payload.displayName || 'User').trim() || 'User';
    const safeRole = String(payload.role || 'User').trim() || 'User';
    const escape = typeof escapeSessionText === 'function' ? escapeSessionText : (value) => String(value ?? '');

    overlay.innerHTML = `
        <div class="edu-welcome-card">
            <div class="edu-welcome-glow" aria-hidden="true"></div>
            <div class="edu-welcome-icon"><i data-lucide="hand" width="28" height="28"></i></div>
            <h2 class="edu-welcome-title">Welcome, ${escape(safeName)}!</h2>
            <p class="edu-welcome-subtitle">${escape(safeRole)} dashboard is ready.</p>
            <div class="edu-welcome-divider" aria-hidden="true"></div>
            <button type="button" class="edu-welcome-skip">Get Started</button>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
        if (!overlay.classList.contains('active')) return;
        overlay.classList.add('closing');
        window.setTimeout(() => {
            overlay.remove();
        }, 240);
    };

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });

    const btn = overlay.querySelector('.edu-welcome-skip');
    if (btn) btn.addEventListener('click', close);

    overlay.classList.add('active');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    window.setTimeout(close, 1800);
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.style.display = 'none';
}

function getLoggedInUser() {
    try {
        return JSON.parse(sessionStorage.getItem('loggedInUser') || 'null');
    } catch (error) {
        return null;
    }
}

function normalizeDesignationKey(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '');
}

function getCurrentUserDesignationKey() {
    const user = getLoggedInUser();
    if (!user) return '';
    if (user.role !== 'Teacher' && user.role !== 'Staff') return '';
    return normalizeDesignationKey(user.designation || user.role);
}

function getCachedDesignationPermissions(designationKey) {
    if (!designationKey) return null;
    const cacheKey = `eduCore_designation_permissions:${designationKey}`;
    try {
        const raw = sessionStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function cacheDesignationPermissions(designationKey, payload) {
    if (!designationKey) return;
    const cacheKey = `eduCore_designation_permissions:${designationKey}`;
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(payload || null));
    } catch (_error) {
        // ignore storage failures
    }
}

async function loadDesignationPermissionsForCurrentUser() {
    const designationKey = getCurrentUserDesignationKey();
    if (!designationKey) return null;

    const cached = getCachedDesignationPermissions(designationKey);
    if (cached) return cached;

    const token = sessionStorage.getItem('eduCore_token') || '';
    if (!token) return null;

    const response = await fetch(`${API_BASE_URL}/designation-permissions?designation=${encodeURIComponent(designationKey)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const result = await parseJsonResponse(response, 'Failed to load designation permissions.');
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to load designation permissions.');
    }

    cacheDesignationPermissions(designationKey, result);
    return result;
}

function canCurrentUserPerformAction(moduleKey, actionKey) {
    const user = getLoggedInUser();
    if (!user) return false;

    if (user.role === 'Admin' || user.role === 'Principal') return true;

    // Branch is handled separately (hard-restricted in UI).
    if (user.role === 'Branch') return false;

    if (user.role === 'Teacher' || user.role === 'Staff') {
        const designationKey = getCurrentUserDesignationKey();
        const designationPerms = getCachedDesignationPermissions(designationKey);
        return designationPerms?.actionPermissions?.[moduleKey]?.[actionKey] === true;
    }

    return false;
}

function getSidebarScrollElement() {
    return document.querySelector('.sidebar .nav-links');
}

function getActiveSidebarItem(navLinks) {
    if (!navLinks) return null;
    const currentPage = getCurrentPageName();
    let activeItem = navLinks.querySelector('.nav-item.active, .nav-subitem.active');
    if (activeItem) return activeItem;

    activeItem = Array.from(navLinks.querySelectorAll('a[href]')).find((link) => (
        normalizeClientPageName(link.getAttribute('href') || '') === currentPage
    ));
    if (activeItem) activeItem.classList.add(activeItem.classList.contains('nav-subitem') ? 'active' : 'active');
    return activeItem || null;
}

function isSidebarItemVisible(navLinks, item) {
    if (!navLinks || !item) return true;
    const navRect = navLinks.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    return itemRect.top >= navRect.top && itemRect.bottom <= navRect.bottom &&
        itemRect.left >= navRect.left && itemRect.right <= navRect.right;
}

function keepActiveSidebarItemVisible(navLinks) {
    const activeItem = getActiveSidebarItem(navLinks);
    if (!activeItem || isSidebarItemVisible(navLinks, activeItem)) return;
    activeItem.scrollIntoView({ block: 'center', inline: 'nearest' });
}

let sidebarScrollRestoreUntil = 0;

function saveSidebarScrollPosition(extra = {}) {
    const navLinks = getSidebarScrollElement();
    if (!navLinks) return;

    const payload = JSON.stringify({
        top: navLinks.scrollTop || 0,
        left: navLinks.scrollLeft || 0,
        path: window.location.pathname,
        savedAt: Date.now(),
        ...extra
    });
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, payload);
    localStorage.setItem(SIDEBAR_SCROLL_KEY, payload);
}

function saveSidebarLinkPosition(link) {
    const navLinks = getSidebarScrollElement();
    if (!navLinks || !link) return;

    const navRect = navLinks.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    saveSidebarScrollPosition({
        targetHref: link.getAttribute('href') || '',
        itemTop: linkRect.top - navRect.top
    });
}

function readSidebarScrollPosition() {
    try {
        return JSON.parse(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || localStorage.getItem(SIDEBAR_SCROLL_KEY) || 'null');
    } catch (_error) {
        return null;
    }
}

async function handleStaffPhotoSelection(event) {
    const file = event.target?.files?.[0];
    const fullName = document.getElementById('sFullName')?.value || '';

    if (!file) {
        setStaffPhotoPreview('', fullName);
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file only.');
        event.target.value = '';
        setStaffPhotoPreview('', fullName);
        return;
    }

    try {
        const imageSrc = await readFileAsDataUrl(file);
        setStaffPhotoPreview(imageSrc, fullName);
    } catch (error) {
        alert(error.message);
    }
}

function restoreSidebarScrollPosition(savedPosition = readSidebarScrollPosition()) {
    const navLinks = getSidebarScrollElement();
    if (!navLinks) return;
    if (!savedPosition) return;

    window.requestAnimationFrame(() => {
        sidebarScrollRestoreUntil = Date.now() + 900;
        const targetHref = String(savedPosition.targetHref || '').trim();
        const targetPage = normalizeClientPageName(targetHref || window.location.pathname);
        const targetLink = Array.from(navLinks.querySelectorAll('a[href]')).find((link) => (
            normalizeClientPageName(link.getAttribute('href') || '') === targetPage
        ));

        if (targetLink && Number.isFinite(Number(savedPosition.itemTop))) {
            navLinks.scrollTop += targetLink.getBoundingClientRect().top -
                navLinks.getBoundingClientRect().top -
                Number(savedPosition.itemTop);
            navLinks.scrollLeft = Number(savedPosition.left) || 0;
            return;
        }

        if (Number.isFinite(Number(savedPosition.top))) {
            navLinks.scrollTop = Number(savedPosition.top) || 0;
            navLinks.scrollLeft = Number(savedPosition.left) || 0;
        }
    });
}

function initializeSidebarScrollMemory() {
    const navLinks = getSidebarScrollElement();
    if (!navLinks || navLinks.dataset.scrollMemoryBound === 'true') return;
    navLinks.dataset.scrollMemoryBound = 'true';

    const initialSavedPosition = readSidebarScrollPosition();
    const restoreInitialPosition = () => restoreSidebarScrollPosition(initialSavedPosition);
    [0, 50, 120, 250, 500, 900, 1400, 2200, 3200].forEach((delay) => {
        window.setTimeout(restoreInitialPosition, delay);
    });

    const restoreObserver = new MutationObserver(() => {
        if (Date.now() < sidebarScrollRestoreUntil || Date.now() - Number(initialSavedPosition?.savedAt || 0) < 6000) {
            restoreSidebarScrollPosition(initialSavedPosition);
        }
    });
    restoreObserver.observe(navLinks, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style']
    });
    window.setTimeout(() => restoreObserver.disconnect(), 6500);

    let pendingFrame = 0;
    navLinks.addEventListener('scroll', () => {
        if (Date.now() < sidebarScrollRestoreUntil) return;
        if (pendingFrame) return;
        pendingFrame = window.requestAnimationFrame(() => {
            pendingFrame = 0;
            saveSidebarScrollPosition();
        });
    }, { passive: true });

    const saveLinkEventPosition = (event) => {
        const link = event.target.closest('a[href]');
        if (link) saveSidebarLinkPosition(link);
    };

    navLinks.addEventListener('pointerdown', saveLinkEventPosition, { capture: true });
    navLinks.addEventListener('mousedown', saveLinkEventPosition, { capture: true });
    navLinks.addEventListener('touchstart', saveLinkEventPosition, { capture: true, passive: true });
    navLinks.addEventListener('click', saveLinkEventPosition, { capture: true });

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;
        const href = String(link.getAttribute('href') || '').trim();
        if (!href || href === '#' || href.startsWith('javascript:') || link.target === '_blank') return;
        saveSidebarScrollPosition({ targetHref: href });
    }, { capture: true });

    window.addEventListener('beforeunload', saveSidebarScrollPosition);
    window.addEventListener('pagehide', saveSidebarScrollPosition);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveSidebarScrollPosition();
    });
}

function ensureDesignationPermissionsNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-designation-permissions-link]')) return;

    const visitorBooksLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'visitor_books.html');
    const permissionsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'permissions.html');

    const designationLink = document.createElement('a');
    designationLink.href = toRoutePath('designation-permissions.html');
    designationLink.className = 'nav-item';
    designationLink.dataset.designationPermissionsLink = 'true';
    designationLink.innerHTML = '<i data-lucide="shield-check"></i><span>Designation Permissions</span>';

    if (permissionsLink) {
        permissionsLink.insertAdjacentElement('afterend', designationLink);
    } else {
        navLinks.appendChild(designationLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureBranchRegistrationNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-branch-registration-link]')) return;

    const teachersLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'teachers.html');
    const branchLink = document.createElement('a');
    branchLink.href = toRoutePath('branch_registration.html');
    branchLink.className = 'nav-item';
    branchLink.dataset.branchRegistrationLink = 'true';
    branchLink.innerHTML = '<i data-lucide="building-2"></i><span>Branch Registration</span>';

    if (teachersLink) {
        teachersLink.insertAdjacentElement('afterend', branchLink);
    } else {
        navLinks.appendChild(branchLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureAdminRecordsNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-admin-records-link]')) return;

    const currentPage = getCurrentPageName();
    const adminRecordLinks = [
        { page: 'certificate.html', label: 'Certificate', icon: 'award' },
        { page: 'complain_box.html', label: 'Complain Box', icon: 'message-square' },
        { page: 'visitor_books.html', label: 'Visitor Books', icon: 'clipboard-list' }
    ];
    const fragment = document.createDocumentFragment();

    adminRecordLinks.forEach((item) => {
        const link = document.createElement('a');
        link.href = toRoutePath(item.page);
        link.className = `nav-item${currentPage === item.page ? ' active' : ''}`;
        link.dataset.adminRecordsLink = 'true';
        link.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
        fragment.appendChild(link);
    });

    const branchRegistrationLink = navLinks.querySelector('[data-branch-registration-link]');
    const teachersLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'teachers.html');
    const insertAfter = branchRegistrationLink || teachersLink;

    if (insertAfter) {
        insertAfter.parentNode.insertBefore(fragment, insertAfter.nextSibling);
    } else {
        navLinks.appendChild(fragment);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureAttendanceNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-attendance-nav]')) return;

    const permissionsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'permissions.html');
    const currentPage = getCurrentPageName();
    const isAttendancePage = currentPage === 'student_attendance.html' || currentPage === 'teacher_attendance.html';
    const isAttendanceReportPage = currentPage === 'student_attendance_report.html' || currentPage === 'teacher_attendance_report.html';

    const wrapper = document.createElement('div');
    wrapper.className = `nav-dropdown${(isAttendancePage || isAttendanceReportPage) ? ' open' : ''}`;
    wrapper.dataset.attendanceNav = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `nav-item nav-dropdown-toggle${(isAttendancePage || isAttendanceReportPage) ? ' active' : ''}`;
    toggle.innerHTML = `
        <span class="nav-item-main">
            <i data-lucide="clipboard-check"></i>
            <span>Attendance</span>
        </span>
        <i data-lucide="chevron-down" class="dropdown-chevron"></i>
    `;
    toggle.addEventListener('click', () => {
        wrapper.classList.toggle('open');
    });

    const submenu = document.createElement('div');
    submenu.className = 'nav-submenu';
    submenu.innerHTML = `
        <a href="${toRoutePath('student_attendance.html')}" class="nav-subitem${currentPage === 'student_attendance.html' ? ' active' : ''}">
            <i data-lucide="users"></i>
            <span>Student Attendance</span>
        </a>
        <a href="${toRoutePath('teacher_attendance.html')}#teacher" class="nav-subitem${currentPage === 'teacher_attendance.html' && window.location.hash !== '#staff' ? ' active' : ''}">
            <i data-lucide="user-check"></i>
            <span>Teacher Attendance</span>
        </a>
        <a href="${toRoutePath('teacher_attendance.html')}#staff" class="nav-subitem${currentPage === 'teacher_attendance.html' && window.location.hash === '#staff' ? ' active' : ''}">
            <i data-lucide="briefcase-business"></i>
            <span>Staff Attendance</span>
        </a>
        <a href="${toRoutePath('student_attendance_report.html')}" class="nav-subitem${currentPage === 'student_attendance_report.html' ? ' active' : ''}">
            <i data-lucide="file-bar-chart-2"></i>
            <span>Student Attendance Report</span>
        </a>
        <a href="${toRoutePath('teacher_attendance_report.html')}" class="nav-subitem${currentPage === 'teacher_attendance_report.html' ? ' active' : ''}">
            <i data-lucide="file-check-2"></i>
            <span>Teacher Attendance Report</span>
        </a>
    `;

    wrapper.appendChild(toggle);
    wrapper.appendChild(submenu);

    if (visitorBooksLink) {
        visitorBooksLink.insertAdjacentElement('afterend', wrapper);
    } else if (permissionsLink) {
        permissionsLink.insertAdjacentElement('beforebegin', wrapper);
    } else {
        navLinks.appendChild(wrapper);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureNotificationsNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser) return;
    if (navLinks.querySelector('[data-notifications-link]')) return;

    const permissions = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('eduCore_permissions_config') || '{}');
        } catch (error) {
            return {};
        }
    })();
    const canAccessNotifications = loggedInUser.role === 'Admin' ||
        loggedInUser.role === 'Principal' ||
        (window.eduCoreAuth && window.eduCoreAuth.canAccessPage(loggedInUser, permissions, 'notifications.html'));

    if (!canAccessNotifications) return;

    const currentPage = getCurrentPageName();
    const attendanceNav = navLinks.querySelector('[data-attendance-nav]');
    const revenueLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'revenue.html');
    const permissionsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'permissions.html');
    const notificationLink = document.createElement('a');
    notificationLink.href = toRoutePath('notifications.html');
    notificationLink.className = `nav-item${currentPage === 'notifications.html' ? ' active' : ''}`;
    notificationLink.dataset.notificationsLink = 'true';
    notificationLink.innerHTML = '<i data-lucide="bell-ring"></i><span>Notifications</span>';

    if (attendanceNav) {
        attendanceNav.insertAdjacentElement('afterend', notificationLink);
    } else if (revenueLink) {
        revenueLink.insertAdjacentElement('afterend', notificationLink);
    } else if (permissionsLink) {
        permissionsLink.insertAdjacentElement('beforebegin', notificationLink);
    } else {
        navLinks.appendChild(notificationLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureSpecialNoticesNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser) return;
    if (navLinks.querySelector('[data-special-notices-link]')) return;

    const permissions = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('eduCore_permissions_config') || '{}');
        } catch (error) {
            return {};
        }
    })();
    const canAccessSpecialNotices = loggedInUser.role === 'Admin' ||
        loggedInUser.role === 'Principal' ||
        (window.eduCoreAuth && window.eduCoreAuth.canAccessPage(loggedInUser, permissions, 'special_notices.html'));

    if (!canAccessSpecialNotices) return;

    const currentPage = getCurrentPageName();
    const notificationsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'notifications.html');
    const revenueLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'revenue.html');
    const permissionsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'permissions.html');
    const noticeLink = document.createElement('a');
    noticeLink.href = toRoutePath('special_notices.html');
    noticeLink.className = `nav-item${currentPage === 'special_notices.html' ? ' active' : ''}`;
    noticeLink.dataset.specialNoticesLink = 'true';
    noticeLink.innerHTML = '<i data-lucide="megaphone"></i><span>Special Notices</span>';

    if (notificationsLink) {
        notificationsLink.insertAdjacentElement('afterend', noticeLink);
    } else if (revenueLink) {
        revenueLink.insertAdjacentElement('afterend', noticeLink);
    } else if (permissionsLink) {
        permissionsLink.insertAdjacentElement('beforebegin', noticeLink);
    } else {
        navLinks.appendChild(noticeLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureResetDataNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-reset-data-link]')) return;

    const resetLink = document.createElement('a');
    resetLink.href = '#';
    resetLink.className = 'nav-item nav-item-danger';
    resetLink.dataset.resetDataLink = 'true';
    resetLink.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Reset Data</span>';
    resetLink.addEventListener('click', resetSystemData);

    navLinks.appendChild(resetLink);

    if (window.lucide) window.lucide.createIcons();
}

function clearLocalSystemData() {
    const prefixes = ['eduCore_', 'EDUCORE_', 'APEXIUMS_'];
    const exactKeys = new Set([
        STORAGE_KEY_STUDENTS,
        STORAGE_KEY_TEACHERS,
        STORAGE_KEY_CLASSES,
        STORAGE_KEY_SETTINGS,
        STORAGE_KEY_NOTIFICATIONS,
        STORAGE_KEY_AUTH,
        STORAGE_KEY_TEACHER_ATTENDANCE,
        STORAGE_KEY_STUDENT_ATTENDANCE_CACHE,
        STORAGE_KEY_STAFF,
        STORAGE_KEY_TEACHER_SALARIES,
        STORAGE_KEY_USERS,
        STORAGE_KEY_PROMOTION_HISTORY,
        STORAGE_KEY_SPECIAL_NOTICES,
        'eduCore_bills',
        'eduCore_monthly_fees'
    ]);

    Object.keys(localStorage).forEach((key) => {
        if (exactKeys.has(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
            localStorage.removeItem(key);
        }
    });

    [
        'loggedInUser',
        'eduCore_token',
        'eduCore_session_id',
        'eduCore_student_profile',
        'eduCore_permissions_config',
        'eduCore_student_result_card',
        'login_attempts'
    ].forEach((key) => sessionStorage.removeItem(key));
}

async function resetSystemData(event) {
    if (event) event.preventDefault();

    const confirmed = await showAppConfirm(
        'This will permanently delete all students, teachers, staff, fees, attendance, salaries, classes, notices, bills, results, and saved portal data. Continue?',
        'Reset All Data'
    );
    if (!confirmed) return;

    const token = sessionStorage.getItem('eduCore_token');

    try {
        const response = await fetch(`${API_BASE_URL}/reset-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token || ''}`
            },
            body: JSON.stringify({ confirm: true })
        });
        const result = await parseJsonResponse(response, 'System data could not be reset.');

        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || result?.error || 'System data could not be reset.');
        }

        clearLocalSystemData();
        await showAppAlert('System data has been reset successfully. Please sign in again.', 'Reset Complete');
        window.location.href = '/login';
    } catch (error) {
        await showAppAlert(error.message || 'System data could not be reset.', 'Reset Failed');
    }
}

function applyBranchScopedStudentsView() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser || loggedInUser.role !== 'Branch' || !isCurrentPage('students.html')) {
        return;
    }

    const allowedCampus = loggedInUser.campusName || '';
    const quickFilter = document.getElementById('studentQuickFilter');
    const addStudentButton = document.querySelector('.student-toolbar > .btn.btn-primary');
    const formContainer = document.getElementById('studentFormContainer');

    document.querySelectorAll('.nav-links .nav-item').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const normalizedHref = normalizeClientPageName(href);
        const keepVisible = href === '#' || normalizedHref === 'students.html' || normalizedHref === 'settings.html';
        link.style.display = keepVisible ? '' : 'none';
    });

    if (quickFilter && allowedCampus) {
        quickFilter.value = `campus:${allowedCampus}`;
        quickFilter.disabled = true;
    }

    if (addStudentButton) addStudentButton.style.display = 'none';
    if (formContainer) formContainer.style.display = 'none';

    const headerTitle = document.querySelector('.header h1');
    if (headerTitle && allowedCampus) {
        headerTitle.textContent = `${allowedCampus} Students`;
    }
}

function ensureBannersNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser) return;
    if (navLinks.querySelector('[data-banners-link]')) return;

    const permissions = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('eduCore_permissions_config') || '{}');
        } catch (error) {
            return {};
        }
    })();
    const canAccessBanners = loggedInUser.role === 'Admin' ||
        loggedInUser.role === 'Principal' ||
        (window.eduCoreAuth && window.eduCoreAuth.canAccessPage(loggedInUser, permissions, 'banners.html'));

    if (!canAccessBanners) return;

    const currentPage = getCurrentPageName();
    const studentsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'students.html');
    const bannersLink = document.createElement('a');
    bannersLink.href = toRoutePath('banners.html');
    bannersLink.className = `nav-item${currentPage === 'banners.html' ? ' active' : ''}`;
    bannersLink.dataset.bannersLink = 'true';
    bannersLink.innerHTML = '<i data-lucide="image"></i><span>Banners</span>';

    if (studentsLink) {
        studentsLink.insertAdjacentElement('afterend', bannersLink);
    } else {
        navLinks.appendChild(bannersLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureStudentRecordsNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-student-records-nav]')) return;

    const studentsLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'students.html');
    if (!studentsLink) return;

    const currentPage = getCurrentPageName();
    const currentHash = String(window.location.hash || '').replace('#', '');
    const recordKeys = ['stuckoff', 'resigned', 'alumni'];
    const isRecordsActive = currentPage === 'students.html' && recordKeys.includes(currentHash);

    const wrapper = document.createElement('div');
    wrapper.className = `nav-dropdown${isRecordsActive ? ' open' : ''}`;
    wrapper.dataset.studentRecordsNav = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `nav-item nav-dropdown-toggle${isRecordsActive ? ' active' : ''}`;
    toggle.innerHTML = `
        <span class="nav-item-main">
            <i data-lucide="folder-open"></i>
            <span>Student Records</span>
        </span>
        <i data-lucide="chevron-down" class="dropdown-chevron"></i>
    `;
    toggle.addEventListener('click', () => {
        wrapper.classList.toggle('open');
    });

    const submenu = document.createElement('div');
    submenu.className = 'nav-submenu';
    submenu.innerHTML = `
        <a href="${toRoutePath('students.html')}#stuckoff" class="nav-subitem${currentHash === 'stuckoff' ? ' active' : ''}">
            <i data-lucide="user-x"></i>
            <span>Stuck Off Students</span>
        </a>
        <a href="${toRoutePath('students.html')}#resigned" class="nav-subitem${currentHash === 'resigned' ? ' active' : ''}">
            <i data-lucide="user-minus"></i>
            <span>Resigned Teachers</span>
        </a>
        <a href="${toRoutePath('students.html')}#alumni" class="nav-subitem${currentHash === 'alumni' ? ' active' : ''}">
            <i data-lucide="award"></i>
            <span>Alumni</span>
        </a>
    `;

    wrapper.appendChild(toggle);
    wrapper.appendChild(submenu);
    studentsLink.insertAdjacentElement('afterend', wrapper);

    if (window.lucide) window.lucide.createIcons();
}

function ensureFacilityNav() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    if (navLinks.querySelector('[data-facility-nav-link]')) return;

    const currentPage = getCurrentPageName();
    const facilityLinks = [
        { page: 'library.html', label: 'Library', icon: 'library' },
        { page: 'cafe.html', label: 'Cafe', icon: 'coffee' },
        { page: 'transport.html', label: 'Transport', icon: 'bus' }
    ];
    const fragment = document.createDocumentFragment();

    facilityLinks.forEach((item) => {
        if (Array.from(navLinks.querySelectorAll('a[href]'))
            .some((link) => normalizeClientPageName(link.getAttribute('href') || '') === item.page)) {
            return;
        }
        const link = document.createElement('a');
        link.href = toRoutePath(item.page);
        link.className = `nav-item${currentPage === item.page ? ' active' : ''}`;
        link.dataset.facilityNavLink = 'true';
        link.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
        fragment.appendChild(link);
    });

    const feeChallanLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'fee_challan.html');
    const feesLink = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'fees.html');
    const insertAfter = feeChallanLink || feesLink;

    if (insertAfter) {
        insertAfter.parentNode.insertBefore(fragment, insertAfter.nextSibling);
    } else {
        navLinks.appendChild(fragment);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureAdminSidebarCompleteness() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.dataset.adminSidebarComplete === 'true') return;
    navLinks.dataset.adminSidebarComplete = 'true';

    const currentPage = getCurrentPageName();
    const completeLinks = [
        { page: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
        { page: 'banners.html', label: 'Banners', icon: 'image' },
        { page: 'classes.html', label: 'Classes', icon: 'school' },
        { page: 'students.html', label: 'Students', icon: 'users' },
        { page: 'student_scheduling.html', label: 'Students Scheduling', icon: 'calendar-clock' },
        { page: 'families.html', label: 'Families', icon: 'home' },
        { page: 'teachers.html', label: 'Teachers', icon: 'book-open' },
        { page: 'teacher_scheduling.html', label: 'Teachers Scheduling', icon: 'calendar-days' },
        { page: 'staff.html', label: 'Staff', icon: 'briefcase' },
        { page: 'set_fee.html', label: 'Set Fees', icon: 'badge-dollar-sign' },
        { page: 'fees.html', label: 'Fees', icon: 'credit-card' },
        { page: 'fee_challan.html', label: 'Fee Challan', icon: 'file-text' },
        { page: 'fee_logos.html', label: 'Logos', icon: 'image' },
        { page: 'annual_charges.html', label: 'Annual Charges', icon: 'receipt' },
        { page: 'exam_result.html', label: 'Results', icon: 'file-badge' },
        { page: 'exam_result_history.html', label: 'Result History', icon: 'history' },
        { page: 'exams.html', label: 'Result Cards', icon: 'badge-check' },
        { page: 'revenue.html', label: 'Revenue', icon: 'trending-up' },
        { page: 'teacher_salaries.html', label: 'Salaries', icon: 'wallet' },
        { page: 'bills.html', label: 'Bills', icon: 'receipt' },
        { page: 'notifications.html', label: 'Notifications', icon: 'bell-ring' },
        { page: 'permissions.html', label: 'Permissions', icon: 'shield' },
        { page: 'designation-permissions.html', label: 'Designation Permissions', icon: 'shield-check' },
        { page: 'library.html', label: 'Library', icon: 'library' },
        { page: 'complain_box.html', label: 'Complain Box', icon: 'message-square' },
        { page: 'branch_registration.html', label: 'Branch Registration', icon: 'building-2' },
        { page: 'visitor_books.html', label: 'Visitor Records', icon: 'clipboard-list' },
        { page: 'certificate.html', label: 'Certificates', icon: 'award' },
        { page: 'cafe.html', label: 'Cafe Records', icon: 'coffee' },
        { page: 'transport.html', label: 'Transport', icon: 'bus' },
        { page: 'aboutme.html', label: 'About', icon: 'info' }
    ];

    const existingPages = () => new Set(Array.from(navLinks.querySelectorAll('a[href]'))
        .map((link) => normalizeClientPageName(link.getAttribute('href') || '')));

    const logoutLink = Array.from(navLinks.querySelectorAll('a[href="#"]'))
        .find((link) => /logout/i.test(link.textContent || ''));
    let existing = existingPages();

    completeLinks.forEach((item) => {
        if (existing.has(item.page)) return;
        const link = document.createElement('a');
        link.href = toRoutePath(item.page);
        link.className = `nav-item${currentPage === item.page ? ' active' : ''}`;
        link.dataset.adminCompleteLink = 'true';
        link.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
        if (logoutLink) {
            navLinks.insertBefore(link, logoutLink);
        } else {
            navLinks.appendChild(link);
        }
        existing = existingPages();
    });

    if (window.lucide) window.lucide.createIcons();
}

function renderAdminSidebarSequence() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks) return;
    if (loggedInUser && (loggedInUser.role === 'Student' || loggedInUser.role === 'Teacher')) return;
    if (navLinks.dataset.adminSidebarSequenced === 'true') return;

    const currentPage = getCurrentPageName();
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
    const isActivePage = (page, hash = '') => {
        const normalizedPage = normalizeClientPageName(page);
        const activePages = schedulingNavPages[normalizedPage];
        if (activePages ? !activePages.has(currentPage) : normalizedPage !== currentPage) return false;
        return !hash || window.location.hash === hash;
    };
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
                { page: 'fees.html', label: 'Fees', icon: 'credit-card' },
                { page: 'fee_challan.html', label: 'Fee Challan', icon: 'file-text' },
                { page: 'fee_logos.html', label: 'Logos', icon: 'image' },
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

    const buildLink = (item, className = 'nav-item') => `
        <a href="${toRoutePath(item.page)}${item.hash || ''}" class="${className}${isActivePage(item.page, item.hash) ? ' active' : ''}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.label}</span>
        </a>
    `;

    const buildDropdown = (item, nested = false) => {
        const open = hasActiveChild(item.children);
        const toggleClass = nested ? 'nav-subitem nav-dropdown-toggle' : 'nav-item nav-dropdown-toggle';
        return `
            <div class="nav-dropdown${open ? ' open' : ''}" data-sequenced-sidebar-dropdown="true">
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
    };

    const buildItem = (item, nested = false) => {
        if (item.type === 'link') return buildLink(item, nested ? 'nav-subitem' : 'nav-item');
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

    navLinks.dataset.adminSidebarSequenced = 'true';
    navLinks.querySelectorAll('[data-sequenced-sidebar-dropdown] > .nav-dropdown-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            toggle.closest('.nav-dropdown')?.classList.toggle('open');
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

function ensureSchedulingNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-scheduling-nav]')) return;

    const currentPage = getCurrentPageName();
    const studentSchedulingPages = ['student_scheduling.html', 'assignments.html', 'assignment_uploading.html', 'student_timetable.html', 'student_diary.html', 'student_leave_requests.html', 'student_courses.html', 'quiz_uploading.html', 'lecture_uploading.html', 'exam_schedule.html', 'stuck_off.html'];
    const isStudentSchedulingPage = studentSchedulingPages.includes(currentPage);
    const teacherSchedulingPages = ['teacher_scheduling.html', 'teacher_timetable.html', 'teacher_assigned_classes.html', 'teacher_leave_requests.html'];
    const isTeacherSchedulingPage = teacherSchedulingPages.includes(currentPage);
    const insertAfter = Array.from(navLinks.querySelectorAll('a[href]'))
        .find((link) => normalizeClientPageName(link.getAttribute('href') || '') === 'students.html');

    const wrapper = document.createElement('div');
    wrapper.dataset.schedulingNav = 'true';
    wrapper.innerHTML = `
        <a href="${toRoutePath('student_scheduling.html')}" class="nav-item${isStudentSchedulingPage ? ' active' : ''}">
            <i data-lucide="users"></i>
            <span>Student Scheduling</span>
        </a>
        <a href="${toRoutePath('quiz_uploading.html')}" class="nav-item${currentPage === 'quiz_uploading.html' ? ' active' : ''}">
            <i data-lucide="circle-help"></i>
            <span>Quiz Uploading</span>
        </a>
        <a href="${toRoutePath('lecture_uploading.html')}" class="nav-item${currentPage === 'lecture_uploading.html' ? ' active' : ''}">
            <i data-lucide="presentation"></i>
            <span>Lecture Uploading</span>
        </a>
        <a href="${toRoutePath('teacher_scheduling.html')}" class="nav-item${isTeacherSchedulingPage ? ' active' : ''}">
            <i data-lucide="book-open"></i>
            <span>Teacher Scheduling</span>
        </a>
    `;

    if (insertAfter) {
        insertAfter.insertAdjacentElement('afterend', wrapper);
    } else {
        navLinks.appendChild(wrapper);
    }

    if (window.lucide) window.lucide.createIcons();
}

function applyStudentActionPermissions() {
    if (!isCurrentPage('students.html')) return;

    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    if (loggedInUser.role !== 'Teacher' && loggedInUser.role !== 'Staff') return;

    const canAdd = canCurrentUserPerformAction('students', 'add');
    const addStudentButton = document.querySelector('.student-toolbar > .btn.btn-primary');
    const formContainer = document.getElementById('studentFormContainer');

    if (addStudentButton) {
        addStudentButton.style.display = canAdd ? '' : 'none';
    }

    if (!canAdd && formContainer) {
        formContainer.style.display = 'none';
    }
}

async function renderBranches() {
    const tbody = document.getElementById('branchTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1rem; color: var(--text-secondary);">Loading branches...</td></tr>';
        const response = await fetch(`${API_BASE_URL}/branches`);
        const responseText = await response.text();
        let branches = [];

        try {
            branches = responseText ? JSON.parse(responseText) : [];
        } catch (parseError) {
            throw new Error('The server is still running an older version. Restart it with `node server.js` and reload the page.');
        }

        if (!response.ok) {
            throw new Error(branches.error || 'Branches could not be loaded.');
        }

        branches = Array.isArray(branches) ? branches : (Array.isArray(branches.branches) ? branches.branches : []);
        renderBranchRows(branches);
    } catch (error) {
        branchRecordsCache = [];
        updateBranchAccessSummary([]);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1rem; color: #dc2626;">Branches could not be loaded. Please refresh and try again.</td></tr>';
    }
}

function renderBranchRows(branches = []) {
    const tbody = document.getElementById('branchTableBody');
    if (!tbody) return;

    try {
        branchRecordsCache = Array.isArray(branches) ? branches : [];
        updateBranchAccessSummary(branches);
        tbody.innerHTML = '';
        if (!Array.isArray(branches) || branches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1rem; color: var(--text-secondary);">No branches registered yet.</td></tr>';
            return;
        }

        branches.forEach((branch) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${branch.campusName || '-'}</strong></td>
                <td>${branch.fullName || '-'}</td>
                <td>${branch.username || '-'}</td>
                <td>${branch.plainPassword || 'Hidden'}</td>
                <td>${branch.isActive === false ? 'Inactive' : 'Active'}</td>
                <td>${branch.profileId || '-'}</td>
                <td>
                    <div class="branch-actions">
                        <select class="table-action-select" onchange="handleBranchActionSelect(this, '${branch.id}')">
                            <option value="">Actions</option>
                            <option value="edit">Edit</option>
                            <option value="delete">Delete</option>
                        </select>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        branchRecordsCache = [];
        updateBranchAccessSummary([]);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1rem; color: #dc2626;">Branches could not be displayed.</td></tr>';
    }
}

function handleBranchActionSelect(selectElement, branchId) {
    const action = String(selectElement?.value || '').trim().toLowerCase();
    if (!action) return;
    if (selectElement) selectElement.value = '';

    const branch = (Array.isArray(branchRecordsCache) ? branchRecordsCache : [])
        .find((record) => String(record.id) === String(branchId));

    if (action === 'edit' && branch) {
        editBranch(branch);
        return;
    }

    if (action === 'delete') {
        deleteBranch(branchId);
    }
}

function getFamilies() {
    return getArrayData(STORAGE_KEY_FAMILIES);
}

function saveFamilies(families) {
    localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(Array.isArray(families) ? families : []));
}

function buildFamilyNameFromStudentFields() {
    const fatherName = document.getElementById('fatherName')?.value.trim();
    const phone = document.getElementById('parentPhone')?.value.trim();
    if (fatherName) return `${fatherName} Family`;
    if (phone) return `Family ${phone}`;
    return '';
}

function normalizeFamilyPhone(value = '') {
    return String(value || '').replace(/\D/g, '');
}

function normalizeFamilyIdentityValue(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getExplicitFamilyMatchKey(familyName = '', familyNo = '') {
    const nameKey = normalizeFamilyIdentityValue(familyName);
    const numberKey = normalizeFamilyIdentityValue(familyNo);
    return nameKey && numberKey ? `${nameKey}|${numberKey}` : '';
}

function ensureExplicitFamilyRecord(familyName = '', familyNo = '', familyContact = '') {
    const cleanName = String(familyName || '').trim();
    const cleanNo = String(familyNo || '').trim();
    const cleanContact = String(familyContact || '').trim();
    const matchKey = getExplicitFamilyMatchKey(cleanName, cleanNo);
    if (!matchKey) return '';

    const families = getFamilies();
    const existing = families.find((family) => getExplicitFamilyMatchKey(family.name, family.familyNo) === matchKey);
    if (existing) {
        existing.name = cleanName;
        existing.familyNo = cleanNo;
        if (cleanContact) existing.familyContact = cleanContact;
        saveFamilies(families);
        return existing.id;
    }

    const family = {
        id: generateUniqueRecordId('FAM'),
        name: cleanName,
        familyNo: cleanNo,
        familyContact: cleanContact,
        createdAt: new Date().toISOString()
    };
    families.push(family);
    saveFamilies(families);
    return family.id;
}

function getFamilyMatchKey(fatherName = '', phone = '') {
    return `${String(fatherName || '').trim().toLowerCase()}|${normalizeFamilyPhone(phone)}`;
}

function getFamilyGuardianMatchKey(guardianName = '', guardianContact = '') {
    return `${String(guardianName || '').trim().toLowerCase()}|${normalizeFamilyPhone(guardianContact)}`;
}

function ensureFamilyRecord(familyName, parentPhone = '', guardianName = '', guardianContact = '', fatherName = '') {
    const cleanName = String(familyName || '').trim();
    if (!cleanName) return '';

    const families = getFamilies();
    const cleanFatherName = String(fatherName || '').trim();
    const parentPhoneKey = normalizeFamilyPhone(parentPhone);
    const cleanGuardianName = String(guardianName || '').trim();
    const cleanGuardianContact = String(guardianContact || '').trim();
    const guardianPhoneKey = normalizeFamilyPhone(cleanGuardianContact);
    const existing = families.find((family) => {
        const sameName = String(family.name || '').toLowerCase() === cleanName.toLowerCase();
        const familyPhoneKey = normalizeFamilyPhone(family.parentPhone || family.phone || '');
        const familyGuardianContactKey = normalizeFamilyPhone(family.guardianContact || '');
        const sameFatherAndPhone = cleanFatherName &&
            parentPhoneKey &&
            getFamilyMatchKey(family.fatherName, family.parentPhone || family.phone) === getFamilyMatchKey(cleanFatherName, parentPhone) &&
            familyPhoneKey === parentPhoneKey;
        const sameGuardianContact = cleanGuardianContact &&
            guardianPhoneKey &&
            familyGuardianContactKey === guardianPhoneKey;
        const sameGuardianNameAndContact = cleanGuardianName &&
            guardianPhoneKey &&
            getFamilyGuardianMatchKey(family.guardianName, family.guardianContact) === getFamilyGuardianMatchKey(cleanGuardianName, cleanGuardianContact);
        return sameFatherAndPhone || sameGuardianContact || sameGuardianNameAndContact || (sameName && (!cleanFatherName || !parentPhoneKey));
    });
    if (existing) {
        if (parentPhone) existing.phone = parentPhone;
        if (parentPhone) existing.parentPhone = parentPhone;
        if (cleanFatherName) existing.fatherName = cleanFatherName;
        if (cleanGuardianName) existing.guardianName = cleanGuardianName;
        if (cleanGuardianContact) existing.guardianContact = cleanGuardianContact;
        saveFamilies(families);
        return existing.id;
    }

    const family = {
        id: generateUniqueRecordId('FAM'),
        name: cleanName,
        phone: parentPhone || '',
        parentPhone,
        fatherName: cleanFatherName,
        guardianName: cleanGuardianName,
        guardianContact: cleanGuardianContact,
        createdAt: new Date().toISOString()
    };
    families.push(family);
    saveFamilies(families);
    return family.id;
}

function syncStudentFamilyLinksByFatherPhone(students, familyId, familyName, fatherName, parentPhone, guardianName = '', guardianContact = '') {
    const matchKey = getFamilyMatchKey(fatherName, parentPhone);
    const guardianKey = getFamilyGuardianMatchKey(guardianName, guardianContact);
    const canMatchFatherPhone = fatherName && normalizeFamilyPhone(parentPhone);
    const canMatchGuardian = guardianName && normalizeFamilyPhone(guardianContact);
    if (!familyId || (!canMatchFatherPhone && !canMatchGuardian)) return students;
    return students.map((student) => {
        const matchesFatherPhone = canMatchFatherPhone && getFamilyMatchKey(student.fatherName, student.parentPhone) === matchKey;
        const matchesGuardian = canMatchGuardian && getFamilyGuardianMatchKey(student.guardianName, student.guardianContact) === guardianKey;
        if (!matchesFatherPhone && !matchesGuardian) return student;
        return {
            ...student,
            familyId,
            familyName
        };
    });
}

function syncStudentFamilyLinksByDetails(students, familyId, familyName, familyNo, familyContact = '') {
    const matchKey = getExplicitFamilyMatchKey(familyName, familyNo);
    if (!familyId || !matchKey) return students;
    return students.map((student) => {
        if (getExplicitFamilyMatchKey(student.familyName, student.familyNo) !== matchKey) return student;
        return {
            ...student,
            familyId,
            familyName,
            familyNo,
            familyContact: familyContact || student.familyContact || ''
        };
    });
}

function populateStudentFamilyOptions(selectedId = '') {
    const select = document.getElementById('studentFamilyId');
    if (!select) return;

    const families = getFamilies().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    select.innerHTML = '<option value="">Create new family from this student</option>' + families.map((family) => (
        `<option value="${escapeHtml(family.id)}">${escapeHtml(family.name || 'Family')}</option>`
    )).join('');
    select.value = selectedId || '';
}

function updateBranchAccessSummary(branches = []) {
    const countEl = document.getElementById('branchAccessCount');
    const detailEl = document.getElementById('branchAccessDetail');
    if (!countEl && !detailEl) return;

    const records = Array.isArray(branches) ? branches : [];
    const total = records.length;
    const active = records.filter((branch) => branch?.isActive !== false).length;
    const inactive = Math.max(total - active, 0);

    if (countEl) countEl.innerText = total.toString();
    if (detailEl) {
        const label = total === 1 ? 'branch' : 'branches';
        detailEl.innerHTML = `<i data-lucide="building-2" size="16"></i> ${active} active / ${inactive} inactive ${label}`;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function handleBranchRegistrationSubmit(event) {
    event.preventDefault();

    const submitButton = event.submitter || document.querySelector('#branchRegistrationForm button[type="submit"]');
    const recordId = document.getElementById('branchRecordId').value.trim();
    const campusName = document.getElementById('branchCampusName').value.trim();
    const fullName = document.getElementById('branchDisplayName').value.trim() || campusName;
    const username = document.getElementById('branchUsername').value.trim();
    const password = document.getElementById('branchPassword').value.trim();

    if (!recordId && !password) {
        alert('Password is required for a new branch login.');
        return;
    }

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
            if (window.lucide) window.lucide.createIcons();
        }
        const response = await fetch(`${API_BASE_URL}/branches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: recordId || undefined, campusName, fullName, username, password })
        });

        const result = await parseJsonResponse(
            response,
            'The server is still running an older version. Restart it with `node server.js` and try again.'
        );

        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Branch registration failed.');
        }

        pushNotification('Branch Registered', `${campusName} branch login has been created.`, 'user');
        resetBranchRegistrationForm();
        await renderBranches();
        populateCampusDropdowns();
        showSuccessModal(recordId ? 'Branch Updated!' : 'Branch Registered!', recordId
            ? `${campusName} branch login details have been updated.`
            : `${campusName} can now log in with its branch username and password.`);
    } catch (error) {
        alert(error.message);
    } finally {
        const currentSubmitButton = document.querySelector('#branchRegistrationForm button[type="submit"]');
        if (currentSubmitButton) {
            currentSubmitButton.disabled = false;
            currentSubmitButton.innerHTML = '<i data-lucide="save"></i> Save Branch';
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

function editBranch(branch) {
    document.getElementById('branchRecordId').value = branch.id || '';
    document.getElementById('branchCampusName').value = branch.campusName || '';
    document.getElementById('branchDisplayName').value = branch.fullName || '';
    document.getElementById('branchUsername').value = branch.username || '';
    document.getElementById('branchPassword').value = branch.plainPassword || '';

    const submitButton = document.querySelector('#branchRegistrationForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="save"></i> Update Branch';
    }
    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetBranchRegistrationForm() {
    const form = document.getElementById('branchRegistrationForm');
    if (!form) return;

    form.reset();
    document.getElementById('branchRecordId').value = '';

    const submitButton = document.querySelector('#branchRegistrationForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="save"></i> Save Branch';
    }
    if (window.lucide) window.lucide.createIcons();
}

async function deleteBranch(branchId) {
    if (!branchId) return;
    if (!(await showAppConfirm('Delete this branch login?'))) return;

    try {
        const response = await fetch(`${API_BASE_URL}/branches/${encodeURIComponent(branchId)}`, {
            method: 'DELETE'
        });
        const responseText = await response.text();
        let result = null;

        try {
            result = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
            throw new Error('The server is still running an older version. Restart it with `node server.js` and try again.');
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Branch deletion failed.');
        }

        resetBranchRegistrationForm();
        renderBranches();
        populateCampusDropdowns();
        pushNotification('Branch Deleted', 'The branch login was removed successfully.', 'user');
    } catch (error) {
        alert(error.message);
    }
}

// =======================================================
// ==================== DASHBOARD LOGIC ==================
// =======================================================

function renderDashboardTable(term = '') {
    const tbody = document.getElementById('dashTableBody');
    if (!tbody) return;

    // Use students data for the "Activity" table
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const filtered = students.filter(s =>
        s.fullName.toLowerCase().includes(term) ||
        s.rollNo.toLowerCase().includes(term)
    );

    // If searching, show all matches. Otherwise show last 5.
    const displayList = term ? filtered : students.slice(-5).reverse();

    tbody.innerHTML = '';

    if (displayList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No records found.</td></tr>';
    } else {
        displayList.forEach(s => {
            let statusClass = s.feesStatus === 'Paid' ? 'status-paid' : (s.feesStatus === 'Late' ? 'status-failed' : 'status-pending');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div style="font-weight:500">${s.fullName}</div></td>
                <td><span style="color:var(--text-secondary); font-size:0.85rem">${s.rollNo}</span></td>
                <td>${s.classGrade}</td>
                <td><span class="status-badge ${statusClass}">${s.feesStatus}</span></td>
                <td>
                    <button class="btn btn-primary" style="padding:0.3rem 0.8rem; font-size:0.75rem;" onclick="toggleFeeStatus('${s.id}')">
                        ${s.feesStatus === 'Paid' ? 'Mark Pending' : 'Mark Paid'}
                    </button>
                    <button class="btn btn-secondary" style="padding:0.3rem 0.8rem; font-size:0.75rem;" onclick="editBill('${s.id}')">
                        Edit
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// =======================================================
// ==================== FINANCE LOGIC ====================
// =======================================================

// =======================================================
// ==================== FINANCE LOGIC (BILLS) ============
// =======================================================
const STORAGE_KEY_BILLS = 'eduCore_bills';
let currentCategory = null;

function getBills() {
    const data = localStorage.getItem(STORAGE_KEY_BILLS);
    return data ? JSON.parse(data) : [];
}

function saveBills(bills) {
    localStorage.setItem(STORAGE_KEY_BILLS, JSON.stringify(bills));
}

let isHistoryView = false;

// Function called when a card is clicked
function selectBillCategory(category) {
    isHistoryView = false;
    currentCategory = category;

    // UI Update
    const prompt = document.getElementById('selectPrompt');
    if (prompt) prompt.style.display = 'none';

    const details = document.getElementById('billDetailsSection');
    if (details) details.style.display = 'block';

    const title = document.getElementById('selectedCategoryTitle');
    if (title) title.innerText = category + ' Records';

    const formContainer = document.getElementById('billFormContainer');
    if (formContainer) formContainer.style.display = 'none'; // Hide form if open

    // Highlight Card
    document.querySelectorAll('.bill-card').forEach(c => c.style.border = '2px solid transparent');
    const idMap = {
        'Electricity': 'card-Electricity',
        'Gas': 'card-Gas',
        'Internet': 'card-Internet',
        'Building Rent': 'card-Rent'
    };
    if (document.getElementById(idMap[category])) {
        document.getElementById(idMap[category]).style.border = '2px solid var(--primary-color)';
    }

    const addBtn = document.querySelector('#billDetailsSection .btn-primary');
    if (addBtn) addBtn.style.display = 'inline-flex';

    renderFinance();
}

function showPaidHistory() {
    isHistoryView = true;
    currentCategory = 'All'; // Placeholder to satisfy checks

    document.querySelectorAll('.bill-card').forEach(c => {
        c.style.border = '2px solid transparent';
        c.style.transform = 'scale(1)';
    });

    if (document.getElementById('card-History')) {
        document.getElementById('card-History').style.border = '2px solid var(--primary-color)';
        document.getElementById('card-History').style.transform = 'scale(1.02)';
    }

    const prompt = document.getElementById('selectPrompt');
    if (prompt) prompt.style.display = 'none';

    const details = document.getElementById('billDetailsSection');
    if (details) details.style.display = 'block';

    const title = document.getElementById('selectedCategoryTitle');
    if (title) title.innerText = 'Paid Bills Verification';

    // Hide Add Button in History View
    const addBtn = document.querySelector('#billDetailsSection .btn-primary');
    if (addBtn) addBtn.style.display = 'none';

    renderFinance();
}

function renderFinance(term = '') {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    // If no category selected yet, do nothing or clear
    if (!currentCategory) {
        tbody.innerHTML = '';
        return;
    }

    const bills = getBills();
    let filtered = [];

    if (isHistoryView) {
        filtered = bills.filter(b => b.status === 'Paid');
    } else {
        // Filter by Current Category and Search Term
        filtered = bills.filter(b => b.category === currentCategory);
    }

    if (term) {
        filtered = filtered.filter(b => b.note && b.note.toLowerCase().includes(term));
    }

    tbody.innerHTML = '';
    const noData = document.getElementById('noFinanceData');

    if (filtered.length === 0) {
        if (noData) noData.style.display = 'block';
    } else {
        if (noData) noData.style.display = 'none';

        // Update Table Headers
        const tableHead = document.querySelector('#financeTable thead tr');
        if (isHistoryView) {
            tableHead.innerHTML = `
                <th>Category</th>
                <th>Payment Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th>Action</th>
            `;
        } else {
            tableHead.innerHTML = `
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
            `;
        }

        // Sort by date desc
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(b => {
            const statusClass = b.status === 'Paid' ? 'status-paid' : 'status-failed';
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = (e) => {
                if (e.target.closest('button')) return;
                openPaymentModal(b.id);
            };

            if (isHistoryView) {
                const pDate = b.paymentConfirmedDate ? new Date(b.paymentConfirmedDate).toLocaleDateString() : b.date;
                tr.innerHTML = `
                    <td style="font-weight:600; color:var(--primary-color)">${b.category}</td>
                    <td>${pDate}</td>
                    <td>${b.note || '-'}</td>
                    <td style="font-weight:600">PKR ${parseInt(b.amount).toLocaleString()}</td>
                    <td>
                        ${b.invoice ? '<i data-lucide="file-text" size="14" style="margin-right:5px; color:#6366f1;" title="Bill Invoice"></i>' : ''}
                        <i data-lucide="image" size="16" style="color:var(--primary-color)"></i> View
                    </td>
                    <td>
                        <button class="action-btn btn-edit" onclick='event.stopPropagation(); editBill("${b.id}")' title="Edit">
                            <i data-lucide="edit-2" width="14"></i>
                        </button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td>${b.date}</td>
                    <td>${b.note || '-'}</td>
                    <td>PKR ${parseInt(b.amount).toLocaleString()}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${b.status}</span>
                        ${b.invoice ? '<i data-lucide="file-text" size="12" style="margin-left:5px; color:#6366f1;" title="Invoice Attached"></i>' : ''}
                        ${b.receipt ? '<i data-lucide="image" size="12" style="margin-left:5px; color:var(--primary-color);" title="Receipt Attached"></i>' : ''}
                    </td>
                    <td>
                        <button class="action-btn btn-edit" onclick='event.stopPropagation(); editBill("${b.id}")' title="Edit">
                            <i data-lucide="edit-2" width="14"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteBill('${b.id}')" title="Delete">
                            <i data-lucide="trash-2" width="14"></i>
                        </button>
                        ${b.status !== 'Paid' ? `
                        <button class="action-btn" style="background:#dcfce7; color:#166534;" onclick='event.stopPropagation(); openPaymentModal("${b.id}")' title="Confirm Payment">
                            <i data-lucide="check-circle" width="14"></i>
                        </button>` : ''}
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
    }
}

function toggleBillForm(editMode = false) {
    if (!currentCategory) return;

    const container = document.getElementById('billFormContainer');
    const form = document.getElementById('billForm');
    const title = document.getElementById('billFormTitle');

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('billId').value = '';
    } else {
        container.style.display = 'block';
        if (!editMode) {
            form.reset();
            document.getElementById('billDate').valueAsDate = new Date();
            document.getElementById('billId').value = '';
            // Auto-set category
            document.getElementById('billCategory').value = currentCategory;
            title.innerText = 'Add ' + currentCategory + ' Bill';
        } else {
            title.innerText = 'Edit Bill Details';
        }
    }
    // Reset Invoice Preview
    const invPreview = document.getElementById('invoicePreview');
    if (invPreview && !editMode) {
        invPreview.style.display = 'none';
        document.getElementById('invoiceImgPreview').src = '';
    }
}

// Global listener for the Bill Form
document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'billForm') {
        e.preventDefault();
        const idField = document.getElementById('billId');
        const isEdit = idField.value !== '';

        const newBill = {
            id: isEdit ? idField.value : generateUniqueRecordId('BILL'),
            category: currentCategory,
            amount: document.getElementById('billAmount').value,
            date: document.getElementById('billDate').value,
            status: document.getElementById('billStatus').value,
            note: document.getElementById('billNote').value,
            invoice: document.getElementById('invoiceImgPreview').src || null
        };

        let bills = getBills();
        if (isEdit) {
            const index = bills.findIndex(b => b.id === newBill.id);
            if (index !== -1) {
                // Keep the receipt if it exists and we're just editing bill details
                if (bills[index].receipt) newBill.receipt = bills[index].receipt;
                if (bills[index].paymentConfirmedDate) newBill.paymentConfirmedDate = bills[index].paymentConfirmedDate;
                bills[index] = newBill;
            }
        } else {
            bills.push(newBill);
        }
        saveBills(bills);
        toggleBillForm();
        renderFinance();
        pushNotification('Expense Updated', `Bill for ${newBill.category} recorded.`, 'trending-up');
    }
});

// Preview for Invoice Image in Add/Edit Bill Form
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'billInvoice') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('invoiceImgPreview').src = event.target.result;
                document.getElementById('invoicePreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }
});

function editBill(id) {
    const bills = getBills();
    const b = bills.find(x => x.id === id);
    if (!b) return;

    toggleBillForm(true);
    document.getElementById('billId').value = b.id;
    // document.getElementById('billCategory').value = b.category; // set in toggle or here
    document.getElementById('billAmount').value = b.amount;
    document.getElementById('billDate').value = b.date;
    document.getElementById('billStatus').value = b.status;
    document.getElementById('billNote').value = b.note || '';

    // Show Invoice Preview if exists
    if (b.invoice) {
        document.getElementById('invoiceImgPreview').src = b.invoice;
        document.getElementById('invoicePreview').style.display = 'block';
    } else {
        document.getElementById('invoicePreview').style.display = 'none';
        document.getElementById('invoiceImgPreview').src = '';
    }
}

async function deleteBill(id) {
    if (!(await showAppConfirm('Delete this expense record?'))) return;

    let bills = getBills();
    bills = bills.filter(b => b.id !== id);
    saveBills(bills);
    renderFinance();
}

// === BILL PAYMENT CONFIRMATION LOGIC ===
function openPaymentModal(id) {
    const bills = getBills();
    const b = bills.find(x => x.id === id);
    if (!b) return;

    const modal = document.getElementById('paymentModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('pBillId').value = b.id;
    document.getElementById('pModalBillId').innerText = b.id;
    document.getElementById('pModalCategory').innerText = b.category;
    document.getElementById('pModalDate').innerText = b.date;
    document.getElementById('pModalAmount').innerText = 'PKR ' + parseInt(b.amount).toLocaleString();

    // Reset Form
    document.getElementById('paymentConfirmForm').reset();
    document.getElementById('receiptPreview').style.display = 'none';

    // If already has receipt, show it
    const confirmForm = document.getElementById('paymentConfirmForm');
    if (b.status === 'Paid') {
        document.getElementById('paymentModalTitle').innerText = 'Payment Record';
        confirmForm.style.display = 'none';
        if (b.receipt) {
            document.getElementById('receiptImgPreview').src = b.receipt;
            document.getElementById('receiptPreview').style.display = 'block';
        }
    } else {
        document.getElementById('paymentModalTitle').innerText = 'Confirm Bill Payment';
        confirmForm.style.display = 'block';
    }
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'none';
}

function formatDashboardCurrency(amount) {
    const value = Number(amount || 0);
    return `PKR ${Math.round(value).toLocaleString('en-PK')}`;
}

function getDashboardStudentFee(student = {}) {
    const directFee = Number(student?.monthlyFee || student?.fee || 0) || 0;
    if (directFee > 0) return directFee;

    let classFees = {};
    try {
        classFees = JSON.parse(localStorage.getItem(STORAGE_KEY_CLASS_FEES) || '{}') || {};
    } catch (_error) {
        classFees = {};
    }

    const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    const targetClass = normalize(student?.classGrade || '');
    const match = Object.entries(classFees).find(([className]) => normalize(className) === targetClass);
    const config = match ? (match[1] || {}) : {};
    return Number(config.monthlyFee || config.fee || 0) || 0;
}

function getCurrentDashboardFeeMonth() {
    return new Date().toLocaleString('en-US', { month: 'long' });
}

function getDashboardFeeStatusRevenue(students = []) {
    const currentMonth = getCurrentDashboardFeeMonth();
    let monthlyFeesData = {};
    let paymentDetails = {};

    try {
        monthlyFeesData = JSON.parse(localStorage.getItem('eduCore_monthly_fees') || '{}') || {};
    } catch (_error) {
        monthlyFeesData = {};
    }

    try {
        paymentDetails = JSON.parse(localStorage.getItem('eduCore_payment_details') || '{}') || {};
    } catch (_error) {
        paymentDetails = {};
    }

    return (students || []).reduce((summary, student) => {
        const studentId = String(student?.id || '').trim();
        if (!studentId) return summary;

        const feeAmount = getDashboardStudentFee(student);
        if (!(feeAmount > 0)) return summary;

        const monthStatus = monthlyFeesData?.[studentId]?.[currentMonth];
        const paidRecordAmount = Number(paymentDetails?.[studentId]?.[currentMonth]?.amount || 0) || 0;
        const studentStatus = String(student?.feesStatus || '').trim().toLowerCase();

        let paidAmount = 0;
        if (monthStatus === 'Paid') paidAmount = feeAmount;
        else if (paidRecordAmount > 0) paidAmount = Math.min(paidRecordAmount, feeAmount);
        else if (studentStatus === 'paid') paidAmount = feeAmount;

        if (paidAmount > 0) {
            summary.total += paidAmount;
            summary.paidStudents += 1;
        }

        return summary;
    }, { total: 0, paidStudents: 0, month: currentMonth });
}

function updateDashboardRevenueStats() {
    const amountEl = document.getElementById('dashRevenue');
    const detailEl = document.getElementById('dashRevenueDetail');
    if (!amountEl && !detailEl) return;

    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const feeSummary = getDashboardFeeStatusRevenue(students);

    if (amountEl) amountEl.innerText = formatDashboardCurrency(feeSummary.total);
    if (detailEl) {
        detailEl.textContent = `${feeSummary.paidStudents} ${feeSummary.paidStudents === 1 ? 'student' : 'students'} paid for ${feeSummary.month}`;
        if (window.lucide) window.lucide.createIcons();
    }
}

// Preview Image
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'paymentReceipt') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('receiptImgPreview').src = event.target.result;
                document.getElementById('receiptPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }
});

// Submit Payment Confirmation
document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'paymentConfirmForm') {
        e.preventDefault();
        const bId = document.getElementById('pBillId').value;
        const bills = getBills();
        const index = bills.findIndex(b => b.id === bId);

        if (index !== -1) {
            const receiptSrc = document.getElementById('receiptImgPreview').src;

            bills[index].status = 'Paid';
            bills[index].paymentConfirmedDate = new Date().toISOString();
            bills[index].receipt = receiptSrc;

            saveBills(bills);
            closePaymentModal();
            renderFinance();
            pushNotification('Payment Confirmed', `Bill payment for ${bills[index].category} has been recorded.`, 'trending-up');
        }
    }
});

function updateDashboardStats() {
    const s = getArrayData(STORAGE_KEY_STUDENTS);
    const t = getArrayData(STORAGE_KEY_TEACHERS);
    const staff = getData(STORAGE_KEY_STAFF);
    const students = Array.isArray(s) ? s : [];
    const teachers = Array.isArray(t) ? t : [];
    const staffMembers = Array.isArray(staff) ? staff : [];

    if (document.getElementById('dashStudentCount')) document.getElementById('dashStudentCount').innerText = students.length || '0';
    if (document.getElementById('dashTeacherCount')) document.getElementById('dashTeacherCount').innerText = teachers.length || '0';
    if (document.getElementById('dashStaffCount')) document.getElementById('dashStaffCount').innerText = staffMembers.length || '0';

    updateDashboardRevenueStats();

    updateDashboardComplaintStats();
    updateDashboardBannerStats();
    updateActivePortalLogins();
}

function updateDashboardComplaintStats() {
    const complaints = getArrayData(STORAGE_KEY_COMPLAINTS);
    const total = complaints.length;
    const pending = complaints.filter((complaint) => String(complaint.status || 'Pending').toLowerCase() !== 'replied').length;
    const countEl = document.getElementById('dashComplaintCount');
    const detailEl = document.getElementById('dashComplaintDetail');

    if (countEl) countEl.innerText = total.toString();
    if (detailEl) {
        detailEl.innerHTML = `<i data-lucide="message-square" size="16"></i> ${pending} pending`;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function updateDashboardBannerStats(records) {
    const countEl = document.getElementById('dashLiveBannerCount');
    const detailEl = document.getElementById('dashLiveBannerDetail');
    if (!countEl && !detailEl) return;

    try {
        let banners = Array.isArray(records) ? records : null;
        if (!banners) {
            const response = await fetch(`${API_BASE_URL}/banners`);
            const data = await response.json();
            banners = Array.isArray(data.banners) ? data.banners : [];
        }

        const liveCount = banners.filter((banner) => banner.isActive !== false).length;
        if (countEl) countEl.innerText = liveCount.toString();
        if (detailEl) {
            detailEl.innerHTML = `<i data-lucide="image" size="16"></i> ${banners.length} total banners`;
            if (window.lucide) window.lucide.createIcons();
        }
    } catch (error) {
        if (countEl) countEl.innerText = '0';
        if (detailEl) detailEl.innerHTML = '<i data-lucide="image" size="16"></i> Unable to load';
        if (window.lucide) window.lucide.createIcons();
    }
}

function initializeDashboardHome() {
    const dashStudentCount = document.getElementById('dashStudentCount');
    if (!dashStudentCount) return;

    updateDashboardStats();
    if (!dashboardActiveSessionsInterval) {
        dashboardActiveSessionsInterval = window.setInterval(updateActivePortalLogins, 30000);
    }
    bindActiveSessionsModalEvents();

    const dSearch = document.getElementById('dashSearch');
    if (dSearch && !dSearch.dataset.dashboardSearchBound) {
        dSearch.dataset.dashboardSearchBound = 'true';
        dSearch.addEventListener('input', (e) => { }); // renderDashboardTable(e.target.value.toLowerCase())
    }
}

function escapeSessionText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function formatSessionTimestamp(value) {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '-';
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function getSessionLocationLabel(session = {}) {
    const ip = String(session.ip || '').trim();
    if (!ip) return 'Unknown';
    if (ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost')) return `Localhost (${ip})`;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return `Private Network (${ip})`;
    return ip;
}

function bindActiveSessionsModalEvents() {
    const card = document.getElementById('activeLoginsCard');
    const overlay = document.getElementById('sessionModalOverlay');
    const closeBtn = document.getElementById('sessionModalClose');
    if (!card || !overlay || !closeBtn) return;
    if (activeSessionsModalEventsBound) return;
    activeSessionsModalEventsBound = true;

    card.addEventListener('click', () => {
        overlay.classList.add('active');
        renderActiveSessionsTable(activePortalSessionsCache);
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.classList.remove('active');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    });
}

function renderActiveSessionsTable(sessions = []) {
    const tbody = document.getElementById('activeSessionsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(sessions) || !sessions.length) {
        tbody.innerHTML = '<tr><td colspan="6">No active sessions found.</td></tr>';
        return;
    }

    sessions.forEach((session) => {
        const tr = document.createElement('tr');
        const shortUA = String(session.userAgent || '-').slice(0, 120);
        const sessionPreview = String(session.sessionId || '').slice(0, 12) || '-';
        tr.innerHTML = `
            <td>
                <div class="session-meta">
                    <strong>${escapeSessionText(session.fullName || session.username || 'Unknown')}</strong>
                    <small>${escapeSessionText(session.username || '-')}</small>
                    <small>Session: ${escapeSessionText(sessionPreview)}</small>
                </div>
            </td>
            <td>${escapeSessionText(session.role || '-')}</td>
            <td>
                <div class="session-meta">
                    <span>${escapeSessionText(getSessionLocationLabel(session))}</span>
                    <small>${escapeSessionText(session.campusName || 'No campus')}</small>
                </div>
            </td>
            <td title="${escapeSessionText(session.userAgent || '-')}">${escapeSessionText(shortUA || '-')}</td>
            <td>
                <div class="session-meta">
                    <span>${escapeSessionText(formatSessionTimestamp(session.lastSeen))}</span>
                    <small>Login: ${escapeSessionText(formatSessionTimestamp(session.loginAt))}</small>
                </div>
            </td>
            <td class="session-actions">
                <button type="button" class="btn btn-outline" data-session-logout="${escapeSessionText(session.sessionId || '')}">Logout</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-session-logout]').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const sessionId = btn.getAttribute('data-session-logout');
            await forceLogoutActiveSession(sessionId);
        });
    });
}

function getUniqueActiveUsersFromSessions(sessions = []) {
    const unique = new Map();
    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
        const key = `${session.role || ''}:${session.userId || session.username || ''}`;
        if (!unique.has(key)) unique.set(key, session);
    });
    return Array.from(unique.values());
}

async function forceLogoutActiveSession(sessionId) {
    if (!sessionId) return;
    const token = sessionStorage.getItem('eduCore_token');
    if (!token) return;

    const shouldLogout = await showAppConfirm('Log out this active session?', 'Force Logout');
    if (!shouldLogout) return;

    try {
        const response = await fetch(`${API_BASE_URL}/active-sessions/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId })
        });
        let result = await parseJsonResponse(response, 'Session logout failed.');

        if (!response.ok || result?.success === false) {
            // Backward compatibility fallback for environments still using DELETE endpoint.
            const fallback = await fetch(`${API_BASE_URL}/active-sessions/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            result = await parseJsonResponse(fallback, 'Session logout failed.');
            if (!fallback.ok || result?.success === false) {
                throw new Error(result?.message || 'Session logout failed.');
            }
        }
        await updateActivePortalLogins();
    } catch (error) {
        await showAppAlert(error.message || 'Session logout failed.', 'Error');
    }
}

async function updateActivePortalLogins() {
    const countEl = document.getElementById('dashActiveLogins');
    const detailEl = document.getElementById('dashActiveLoginsDetail');
    if (!countEl || !detailEl) return;

    const token = sessionStorage.getItem('eduCore_token');
    if (!token) {
        countEl.innerText = '0';
        detailEl.innerHTML = '<i data-lucide="monitor-up" size="16"></i> No active admin token';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/active-sessions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await parseJsonResponse(response, 'Active sessions load failed.');

        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Active sessions load failed.');
        }

        const roleCounts = Object.entries(result.byRole || {})
            .map(([role, count]) => `${role}: ${count}`)
            .join(' | ');

        const allSessions = Array.isArray(result.sessions) ? result.sessions : [];
        const uniqueUsersCount = Number(result.uniqueActiveUsers || getUniqueActiveUsersFromSessions(allSessions).length || 0);
        const activeSessionCount = Number(result.totalActiveSessions || allSessions.length || 0);

        activePortalSessionsCache = allSessions;
        countEl.innerText = String(activeSessionCount);
        detailEl.title = `${roleCounts}${roleCounts ? ' | ' : ''}Unique users: ${uniqueUsersCount}`;
        detailEl.innerHTML = `<i data-lucide="monitor-up" size="16"></i> ${activeSessionCount} systems active now`;
        const overlay = document.getElementById('sessionModalOverlay');
        if (overlay?.classList.contains('active')) {
            renderActiveSessionsTable(activePortalSessionsCache);
        }
    } catch (error) {
        activePortalSessionsCache = [];
        countEl.innerText = '0';
        detailEl.innerHTML = '<i data-lucide="monitor-up" size="16"></i> Live sessions unavailable';
        const overlay = document.getElementById('sessionModalOverlay');
        if (overlay?.classList.contains('active')) {
            renderActiveSessionsTable([]);
        }
    }

    if (window.lucide) window.lucide.createIcons();
}
// =======================================================
// ==================== STUDENT LOGIC ====================
// =======================================================

function toggleStudentForm(editMode = false) {
    const container = document.getElementById('studentFormContainer');
    const form = document.getElementById('studentForm');
    const title = document.getElementById('formTitle');
    if (!container || !form) return;

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('studentId').value = '';
        setStudentPhotoPreview('');
        populateStudentFamilyOptions();
    } else {
        const classSelect = document.getElementById('classGrade');
        if (classSelect && classSelect.tagName === 'SELECT') {
            classSelect.innerHTML = '<option value="">Select Class</option>';
            getAvailableStudentClassOptions().forEach((cls) => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                classSelect.appendChild(opt);
            });
        }
        ensureStudentCampusDefault();
        container.style.display = 'block';
        // Reset Panels
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.action-step-btn').forEach(b => b.classList.remove('active'));

        if (!editMode) {
            form.reset();
            document.getElementById('studentId').value = '';
            const studentCodeField = document.getElementById('studentCode');
            if (studentCodeField) studentCodeField.value = generateStudentCode();
            const admissionDateField = document.getElementById('admissionDate');
            if (admissionDateField) admissionDateField.value = new Date().toISOString().split('T')[0];
            if (document.getElementById('feeFrequency')) document.getElementById('feeFrequency').value = 'Monthly';
            populateStudentFamilyOptions();
            setStudentPhotoPreview('');
            title.innerText = 'Add New Student';
        } else {
            title.innerText = 'Edit Student Details';
        }
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function validateStudentRequiredFields() {
    ensureStudentCampusDefault();

    const requiredFields = [
        ['fullName', 'Full Name'],
        ['fatherName', "Father's Name"],
        ['studentDob', 'Date of Birth'],
        ['classGrade', 'Class'],
        ['campusName', 'Campus'],
        ['parentPhone', 'Contact Phone'],
        ['gender', 'Gender'],
        ['rollNo', 'Roll No']
    ];

    const missingField = requiredFields.find(([fieldId]) => {
        const field = document.getElementById(fieldId);
        return field && !String(field.value || '').trim();
    });

    if (missingField) {
        const field = document.getElementById(missingField[0]);
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus();
        await showAppAlert(`${missingField[1]} is required.`, 'Missing Student Detail');
        return false;
    }

    return true;
}

function generateStudentCode() {
    const students = getArrayData(STORAGE_KEY_STUDENTS);
    let maxNumber = 0;

    students.forEach(student => {
        const rawCode = String(student.studentCode || '').trim();
        const match = rawCode.match(/^STU-(\d{1,5})$/i);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed > maxNumber) {
                maxNumber = parsed;
            }
        }
    });

    return `STU-${String(maxNumber + 1).padStart(3, '0')}`;
}

function normalizeClassFeeKey(className = '') {
    return String(className || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function getAvailableStudentClassOptions() {
    const seen = new Set();
    const classes = [];
    const addClass = (className) => {
        const value = String(className || '').trim();
        if (!value) return;
        const key = normalizeClassFeeKey(value);
        if (seen.has(key)) return;
        seen.add(key);
        classes.push(value);
    };

    DEFAULT_STUDENT_CLASS_ORDER.forEach(addClass);
    getData(STORAGE_KEY_CLASSES).forEach((item) => {
        const val = item?.section ? `${item.name} (${item.section})` : item?.name;
        addClass(val);
    });

    return classes;
}

function normalizeClassFeeConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    return Object.entries(raw).reduce((acc, [className, config]) => {
        const name = String(className || '').trim();
        const monthlyFee = String(config?.monthlyFee ?? config?.fee ?? '').trim();
        const annualCharges = String(config?.annualCharges ?? config?.annualFee ?? '').trim();
        const feeFrequency = String(config?.feeFrequency || 'Monthly').trim() || 'Monthly';
        const feeMonth = String(config?.feeMonth || '').trim();
        const feeYear = String(config?.feeYear || '').trim();
        if (name && (monthlyFee || annualCharges)) acc[name] = { monthlyFee, annualCharges, feeFrequency, feeMonth, feeYear };
        return acc;
    }, {});
}

function saveClassFeeLocalBackup() {
    try {
        localStorage.setItem(STORAGE_KEY_CLASS_FEES, JSON.stringify(classFeeDefaults || {}));
        localStorage.setItem(STORAGE_KEY_CLASS_FEE_HISTORY, JSON.stringify(Array.isArray(classFeeHistory) ? classFeeHistory : []));
    } catch (_error) {}
}

async function loadClassFeeDefaults() {
    try {
        const response = await fetch(`${API_BASE_URL}/class-fees`);
        const result = await parseJsonResponse(response, 'Class fee defaults unavailable.');
        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Class fee defaults unavailable.');
        }
        classFeeDefaults = normalizeClassFeeConfig(result.classFees || {});
        classFeeHistory = Array.isArray(result.classFeeHistory) ? result.classFeeHistory : [];
        saveClassFeeLocalBackup();
    } catch (error) {
        try {
            classFeeDefaults = normalizeClassFeeConfig(JSON.parse(localStorage.getItem(STORAGE_KEY_CLASS_FEES) || '{}'));
            classFeeHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_CLASS_FEE_HISTORY) || '[]');
            if (!Array.isArray(classFeeHistory)) classFeeHistory = [];
        } catch (_fallbackError) {
            classFeeDefaults = {};
            classFeeHistory = [];
        }
    }
    renderClassFeeSettings();
    renderClassFeeHistory();
    return classFeeDefaults;
}

function getClassFeeDefault(className = '') {
    const selectedKey = normalizeClassFeeKey(className);
    if (!selectedKey) return null;
    const match = Object.entries(classFeeDefaults)
        .find(([name]) => normalizeClassFeeKey(name) === selectedKey);
    return match ? match[1] : null;
}

function bindStudentClassFeeAutoFill() {
    const classSelect = document.getElementById('classGrade');
    if (!classSelect || classSelect.dataset.classFeeBound === '1') return;
    classSelect.dataset.classFeeBound = '1';
    classSelect.addEventListener('change', refreshStudentClassFeeAutoFill);
}

async function refreshStudentClassFeeAutoFill() {
    await loadClassFeeDefaults();
    applyClassFeeDefaultToStudentForm(true);
}

function applyClassFeeDefaultToStudentForm(force = false) {
    const classSelect = document.getElementById('classGrade');
    const monthlyFeeInput = document.getElementById('monthlyFee');
    const feeFrequencyInput = document.getElementById('feeFrequency');
    if (!classSelect || !monthlyFeeInput) return;

    const feeDefault = getClassFeeDefault(classSelect.value);
    if (!feeDefault) {
        if (force) {
            monthlyFeeInput.value = '';
            monthlyFeeInput.dataset.autoClassFee = '';
            if (feeFrequencyInput) feeFrequencyInput.value = 'Monthly';
        }
        return;
    }

    const currentFee = String(monthlyFeeInput.value || '').trim();
    if (force || !currentFee || currentFee === '0' || monthlyFeeInput.dataset.autoClassFee === '1') {
        monthlyFeeInput.value = feeDefault.monthlyFee;
        monthlyFeeInput.dataset.autoClassFee = '1';
        if (feeFrequencyInput) feeFrequencyInput.value = feeDefault.feeFrequency || 'Monthly';
    }
}

async function setupClassFeeSettings() {
    const form = document.getElementById('classFeeForm');
    const classSelect = document.getElementById('classFeeClassSelect');
    const amountInput = document.getElementById('classFeeAmount');
    const annualInput = document.getElementById('classAnnualCharges');
    const frequencyInput = document.getElementById('classFeeFrequency');
    const monthInput = document.getElementById('classFeeMonth');
    const yearInput = document.getElementById('classFeeYear');
    const saveButton = document.getElementById('classFeeSaveButton');
    const cancelEditButton = document.getElementById('classFeeCancelEditButton');
    if (!form || !classSelect || !amountInput) return;

    populateClassFeeSelect();
    await loadClassFeeDefaults();

    classSelect.addEventListener('change', () => {
        const feeDefault = getClassFeeDefault(classSelect.value);
        amountInput.value = feeDefault?.monthlyFee || '';
        if (annualInput) annualInput.value = feeDefault?.annualCharges || '';
        if (frequencyInput) frequencyInput.value = feeDefault?.feeFrequency || 'Monthly';
        if (monthInput && feeDefault?.feeMonth) monthInput.value = feeDefault.feeMonth;
        if (yearInput && feeDefault?.feeYear) yearInput.value = feeDefault.feeYear;
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const className = String(classSelect.value || '').trim();
        const monthlyFee = String(amountInput.value || '').trim();
        const annualCharges = String(annualInput?.value || '').trim();
        const feeFrequency = String(frequencyInput?.value || 'Monthly').trim() || 'Monthly';
        const feeMonth = String(monthInput?.value || '').trim();
        const feeYear = String(yearInput?.value || '').trim();
        if (!className || (!monthlyFee && !annualCharges)) {
            await showAppAlert('Please select a class and enter monthly fee or annual charges.', 'Missing Fee');
            return;
        }

        const token = sessionStorage.getItem('eduCore_token') || '';
        try {
            const editingId = String(classFeeEditingHistoryId || '').trim();
            const response = await fetch(editingId ? `${API_BASE_URL}/class-fees/history/${encodeURIComponent(editingId)}` : `${API_BASE_URL}/class-fees`, {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ className, monthlyFee, annualCharges, feeFrequency, feeMonth, feeYear })
            });
            const result = await parseJsonResponse(response, 'Class fee could not be saved.');
            if (!response.ok || result?.success === false) {
                throw new Error(result?.message || 'Class fee could not be saved.');
            }
            classFeeDefaults = normalizeClassFeeConfig(result.classFees || {});
            classFeeHistory = Array.isArray(result.classFeeHistory) ? result.classFeeHistory : classFeeHistory;
            saveClassFeeLocalBackup();
            clearClassFeeHistoryEditMode();
            renderClassFeeSettings();
            renderClassFeeHistory();
            const monthlyText = monthlyFee ? `monthly PKR ${Number(monthlyFee).toLocaleString('en-PK')}` : '';
            const annualText = annualCharges ? `annual PKR ${Number(annualCharges).toLocaleString('en-PK')}` : '';
            pushNotification(editingId ? 'Fee History Updated' : 'Class Fee Updated', `${className} ${[monthlyText, annualText].filter(Boolean).join(' and ')} saved.`, 'success');
        } catch (error) {
            await showAppAlert(error.message || 'Class fee could not be saved.', 'Save Failed');
        }
    });

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', clearClassFeeHistoryEditMode);
    }

    if (saveButton) {
        saveButton.dataset.defaultLabel = saveButton.innerHTML;
    }
}

function populateClassFeeSelect() {
    const classSelect = document.getElementById('classFeeClassSelect');
    if (!classSelect) return;
    classSelect.innerHTML = '<option value="">Select Class</option>';
    getAvailableStudentClassOptions().forEach((className) => {
        const opt = document.createElement('option');
        opt.value = className;
        opt.textContent = className;
        classSelect.appendChild(opt);
    });
}

function renderClassFeeSettings() {
    const list = document.getElementById('classFeeList');
    if (!list) return;
    const entries = Object.entries(classFeeDefaults).sort((a, b) => compareStudentClassNames(a[0], b[0]));
    if (!entries.length) {
        list.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">No class fee defaults saved yet.</span>';
        return;
    }
    list.innerHTML = entries.map(([className, config]) => `
        <span class="class-fee-pill">
            ${escapeHtml(className)}: PKR ${Number(config.monthlyFee || 0).toLocaleString('en-PK')} ${escapeHtml(config.feeFrequency || 'Monthly')}${config.annualCharges ? ` | Annual PKR ${Number(config.annualCharges || 0).toLocaleString('en-PK')}` : ''}${config.feeMonth || config.feeYear ? ` (${escapeHtml([config.feeMonth, config.feeYear].filter(Boolean).join(' '))})` : ''}
        </span>
    `).join('');
}

function setClassFeeSelectValue(className) {
    const classSelect = document.getElementById('classFeeClassSelect');
    if (!classSelect) return;
    const target = String(className || '').trim();
    if (!target) return;
    const exists = Array.from(classSelect.options).some((option) => option.value === target);
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = target;
        opt.textContent = target;
        classSelect.appendChild(opt);
    }
    classSelect.value = target;
}

function clearClassFeeHistoryEditMode() {
    classFeeEditingHistoryId = '';
    const saveButton = document.getElementById('classFeeSaveButton');
    const cancelButton = document.getElementById('classFeeCancelEditButton');
    const form = document.getElementById('classFeeForm');
    if (saveButton) {
        saveButton.innerHTML = saveButton.dataset.defaultLabel || '<i data-lucide="save"></i> Save Fee';
    }
    if (cancelButton) cancelButton.style.display = 'none';
    if (form) form.dataset.editingHistoryId = '';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function editClassFeeHistory(historyId) {
    const id = String(historyId || '').trim();
    const item = (Array.isArray(classFeeHistory) ? classFeeHistory : []).find((row) => String(row?.id || '') === id);
    if (!item) {
        showAppAlert('Fee history record was not found.', 'Edit Failed');
        return;
    }

    classFeeEditingHistoryId = id;
    setClassFeeSelectValue(item.className || '');
    const amountInput = document.getElementById('classFeeAmount');
    const annualInput = document.getElementById('classAnnualCharges');
    const frequencyInput = document.getElementById('classFeeFrequency');
    const monthInput = document.getElementById('classFeeMonth');
    const yearInput = document.getElementById('classFeeYear');
    const saveButton = document.getElementById('classFeeSaveButton');
    const cancelButton = document.getElementById('classFeeCancelEditButton');
    const form = document.getElementById('classFeeForm');

    if (amountInput) amountInput.value = item.monthlyFee || '';
    if (annualInput) annualInput.value = item.annualCharges || '';
    if (frequencyInput) frequencyInput.value = item.feeFrequency || 'Monthly';
    if (monthInput && item.feeMonth) monthInput.value = item.feeMonth;
    if (yearInput) yearInput.value = item.feeYear || yearInput.value || String(new Date().getFullYear());
    if (saveButton) saveButton.innerHTML = '<i data-lucide="save"></i> Update Fee';
    if (cancelButton) cancelButton.style.display = '';
    if (form) {
        form.dataset.editingHistoryId = id;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

async function deleteClassFeeHistory(historyId) {
    const id = String(historyId || '').trim();
    const item = (Array.isArray(classFeeHistory) ? classFeeHistory : []).find((row) => String(row?.id || '') === id);
    if (!item) {
        await showAppAlert('Fee history record was not found.', 'Delete Failed');
        return;
    }

    const ok = typeof showAppConfirm === 'function'
        ? await showAppConfirm(`Delete fee history for ${item.className || 'this class'}?`, 'Delete Fee History')
        : window.confirm(`Delete fee history for ${item.className || 'this class'}?`);
    if (!ok) return;

    const token = sessionStorage.getItem('eduCore_token') || '';
    try {
        const response = await fetch(`${API_BASE_URL}/class-fees/history/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await parseJsonResponse(response, 'Fee history could not be deleted.');
        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Fee history could not be deleted.');
        }
        classFeeDefaults = normalizeClassFeeConfig(result.classFees || {});
        classFeeHistory = Array.isArray(result.classFeeHistory) ? result.classFeeHistory : [];
        saveClassFeeLocalBackup();
        if (classFeeEditingHistoryId === id) clearClassFeeHistoryEditMode();
        renderClassFeeSettings();
        renderClassFeeHistory();
        pushNotification('Fee History Deleted', `${item.className || 'Class'} fee history removed.`, 'info');
    } catch (error) {
        await showAppAlert(error.message || 'Fee history could not be deleted.', 'Delete Failed');
    }
}

function handleClassFeeHistoryAction(selectElement, historyId) {
    const action = String(selectElement?.value || '').trim().toLowerCase();
    if (!action) return;
    selectElement.value = '';
    if (action === 'edit') {
        editClassFeeHistory(historyId);
    }
    if (action === 'delete') {
        deleteClassFeeHistory(historyId);
    }
}

function renderClassFeeHistory() {
    const wrap = document.getElementById('classFeeHistoryWrap');
    if (!wrap) return;

    const rows = Array.isArray(classFeeHistory) ? [...classFeeHistory] : [];
    rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

    if (!rows.length) {
        wrap.innerHTML = '<div class="empty-history">No fee history saved yet.</div>';
        return;
    }

    wrap.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Month</th>
                    <th>Class</th>
                    <th>Fee</th>
                    <th>Annual</th>
                    <th>Frequency</th>
                    <th>Updated</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((item) => {
                    const updated = item.updatedAt ? new Date(item.updatedAt) : null;
                    const updatedText = updated && !Number.isNaN(updated.getTime())
                        ? updated.toLocaleDateString('en-PK')
                        : '';
                    const historyId = escapeHtml(item.id || '');
                    return `
                        <tr>
                            <td>${escapeHtml(item.feeYear || '')}</td>
                            <td>${escapeHtml(item.feeMonth || '')}</td>
                            <td>${escapeHtml(item.className || '')}</td>
                            <td>PKR ${Number(item.monthlyFee || 0).toLocaleString('en-PK')}</td>
                            <td>${item.annualCharges ? `PKR ${Number(item.annualCharges || 0).toLocaleString('en-PK')}` : '-'}</td>
                            <td>${escapeHtml(item.feeFrequency || 'Monthly')}</td>
                            <td>${escapeHtml(updatedText)}</td>
                            <td>
                                <div class="history-actions">
                                    <select class="table-action-select" onchange="handleClassFeeHistoryAction(this, '${historyId}')">
                                        <option value="">Actions</option>
                                        <option value="edit">Edit</option>
                                        <option value="delete">Delete</option>
                                    </select>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function normalizeDateInputValue(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toISOString().split('T')[0];
}

async function handleStudentFormSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('studentId');
    const isEdit = idField.value !== '';

    const existingStudents = getData(STORAGE_KEY_STUDENTS);
    const existingStudent = isEdit ? existingStudents.find(s => s.id === idField.value) : null;
    const currentStatus = isEdit && existingStudent ? (existingStudent.feesStatus || 'Pending') : 'Pending';
    const enrollmentStatus = isEdit && existingStudent ? (existingStudent.enrollmentStatus || 'Active') : 'Active';

    const studentCode = document.getElementById('studentCode').value || generateStudentCode();
    const parentPhone = document.getElementById('parentPhone').value.trim();
    let usernameInput = document.getElementById('username').value.trim();
    let studentPasswordInput = document.getElementById('studentPassword').value;
    applyClassFeeDefaultToStudentForm();
    const monthlyFeeInput = document.getElementById('monthlyFee') ? document.getElementById('monthlyFee').value : '';
    const studentEmailInput = document.getElementById('studentEmail') ? document.getElementById('studentEmail').value.trim().toLowerCase() : '';
    const guardianName = document.getElementById('guardianName')?.value.trim() || '';
    const guardianContact = document.getElementById('guardianContact')?.value.trim() || '';

    const requiredFields = [
        ['fullName', 'Full Name is required.'],
        ['fatherName', "Father's Name is required."],
        ['studentDob', 'Date of Birth is required.'],
        ['classGrade', 'Class is required.'],
        ['campusName', 'Campus Name is required.'],
        ['parentPhone', 'Contact Phone is required.'],
        ['gender', 'Gender is required.'],
        ['rollNo', 'Roll No is required.']
    ];

    for (const [fieldId, message] of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!String(field?.value || '').trim()) {
            alert(message);
            field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field?.focus();
            return;
        }
    }

    if (!usernameInput) {
        usernameInput = studentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        document.getElementById('username').value = usernameInput;
    }

    if (!studentPasswordInput) {
        const digits = parentPhone.replace(/\D/g, '');
        studentPasswordInput = `Student${digits.length >= 4 ? digits.slice(-4) : '123'}`;
        document.getElementById('studentPassword').value = studentPasswordInput;
    }

    const studentIdentityError = validateStudentIdentityInputs({
        studentId: idField.value,
        username: usernameInput,
        email: studentEmailInput
    });

    if (studentIdentityError) {
        alert(studentIdentityError);
        if (studentIdentityError.toLowerCase().includes('username')) document.getElementById('username')?.focus();
        if (studentIdentityError.toLowerCase().includes('email')) document.getElementById('studentEmail')?.focus();
        return;
    }

    const photoInput = document.getElementById('studentProfileImage');
    let profileImage = existingStudent?.profileImage || '';
    const fatherNameInput = document.getElementById('fatherName').value.trim();
    const familyName = document.getElementById('studentFamilyName')?.value.trim() || '';
    const familyNo = document.getElementById('studentFamilyNo')?.value.trim() || '';
    const familyContact = document.getElementById('studentFamilyContact')?.value.trim() || '';
    const familyId = ensureExplicitFamilyRecord(familyName, familyNo, familyContact);

    try {
        if (photoInput?.files?.[0]) profileImage = await readFileAsDataUrl(photoInput.files[0]);
    } catch (error) {
        alert(error.message);
        return;
    }

    const newStudent = {
        id: isEdit ? idField.value : generateUniqueRecordId('STU'),
        studentCode,
        fullName: document.getElementById('fullName').value.trim(),
        profileImage,
        fatherName: fatherNameInput,
        dob: document.getElementById('studentDob').value,
        admissionDate: document.getElementById('admissionDate') ? document.getElementById('admissionDate').value : (existingStudent?.admissionDate || ''),
        classGrade: document.getElementById('classGrade').value,
        campusName: document.getElementById('campusName').value,
        parentPhone,
        guardianName,
        guardianContact,
        email: studentEmailInput,
        gender: document.getElementById('gender').value,
        rollNo: document.getElementById('rollNo').value.trim(),
        formB: document.getElementById('formB').value.trim(),
        fingerprintData: document.getElementById('studentFingerprintData') ? document.getElementById('studentFingerprintData').value.trim() : (existingStudent?.fingerprintData || ''),
        familyId,
        familyName,
        familyNo,
        familyContact,
        feesStatus: currentStatus,
        enrollmentStatus,
        monthlyFee: monthlyFeeInput || '0',
        feeFrequency: document.getElementById('feeFrequency') ? document.getElementById('feeFrequency').value : 'Monthly',
        username: usernameInput,
        password: studentPasswordInput,
        plainPassword: studentPasswordInput,
        role: 'Student'
    };

    // Auto-set payment date if status is Paid
    if (currentStatus === 'Paid') {
        if (existingStudent && existingStudent.feesStatus === 'Paid' && existingStudent.paymentDate) {
            newStudent.paymentDate = existingStudent.paymentDate;
        } else {
            newStudent.paymentDate = new Date().toLocaleDateString();
        }
    } else {
        newStudent.paymentDate = '';
    }

    let students = getData(STORAGE_KEY_STUDENTS);
    if (isEdit) {
        const index = students.findIndex(s => s.id === newStudent.id);
        if (index !== -1) students[index] = newStudent;
    } else {
        students.push(newStudent);
    }
    students = syncStudentFamilyLinksByDetails(students, familyId, familyName, familyNo, familyContact);

    let localSaveResult;
    try {
        localSaveResult = saveStudentsWithLocalFallback(students, newStudent);
        students = localSaveResult.students;
    } catch (error) {
        await showAppAlert(error.message || 'Student could not be saved in the browser.', 'Save Failed');
        return;
    }

    renderStudents();

    const syncResult = await syncToSQLDetailed('students', [localSaveResult.student]);
    if (!syncResult.success) {
        await showAppAlert(
            syncResult.error || 'The student was saved locally, but database sync failed. Check the server and MySQL connection.',
            'Student Saved Locally'
        );
        renderStudents();
        return;
    }

    try {
        await refreshStudentsFromSQL();
    } catch (error) {
        console.warn('Student list refresh failed:', error.message);
    }

    pushNotification('Student Updated', `Account for "${newStudent.fullName}" saved and activated.`, 'user');
    toggleStudentForm();
    populateQuickStudentFilters();
    renderStudents();
    showSuccessModal('Student Registered!', `The account for ${newStudent.fullName} is now active. They can log in using username: ${usernameInput}`);
}

function bindStudentFormSubmit() {
    const studentForm = document.getElementById('studentForm');
    if (!studentForm || studentForm.dataset.submitBound === '1') return;
    studentForm.dataset.submitBound = '1';
    studentForm.onsubmit = (event) => {
        handleStudentFormSubmit(event);
        return false;
    };
}

bindStudentFormSubmit();

function decodeRowPayload(encodedPayload) {
    try {
        return JSON.parse(decodeURIComponent(String(encodedPayload || '')));
    } catch (error) {
        return null;
    }
}

function editStudentFromEncoded(encodedPayload) {
    const payload = decodeRowPayload(encodedPayload);
    if (!payload) {
        alert('Unable to load student details for editing.');
        return;
    }
    editStudent(payload);
}

function viewStudentFromEncoded(encodedPayload) {
    const payload = decodeRowPayload(encodedPayload);
    if (!payload) {
        alert('Unable to load student details.');
        return;
    }
    viewStudent(payload);
}

async function sendStudentCustomEmailFromEncoded(encodedPayload) {
    const student = decodeRowPayload(encodedPayload);
    const to = String(student?.email || '').trim();
    if (!student || !to) {
        showAppAlert('This student does not have an email address saved.', 'Email Missing');
        return;
    }

    const subject = window.prompt('Email subject', 'Message from Apexiums School');
    if (!subject) return;
    const message = window.prompt('Email message');
    if (!message) return;

    try {
        const token = sessionStorage.getItem('eduCore_token') || '';
        const response = await fetch(`${API_BASE_URL}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                to,
                subject,
                text: `Dear ${student.fullName || 'Student'},\n\n${message}\n\nApexiums School`,
                html: `
                    <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:28px 12px">
                            <tr>
                                <td align="center">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.12)">
                                        <tr>
                                            <td style="background:#0f766e;padding:24px 28px;color:#ffffff">
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                    <tr>
                                                        <td width="74"><img src="cid:school-logo" width="62" height="62" alt="Apexiums School" style="display:block;border-radius:14px;background:#ffffff;padding:6px;object-fit:contain"></td>
                                                        <td style="padding-left:14px"><div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Apexiums School</div><h1 style="margin:6px 0 0;font-size:24px;line-height:1.25;color:#ffffff">${escapeHtml(subject)}</h1></td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding:28px">
                                                <p style="margin:0 0 12px;color:#111827;font-size:15px">Dear ${escapeHtml(student.fullName || 'Student')},</p>
                                                <div style="margin-top:18px;padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;color:#1f2937;font-size:15px;line-height:1.8;white-space:pre-line">${escapeHtml(message)}</div>
                                                <p style="margin:22px 0 0;color:#111827;font-size:14px;font-weight:700">Apexiums School</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>
                `
            })
        });
        const result = await parseJsonResponse(response, 'Email could not be sent.');
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'Email could not be sent.');
        showAppAlert('Email sent successfully.', 'Email Sent');
    } catch (error) {
        showAppAlert(error.message || String(error), 'Email Failed');
    }
}

function handleStudentActionSelect(selectElement, encodedPayload, studentId, isBranchUser = 0) {
    const action = String(selectElement?.value || '').trim().toLowerCase();
    if (!action) return;

    if (selectElement) selectElement.value = '';

    if (action === 'view') {
        viewStudentFromEncoded(encodedPayload);
        return;
    }

    if (action === 'email') {
        sendStudentCustomEmailFromEncoded(encodedPayload);
        return;
    }

    if (Number(isBranchUser) === 1) {
        return;
    }

    if (action === 'edit') {
        if (!canCurrentUserPerformAction('students', 'edit')) {
            showAppAlert('You do not have permission to edit students.', 'Permission Denied');
            return;
        }
        editStudentFromEncoded(encodedPayload);
        return;
    }

    if (action === 'stuckoff' || action === 'terminate') {
        if (!canCurrentUserPerformAction('students', 'edit')) {
            showAppAlert('You do not have permission to update student status.', 'Permission Denied');
            return;
        }
        stuckOffStudent(studentId);
        return;
    }

    if (action === 'reactivate') {
        if (!canCurrentUserPerformAction('students', 'edit')) {
            showAppAlert('You do not have permission to update student status.', 'Permission Denied');
            return;
        }
        reactivateStudent(studentId);
        return;
    }

    if (action === 'delete') {
        if (!canCurrentUserPerformAction('students', 'delete')) {
            showAppAlert('You do not have permission to delete students.', 'Permission Denied');
            return;
        }
        deleteStudent(studentId);
    }
}

function handleTeacherActionSelect(selectElement, encodedPayload, teacherId) {
    const action = String(selectElement?.value || '').trim().toLowerCase();
    if (!action) return;

    if (selectElement) selectElement.value = '';

    if (action === 'attendance') {
        viewTeacherAttendanceFromEncoded(encodedPayload);
        return;
    }

    if (action === 'schedule') {
        openTeacherSchedule(teacherId);
        return;
    }

    if (action === 'edit') {
        editTeacherFromEncoded(encodedPayload);
        return;
    }

    if (action === 'stuckoff') {
        markTeacherStuckOff(teacherId);
        return;
    }

    if (action === 'reactivate') {
        reactivateTeacher(teacherId);
        return;
    }

    if (action === 'delete') {
        deleteTeacher(teacherId);
    }
}

function viewStudent(student) {
    const modal = document.getElementById('studentViewModal');
    if (!modal) {
        const compactDetails = `ID: ${student.studentCode || '-'} | Roll: ${student.rollNo || '-'} | Name: ${student.fullName || '-'} | Class: ${student.classGrade || '-'} | Campus: ${student.campusName || '-'}`;
        showAppAlert(compactDetails, 'Student Details');
        return;
    }

    const detailsMap = {
        viewStudentCode: student.studentCode || '-',
        viewStudentRollNo: student.rollNo || '-',
        viewStudentName: student.fullName || '-',
        viewStudentFatherName: student.fatherName || '-',
        viewStudentDob: formatDateForDisplay(student.dob),
        viewStudentClass: student.classGrade || '-',
        viewStudentCampus: student.campusName || '-',
        viewStudentGender: student.gender || '-',
        viewStudentStatus: isStudentTerminated(student) ? 'Terminated' : (student.feesStatus || 'Pending'),
        viewStudentPhone: student.parentPhone || '-',
        viewStudentGuardianName: student.guardianName || '-',
        viewStudentGuardianContact: student.guardianContact || '-',
        viewStudentEmail: student.email || '-',
        viewStudentUsername: student.username || '-'
    };

    Object.entries(detailsMap).forEach(([id, value]) => {
        const target = document.getElementById(id);
        if (target) target.textContent = value;
    });

    modal.style.display = 'flex';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function closeStudentViewModal() {
    const modal = document.getElementById('studentViewModal');
    if (modal) modal.style.display = 'none';
}

function editTeacherFromEncoded(encodedPayload) {
    const payload = decodeRowPayload(encodedPayload);
    if (!payload) {
        alert('Unable to load teacher details for editing.');
        return;
    }
    editTeacher(payload);
}

function viewTeacherAttendanceFromEncoded(encodedPayload) {
    const payload = decodeRowPayload(encodedPayload);
    if (!payload) {
        alert('Unable to load teacher attendance details.');
        return;
    }
    viewTeacherAttendance(payload);
}

function bindStudentQuickFilterMultiSelect() {
    const container = document.getElementById('studentQuickFilterMulti');
    const trigger = document.getElementById('studentQuickFilterTrigger');
    const menu = document.getElementById('studentQuickFilterMenu');
    const select = document.getElementById('studentQuickFilter');

    if (!container || !trigger || !menu || !select) return;
    if (container.dataset.bound === '1') return;
    container.dataset.bound = '1';

    trigger.addEventListener('click', () => {
        if (container.classList.contains('disabled')) return;
        toggleStudentQuickFilterMultiMenu();
    });

    if (!window.__eduCoreStudentQuickFilterBound) {
        window.__eduCoreStudentQuickFilterBound = true;

        document.addEventListener('click', (event) => {
            const active = document.getElementById('studentQuickFilterMulti');
            if (!active || !active.classList.contains('open')) return;
            if (active.contains(event.target)) return;
            closeStudentQuickFilterMultiMenu();
        }, true);

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            closeStudentQuickFilterMultiMenu();
        });
    }
}

function openStudentQuickFilterMultiMenu() {
    const container = document.getElementById('studentQuickFilterMulti');
    const trigger = document.getElementById('studentQuickFilterTrigger');
    if (!container || !trigger) return;
    if (container.classList.contains('disabled')) return;
    container.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
}

function closeStudentQuickFilterMultiMenu() {
    const container = document.getElementById('studentQuickFilterMulti');
    const trigger = document.getElementById('studentQuickFilterTrigger');
    if (!container || !trigger) return;
    container.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
}

function toggleStudentQuickFilterMultiMenu() {
    const container = document.getElementById('studentQuickFilterMulti');
    if (!container) return;
    if (container.classList.contains('open')) {
        closeStudentQuickFilterMultiMenu();
        return;
    }
    openStudentQuickFilterMultiMenu();
}

function normalizeStudentQuickFilterValues(values) {
    const uniqueValues = Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (uniqueValues.length === 0) return ['all'];

    if (uniqueValues.includes('all') && uniqueValues.length > 1) {
        const withoutAll = uniqueValues.filter((value) => value !== 'all');
        return withoutAll.length ? withoutAll : ['all'];
    }

    return uniqueValues;
}

function getStudentQuickFilterSelectedValues(selectElement) {
    const quickFilter = selectElement || document.getElementById('studentQuickFilter');
    if (!quickFilter) return ['all'];

    const selected = Array.from(quickFilter.selectedOptions || []).map((option) => option.value);
    return normalizeStudentQuickFilterValues(selected);
}

function setStudentQuickFilterSelectedValues(values) {
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!quickFilter) return;

    const normalized = normalizeStudentQuickFilterValues(values);
    const optionByValue = new Map(Array.from(quickFilter.options || []).map((option) => [String(option.value), option]));

    Array.from(optionByValue.values()).forEach((option) => {
        option.selected = false;
    });

    let selectedCount = 0;
    normalized.forEach((value) => {
        const option = optionByValue.get(String(value));
        if (!option) return;
        option.selected = true;
        selectedCount += 1;
    });

    if (selectedCount === 0) {
        const allOption = optionByValue.get('all');
        if (allOption) allOption.selected = true;
    }
}

function parseStudentQuickFilterValues(values) {
    const normalizedValues = normalizeStudentQuickFilterValues(values);
    const genders = [];
    const campuses = [];
    const classes = [];
    let below5 = false;

    normalizedValues.forEach((value) => {
        if (value.startsWith('gender:')) {
            const gender = value.split(':')[1];
            if (gender) genders.push(gender);
            return;
        }

        if (value.startsWith('campus:')) {
            const campus = value.slice('campus:'.length);
            if (campus) campuses.push(campus);
            return;
        }

        if (value.startsWith('class:')) {
            const className = value.slice('class:'.length);
            if (className) classes.push(className);
            return;
        }

        if (value === 'age:below5') {
            below5 = true;
        }
    });

    return {
        genders,
        campuses,
        classes,
        below5
    };
}

function getStudentClassSortRank(className) {
    const normalized = String(className || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    const defaultIndex = DEFAULT_STUDENT_CLASS_ORDER.findIndex((name) => name.toLowerCase() === normalized);
    if (defaultIndex !== -1) return defaultIndex;

    const aliasRanks = {
        play: 0,
        pg: 0,
        playgroup: 0,
        'play group': 0,
        kg1: 1,
        nursery: 1,
        nursary: 1,
        kg2: 2,
        prep: 2,
        preschool: 2
    };
    if (Object.prototype.hasOwnProperty.call(aliasRanks, normalized)) return aliasRanks[normalized];

    const wordNumbers = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10
    };
    const classMatch = normalized.match(/^(?:class|grade)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (classMatch) {
        const classNumber = wordNumbers[classMatch[1]] || Number.parseInt(classMatch[1], 10);
        if (Number.isFinite(classNumber)) return 2 + classNumber;
    }

    return 1000;
}

function compareStudentClassNames(a, b) {
    const rankA = getStudentClassSortRank(a);
    const rankB = getStudentClassSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function getStudentQuickFilterClassLabel(className) {
    const normalized = String(className || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    if (normalized === 'nursery' || normalized === 'nursary' || normalized === 'kg1') return 'KG1';
    if (normalized === 'prep' || normalized === 'kg2') return 'KG2';
    return className;
}

function getStudentQuickFilterLabelForValue(value) {
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!quickFilter) return '';
    const option = Array.from(quickFilter.options || []).find((opt) => String(opt.value) === String(value));
    return option ? String(option.textContent || '').trim() : '';
}

function buildStudentQuickFilterTriggerLabel(selectedValues) {
    const normalized = normalizeStudentQuickFilterValues(selectedValues);
    if (normalized.length === 0 || (normalized.length === 1 && normalized[0] === 'all')) return 'All Students';

    const labels = normalized
        .map((value) => getStudentQuickFilterLabelForValue(value))
        .filter(Boolean);

    if (!labels.length) return 'Filters';
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function syncStudentQuickFilterMultiUI() {
    const container = document.getElementById('studentQuickFilterMulti');
    const trigger = document.getElementById('studentQuickFilterTrigger');
    const menu = document.getElementById('studentQuickFilterMenu');
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!container || !trigger || !menu || !quickFilter) return;

    const selectedValues = getStudentQuickFilterSelectedValues(quickFilter);
    trigger.textContent = buildStudentQuickFilterTriggerLabel(selectedValues);

    const selectedSet = new Set(selectedValues);
    menu.querySelectorAll('input[type="checkbox"][data-filter-value]').forEach((checkbox) => {
        const value = checkbox.getAttribute('data-filter-value');
        checkbox.checked = selectedSet.has(value);
    });
}

function handleStudentQuickFilterCheckboxToggle(event) {
    const checkbox = event?.target;
    if (!checkbox || checkbox.tagName !== 'INPUT') return;
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!quickFilter) return;

    const value = String(checkbox.getAttribute('data-filter-value') || '').trim();
    if (!value) return;

    const optionByValue = new Map(Array.from(quickFilter.options || []).map((option) => [String(option.value), option]));
    const allOption = optionByValue.get('all');

    if (value === 'all' && checkbox.checked) {
        Array.from(optionByValue.values()).forEach((option) => {
            option.selected = option.value === 'all';
        });
        syncStudentQuickFilterMultiUI();
        quickFilter.dispatchEvent(new Event('change'));
        return;
    }

    const option = optionByValue.get(value);
    if (option) option.selected = checkbox.checked;
    if (checkbox.checked && allOption) allOption.selected = false;

    const selectedValues = getStudentQuickFilterSelectedValues(quickFilter);
    if (!selectedValues.length || (selectedValues.length === 1 && selectedValues[0] === 'all')) {
        if (allOption) allOption.selected = true;
    }

    syncStudentQuickFilterMultiUI();
    quickFilter.dispatchEvent(new Event('change'));
}

function buildStudentQuickFilterMultiMenu(forceRebuild = false) {
    const container = document.getElementById('studentQuickFilterMulti');
    const menu = document.getElementById('studentQuickFilterMenu');
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!container || !menu || !quickFilter) return;

    const signature = String(quickFilter.dataset.signature || '');
    const shouldRebuild = forceRebuild || menu.dataset.signature !== signature || !menu.children.length;
    if (!shouldRebuild) {
        syncStudentQuickFilterMultiUI();
        return;
    }

    const wasOpen = container.classList.contains('open');
    menu.innerHTML = '';

    const fragment = document.createDocumentFragment();
    Array.from(quickFilter.children || []).forEach((child) => {
        const tagName = String(child.tagName || '').toUpperCase();
        if (tagName === 'OPTION') {
            fragment.appendChild(createStudentQuickFilterMenuItem(child));
            return;
        }
        if (tagName === 'OPTGROUP') {
            const groupLabel = document.createElement('div');
            groupLabel.className = 'student-multifilter-group';
            groupLabel.textContent = child.label || '';
            fragment.appendChild(groupLabel);
            Array.from(child.children || []).forEach((option) => {
                fragment.appendChild(createStudentQuickFilterMenuItem(option));
            });
        }
    });

    menu.appendChild(fragment);
    menu.dataset.signature = signature;
    syncStudentQuickFilterMultiUI();

    if (wasOpen && !container.classList.contains('disabled')) {
        openStudentQuickFilterMultiMenu();
    } else {
        closeStudentQuickFilterMultiMenu();
    }

    // Keep clicks inside the menu from closing it.
    if (menu.dataset.bound !== '1') {
        menu.dataset.bound = '1';
        menu.addEventListener('click', (event) => event.stopPropagation());
    }
}

function createStudentQuickFilterMenuItem(optionElement) {
    const value = String(optionElement?.value || '').trim();
    const labelText = String(optionElement?.textContent || '').trim();

    const label = document.createElement('label');
    label.className = 'student-multifilter-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-filter-value', value);
    checkbox.checked = Boolean(optionElement?.selected);
    checkbox.addEventListener('change', handleStudentQuickFilterCheckboxToggle);

    const text = document.createElement('span');
    text.textContent = labelText || value || '-';

    label.appendChild(checkbox);
    label.appendChild(text);
    return label;
}

function getStudentStatusLabel(student) {
    if (isStudentStuckOff(student)) return 'Stuck Off';
    return isStudentTerminated(student) ? 'Terminated' : (student?.feesStatus || 'Pending');
}

function getStudentColumnSearchText(student, field) {
    if (!student) return '';
    if (field === 'status') return getStudentStatusLabel(student);
    if (field === 'campusName') return student.campusName || '-';
    if (field === 'dob') return `${student.dob || ''} ${formatDateForDisplay(student.dob)}`;
    return student[field] || '';
}

function openStudentColumnSearch(field, label) {
    const modal = document.getElementById('studentColumnSearchModal');
    const title = document.getElementById('studentColumnSearchTitle');
    const labelEl = document.getElementById('studentColumnSearchLabel');
    const input = document.getElementById('studentColumnSearchInput');
    const searchInput = document.getElementById('studentSearchInput');
    const previousValue = studentColumnSearchFilter?.field === field
        ? studentColumnSearchFilter.rawValue
        : (searchInput?.value || '');

    if (!modal || !input) {
        applyStudentColumnSearchValue(field, label, previousValue);
        return;
    }

    modal.dataset.field = field;
    modal.dataset.label = label;
    if (title) {
        title.innerHTML = `<span><i data-lucide="search"></i></span> Search ${label}`;
    }
    if (labelEl) labelEl.textContent = `Search ${label}`;
    input.value = previousValue || '';
    input.placeholder = `Enter ${label}`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

function closeStudentColumnSearchModal() {
    const modal = document.getElementById('studentColumnSearchModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

function applyStudentColumnSearchValue(field, label, value) {
    const searchInput = document.getElementById('studentSearchInput');

    const normalizedValue = String(value || '').trim();
    studentColumnSearchFilter = normalizedValue
        ? { field, label, rawValue: normalizedValue, value: normalizedValue.toLowerCase() }
        : null;

    if (searchInput) {
        searchInput.value = normalizedValue;
        searchInput.placeholder = studentColumnSearchFilter
            ? `Searching ${label}...`
            : 'Search';
    }

    renderStudents();
}

function applyStudentColumnSearch(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('studentColumnSearchModal');
    const input = document.getElementById('studentColumnSearchInput');
    const field = modal?.dataset?.field || '';
    const label = modal?.dataset?.label || 'Column';
    if (!field) return;
    applyStudentColumnSearchValue(field, label, input?.value || '');
    closeStudentColumnSearchModal();
}

function clearStudentColumnSearch() {
    const modal = document.getElementById('studentColumnSearchModal');
    const field = modal?.dataset?.field || studentColumnSearchFilter?.field || '';
    const label = modal?.dataset?.label || studentColumnSearchFilter?.label || 'Column';
    if (field) {
        applyStudentColumnSearchValue(field, label, '');
    }
    closeStudentColumnSearchModal();
}

function renderStudents(term = '') {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('studentSearchInput');
    const quickFilter = document.getElementById('studentQuickFilter');
    const loggedInUser = getLoggedInUser();
    const isBranchUser = loggedInUser?.role === 'Branch';
    const canEditStudents = !isBranchUser && canCurrentUserPerformAction('students', 'edit');
    const canDeleteStudents = !isBranchUser && canCurrentUserPerformAction('students', 'delete');

    if (typeof term !== 'string') {
        term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    } else {
        term = term.toLowerCase().trim();
    }

    const columnSearch = studentColumnSearchFilter;
    const activeSearchTerm = columnSearch ? columnSearch.value : term;
    populateStudentQuickFilterOptions();
    const selectedQuickValues = getStudentQuickFilterSelectedValues(quickFilter);
    const parsedFilters = parseStudentQuickFilterValues(selectedQuickValues);

    const genderSet = new Set(parsedFilters.genders.map((gender) => String(gender || '').toLowerCase()));
    let campusSet = new Set(parsedFilters.campuses.map((campus) => String(campus || '').toLowerCase()));
    const classSet = new Set(parsedFilters.classes.map((className) => String(className || '').toLowerCase()));
    const requireBelow5 = parsedFilters.below5;

    if (loggedInUser?.role === 'Branch' && loggedInUser.campusName) {
        campusSet = new Set([String(loggedInUser.campusName).toLowerCase()]);
    }

    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const filtered = students.filter(s =>
        (
            !activeSearchTerm ||
            (columnSearch
                ? String(getStudentColumnSearchText(s, columnSearch.field)).toLowerCase().includes(activeSearchTerm)
                : (
                    (s.fullName && s.fullName.toLowerCase().includes(activeSearchTerm)) ||
                    (s.rollNo && s.rollNo.toString().toLowerCase().includes(activeSearchTerm)) ||
                    (s.studentCode && s.studentCode.toLowerCase().includes(activeSearchTerm))
                ))
        ) &&
        (genderSet.size === 0 || genderSet.has(String(s.gender || '').toLowerCase())) &&
        (!requireBelow5 || isStudentBelowAge(s, 5)) &&
        (classSet.size === 0 || classSet.has(String(s.classGrade || '').toLowerCase())) &&
        (campusSet.size === 0 || campusSet.has(String(s.campusName || '').toLowerCase())) &&
        !isStudentTerminated(s)
    );

    // Update total count display - Use filtered results length as requested
    const totalCountEl = document.getElementById('totalStudentCount');
    if (totalCountEl) totalCountEl.innerText = filtered.length;

    tbody.innerHTML = '';
    const noData = document.getElementById('noDataMessage');

    if (filtered.length === 0) {
        if (noData) noData.style.display = 'block';
    } else {
        if (noData) noData.style.display = 'none';
        filtered.forEach(s => {
            const terminated = isStudentTerminated(s);
            const statusLabel = getStudentStatusLabel(s);
            let statusClass = terminated
                ? 'status-failed'
                : (s.feesStatus === 'Paid' ? 'status-paid' : (s.feesStatus === 'Late' ? 'status-failed' : 'status-pending'));
            const encodedStudent = encodeURIComponent(JSON.stringify(s));
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${s.studentCode || '-'}</b></td>
                <td><b>${s.rollNo}</b></td>
                <td><div class="student-name-cell">
                    <div class="student-avatar">${buildStudentAvatarMarkup(s)}</div>
                    <div class="student-name-text">${s.fullName}</div>
                </div></td>
                <td class="cell-compact">${s.fatherName || '-'}</td>
                <td>${formatDateForDisplay(s.dob)}</td>
                <td class="cell-compact">${s.classGrade}</td>
                <td class="cell-compact">${s.campusName || '-'}</td>
                <td>${s.gender || '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><div class="table-action-wrap">
                    <select class="table-action-select" onchange="handleStudentActionSelect(this, '${encodedStudent}', '${s.id}', ${isBranchUser ? 1 : 0})">
                        <option value="">Actions</option>
                        <option value="view">View</option>
                        ${s.email ? '<option value="email">Send Email</option>' : ''}
                        ${canEditStudents ? '<option value="edit">Edit</option>' : ''}
                        ${canEditStudents ? (terminated ? '<option value="reactivate">Reactivate</option>' : '<option value="stuckoff">Stuck-Off</option>') : ''}
                        ${canDeleteStudents ? '<option value="delete">Delete</option>' : ''}
                    </select>
                </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
    }
}

function showAdminRecordsSection(sectionKey = '') {
    const select = document.getElementById('adminRecordsSelect');
    if (select && select.value !== sectionKey) select.value = sectionKey;

    const sections = {
        stuckoff: document.getElementById('stuckoffRecordSection'),
        resigned: document.getElementById('resignedRecordSection'),
        alumni: document.getElementById('alumniRecordSection')
    };

    Object.entries(sections).forEach(([key, section]) => {
        if (section) section.classList.toggle('active', key === sectionKey);
    });

    renderAdminRecordPanels();
}

function handleStudentAdminRecordHash() {
    if (!isCurrentPage('students.html')) return;
    const sectionKey = String(window.location.hash || '').replace('#', '');
    if (!['stuckoff', 'resigned', 'alumni'].includes(sectionKey)) return;

    showAdminRecordsSection(sectionKey);
    document.querySelector('.admin-records-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAdminRecordPanels() {
    renderStuckOffStudents();
    renderResignedTeachers();
    renderAlumniRecords();
}

function renderStuckOffStudents() {
    const container = document.getElementById('stuckoffStudentsList');
    if (!container) return;

    const students = getArrayData(STORAGE_KEY_STUDENTS).filter(isStudentTerminated);
    if (!students.length) {
        container.innerHTML = '<div class="admin-record-empty">No stuck off students found.</div>';
        return;
    }

    container.innerHTML = `
        <table class="admin-record-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Campus</th>
                    <th>Stuck Off Date</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${students.map((student) => `
                    <tr>
                        <td><strong>${escapeHtml(student.fullName || '-')}</strong><br><span style="color:var(--text-secondary);">${escapeHtml(student.studentCode || student.rollNo || '-')}</span></td>
                        <td>${escapeHtml(student.classGrade || '-')}</td>
                        <td>${escapeHtml(student.campusName || '-')}</td>
                        <td>${escapeHtml(formatDateForDisplay(student.stuckOffAt || student.terminatedAt) || '-')}</td>
                        <td><button type="button" class="action-btn btn-edit" onclick="reactivateStudent('${student.id}')">Unmark</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getStuckOffStudentRecords() {
    return getArrayData(STORAGE_KEY_STUDENTS)
        .filter(isStudentTerminated)
        .map((student) => ({
            type: 'Student',
            id: student.id,
            code: student.studentCode || student.rollNo || '-',
            name: student.fullName || '-',
            detail: student.classGrade || '-',
            campus: student.campusName || '-',
            date: student.stuckOffAt || student.terminatedAt || '',
            reason: student.terminationNote || '',
            status: getStudentStatusLabel(student),
            action: `reactivateStudent('${String(student.id).replace(/'/g, "\\'")}')`
        }));
}

function getStuckOffTeacherRecords() {
    return getArrayData(STORAGE_KEY_TEACHERS)
        .filter(isTeacherStuckOff)
        .map((teacher) => ({
            type: 'Teacher',
            id: teacher.id,
            code: teacher.employeeCode || teacher.id || '-',
            name: teacher.fullName || '-',
            detail: teacher.subject || teacher.designation || '-',
            campus: teacher.campusName || '-',
            date: teacher.stuckOffAt || '',
            reason: teacher.stuckOffNote || '',
            status: 'Stuck Off',
            action: `reactivateTeacher('${String(teacher.id).replace(/'/g, "\\'")}')`
        }));
}

function renderStuckOffPage() {
    const tbody = document.getElementById('stuckOffRecordsBody');
    if (!tbody) return;

    const typeFilter = document.getElementById('stuckOffTypeFilter')?.value || 'all';
    const searchTerm = String(document.getElementById('stuckOffSearchInput')?.value || '').trim().toLowerCase();
    const emptyState = document.getElementById('stuckOffEmptyState');
    const totalEl = document.getElementById('stuckOffTotalCount');
    const studentCountEl = document.getElementById('stuckOffStudentCount');
    const teacherCountEl = document.getElementById('stuckOffTeacherCount');

    const students = getStuckOffStudentRecords();
    const teachers = getStuckOffTeacherRecords();
    let records = [...students, ...teachers];

    if (typeFilter === 'students') records = students;
    if (typeFilter === 'teachers') records = teachers;

    if (searchTerm) {
        records = records.filter((record) => (
            record.name.toLowerCase().includes(searchTerm) ||
            record.code.toLowerCase().includes(searchTerm) ||
            record.detail.toLowerCase().includes(searchTerm) ||
            record.campus.toLowerCase().includes(searchTerm)
        ));
    }

    records.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.name.localeCompare(b.name));

    if (totalEl) totalEl.textContent = records.length;
    if (studentCountEl) studentCountEl.textContent = students.length;
    if (teacherCountEl) teacherCountEl.textContent = teachers.length;

    if (!records.length) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = records.map((record) => `
        <tr>
            <td><span class="record-type-pill ${record.type === 'Teacher' ? 'teacher' : 'student'}">${escapeHtml(record.type)}</span></td>
            <td><strong>${escapeHtml(record.name)}</strong><br><span class="muted-text">${escapeHtml(record.code)}</span></td>
            <td>${escapeHtml(record.detail)}</td>
            <td>${escapeHtml(record.campus)}</td>
            <td>${escapeHtml(formatDateForDisplay(record.date) || '-')}</td>
            <td><span class="status-badge status-failed">${escapeHtml(record.status)}</span></td>
            <td>${escapeHtml(record.reason || '-')}</td>
            <td><button type="button" class="action-btn btn-edit" onclick="${record.action}">Reactivate</button></td>
        </tr>
    `).join('');
}

function isTeacherResigned(teacher) {
    return teacher?.resigned === true || String(teacher?.employmentStatus || '').toLowerCase() === 'resigned';
}

function markTeacherStuckOff(teacherId) {
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const index = teachers.findIndex((teacher) => String(teacher.id) === String(teacherId));
    if (index === -1) return;

    const teacher = teachers[index];
    if (isTeacherStuckOff(teacher)) {
        showAppAlert('Teacher is already marked as stuck off.', 'No Changes');
        return;
    }

    const confirmText = `Mark "${teacher.fullName || 'Teacher'}" as stuck off?\n\nThis teacher will be removed from the active teacher list and shown in Stuck Off records.`;
    const ok = typeof showAppConfirm === 'function' ? showAppConfirm(confirmText) : Promise.resolve(window.confirm(confirmText));

    Promise.resolve(ok).then(async (confirmed) => {
        if (!confirmed) return;

        const today = new Date().toISOString().slice(0, 10);
        const updatedTeacher = {
            ...teacher,
            employmentStatus: 'Stuck Off',
            stuckOffAt: today,
            stuckOffNote: teacher.stuckOffNote || ''
        };

        teachers[index] = updatedTeacher;
        saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
        await syncToSQLDetailed('teachers', [updatedTeacher]).catch(() => null);
        pushNotification('Teacher Updated', `"${updatedTeacher.fullName || 'Teacher'}" marked as stuck off.`, 'info');
        renderTeachers();
        renderAdminRecordPanels();
        renderStuckOffPage();
    }).catch(() => {});
}

function reactivateTeacher(teacherId) {
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const index = teachers.findIndex((teacher) => String(teacher.id) === String(teacherId));
    if (index === -1) return;

    const teacher = teachers[index];
    if (!isTeacherStuckOff(teacher) && !isTeacherResigned(teacher)) {
        showAppAlert('Teacher is already active.', 'No Changes');
        return;
    }

    const confirmText = `Reactivate "${teacher.fullName || 'Teacher'}"?`;
    const ok = typeof showAppConfirm === 'function' ? showAppConfirm(confirmText) : Promise.resolve(window.confirm(confirmText));

    Promise.resolve(ok).then(async (confirmed) => {
        if (!confirmed) return;

        const updatedTeacher = {
            ...teacher,
            resigned: false,
            employmentStatus: 'Active',
            stuckOffAt: '',
            stuckOffNote: '',
            resignedAt: ''
        };

        teachers[index] = updatedTeacher;
        saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
        await syncToSQLDetailed('teachers', [updatedTeacher]).catch(() => null);
        pushNotification('Teacher Updated', `"${updatedTeacher.fullName || 'Teacher'}" is active again.`, 'success');
        renderTeachers();
        renderAdminRecordPanels();
        renderStuckOffPage();
    }).catch(() => {});
}

function renderResignedTeachers() {
    const container = document.getElementById('resignedTeachersList');
    if (!container) return;

    let teachers = getArrayData(STORAGE_KEY_TEACHERS);
    if (!teachers.length) {
        container.innerHTML = '<div class="admin-record-empty">No teachers found.</div>';
        return;
    }

    container.innerHTML = `
        <table class="admin-record-table">
            <thead>
                <tr>
                    <th>Teacher</th>
                    <th>Subject</th>
                    <th>Campus</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${teachers.map((teacher) => {
                    const resigned = isTeacherResigned(teacher);
                    return `
                        <tr>
                            <td><strong>${escapeHtml(teacher.fullName || '-')}</strong><br><span style="color:var(--text-secondary);">${escapeHtml(teacher.employeeCode || teacher.id || '-')}</span></td>
                            <td>${escapeHtml(teacher.subject || '-')}</td>
                            <td>${escapeHtml(teacher.campusName || '-')}</td>
                            <td><span class="status-badge ${resigned ? 'status-failed' : 'status-paid'}">${resigned ? 'Resigned' : 'Active'}</span></td>
                            <td>
                                <button type="button" class="action-btn ${resigned ? 'btn-edit' : 'btn-delete'}" onclick="toggleTeacherResignedStatus('${teacher.id}', ${resigned ? 'false' : 'true'})">
                                    ${resigned ? 'Unmark' : 'Mark Resigned'}
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function toggleTeacherResignedStatus(teacherId, shouldResign) {
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const index = teachers.findIndex((teacher) => String(teacher.id) === String(teacherId));
    if (index === -1) return;

    teachers[index] = {
        ...teachers[index],
        resigned: Boolean(shouldResign),
        employmentStatus: shouldResign ? 'Resigned' : 'Active',
        resignedAt: shouldResign ? new Date().toISOString().slice(0, 10) : ''
    };

    saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
    renderResignedTeachers();
    if (typeof renderTeachers === 'function') renderTeachers();
    showSuccessModal(shouldResign ? 'Teacher Marked Resigned!' : 'Teacher Unmarked!', shouldResign
        ? `${teachers[index].fullName || 'Teacher'} has been marked as resigned.`
        : `${teachers[index].fullName || 'Teacher'} is active again.`);
}

function bindAlumniForm() {
    const form = document.getElementById('alumniForm');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const alumni = getData(STORAGE_KEY_ALUMNI);
        const record = {
            id: generateUniqueRecordId('ALM'),
            teacherName: document.getElementById('alumniTeacherName')?.value.trim() || '',
            post: document.getElementById('alumniPost')?.value.trim() || '',
            organization: document.getElementById('alumniOrganization')?.value.trim() || '',
            contact: document.getElementById('alumniContact')?.value.trim() || '',
            remarks: document.getElementById('alumniRemarks')?.value.trim() || '',
            createdAt: new Date().toISOString()
        };

        if (!record.teacherName || !record.post) {
            showAppAlert('Teacher name and current post are required.', 'Missing Alumni Detail');
            return;
        }

        alumni.push(record);
        localStorage.setItem(STORAGE_KEY_ALUMNI, JSON.stringify(alumni));
        form.reset();
        renderAlumniRecords();
        showSuccessModal('Alumni Added!', `${record.teacherName} has been added to alumni records.`);
    });
}

function renderAlumniRecords() {
    const container = document.getElementById('alumniList');
    if (!container) return;

    const alumni = getData(STORAGE_KEY_ALUMNI);
    if (!alumni.length) {
        container.innerHTML = '<div class="admin-record-empty">No alumni records added yet.</div>';
        return;
    }

    container.innerHTML = `
        <table class="admin-record-table">
            <thead>
                <tr>
                    <th>Teacher</th>
                    <th>Current Post</th>
                    <th>Organization</th>
                    <th>Contact</th>
                    <th>Remarks</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${alumni.map((record) => `
                    <tr>
                        <td><strong>${escapeHtml(record.teacherName || '-')}</strong></td>
                        <td>${escapeHtml(record.post || '-')}</td>
                        <td>${escapeHtml(record.organization || '-')}</td>
                        <td>${escapeHtml(record.contact || '-')}</td>
                        <td>${escapeHtml(record.remarks || '-')}</td>
                        <td><button type="button" class="action-btn btn-delete" onclick="deleteAlumniRecord('${record.id}')">Delete</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function deleteAlumniRecord(recordId) {
    const alumni = getData(STORAGE_KEY_ALUMNI).filter((record) => String(record.id) !== String(recordId));
    localStorage.setItem(STORAGE_KEY_ALUMNI, JSON.stringify(alumni));
    renderAlumniRecords();
}

function printStudentsList() {
    if (!isCurrentPage('students.html')) {
        window.print();
        return;
    }

    const searchInput = document.getElementById('studentSearchInput');
    const quickFilter = document.getElementById('studentQuickFilter');
    const printModeEl = document.getElementById('studentPrintMode');
    const loggedInUser = getLoggedInUser();

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));

    populateStudentQuickFilterOptions();

    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const selectedQuickValues = getStudentQuickFilterSelectedValues(quickFilter);
    const parsedFilters = parseStudentQuickFilterValues(selectedQuickValues);

    const printModeRaw = String(printModeEl ? printModeEl.value : (localStorage.getItem('eduCore_student_print_mode') || 'school')).trim().toLowerCase();
    const printMode = (printModeRaw === 'outer' || printModeRaw === 'school') ? printModeRaw : 'school';
    if (printModeEl && printModeEl.value !== printMode) printModeEl.value = printMode;
    localStorage.setItem('eduCore_student_print_mode', printMode);

    const genderSet = new Set(parsedFilters.genders.map((gender) => String(gender || '').toLowerCase()));
    let campusSet = new Set(parsedFilters.campuses.map((campus) => String(campus || '').toLowerCase()));
    const classSet = new Set(parsedFilters.classes.map((className) => String(className || '').toLowerCase()));
    const requireBelow5 = parsedFilters.below5;

    if (loggedInUser?.role === 'Branch' && loggedInUser.campusName) {
        campusSet = new Set([String(loggedInUser.campusName).toLowerCase()]);
    }

    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const filtered = students
        .filter((s) =>
            (
                !term ||
                (s.fullName && s.fullName.toLowerCase().includes(term)) ||
                (s.rollNo && s.rollNo.toString().toLowerCase().includes(term)) ||
                (s.studentCode && s.studentCode.toLowerCase().includes(term))
            ) &&
            (genderSet.size === 0 || genderSet.has(String(s.gender || '').toLowerCase())) &&
            (!requireBelow5 || isStudentBelowAge(s, 5)) &&
            (classSet.size === 0 || classSet.has(String(s.classGrade || '').toLowerCase())) &&
            (campusSet.size === 0 || campusSet.has(String(s.campusName || '').toLowerCase()))
        )
        .sort((a, b) => {
            const rollA = Number.parseInt(String(a.rollNo || ''), 10);
            const rollB = Number.parseInt(String(b.rollNo || ''), 10);
            const rollAValid = Number.isFinite(rollA);
            const rollBValid = Number.isFinite(rollB);
            if (rollAValid && rollBValid && rollA !== rollB) return rollA - rollB;
            if (rollAValid !== rollBValid) return rollAValid ? -1 : 1;
            return String(a.fullName || '').localeCompare(String(b.fullName || ''));
        });

    const settings = getData(STORAGE_KEY_SETTINGS) || {};
    const schoolName = settings.schoolName || 'Student List';
    const printedAt = new Date().toLocaleString();
    const modeLabel = printMode === 'outer' ? 'Outer Student List' : 'School Student List';

    const formatDateSafe = (value) => {
        try {
            return escapeHtml(formatDateForDisplay(value));
        } catch (_error) {
            return escapeHtml(value || '-');
        }
    };

    const rowsMarkup = filtered.length
        ? filtered.map((s, idx) => {
            if (printMode === 'outer') {
                return `
                    <tr>
                        <td class="num">${idx + 1}</td>
                        <td>${escapeHtml(s.fullName || '-')}</td>
                        <td>${escapeHtml(s.fatherName || '-')}</td>
                        <td>${escapeHtml(s.parentPhone || '-')}</td>
                        <td>${escapeHtml(s.rollNo || '-')}</td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td class="num">${idx + 1}</td>
                    <td>${escapeHtml(s.studentCode || '-')}</td>
                    <td>${escapeHtml(s.rollNo || '-')}</td>
                    <td>${escapeHtml(s.fullName || '-')}</td>
                    <td>${escapeHtml(s.fatherName || '-')}</td>
                    <td>${escapeHtml(s.parentPhone || '-')}</td>
                    <td>${formatDateSafe(s.dob)}</td>
                    <td>${formatDateSafe(s.admissionDate)}</td>
                    <td>${escapeHtml(s.classGrade || '-')}</td>
                    <td>${escapeHtml(s.campusName || '-')}</td>
                    <td>${escapeHtml(s.gender || '-')}</td>
                </tr>
            `;
        }).join('')
        : `<tr><td colspan="${printMode === 'outer' ? 5 : 11}" class="empty">No students match the current filter.</td></tr>`;

    const html = `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${escapeHtml(schoolName)} - Students</title>
            <style>
                :root { color-scheme: light; }
                @page { size: ${printMode === 'school' ? 'A4 landscape' : 'A4'}; margin: 12mm; }
                body { font-family: Arial, sans-serif; color: #111827; }
                .header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
                .title { font-size: 18px; font-weight: 700; }
                .meta { font-size: 12px; color: #475569; }
                table { width: 100%; border-collapse: collapse; font-size: ${printMode === 'school' ? '10px' : '12px'}; }
                th, td { border: 1px solid #64748b; padding: 6px 8px; }
                th { background: #f1f5f9; text-align: left; }
                td.num { width: 30px; text-align: center; }
                td.empty { text-align: center; color: #475569; padding: 16px 8px; }
                .nowrap { white-space: nowrap; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">${escapeHtml(schoolName)}</div>
                    <div class="meta">${escapeHtml(modeLabel)}</div>
                </div>
                <div class="meta">Printed: ${escapeHtml(printedAt)} | Total: ${filtered.length}</div>
            </div>
            <table>
                <thead>
                    ${printMode === 'outer'
        ? `
                        <tr>
                            <th style="width:30px;">#</th>
                            <th>Student Name</th>
                            <th>Father Name</th>
                            <th>Contact No</th>
                            <th style="width:70px;">Roll No</th>
                        </tr>
                    `
        : `
                        <tr>
                            <th style="width:30px;">#</th>
                            <th class="nowrap">Student ID</th>
                            <th class="nowrap">Roll No</th>
                            <th>Student Name</th>
                            <th>Father Name</th>
                            <th class="nowrap">Contact No</th>
                            <th class="nowrap">DOB</th>
                            <th class="nowrap">Admission Date</th>
                            <th>Class</th>
                            <th>Campus</th>
                            <th>Gender</th>
                        </tr>
                    `}
                </thead>
                <tbody>
                    ${rowsMarkup}
                </tbody>
            </table>
            <script>
                window.focus();
                window.print();
                window.onafterprint = () => window.close();
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', 'eduCoreStudentPrint', 'width=1000,height=700');
    if (!printWindow) {
        alert('Popup blocked. Please allow popups to print the student list.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function populateStudentQuickFilterOptions() {
    const quickFilter = document.getElementById('studentQuickFilter');
    if (!quickFilter) return;
    bindStudentQuickFilterMultiSelect();

    const previousSelected = getStudentQuickFilterSelectedValues(quickFilter);
    const loggedInUser = getLoggedInUser();

    const students = getArrayData(STORAGE_KEY_STUDENTS);
    const campusMap = new Map();
    const classMap = new Map();
    [...DEFAULT_CAMPUS_NAMES,
        ...studentQuickFilterBranchCampuses,
        ...students.map((student) => String(student.campusName || '').trim())
    ]
        .forEach((campusName) => {
            const normalized = String(campusName || '').trim();
            if (!normalized) return;
            const key = normalized.toLowerCase();
            if (!campusMap.has(key)) campusMap.set(key, normalized);
        });

    [
        ...getData(STORAGE_KEY_CLASSES).map((item) => String(item?.name || '').trim()),
        ...students.map((student) => String(student.classGrade || '').trim())
    ]
        .forEach((className) => {
            const normalized = String(className || '').trim();
            if (!normalized) return;
            const key = normalized.toLowerCase();
            if (!classMap.has(key)) classMap.set(key, normalized);
        });

    if (loggedInUser?.role === 'Branch' && loggedInUser.campusName) {
        const normalizedBranchCampus = String(loggedInUser.campusName || '').trim();
        if (normalizedBranchCampus) {
            const key = normalizedBranchCampus.toLowerCase();
            if (!campusMap.has(key)) campusMap.set(key, normalizedBranchCampus);
        }
    }

    const campuses = Array.from(campusMap.values()).sort((a, b) => a.localeCompare(b));
    const classes = Array.from(classMap.values()).sort(compareStudentClassNames);
    const signature = [
        `campuses:${campuses.map((name) => String(name || '').toLowerCase()).join('|')}`,
        `classes:${classes.map((name) => String(name || '').toLowerCase()).join('|')}`
    ].join('||');
    const needsRebuild = quickFilter.dataset.signature !== signature || !quickFilter.options.length;

    if (needsRebuild) {
        quickFilter.innerHTML = `
            <option value="all">All Students</option>
            <option value="gender:Male">Male Students</option>
            <option value="gender:Female">Female Students</option>
            <option value="gender:Other">Other Gender</option>
            <option value="age:below5">Below 5 Years</option>
        `;

        if (campuses.length) {
            const campusGroup = document.createElement('optgroup');
            campusGroup.label = 'Campus';
            campuses.forEach((campusName) => {
                const option = document.createElement('option');
                option.value = `campus:${campusName}`;
                option.textContent = campusName;
                campusGroup.appendChild(option);
            });
            quickFilter.appendChild(campusGroup);
        }

        if (classes.length) {
            const classGroup = document.createElement('optgroup');
            classGroup.label = 'Classes';
            classes.forEach((className) => {
                const option = document.createElement('option');
                option.value = `class:${className}`;
                option.textContent = getStudentQuickFilterClassLabel(className);
                classGroup.appendChild(option);
            });
            quickFilter.appendChild(classGroup);
        }

        quickFilter.dataset.signature = signature;
    }

    const container = document.getElementById('studentQuickFilterMulti');
    const trigger = document.getElementById('studentQuickFilterTrigger');

    if (loggedInUser?.role === 'Branch' && loggedInUser.campusName) {
        const campusValue = `campus:${loggedInUser.campusName}`;
        setStudentQuickFilterSelectedValues([campusValue]);
        quickFilter.disabled = true;
        if (trigger) trigger.disabled = true;
        if (container) container.classList.add('disabled');
        buildStudentQuickFilterMultiMenu(needsRebuild);
        return;
    }

    quickFilter.disabled = false;
    if (trigger) trigger.disabled = false;
    if (container) container.classList.remove('disabled');

    setStudentQuickFilterSelectedValues(previousSelected);
    buildStudentQuickFilterMultiMenu(needsRebuild);
}

function populateQuickStudentFilters() {
    populateStudentQuickFilterOptions();
}

async function loadStudentQuickFilterBranchCampuses() {
    try {
        const response = await fetch(`${API_BASE_URL}/branches`);
        const responseText = await response.text();
        const branches = responseText ? JSON.parse(responseText) : [];

        if (!response.ok || !Array.isArray(branches)) {
            throw new Error('Branch campuses unavailable.');
        }

        studentQuickFilterBranchCampuses = branches
            .map((branch) => String(branch?.campusName || '').trim())
            .filter(Boolean);
        renderStudents();
    } catch (error) {
        studentQuickFilterBranchCampuses = [];
    }
}

function editStudent(s) {
    toggleStudentForm(true);
    document.getElementById('studentId').value = s.id;
    document.getElementById('studentCode').value = s.studentCode || '';
    document.getElementById('fullName').value = s.fullName;
    document.getElementById('fatherName').value = s.fatherName || '';
    if (document.getElementById('studentDob')) document.getElementById('studentDob').value = s.dob || '';
    if (document.getElementById('admissionDate')) document.getElementById('admissionDate').value = normalizeDateInputValue(s.admissionDate || s.createdAt || '');
    document.getElementById('classGrade').value = s.classGrade;
    document.getElementById('campusName').value = s.campusName || '';
    document.getElementById('parentPhone').value = s.parentPhone;
    if (document.getElementById('guardianName')) document.getElementById('guardianName').value = s.guardianName || '';
    if (document.getElementById('guardianContact')) document.getElementById('guardianContact').value = s.guardianContact || '';
    if (document.getElementById('studentEmail')) document.getElementById('studentEmail').value = s.email || '';
    document.getElementById('gender').value = s.gender || '';
    document.getElementById('rollNo').value = s.rollNo;
    document.getElementById('formB').value = s.formB || '';
    if (document.getElementById('studentFingerprintData')) document.getElementById('studentFingerprintData').value = s.fingerprintData || '';
    if (document.getElementById('studentFamilyName')) document.getElementById('studentFamilyName').value = s.familyName || '';
    if (document.getElementById('studentFamilyNo')) document.getElementById('studentFamilyNo').value = s.familyNo || '';
    if (document.getElementById('studentFamilyContact')) document.getElementById('studentFamilyContact').value = s.familyContact || '';
    if (document.getElementById('monthlyFee')) document.getElementById('monthlyFee').value = s.monthlyFee || '0';
    if (document.getElementById('monthlyFee')) document.getElementById('monthlyFee').dataset.autoClassFee = '';
    if (document.getElementById('feeFrequency')) document.getElementById('feeFrequency').value = s.feeFrequency || 'Monthly';
    applyClassFeeDefaultToStudentForm();
    if (document.getElementById('username')) document.getElementById('username').value = s.username || '';
    if (document.getElementById('studentPassword')) document.getElementById('studentPassword').value = getVisibleStudentPassword(s);
    if (document.getElementById('studentProfileImage')) document.getElementById('studentProfileImage').value = '';
    setStudentPhotoPreview(s.profileImage || '', s.fullName || '');
}

async function deleteStudent(id) {
    if (!canCurrentUserPerformAction('students', 'delete')) {
        showAppAlert('You do not have permission to delete students.', 'Permission Denied');
        return;
    }
    if (!(await showAppConfirm('Delete this student?'))) return;

    let students = getArrayData(STORAGE_KEY_STUDENTS);
    const existingStudents = [...students];
    students = students.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    renderStudents();

    try {
        const token = sessionStorage.getItem('eduCore_token') || '';
        const response = await fetch(`${API_BASE_URL}/students/${id}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (response.status === 503) {
            pushNotification('Student Deleted', 'The student was deleted from the local list because the server is offline.', 'user');
            return;
        }

        const responseText = await response.text();
        let result = null;

        try {
            result = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
            throw new Error('The server is still running an older version. Restart it with `node server.js` and try deleting again.');
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Student delete failed.');
        }

        pushNotification('Student Deleted', result.message || 'Student deleted successfully.', 'user');
    } catch (error) {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(existingStudents));
        renderStudents();
        alert(error.message);
    }
}


// =======================================================
// ==================== TEACHER LOGIC ====================
// =======================================================

function toggleTeacherForm(editMode = false) {
    const container = document.getElementById('teacherFormContainer');
    const form = document.getElementById('teacherForm');
    const title = document.getElementById('teacherFormTitle');

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('teacherId').value = '';
    } else {
        container.style.display = 'block';
        // Reset Panels
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.action-step-btn').forEach(b => b.classList.remove('active'));

        if (!editMode) {
            form.reset();
            document.getElementById('teacherId').value = '';
            const teacherCodeField = document.getElementById('teacherCode');
            if (teacherCodeField) teacherCodeField.value = generateEntityCode(STORAGE_KEY_TEACHERS, 'TCH');
            title.innerText = 'Add New Teacher';
        } else {
            title.innerText = 'Edit Teacher Details';
        }
    }
}

function validateTeacherRequiredFields() {
    const requiredFields = [
        ['tFullName', 'Full Name'],
        ['tFatherName', "Father's Name"],
        ['tDob', 'Date of Birth'],
        ['tCnic', 'CNIC'],
        ['tAddress', 'Address'],
        ['tQualification', 'Qualification'],
        ['tCampusName', 'Campus'],
        ['tGender', 'Gender'],
        ['tDesignation', 'Designation'],
        ['tSubject', 'Subject']
    ];

    const missingField = requiredFields.find(([fieldId]) => {
        const field = document.getElementById(fieldId);
        return field && !String(field.value || '').trim();
    });

    if (!missingField) return '';

    const field = document.getElementById(missingField[0]);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus();
    return `${missingField[1]} is required.`;
}

function isStorageQuotaError(error) {
    return error?.name === 'QuotaExceededError' ||
        error?.code === 22 ||
        String(error?.message || '').toLowerCase().includes('quota');
}

function saveStudentsWithLocalFallback(students, newStudent) {
    try {
        saveData(STORAGE_KEY_STUDENTS, students, { skipSync: true });
        return { students, student: newStudent, strippedProfileImage: false };
    } catch (error) {
        if (!isStorageQuotaError(error)) throw error;

        const compactStudent = {
            ...newStudent,
            profileImage: ''
        };
        const compactStudents = students.map((student) => (
            student.id === compactStudent.id
                ? compactStudent
                : student
        ));

        saveData(STORAGE_KEY_STUDENTS, compactStudents, { skipSync: true });
        return { students: compactStudents, student: compactStudent, strippedProfileImage: true };
    }
}

function saveTeachersWithLocalFallback(teachers, newTeacher) {
    try {
        saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
        return { teachers, teacher: newTeacher, strippedDocuments: false, strippedProfileImage: false };
    } catch (error) {
        if (!isStorageQuotaError(error)) throw error;

        const compactTeacher = {
            ...newTeacher,
            idCardFront: null,
            idCardBack: null,
            cvFile: null
        };
        const compactTeachers = teachers.map((teacher) => (
            teacher.id === compactTeacher.id
                ? compactTeacher
                : {
                    ...teacher,
                    idCardFront: null,
                    idCardBack: null,
                    cvFile: null
            }
        ));

        try {
            saveData(STORAGE_KEY_TEACHERS, compactTeachers, { skipSync: true });
            return { teachers: compactTeachers, teacher: compactTeacher, strippedDocuments: true, strippedProfileImage: false };
        } catch (secondError) {
            if (!isStorageQuotaError(secondError)) throw secondError;

            const minimalTeacher = {
                ...compactTeacher,
                profileImage: ''
            };
            const minimalTeachers = compactTeachers.map((teacher) => (
                teacher.id === minimalTeacher.id
                    ? minimalTeacher
                    : {
                        ...teacher,
                        profileImage: ''
                    }
            ));

            saveData(STORAGE_KEY_TEACHERS, minimalTeachers, { skipSync: true });
            return { teachers: minimalTeachers, teacher: minimalTeacher, strippedDocuments: true, strippedProfileImage: true };
        }
    }
}

function clearTeacherListFilters() {
    const searchInput = document.getElementById('teacherSearchInput');
    const campusFilter = document.getElementById('teacherCampusFilter');
    const genderFilter = document.getElementById('teacherGenderFilter');

    if (searchInput) searchInput.value = '';
    if (campusFilter) campusFilter.value = '';
    if (genderFilter) genderFilter.value = '';
}

async function handleTeacherFormSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('teacherId');
    const isEdit = idField.value !== '';

    const usernameInput = document.getElementById('tUsername').value;
    const tPasswordInput = document.getElementById('tPassword').value;
    const salaryValInput = document.getElementById('tSalary').value || '0';
    const teacherEmailInput = document.getElementById('tEmail') ? document.getElementById('tEmail').value.trim() : '';

    // Validation
    if (!usernameInput || !tPasswordInput) {
        alert('Please create login credentials for the teacher.');
        if (!document.getElementById('credPanel').classList.contains('active')) toggleStepPanel('credPanel');
        return;
    }
    if (!salaryValInput || salaryValInput === '0') {
        alert('Please set the teacher salary.');
        if (!document.getElementById('salaryPanel').classList.contains('active')) toggleStepPanel('salaryPanel');
        return;
    }

    const teacherIdentityError = validateTeacherIdentityInputs({
        teacherId: idField.value,
        username: usernameInput,
        email: teacherEmailInput
    });

    if (teacherIdentityError) {
        alert(teacherIdentityError);
        return;
    }

    const teachers = getData(STORAGE_KEY_TEACHERS);
    const existingTeacher = isEdit ? teachers.find(t => t.id === idField.value) : null;

    let idCardFront = existingTeacher?.idCardFront || null;
    let idCardBack = existingTeacher?.idCardBack || null;
    let cvFile = existingTeacher?.cvFile || null;
    let profileImage = existingTeacher?.profileImage || '';

    try {
        idCardFront = await getOptionalFilePayload('tIdCardFront', idCardFront);
        idCardBack = await getOptionalFilePayload('tIdCardBack', idCardBack);
        cvFile = await getOptionalFilePayload('tCvFile', cvFile);
    } catch (error) {
        alert(error.message);
        return;
    }

    const newTeacher = {
        id: isEdit ? idField.value : generateUniqueRecordId('TCH'),
        employeeCode: document.getElementById('teacherCode').value || generateEntityCode(STORAGE_KEY_TEACHERS, 'TCH'),
        fullName: document.getElementById('tFullName').value,
        fatherName: document.getElementById('tFatherName').value,
        dob: document.getElementById('tDob').value,
        cnic: document.getElementById('tCnic').value,
        profileImage,
        phone: document.getElementById('tPhone').value,
        email: teacherEmailInput,
        address: document.getElementById('tAddress').value,
        qualification: document.getElementById('tQualification').value,
        campusName: document.getElementById('tCampusName').value,
        gender: document.getElementById('tGender').value,
        designation: document.getElementById('tDesignation')?.value || 'Teacher',
        groupKey: getDesignationGroup('tDesignation', 'teacher'),
        subject: document.getElementById('tSubject').value,
        fingerprintData: document.getElementById('tFingerprintData') ? document.getElementById('tFingerprintData').value.trim() : (existingTeacher?.fingerprintData || ''),
        salary: salaryValInput,
        username: usernameInput,
        plainPassword: tPasswordInput,
        password: tPasswordInput,
        idCardFront,
        idCardBack,
        cvFile,
        bankName: document.getElementById('tBankName').value.trim(),
        bankAccountTitle: document.getElementById('tBankAccountTitle').value.trim(),
        bankAccountNumber: document.getElementById('tBankAccountNumber').value.trim(),
        bankBranch: document.getElementById('tBankBranch').value.trim(),
        schedule: normalizeTeacherSchedule(existingTeacher?.schedule),
        employmentStatus: existingTeacher?.employmentStatus || 'Active',
        stuckOffAt: existingTeacher?.stuckOffAt || '',
        stuckOffNote: existingTeacher?.stuckOffNote || '',
        role: 'Teacher'
    };

    if (isEdit) {
        const index = teachers.findIndex(t => t.id === newTeacher.id);
        if (index !== -1) teachers[index] = newTeacher;
    } else {
        teachers.push(newTeacher);
    }

    saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
    const teacherSyncResult = await syncToSQLDetailed('teachers', [newTeacher]);

    if (!teacherSyncResult.success) {
        alert(teacherSyncResult.error || 'The teacher was saved to local storage, but database sync failed. Check the server and MySQL connection.');
    }

    pushNotification('Staff Updated', `Teacher account for "${newTeacher.fullName}" saved and activated.`, 'book');
    toggleTeacherForm();
    renderTeachers();
    showSuccessModal('Teacher Registered!', `Professor ${newTeacher.fullName}'s account is active. They can now access their portal.`);
}

function bindTeacherFormSubmit() {
    const teacherForm = document.getElementById('teacherForm');
    if (!teacherForm || teacherForm.dataset.submitBound === '1') return;
    teacherForm.dataset.submitBound = '1';
    teacherForm.onsubmit = (event) => {
        handleTeacherFormSubmit(event);
        return false;
    };
}

bindTeacherFormSubmit();

function getTeacherScheduleSummary(teacher) {
    const schedule = normalizeTeacherSchedule(teacher.schedule);
    if (!schedule.length) {
        return '<div style="font-size:0.75rem;color:var(--text-secondary);">No lectures assigned</div>';
    }

    const uniqueDays = [...new Set(schedule.map(item => item.day).filter(Boolean))];
    return `<div style="font-size:0.75rem;color:var(--text-secondary);">${schedule.length} lectures ${uniqueDays.length ? `on ${uniqueDays.length} days` : ''}</div>`;
}

function openTeacherSchedule(teacherId) {
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const teacher = teachers.find(item => item.id === teacherId);
    const modal = document.getElementById('teacherScheduleModal');
    if (!teacher || !modal) return;

    teacherScheduleDraft = normalizeTeacherSchedule(teacher.schedule).map(item => ({ ...item }));
    document.getElementById('scheduleTeacherId').value = teacher.id;
    document.getElementById('scheduleModalTitle').innerText = `Schedule: ${teacher.fullName}`;
    clearTeacherScheduleDraft();
    renderTeacherScheduleDraft();
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
}

function closeTeacherScheduleModal() {
    const modal = document.getElementById('teacherScheduleModal');
    if (modal) modal.style.display = 'none';
    teacherScheduleDraft = [];
}

function clearTeacherScheduleDraft() {
    ['scheduleClass', 'scheduleSubject', 'scheduleStartTime', 'scheduleEndTime', 'scheduleRoom', 'scheduleNote'].forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

function addTeacherScheduleItem() {
    const day = document.getElementById('scheduleDay').value;
    const classGrade = document.getElementById('scheduleClass').value.trim();
    const subject = document.getElementById('scheduleSubject').value.trim();
    const startTime = document.getElementById('scheduleStartTime').value;
    const endTime = document.getElementById('scheduleEndTime').value;
    const room = document.getElementById('scheduleRoom').value.trim();
    const note = document.getElementById('scheduleNote').value.trim();

    if (!day || !classGrade || !subject || !startTime || !endTime) {
        alert('Please add day, class, lecture, start time, and end time.');
        return;
    }

    if (startTime >= endTime) {
        alert('End time must be after start time.');
        return;
    }

    teacherScheduleDraft.push({
        id: generateUniqueRecordId('SCH'),
        day,
        classGrade,
        subject,
        startTime,
        endTime,
        room,
        note
    });
    teacherScheduleDraft.sort(compareScheduleItems);
    clearTeacherScheduleDraft();
    renderTeacherScheduleDraft();
}

function compareScheduleItems(a, b) {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
}

function removeTeacherScheduleItem(scheduleId) {
    teacherScheduleDraft = teacherScheduleDraft.filter(item => item.id !== scheduleId);
    renderTeacherScheduleDraft();
}

function renderTeacherScheduleDraft() {
    const list = document.getElementById('teacherScheduleList');
    if (!list) return;

    if (!teacherScheduleDraft.length) {
        list.innerHTML = '<div class="schedule-empty">No lectures assigned yet.</div>';
        return;
    }

    list.innerHTML = teacherScheduleDraft.map((item) => `
        <div class="schedule-row">
            <div><strong>${item.day}</strong><br><span>${formatScheduleTime(item.startTime, item.endTime)}</span></div>
            <div><strong>${item.subject}</strong><br><span>${item.classGrade}</span></div>
            <div><strong>${item.room || '-'}</strong><br><span>${item.note || 'No note'}</span></div>
            <div><span>Lecture</span></div>
            <button type="button" class="action-btn btn-delete" onclick="removeTeacherScheduleItem('${item.id}')">
                <i data-lucide="trash-2" width="14"></i> Remove
            </button>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

async function saveTeacherSchedule() {
    const teacherId = document.getElementById('scheduleTeacherId').value;
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const teacher = teachers.find(item => item.id === teacherId);
    if (!teacher) return;

    teacher.schedule = teacherScheduleDraft.map(item => ({ ...item }));
    saveData(STORAGE_KEY_TEACHERS, teachers, { skipSync: true });
    const syncResult = await syncToSQLDetailed('teachers', [teacher]);
    if (!syncResult.success) {
        alert(syncResult.error || 'Schedule saved locally, but database sync failed.');
    }

    pushNotification('Teacher Schedule', `Lecture schedule updated for ${teacher.fullName}.`, 'calendar');
    closeTeacherScheduleModal();
    renderTeachers((document.getElementById('teacherSearchInput')?.value || '').toLowerCase());
}

function renderTeachers(term = '') {
    const tbody = document.getElementById('teacherTableBody');
    if (!tbody) return;

    if (typeof term !== 'string') term = '';

    const campusFilter = document.getElementById('teacherCampusFilter');
    const genderFilter = document.getElementById('teacherGenderFilter');
    const selectedCampus = campusFilter ? campusFilter.value : '';
    const selectedGender = genderFilter ? genderFilter.value : '';
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const filtered = teachers
        .filter(t =>
            !isTeacherStuckOff(t) &&
            (
                (t.fullName && t.fullName.toLowerCase().includes(term)) ||
                (t.subject && t.subject.toString().toLowerCase().includes(term))
            ) &&
            (!selectedCampus || (t.campusName || '') === selectedCampus) &&
            (!selectedGender || (t.gender || '') === selectedGender)
        )
        .sort((a, b) => {
            const codeA = String(a.employeeCode || a.id || '').toLowerCase();
            const codeB = String(b.employeeCode || b.id || '').toLowerCase();
            const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            if (codeCompare !== 0) return codeCompare;
            return String(a.fullName || '').localeCompare(String(b.fullName || ''), undefined, { sensitivity: 'base' });
        });

    // Update total count display
    const totalCountEl = document.getElementById('totalTeacherCount');
    if (totalCountEl) totalCountEl.innerText = filtered.length;

    tbody.innerHTML = '';
    const noData = document.getElementById('noTeacherDataMessage');

    const getBankDetailsMarkup = (record) => {
        const hasBankData = record.bankName || record.bankAccountNumber;
        if (!hasBankData) return '<span style="color: var(--text-secondary);">-</span>';

        return `
            <div class="table-detail-stack">
                <div><strong>Bank:</strong> ${record.bankName || '-'}</div>
                <div><strong>Account:</strong> ${record.bankAccountNumber || '-'}</div>
            </div>
        `;
    };

    const getDocumentBadgesMarkup = (record) => {
        const hasDocuments = ['idCardFront', 'idCardBack', 'cvFile']
            .some((fieldName) => parseStoredFilePayload(record[fieldName])?.dataUrl);

        if (!hasDocuments) return '<span class="doc-badge muted">No Files</span>';
        return `
            <button type="button" class="doc-download-btn" onclick="downloadTeacherDocumentsAsPdf('${record.id}')">
                Download PDF
            </button>
        `;
    };

    if (filtered.length === 0) {
        if (noData) noData.style.display = 'block';
    } else {
        if (noData) noData.style.display = 'none';
        filtered.forEach(t => {
            const encodedTeacher = encodeURIComponent(JSON.stringify(t));
            const normalizedTeacherDesignation = normalizeTeacherDesignation(t.designation, t.groupKey);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="teacher-name-cell">
                    <div class="teacher-avatar">${buildTeacherAvatarMarkup(t)}</div>
                    <div class="teacher-name-text">
                        <div style="font-weight:500">${t.fullName}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${t.employeeCode || ''} ${normalizedTeacherDesignation.designation ? ` - ${normalizedTeacherDesignation.designation}` : ''}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${t.qualification || ''}</div>
                    </div>
                </div></td>
                <td class="teacher-cell-compact">${t.fatherName || '-'}</td>
                <td>${formatDateForDisplay(t.dob)}</td>
                <td class="teacher-cell-compact">${t.campusName || '-'}</td>
                <td class="teacher-cell-compact">
                    <div>${t.subject}</div>
                    ${getTeacherScheduleSummary(t)}
                </td>
                <td>${getBankDetailsMarkup(t)}</td>
                <td>${getDocumentBadgesMarkup(t)}</td>
                <td class="teacher-login-details">
                    <div>
                        <div><strong>User:</strong> ${t.username || '-'}</div>
                        <div><strong>Pass:</strong> ${t.plainPassword || t.password || '-'}</div>
                    </div>
                </td>
                <td style="font-weight:600;">PKR ${parseInt(t.salary || 0).toLocaleString()}</td>
                <td>${t.phone || '-'}</td>
                <td>
                    <div class="teacher-action-wrap">
                        <select class="table-action-select" onchange="handleTeacherActionSelect(this, '${encodedTeacher}', '${t.id}')">
                            <option value="">Actions</option>
                            <option value="attendance">Attendance</option>
                            <option value="schedule">Schedule</option>
                            <option value="edit">Edit</option>
                            <option value="stuckoff">Stuck-Off</option>
                            <option value="delete">Delete</option>
                        </select>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
    }
}

function editTeacher(t) {
    toggleTeacherForm(true);
    const normalizedTeacherDesignation = normalizeTeacherDesignation(t.designation, t.groupKey);
    document.getElementById('teacherId').value = t.id;
    document.getElementById('teacherCode').value = t.employeeCode || '';
    document.getElementById('tFullName').value = t.fullName;
    document.getElementById('tFatherName').value = t.fatherName || '';
    if (document.getElementById('tDob')) document.getElementById('tDob').value = t.dob || '';
    document.getElementById('tCnic').value = t.cnic || '';
    document.getElementById('tPhone').value = t.phone;
    if (document.getElementById('tEmail')) document.getElementById('tEmail').value = t.email || '';
    document.getElementById('tAddress').value = t.address || '';
    document.getElementById('tQualification').value = t.qualification || '';
    document.getElementById('tCampusName').value = t.campusName || '';
    document.getElementById('tGender').value = t.gender || '';
    setDesignationSelectValue('tDesignation', normalizedTeacherDesignation.designation, normalizedTeacherDesignation.groupKey);
    document.getElementById('tSubject').value = t.subject;
    if (document.getElementById('tFingerprintData')) document.getElementById('tFingerprintData').value = t.fingerprintData || '';
    document.getElementById('tSalary').value = t.salary || '0';
    if (document.getElementById('tBankName')) document.getElementById('tBankName').value = t.bankName || '';
    if (document.getElementById('tBankAccountTitle')) document.getElementById('tBankAccountTitle').value = t.bankAccountTitle || '';
    if (document.getElementById('tBankAccountNumber')) document.getElementById('tBankAccountNumber').value = t.bankAccountNumber || '';
    if (document.getElementById('tBankBranch')) document.getElementById('tBankBranch').value = t.bankBranch || '';
    if (document.getElementById('tUsername')) document.getElementById('tUsername').value = t.username || '';
    if (document.getElementById('tPassword')) document.getElementById('tPassword').value = t.plainPassword || t.password || '';
    if (document.getElementById('tProfileImage')) document.getElementById('tProfileImage').value = '';
    setTeacherPhotoPreview(t.profileImage || '', t.fullName || '');
    if (document.getElementById('tIdCardFront')) document.getElementById('tIdCardFront').value = '';
    if (document.getElementById('tIdCardBack')) document.getElementById('tIdCardBack').value = '';
    if (document.getElementById('tCvFile')) document.getElementById('tCvFile').value = '';
}

async function deleteTeacher(id) {
    if (!(await showAppConfirm('Delete this teacher?'))) return;

    const existingTeachers = getArrayData(STORAGE_KEY_TEACHERS);
    const updatedTeachers = existingTeachers.filter(t => t.id !== id);
    saveData(STORAGE_KEY_TEACHERS, updatedTeachers, { skipSync: true });
    renderTeachers();

    const token = sessionStorage.getItem('eduCore_token') || '';
    fetch(`${API_BASE_URL}/teachers/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
        .then(async (response) => {
            if (response.status === 503) {
                pushNotification('Teacher Deleted', 'The teacher was deleted from the local list because the server is offline.', 'book');
                return;
            }

            const responseText = await response.text();
            let result = null;

            try {
                result = responseText ? JSON.parse(responseText) : null;
            } catch (parseError) {
                throw new Error('The server is still running an older version. Restart it with `node server.js` and try deleting again.');
            }

            if (response.status === 404) {
                pushNotification('Teacher Deleted', 'The teacher has been removed from both the local list and the database.', 'book');
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Teacher delete failed.');
            }

            pushNotification('Teacher Deleted', result.message || 'Teacher deleted successfully.', 'book');
        })
        .catch((error) => {
            localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(existingTeachers));
            renderTeachers();
            alert(error.message);
        });
}


function viewTeacherAttendance(teacher, monthKey = null) {
    const modal = document.getElementById('attendanceModal');
    const title = document.getElementById('attModalTitle');
    const grid = document.getElementById('attendanceGrid');

    if (!modal || !grid) return;

    // Default to current month if not specified (Format: YYYY-MM)
    const today = new Date();
    if (!monthKey) {
        monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }

    title.innerText = `Attendance: ${teacher.fullName} (${monthKey})`;
    modal.style.display = 'flex';
    grid.innerHTML = '';

    // Get Attendance Data
    const allAttendance = getData(STORAGE_KEY_TEACHER_ATTENDANCE) || {};
    // Structure: { "teacherID_YYYY-MM": [P, P, A, ...] }
    const recordKey = `${teacher.id}_${monthKey}`;

    const legacyRecordKey = `teacher_${teacher.id}_${monthKey}`;
    const [viewYear, viewMonth] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const normalizeTeacherAttendanceStatus = (status) => {
        if (status === 'P') return 'Present';
        if (status === 'A') return 'Absent';
        return status || 'Not Marked';
    };
    let monthRecord = Array.isArray(allAttendance[recordKey]) ? allAttendance[recordKey] : allAttendance[legacyRecordKey];
    monthRecord = Array.isArray(monthRecord)
        ? monthRecord.map(normalizeTeacherAttendanceStatus)
        : Array(daysInMonth).fill('Not Marked');

    while (monthRecord.length < daysInMonth) {
        monthRecord.push('Not Marked');
    }

    // Calculate Today's Date Components for Validation
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Check if the viewed month is strictly the current month
    const isCurrentMonth = (viewYear === currentYear && viewMonth === currentMonth);

    // Render Grid
    monthRecord.forEach((status, index) => {
        const day = index + 1;
        const statusClass = status === 'Present'
            ? 'status-present'
            : status === 'Late'
                ? 'status-late'
                : status === 'Absent'
                    ? 'status-absent'
                    : '';

        // "One day valid": Is this cell for Today?
        const isToday = isCurrentMonth && (day === currentDay);

        const cell = document.createElement('div');
        cell.className = `attendance-day ${statusClass}`;

        // Only Today is clickable
        if (isToday) {
            cell.style.cursor = 'pointer';
            cell.style.border = '2px solid var(--primary-color)'; // Highlight today
            cell.title = 'Mark Attendance';
            cell.onclick = () => toggleTeacherAttendanceDay(teacher.id, monthKey, index);
        } else {
            cell.style.cursor = 'default';
            cell.style.opacity = '0.7'; // Visual cue that others are locked
        }

        cell.innerHTML = `
            <div style="font-weight:bold; font-size:1.1rem;">${day}</div>
            <div>${status}</div>
        `;

        grid.appendChild(cell);
    });

    // Close modal on outside click
    modal.onclick = (e) => {
        if (e.target === modal) closeAttendanceModal();
    };
}

async function toggleTeacherAttendanceDay(teacherId, monthKey, dayIndex) {
    const recordKey = `${teacherId}_${monthKey}`;
    let allAttendance = getData(STORAGE_KEY_TEACHER_ATTENDANCE) || {};
    const legacyRecordKey = `teacher_${teacherId}_${monthKey}`;
    const normalizeTeacherAttendanceStatus = (status) => {
        if (status === 'P') return 'Present';
        if (status === 'A') return 'Absent';
        return status || 'Not Marked';
    };
    let monthRecord = Array.isArray(allAttendance[recordKey]) ? allAttendance[recordKey] : allAttendance[legacyRecordKey];

    // If starting fresh
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    monthRecord = Array.isArray(monthRecord)
        ? monthRecord.map(normalizeTeacherAttendanceStatus)
        : Array(daysInMonth).fill('Not Marked');

    while (monthRecord.length < daysInMonth) {
        monthRecord.push('Not Marked');
    }

    const statusCycle = ['Not Marked', 'Present', 'Late', 'Absent'];
    const currentStatus = normalizeTeacherAttendanceStatus(monthRecord[dayIndex]);
    const currentIndex = statusCycle.indexOf(currentStatus);
    monthRecord[dayIndex] = statusCycle[(currentIndex + 1) % statusCycle.length];

    // Save
    allAttendance[recordKey] = monthRecord;
    delete allAttendance[legacyRecordKey];
    saveData(STORAGE_KEY_TEACHER_ATTENDANCE, allAttendance);
    const dateKey = `${monthKey}-${String(dayIndex + 1).padStart(2, '0')}`;
    const syncResult = await saveTeacherAttendanceToSQLRecord(teacherId, dateKey, monthRecord[dayIndex]);
    if (!syncResult.success) {
        alert(syncResult.error || 'Teacher attendance could not be saved to the database.');
    }

    // Refresh View
    const teachers = getArrayData(STORAGE_KEY_TEACHERS);
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) viewTeacherAttendance(teacher, monthKey);
}

function closeAttendanceModal() {
    const modal = document.getElementById('attendanceModal');
    if (modal) modal.style.display = 'none';
}

// =======================================================
// ==================== STAFF LOGIC ======================
// =======================================================

function toggleStaffForm(editMode = false) {
    const container = document.getElementById('staffFormContainer');
    const form = document.getElementById('staffForm');
    const title = document.getElementById('staffFormTitle');

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('staffId').value = '';
        setStaffPhotoPreview('');
    } else {
        container.style.display = 'block';
        if (!editMode) {
            form.reset();
            document.getElementById('staffId').value = '';
            const staffCodeField = document.getElementById('staffCode');
            if (staffCodeField) staffCodeField.value = generateEntityCode(STORAGE_KEY_STAFF, 'STF');
            setStaffPhotoPreview('');
            title.innerText = 'Add New Staff Member';
        } else {
            title.innerText = 'Edit Staff Member';
        }
    }
}

async function handleStaffFormSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('staffId');
    const isEdit = idField.value !== '';

    const staff = getData(STORAGE_KEY_STAFF);
    const existingStaff = isEdit ? staff.find(s => s.id === idField.value) : null;

    let idCardFront = existingStaff?.idCardFront || null;
    let idCardBack = existingStaff?.idCardBack || null;
    let profileImage = existingStaff?.profileImage || '';

    try {
        if (document.getElementById('sProfileImage')?.files?.[0]) {
            profileImage = await readFileAsDataUrl(document.getElementById('sProfileImage').files[0]);
        }
        idCardFront = await getOptionalFilePayload('sIdCardFront', idCardFront);
        idCardBack = await getOptionalFilePayload('sIdCardBack', idCardBack);
    } catch (error) {
        alert(error.message);
        return;
    }

    const newStaff = {
        id: isEdit ? idField.value : generateUniqueRecordId('STF'),
        employeeCode: document.getElementById('staffCode').value || generateEntityCode(STORAGE_KEY_STAFF, 'STF'),
        fullName: document.getElementById('sFullName').value,
        profileImage,
        fatherName: document.getElementById('sFatherName').value,
        dob: document.getElementById('sDob').value,
        designation: document.getElementById('sDesignation').value,
        groupKey: getDesignationGroup('sDesignation', 'staff'),
        cnic: document.getElementById('sCnic').value,
        phone: document.getElementById('sPhone').value,
        email: document.getElementById('sEmail').value.trim(),
        address: document.getElementById('sAddress').value,
        gender: document.getElementById('sGender').value,
        salary: document.getElementById('sSalary').value || '0',
        idCardFront,
        idCardBack,
        bankName: document.getElementById('sBankName').value.trim(),
        bankAccountTitle: document.getElementById('sBankAccountTitle').value.trim(),
        bankAccountNumber: document.getElementById('sBankAccountNumber').value.trim(),
        bankBranch: document.getElementById('sBankBranch').value.trim(),
        username: document.getElementById('sUsername').value.trim(),
        plainPassword: document.getElementById('sPassword').value.trim(),
        password: document.getElementById('sPassword').value.trim(),
        role: 'Staff'
    };

    if (isEdit) {
        const index = staff.findIndex(s => s.id === newStaff.id);
        if (index !== -1) staff[index] = newStaff;
    } else {
        staff.push(newStaff);
    }
    saveData(STORAGE_KEY_STAFF, staff);
    pushNotification('Staff Updated', `Staff record for "${newStaff.fullName}" was added/updated.`, 'user');
    toggleStaffForm();
    renderStaff();
}

function bindStaffFormSubmit() {
    const staffForm = document.getElementById('staffForm');
    if (!staffForm || staffForm.dataset.submitBound === '1') return;
    staffForm.dataset.submitBound = '1';
    staffForm.onsubmit = (event) => {
        handleStaffFormSubmit(event);
        return false;
    };
}

bindStaffFormSubmit();

function renderStaff(term = '') {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    if (typeof term !== 'string') term = '';

    const staff = getData(STORAGE_KEY_STAFF);
    const filtered = staff.filter(s =>
        (s.fullName && s.fullName.toLowerCase().includes(term)) ||
        (s.designation && s.designation.toString().toLowerCase().includes(term))
    );

    // Update total count display
    const totalCountEl = document.getElementById('totalStaffCount');
    if (totalCountEl) totalCountEl.innerText = filtered.length;

    tbody.innerHTML = '';
    const noData = document.getElementById('noStaffDataMessage');

    const getBankDetailsMarkup = (record) => {
        const hasBankData = record.bankName || record.bankAccountNumber || record.bankAccountTitle || record.bankBranch;
        if (!hasBankData) return '<span style="color: var(--text-secondary);">-</span>';

        return `
            <div class="table-detail-stack">
                <div><strong>Bank:</strong> ${record.bankName || '-'}</div>
                <div><strong>Account:</strong> ${record.bankAccountNumber || '-'}</div>
                <div><strong>Holder:</strong> ${record.bankAccountTitle || '-'}</div>
                <div><strong>Branch:</strong> ${record.bankBranch || '-'}</div>
            </div>
        `;
    };

    const getDocumentBadgesMarkup = (record) => {
        const badges = [];
        if (record.idCardFront) badges.push(`<button type="button" class="doc-download-btn" onclick="downloadStoredDocumentAsPdf('staff', '${record.id}', 'idCardFront', 'staff-id-front')">ID Front PDF</button>`);
        if (record.idCardBack) badges.push(`<button type="button" class="doc-download-btn" onclick="downloadStoredDocumentAsPdf('staff', '${record.id}', 'idCardBack', 'staff-id-back')">ID Back PDF</button>`);

        if (!badges.length) return '<span class="doc-badge muted">No Files</span>';
        return `<div class="doc-badge-wrap">${badges.join('')}</div>`;
    };

    const getVisibleStaffPassword = (record) => {
        if (record.plainPassword && !isHashedPassword(record.plainPassword)) return record.plainPassword;
        if (record.password && !isHashedPassword(record.password)) return record.password;
        return 'Reset required';
    };

    if (filtered.length === 0) {
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        filtered.forEach(s => {
            const tr = document.createElement('tr');
            const staffAvatar = s.profileImage
                ? `<img src="${s.profileImage}" alt="${s.fullName || 'Staff'}">`
                : getStaffInitial(s.fullName);
            tr.innerHTML = `
                <td><div class="staff-name-cell">
                    <div class="staff-avatar">${staffAvatar}</div>
                    <div>
                        <div style="font-weight:500">${s.fullName}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${s.employeeCode || ''} ${s.designation ? `• ${s.designation}` : ''}</div>
                    </div>
                </div></td>
                <td>${s.fatherName || '-'}</td>
                <td>${formatDateForDisplay(s.dob)}</td>
                <td>${s.designation}</td>
                <td>${getBankDetailsMarkup(s)}</td>
                <td>${getDocumentBadgesMarkup(s)}</td>
                <td>${s.cnic || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td class="staff-login-details">
                    <div>
                        <div><strong>User:</strong> ${s.username || '-'}</div>
                        <div><strong>Pass:</strong> ${getVisibleStaffPassword(s)}</div>
                    </div>
                </td>
                <td>PKR ${s.salary}</td>
                <td>
                    <button class="action-btn btn-edit" onclick='editStaff(${JSON.stringify(s)})'><i data-lucide="edit-2" width="14"></i> Edit</button>
                    <button class="action-btn btn-delete" onclick="deleteStaff('${s.id}')"><i data-lucide="trash-2" width="14"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
    }
}

function editStaff(s) {
    toggleStaffForm(true);
    document.getElementById('staffId').value = s.id;
    document.getElementById('staffCode').value = s.employeeCode || '';
    document.getElementById('sFullName').value = s.fullName;
    document.getElementById('sFatherName').value = s.fatherName || '';
    if (document.getElementById('sDob')) document.getElementById('sDob').value = s.dob || '';
    setDesignationSelectValue('sDesignation', s.designation || 'Staff Member', s.groupKey || 'staff');
    document.getElementById('sCnic').value = s.cnic || '';
    document.getElementById('sPhone').value = s.phone;
    if (document.getElementById('sEmail')) document.getElementById('sEmail').value = s.email || '';
    document.getElementById('sAddress').value = s.address || '';
    document.getElementById('sGender').value = s.gender || '';
    document.getElementById('sSalary').value = s.salary || '0';
    if (document.getElementById('sUsername')) document.getElementById('sUsername').value = s.username || '';
    if (document.getElementById('sPassword')) {
        const visiblePassword = s.plainPassword && !isHashedPassword(s.plainPassword)
            ? s.plainPassword
            : (s.password && !isHashedPassword(s.password) ? s.password : '');
        document.getElementById('sPassword').value = visiblePassword;
    }
    if (document.getElementById('sBankName')) document.getElementById('sBankName').value = s.bankName || '';
    if (document.getElementById('sBankAccountTitle')) document.getElementById('sBankAccountTitle').value = s.bankAccountTitle || '';
    if (document.getElementById('sBankAccountNumber')) document.getElementById('sBankAccountNumber').value = s.bankAccountNumber || '';
    if (document.getElementById('sBankBranch')) document.getElementById('sBankBranch').value = s.bankBranch || '';
    if (document.getElementById('sProfileImage')) document.getElementById('sProfileImage').value = '';
    setStaffPhotoPreview(s.profileImage || '', s.fullName || '');
    if (document.getElementById('sIdCardFront')) document.getElementById('sIdCardFront').value = '';
    if (document.getElementById('sIdCardBack')) document.getElementById('sIdCardBack').value = '';
}

async function deleteStaff(id) {
    if (!(await showAppConfirm('Delete this staff member?'))) return;

    const existingStaff = getData(STORAGE_KEY_STAFF);
    const updatedStaff = existingStaff.filter(s => s.id !== id);
    saveData(STORAGE_KEY_STAFF, updatedStaff, { skipSync: true });
    renderStaff();

    const token = sessionStorage.getItem('eduCore_token') || '';
    fetch(`${API_BASE_URL}/staff/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
        .then(async (response) => {
            if (response.status === 503) {
                pushNotification('Staff Deleted', 'The staff member was deleted from the local list because the server is offline.', 'user');
                return;
            }

            const responseText = await response.text();
            let result = null;

            try {
                result = responseText ? JSON.parse(responseText) : null;
            } catch (parseError) {
                throw new Error('The server is still running an older version. Restart it with `node server.js` and try deleting again.');
            }

            if (response.status === 404) {
                pushNotification('Staff Deleted', 'The staff member has been removed from both the local list and the database.', 'user');
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Staff delete failed.');
            }

            pushNotification('Staff Deleted', result.message || 'Staff deleted successfully.', 'user');
        })
        .catch((error) => {
            localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(existingStaff));
            renderStaff();
            alert(error.message);
        });
}


// =======================================================
// ==================== CLASS LOGIC ======================
// =======================================================

function toggleClassForm(editMode = false) {
    const container = document.getElementById('classFormContainer');
    const form = document.getElementById('classForm');
    const title = document.getElementById('classFormTitle');

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('classId').value = '';
    } else {
        container.style.display = 'block';
        if (!editMode) {
            form.reset();
            document.getElementById('classId').value = '';
            title.innerText = 'Add New Class';
        } else {
            title.innerText = 'Edit Class Details';
        }
    }
}

function handleClassFormSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('classId');
    const isEdit = idField.value !== '';

    const newClass = {
        id: isEdit ? idField.value : generateUniqueRecordId('CLS'),
        name: document.getElementById('cName').value,
        section: document.getElementById('cSection').value,
        room: document.getElementById('cRoom').value,
        capacity: document.getElementById('cCapacity').value,
    };

    let classes = getData(STORAGE_KEY_CLASSES);
    if (isEdit) {
        const index = classes.findIndex(c => c.id === newClass.id);
        if (index !== -1) classes[index] = newClass;
    } else {
        classes.push(newClass);
    }
    saveData(STORAGE_KEY_CLASSES, classes);

    toggleClassForm();
    renderClasses();
}

function renderClasses(term = '') {
    const tbody = document.getElementById('classTableBody');
    if (!tbody) return;

    if (typeof term !== 'string') term = '';

    const classes = getData(STORAGE_KEY_CLASSES);
    const filtered = classes.filter(c => c.name && c.name.toLowerCase().includes(term));

    tbody.innerHTML = '';
    const noData = document.getElementById('noClassDataMessage');

    if (filtered.length === 0) {
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        filtered.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${c.name}</b></td>
                <td>${c.section}</td>
                <td>${c.room}</td>
                <td>${c.capacity}</td>
                <td>
                    <button class="action-btn btn-edit" onclick='editClass(${JSON.stringify(c)})'><i data-lucide="edit-2" width="14"></i> Edit</button>
                    <button class="action-btn btn-delete" onclick="deleteClass('${c.id}')"><i data-lucide="trash-2" width="14"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
    }
}

function editClass(c) {
    toggleClassForm(true);
    document.getElementById('classId').value = c.id;
    document.getElementById('cName').value = c.name;
    document.getElementById('cSection').value = c.section;
    document.getElementById('cRoom').value = c.room;
    document.getElementById('cCapacity').value = c.capacity;
}

async function deleteClass(id) {
    if (!(await showAppConfirm('Delete this class?'))) return;

    let classes = getData(STORAGE_KEY_CLASSES);
    classes = classes.filter(c => c.id !== id);
    saveData(STORAGE_KEY_CLASSES, classes);
    renderClasses();
}

// =======================================================
// ==================== SETTINGS LOGIC ===================
// =======================================================

function renderLoginHistory() {
    // Get Current User Info
    const authData = localStorage.getItem(STORAGE_KEY_AUTH);
    const auth = authData ? JSON.parse(authData) : { username: 'Admin User', email: 'Admin User' };
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) {
        userDisplay.innerText = auth.username || auth.email || 'Admin User';
    }

    // Get History
    const history = JSON.parse(localStorage.getItem('EDUCORE_LOGIN_HISTORY')) || [];
    const tbody = document.getElementById('loginHistoryBody');
    const noData = document.getElementById('noLoginData');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (history.length === 0) {
        if (noData) noData.style.display = 'block';
    } else {
        if (noData) noData.style.display = 'none';
        history.forEach(log => {
            const date = new Date(log.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color);">${log.email}</td>
                <td style="padding: 0.75rem 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color);">${dateStr}</td>
                <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
                    <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem;">${log.status}</span>
                </td>
                <td style="padding: 0.75rem 1rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">${log.ip}</td>
            `;
            tbody.appendChild(row);
        });
    }
}



async function loadSettings() {
    const settings = localStorage.getItem(STORAGE_KEY_SETTINGS);

    if (settings) {
        const data = JSON.parse(settings);
        if (document.getElementById('sSchoolName')) document.getElementById('sSchoolName').value = data.schoolName || '';
        if (document.getElementById('sSchoolTitle')) document.getElementById('sSchoolTitle').value = data.schoolTitle || '';
        if (document.getElementById('sSession')) document.getElementById('sSession').value = data.session || '';
        if (document.getElementById('sPhone')) document.getElementById('sPhone').value = data.phone || '';
        updateBrandingLogoPreview(data.logoDataUrl || '');
    } else {
        updateBrandingLogoPreview('');
    }

    await loadAdminCredentialSettings();
}

function updateBrandingLogoPreview(dataUrl = '') {
    const preview = document.getElementById('brandingLogoPreview');
    if (!preview) return;
    if (dataUrl) {
        preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="School logo preview">`;
    } else {
        preview.innerHTML = '96 x 96<br>Logo';
    }
}

async function handleBrandingLogoSelection(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    try {
        const dataUrl = await readFileAsDataUrl(file);
        updateBrandingLogoPreview(dataUrl);
        const settings = getBrandingSettings();
        settings.logoDataUrl = dataUrl;
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (error) {
        await showAppAlert(error.message || 'Logo could not be loaded.', 'Logo Upload Failed');
    }
}

function clearBrandingLogo() {
    const settings = getBrandingSettings();
    settings.logoDataUrl = '';
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    const input = document.getElementById('sSchoolLogo');
    if (input) input.value = '';
    updateBrandingLogoPreview('');
}

async function handleSettingsSubmit(e) {
    e.preventDefault();

    try {
        // Save settings values
        const settings = getBrandingSettings();
        if (document.getElementById('sSchoolName')) settings.schoolName = document.getElementById('sSchoolName').value;
        if (document.getElementById('sSchoolTitle')) settings.schoolTitle = document.getElementById('sSchoolTitle').value;
        if (document.getElementById('sSession')) settings.session = document.getElementById('sSession').value;
        if (document.getElementById('sPhone')) settings.phone = document.getElementById('sPhone').value;

        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        await saveAdminCredentialSettings();

        alert('Settings saved successfully!');
        pushNotification('Settings Updated', 'Settings have been saved.', 'info');

        // Refresh display
        renderLoginHistory();
    } catch (error) {
        alert(error.message || 'Settings could not be saved.');
    }
}

async function loadAdminCredentialSettings() {
    const usernameInput = document.getElementById('adminUsernameSetting');
    const hint = document.getElementById('adminOtpHint');
    if (!usernameInput) return;
    resetAdminPasswordChangeFlow(false);

    const token = sessionStorage.getItem('eduCore_token') || '';
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin-credentials`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await parseJsonResponse(response, 'Admin credentials could not be loaded.');
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'Admin credentials could not be loaded.');
        usernameInput.value = result?.credentials?.username || 'admin';
        usernameInput.dataset.originalValue = usernameInput.value;
        if (hint && result?.recoveryEmail) {
            setAdminPasswordStatus(`Click Change Password to send OTP to ${result.recoveryEmail}.`);
        }
    } catch (error) {
        setAdminPasswordStatus(error.message || 'Admin credentials could not be loaded.', 'error');
    }

    const sendBtn = document.getElementById('sendAdminOtpBtn');
    if (sendBtn && !sendBtn.dataset.bound) {
        sendBtn.dataset.bound = 'true';
        sendBtn.addEventListener('click', sendAdminCredentialOtp);
    }

    const verifyBtn = document.getElementById('verifyAdminOtpBtn');
    if (verifyBtn && !verifyBtn.dataset.bound) {
        verifyBtn.dataset.bound = 'true';
        verifyBtn.addEventListener('click', verifyAdminCredentialOtp);
    }

    const savePasswordBtn = document.getElementById('saveAdminPasswordBtn');
    if (savePasswordBtn && !savePasswordBtn.dataset.bound) {
        savePasswordBtn.dataset.bound = 'true';
        savePasswordBtn.addEventListener('click', saveVerifiedAdminPassword);
    }
}

function setAdminPasswordStatus(message, type = '') {
    const hint = document.getElementById('adminOtpHint');
    if (!hint) return;
    hint.textContent = message || '';
    hint.classList.remove('success', 'error');
    if (type) hint.classList.add(type);
}

function resetAdminPasswordChangeFlow(hidePanel = true) {
    const panel = document.getElementById('adminPasswordChangePanel');
    const otpStep = document.getElementById('adminOtpStep');
    const passwordStep = document.getElementById('adminPasswordStep');
    const otpInput = document.getElementById('adminOtpSetting');
    const passwordInput = document.getElementById('adminNewPasswordSetting');
    const confirmPasswordInput = document.getElementById('adminConfirmPasswordSetting');

    if (panel) panel.hidden = hidePanel;
    if (otpStep) otpStep.hidden = false;
    if (passwordStep) passwordStep.hidden = true;
    if (otpInput) {
        otpInput.value = '';
        otpInput.dataset.verified = '';
    }
    if (passwordInput) passwordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
}

function normalizeAdminOtpError(error) {
    const message = String(error?.message || '').trim();
    if (/route not found|Cannot POST|404/i.test(message)) {
        return 'OTP verification route is not active. Please restart/deploy the server once.';
    }
    if (/invalid|expired|wrong/i.test(message)) {
        return 'Wrong OTP. Please enter the correct email OTP.';
    }
    return message || 'OTP could not be verified.';
}

async function sendAdminCredentialOtp() {
    const sendBtn = document.getElementById('sendAdminOtpBtn');
    const panel = document.getElementById('adminPasswordChangePanel');
    const otpStep = document.getElementById('adminOtpStep');
    const passwordStep = document.getElementById('adminPasswordStep');
    const otpInput = document.getElementById('adminOtpSetting');
    const passwordInput = document.getElementById('adminNewPasswordSetting');
    const confirmPasswordInput = document.getElementById('adminConfirmPasswordSetting');
    const token = sessionStorage.getItem('eduCore_token') || '';
    const originalText = sendBtn?.innerHTML || '';

    try {
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i data-lucide="loader"></i> Sending OTP...';
            if (window.lucide) window.lucide.createIcons();
        }
        const response = await fetch(`${API_BASE_URL}/admin-credentials/request-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({})
        });
        const result = await parseJsonResponse(response, 'OTP could not be sent.');
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'OTP could not be sent.');
        if (panel) panel.hidden = false;
        if (otpStep) otpStep.hidden = false;
        if (passwordStep) passwordStep.hidden = true;
        if (otpInput) {
            otpInput.value = '';
            otpInput.dataset.verified = '';
            otpInput.focus();
        }
        if (passwordInput) passwordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        setAdminPasswordStatus(result.message || 'OTP sent successfully.', 'success');
    } catch (error) {
        resetAdminPasswordChangeFlow(true);
        setAdminPasswordStatus(error.message || 'OTP could not be sent.', 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function verifyAdminCredentialOtp() {
    const verifyBtn = document.getElementById('verifyAdminOtpBtn');
    const otpInput = document.getElementById('adminOtpSetting');
    const otpStep = document.getElementById('adminOtpStep');
    const passwordStep = document.getElementById('adminPasswordStep');
    const passwordInput = document.getElementById('adminNewPasswordSetting');
    const token = sessionStorage.getItem('eduCore_token') || '';
    const otp = otpInput?.value?.trim() || '';
    const originalText = verifyBtn?.textContent || '';

    try {
        if (!/^\d{6}$/.test(otp)) throw new Error('6 digit OTP enter karein.');
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Verifying...';
        }
        const response = await fetch(`${API_BASE_URL}/admin-credentials/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ otp })
        });
        const result = await parseJsonResponse(response, 'OTP could not be verified.');
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'OTP could not be verified.');
        if (otpInput) otpInput.dataset.verified = otp;
        if (otpStep) otpStep.hidden = true;
        if (passwordStep) passwordStep.hidden = false;
        if (passwordInput) passwordInput.focus();
        setAdminPasswordStatus('OTP Verified. Enter your new password.', 'success');
    } catch (error) {
        if (otpInput) otpInput.dataset.verified = '';
        if (otpStep) otpStep.hidden = false;
        if (passwordStep) passwordStep.hidden = true;
        setAdminPasswordStatus(normalizeAdminOtpError(error), 'error');
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = originalText;
        }
    }
}

async function saveAdminCredentialSettings() {
    const usernameInput = document.getElementById('adminUsernameSetting');
    if (!usernameInput) return;

    const username = usernameInput.value.trim();
    const originalUsername = usernameInput.dataset.originalValue || '';

    if (username === originalUsername) return;
    if (!username) throw new Error('Admin username required hai.');

    const token = sessionStorage.getItem('eduCore_token') || '';
    const response = await fetch(`${API_BASE_URL}/admin-credentials`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username })
    });
    const result = await parseJsonResponse(response, 'Admin username could not be updated.');
    if (!response.ok || result?.success === false) throw new Error(result?.message || 'Admin username could not be updated.');

    usernameInput.dataset.originalValue = result?.credentials?.username || username;
}

async function saveVerifiedAdminPassword() {
    const usernameInput = document.getElementById('adminUsernameSetting');
    const passwordInput = document.getElementById('adminNewPasswordSetting');
    const confirmPasswordInput = document.getElementById('adminConfirmPasswordSetting');
    const otpInput = document.getElementById('adminOtpSetting');
    const saveBtn = document.getElementById('saveAdminPasswordBtn');
    const panel = document.getElementById('adminPasswordChangePanel');
    const otpStep = document.getElementById('adminOtpStep');
    const passwordStep = document.getElementById('adminPasswordStep');
    if (!usernameInput || !passwordInput || !confirmPasswordInput || !otpInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    const otp = otpInput.dataset.verified || '';
    const originalText = saveBtn?.textContent || '';

    try {
        if (!otp) throw new Error('Pehle email OTP verify karein.');
        if (!password) throw new Error('New password required hai.');
        if (password.length < 6) throw new Error('New password must be at least 6 characters.');
        if (password !== confirmPassword) throw new Error('New password and confirm password do not match.');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        const token = sessionStorage.getItem('eduCore_token') || '';
        const response = await fetch(`${API_BASE_URL}/admin-credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ username, password, confirmPassword, otp })
        });
        const result = await parseJsonResponse(response, 'Admin password could not be updated.');
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'Admin password could not be updated.');

        usernameInput.dataset.originalValue = result?.credentials?.username || username;
        passwordInput.value = '';
        confirmPasswordInput.value = '';
        otpInput.value = '';
        otpInput.dataset.verified = '';
        if (panel) panel.hidden = true;
        if (otpStep) otpStep.hidden = false;
        if (passwordStep) passwordStep.hidden = true;
        setAdminPasswordStatus('Admin password updated successfully. Login will use the new password now.', 'success');
    } catch (error) {
        setAdminPasswordStatus(error.message || 'Admin password could not be updated.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

function bindAdminForgotPassword() {
    const openBtn = document.getElementById('forgotAdminPasswordBtn');
    const modal = document.getElementById('forgotAdminModal');
    const closeBtn = document.getElementById('closeForgotAdminModal');
    const sendBtn = document.getElementById('sendForgotAdminOtpBtn');
    const resetBtn = document.getElementById('resetForgotAdminPasswordBtn');
    const status = document.getElementById('forgotAdminStatus');
    if (!openBtn || !modal || openBtn.dataset.bound) return;
    openBtn.dataset.bound = 'true';

    const setStatus = (message) => {
        if (status) status.textContent = message || '';
    };
    const close = () => {
        modal.classList.remove('active');
        setStatus('');
    };

    openBtn.addEventListener('click', () => {
        modal.classList.add('active');
        const usernameInput = document.getElementById('forgotAdminUsername');
        if (usernameInput && !usernameInput.value) usernameInput.value = document.getElementById('email')?.value?.trim() || 'admin';
        if (window.lucide) window.lucide.createIcons();
    });
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });

    sendBtn?.addEventListener('click', async () => {
        const username = document.getElementById('forgotAdminUsername')?.value?.trim() || '';
        const original = sendBtn.textContent;
        try {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            const response = await fetch(`${API_BASE_URL}/admin-password/forgot/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const result = await parseJsonResponse(response, 'OTP could not be sent.');
            if (!response.ok || result?.success === false) throw new Error(result?.message || 'OTP could not be sent.');
            setStatus(result.message || 'OTP sent successfully.');
        } catch (error) {
            setStatus(error.message || 'OTP could not be sent.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = original;
        }
    });

    resetBtn?.addEventListener('click', async () => {
        const username = document.getElementById('forgotAdminUsername')?.value?.trim() || '';
        const password = document.getElementById('forgotAdminNewPassword')?.value?.trim() || '';
        const otp = document.getElementById('forgotAdminOtp')?.value?.trim() || '';
        const original = resetBtn.textContent;
        try {
            if (!password || !otp) throw new Error('New password aur OTP required hain.');
            resetBtn.disabled = true;
            resetBtn.textContent = 'Resetting...';
            const response = await fetch(`${API_BASE_URL}/admin-password/forgot/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, otp })
            });
            const result = await parseJsonResponse(response, 'Password could not be reset.');
            if (!response.ok || result?.success === false) throw new Error(result?.message || 'Password could not be reset.');
            setStatus(result.message || 'Password updated successfully.');
            document.getElementById('password').value = '';
            document.getElementById('forgotAdminNewPassword').value = '';
            document.getElementById('forgotAdminOtp').value = '';
        } catch (error) {
            setStatus(error.message || 'Password could not be reset.');
        } finally {
            resetBtn.disabled = false;
            resetBtn.textContent = original;
        }
    });
}

// =======================================================
// ==================== NOTIFICATIONS LOGIC ==============
// =======================================================

function pushNotification(title, message, type = 'info') {
    const notifications = getData(STORAGE_KEY_NOTIFICATIONS);
    const newNotif = {
        id: Date.now(),
        title,
        message,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString()
    };
    notifications.unshift(newNotif);
    saveData(STORAGE_KEY_NOTIFICATIONS, notifications.slice(0, 20)); // Keep last 20
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notifBadge');
    const panel = document.getElementById('notificationPanel');
    if (!list) return;

    const notifications = getData(STORAGE_KEY_NOTIFICATIONS);

    // Update Badge
    if (badge) {
        badge.innerText = notifications.length;
        badge.style.display = notifications.length > 0 ? 'flex' : 'none';
    }

    if (notifications.length === 0) {
        // If empty, remove the active class so the entire panel (header included) disappears
        if (panel) panel.classList.remove('active');
        list.innerHTML = '';
        return;
    }

    list.innerHTML = '';
    notifications.forEach(n => {
        let icon = 'bell';
        let bg = 'rgba(32, 176, 164, 0.1)';
        let color = 'var(--primary-color)';

        if (n.type === 'login') { icon = 'log-in'; }
        if (n.type === 'user') { icon = 'user'; }
        if (n.type === 'book') { icon = 'book-open'; }
        if (n.type === 'alert') { icon = 'alert-triangle'; bg = '#fef2f2'; color = '#ef4444'; }

        const div = document.createElement('div');
        div.className = 'notif-item';
        div.style.cursor = 'pointer';
        div.title = 'Click to dismiss';
        div.onclick = (e) => {
            e.stopPropagation();
            removeNotification(n.id);
        };

        div.innerHTML = `
            <div class="notif-icon" style="background: ${bg}; color: ${color};">
                <i data-lucide="${icon}" size="18"></i>
            </div>
            <div class="notif-content">
                <span class="notif-title">${n.title}</span>
                <p class="notif-desc">${n.message}</p>
                <span class="notif-time">${n.time} • ${n.date}</span>
            </div>
        `;
        list.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
}

function removeNotification(id) {
    let notifications = getData(STORAGE_KEY_NOTIFICATIONS);
    notifications = notifications.filter(n => n.id !== id);
    saveData(STORAGE_KEY_NOTIFICATIONS, notifications);
    renderNotifications();
}

function clearAllNotifications(e) {
    if (e) e.stopPropagation();
    saveData(STORAGE_KEY_NOTIFICATIONS, []);
    renderNotifications();
}

// === TEACHER SALARY LOGIC ===
function getSalaryPaymentKey(entityType, entityId, monthKey) {
    return `${entityType}_${entityId}_${monthKey}`;
}

function getTeacherSalaries() {
    const data = localStorage.getItem(STORAGE_KEY_TEACHER_SALARIES);
    return data ? JSON.parse(data) : {};
}

function saveTeacherSalaries(salaries) {
    localStorage.setItem(STORAGE_KEY_TEACHER_SALARIES, JSON.stringify(salaries));
    fetch(`${API_BASE_URL}/teacher-salaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaries })
    }).catch((error) => console.warn('Teacher salary payments could not be saved to DB:', error.message));
}

async function loadTeacherSalariesFromSQL() {
    try {
        const response = await fetch(`${API_BASE_URL}/teacher-salaries`);
        const result = await parseJsonResponse(response, 'Teacher salary payments could not be loaded.');
        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || 'Teacher salary payments could not be loaded.');
        }
        const salaries = result?.salaries && typeof result.salaries === 'object' && !Array.isArray(result.salaries)
            ? result.salaries
            : {};
        localStorage.setItem(STORAGE_KEY_TEACHER_SALARIES, JSON.stringify(salaries));
        return salaries;
    } catch (error) {
        console.warn('Teacher salary payments DB load skipped:', error.message);
        return getTeacherSalaries();
    }
}

function getSalaryPaymentRecord(salaries, entityType, entityId, monthKey) {
    return salaries[getSalaryPaymentKey(entityType, entityId, monthKey)] ||
        (entityType === 'teacher' ? salaries[`${entityId}_${monthKey}`] : null);
}

function getTeacherAttendanceMonthRecord(attendanceStore, employeeId, monthKey) {
    const directKey = `${employeeId}_${monthKey}`;
    const legacyKey = `teacher_${employeeId}_${monthKey}`;
    const rawRecord = Array.isArray(attendanceStore[directKey])
        ? attendanceStore[directKey]
        : (Array.isArray(attendanceStore[legacyKey]) ? attendanceStore[legacyKey] : []);

    return rawRecord.map(normalizeAttendanceStatus);
}

function getEmployeeAttendanceSummary(employeeId, monthKey) {
    const attendanceStore = getData(STORAGE_KEY_TEACHER_ATTENDANCE) || {};
    const monthlyRecords = getTeacherAttendanceMonthRecord(attendanceStore, employeeId, monthKey)
        .filter((status) => status === 'Present' || status === 'Late' || status === 'Absent' || status === 'Leave');

    const present = monthlyRecords.filter((status) => status === 'Present').length;
    const late = monthlyRecords.filter((status) => status === 'Late').length;
    const absent = monthlyRecords.filter((status) => status === 'Absent').length;
    const leave = monthlyRecords.filter((status) => status === 'Leave').length;
    const countedDays = present + late + absent + leave;
    const payableDays = present + late;
    const attendanceRate = countedDays ? Math.round((payableDays / countedDays) * 100) : 0;

    return {
        present,
        late,
        absent,
        leave,
        countedDays,
        payableDays,
        attendanceRate
    };
}

function getSalaryBreakdown(entry, monthKey) {
    const grossSalary = parseInt(entry.salary || 0, 10) || 0;
    const attendance = getEmployeeAttendanceSummary(entry.id, monthKey);
    const deductionDays = attendance.absent + attendance.leave;
    const dailyRate = attendance.countedDays ? grossSalary / attendance.countedDays : 0;
    const deductionAmount = Math.round(dailyRate * deductionDays);
    const netSalary = Math.max(grossSalary - deductionAmount, 0);

    return {
        grossSalary,
        dailyRate,
        deductionDays,
        deductionAmount,
        netSalary,
        attendance
    };
}

function buildSalaryRoster() {
    const teachers = getArrayData(STORAGE_KEY_TEACHERS).map((teacher) => ({
        id: teacher.id,
        entityType: 'teacher',
        roleLabel: 'Teacher',
        fullName: teacher.fullName || 'Unnamed Teacher',
        salary: parseInt(teacher.salary || 0, 10) || 0,
        secondaryLabel: teacher.subject || teacher.campusName || 'Teacher',
        campusName: teacher.campusName || '',
        searchableText: `${teacher.fullName || ''} ${teacher.subject || ''} ${teacher.campusName || ''} teacher`.toLowerCase()
    }));

    const staff = getData(STORAGE_KEY_STAFF).map((member) => ({
        id: member.id,
        entityType: 'staff',
        roleLabel: member.designation || 'Staff',
        fullName: member.fullName || 'Unnamed Staff',
        salary: parseInt(member.salary || 0, 10) || 0,
        secondaryLabel: member.designation || 'Staff Member',
        campusName: member.campusName || '',
        searchableText: `${member.fullName || ''} ${member.designation || ''} staff`.toLowerCase()
    }));

    return [...teachers, ...staff].filter((entry) => entry.salary > 0);
}

function getMonthlySalarySummary(monthKey) {
    const salaries = getTeacherSalaries();
    const roster = buildSalaryRoster();
    let expected = 0;
    let transferred = 0;

    roster.forEach((entry) => {
        const breakdown = getSalaryBreakdown(entry, monthKey);
        expected += breakdown.netSalary;
        const payment = getSalaryPaymentRecord(salaries, entry.entityType, entry.id, monthKey);
        if (payment) {
            transferred += payment.amount || breakdown.netSalary;
        }
    });

    return {
        expected,
        transferred,
        pending: Math.max(expected - transferred, 0),
        roster
    };
}

function toggleSalaryPayment(entityId, monthKey, entityType = 'teacher') {
    const salaries = getTeacherSalaries();
    const key = getSalaryPaymentKey(entityType, entityId, monthKey);
    const legacyTeacherKey = `${entityId}_${monthKey}`;
    const rosterEntry = buildSalaryRoster().find((entry) => entry.id === entityId && entry.entityType === entityType);
    const breakdown = rosterEntry ? getSalaryBreakdown(rosterEntry, monthKey) : { netSalary: 0 };

    if (salaries[key] || (entityType === 'teacher' && salaries[legacyTeacherKey])) {
        delete salaries[key];
        if (entityType === 'teacher') delete salaries[legacyTeacherKey];
        pushNotification('Salary Update', 'Salary transfer record removed.', 'info');
    } else {
        const now = new Date();
        salaries[key] = {
            paid: true,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            entityType,
            amount: breakdown.netSalary
        };
        pushNotification('Salary Update', 'Salary transfer recorded successfully.', 'success');
    }

    saveTeacherSalaries(salaries);
    window.dispatchEvent(new CustomEvent('salary_payment_update', { detail: { entityId, monthKey, entityType } }));
    if (typeof renderTeacherSalaries === 'function') {
        renderTeacherSalaries();
    }
}
