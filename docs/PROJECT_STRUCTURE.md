# 📁 Project Structure & Architecture

## Overview

School CRM is a **monolithic full-stack application** that serves both frontend and backend from a single Node.js application running on cPanel.

### Architecture Diagram
```
┌─────────────────────────────────────────┐
│       Browser / Client                  │
└────────────────┬────────────────────────┘
                 │ HTTP/HTTPS
                 ▼
┌─────────────────────────────────────────┐
│    Express.js Server (app.js)           │
│    ├── Frontend Static Server           │
│    │   └── /frontend/** (HTML/CSS/JS)   │
│    └── Backend API Routes               │
│        ├── /api/students/**             │
│        ├── /api/teachers/**             │
│        ├── /api/fees/**                 │
│        └── /api/...                     │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    MySQL DB         File System
    (Data)          (Uploads)
```

---

## Directory Structure

```
My_own_school_Crm/
│
├── 📄 app.js                          # Main entry point
├── 📄 package.json                    # Dependencies & scripts
├── 📄 .env                            # Environment variables (⚠️ don't commit)
├── 📄 .production.env.example         # Template for production env
├── 📄 .htaccess                       # cPanel Apache configuration
├── 📄 .cpanel.yml                     # cPanel deployment config
├── 📄 ecosystem.config.js             # PM2 ecosystem config
├── 📄 create-hosting-zip.ps1          # Deployment ZIP creation script
│
├── 📂 backend/                        # Backend logic
│   ├── 📄 server.js                   # Express server setup
│   ├── 📄 sync-permissions.js         # Permission management
│   └── 📂 api/                        # API endpoints
│       ├── 📄 index.js                # API router
│       ├── 📄 login.js                # Authentication
│       ├── 📂 students/               # Student endpoints
│       ├── 📂 teachers/               # Teacher endpoints
│       ├── 📂 fees/                   # Fee management
│       ├── 📂 staff/                  # Staff management
│       ├── 📂 _lib/                   # Shared utilities
│       │   ├── mailer.js              # Email sender
│       │   ├── fee-reminders.js       # Fee reminder scheduler
│       │   ├── student-emails.js      # Student notifications
│       │   └── ...                    # Other utilities
│       └── ...                        # More endpoint folders
│
├── 📂 frontend/                       # Frontend (HTML/CSS/JS)
│   ├── 📄 index.html                  # Dashboard homepage
│   ├── 📄 login.html                  # Login page
│   ├── 📄 students.html               # Student management page
│   ├── 📄 teachers.html               # Teacher management page
│   ├── 📄 fees.html                   # Fee management page
│   ├── 📄 style.css                   # Main stylesheet
│   ├── 📄 script.js                   # Main JavaScript
│   ├── 📄 auth.js                     # Authentication JS
│   ├── 📄 sidebar-order.js            # Sidebar functionality
│   └── 📄 *.html                      # Other feature pages
│
├── 📂 config/                         # Configuration files
│   └── 📄 production.js               # Production settings
│
├── 📂 scripts/                        # Utility scripts
│   └── 📄 validate-startup.js         # Startup validation
│
├── 📂 docs/                           # Documentation
│   ├── 📄 CPANEL_DEPLOYMENT_COMPLETE.md
│   ├── 📄 DEPLOYMENT_QUICK_START.md
│   ├── 📄 CPANEL_DEPLOY_NOW.md        # (Old - for reference)
│   ├── 📄 DEPLOYMENT_GUIDE.md         # (Old - for reference)
│   └── ... (other guides)
│
├── 📂 logs/                           # Application logs (auto-created)
│   ├── app.log                        # Standard output
│   └── error.log                      # Error logs
│
├── 📂 uploads/                        # File uploads (auto-created)
│   └── (student photos, assignments, etc.)
│
├── 📄 permissions.json                # Role-based permissions
├── 📄 admin_credentials.json          # Admin login (sensitive)
├── 📄 date_sheet.json                 # Academic calendar
├── 📄 README.md                       # Project readme
└── 📄 node_modules/                   # Dependencies (not in repo)
```

---

## Key Components Explained

### 1. Entry Point (`app.js`)

```
Loads environment variables → Initializes server → Starts HTTP server
     ↓
Graceful shutdown handling ← Process signals (SIGTERM, SIGINT)
```

**Responsibilities:**
- Load environment configuration
- Initialize backend services
- Start Express server
- Handle process signals for graceful shutdown
- Display startup status and logs

---

### 2. Backend Server (`backend/server.js`)

**Large file (~4600 lines) containing:**

#### Routes
- **Frontend routes:** Serve HTML pages dynamically
- **API routes:** `/api/*` endpoints for all features
- **Health check:** `/health` endpoint for monitoring
- **WebSocket:** Real-time notifications via Socket.io

#### Database Integration
- **Sequelize ORM:** MySQL database interaction
- **Auto-initialization:** Creates tables if needed
- **Connection pooling:** Efficient database connection management

#### Features
- User authentication (JWT-based)
- Role-based access control (RBAC)
- Email notifications
- File uploads
- Real-time updates
- Scheduled tasks (cron jobs)

---

### 3. Frontend (`frontend/`)

#### HTML Pages
Each page serves a specific feature:
- **index.html** - Dashboard
- **login.html** - Login form
- **students.html** - Student CRUD
- **teachers.html** - Teacher CRUD
- **fees.html** - Fee management
- **exam_result.html** - Results management
- ... and more

