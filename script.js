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
const STORAGE_KEY_TEACHER_SALARIES = 'eduCore_teacher_salaries';
const STORAGE_KEY_USERS = 'eduCore_users'; // New Key for student/teacher credentials
const STORAGE_KEY_PROMOTION_HISTORY = 'eduCore_promotion_history';
const STORAGE_KEY_SPECIAL_NOTICES = 'eduCore_special_notices';
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
    ? (window.location.protocol === 'file:' ? 'http://localhost:3000' : `${window.location.protocol}//${window.location.hostname}:3000`)
    : (window.ENV_BACKEND_URL || window.location.origin);

const API_BASE_URL = `${BACKEND_URL}/api`;
let socket;

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
        if (window.location.pathname.includes('students.html')) renderStudents();
    });

    socket.on('teachers_update', (data) => {
        localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(mergeTeacherRecords(data)));
        if (window.location.pathname.includes('teachers.html')) renderTeachers();
    });

    socket.on('staff_update', (data) => {
        localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(mergeStaffRecords(data)));
        if (window.location.pathname.includes('staff.html')) renderStaff();
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
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await parseJsonResponse(response, 'Server sync failed.');

        if (!response.ok || result?.success === false) {
            throw new Error(result?.message || result?.error || 'Server sync failed.');
        }

        return { success: true, result };
    } catch (e) {
        console.warn(`SQL sync failed for ${endpoint}: ${e.message}`);
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
        const sRes = await fetch(`${API_BASE_URL}/students`);
        if (sRes.ok) {
            const data = await sRes.json();
            const mergedStudents = mergeStudentRecords(data);
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(mergedStudents));
            const missingStudents = getMissingRecords(mergedStudents, data);
            if (missingStudents.length) {
                await syncToSQL('students', missingStudents);
            }
            if (typeof renderStudents === 'function') renderStudents();
        }

        const tRes = await fetch(`${API_BASE_URL}/teachers`);
        if (tRes.ok) {
            const data = await tRes.json();
            const mergedTeachers = mergeTeacherRecords(data);
            localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(mergedTeachers));
            if (typeof renderTeachers === 'function') renderTeachers();
        }

        const staffRes = await fetch(`${API_BASE_URL}/staff`);
        if (staffRes.ok) {
            const data = await staffRes.json();
            const mergedStaff = mergeStaffRecords(data);
            localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(mergedStaff));
            const missingStaff = getMissingRecords(mergedStaff, data);
            if (missingStaff.length) {
                await syncToSQL('staff', missingStaff);
            }
            if (typeof renderStaff === 'function') renderStaff();
        }

        await Promise.all([
            loadStudentAttendanceFromSQL(),
            loadTeacherAttendanceFromSQL()
        ]);
    } catch (e) {
        console.warn("SQL Server Connection Failed: Ensure 'node server.js' is running and MySQL is active.");
        console.log("SQL Initial Sync skipped (server offline). Using LocalStorage fallback.");
    }
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

// === FORCE RESET AUTH TO REQUESTED CREDENTIALS ===
(function forceResetAuth() {
    const creds = { email: 'apexiumstechnologies@gmail.com', password: 'myownschool1122' };
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(creds));
    // Clear any previous login failure states in session if they exist
    sessionStorage.removeItem('login_attempts');
})();

