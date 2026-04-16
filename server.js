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

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PERMISSIONS_FILE = path.join(__dirname, 'permissions.json');
const PRINCIPAL_USERNAME = process.env.PRINCIPAL_USERNAME || 'principal@school.com';
const PRINCIPAL_PASSWORD = process.env.PRINCIPAL_PASSWORD || 'Principal123';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running.',
        app: 'School Management System API'
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
    'teachers',
    'staff',
    'classes',
    'fees',
    'fee_challan',
    'teacher_salaries',
    'student_attendance',
    'teacher_attendance',
    'student_attendance_report',
    'teacher_attendance_report',
    'notifications',
    'exams',
    'revenue',
    'settings',
    'permissions',
    'branch_registration',
    'aboutme',
    'student_portal',
    'teacher_portal',
    'staff_portal',
    'principal_portal'
];
const ACCESS_LEVELS = ['none', 'view', 'edit', 'manage'];

function buildModuleSet(defaultAccess = 'none', overrides = {}) {
    return MODULE_KEYS.reduce((acc, key) => {
        const requested = overrides[key];
        acc[key] = ACCESS_LEVELS.includes(requested) ? requested : defaultAccess;
        return acc;
    }, {});
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
            permissions: buildModuleSet('manage')
        },
        principal: {
            name: 'Principal Group',
            homePage: 'principal_portal.html',
            permissions: buildModuleSet('none', {
                principal_portal: 'manage',
                dashboard: 'view',
                students: 'view',
                teachers: 'view',
                staff: 'view',
                classes: 'view',
                notifications: 'view',
                exams: 'view',
                revenue: 'view',
                aboutme: 'view'
            })
        },
        branch_manager: {
            name: 'Branch Managers',
            homePage: 'students.html',
            permissions: buildModuleSet('none', {
                students: 'manage',
                dashboard: 'view',
                classes: 'view',
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
                exams: 'edit',
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
                aboutme: 'view'
            })
        },
        staff: {
            name: 'Staff',
            homePage: 'staff_portal.html',
            permissions: buildModuleSet('none', {
                staff_portal: 'manage',
                aboutme: 'view'
            })
        }
    }
};

function normalizePermissionsConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    const groupsInput = raw.groups && typeof raw.groups === 'object' ? raw.groups : {};
    const groups = Object.entries({
        ...defaultPermissions.groups,
        ...groupsInput
    }).reduce((acc, [key, groupValue]) => {
        const baseGroup = defaultPermissions.groups[key] || {
            name: key,
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none')
        };
        const nextGroup = groupValue && typeof groupValue === 'object' ? groupValue : {};
        acc[key] = {
            name: String(nextGroup.name || baseGroup.name || key),
            homePage: String(nextGroup.homePage || baseGroup.homePage || 'dashboard.html'),
            permissions: buildModuleSet('none', {
                ...baseGroup.permissions,
                ...(nextGroup.permissions || {})
            })
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

function isPasswordHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    startServer().then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Real-Time SQL Server running on all interfaces at port ${PORT}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
            } else {
                console.error('Server error:', err.message);
            }
        });
    }).catch(() => {
        process.exitCode = 1;
    });
}

module.exports = {
    app,
    startServer,
    server,
    io,
    getSequelize: () => sequelize,
    isInitialized: () => isInitialized
};

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

    if (!normalizedUsername) {
        throw new Error('Student username is required.');
    }

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