#### JavaScript
- **auth.js** - Authentication & token management
- **script.js** - Main app functionality
- **sidebar-order.js** - Dynamic sidebar

#### Styling
- **style.css** - Main stylesheet
- **student_schedule_theme.css** - Theme customization
- **website.css** - Website theme

#### How It Works
```
User opens https://domain.com/
    ↓
Express serves frontend/index.html
    ↓
HTML loads CSS/JS files from frontend/
    ↓
JavaScript (auth.js, script.js) initializes
    ↓
API calls to backend via fetch/AJAX
    ↓
Backend returns JSON responses
```

---

### 4. API Structure (`backend/api/`)

#### Organization by Feature

```
/api/students/           → Student management
    ├── GET /           → List all students
    ├── GET /:id        → Get single student
    ├── POST /          → Create student
    ├── PUT /:id        → Update student
    └── DELETE /:id     → Delete student

/api/teachers/          → Teacher management
/api/fees/              → Fee management
/api/exams/             → Exam management
/api/attendance/        → Attendance tracking
... (more features)
```

#### Authentication
- JWT tokens issued on login
- Tokens required in `Authorization: Bearer <token>` header
- Token expiry: 7 days (configurable)

#### Authorization
- Permissions defined in `permissions.json`
- Role-based access control
- Features check user roles/permissions

---

### 5. Database (`MySQL`)

#### Tables Auto-Created by Sequelize

Key tables:
- **Users** - Admin, teachers, staff
- **Students** - Student records
- **Classes** - Class definitions
- **Teachers** - Teacher profiles
- **Attendance** - Attendance records
- **Fees** - Fee records
- **Exams** - Exam schedules & results
- ... (more tables)

#### Data Files (Fallback)
- `permissions.json` - Role definitions
- `admin_credentials.json` - Admin login
- `date_sheet.json` - Academic calendar

---

### 6. Configuration Files

#### Environment Variables (`.env`)
```bash
# Database
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Security
JWT_SECRET, ADMIN_PASSWORD

# Email (SMTP)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

# App Settings
NODE_ENV, PORT, AUTO_CREATE_DB
```

#### Production Config (`config/production.js`)
- Database connection pooling
- Security headers
- CORS settings
- Rate limiting
- Caching rules

#### cPanel Config (`.cpanel.yml`)
- Deployment automation
- Backup and restore logic
- Directory permissions

#### Apache Config (`.htaccess`)
- HTTPS redirection
- Gzip compression
- Caching headers
- Security headers

---

## Data Flow Examples

### Example 1: User Login

```
User → HTML Form (frontend/login.html)
    ↓
JavaScript (auth.js) sends POST /api/login
    ↓
Backend validates credentials
    ↓
Returns JWT token
    ↓
JavaScript saves token in localStorage
    ↓
Redirect to dashboard
```

### Example 2: Student CRUD

```
User clicks "Add Student" (frontend/students.html)
    ↓
Form submitted via JavaScript
    ↓
POST /api/students with student data + JWT token
    ↓
Backend verifies token & permissions
    ↓
Creates record in MySQL students table
    ↓
Returns success response
    ↓
JavaScript reloads student list
    ↓
Fetches GET /api/students
    ↓
Backend queries MySQL
    ↓
Returns student list as JSON
    ↓
JavaScript renders HTML
```

### Example 3: Scheduled Email (Cron Job)

```
App starts → Scheduler initialized
    ↓
Runs every day at 9:00 AM (configurable)
    ↓
Queries MySQL for pending fees
    ↓
Sends reminder emails via Nodemailer/SMTP
    ↓
Logs results in logs/app.log
```

---

## Deployment Architecture

### On cPanel

```
cPanel Account
├── Node.js App (managed by cPanel)
│   ├── Process: node app.js
│   ├── Port: Assigned by cPanel (e.g., 3000)
│   ├── Instances: 1 (or configurable)
│   └── Auto-restart: Enabled
│
├── MySQL Database
│   └── Credentials: Set in .env
│
├── File System
│   ├── /home/user/my_school_app/ (app files)
│   ├── /home/user/my_school_app/logs/ (log files)
│   ├── /home/user/my_school_app/uploads/ (user uploads)
│   └── /home/user/my_school_app/node_modules/ (dependencies)
│
└── Apache/Nginx
    ├── Domain/Subdomain
    └── SSL Certificate (AutoSSL)
```

---

## Important Notes

### Security
- ✅ JWT-based authentication
- ✅ Password hashing (bcryptjs)
- ✅ CORS enabled for API
- ✅ HTTPS enforced via .htaccess
- ✅ Environment variables protected (not in repo)

### Performance
- ✅ Database connection pooling
- ✅ Static file caching (via .htaccess)
- ✅ Gzip compression (via .htaccess)
- ✅ Sequelize query optimization

### Scalability
- For current size: Works perfectly on cPanel
- For growth: Consider migrating to Node.js VPS/Cloud
- For enterprise: Add load balancing, CDN, etc.

---

## Related Documentation

- [Full cPanel Deployment Guide](CPANEL_DEPLOYMENT_COMPLETE.md)
- [Quick Start Deployment](DEPLOYMENT_QUICK_START.md)
- [Database Setup](README_DATABASE_SETUP.md)

---

**Last Updated:** May 26, 2026
**Version:** 1.0