document.addEventListener('DOMContentLoaded', () => {

    // Perform initial sync from SQL Server
    initialSQLSync();
    ensureBranchRegistrationNav();
    ensureAttendanceNav();
    ensureNotificationsNav();
    ensureSpecialNoticesNav();
    ensureResetDataNav();
    applyBranchScopedStudentsView();

    // === INIT ICONS ===
    if (typeof lucide !== 'undefined' && window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }

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
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const btn = loginForm.querySelector('button');
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

                    btn.innerText = 'Redirecting...';

                    const getDefaultRoleHome = () => {
                        if (result.user.role === 'Admin') return 'dashboard.html';
                        if (result.user.role === 'Branch') return 'students.html';
                        if (result.user.role === 'Student') return 'student_portal.html';
                        return 'dashboard.html';
                    };

                    const getPermissionHome = () => {
                        if (!result.permissions) return '';
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
                        window.location.href = getPermissionHome() || getDefaultRoleHome();
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
        const existingStudents = getData(STORAGE_KEY_STUDENTS);
        const normalizedStudents = mergeStudentRecords(existingStudents);
        if (JSON.stringify(existingStudents) !== JSON.stringify(normalizedStudents)) {
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(normalizedStudents));
        }
        renderStudents(); // Initial Load
        studentForm.addEventListener('submit', handleStudentFormSubmit);
        const studentSearch = document.getElementById('studentSearchInput');
        const genderFilter = document.getElementById('genderFilter');
        const campusFilter = document.getElementById('campusFilter');
        const ageFilter = document.getElementById('ageFilter');
        if (studentSearch) {
            studentSearch.addEventListener('input', renderStudents);
        }
        if (genderFilter) {
            genderFilter.addEventListener('change', renderStudents);
        }
        if (campusFilter) {
            campusFilter.addEventListener('change', renderStudents);
        }
        if (ageFilter) {
            ageFilter.addEventListener('change', renderStudents);
        }
    }

    // === TEACHER PAGE ===
    const teacherForm = document.getElementById('teacherForm');
    if (teacherForm) {
        renderTeachers(); // Initial Load
        teacherForm.addEventListener('submit', handleTeacherFormSubmit);
        const tSearch = document.getElementById('teacherSearchInput');
        const tCampusFilter = document.getElementById('teacherCampusFilter');
        const tGenderFilter = document.getElementById('teacherGenderFilter');
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
        staffForm.addEventListener('submit', handleStaffFormSubmit);
        const sSearch = document.getElementById('staffSearchInput');
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
    }

    const branchRegistrationForm = document.getElementById('branchRegistrationForm');
    if (branchRegistrationForm) {
        renderBranches();
        branchRegistrationForm.addEventListener('submit', handleBranchRegistrationSubmit);
    }

    // === DASHBOARD HOME LOGIC ===
    const dashStudentCount = document.getElementById('dashStudentCount');
    if (dashStudentCount) {
        // We are on the dashboard
        updateDashboardStats();
        window.setInterval(updateActivePortalLogins, 30000);
        // renderDashboardTable(); // Table removed by user request

        const dSearch = document.getElementById('dashSearch');
        if (dSearch) {
            dSearch.addEventListener('input', (e) => { }); // renderDashboardTable(e.target.value.toLowerCase())
        }
    }

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
    return data ? JSON.parse(data) : [];
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
    const existingStudents = getData(STORAGE_KEY_STUDENTS);
    const incomingList = Array.isArray(incomingStudents) ? incomingStudents : [];
    let nextStudentCodeNumber = 1;

    existingStudents.forEach(student => {
        const match = String(student.studentCode || '').match(/(\d+)$/);
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
            studentCode = `STD-${String(nextStudentCodeNumber).padStart(4, '0')}`;
            nextStudentCodeNumber += 1;
        }

        return {
            ...student,
            studentCode,
            profileImage: student.profileImage || localStudent.profileImage || '',
            admissionDate: student.admissionDate || localStudent.admissionDate || '',
            gender: student.gender || localStudent.gender || '',
        campusName: student.campusName || localStudent.campusName || 'Main Campus',
            plainPassword: student.plainPassword || localStudent.plainPassword ||
                (localStudent.password && !isHashedPassword(localStudent.password) ? localStudent.password : '')
        };
    });

    existingStudents.forEach((student) => {
        if (!mergedStudents.some(item => item.id === student.id)) {
            mergedStudents.push(student);
        }
    });

    return mergedStudents;
}

