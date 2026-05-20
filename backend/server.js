const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { Sequelize, DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');
const { getSmtpConfig, sendSmtpEmail } = require('./api/_lib/mailer');
const {
    sendFeePaymentConfirmationEmail,
    sendPendingFeeReminderEmails,
    startPendingFeeReminderScheduler
} = require('./api/_lib/fee-reminders');
const {
    sendBirthdayStudentEmails,
    sendSpecialNoticeStudentEmails,
    sendFineAppliedEmail,
    startStudentEmailNotificationScheduler
} = require('./api/_lib/student-emails');
const { startWhatsAppBirthdayScheduler } = require('./api/_lib/cronjob');

const PROJECT_ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PERMISSIONS_FILE = path.join(PROJECT_ROOT, 'permissions.json');
const DETAILED_PERMISSIONS_FILE = path.join(PROJECT_ROOT, 'permissions-detailed.json');
const DATE_SHEET_FILE = path.join(PROJECT_ROOT, 'date_sheet.json');
const ADMIN_CREDENTIALS_FILE = path.join(PROJECT_ROOT, 'admin_credentials.json');
const PRINCIPAL_USERNAME = process.env.PRINCIPAL_USERNAME || 'principal@school.com';
const PRINCIPAL_PASSWORD = process.env.PRINCIPAL_PASSWORD || 'Principal123';
const ADMIN_OTP_EXPIRY_MS = 10 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
const RESERVED_ROUTE_NAMES = new Set(['api', 'health', 'socket.io']);
const SIDEBAR_SCROLL_BOOTSTRAP = `
<script>
(function () {
    var key = 'eduCore_sidebar_scroll_position';
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    function readSaved() {
        try {
            return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || 'null');
        } catch (error) {
            return null;
        }
    }

    function saveCurrent(extra) {
        var nav = document.querySelector('.sidebar .nav-links');
        if (!nav) return;
        var payload = JSON.stringify(Object.assign({
            top: nav.scrollTop || 0,
            left: nav.scrollLeft || 0,
            path: location.pathname,
            savedAt: Date.now()
        }, extra || {}));
        sessionStorage.setItem(key, payload);
        localStorage.setItem(key, payload);
    }

    function normalizePage(value) {
        value = String(value || '').split('#')[0].split('?')[0].replace(/^\\/+|\\/+$/g, '').toLowerCase();
        if (!value || value === 'index' || value === 'home') return 'index.html';
        if (value === 'login') return 'login.html';
        return value.endsWith('.html') ? value : value + '.html';
    }

    function restore() {
        var nav = document.querySelector('.sidebar .nav-links');
        var saved = readSaved();
        if (!nav || !saved) return;

        var href = String(saved.targetHref || '').trim();
        var targetPage = normalizePage(href || location.pathname);
        var links = Array.prototype.slice.call(nav.querySelectorAll('a[href]'));
        var targetLink = links.find(function (link) {
            return normalizePage(link.getAttribute('href') || '') === targetPage;
        });

        if (targetLink && Number.isFinite(Number(saved.itemTop))) {
            nav.scrollTop += targetLink.getBoundingClientRect().top -
                nav.getBoundingClientRect().top -
                Number(saved.itemTop);
        } else if (Number.isFinite(Number(saved.top))) {
            nav.scrollTop = Number(saved.top) || 0;
        }
        nav.scrollLeft = Number(saved.left) || 0;
    }

    document.addEventListener('pointerdown', function (event) {
        var link = event.target && event.target.closest ? event.target.closest('.sidebar .nav-links a[href]') : null;
        var nav = document.querySelector('.sidebar .nav-links');
        if (!link || !nav) return;
        var navRect = nav.getBoundingClientRect();
        var linkRect = link.getBoundingClientRect();
        saveCurrent({
            targetHref: link.getAttribute('href') || '',
            itemTop: linkRect.top - navRect.top
        });
    }, true);

    window.addEventListener('pagehide', function () { saveCurrent(); });
    window.addEventListener('beforeunload', function () { saveCurrent(); });
    document.addEventListener('DOMContentLoaded', function () {
        [0, 30, 80, 160, 320, 700, 1200, 2200, 3500].forEach(function (delay) {
            setTimeout(restore, delay);
        });
    });
})();
</script>`;

function sendFrontendPage(res, fileName) {
    const filePath = path.join(FRONTEND_DIR, fileName);
    fs.readFile(filePath, 'utf8', (error, html) => {
        if (error) {
            res.status(error.code === 'ENOENT' ? 404 : 500).send(error.code === 'ENOENT' ? 'Page not found' : 'Page could not be loaded');
            return;
        }

        res.type('html').send(html.replace('</head>', `${SIDEBAR_SCROLL_BOOTSTRAP}\n</head>`));
    });
}

function resolvePageFileByRoute(routeName = '') {
    const normalized = String(routeName || '').trim().toLowerCase();
    if (!normalized) return '';
    if (RESERVED_ROUTE_NAMES.has(normalized)) return '';
    if (normalized === 'login') return 'login.html';
    if (normalized === 'index' || normalized === 'home') return 'index.html';
    if (!/^[a-z0-9_-]+$/i.test(normalized)) return '';

    const candidate = `${normalized}.html`;
    const candidatePath = path.join(FRONTEND_DIR, candidate);
    return fs.existsSync(candidatePath) ? candidate : '';
}

app.get('/', (_req, res) => {
    sendFrontendPage(res, 'index.html');
});

app.get('/:pageName([a-zA-Z0-9_-]+).html', (req, res, next) => {
    const pageName = String(req.params.pageName || '').toLowerCase();
    if (RESERVED_ROUTE_NAMES.has(pageName)) return next();

    const targetRoute = pageName === 'login'
        ? 'login'
        : (pageName === 'website' || pageName === 'index' ? 'index' : pageName);
    const targetFile = resolvePageFileByRoute(targetRoute);
    if (!targetFile) return next();

    if (targetRoute === 'index') return res.redirect(302, '/');
    return res.redirect(302, `/${targetRoute}`);
});

app.get('/:routeName([a-zA-Z0-9_-]+)', (req, res, next) => {
    const pageFile = resolvePageFileByRoute(req.params.routeName);
    if (!pageFile) return next();
    return sendFrontendPage(res, pageFile);
});

app.use(express.static(FRONTEND_DIR, { index: false }));

app.get('/health', (_req, res) => {
    res.json({
        success: true,
        initialized: isInitialized,
        timestamp: new Date().toISOString()
    });
});

let sequelize;
let startupPromise = null;
let isInitialized = false;
const ACTIVE_SESSION_TTL_MS = 90000;
const activeSessions = new Map();

const MODULE_KEYS = [
    'dashboard',
    'students',
    'student_scheduling',
    'banners',
    'teachers',
    'teacher_scheduling',
    'staff',
    'classes',
    'fees',
    'fee_challan',
    'library',
    'cafe',
    'transport',
    'certificate',
    'complain_box',
    'diary',
    'visitor_books',
    'annual_charges',
    'teacher_salaries',
    'student_attendance',
    'teacher_attendance',
    'student_attendance_report',
    'teacher_attendance_report',
    'notifications',
    'special_notices',
    'exams',
    'revenue',
    'settings',
    'permissions',
    'branch_registration',
    'aboutme',
    'student_portal',
    'teacher_portal'
];
const ACCESS_LEVELS = ['none', 'view', 'edit', 'manage'];
const ALLOWED_HOME_PAGES = new Set([
    'dashboard.html',
    'students.html',
    'student_scheduling.html',
    'student_timetable.html',
    'student_diary.html',
    'student_leave_requests.html',
    'student_courses.html',
    'banners.html',
    'teachers.html',
    'teacher_scheduling.html',
    'staff.html',
    'classes.html',
    'fees.html',
    'fee_challan.html',
    'library.html',
    'cafe.html',
    'transport.html',
    'certificate.html',
    'complain_box.html',
    'diary.html',
    'visitor_books.html',
    'annual_charges.html',
    'teacher_salaries.html',
    'student_attendance.html',
    'teacher_attendance.html',
    'student_attendance_report.html',
    'teacher_attendance_report.html',
    'notifications.html',
    'special_notices.html',
    'exams.html',
    'revenue.html',
    'settings.html',
    'permissions.html',
    'branch_registration.html',
    'aboutme.html',
    'student_portal.html',
    'teacher_portal.html'
]);

function buildModuleSet(defaultAccess = 'none', overrides = {}) {
    const acc = MODULE_KEYS.reduce((next, key) => {
        const requested = overrides[key];
        next[key] = ACCESS_LEVELS.includes(requested) ? requested : defaultAccess;
        return next;
    }, {});
    Object.entries(overrides || {}).forEach(([key, value]) => {
        if (!acc[key] && ACCESS_LEVELS.includes(value)) acc[key] = value;
    });
    return acc;
}

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
            permissions: buildModuleSet('manage')
        },
        admin: {
            name: 'Admin',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'manage',
                students: 'manage',
                student_scheduling: 'manage',
                banners: 'manage',
                teachers: 'manage',
                teacher_scheduling: 'manage',
                staff: 'manage',
                classes: 'manage',
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
                revenue: 'view',
                settings: 'view',
                branch_registration: 'view',
                permissions: 'view',
                aboutme: 'view'
            })
        },
        computer_operator: {
            name: 'Computer Operator',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
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
            })
        },
        teacher: {
            name: 'Teachers',
            homePage: 'teacher_portal.html',
            permissions: buildModuleSet('none', {
                teacher_portal: 'manage',
                students: 'view',
                classes: 'view',
                student_attendance: 'edit',
                student_attendance_report: 'view',
                exams: 'view',
                special_notices: 'view',
                aboutme: 'view'
            })
        },
        student: {
            name: 'Students',
            homePage: 'student_portal.html',
            permissions: buildModuleSet('none', {
                student_portal: 'manage',
                fees: 'view',
                fee_challan: 'view',
                exams: 'view',
                special_notices: 'view',
                aboutme: 'view'
            })
        }
    }
};

function normalizePermissionsConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    const groupsInput = raw.groups && typeof raw.groups === 'object' ? raw.groups : {};
    const customModules = Array.isArray(raw.customModules) ? raw.customModules : [];
    const allowedHomePages = new Set(ALLOWED_HOME_PAGES);
    customModules.forEach((module) => {
        if (module && module.page) allowedHomePages.add(String(module.page));
    });
    const groups = Object.entries({
        ...defaultPermissions.groups,
        ...groupsInput
    }).reduce((acc, [key, groupValue]) => {
        const baseGroup = defaultPermissions.groups[key] || {
            name: key,
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none'),
            actionPermissions: undefined
        };
        const nextGroup = groupValue && typeof groupValue === 'object' ? groupValue : {};
        const requestedHomePage = String(nextGroup.homePage || baseGroup.homePage || 'dashboard.html');
        const actionPermissions = nextGroup.actionPermissions && typeof nextGroup.actionPermissions === 'object'
            ? nextGroup.actionPermissions
            : (baseGroup.actionPermissions && typeof baseGroup.actionPermissions === 'object' ? baseGroup.actionPermissions : undefined);
        acc[key] = {
            name: String(nextGroup.name || baseGroup.name || key),
            homePage: allowedHomePages.has(requestedHomePage) ? requestedHomePage : 'dashboard.html',
            permissions: buildModuleSet('none', {
                ...baseGroup.permissions,
                ...(nextGroup.permissions || {})
            }),
            ...(actionPermissions ? { actionPermissions } : {})
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
        customModules,
        groups
    };
}

function isPasswordHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

function normalizeOptionalEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

async function ensureUniqueTeacherIdentity(Teacher, User, item) {
    const teacherId = item.id || null;
    const normalizedEmail = normalizeOptionalEmail(item.email);
    const normalizedUsername = String(item.username || '').trim();

    if (!normalizedUsername) {
        throw new Error('Teacher username is required.');
    }

    const usernameConflict = await Teacher.findOne({
        where: {
            username: normalizedUsername,
            ...(teacherId ? { id: { [Op.ne]: teacherId } } : {})
        }
    });

    if (usernameConflict) {
        throw new Error('This teacher username is already assigned to another teacher.');
    }

    const userUsernameConflict = await User.findOne({
        where: {
            username: normalizedUsername,
            ...(teacherId ? { profileId: { [Op.ne]: teacherId } } : {})
        }
    });

    if (userUsernameConflict) {
        throw new Error('This username is already used by another account.');
    }

    if (normalizedEmail) {
        const emailConflict = await Teacher.findOne({
            where: {
                email: normalizedEmail,
                ...(teacherId ? { id: { [Op.ne]: teacherId } } : {})
            }
        });

        if (emailConflict) {
            throw new Error('This teacher email is already assigned to another teacher.');
        }

        const userEmailConflict = await User.findOne({
            where: {
                email: normalizedEmail,
                ...(teacherId ? { profileId: { [Op.ne]: teacherId } } : {})
            }
        });

        if (userEmailConflict) {
            throw new Error('This email is already used by another account.');
        }
    }
}

async function ensureUniqueStudentIdentity(Student, User, item) {
    const studentId = item.id || null;
    const normalizedEmail = normalizeOptionalEmail(item.email);
    const normalizedUsername = String(item.username || '').trim();

    if (normalizedUsername) {
        const usernameConflict = await Student.findOne({
            where: {
                username: normalizedUsername,
                ...(studentId ? { id: { [Op.ne]: studentId } } : {})
            }
        });

        if (usernameConflict) {
            throw new Error('This student username is already assigned to another student.');
        }

        const userUsernameConflict = await User.findOne({
            where: {
                username: normalizedUsername,
                ...(studentId ? { profileId: { [Op.ne]: studentId } } : {})
            }
        });

        if (userUsernameConflict) {
            throw new Error('This username is already used by another account.');
        }
    }

    if (normalizedEmail) {
        const emailConflict = await Student.findOne({
            where: {
                email: normalizedEmail,
                ...(studentId ? { id: { [Op.ne]: studentId } } : {})
            }
        });

        if (emailConflict) {
            throw new Error('This student email is already assigned to another student.');
        }

        const userEmailConflict = await User.findOne({
            where: {
                email: normalizedEmail,
                ...(studentId ? { profileId: { [Op.ne]: studentId } } : {})
            }
        });

        if (userEmailConflict) {
            throw new Error('This email is already used by another account.');
        }
    }
}

function isLocalDbHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function shouldAutoCreateDatabase(hostname) {
    const explicit = String(process.env.AUTO_CREATE_DB || '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return isLocalDbHost(hostname);
}

async function initializeDatabase() {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = Number(process.env.DB_PORT || 3306);
    const dbName = process.env.DB_NAME || 'school_system';

    if (!shouldAutoCreateDatabase(dbHost)) {
        console.log('Skipping CREATE DATABASE on non-local/shared hosting.');
        return;
    }

    try {
        const connection = await mysql.createConnection({
            host: dbHost,
            port: dbPort,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await connection.end();
    } catch (err) {
        console.warn('Database initialization warning:', err.message);
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication token required.' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);

        pruneActiveSessions();
        const sessionId = String(req.user?.sessionId || '').trim();
        const allowIfInactive = req.path === '/api/session/end';
        if (sessionId && !activeSessions.has(sessionId) && !allowIfInactive) {
            registerActiveSession(req, sessionId, {
                id: req.user.id,
                username: req.user.username || '',
                fullName: req.user.fullName || req.user.username || req.user.role || 'User',
                role: req.user.role,
                campusName: req.user.campusName || ''
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
}

function pruneActiveSessions() {
    const now = Date.now();
    activeSessions.forEach((session, sessionId) => {
        if (!session.lastSeen || now - session.lastSeen > ACTIVE_SESSION_TTL_MS) {
            activeSessions.delete(sessionId);
        }
    });
}

function createSessionId(role, id) {
    return `${String(role || 'user').toLowerCase()}_${String(id || '0')}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function registerActiveSession(req, sessionId, user) {
    if (!sessionId || !user) return;

    activeSessions.set(sessionId, {
        sessionId,
        userId: String(user.id || ''),
        username: user.username || '',
        fullName: user.fullName || '',
        role: user.role || '',
        campusName: user.campusName || '',
        loginAt: Date.now(),
        lastSeen: Date.now(),
        ip: req.ip || req.socket?.remoteAddress || '',
        userAgent: req.get('user-agent') || ''
    });
}

function buildActiveSessionsSummary() {
    pruneActiveSessions();
    const sessions = Array.from(activeSessions.values())
        .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0))
        .map((session) => ({
            ...session,
            loginAt: new Date(session.loginAt).toISOString(),
            lastSeen: new Date(session.lastSeen).toISOString()
        }));
    const byRole = sessions.reduce((acc, session) => {
        const role = session.role || 'Unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {});
    const uniqueUsers = new Set(sessions.map((session) => `${session.role}:${session.userId || session.username}`));
    const uniqueSessionMap = new Map();
    sessions.forEach((session) => {
        const key = `${session.role}:${session.userId || session.username}`;
        if (!uniqueSessionMap.has(key)) {
            uniqueSessionMap.set(key, session);
        }
    });
    const uniqueSessions = Array.from(uniqueSessionMap.values());

    return {
        success: true,
        totalActiveLogins: sessions.length,
        totalActiveSessions: sessions.length,
        uniqueActiveUsers: uniqueUsers.size,
        byRole,
        sessions,
        uniqueSessions
    };
}

function canManageActiveSessions(user = {}) {
    const role = String(user?.role || '').trim().toLowerCase();
    return role === 'admin'
        || role === 'superadmin'
        || role === 'super admin'
        || role === 'system administrator'
        || role === 'system_admin';
}

function readPermissions() {
    try {
        if (!fs.existsSync(PERMISSIONS_FILE)) {
            return writePermissions(defaultPermissions);
        }

        const raw = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
        const saved = JSON.parse(raw);

        return normalizePermissionsConfig(saved);
    } catch (error) {
        return defaultPermissions;
    }
}

function writePermissions(data) {
    const nextPermissions = normalizePermissionsConfig(data);

    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(nextPermissions, null, 2), 'utf8');
    return nextPermissions;
}

function loadDetailedPermissions() {
    try {
        if (!fs.existsSync(DETAILED_PERMISSIONS_FILE)) {
            return { system: {}, designations: {} };
        }

        const raw = fs.readFileSync(DETAILED_PERMISSIONS_FILE, 'utf8');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : { system: {}, designations: {} };
    } catch (error) {
        console.warn('Failed to load detailed permissions:', error.message);
        return { system: {}, designations: {} };
    }
}

function saveDetailedPermissions(data) {
    const payload = data && typeof data === 'object' ? data : {};
    fs.writeFileSync(DETAILED_PERMISSIONS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function normalizeDesignationKey(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '');
}

function checkDesignationActionPermission(designationKey, moduleKey, actionKey) {
    const detailed = loadDetailedPermissions();
    const designation = detailed?.designations?.[designationKey];
    const allowed = designation?.actionPermissions?.[moduleKey]?.[actionKey] === true;
    return allowed;
}

async function resolveUserDesignationKey(user = {}) {
    if (!sequelize) return '';
    const role = String(user?.role || '').trim();
    const id = String(user?.id || '').trim();
    if (!id) return '';

    try {
        if (role === 'Teacher') {
            const teacher = await sequelize.models.Teacher.findByPk(id);
            return normalizeDesignationKey(teacher?.designation || 'teacher');
        }
        if (role === 'Staff') {
            const staff = await sequelize.models.Staff.findByPk(id);
            return normalizeDesignationKey(staff?.designation || 'staff');
        }
        return '';
    } catch (error) {
        console.warn('Failed to resolve user designation:', error.message);
        return '';
    }
}

async function enforceActionPermission(req, res, moduleKey, actionKey) {
    const role = String(req.user?.role || '').trim();

    if (role === 'Admin' || role === 'Principal') return true;
    if (role === 'Branch') {
        res.status(403).json({ success: false, message: 'Branch access denied.' });
        return false;
    }
    if (role === 'Student') {
        res.status(403).json({ success: false, message: 'Student access denied.' });
        return false;
    }

    if (role === 'Teacher' || role === 'Staff') {
        const designationKey = await resolveUserDesignationKey(req.user);
        if (!designationKey) {
            res.status(403).json({ success: false, message: 'Designation not set. Ask admin to assign a designation.' });
            return false;
        }

        const allowed = checkDesignationActionPermission(designationKey, moduleKey, actionKey);
        if (!allowed) {
            res.status(403).json({
                success: false,
                message: `Permission denied: ${designationKey} cannot ${actionKey} in ${moduleKey}.`
            });
            return false;
        }

        return true;
    }

    // Keep legacy behavior for other roles (e.g., Branch) unless explicitly restricted.
    return true;
}

function getDefaultAdminCredentials() {
    return {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
    };
}

function readAdminCredentials() {
    const defaults = getDefaultAdminCredentials();
    try {
        if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
            return defaults;
        }

        const raw = fs.readFileSync(ADMIN_CREDENTIALS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const username = String(parsed?.username || '').trim();
        const password = String(parsed?.password || '');

        if (!username || !password) {
            return defaults;
        }

        return { username, password };
    } catch (_error) {
        return defaults;
    }
}

function writeAdminCredentials(data = {}) {
    const username = String(data.username || '').trim();
    const password = String(data.password || '');

    if (!username) {
        const error = new Error('Admin username is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!password) {
        const error = new Error('Admin password is required.');
        error.statusCode = 400;
        throw error;
    }

    const next = { username, password };
    fs.writeFileSync(ADMIN_CREDENTIALS_FILE, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

async function readAdminCredentialsFromStore() {
    const defaults = readAdminCredentials();
    if (!sequelize?.models?.AppSetting) return defaults;

    const row = await sequelize.models.AppSetting.findByPk('admin_credentials');
    if (!row?.settingValue) return defaults;

    try {
        const parsed = JSON.parse(row.settingValue);
        const username = String(parsed?.username || '').trim();
        const password = String(parsed?.password || '');
        return username && password ? { username, password } : defaults;
    } catch (_error) {
        return defaults;
    }
}

async function writeAdminCredentialsToStore(data = {}) {
    const username = String(data.username || '').trim();
    const password = String(data.password || '');

    if (!username) {
        const error = new Error('Admin username is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!password) {
        const error = new Error('Admin password is required.');
        error.statusCode = 400;
        throw error;
    }

    const next = { username, password };
    if (sequelize?.models?.AppSetting) {
        await sequelize.models.AppSetting.upsert({
            settingKey: 'admin_credentials',
            settingValue: JSON.stringify(next)
        });
    }

    writeAdminCredentials(next);
    return next;
}

function getAdminRecoveryEmail() {
    return String(process.env.ADMIN_RECOVERY_EMAIL || process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'softwaredemo17@gmail.com').trim();
}

function maskEmail(value = '') {
    const email = String(value || '').trim();
    return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

function createAdminOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function saveAdminOtp(purpose, otp) {
    if (!sequelize?.models?.AppSetting) {
        const error = new Error('Database offline');
        error.statusCode = 503;
        throw error;
    }

    await sequelize.models.AppSetting.upsert({
        settingKey: `admin_otp:${purpose}`,
        settingValue: JSON.stringify({
            otp,
            purpose,
            expiresAt: Date.now() + ADMIN_OTP_EXPIRY_MS
        })
    });
}

async function verifyAdminOtp(purpose, otp) {
    await checkAdminOtp(purpose, otp);
    await sequelize.models.AppSetting.destroy({ where: { settingKey: `admin_otp:${purpose}` } });
}

async function checkAdminOtp(purpose, otp) {
    const code = String(otp || '').trim();
    if (!code) {
        const error = new Error('OTP is required.');
        error.statusCode = 400;
        throw error;
    }

    const row = await sequelize.models.AppSetting.findByPk(`admin_otp:${purpose}`);
    let payload = null;
    try {
        payload = row?.settingValue ? JSON.parse(row.settingValue) : null;
    } catch (_error) {
        payload = null;
    }

    if (!payload?.otp || String(payload.otp) !== code || Date.now() > Number(payload.expiresAt || 0)) {
        const error = new Error('Invalid or expired OTP.');
        error.statusCode = 400;
        throw error;
    }
}

async function sendAdminOtpEmail(purpose) {
    const otp = createAdminOtp();
    await saveAdminOtp(purpose, otp);
    const to = getAdminRecoveryEmail();
    const purposeLabel = purpose === 'forgot-password' ? 'admin password reset' : 'admin password change';

    await sendSmtpEmail({
        to,
        subject: 'Admin Password OTP',
        text: [
            `Your OTP for ${purposeLabel} is: ${otp}`,
            '',
            'This OTP will expire in 10 minutes.',
            '',
            'Apexiums School'
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
                <p>Your OTP for ${purposeLabel} is:</p>
                <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</div>
                <p>This OTP will expire in 10 minutes.</p>
                <p>Apexiums School</p>
            </div>
        `
    });

    return { sentTo: maskEmail(to) };
}

function verifyAdminAccessToken(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    let user = null;
    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch (_error) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    if (user.role !== 'Admin') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }

    return user;
}

app.get('/api/permissions', (req, res) => {
    res.json(readPermissions());
});

app.post('/api/permissions', (req, res) => {
    try {
        verifyAdminAccessToken(req);
        const saved = writePermissions(req.body || {});
        res.json({ success: true, permissions: saved });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to save permissions.' });
    }
});

app.get('/api/designation-permissions', authenticateToken, async (req, res) => {
    try {
        const designationParam = req.query?.designation;
        const actionParam = req.query?.action;
        const designationKey = normalizeDesignationKey(designationParam);

        if (designationKey && actionParam) {
            const [moduleKeyRaw, actionKeyRaw] = String(actionParam).split('.');
            const moduleKey = String(moduleKeyRaw || '').trim();
            const actionKey = String(actionKeyRaw || '').trim();
            const allowed = moduleKey && actionKey
                ? checkDesignationActionPermission(designationKey, moduleKey, actionKey)
                : false;
            return res.json({ allowed });
        }

        if (designationKey) {
            const detailed = loadDetailedPermissions();
            const perms = detailed?.designations?.[designationKey] || null;
            return res.json(perms || { key: designationKey, name: designationKey, description: '', actionPermissions: {} });
        }

        verifyAdminAccessToken(req);
        const detailed = loadDetailedPermissions();
        const designations = Object.entries(detailed?.designations || {}).map(([key, value]) => ({
            key,
            name: value?.name || key,
            description: value?.description || ''
        }));

        return res.json({
            designations,
            permissions: detailed?.designations || {}
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load designation permissions.' });
    }
});

app.post('/api/designation-permissions', authenticateToken, (req, res) => {
    try {
        verifyAdminAccessToken(req);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const incomingDesignations = body.permissions && typeof body.permissions === 'object'
            ? body.permissions
            : (body.designations && typeof body.designations === 'object' ? body.designations : null);

        const existing = loadDetailedPermissions();
        const next = incomingDesignations
            ? { ...(existing || {}), designations: incomingDesignations }
            : body;

        const saved = saveDetailedPermissions(next);
        const designations = Object.entries(saved?.designations || {}).map(([key, value]) => ({
            key,
            name: value?.name || key,
            description: value?.description || ''
        }));

        res.json({
            success: true,
            designations,
            permissions: saved?.designations || {}
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to save designation permissions.' });
    }
});

app.get('/api/admin-credentials', async (req, res) => {
    try {
        verifyAdminAccessToken(req);
        const credentials = await readAdminCredentialsFromStore();
        res.json({ success: true, credentials: { username: credentials.username }, recoveryEmail: maskEmail(getAdminRecoveryEmail()) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load admin credentials.' });
    }
});

app.post('/api/admin-credentials/verify-otp', async (req, res) => {
    try {
        verifyAdminAccessToken(req);
        await checkAdminOtp('change-password', req.body?.otp);
        res.json({ success: true, message: 'OTP verified. Enter your new password.' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'OTP could not be verified.' });
    }
});

app.post('/api/admin-credentials/request-otp', async (req, res) => {
    try {
        verifyAdminAccessToken(req);
        const result = await sendAdminOtpEmail('change-password');
        res.json({ success: true, message: `OTP sent to ${result.sentTo}.`, ...result });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'OTP could not be sent.' });
    }
});

app.post('/api/admin-credentials', async (req, res) => {
    try {
        verifyAdminAccessToken(req);
        const current = await readAdminCredentialsFromStore();
        const nextUsername = String(req.body?.username || '').trim();
        const nextPassword = String(req.body?.password || '').trim();
        const confirmPassword = String(req.body?.confirmPassword || '').trim();
        if (nextPassword) {
            if (nextPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            }
            if (nextPassword !== confirmPassword) {
                return res.status(400).json({ success: false, message: 'New password and confirm password do not match.' });
            }
            await verifyAdminOtp('change-password', req.body?.otp);
        }
        const saved = await writeAdminCredentialsToStore({
            username: nextUsername || current.username,
            password: nextPassword || current.password
        });
        res.json({ success: true, credentials: { username: saved.username } });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to save admin credentials.' });
    }
});

app.post('/api/admin-password/forgot/request-otp', async (req, res) => {
    try {
        const current = await readAdminCredentialsFromStore();
        const username = String(req.body?.username || '').trim();
        if (username && username !== current.username) {
            return res.json({ success: true, message: 'If the admin account exists, an OTP has been sent.' });
        }

        const result = await sendAdminOtpEmail('forgot-password');
        res.json({ success: true, message: `OTP sent to ${result.sentTo}.`, ...result });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'OTP could not be sent.' });
    }
});

app.post('/api/admin-password/forgot/reset', async (req, res) => {
    try {
        const current = await readAdminCredentialsFromStore();
        const username = String(req.body?.username || '').trim() || current.username;
        const password = String(req.body?.password || '').trim();

        if (username !== current.username) {
            return res.status(400).json({ success: false, message: 'Invalid admin username.' });
        }

        if (!password) {
            return res.status(400).json({ success: false, message: 'New password is required.' });
        }

        await verifyAdminOtp('forgot-password', req.body?.otp);
        await writeAdminCredentialsToStore({ username: current.username, password });
        res.json({ success: true, message: 'Admin password updated successfully.' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Password could not be reset.' });
    }
});

function normalizeDateSheetPayload(data = {}) {
    const raw = data && typeof data === 'object' ? data : {};
    const scheduleRows = Array.isArray(raw.scheduleRows)
        ? raw.scheduleRows.map((row) => ({
            subject: String(row.subject || '').trim(),
            className: String(row.className || '').trim(),
            examDate: String(row.examDate || '').trim(),
            startTime: String(row.startTime || '').trim(),
            endTime: String(row.endTime || '').trim()
        })).filter((row) => row.subject || row.className || row.examDate || row.startTime || row.endTime)
        : [];

    return {
        dateSheetSchoolName: String(raw.dateSheetSchoolName || '').trim(),
        dateSheetExamTitle: String(raw.dateSheetExamTitle || '').trim(),
        dateSheetSession: String(raw.dateSheetSession || '').trim(),
        dateSheetClassGroup: String(raw.dateSheetClassGroup || '').trim(),
        dateSheetCampus: String(raw.dateSheetCampus || '').trim(),
        dateSheetDefaultStart: String(raw.dateSheetDefaultStart || '').trim(),
        dateSheetInstructions: String(raw.dateSheetInstructions || '').trim(),
        scheduleRows,
        status: ['executed', 'hidden'].includes(raw.status) ? raw.status : 'draft',
        executedAt: raw.executedAt || (raw.status === 'executed' ? new Date().toISOString() : null),
        hiddenAt: raw.status === 'hidden' ? (raw.hiddenAt || new Date().toISOString()) : null,
        updatedAt: new Date().toISOString()
    };
}

function readDateSheet() {
    try {
        if (!fs.existsSync(DATE_SHEET_FILE)) return null;
        const saved = JSON.parse(fs.readFileSync(DATE_SHEET_FILE, 'utf8'));
        return normalizeDateSheetPayload(saved);
    } catch (error) {
        return null;
    }
}

function writeDateSheet(data) {
    const normalized = normalizeDateSheetPayload(data);
    fs.writeFileSync(DATE_SHEET_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

app.get('/api/date-sheet', (req, res) => {
    res.json({ success: true, dateSheet: readDateSheet() });
});

app.post('/api/date-sheet', (req, res) => {
    try {
        const saved = writeDateSheet(req.body || {});
        io.emit('date_sheet_update', saved);
        res.json({ success: true, dateSheet: saved });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Date sheet could not be executed.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const adminCredentials = await readAdminCredentialsFromStore();
        const adminUsername = adminCredentials.username;
        const adminPass = adminCredentials.password;

        if (username === adminUsername && password === adminPass) {
            const permissions = readPermissions();
            const groupKey = permissions.roleGroups.Admin || 'admin';
            const sessionId = createSessionId('Admin', 'admin');
            const token = jwt.sign({ id: 'admin', role: 'Admin', sessionId }, JWT_SECRET, { expiresIn: '1d' });
            const user = { id: 'admin', fullName: 'Administrator', role: 'Admin', username: adminUsername, groupKey };
            registerActiveSession(req, sessionId, user);
            return res.json({
                success: true,
                token,
                sessionId,
                permissions,
                user
            });
        }

        if (username === PRINCIPAL_USERNAME && password === PRINCIPAL_PASSWORD) {
            const permissions = readPermissions();
            if (permissions.loginAccess.principal === false) {
                return res.status(403).json({ success: false, message: 'Principal login is currently disabled by admin.' });
            }
            const groupKey = permissions.roleGroups.Principal || 'principal';
            const sessionId = createSessionId('Principal', 'principal');
            const token = jwt.sign({ id: 'principal', role: 'Principal', sessionId }, JWT_SECRET, { expiresIn: '1d' });
            const user = { id: 'principal', fullName: 'Principal', role: 'Principal', username: PRINCIPAL_USERNAME, groupKey };
            registerActiveSession(req, sessionId, user);
            return res.json({
                success: true,
                token,
                sessionId,
                permissions,
                user
            });
        }

        if (!sequelize) {
            return res.status(503).json({ success: false, message: 'Database is offline. Only Admin can log in.' });
        }

        const normalizedIdentity = String(username || '').trim();
        const userWhere = {
            [Op.or]: [
                { username: normalizedIdentity }
            ]
        };

        if (normalizedIdentity.includes('@')) {
            userWhere[Op.or].push({ email: normalizedIdentity.toLowerCase() });
        }

        const User = sequelize.models.User;
        const Student = sequelize.models.Student;
        const Teacher = sequelize.models.Teacher;
        const user = await User.findOne({ where: userWhere });

        if (user) {
            const permissions = readPermissions();
            const roleKey = String(user.role || '').toLowerCase();
            if (permissions.loginAccess[roleKey] === false) {
                return res.status(403).json({ success: false, message: `${user.role} login is currently disabled by admin.` });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                let profileName = user.fullName;
                let designationKey = '';

                if (user.role === 'Student') {
                    const student = await Student.findByPk(user.profileId);
                    profileName = student?.fullName || profileName;
                } else if (user.role === 'Teacher') {
                    const teacher = await Teacher.findByPk(user.profileId);
                    profileName = teacher?.fullName || profileName;
                    designationKey = normalizeDesignationKey(teacher?.designation || 'teacher');
                } else if (user.role === 'Staff') {
                    const staff = await sequelize.models.Staff.findByPk(user.profileId);
                    profileName = staff?.fullName || profileName;
                    designationKey = normalizeDesignationKey(staff?.designation || 'staff');
                }

                const sessionId = createSessionId(user.role, user.profileId);
                const token = jwt.sign({ id: user.profileId, role: user.role, campusName: user.campusName || '', sessionId }, JWT_SECRET, { expiresIn: '1d' });
                const responseUser = {
                    id: user.profileId,
                    fullName: profileName,
                    role: user.role,
                    username: user.username,
                    campusName: user.campusName || '',
                    groupKey: user.groupKey || permissions.roleGroups[user.role] || roleKey,
                    ...(designationKey ? { designation: designationKey } : {})
                };
                registerActiveSession(req, sessionId, responseUser);
                return res.json({
                    success: true,
                    token,
                    sessionId,
                    permissions,
                    user: responseUser
                });
            }
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/session/heartbeat', authenticateToken, (req, res) => {
    const sessionId = req.user.sessionId;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session id missing.' });
    }

    const existing = activeSessions.get(sessionId);
    activeSessions.set(sessionId, {
        ...(existing || {}),
        sessionId,
        userId: String(req.user.id || existing?.userId || ''),
        role: req.user.role || existing?.role || '',
        campusName: req.user.campusName || existing?.campusName || '',
        loginAt: existing?.loginAt || Date.now(),
        lastSeen: Date.now(),
        ip: req.ip || req.socket?.remoteAddress || existing?.ip || '',
        userAgent: req.get('user-agent') || existing?.userAgent || ''
    });

    res.json({ success: true });
});

app.post('/api/session/end', authenticateToken, (req, res) => {
    if (req.user.sessionId) {
        activeSessions.delete(req.user.sessionId);
    }

    res.json({ success: true });
});

app.get('/api/active-sessions', authenticateToken, (req, res) => {
    if (!canManageActiveSessions(req.user)) {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    res.json(buildActiveSessionsSummary());
});

app.delete('/api/active-sessions/:sessionId', authenticateToken, (req, res) => {
    if (!canManageActiveSessions(req.user)) {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const targetSessionId = decodeURIComponent(String(req.params.sessionId || '').trim());
    if (!targetSessionId) {
        return res.status(400).json({ success: false, message: 'Session id is required.' });
    }

    const hadSession = activeSessions.delete(targetSessionId);
    if (hadSession) {
        io.emit('session_forced_logout', { sessionId: targetSessionId });
    }
    return res.json({
        success: true,
        message: hadSession ? 'Session has been logged out.' : 'Session was already inactive.'
    });
});

app.post('/api/active-sessions/logout', authenticateToken, (req, res) => {
    if (!canManageActiveSessions(req.user)) {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const targetSessionId = decodeURIComponent(String(req.body?.sessionId || '').trim());
    if (!targetSessionId) {
        return res.status(400).json({ success: false, message: 'Session id is required.' });
    }

    const hadSession = activeSessions.delete(targetSessionId);
    if (hadSession) {
        io.emit('session_forced_logout', { sessionId: targetSessionId });
    }
    return res.json({
        success: true,
        message: hadSession ? 'Session has been logged out.' : 'Session was already inactive.'
    });
});

app.get('/api/students', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const students = await sequelize.models.Student.findAll();
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teacher/me', authenticateToken, async (req, res) => {
    try {
        if (!sequelize) {
            return res.status(503).json({ success: false, message: 'Database not available' });
        }

        if (req.user.role !== 'Teacher') {
            return res.status(403).json({ success: false, message: 'Teacher access only.' });
        }

        const teacher = await sequelize.models.Teacher.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });

        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher record not found.' });
        }

        return res.json(teacher);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Teacher profile could not be loaded.' });
    }
});

function normalizeNoticeTargets(targetPortals) {
    const allowedTargets = new Set(['student', 'teacher', 'staff']);
    const targets = Array.isArray(targetPortals) ? targetPortals : [];
    return [...new Set(targets.map((target) => String(target || '').toLowerCase()).filter((target) => allowedTargets.has(target)))];
}

function serializeNoticeTargets(targets) {
    return JSON.stringify(normalizeNoticeTargets(targets));
}

function formatSpecialNotice(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    let targetPortals = [];
    if (Array.isArray(raw.targetPortals)) {
        targetPortals = raw.targetPortals;
    } else {
        try {
            targetPortals = JSON.parse(raw.targetPortals || '[]');
        } catch (error) {
            targetPortals = [];
        }
    }
    return {
        ...raw,
        targetPortals: normalizeNoticeTargets(targetPortals)
    };
}

function formatBanner(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        displayOrder: Number(raw.displayOrder || 0),
        isActive: raw.isActive !== false
    };
}

app.get('/api/special-notices', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const portal = String(req.query.portal || '').toLowerCase();
        const where = portal ? { status: 'executed' } : {};
        const records = await sequelize.models.SpecialNotice.findAll({
            where,
            order: [['updatedAt', 'DESC']]
        });
        const notices = records.map(formatSpecialNotice)
            .filter((notice) => !portal || notice.targetPortals.includes(portal));
        res.json({ success: true, notices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/special-notices', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const payload = req.body || {};
        const title = String(payload.title || '').trim();
        const message = String(payload.message || '').trim();
        const targetPortals = normalizeNoticeTargets(payload.targetPortals);
        const status = payload.status === 'executed' ? 'executed' : 'draft';

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Notice title and message are required.' });
        }

        if (status === 'executed' && !targetPortals.length) {
            return res.status(400).json({ success: false, message: 'Select at least one portal before executing.' });
        }

        const id = payload.id || `NOTICE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const notice = {
            id,
            title,
            message,
            targetPortals: serializeNoticeTargets(targetPortals),
            status,
            executedAt: status === 'executed' ? (payload.executedAt || new Date()) : null,
            createdAtLabel: payload.createdAtLabel || new Date().toLocaleString('en-GB')
        };

        await sequelize.models.SpecialNotice.upsert(notice);

        const records = await sequelize.models.SpecialNotice.findAll({
            order: [['updatedAt', 'DESC']]
        });
        const notices = records.map(formatSpecialNotice);
        let emailResult = null;
        try {
            emailResult = await sendSpecialNoticeStudentEmails(sequelize, formatSpecialNotice(notice), {
                force: payload.forceEmail === true
            });
        } catch (error) {
            emailResult = { success: false, message: error.message || 'Student notice email could not be sent.' };
        }
        io.emit('special_notices_update', notices);
        res.json({ success: true, notice: formatSpecialNotice(notice), notices, emailResult });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/special-notices/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const deletedCount = await sequelize.models.SpecialNotice.destroy({ where: { id: req.params.id } });
        const records = await sequelize.models.SpecialNotice.findAll({
            order: [['updatedAt', 'DESC']]
        });
        const notices = records.map(formatSpecialNotice);
        io.emit('special_notices_update', notices);

        res.json({
            success: true,
            deleted: deletedCount > 0,
            notices
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/banners', async (_req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const banners = await sequelize.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });
        res.json({ success: true, banners: banners.map(formatBanner) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/banners', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const payload = req.body || {};
        const title = String(payload.title || '').trim();
        const imageUrl = String(payload.imageUrl || '').trim();

        if (!title || !imageUrl) {
            return res.status(400).json({ success: false, message: 'Banner title and image URL are required.' });
        }

        const banner = {
            id: payload.id || `BANNER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            subtitle: String(payload.subtitle || '').trim(),
            imageUrl,
            linkUrl: String(payload.linkUrl || '').trim(),
            displayOrder: Number(payload.displayOrder || 0),
            isActive: payload.isActive !== false
        };

        await sequelize.models.Banner.upsert(banner);
        const records = await sequelize.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });
        const banners = records.map(formatBanner);
        io.emit('banners_update', banners);
        res.json({ success: true, banner: formatBanner(banner), banners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/banners/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const deletedCount = await sequelize.models.Banner.destroy({ where: { id: req.params.id } });
        const records = await sequelize.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });
        const banners = records.map(formatBanner);
        io.emit('banners_update', banners);
        res.json({ success: true, deleted: deletedCount > 0, banners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

function normalizeClassFeeConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    return Object.entries(raw).reduce((acc, [className, config]) => {
        const name = String(className || '').trim();
        if (!name) return acc;
        const monthlyFee = String(config?.monthlyFee ?? config?.fee ?? '').trim();
        const feeFrequency = String(config?.feeFrequency || 'Monthly').trim() || 'Monthly';
        if (!monthlyFee) return acc;
        acc[name] = { monthlyFee, feeFrequency };
        return acc;
    }, {});
}

async function readClassFeeConfig() {
    const row = await sequelize.models.AppSetting.findByPk('class_fees');
    if (!row?.settingValue) return {};
    try {
        return normalizeClassFeeConfig(JSON.parse(row.settingValue));
    } catch (_error) {
        return {};
    }
}

app.get('/api/class-fees', async (_req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        res.json({ success: true, classFees: await readClassFeeConfig() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/class-fees', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    if (req.user.role !== 'Admin' && req.user.role !== 'Principal') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    try {
        const className = String(req.body?.className || '').trim();
        const monthlyFee = String(req.body?.monthlyFee || '').trim();
        const feeFrequency = String(req.body?.feeFrequency || 'Monthly').trim() || 'Monthly';

        if (!className || !monthlyFee) {
            return res.status(400).json({ success: false, message: 'Class and monthly fee are required.' });
        }

        const classFees = await readClassFeeConfig();
        classFees[className] = { monthlyFee, feeFrequency };

        await sequelize.models.AppSetting.upsert({
            settingKey: 'class_fees',
            settingValue: JSON.stringify(classFees)
        });

        res.json({ success: true, classFees });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/reset-data', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const models = sequelize.models;
        const resetOrder = [
            'FeePayment',
            'StudentAttendance',
            'TeacherAttendance',
            'SpecialNotice',
            'Student',
            'Teacher',
            'Staff',
            'User'
        ];

        for (const modelName of resetOrder) {
            if (models[modelName]) {
                await models[modelName].destroy({ where: {} });
            }
        }

        writePermissions(defaultPermissions);
        activeSessions.clear();

        io.emit('students_update', []);
        io.emit('teachers_update', []);
        io.emit('staff_update', []);
        io.emit('special_notices_update', []);

        res.json({ success: true, message: 'System data has been reset.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/branches', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const branches = await sequelize.models.User.findAll({
            where: { role: 'Branch' },
            attributes: ['id', 'profileId', 'fullName', 'username', 'plainPassword', 'campusName', 'isActive'],
            order: [['campusName', 'ASC']]
        });
        res.json(branches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/branches', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const User = sequelize.models.User;
        const data = Array.isArray(req.body) ? req.body : [req.body];

        for (const item of data) {
            if (!item.username || !item.campusName) {
                return res.status(400).json({ success: false, message: 'Campus name and username are required.' });
            }

            const branchId = item.profileId || item.id || `branch_${String(item.campusName).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
            const existingBranch = item.id ? await User.findByPk(item.id) : await User.findOne({ where: { id: branchId, role: 'Branch' } });
            const rawPassword = item.plainPassword || item.password || existingBranch?.plainPassword || '';

            if (!rawPassword) {
                return res.status(400).json({ success: false, message: 'Password is required.' });
            }

            const passwordHash = item.password
                ? (isPasswordHash(item.password) ? item.password : await bcrypt.hash(item.password, 10))
                : existingBranch?.password;

            await User.upsert({
                id: item.id || branchId,
                profileId: branchId,
                fullName: item.fullName || item.campusName,
                email: normalizeOptionalEmail(item.email),
                username: item.username,
                password: passwordHash,
                plainPassword: rawPassword,
                role: 'Branch',
                campusName: item.campusName,
                isActive: item.isActive !== false
            });
        }

        const branches = await User.findAll({
            where: { role: 'Branch' },
            attributes: ['id', 'profileId', 'fullName', 'username', 'plainPassword', 'campusName', 'isActive'],
            order: [['campusName', 'ASC']]
        });

        res.json({ success: true, branches });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/branches/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const deletedCount = await sequelize.models.User.destroy({
            where: {
                id: req.params.id,
                role: 'Branch'
            }
        });

        if (!deletedCount) {
            return res.status(404).json({ success: false, message: 'Branch not found.' });
        }

        res.json({ success: true, message: 'Branch deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/student/me', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Student') {
        return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const student = await sequelize.models.Student.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found.' });
        }

        return res.json(student);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/students', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Student = sequelize.models.Student;
        const User = sequelize.models.User;

        const ids = data.map((item) => String(item?.id || '').trim()).filter(Boolean);
        const existingRows = ids.length
            ? await Student.findAll({ where: { id: ids }, attributes: ['id'] })
            : [];
        const existingIds = new Set(existingRows.map((row) => String(row.id)));

        const needsEdit = data.some((item) => {
            const id = String(item?.id || '').trim();
            return id && existingIds.has(id);
        });
        const needsAdd = data.some((item) => {
            const id = String(item?.id || '').trim();
            return !id || !existingIds.has(id);
        });

        if (needsAdd) {
            const ok = await enforceActionPermission(req, res, 'students', 'add');
            if (!ok) return;
        }
        if (needsEdit) {
            const ok = await enforceActionPermission(req, res, 'students', 'edit');
            if (!ok) return;
        }

        for (const item of data) {
            const normalizedUsername = String(item.username || '').trim();
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            item.username = normalizedUsername || null;
            await ensureUniqueStudentIdentity(Student, User, item);
            if (normalizedUsername && item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }
            if (!normalizedUsername) {
                item.password = null;
                item.plainPassword = null;
            } else {
                item.plainPassword = rawPassword || null;
            }

            await Student.upsert(item);
            await upsertAuthUser(User, {
                id: `student_${item.id}`,
                profileId: item.id,
                role: 'Student',
                username: item.username,
                email: normalizeOptionalEmail(item.email),
                password: item.password,
                fullName: item.fullName,
                campusName: item.campusName || null,
                plainPassword: item.plainPassword
            });
        }

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);
        res.json({ success: true, students: allStudents });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const ok = await enforceActionPermission(req, res, 'students', 'delete');
        if (!ok) return;

        const { id } = req.params;
        const Student = sequelize.models.Student;
        const User = sequelize.models.User;

        const deletedCount = await Student.destroy({ where: { id } });
        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Student' },
                    { id: `student_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);
        res.json({ success: true, message: 'Student deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/student-attendance', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const records = await sequelize.models.StudentAttendance.findAll({
            order: [['date', 'ASC']]
        });
        res.json({
            success: true,
            attendance: buildStudentAttendanceStore(records)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/student-attendance', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const StudentAttendance = sequelize.models.StudentAttendance;
        const payload = Array.isArray(req.body) ? req.body : [req.body];

        for (const item of payload) {
            const studentId = String(item?.studentId || '').trim();
            const date = String(item?.date || '').trim();
            const status = normalizeAttendanceStatus(item?.status);

            if (!studentId || !date) {
                return res.status(400).json({ success: false, message: 'studentId and date are required.' });
            }

            const recordId = `${studentId}_${date}`;

            if (status === 'Not Marked') {
                await StudentAttendance.destroy({ where: { id: recordId } });
                continue;
            }

            await StudentAttendance.upsert({
                id: recordId,
                studentId,
                date,
                status
            });
        }

        const records = await StudentAttendance.findAll({
            order: [['date', 'ASC']]
        });

        res.json({
            success: true,
            attendance: buildStudentAttendanceStore(records)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


app.get('/api/teacher-attendance', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const records = await sequelize.models.TeacherAttendance.findAll({
            order: [['date', 'ASC']]
        });
        res.json({
            success: true,
            attendance: buildTeacherAttendanceStore(records)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/teacher-attendance', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });

    try {
        const TeacherAttendance = sequelize.models.TeacherAttendance;
        const payload = Array.isArray(req.body) ? req.body : [req.body];

        for (const item of payload) {
            const teacherId = String(item?.teacherId || '').trim();
            const date = String(item?.date || '').trim();
            const status = normalizeAttendanceStatus(item?.status);

            if (!teacherId || !date) {
                return res.status(400).json({ success: false, message: 'teacherId and date are required.' });
            }

            const recordId = `${teacherId}_${date}`;

            if (status === 'Not Marked') {
                await TeacherAttendance.destroy({ where: { id: recordId } });
                continue;
            }

            await TeacherAttendance.upsert({
                id: recordId,
                teacherId,
                date,
                status
            });
        }

        const records = await TeacherAttendance.findAll({
            order: [['date', 'ASC']]
        });

        res.json({
            success: true,
            attendance: buildTeacherAttendanceStore(records)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/fees/challan-token', async (req, res) => {
    try {
        const {
            studentId,
            studentName,
            rollNo,
            classGrade,
            feeMonth,
            feeMonths,
            session,
            amount,
            fullAmount,
            fineAmount,
            paymentMode,
            challanNumber
        } = req.body || {};

        if (!studentId || !feeMonth || !challanNumber) {
            return res.status(400).json({ success: false, message: 'Student, fee month, and challan number are required.' });
        }

        const token = jwt.sign({
            studentId,
            studentName: studentName || '',
            rollNo: rollNo || '',
            classGrade: classGrade || '',
            feeMonth,
            feeMonths: Array.isArray(feeMonths) ? feeMonths : [],
            session: session || '',
            amount: Number(amount || 0),
            fullAmount: Number(fullAmount || amount || 0),
            fineAmount: Number(fineAmount || 0),
            challanNumber
        }, JWT_SECRET, { expiresIn: '120d' });

        const paymentUrl = `${getRequestBaseUrl(req)}/api/fees/pay/${encodeURIComponent(token)}`;
        const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 220
        });

        return res.json({
            success: true,
            token,
            paymentUrl,
            qrDataUrl
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/fees/challan-tokens', async (req, res) => {
    try {
        const payload = req.body;
        const items = Array.isArray(payload) ? payload : payload?.items;

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ success: false, message: 'items array is required.' });
        }

        if (items.length > 250) {
            return res.status(400).json({ success: false, message: 'Too many challans requested at once.' });
        }

        const baseUrl = getRequestBaseUrl(req);

        const mapWithConcurrency = async (list, limit, mapper) => {
            const results = new Array(list.length);
            let index = 0;

            const workerCount = Math.min(limit, list.length);
            const workers = Array.from({ length: workerCount }, async () => {
                while (true) {
                    const current = index++;
                    if (current >= list.length) return;
                    results[current] = await mapper(list[current], current);
                }
            });

            await Promise.all(workers);
            return results;
        };

        const tokens = await mapWithConcurrency(items, 6, async (item) => {
            const studentId = String(item?.studentId || '').trim();
            const feeMonth = String(item?.feeMonth || '').trim();
            const challanNumber = String(item?.challanNumber || '').trim();

            if (!studentId || !feeMonth || !challanNumber) {
                const err = new Error('studentId, feeMonth, and challanNumber are required.');
                err.statusCode = 400;
                throw err;
            }

            const token = jwt.sign({
                studentId,
                studentName: item?.studentName || '',
                rollNo: item?.rollNo || '',
                classGrade: item?.classGrade || '',
                feeMonth,
                feeMonths: Array.isArray(item?.feeMonths) ? item.feeMonths : [],
                session: item?.session || '',
                amount: Number(item?.amount || 0),
                fullAmount: Number(item?.fullAmount || item?.amount || 0),
                fineAmount: Number(item?.fineAmount || 0),
                challanNumber
            }, JWT_SECRET, { expiresIn: '120d' });

            const paymentUrl = `${baseUrl}/api/fees/pay/${encodeURIComponent(token)}`;
            const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 220
            });

            return { challanNumber, token, paymentUrl, qrDataUrl };
        });

        return res.json({ success: true, tokens });
    } catch (error) {
        const status = error?.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message || 'Bulk QR code could not be generated.' });
    }
});

app.post('/api/fees/manual-payment', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const {
            studentId,
            studentName,
            rollNo,
            classGrade,
            feeMonth,
            feeMonths,
            session,
            amount,
            fullAmount,
            fineAmount,
            paymentMode,
            challanNumber
        } = req.body || {};

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'studentId is required.' });
        }

        const Student = sequelize.models.Student;
        const FeePayment = sequelize.models.FeePayment;
        const FeeDueBalance = sequelize.models.FeeDueBalance;

        const student = await Student.findByPk(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const requestedPaymentAmount = Math.max(Number(amount || 0), 0);
        const safeFineAmount = Math.max(Number(fineAmount || 0), 0);
        const fineOnly = String(paymentMode || '').toLowerCase() === 'fine' || (requestedPaymentAmount <= 0 && safeFineAmount > 0);
        const safeFullAmount = Number(fullAmount || student.monthlyFee || 0);

        const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const normalizeMonthList = (value) => Array.isArray(value)
            ? value.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        const extractMonthList = (value) => {
            const lower = String(value || '').toLowerCase();
            return MONTHS.filter((month) => {
                const full = month.toLowerCase();
                const short = month.slice(0, 3).toLowerCase();
                return lower.includes(full) || lower.includes(short);
            });
        };

        let selectedMonths = normalizeMonthList(feeMonths);
        if (!selectedMonths.length) selectedMonths = extractMonthList(feeMonth);

        const feeMonthRecorded = selectedMonths.length ? selectedMonths.join(', ') : 'Dues';
        const safeChallanNumber = String(challanNumber || '').trim() || `MAN-${Date.now()}`;
        const existingMonthPayments = fineOnly ? [] : await FeePayment.findAll({
            where: {
                studentId,
                status: { [Op.in]: ['Paid', 'Partial'] },
                paymentSource: { [Op.notIn]: ['Fine', 'Fine Correction'] }
            }
        });
        const existingPaidForMonth = existingMonthPayments.reduce((sum, payment) => {
            const paymentMonths = extractMonthList(payment.feeMonth);
            const overlaps = selectedMonths.some((month) => paymentMonths.includes(month));
            return overlaps ? sum + Number(payment.amount || 0) : sum;
        }, 0);
        const remainingBeforePayment = Math.max(safeFullAmount - existingPaidForMonth, 0);
        const paymentAmount = fineOnly ? 0 : Math.min(requestedPaymentAmount, remainingBeforePayment);
        const remainingDue = Math.max(safeFullAmount - existingPaidForMonth - paymentAmount, 0);
        const resolvedStatus = remainingDue > 0 ? 'Partial' : 'Paid';

        const existingPayment = fineOnly ? null : await FeePayment.findByPk(safeChallanNumber);
        const alreadyRecorded = existingPayment && ['Paid', 'Partial'].includes(String(existingPayment.status || ''));
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = paidAt.toLocaleDateString('en-GB');

        const paymentRow = !fineOnly && paymentAmount > 0 ? {
            challanNumber: safeChallanNumber,
            studentId,
            studentName: studentName || student.fullName || '',
            rollNo: rollNo || student.rollNo || '',
            classGrade: classGrade || student.classGrade || '',
            session: session || '',
            feeMonth: feeMonthRecorded,
            amount: paymentAmount,
            status: resolvedStatus,
            paidAt,
            paymentDateLabel,
            paymentSource: 'Manual'
        } : null;

        if (paymentRow) {
            await FeePayment.upsert(paymentRow);
        }

        let fineRow = null;
        if (safeFineAmount > 0) {
            const fineChallanNumber = `${safeChallanNumber}-FINE`;
            fineRow = {
                challanNumber: fineChallanNumber,
                studentId,
                studentName: studentName || student.fullName || '',
                rollNo: rollNo || student.rollNo || '',
                classGrade: classGrade || student.classGrade || '',
                session: session || '',
                feeMonth: `Fine - ${feeMonthRecorded}`,
                amount: safeFineAmount,
                status: 'Paid',
                paidAt,
                paymentDateLabel,
                paymentSource: 'Fine'
            };
            await FeePayment.upsert(fineRow);
        }

        if (!alreadyRecorded && FeeDueBalance && paymentAmount > 0) {
            const existingDue = await FeeDueBalance.findByPk(studentId);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
            const reducedBalance = Math.max(safeCurrent - paymentAmount, 0);

            await FeeDueBalance.upsert({
                studentId,
                balance: reducedBalance,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const currentMonthName = MONTHS[new Date().getMonth()];
        const currentLower = currentMonthName.toLowerCase();
        const currentShortLower = currentMonthName.slice(0, 3).toLowerCase();
        const currentMonthPaid = selectedMonths.some((month) => {
            const lower = String(month || '').toLowerCase();
            return lower === currentLower || lower === currentShortLower;
        });

        if (paymentRow && currentMonthPaid && resolvedStatus === 'Paid') {
            await Student.update({
                feesStatus: 'Paid',
                paymentDate: paymentDateLabel
            }, {
                where: { id: studentId }
            });
        }

        let emailResult = null;
        let fineEmailResult = null;
        if (safeFineAmount > 0) {
            try {
                fineEmailResult = await sendFineAppliedEmail(sequelize, {
                    studentId,
                    studentName: studentName || student.fullName || '',
                    rollNo: rollNo || student.rollNo || '',
                    classGrade: classGrade || student.classGrade || '',
                    feeMonth: feeMonthRecorded,
                    fullAmount: safeFullAmount + safeFineAmount,
                    fineAmount: safeFineAmount,
                    challanNumber: fineRow?.challanNumber || safeChallanNumber
                });
            } catch (error) {
                fineEmailResult = { success: false, message: error.message || 'Fine email could not be sent.' };
            }
        }

        if (paymentRow && !alreadyRecorded && resolvedStatus === 'Paid') {
            try {
                emailResult = await sendFeePaymentConfirmationEmail(student, paymentRow, remainingDue);
            } catch (error) {
                emailResult = { success: false, message: error.message || 'Fee paid email could not be sent.' };
            }
        }

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);
        io.emit('fee_payment_update', { payment: paymentRow || fineRow, finePayment: fineRow });

        return res.json({ success: true, payment: paymentRow || fineRow, finePayment: fineRow, alreadyRecorded, emailResult, fineEmailResult });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Manual payment failed.' });
    }
});

app.get('/api/fees/payments', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const FeePayment = sequelize.models.FeePayment;
        const payments = await FeePayment.findAll({
            where: { status: { [Op.in]: ['Paid', 'Partial'] } },
            order: [['paidAt', 'DESC']]
        });

        return res.json({
            success: true,
            payments
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Fee payments could not be loaded.'
        });
    }
});

app.post('/api/fees/fine-charge', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const { studentId, studentName, rollNo, classGrade, session, feeMonth, fineAmount } = req.body || {};
        const sid = String(studentId || '').trim();
        const month = String(feeMonth || '').trim();
        const amount = Math.max(Number(fineAmount || 0), 0);

        if (!sid || !month) {
            return res.status(400).json({ success: false, message: 'Student and month are required.' });
        }

        const Student = sequelize.models.Student;
        const FeePayment = sequelize.models.FeePayment;
        const student = await Student.findByPk(sid);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        await FeePayment.update({
            status: 'Voided',
            paymentSource: 'Fine Correction'
        }, {
            where: {
                studentId: sid,
                paymentSource: 'Fine',
                feeMonth: { [Op.like]: `%${month}%` },
                status: { [Op.in]: ['Paid', 'Partial'] }
            }
        });

        let finePayment = null;
        if (amount > 0) {
            const paidAt = new Date();
            finePayment = {
                challanNumber: `FINE-${sid}-${month.replace(/[^a-z0-9]/gi, '').toUpperCase()}`,
                studentId: sid,
                studentName: studentName || student.fullName || '',
                rollNo: rollNo || student.rollNo || '',
                classGrade: classGrade || student.classGrade || '',
                session: session || '',
                feeMonth: `Fine - ${month}`,
                amount,
                status: 'Paid',
                paidAt,
                paymentDateLabel: paidAt.toLocaleDateString('en-GB'),
                paymentSource: 'Fine'
            };
            await FeePayment.upsert(finePayment);
        }

        io.emit('fee_payment_update', { payment: finePayment });
        return res.json({ success: true, finePayment, fineAmount: amount });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Fine could not be saved.' });
    }
});

app.post('/api/fees/mark-unpaid', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const { studentId, feeMonth, challanNumbers } = req.body || {};
        const sid = String(studentId || '').trim();
        const month = String(feeMonth || '').trim();

        if (!sid || !month) {
            return res.status(400).json({ success: false, message: 'studentId and feeMonth are required.' });
        }

        const Student = sequelize.models.Student;
        const FeePayment = sequelize.models.FeePayment;
        const FeeDueBalance = sequelize.models.FeeDueBalance;
        const student = await Student.findByPk(sid);

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const cleanChallans = Array.isArray(challanNumbers)
            ? challanNumbers.map((item) => String(item || '').trim()).filter(Boolean)
            : [];

        const where = {
            studentId: sid,
            status: { [Op.in]: ['Paid', 'Partial'] }
        };

        if (cleanChallans.length) {
            where.challanNumber = { [Op.in]: cleanChallans };
        } else {
            where.feeMonth = { [Op.like]: `%${month}%` };
        }

        const payments = await FeePayment.findAll({ where });
        if (!payments.length) {
            return res.status(404).json({ success: false, message: 'No paid payment record found for this month.' });
        }

        const removedAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        await FeePayment.update({
            status: 'Voided',
            paymentSource: 'Correction'
        }, { where });

        if (FeeDueBalance && removedAmount > 0) {
            const existingDue = await FeeDueBalance.findByPk(sid);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;

            await FeeDueBalance.upsert({
                studentId: sid,
                balance: safeCurrent + removedAmount,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (month.toLowerCase() === MONTHS[new Date().getMonth()].toLowerCase()) {
            await Student.update({ feesStatus: 'Pending', paymentDate: null }, { where: { id: sid } });
        }

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);
        io.emit('fee_payment_update', { studentId: sid, feeMonth: month, status: 'Voided' });

        return res.json({
            success: true,
            message: 'Fee marked as unpaid.',
            removedCount: payments.length,
            removedAmount
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Could not mark unpaid.' });
    }
});

app.get('/api/fees/due-balances', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const FeeDueBalance = sequelize.models.FeeDueBalance;
        if (!FeeDueBalance) {
            return res.json({ success: true, balances: {} });
        }

        const rows = await FeeDueBalance.findAll();
        const balances = rows.reduce((acc, row) => {
            const studentId = String(row.studentId || '').trim();
            if (!studentId) return acc;
            const balance = Number(row.balance || 0);
            acc[studentId] = Number.isFinite(balance) ? balance : 0;
            return acc;
        }, {});

        return res.json({ success: true, balances });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Due balances could not be loaded.'
        });
    }
});

app.get('/api/fees/pay/:token', async (req, res) => {
    if (!sequelize) {
        return res.status(503).send(renderFeePaymentPage({
            title: 'Server Offline',
            message: 'The database server is offline, so this fee payment could not be recorded.',
            success: false
        }));
    }

    try {
        const payload = jwt.verify(req.params.token, JWT_SECRET);
        const Student = sequelize.models.Student;
        const FeePayment = sequelize.models.FeePayment;
        const FeeDueBalance = sequelize.models.FeeDueBalance;

        const student = await Student.findByPk(payload.studentId);
        if (!student) {
            return res.status(404).send(renderFeePaymentPage({
                title: 'Student Not Found',
                message: 'This challan is valid, but the linked student record was not found.',
                success: false
            }));
        }

        const existingPayment = await FeePayment.findByPk(payload.challanNumber);
        const alreadyRecorded = existingPayment && ['Paid', 'Partial'].includes(String(existingPayment.status || ''));
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = paidAt.toLocaleDateString('en-GB');

        const paymentAmount = Number(payload.amount || student.monthlyFee || 0);
        const fullAmount = Number(payload.fullAmount || payload.amount || student.monthlyFee || 0);
        const remainingDue = Math.max(fullAmount - paymentAmount, 0);
        const resolvedStatus = remainingDue > 0 ? 'Partial' : 'Paid';

        const normalizeMonthList = (value) => Array.isArray(value)
            ? value.map((item) => String(item || '').trim()).filter(Boolean)
            : [];

        const extractMonthList = (value) => {
            const lower = String(value || '').toLowerCase();
            return MONTHS.filter((month) => {
                const full = month.toLowerCase();
                const short = month.slice(0, 3).toLowerCase();
                return lower.includes(full) || lower.includes(short);
            });
        };

        let selectedMonths = normalizeMonthList(payload.feeMonths);
        if (!selectedMonths.length) selectedMonths = extractMonthList(payload.feeMonth);
        const monthsPaid = selectedMonths;
        const feeMonthRecorded = monthsPaid.length ? monthsPaid.join(', ') : 'Dues';

        const paymentRow = {
            challanNumber: payload.challanNumber,
            studentId: payload.studentId,
            studentName: payload.studentName || student.fullName || '',
            rollNo: payload.rollNo || student.rollNo || '',
            classGrade: payload.classGrade || student.classGrade || '',
            session: payload.session || '',
            feeMonth: feeMonthRecorded,
            amount: paymentAmount,
            status: resolvedStatus,
            paidAt,
            paymentDateLabel,
            paymentSource: 'QR Scan'
        };

        await FeePayment.upsert(paymentRow);

        if (!alreadyRecorded && FeeDueBalance) {
            const existingDue = await FeeDueBalance.findByPk(payload.studentId);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
            const reducedBalance = Math.max(safeCurrent - paymentAmount, 0);

            await FeeDueBalance.upsert({
                studentId: payload.studentId,
                balance: reducedBalance,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const currentMonthName = MONTHS[new Date().getMonth()];
        const feeMonthRaw = String(payload.feeMonth || '');
        const feeMonthLower = feeMonthRaw.toLowerCase();
        const currentLower = currentMonthName.toLowerCase();
        const currentShortLower = currentMonthName.slice(0, 3).toLowerCase();
        const shouldUpdateCurrentMonthStatus = feeMonthLower.includes(currentLower) || feeMonthLower.includes(currentShortLower);

        const currentMonthPaid = monthsPaid.some((month) => {
            const lower = String(month || '').toLowerCase();
            return lower === currentLower || lower === currentShortLower;
        });
        if (resolvedStatus === 'Paid' && (shouldUpdateCurrentMonthStatus || currentMonthPaid) && monthsPaid.length) {
            await Student.update({
                feesStatus: 'Paid',
                paymentDate: paymentDateLabel
            }, {
                where: { id: payload.studentId }
            });
        }

        if (!alreadyRecorded && Number(payload.fineAmount || 0) > 0) {
            try {
                await sendFineAppliedEmail(sequelize, {
                    studentId: payload.studentId,
                    studentName: payload.studentName || student.fullName || '',
                    rollNo: payload.rollNo || student.rollNo || '',
                    classGrade: payload.classGrade || student.classGrade || '',
                    feeMonth: feeMonthRecorded,
                    fullAmount,
                    fineAmount: Number(payload.fineAmount || 0),
                    challanNumber: payload.challanNumber
                });
            } catch (error) {
                console.warn(`Fine email skipped for ${payload.studentId}: ${error.message || error}`);
            }
        }

        if (!alreadyRecorded && resolvedStatus === 'Paid') {
            try {
                await sendFeePaymentConfirmationEmail(student, paymentRow, remainingDue);
            } catch (error) {
                console.warn(`Fee paid email skipped for ${payload.studentId}: ${error.message || error}`);
            }
        }

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);
        io.emit('fee_payment_update', { payment: paymentRow });

        return res.send(renderFeePaymentPage({
            title: alreadyRecorded ? 'Already Recorded' : (paymentRow.status === 'Paid' ? 'Fee Marked Paid' : 'Payment Recorded'),
            message: alreadyRecorded
                ? 'This challan was already scanned earlier. The payment remains recorded in the system.'
                : (paymentRow.status === 'Paid'
                    ? 'The fee has been marked as paid successfully in the system.'
                    : 'Payment has been recorded. Remaining amount is still due.'),
            details: [
                { label: 'Student', value: payload.studentName || student.fullName || '-' },
                { label: 'Roll No', value: payload.rollNo || student.rollNo || '-' },
                { label: 'Class', value: payload.classGrade || student.classGrade || '-' },
                { label: 'Fee Month', value: payload.feeMonth || '-' },
                { label: 'Session', value: payload.session || '-' },
                { label: 'Amount', value: `PKR ${Number(paymentAmount || 0).toLocaleString('en-PK')}` },
                ...(remainingDue > 0 ? [{ label: 'Remaining Due', value: `PKR ${Number(remainingDue || 0).toLocaleString('en-PK')}` }] : []),
                { label: 'Challan No.', value: payload.challanNumber || '-' },
                { label: 'Paid On', value: paymentDateLabel }
            ],
            success: true
        }));
    } catch (error) {
        return res.status(400).send(renderFeePaymentPage({
            title: 'Invalid QR Code',
            message: 'This QR code is invalid or has expired, so the fee could not be recorded.',
            success: false
        }));
    }
});

app.get('/api/teachers', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const teachers = await sequelize.models.Teacher.findAll({
            attributes: [
                'id', 'employeeCode', 'fullName', 'profileImage', 'fatherName', 'dob', 'cnic', 'phone',
                'email', 'address', 'qualification', 'campusName', 'gender', 'designation', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role', 'groupKey'
            ]
        });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/staff', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const staff = await sequelize.models.Staff.findAll();
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Teacher = sequelize.models.Teacher;
        const User = sequelize.models.User;

        const ids = data.map((item) => String(item?.id || '').trim()).filter(Boolean);
        const existingRows = ids.length
            ? await Teacher.findAll({ where: { id: ids }, attributes: ['id'] })
            : [];
        const existingIds = new Set(existingRows.map((row) => String(row.id)));

        const needsEdit = data.some((item) => {
            const id = String(item?.id || '').trim();
            return id && existingIds.has(id);
        });
        const needsAdd = data.some((item) => {
            const id = String(item?.id || '').trim();
            return !id || !existingIds.has(id);
        });

        if (needsAdd) {
            const ok = await enforceActionPermission(req, res, 'teachers', 'add');
            if (!ok) return;
        }
        if (needsEdit) {
            const ok = await enforceActionPermission(req, res, 'teachers', 'edit');
            if (!ok) return;
        }

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            await ensureUniqueTeacherIdentity(Teacher, User, item, Op);
            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }
            item.plainPassword = rawPassword;
            if (Array.isArray(item.schedule)) {
                item.schedule = JSON.stringify(item.schedule);
            }

            await Teacher.upsert(item);
            await upsertAuthUser(User, {
                id: `teacher_${item.id}`,
                profileId: item.id,
                role: 'Teacher',
                username: item.username,
                email: normalizeOptionalEmail(item.email),
                password: item.password,
                fullName: item.fullName,
                campusName: item.campusName,
                plainPassword: item.plainPassword,
                groupKey: item.groupKey || 'teacher'
            });
        }

        const allTeachers = await Teacher.findAll({
            attributes: [
                'id', 'employeeCode', 'fullName', 'profileImage', 'fatherName', 'dob', 'cnic', 'phone',
                'email', 'address', 'qualification', 'campusName', 'gender', 'designation', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role', 'groupKey'
            ]
        });
        io.emit('teachers_update', allTeachers);
        res.json({ success: true, teachers: allTeachers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const ok = await enforceActionPermission(req, res, 'teachers', 'delete');
        if (!ok) return;

        const { id } = req.params;
        const Teacher = sequelize.models.Teacher;
        const User = sequelize.models.User;

        const deletedCount = await Teacher.destroy({ where: { id } });
        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Teacher' },
                    { id: `teacher_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }

        const allTeachers = await Teacher.findAll({
            attributes: [
                'id', 'employeeCode', 'fullName', 'profileImage', 'fatherName', 'dob', 'cnic', 'phone',
                'email', 'address', 'qualification', 'campusName', 'gender', 'designation', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role', 'groupKey'
            ]
        });
        io.emit('teachers_update', allTeachers);
        res.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Staff = sequelize.models.Staff;
        const User = sequelize.models.User;

        const ids = data.map((item) => String(item?.id || '').trim()).filter(Boolean);
        const existingRows = ids.length
            ? await Staff.findAll({ where: { id: ids }, attributes: ['id'] })
            : [];
        const existingIds = new Set(existingRows.map((row) => String(row.id)));

        const needsEdit = data.some((item) => {
            const id = String(item?.id || '').trim();
            return id && existingIds.has(id);
        });
        const needsAdd = data.some((item) => {
            const id = String(item?.id || '').trim();
            return !id || !existingIds.has(id);
        });

        if (needsAdd) {
            const ok = await enforceActionPermission(req, res, 'staff', 'add');
            if (!ok) return;
        }
        if (needsEdit) {
            const ok = await enforceActionPermission(req, res, 'staff', 'edit');
            if (!ok) return;
        }

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);

            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }

            item.plainPassword = rawPassword;

            await Staff.upsert(item);
            await upsertAuthUser(User, {
                id: `staff_${item.id}`,
                profileId: item.id,
                role: 'Staff',
                username: item.username,
                email: normalizeOptionalEmail(item.email),
                password: item.password,
                fullName: item.fullName,
                plainPassword: item.plainPassword,
                groupKey: item.groupKey || 'staff'
            });
        }

        const allStaff = await Staff.findAll();
        io.emit('staff_update', allStaff);
        res.json({ success: true, staff: allStaff });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/staff/:id', authenticateToken, async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const ok = await enforceActionPermission(req, res, 'staff', 'delete');
        if (!ok) return;

        const { id } = req.params;
        const Staff = sequelize.models.Staff;
        const User = sequelize.models.User;

        const deletedCount = await Staff.destroy({ where: { id } });
        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Staff' },
                    { id: `staff_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            return res.status(404).json({ success: false, message: 'Staff not found.' });
        }

        const allStaff = await Staff.findAll();
        io.emit('staff_update', allStaff);
        res.json({ success: true, message: 'Staff deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/email/config', authenticateToken, (req, res) => {
    const config = getSmtpConfig();
    res.json({
        success: true,
        configured: Boolean(config.host && config.port && config.user && config.pass && config.fromEmail),
        host: config.host || '',
        port: config.port || 587,
        secure: config.secure,
        user: config.user ? config.user.replace(/^(.{2}).*(@.*)?$/, '$1***$2') : '',
        fromEmail: config.fromEmail || '',
        fromName: config.fromName || ''
    });
});

app.post('/api/email/send', authenticateToken, async (req, res) => {
    try {
        const result = await sendSmtpEmail(req.body || {});
        res.json({
            success: true,
            message: 'Email sent successfully.',
            ...result
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Email could not be sent.'
        });
    }
});

app.post('/api/fees/send-pending-reminders', authenticateToken, async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const result = await sendPendingFeeReminderEmails(sequelize, {
            force: req.body?.force === true,
            studentIds: Array.isArray(req.body?.studentIds) ? req.body.studentIds : undefined
        });
        return res.json({
            success: true,
            message: `Pending fee reminders sent: ${result.sent}.`,
            ...result
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Pending fee reminders could not be sent.'
        });
    }
});

function parseExecuteAllNoticeTargets(value) {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function formatExecuteAllNotice(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        targetPortals: parseExecuteAllNoticeTargets(raw?.targetPortals)
    };
}

app.post('/api/email/execute-all', authenticateToken, async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const force = req.body?.force === true;
        const result = {
            pendingFees: { attempted: 0, sent: 0, skipped: 0, failed: [] },
            birthdays: { attempted: 0, sent: 0, skipped: 0, failed: [] },
            specialNotices: { attempted: 0, sent: 0, skipped: 0, failed: [] }
        };

        result.pendingFees = await sendPendingFeeReminderEmails(sequelize, { force });
        result.birthdays = await sendBirthdayStudentEmails(sequelize, { force });

        const notices = await sequelize.models.SpecialNotice.findAll({
            where: { status: 'executed' },
            order: [['updatedAt', 'DESC']]
        });

        for (const notice of notices.map(formatExecuteAllNotice).filter((item) => item.targetPortals.includes('student'))) {
            const noticeResult = await sendSpecialNoticeStudentEmails(sequelize, notice, { force });
            result.specialNotices.attempted += Number(noticeResult.attempted || 0);
            result.specialNotices.sent += Number(noticeResult.sent || 0);
            result.specialNotices.skipped += Number(noticeResult.skipped || 0);
            result.specialNotices.failed.push(...(Array.isArray(noticeResult.failed) ? noticeResult.failed : []));
        }

        const totalSent = result.pendingFees.sent + result.birthdays.sent + result.specialNotices.sent;
        const totalFailed = result.pendingFees.failed.length + result.birthdays.failed.length + result.specialNotices.failed.length;

        return res.json({
            success: true,
            message: `All email jobs executed. Sent: ${totalSent}. Failed: ${totalFailed}.`,
            totalSent,
            totalFailed,
            result
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'All emails could not be executed.'
        });
    }
});

app.post('/api/email/send-birthday-greetings', authenticateToken, async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const result = await sendBirthdayStudentEmails(sequelize, {
            force: req.body?.force === true
        });
        return res.json({
            success: true,
            message: `Birthday emails sent: ${result.sent}.`,
            ...result
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Birthday emails could not be sent.'
        });
    }
});

function normalizeLibraryStatus(item = {}) {
    const status = String(item.status || 'Issued').trim();
    if (status === 'Returned' || status === 'Lost') return status;
    const due = new Date(`${item.dueDate}T23:59:59`);
    if (item.dueDate && !Number.isNaN(due.getTime()) && due < new Date()) return 'Overdue';
    return 'Issued';
}

function formatLibraryIssue(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        status: normalizeLibraryStatus(raw),
        loanDays: Number(raw.loanDays || 0),
        finePerDay: Number(raw.finePerDay || 0)
    };
}

app.get('/api/library/issues', async (_req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const records = await sequelize.models.LibraryIssue.findAll({
            order: [['updatedAt', 'DESC']]
        });
        return res.json({ success: true, issues: records.map(formatLibraryIssue) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Library records could not be loaded.' });
    }
});

app.post('/api/library/issues', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const payload = req.body || {};
        const id = String(payload.id || `LIB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
        const bookTitle = String(payload.bookTitle || '').trim();
        const bookNumber = String(payload.bookNumber || '').trim();
        const studentId = String(payload.studentId || '').trim();
        const issueDate = String(payload.issueDate || new Date().toISOString().slice(0, 10)).trim();
        const loanDays = Math.max(Number.parseInt(payload.loanDays || '7', 10) || 7, 1);

        if (!bookTitle || !bookNumber || !studentId) {
            return res.status(400).json({ success: false, message: 'Book title, book number, and student are required.' });
        }

        const issueDateValue = new Date(`${issueDate}T00:00:00`);
        const dueDateValue = new Date(issueDateValue);
        dueDateValue.setDate(dueDateValue.getDate() + loanDays);
        const dueDate = payload.dueDate || dueDateValue.toISOString().slice(0, 10);

        const record = {
            id,
            bookTitle,
            bookNumber,
            accessionNumber: String(payload.accessionNumber || '').trim(),
            isbn: String(payload.isbn || '').trim(),
            author: String(payload.author || '').trim(),
            category: String(payload.category || '').trim(),
            shelfLocation: String(payload.shelfLocation || '').trim(),
            studentId,
            studentName: String(payload.studentName || '').trim(),
            rollNo: String(payload.rollNo || '').trim(),
            classGrade: String(payload.classGrade || '').trim(),
            fatherName: String(payload.fatherName || '').trim(),
            parentPhone: String(payload.parentPhone || '').trim(),
            studentEmail: String(payload.studentEmail || '').trim(),
            issueDate,
            loanDays,
            dueDate,
            returnDate: payload.returnDate || null,
            status: payload.status === 'Returned' || payload.status === 'Lost' ? payload.status : 'Issued',
            finePerDay: Number(payload.finePerDay || 0),
            conditionIssue: String(payload.conditionIssue || '').trim(),
            conditionReturn: String(payload.conditionReturn || '').trim(),
            notes: String(payload.notes || '').trim()
        };

        await sequelize.models.LibraryIssue.upsert(record);
        const records = await sequelize.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, issue: formatLibraryIssue(record), issues: records.map(formatLibraryIssue) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Library record could not be saved.' });
    }
});

app.post('/api/library/issues/:id/return', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const issue = await sequelize.models.LibraryIssue.findByPk(req.params.id);
        if (!issue) return res.status(404).json({ success: false, message: 'Library record not found.' });

        await issue.update({
            status: 'Returned',
            returnDate: req.body?.returnDate || new Date().toISOString().slice(0, 10),
            conditionReturn: String(req.body?.conditionReturn || issue.conditionReturn || '').trim(),
            notes: String(req.body?.notes || issue.notes || '').trim()
        });

        const records = await sequelize.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, issue: formatLibraryIssue(issue), issues: records.map(formatLibraryIssue) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Book return could not be saved.' });
    }
});

app.delete('/api/library/issues/:id', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        await sequelize.models.LibraryIssue.destroy({ where: { id: req.params.id } });
        const records = await sequelize.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, issues: records.map(formatLibraryIssue) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Library record could not be deleted.' });
    }
});

function mapFacilityRecord(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return { ...raw };
}

app.get('/api/cafe/contracts', async (_req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    try {
        const records = await sequelize.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, contracts: records.map(mapFacilityRecord) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Cafe contracts could not be loaded.' });
    }
});

app.post('/api/cafe/contracts', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    try {
        const body = req.body || {};
        const contractorName = String(body.contractorName || '').trim();
        if (!contractorName) return res.status(400).json({ success: false, message: 'Contractor name is required.' });
        const record = {
            id: body.id || `CAFE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            contractorName,
            companyName: body.companyName || '',
            contactNumber: body.contactNumber || '',
            cnic: body.cnic || '',
            email: body.email || '',
            contractType: body.contractType || 'Cafe Operations',
            startDate: body.startDate || '',
            endDate: body.endDate || '',
            monthlyRent: Number(body.monthlyRent || 0),
            securityDeposit: Number(body.securityDeposit || 0),
            paymentStatus: body.paymentStatus || 'Pending',
            menuItems: body.menuItems || '',
            hygieneStatus: body.hygieneStatus || 'Good',
            licenseNumber: body.licenseNumber || '',
            staffCount: Number(body.staffCount || 0),
            status: body.status || 'Active',
            notes: body.notes || ''
        };
        await sequelize.models.CafeContract.upsert(record);
        const records = await sequelize.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, contract: record, contracts: records.map(mapFacilityRecord) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Cafe contract could not be saved.' });
    }
});

app.delete('/api/cafe/contracts/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    await sequelize.models.CafeContract.destroy({ where: { id: req.params.id } });
    const records = await sequelize.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
    return res.json({ success: true, contracts: records.map(mapFacilityRecord) });
});

app.get('/api/transport/assignments', async (_req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    try {
        const records = await sequelize.models.TransportAssignment.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, assignments: records.map(mapFacilityRecord) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Transport records could not be loaded.' });
    }
});

app.post('/api/transport/assignments', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    try {
        const body = req.body || {};
        const driverName = String(body.driverName || '').trim();
        const vehicleNumber = String(body.vehicleNumber || '').trim();
        if (!driverName || !vehicleNumber) return res.status(400).json({ success: false, message: 'Driver name and vehicle number are required.' });
        const record = {
            id: body.id || `TRN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            driverName,
            driverPhone: body.driverPhone || '',
            driverCnic: body.driverCnic || '',
            licenseNumber: body.licenseNumber || '',
            licenseExpiry: body.licenseExpiry || '',
            vehicleNumber,
            vehicleType: body.vehicleType || '',
            vehicleModel: body.vehicleModel || '',
            seatingCapacity: Number(body.seatingCapacity || 0),
            routeName: body.routeName || '',
            routeArea: body.routeArea || '',
            pickupTime: body.pickupTime || '',
            dropTime: body.dropTime || '',
            helperName: body.helperName || '',
            helperPhone: body.helperPhone || '',
            insuranceExpiry: body.insuranceExpiry || '',
            fitnessExpiry: body.fitnessExpiry || '',
            status: body.status || 'Active',
            notes: body.notes || ''
        };
        await sequelize.models.TransportAssignment.upsert(record);
        const records = await sequelize.models.TransportAssignment.findAll({ order: [['updatedAt', 'DESC']] });
        return res.json({ success: true, assignment: record, assignments: records.map(mapFacilityRecord) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Transport record could not be saved.' });
    }
});

app.delete('/api/transport/assignments/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ success: false, message: 'Database offline' });
    await sequelize.models.TransportAssignment.destroy({ where: { id: req.params.id } });
    const records = await sequelize.models.TransportAssignment.findAll({ order: [['updatedAt', 'DESC']] });
    return res.json({ success: true, assignments: records.map(mapFacilityRecord) });
});

app.all('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

app.all('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Internal server error.'
        });
    }

    return next(err);
});

function defineStudentModel(db) {
    return db.define('Student', {
        id: { type: DataTypes.STRING, primaryKey: true },
        studentCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        profileImage: DataTypes.TEXT('long'),
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        admissionDate: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        campusName: DataTypes.STRING,
        gender: DataTypes.STRING,
        parentPhone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        rollNo: DataTypes.STRING,
        formB: DataTypes.STRING,
        monthlyFee: DataTypes.STRING,
        feeFrequency: DataTypes.STRING,
        feesStatus: { type: DataTypes.STRING, defaultValue: 'Pending' },
        paymentDate: DataTypes.STRING,
        username: { type: DataTypes.STRING, unique: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Student' }
    });
}

function defineTeacherModel(db) {
    return db.define('Teacher', {
        id: { type: DataTypes.STRING, primaryKey: true },
        employeeCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        profileImage: DataTypes.TEXT('long'),
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        cnic: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        address: DataTypes.TEXT,
        qualification: DataTypes.STRING,
        campusName: DataTypes.STRING,
        gender: DataTypes.STRING,
        designation: DataTypes.STRING,
        subject: DataTypes.STRING,
        salary: DataTypes.STRING,
        idCardFront: DataTypes.TEXT('long'),
        idCardBack: DataTypes.TEXT('long'),
        cvFile: DataTypes.TEXT('long'),
        bankName: DataTypes.STRING,
        bankAccountTitle: DataTypes.STRING,
        bankAccountNumber: DataTypes.STRING,
        bankBranch: DataTypes.STRING,
        schedule: DataTypes.TEXT('long'),
        username: { type: DataTypes.STRING, unique: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Teacher' }
    });
}

function defineUserModel(db) {
    return db.define('User', {
        id: { type: DataTypes.STRING, primaryKey: true },
        profileId: { type: DataTypes.STRING, allowNull: false },
        fullName: DataTypes.STRING,
        campusName: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        username: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        plainPassword: DataTypes.STRING,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, allowNull: false },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
    });
}

function defineStaffModel(db) {
    return db.define('Staff', {
        id: { type: DataTypes.STRING, primaryKey: true },
        employeeCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        designation: DataTypes.STRING,
        cnic: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        address: DataTypes.TEXT,
        gender: DataTypes.STRING,
        salary: DataTypes.STRING,
        idCardFront: DataTypes.TEXT('long'),
        idCardBack: DataTypes.TEXT('long'),
        bankName: DataTypes.STRING,
        bankAccountTitle: DataTypes.STRING,
        bankAccountNumber: DataTypes.STRING,
        bankBranch: DataTypes.STRING,
        username: { type: DataTypes.STRING, unique: true, allowNull: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Staff' }
    });
}

function defineFeePaymentModel(db) {
    return db.define('FeePayment', {
        challanNumber: { type: DataTypes.STRING, primaryKey: true },
        studentId: { type: DataTypes.STRING, allowNull: false },
        studentName: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        session: DataTypes.STRING,
        feeMonth: DataTypes.STRING,
        amount: DataTypes.DECIMAL(10, 2),
        status: { type: DataTypes.STRING, defaultValue: 'Pending' },
        paidAt: { type: DataTypes.DATE, allowNull: true },
        paymentDateLabel: DataTypes.STRING,
        paymentSource: DataTypes.STRING
    });
}

function defineFeeDueBalanceModel(db) {
    return db.define('FeeDueBalance', {
        studentId: { type: DataTypes.STRING, primaryKey: true },
        balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        updatedAtLabel: DataTypes.STRING
    });
}

function defineStudentAttendanceModel(db) {
    return db.define('StudentAttendance', {
        id: { type: DataTypes.STRING, primaryKey: true },
        studentId: { type: DataTypes.STRING, allowNull: false },
        date: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false }
    });
}

function defineTeacherAttendanceModel(db) {
    return db.define('TeacherAttendance', {
        id: { type: DataTypes.STRING, primaryKey: true },
        teacherId: { type: DataTypes.STRING, allowNull: false },
        date: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false }
    });
}

function defineSpecialNoticeModel(db) {
    return db.define('SpecialNotice', {
        id: { type: DataTypes.STRING, primaryKey: true },
        title: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT('long'), allowNull: false },
        targetPortals: { type: DataTypes.TEXT('long'), allowNull: false },
        status: { type: DataTypes.STRING, defaultValue: 'draft' },
        executedAt: { type: DataTypes.DATE, allowNull: true },
        createdAtLabel: DataTypes.STRING
    });
}

function defineBannerModel(db) {
    return db.define('Banner', {
        id: { type: DataTypes.STRING, primaryKey: true },
        title: { type: DataTypes.STRING, allowNull: false },
        subtitle: { type: DataTypes.STRING, allowNull: true },
        imageUrl: { type: DataTypes.TEXT('long'), allowNull: false },
        linkUrl: { type: DataTypes.STRING, allowNull: true },
        displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
    });
}

function defineAppSettingModel(db) {
    return db.define('AppSetting', {
        settingKey: { type: DataTypes.STRING, primaryKey: true },
        settingValue: { type: DataTypes.TEXT('long'), allowNull: false }
    });
}

function defineLibraryIssueModel(db) {
    return db.define('LibraryIssue', {
        id: { type: DataTypes.STRING, primaryKey: true },
        bookTitle: { type: DataTypes.STRING, allowNull: false },
        bookNumber: { type: DataTypes.STRING, allowNull: false },
        accessionNumber: DataTypes.STRING,
        isbn: DataTypes.STRING,
        author: DataTypes.STRING,
        category: DataTypes.STRING,
        shelfLocation: DataTypes.STRING,
        studentId: { type: DataTypes.STRING, allowNull: false },
        studentName: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        fatherName: DataTypes.STRING,
        parentPhone: DataTypes.STRING,
        studentEmail: DataTypes.STRING,
        issueDate: { type: DataTypes.STRING, allowNull: false },
        loanDays: { type: DataTypes.INTEGER, defaultValue: 7 },
        dueDate: { type: DataTypes.STRING, allowNull: false },
        returnDate: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'Issued' },
        finePerDay: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        conditionIssue: DataTypes.STRING,
        conditionReturn: DataTypes.STRING,
        notes: DataTypes.TEXT
    });
}

function defineCafeContractModel(db) {
    return db.define('CafeContract', {
        id: { type: DataTypes.STRING, primaryKey: true },
        contractorName: { type: DataTypes.STRING, allowNull: false },
        companyName: DataTypes.STRING,
        contactNumber: DataTypes.STRING,
        cnic: DataTypes.STRING,
        email: DataTypes.STRING,
        contractType: DataTypes.STRING,
        startDate: DataTypes.STRING,
        endDate: DataTypes.STRING,
        monthlyRent: DataTypes.DECIMAL(10, 2),
        securityDeposit: DataTypes.DECIMAL(10, 2),
        paymentStatus: DataTypes.STRING,
        menuItems: DataTypes.TEXT,
        hygieneStatus: DataTypes.STRING,
        licenseNumber: DataTypes.STRING,
        staffCount: DataTypes.INTEGER,
        status: { type: DataTypes.STRING, defaultValue: 'Active' },
        notes: DataTypes.TEXT
    });
}

function defineTransportAssignmentModel(db) {
    return db.define('TransportAssignment', {
        id: { type: DataTypes.STRING, primaryKey: true },
        driverName: { type: DataTypes.STRING, allowNull: false },
        driverPhone: DataTypes.STRING,
        driverCnic: DataTypes.STRING,
        licenseNumber: DataTypes.STRING,
        licenseExpiry: DataTypes.STRING,
        vehicleNumber: { type: DataTypes.STRING, allowNull: false },
        vehicleType: DataTypes.STRING,
        vehicleModel: DataTypes.STRING,
        seatingCapacity: DataTypes.INTEGER,
        routeName: DataTypes.STRING,
        routeArea: DataTypes.STRING,
        pickupTime: DataTypes.STRING,
        dropTime: DataTypes.STRING,
        helperName: DataTypes.STRING,
        helperPhone: DataTypes.STRING,
        insuranceExpiry: DataTypes.STRING,
        fitnessExpiry: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'Active' },
        notes: DataTypes.TEXT
    });
}

function normalizeAttendanceStatus(status) {
    if (status === 'P') return 'Present';
    if (status === 'A') return 'Absent';
    if (status === 'Present' || status === 'Late' || status === 'Absent') return status;
    return 'Not Marked';
}

function buildStudentAttendanceStore(records) {
    return records.reduce((store, record) => {
        const studentId = String(record.studentId || '').trim();
        const date = String(record.date || '').trim();
        const status = normalizeAttendanceStatus(record.status);

        if (!studentId || !date || status === 'Not Marked') {
            return store;
        }

        if (!Array.isArray(store[studentId])) {
            store[studentId] = [];
        }

        store[studentId].push({ date, status });
        store[studentId].sort((a, b) => a.date.localeCompare(b.date));
        return store;
    }, {});
}

function buildTeacherAttendanceStore(records) {
    return records.reduce((store, record) => {
        const teacherId = String(record.teacherId || '').trim();
        const date = String(record.date || '').trim();
        const status = normalizeAttendanceStatus(record.status);

        if (!teacherId || !date || status === 'Not Marked') {
            return store;
        }

        const monthKey = date.slice(0, 7);
        const dayIndex = Number(date.slice(8, 10)) - 1;
        const recordKey = `${teacherId}_${monthKey}`;

        if (!Array.isArray(store[recordKey])) {
            const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
            store[recordKey] = Array(daysInMonth).fill('Not Marked');
        }

        if (dayIndex >= 0 && dayIndex < store[recordKey].length) {
            store[recordKey][dayIndex] = status;
        }

        return store;
    }, {});
}

function getRequestBaseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
}

function renderFeePaymentPage({ title, message, details = [], success = true }) {
    const detailRows = details.map(({ label, value }) => `
        <div class="detail-row">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    background: #f4f7fb;
                    color: #1f2937;
                    display: grid;
                    place-items: center;
                    min-height: 100vh;
                    padding: 24px;
                }
                .card {
                    width: min(520px, 100%);
                    background: #fff;
                    border: 1px solid #dbe3ee;
                    border-radius: 20px;
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
                    padding: 28px;
                }
                .badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 999px;
                    background: ${success ? '#dcfce7' : '#fee2e2'};
                    color: ${success ? '#166534' : '#991b1b'};
                    font-size: 12px;
                    font-weight: 700;
                    margin-bottom: 14px;
                }
                h1 {
                    margin: 0 0 10px;
                    font-size: 28px;
                }
                p {
                    margin: 0 0 20px;
                    color: #475569;
                    line-height: 1.6;
                }
                .details {
                    display: grid;
                    gap: 12px;
                    margin-top: 18px;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #f8fafc;
                }
                .detail-row span {
                    color: #64748b;
                    font-size: 14px;
                }
                .detail-row strong {
                    text-align: right;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <section class="card">
                <div class="badge">${success ? 'Payment Captured' : 'Payment Failed'}</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <div class="details">${detailRows}</div>
            </section>
        </body>
        </html>
    `;
}

async function upsertAuthUser(User, payload) {
    if (!payload.username || !payload.password || !payload.profileId || !payload.role) {
        return;
    }

    await User.upsert({
        id: payload.id,
        profileId: payload.profileId,
        fullName: payload.fullName || '',
        campusName: payload.campusName || null,
        email: normalizeOptionalEmail(payload.email),
        username: payload.username,
        password: payload.password,
        plainPassword: payload.plainPassword || null,
        role: payload.role,
        groupKey: payload.groupKey || null,
        isActive: true
    });
}

async function syncAuthUsers() {
    const Student = sequelize.models.Student;
    const Teacher = sequelize.models.Teacher;
    const User = sequelize.models.User;

    const students = await Student.findAll({
        attributes: ['id', 'fullName', 'campusName', 'email', 'username', 'password', 'plainPassword']
    });
    for (const student of students) {
        await upsertAuthUser(User, {
            id: `student_${student.id}`,
            profileId: student.id,
            fullName: student.fullName,
            campusName: student.campusName || null,
            email: normalizeOptionalEmail(student.email),
            username: student.username,
            password: student.password,
            plainPassword: student.plainPassword || null,
            role: 'Student'
        });
    }

    const teachers = await Teacher.findAll({
        attributes: ['id', 'fullName', 'campusName', 'email', 'username', 'password', 'plainPassword', 'groupKey']
    });
    for (const teacher of teachers) {
        await upsertAuthUser(User, {
            id: `teacher_${teacher.id}`,
            profileId: teacher.id,
            fullName: teacher.fullName,
            campusName: teacher.campusName || null,
            email: normalizeOptionalEmail(teacher.email),
            username: teacher.username,
            password: teacher.password,
            plainPassword: teacher.plainPassword || null,
            groupKey: teacher.groupKey || 'teacher',
            role: 'Teacher'
        });
    }

    const Staff = sequelize.models.Staff;
    const staffMembers = await Staff.findAll({
        attributes: ['id', 'fullName', 'email', 'username', 'password', 'plainPassword', 'groupKey']
    });
    for (const member of staffMembers) {
        await upsertAuthUser(User, {
            id: `staff_${member.id}`,
            profileId: member.id,
            fullName: member.fullName,
            email: normalizeOptionalEmail(member.email),
            username: member.username,
            password: member.password,
            plainPassword: member.plainPassword || null,
            groupKey: member.groupKey || 'staff',
            role: 'Staff'
        });
    }
}

async function ensureTableColumns(tableName, columnDefinitions) {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable(tableName);

    for (const [columnName, definition] of Object.entries(columnDefinitions)) {
        if (!table[columnName]) {
            await queryInterface.addColumn(tableName, columnName, definition);
        }
    }
}

async function ensureLegacySchema() {
    await ensureTableColumns('Students', {
        studentCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        admissionDate: { type: DataTypes.STRING, allowNull: true },
        classGrade: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        parentPhone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        rollNo: { type: DataTypes.STRING, allowNull: true },
        formB: { type: DataTypes.STRING, allowNull: true },
        monthlyFee: { type: DataTypes.STRING, allowNull: true },
        feeFrequency: { type: DataTypes.STRING, allowNull: true },
        feesStatus: { type: DataTypes.STRING, allowNull: true },
        paymentDate: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true },
        enrollmentStatus: { type: DataTypes.STRING, allowNull: true },
        terminatedAt: { type: DataTypes.STRING, allowNull: true },
        terminationNote: { type: DataTypes.TEXT, allowNull: true }
    });

    await ensureTableColumns('Users', {
        fullName: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: false },
        isActive: { type: DataTypes.BOOLEAN, allowNull: true }
    });

    await ensureTableColumns('Teachers', {
        employeeCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        cnic: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        qualification: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        designation: { type: DataTypes.STRING, allowNull: true },
        subject: { type: DataTypes.STRING, allowNull: true },
        salary: { type: DataTypes.STRING, allowNull: true },
        idCardFront: { type: DataTypes.TEXT('long'), allowNull: true },
        idCardBack: { type: DataTypes.TEXT('long'), allowNull: true },
        cvFile: { type: DataTypes.TEXT('long'), allowNull: true },
        bankName: { type: DataTypes.STRING, allowNull: true },
        bankAccountTitle: { type: DataTypes.STRING, allowNull: true },
        bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
        bankBranch: { type: DataTypes.STRING, allowNull: true },
        schedule: { type: DataTypes.TEXT('long'), allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true }
    });

    await ensureTableColumns('Staffs', {
        employeeCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        designation: { type: DataTypes.STRING, allowNull: true },
        cnic: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        salary: { type: DataTypes.STRING, allowNull: true },
        idCardFront: { type: DataTypes.TEXT('long'), allowNull: true },
        idCardBack: { type: DataTypes.TEXT('long'), allowNull: true },
        bankName: { type: DataTypes.STRING, allowNull: true },
        bankAccountTitle: { type: DataTypes.STRING, allowNull: true },
        bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
        bankBranch: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true }
    });
}

async function startServer() {
    if (startupPromise) {
        return startupPromise;
    }

    startupPromise = (async () => {
    try {
        console.log('Initializing database...');
        await initializeDatabase();

        sequelize = new Sequelize(
            process.env.DB_NAME || 'school_system',
            process.env.DB_USER || 'root',
            process.env.DB_PASSWORD || '',
            {
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT || 3306),
                dialect: 'mysql',
                logging: false
            }
        );

        defineStudentModel(sequelize);
        defineTeacherModel(sequelize);
        defineUserModel(sequelize);
        defineStaffModel(sequelize);
        defineFeePaymentModel(sequelize);
        defineFeeDueBalanceModel(sequelize);
        defineStudentAttendanceModel(sequelize);
        defineTeacherAttendanceModel(sequelize);
        defineSpecialNoticeModel(sequelize);
        defineBannerModel(sequelize);
        defineAppSettingModel(sequelize);
        defineLibraryIssueModel(sequelize);
        defineCafeContractModel(sequelize);
        defineTransportAssignmentModel(sequelize);

        // Avoid Sequelize's repeated ALTER-based index churn on MySQL.
        // Missing legacy columns are handled separately in ensureLegacySchema().
        await sequelize.sync();
        await ensureLegacySchema();
        await syncAuthUsers();
        console.log('✅ Database synced successfully');
        startPendingFeeReminderScheduler(() => Promise.resolve(sequelize), console);
        startStudentEmailNotificationScheduler(() => Promise.resolve(sequelize), console);
        startWhatsAppBirthdayScheduler(() => Promise.resolve(sequelize), console);

        isInitialized = true;
    } catch (err) {
        startupPromise = null;
        console.error('Database connection error:', err.message);
        console.log('Ensure MySQL is running and .env credentials are correct.');
        throw err;
    }
    })();

    return startupPromise;
}

module.exports = {
    app,
    startServer,
    server,
    io,
    getSequelize: () => sequelize,
    isInitialized: () => isInitialized
};

if (require.main === module) {
    const PORT = Number(process.env.PORT || 3000);
    startServer()
        .then(() => {
            server.listen(PORT, '0.0.0.0', () => {
                console.log(`Real-Time SQL Server running on port ${PORT}`);
            });
        })
        .catch((err) => {
            console.error('Startup failed:', err?.message || err);
            process.exit(1);
        });
}