async function initializeDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'school_system'}\`;`);
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
    const sessions = Array.from(activeSessions.values()).map((session) => ({
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

    return {
        success: true,
        totalActiveLogins: sessions.length,
        uniqueActiveUsers: uniqueUsers.size,
        byRole,
        sessions
    };
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

app.get('/api/permissions', (req, res) => {
    res.json(readPermissions());
});

app.post('/api/permissions', (req, res) => {
    try {
        const saved = writePermissions(req.body || {});
        res.json({ success: true, permissions: saved });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save permissions.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const adminEmail = process.env.ADMIN_USERNAME || 'Myownschool';
        const adminPass = process.env.ADMIN_PASSWORD || 'myownschool1122';

        if (username === adminEmail && password === adminPass) {
            const permissions = readPermissions();
            const groupKey = permissions.roleGroups.Admin || 'admin';
            const sessionId = createSessionId('Admin', 'admin');
            const token = jwt.sign({ id: 'admin', role: 'Admin', sessionId }, JWT_SECRET, { expiresIn: '1d' });
            const user = { id: 'admin', fullName: 'Administrator', role: 'Admin', username: adminEmail, groupKey };
            registerActiveSession(req, sessionId, user);
            return res.json({
                success: true,
                token,
                sessionId,
                user
            });
        }

        if (username === PRINCIPAL_USERNAME && password === PRINCIPAL_PASSWORD) {
            const permissions = readPermissions();
            const groupKey = permissions.roleGroups.Principal || 'principal';
            const sessionId = createSessionId('Principal', 'principal');
            const token = jwt.sign({ id: 'principal', role: 'Principal', sessionId }, JWT_SECRET, { expiresIn: '1d' });
            const user = { id: 'principal', fullName: 'Principal', role: 'Principal', username: PRINCIPAL_USERNAME, groupKey };
            registerActiveSession(req, sessionId, user);
            return res.json({
                success: true,
                token,
                sessionId,
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

                if (user.role === 'Student') {
                    const student = await Student.findByPk(user.profileId);
                    profileName = student?.fullName || profileName;
                } else if (user.role === 'Teacher') {
                    const teacher = await Teacher.findByPk(user.profileId);
                    profileName = teacher?.fullName || profileName;
                } else if (user.role === 'Staff') {
                    const staff = await sequelize.models.Staff.findByPk(user.profileId);
                    profileName = staff?.fullName || profileName;
                }

                const sessionId = createSessionId(user.role, user.profileId);
                const token = jwt.sign({ id: user.profileId, role: user.role, campusName: user.campusName || '', sessionId }, JWT_SECRET, { expiresIn: '1d' });
                const responseUser = {
                    id: user.profileId,
                    fullName: profileName,
                    role: user.role,
                    username: user.username,
                    campusName: user.campusName || '',
                    groupKey: permissions.roleGroups[user.role] || roleKey
                };
                registerActiveSession(req, sessionId, responseUser);
                return res.json({
                    success: true,
                    token,
                    sessionId,
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
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    res.json(buildActiveSessionsSummary());
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

app.post('/api/students', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Student = sequelize.models.Student;
        const User = sequelize.models.User;

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            await ensureUniqueStudentIdentity(Student, User, item);
            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }
            item.plainPassword = rawPassword;

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
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

app.delete('/api/students/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
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
            session,
            amount,
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
            session: session || '',
            amount: Number(amount || 0),
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

app.get('/api/fees/payments', async (req, res) => {
    if (!sequelize) {
        return res.status(503).json({ success: false, message: 'Database offline' });
    }

    try {
        const FeePayment = sequelize.models.FeePayment;
        const payments = await FeePayment.findAll({
            where: { status: 'Paid' },
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

        const student = await Student.findByPk(payload.studentId);
        if (!student) {
            return res.status(404).send(renderFeePaymentPage({
                title: 'Student Not Found',
                message: 'This challan is valid, but the linked student record was not found.',
                success: false
            }));
        }

        const existingPayment = await FeePayment.findByPk(payload.challanNumber);
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = paidAt.toLocaleDateString('en-GB');

        await FeePayment.upsert({
            challanNumber: payload.challanNumber,
            studentId: payload.studentId,
            studentName: payload.studentName || student.fullName || '',
            rollNo: payload.rollNo || student.rollNo || '',
            classGrade: payload.classGrade || student.classGrade || '',
            session: payload.session || '',
            feeMonth: payload.feeMonth || '',
            amount: Number(payload.amount || student.monthlyFee || 0),
            status: 'Paid',
            paidAt,
            paymentDateLabel,
            paymentSource: 'QR Scan'
        });

        await Student.update({
            feesStatus: 'Paid',
            paymentDate: paymentDateLabel
        }, {
            where: { id: payload.studentId }
        });

        const allStudents = await Student.findAll();
        io.emit('students_update', allStudents);

        return res.send(renderFeePaymentPage({
            title: existingPayment?.status === 'Paid' ? 'Already Marked Paid' : 'Fee Marked Paid',
            message: existingPayment?.status === 'Paid'
                ? 'This challan was already scanned earlier. The payment remains recorded in the system.'
                : 'The fee has been marked as paid successfully in the system.',
            details: [
                { label: 'Student', value: payload.studentName || student.fullName || '-' },
                { label: 'Roll No', value: payload.rollNo || student.rollNo || '-' },
                { label: 'Class', value: payload.classGrade || student.classGrade || '-' },
                { label: 'Fee Month', value: payload.feeMonth || '-' },
                { label: 'Session', value: payload.session || '-' },
                { label: 'Amount', value: `PKR ${Number(payload.amount || student.monthlyFee || 0).toLocaleString('en-PK')}` },
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
                'email', 'address', 'qualification', 'campusName', 'gender', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role'
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

app.post('/api/teachers', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Teacher = sequelize.models.Teacher;
        const User = sequelize.models.User;

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            await ensureUniqueTeacherIdentity(Teacher, User, item);
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
                plainPassword: item.plainPassword
            });
        }

        const allTeachers = await Teacher.findAll({
            attributes: [
                'id', 'employeeCode', 'fullName', 'profileImage', 'fatherName', 'dob', 'cnic', 'phone',
                'email', 'address', 'qualification', 'campusName', 'gender', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role'
            ]
        });
        io.emit('teachers_update', allTeachers);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/teachers/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
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
                'email', 'address', 'qualification', 'campusName', 'gender', 'subject', 'salary',
                'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
                'bankAccountNumber', 'bankBranch', 'schedule', 'username', 'password', 'plainPassword', 'role'
            ]
        });
        io.emit('teachers_update', allTeachers);
        res.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/staff', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const Staff = sequelize.models.Staff;
        const User = sequelize.models.User;

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
                plainPassword: item.plainPassword
            });
        }

        const allStaff = await Staff.findAll();
        io.emit('staff_update', allStaff);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/staff/:id', async (req, res) => {
    if (!sequelize) return res.status(503).json({ error: 'Database offline' });

    try {
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
        attributes: ['id', 'fullName', 'campusName', 'email', 'username', 'password', 'plainPassword']
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
            role: 'Teacher'
        });
    }

    const Staff = sequelize.models.Staff;
    const staffMembers = await Staff.findAll({
        attributes: ['id', 'fullName', 'email', 'username', 'password', 'plainPassword']
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
        role: { type: DataTypes.STRING, allowNull: true }
    });

    await ensureTableColumns('Users', {
        fullName: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
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
                dialect: 'mysql',
                logging: false
            }
        );

        defineStudentModel(sequelize);
        defineTeacherModel(sequelize);
        defineUserModel(sequelize);
        defineStaffModel(sequelize);
        defineFeePaymentModel(sequelize);
        defineStudentAttendanceModel(sequelize);
        defineTeacherAttendanceModel(sequelize);

        // Avoid Sequelize's repeated ALTER-based index churn on MySQL.
        // Missing legacy columns are handled separately in ensureLegacySchema().
        await sequelize.sync();
        await ensureLegacySchema();
        await syncAuthUsers();
        console.log('✅ Database synced successfully');

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