function mergeTeacherRecords(incomingTeachers) {
    const existingTeachers = getData(STORAGE_KEY_TEACHERS);
    const incomingList = Array.isArray(incomingTeachers) ? incomingTeachers : [];

    return incomingList.map((teacher) => {
        const localTeacher = existingTeachers.find(item => item.id === teacher.id) || {};

        return {
            ...localTeacher,
            ...teacher,
            designation: teacher.designation || localTeacher.designation || 'Teacher',
            groupKey: teacher.groupKey || localTeacher.groupKey || 'teacher',
            profileImage: teacher.profileImage || localTeacher.profileImage || '',
            schedule: normalizeTeacherSchedule(teacher.schedule || localTeacher.schedule),
            plainPassword: teacher.plainPassword || localTeacher.plainPassword ||
                (localTeacher.password && !isHashedPassword(localTeacher.password) ? localTeacher.password : '')
        };
    });
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

function buildStudentAvatarMarkup(student) {
    if (student.profileImage) {
        return `<img src="${student.profileImage}" alt="${student.fullName || 'Student'}">`;
    }
    return getStudentInitial(student.fullName);
}

function setStudentPhotoPreview(imageSrc = '', fullName = '') {
    const preview = document.getElementById('studentPhotoPreview');
    if (!preview) return;

    if (imageSrc) {
        preview.innerHTML = `<img src="${imageSrc}" alt="${fullName || 'Student'}">`;
        return;
    }

    preview.textContent = getStudentInitial(fullName);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('There was a problem reading the image.'));
        reader.readAsDataURL(file);
    });
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
    const teachers = getData(STORAGE_KEY_TEACHERS);
    const students = getData(STORAGE_KEY_STUDENTS);
    const staffMembers = getData(STORAGE_KEY_STAFF);
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
    const students = getData(STORAGE_KEY_STUDENTS);
    const normalizedUsername = normalizeOptionalIdentityValue(username);
    const normalizedEmail = normalizeOptionalIdentityValue(email, 'email');

    const usernameConflict = students.find(student =>
        student.id !== studentId &&
        normalizeOptionalIdentityValue(student.username) === normalizedUsername
    );

    if (usernameConflict) {
        return 'This student username is already assigned to another student.';
    }

    if (normalizedEmail) {
        const emailConflict = students.find(student =>
            student.id !== studentId &&
            normalizeOptionalIdentityValue(student.email, 'email') === normalizedEmail
        );

        if (emailConflict) {
            return 'This student email is already assigned to another student.';
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

function ensureBranchRegistrationNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-branch-registration-link]')) return;

    const permissionsLink = navLinks.querySelector('a[href="permissions.html"]');
    const branchLink = document.createElement('a');
    branchLink.href = 'branch_registration.html';
    branchLink.className = 'nav-item';
    branchLink.dataset.branchRegistrationLink = 'true';
    branchLink.innerHTML = '<i data-lucide="building-2"></i><span>Branch Registration</span>';

    if (permissionsLink) {
        permissionsLink.insertAdjacentElement('beforebegin', branchLink);
    } else {
        navLinks.appendChild(branchLink);
    }

    if (window.lucide) window.lucide.createIcons();
}

function ensureAttendanceNav() {
    const navLinks = document.querySelector('.nav-links');
    const loggedInUser = getLoggedInUser();
    if (!navLinks || !loggedInUser || loggedInUser.role !== 'Admin') return;
    if (navLinks.querySelector('[data-attendance-nav]')) return;

    const permissionsLink = navLinks.querySelector('a[href="permissions.html"]');
    const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
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
        <a href="student_attendance.html" class="nav-subitem${currentPage === 'student_attendance.html' ? ' active' : ''}">
            <i data-lucide="users"></i>
            <span>Student Attendance</span>
        </a>
        <a href="teacher_attendance.html" class="nav-subitem${currentPage === 'teacher_attendance.html' ? ' active' : ''}">
            <i data-lucide="user-check"></i>
            <span>Teacher Attendance</span>
        </a>
        <a href="student_attendance_report.html" class="nav-subitem${currentPage === 'student_attendance_report.html' ? ' active' : ''}">
            <i data-lucide="file-bar-chart-2"></i>
            <span>Student Attendance Report</span>
        </a>
        <a href="teacher_attendance_report.html" class="nav-subitem${currentPage === 'teacher_attendance_report.html' ? ' active' : ''}">
            <i data-lucide="file-check-2"></i>
            <span>Teacher Attendance Report</span>
        </a>
    `;

    wrapper.appendChild(toggle);
    wrapper.appendChild(submenu);

    if (permissionsLink) {
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

    const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const revenueLink = navLinks.querySelector('a[href="revenue.html"]');
    const permissionsLink = navLinks.querySelector('a[href="permissions.html"]');
    const notificationLink = document.createElement('a');
    notificationLink.href = 'notifications.html';
    notificationLink.className = `nav-item${currentPage === 'notifications.html' ? ' active' : ''}`;
    notificationLink.dataset.notificationsLink = 'true';
    notificationLink.innerHTML = '<i data-lucide="bell-ring"></i><span>Notifications</span>';

    if (revenueLink) {
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

    const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const notificationsLink = navLinks.querySelector('a[href="notifications.html"]');
    const revenueLink = navLinks.querySelector('a[href="revenue.html"]');
    const permissionsLink = navLinks.querySelector('a[href="permissions.html"]');
    const noticeLink = document.createElement('a');
    noticeLink.href = 'special_notices.html';
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
        window.location.href = 'index.html';
    } catch (error) {
        await showAppAlert(error.message || 'System data could not be reset.', 'Reset Failed');
    }
}

function applyBranchScopedStudentsView() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser || loggedInUser.role !== 'Branch' || !window.location.pathname.toLowerCase().includes('students.html')) {
        return;
    }

    const allowedCampus = loggedInUser.campusName || '';
    const campusFilter = document.getElementById('campusFilter');
    const addStudentButton = document.querySelector('.student-toolbar > .btn.btn-primary');
    const formContainer = document.getElementById('studentFormContainer');

    document.querySelectorAll('.nav-links .nav-item').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const keepVisible = href === 'students.html' || href === '#' || href === 'settings.html';
        link.style.display = keepVisible ? '' : 'none';
    });

    if (campusFilter && allowedCampus) {
        campusFilter.value = allowedCampus;
        campusFilter.disabled = true;
    }

    if (addStudentButton) addStudentButton.style.display = 'none';
    if (formContainer) formContainer.style.display = 'none';

    const headerTitle = document.querySelector('.header h1');
    if (headerTitle && allowedCampus) {
        headerTitle.textContent = `${allowedCampus} Students`;
    }
}

async function renderBranches() {
    const tbody = document.getElementById('branchTableBody');
    if (!tbody) return;

    try {
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
                    <button class="action-btn btn-edit" onclick='editBranch(${JSON.stringify(branch)})' title="Edit">
                        <i data-lucide="edit-2" width="14"></i> Edit
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteBranch('${branch.id}')" title="Delete">
                        <i data-lucide="trash-2" width="14"></i>
                    </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1rem; color: #dc2626;">Branches could not be loaded.</td></tr>';
    }
}

async function handleBranchRegistrationSubmit(event) {
    event.preventDefault();

    const recordId = document.getElementById('branchRecordId').value.trim();
    const campusName = document.getElementById('branchCampusName').value;
    const fullName = document.getElementById('branchDisplayName').value.trim() || campusName;
    const username = document.getElementById('branchUsername').value.trim();
    const password = document.getElementById('branchPassword').value.trim();

    if (!recordId && !password) {
        alert('Password is required for a new branch login.');
        return;
    }

    try {
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
        renderBranches();
        showSuccessModal(recordId ? 'Branch Updated!' : 'Branch Registered!', recordId
            ? `${campusName} branch login details have been updated.`
            : `${campusName} can now log in with its branch username and password.`);
    } catch (error) {
        alert(error.message);
    }
}

function editBranch(branch) {
    document.getElementById('branchRecordId').value = branch.id || '';
    document.getElementById('branchCampusName').value = branch.campusName || 'Main Campus';
    document.getElementById('branchDisplayName').value = branch.fullName || '';
    document.getElementById('branchUsername').value = branch.username || '';
    document.getElementById('branchPassword').value = branch.plainPassword || '';

    const submitButton = document.querySelector('#branchRegistrationForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="save"></i> Update Branch Login';
    }
    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetBranchRegistrationForm() {
    const form = document.getElementById('branchRegistrationForm');
    if (!form) return;

    form.reset();
    document.getElementById('branchRecordId').value = '';
    document.getElementById('branchCampusName').value = 'Main Campus';

    const submitButton = document.querySelector('#branchRegistrationForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="save"></i> Save Branch Login';
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
    const students = getData(STORAGE_KEY_STUDENTS);
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
    const s = getData(STORAGE_KEY_STUDENTS);
    const t = getData(STORAGE_KEY_TEACHERS);
    const staff = getData(STORAGE_KEY_STAFF);

    if (document.getElementById('dashStudentCount')) document.getElementById('dashStudentCount').innerText = s.length || '0';
    if (document.getElementById('dashTeacherCount')) document.getElementById('dashTeacherCount').innerText = t.length || '0';
    if (document.getElementById('dashStaffCount')) document.getElementById('dashStaffCount').innerText = staff.length || '0';

    // Calculate Total Revenue (Sum of monthlyFee for students with feesStatus === 'Paid')
    if (document.getElementById('dashRevenue')) {
        const totalRevenue = s.reduce((sum, student) => {
            if (student.feesStatus === 'Paid') {
                return sum + (parseInt(student.monthlyFee) || 0);
            }
            return sum;
        }, 0);
        document.getElementById('dashRevenue').innerText = 'PKR ' + totalRevenue.toLocaleString();
    }

    updateActivePortalLogins();
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

        countEl.innerText = String(result.totalActiveLogins || 0);
        detailEl.title = roleCounts;
        detailEl.innerHTML = `<i data-lucide="monitor-up" size="16"></i> ${result.uniqueActiveUsers || 0} users active now`;
    } catch (error) {
        countEl.innerText = '0';
        detailEl.innerHTML = '<i data-lucide="monitor-up" size="16"></i> Live sessions unavailable';
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

    if (container.style.display === 'block' && !editMode) {
        container.style.display = 'none';
        form.reset();
        document.getElementById('studentId').value = '';
        setStudentPhotoPreview('');
    } else {
        const classSelect = document.getElementById('classGrade');
        if (classSelect && classSelect.tagName === 'SELECT') {
            const storedClasses = getData(STORAGE_KEY_CLASSES);
            const defaultClasses = [
                'Play Group', 'Nursery', 'Prep',
                'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
                'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
            ];

            classSelect.innerHTML = '<option value="">Select Class</option>';

            // Add Default Classes
            defaultClasses.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                classSelect.appendChild(opt);
            });

            // Add Custom Classes from Storage
            storedClasses.forEach(c => {
                const val = c.section ? `${c.name} (${c.section})` : c.name;
                if (!defaultClasses.includes(val)) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    classSelect.appendChild(opt);
                }
            });
        }
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
            title.innerText = 'Add New Student';
        } else {
            title.innerText = 'Edit Student Details';
        }
    }
}

function generateStudentCode() {
    const students = getData(STORAGE_KEY_STUDENTS);
    let maxNumber = 0;

    students.forEach(student => {
        const rawCode = student.studentCode || '';
        const match = rawCode.match(/(\d+)$/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed > maxNumber) {
                maxNumber = parsed;
            }
        }
    });

    return `STD-${String(maxNumber + 1).padStart(4, '0')}`;
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
    const currentStatus = isEdit && existingStudent ? existingStudent.feesStatus : 'Pending';

    const usernameInput = document.getElementById('username').value;
    const studentPasswordInput = document.getElementById('studentPassword').value;
    const monthlyFeeInput = document.getElementById('monthlyFee') ? document.getElementById('monthlyFee').value : '0';
    const studentEmailInput = document.getElementById('studentEmail') ? document.getElementById('studentEmail').value.trim().toLowerCase() : '';

    // Validation
    if (!usernameInput || !studentPasswordInput) {
        alert('Please create login credentials for the student.');
        if (!document.getElementById('credPanel').classList.contains('active')) toggleStepPanel('credPanel');
        return;
    }
    if (!monthlyFeeInput || monthlyFeeInput === '0') {
        alert('Please set the student fee structure.');
        if (!document.getElementById('feePanel').classList.contains('active')) toggleStepPanel('feePanel');
        return;
    }

    const studentIdentityError = validateStudentIdentityInputs({
        studentId: idField.value,
        username: usernameInput,
        email: studentEmailInput
    });

    if (studentIdentityError) {
        alert(studentIdentityError);
        return;
    }

    const newStudent = {
        id: isEdit ? idField.value : generateUniqueRecordId('STU'),
        studentCode: document.getElementById('studentCode').value || generateStudentCode(),
        fullName: document.getElementById('fullName').value,
        profileImage: existingStudent?.profileImage || '',
        fatherName: document.getElementById('fatherName').value,
        dob: document.getElementById('studentDob').value,
        admissionDate: document.getElementById('admissionDate') ? document.getElementById('admissionDate').value : (existingStudent?.admissionDate || ''),
        classGrade: document.getElementById('classGrade').value,
        campusName: document.getElementById('campusName').value,
        parentPhone: document.getElementById('parentPhone').value,
        email: studentEmailInput,
        gender: document.getElementById('gender').value,
        rollNo: document.getElementById('rollNo').value,
        formB: document.getElementById('formB').value,
        feesStatus: currentStatus,
        monthlyFee: monthlyFeeInput,
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
    saveData(STORAGE_KEY_STUDENTS, students);

    pushNotification('Student Updated', `Account for "${newStudent.fullName}" saved and activated.`, 'user');
    toggleStudentForm();
    renderStudents();
    showSuccessModal('Student Registered!', `The account for ${newStudent.fullName} is now active. They can log in using username: ${usernameInput}`);
}

function renderStudents(term = '') {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('studentSearchInput');
    const genderFilter = document.getElementById('genderFilter');
    const campusFilter = document.getElementById('campusFilter');
    const ageFilter = document.getElementById('ageFilter');
    const loggedInUser = getLoggedInUser();

    if (typeof term !== 'string') {
        term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    } else {
        term = term.toLowerCase().trim();
    }

    const selectedGender = genderFilter ? genderFilter.value : 'All';
    const selectedAge = ageFilter ? ageFilter.value : 'All';
    const selectedCampus = loggedInUser?.role === 'Branch'
        ? (loggedInUser.campusName || 'All')
        : (campusFilter ? campusFilter.value : 'All');

    const students = getData(STORAGE_KEY_STUDENTS);
    const filtered = students.filter(s =>
        (
            !term ||
            (s.fullName && s.fullName.toLowerCase().includes(term)) ||
            (s.rollNo && s.rollNo.toString().toLowerCase().includes(term)) ||
            (s.studentCode && s.studentCode.toLowerCase().includes(term))
        ) &&
        (selectedGender === 'All' || (s.gender || '').toLowerCase() === selectedGender.toLowerCase()) &&
        (selectedAge === 'All' || (selectedAge === 'below5' && isStudentBelowAge(s, 5))) &&
        (selectedCampus === 'All' || (s.campusName || 'Main Campus').toLowerCase() === selectedCampus.toLowerCase())
    );

    // Update total count display - Use filtered results length as requested
    const totalCountEl = document.getElementById('totalStudentCount');
    if (totalCountEl) totalCountEl.innerText = filtered.length;

    tbody.innerHTML = '';
    const noData = document.getElementById('noDataMessage');

    if (filtered.length === 0) {
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        filtered.forEach(s => {
            let statusClass = s.feesStatus === 'Paid' ? 'status-paid' : (s.feesStatus === 'Late' ? 'status-failed' : 'status-pending');
            const visiblePassword = getVisibleStudentPassword(s);
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
                    <td class="cell-compact">${s.campusName || 'Main Campus'}</td>
                <td>${s.gender || '-'}</td>
                <td>${s.parentPhone}</td>
                <td>${s.formB || '-'}</td>
                <td class="login-details">${loggedInUser?.role === 'Branch'
                    ? '<span style="color: var(--text-secondary);">Restricted</span>'
                    : `<strong>User:</strong> ${s.username || '-'}<br><strong>Pass:</strong> ${visiblePassword}`}</td>
                <td><span class="status-badge ${statusClass}">${s.feesStatus}</span></td>
                <td>${loggedInUser?.role === 'Branch'
                    ? '<span style="color: var(--text-secondary); font-size: 0.85rem;">View Only</span>'
                    : `<button class="action-btn btn-edit" onclick='editStudent(${JSON.stringify(s)})'><i data-lucide="edit-2" width="14"></i> Edit</button>
                    <button class="action-btn btn-delete" onclick="deleteStudent('${s.id}')"><i data-lucide="trash-2" width="14"></i></button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
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
    document.getElementById('campusName').value = s.campusName || 'Main Campus';
    document.getElementById('parentPhone').value = s.parentPhone;
    if (document.getElementById('studentEmail')) document.getElementById('studentEmail').value = s.email || '';
    document.getElementById('gender').value = s.gender || '';
    document.getElementById('rollNo').value = s.rollNo;
    document.getElementById('formB').value = s.formB || '';
    if (document.getElementById('monthlyFee')) document.getElementById('monthlyFee').value = s.monthlyFee || '0';
    if (document.getElementById('feeFrequency')) document.getElementById('feeFrequency').value = s.feeFrequency || 'Monthly';
    if (document.getElementById('username')) document.getElementById('username').value = s.username || '';
    if (document.getElementById('studentPassword')) document.getElementById('studentPassword').value = getVisibleStudentPassword(s);
}

async function deleteStudent(id) {
    if (!(await showAppConfirm('Delete this student?'))) return;

    let students = getData(STORAGE_KEY_STUDENTS);
    const existingStudents = [...students];
    students = students.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    renderStudents();

    try {
        const response = await fetch(`${API_BASE_URL}/students/${id}`, {
            method: 'DELETE'
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

function getTeacherScheduleSummary(teacher) {
    const schedule = normalizeTeacherSchedule(teacher.schedule);
    if (!schedule.length) {
        return '<div style="font-size:0.75rem;color:var(--text-secondary);">No lectures assigned</div>';
    }

    const uniqueDays = [...new Set(schedule.map(item => item.day).filter(Boolean))];
    return `<div style="font-size:0.75rem;color:var(--text-secondary);">${schedule.length} lectures ${uniqueDays.length ? `on ${uniqueDays.length} days` : ''}</div>`;
}

function openTeacherSchedule(teacherId) {
    const teachers = getData(STORAGE_KEY_TEACHERS);
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
    const teachers = getData(STORAGE_KEY_TEACHERS);
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
    const teachers = getData(STORAGE_KEY_TEACHERS);
    const filtered = teachers.filter(t =>
        (
            (t.fullName && t.fullName.toLowerCase().includes(term)) ||
            (t.subject && t.subject.toString().toLowerCase().includes(term))
        ) &&
        (!selectedCampus || (t.campusName || '') === selectedCampus) &&
        (!selectedGender || (t.gender || '') === selectedGender)
    );

    // Update total count display
    const totalCountEl = document.getElementById('totalTeacherCount');
    if (totalCountEl) totalCountEl.innerText = filtered.length;

    tbody.innerHTML = '';
    const noData = document.getElementById('noTeacherDataMessage');

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

    const getDocumentBadgesMarkup = (record, isTeacher = false) => {
        const badges = [];
        if (record.idCardFront) badges.push(`<button type="button" class="doc-download-btn" onclick="downloadStoredDocumentAsPdf('teacher', '${record.id}', 'idCardFront', 'teacher-id-front')">ID Front PDF</button>`);
        if (record.idCardBack) badges.push(`<button type="button" class="doc-download-btn" onclick="downloadStoredDocumentAsPdf('teacher', '${record.id}', 'idCardBack', 'teacher-id-back')">ID Back PDF</button>`);
        if (isTeacher && record.cvFile) badges.push(`<button type="button" class="doc-download-btn" onclick="downloadStoredDocumentAsPdf('teacher', '${record.id}', 'cvFile', 'teacher-cv')">CV PDF</button>`);

        if (!badges.length) return '<span class="doc-badge muted">No Files</span>';
        return `<div class="doc-badge-wrap">${badges.join('')}</div>`;
    };

    if (filtered.length === 0) {
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        filtered.forEach(t => {
            const teacherAvatar = t.profileImage
                ? `<img src="${t.profileImage}" alt="${t.fullName}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(15,23,42,0.08);">`
                : `<div style="width:30px;height:30px;background:#f0bdd1;color:#be185d;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold">${t.fullName.charAt(0).toUpperCase()}</div>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="teacher-name-cell">
                    ${teacherAvatar}
                    <div class="teacher-name-text">
                        <div style="font-weight:500">${t.fullName}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${t.employeeCode || ''} ${t.designation ? ` - ${t.designation}` : ''}</div>
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
                <td>${getDocumentBadgesMarkup(t, true)}</td>
                <td class="teacher-login-details">
                    <div>
                        <div><strong>User:</strong> ${t.username || '-'}</div>
                        <div><strong>Pass:</strong> ${t.plainPassword || t.password || '-'}</div>
                    </div>
                </td>
                <td style="font-weight:600;">PKR ${parseInt(t.salary || 0).toLocaleString()}</td>
                <td>${t.phone || '-'}</td>
                <td>
                    <button class="action-btn btn-view" onclick='viewTeacherAttendance(${JSON.stringify(t)})' title="View Attendance">
                        <i data-lucide="eye" width="14"></i>
                    </button>
                    <button class="action-btn btn-edit" onclick="openTeacherSchedule('${t.id}')" title="Assign Lectures">
                        <i data-lucide="calendar-clock" width="14"></i> Schedule
                    </button>
                    <button class="action-btn btn-edit" onclick='editTeacher(${JSON.stringify(t)})'><i data-lucide="edit-2" width="14"></i> Edit</button>
                    <button class="action-btn btn-delete" onclick="deleteTeacher('${t.id}')"><i data-lucide="trash-2" width="14"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        window.lucide.createIcons();
    }
}

function editTeacher(t) {
    toggleTeacherForm(true);
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
    setDesignationSelectValue('tDesignation', t.designation || 'Teacher', t.groupKey || 'teacher');
    document.getElementById('tSubject').value = t.subject;
    document.getElementById('tSalary').value = t.salary || '0';
    if (document.getElementById('tBankName')) document.getElementById('tBankName').value = t.bankName || '';
    if (document.getElementById('tBankAccountTitle')) document.getElementById('tBankAccountTitle').value = t.bankAccountTitle || '';
    if (document.getElementById('tBankAccountNumber')) document.getElementById('tBankAccountNumber').value = t.bankAccountNumber || '';
    if (document.getElementById('tBankBranch')) document.getElementById('tBankBranch').value = t.bankBranch || '';
    if (document.getElementById('tUsername')) document.getElementById('tUsername').value = t.username || '';
    if (document.getElementById('tPassword')) document.getElementById('tPassword').value = t.plainPassword || t.password || '';
    if (document.getElementById('tIdCardFront')) document.getElementById('tIdCardFront').value = '';
    if (document.getElementById('tIdCardBack')) document.getElementById('tIdCardBack').value = '';
    if (document.getElementById('tCvFile')) document.getElementById('tCvFile').value = '';
}

async function deleteTeacher(id) {
    if (!(await showAppConfirm('Delete this teacher?'))) return;

    const existingTeachers = getData(STORAGE_KEY_TEACHERS);
    const updatedTeachers = existingTeachers.filter(t => t.id !== id);
    saveData(STORAGE_KEY_TEACHERS, updatedTeachers, { skipSync: true });
    renderTeachers();

    fetch(`${API_BASE_URL}/teachers/${id}`, {
        method: 'DELETE'
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
    const teachers = getData(STORAGE_KEY_TEACHERS);
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
    } else {
        container.style.display = 'block';
        if (!editMode) {
            form.reset();
            document.getElementById('staffId').value = '';
            const staffCodeField = document.getElementById('staffCode');
            if (staffCodeField) staffCodeField.value = generateEntityCode(STORAGE_KEY_STAFF, 'STF');
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

    try {
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
            tr.innerHTML = `
                <td><div style="display:flex;align-items:center;gap:0.5rem">
                    <div style="width:30px;height:30px;background:#dcfce7;color:#166534;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold">${s.fullName.charAt(0).toUpperCase()}</div>
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
    if (document.getElementById('sIdCardFront')) document.getElementById('sIdCardFront').value = '';
    if (document.getElementById('sIdCardBack')) document.getElementById('sIdCardBack').value = '';
}

async function deleteStaff(id) {
    if (!(await showAppConfirm('Delete this staff member?'))) return;

    const existingStaff = getData(STORAGE_KEY_STAFF);
    const updatedStaff = existingStaff.filter(s => s.id !== id);
    saveData(STORAGE_KEY_STAFF, updatedStaff, { skipSync: true });
    renderStaff();

    fetch(`${API_BASE_URL}/staff/${id}`, {
        method: 'DELETE'
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
    const auth = authData ? JSON.parse(authData) : { email: 'Admin User' };
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) {
        userDisplay.innerText = auth.email;
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



function loadSettings() {
    const settings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const auth = localStorage.getItem(STORAGE_KEY_AUTH);

    if (settings) {
        const data = JSON.parse(settings);
        if (document.getElementById('sSchoolName')) document.getElementById('sSchoolName').value = data.schoolName || '';
        if (document.getElementById('sSession')) document.getElementById('sSession').value = data.session || '';
        if (document.getElementById('sPhone')) document.getElementById('sPhone').value = data.phone || '';
    }

    if (auth) {
        const authData = JSON.parse(auth);
        if (document.getElementById('sContactEmail')) document.getElementById('sContactEmail').value = authData.email || 'apexiumstechnologies@gmail.com';
    }
}

function handleSettingsSubmit(e) {
    e.preventDefault();

    // 1. Get current values from storage for verification
    const storedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
    const currentAuth = storedAuth ? JSON.parse(storedAuth) : { email: 'apexiumstechnologies@gmail.com', password: 'myownschool1122' };

    // 2. Get verification inputs
    const vEmail = document.getElementById('vOldEmail').value;
    const vPass = document.getElementById('vOldPassword').value;

    // 3. Verify
    if (vEmail.toLowerCase() !== currentAuth.email.toLowerCase() || vPass !== currentAuth.password) {
        alert('Verification Failed: Current Email or Password is incorrect. Changes not saved.');
        return;
    }

    // 4. If verified, proceed with update
    const settings = {};
    if (document.getElementById('sSchoolName')) settings.schoolName = document.getElementById('sSchoolName').value;
    if (document.getElementById('sSession')) settings.session = document.getElementById('sSession').value;
    if (document.getElementById('sPhone')) settings.phone = document.getElementById('sPhone').value;

    const emailEl = document.getElementById('sContactEmail');
    const passEl = document.getElementById('sPassword');

    const newEmail = emailEl ? emailEl.value : currentAuth.email;
    const newPassword = passEl ? passEl.value : '';

    const updatedAuth = { ...currentAuth };
    if (newEmail) updatedAuth.email = newEmail;
    if (newPassword) updatedAuth.password = newPassword;

    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updatedAuth));

    alert('Account Credentials Updated Successfully!');
    pushNotification('Security Update', 'Admin credentials have been updated.', 'login');

    // Reset security/verification fields
    if (passEl) passEl.value = '';
    if (document.getElementById('vOldEmail')) document.getElementById('vOldEmail').value = '';
    if (document.getElementById('vOldPassword')) document.getElementById('vOldPassword').value = '';

    // Refresh display
    renderLoginHistory();
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
    const teachers = getData(STORAGE_KEY_TEACHERS).map((teacher) => ({
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
    if (typeof renderTeacherSalaries === 'function') {
        renderTeacherSalaries();
    }
}
