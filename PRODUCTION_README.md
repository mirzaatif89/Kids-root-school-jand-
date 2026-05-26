# 🏫 School CRM - Production Deployment Ready

A complete **School Management System** with real-time features, built with Node.js, Express, MySQL, and vanilla JavaScript.

**Status:** ✅ Production-Ready for cPanel Hosting

---

## 📋 Quick Links

- 🚀 [Quick Start Deployment](docs/DEPLOYMENT_QUICK_START.md)
- 📖 [Full cPanel Deployment Guide](docs/CPANEL_DEPLOYMENT_COMPLETE.md)
- 🏗️ [Project Architecture](docs/PROJECT_STRUCTURE.md)
- 📚 [Database Setup](docs/README_DATABASE_SETUP.md)
- 🔒 [Security & Permissions](docs/DESIGNATION_PERMISSIONS_GUIDE.md)

---

## ✨ Features

### 👥 User Management
- ✅ Student profiles & registration
- ✅ Teacher management
- ✅ Staff administration
- ✅ Role-based access control (RBAC)
- ✅ Multi-level permissions system

### 📚 Academic
- ✅ Class & section management
- ✅ Student attendance tracking
- ✅ Teacher attendance
- ✅ Exam schedules & results
- ✅ Leave request management
- ✅ Assignment uploads

### 💰 Finance
- ✅ Fee management & tracking
- ✅ Payment records
- ✅ Fine management
- ✅ Revenue reports
- ✅ Pending fee notifications (automated)

### 📢 Communication
- ✅ Email notifications (SMTP)
- ✅ Special notices & announcements
- ✅ Birthday reminders (automated)
- ✅ Fee reminders (scheduled)
- ✅ Real-time updates (WebSocket)

### 📖 Additional
- ✅ Library management
- ✅ Transport assignment
- ✅ Café management
- ✅ Visitor logs
- ✅ Document management

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL, Sequelize ORM |
| **Real-time** | Socket.io |
| **Authentication** | JWT (JSON Web Tokens) |
| **Email** | Nodemailer |
| **Security** | bcryptjs, CORS, Security Headers |

---

## 📦 Installation

### Prerequisites
- Node.js 16+ (18+ recommended)
- MySQL 5.7+
- npm or yarn

### Local Development Setup

```bash
# 1. Clone or extract the project
cd My_own_school_Crm

# 2. Install dependencies
npm install

# 3. Create environment file
cp .production.env.example .env

# 4. Edit .env with your settings
# At minimum set:
# - DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
# - JWT_SECRET (strong random string)
# - SMTP credentials for email

# 5. Validate startup
npm run validate

# 6. Start development server
npm run dev

# Or with validation:
npm run validate:start
```

Access application at: `http://localhost:3000`

---

## 🚀 Production Deployment

### Option 1: cPanel Hosting (Recommended for Shared Hosting)

```bash
# 1. Prepare deployment package
.\create-hosting-zip.ps1 -Output school-crm.zip

# 2. Upload to cPanel
# - Create /home/user/my_school_app folder
# - Upload and extract school-crm.zip

# 3. Configure in cPanel
# - Setup Node.js App
# - Set environment variables
# - Run npm install
# - Restart app
```

👉 **[Read Full cPanel Guide](docs/CPANEL_DEPLOYMENT_COMPLETE.md)**

### Option 2: Using PM2 (VPS/Dedicated Server)

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start with PM2
pm2 start ecosystem.config.js

# 3. Save for auto-startup
pm2 save
pm2 startup

# 4. Monitor logs
pm2 logs school-crm
```

---

## 🔐 Security Features

### Built-in Security
- ✅ JWT-based authentication
- ✅ Password hashing (bcryptjs)
- ✅ CORS protection
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Rate limiting
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ HTTPS enforcement

### Best Practices
1. **Never commit `.env` to Git**
2. **Use strong passwords** (min 32 chars for JWT_SECRET)
3. **Keep dependencies updated**
4. **Monitor logs regularly**
5. **Regular database backups**
6. **Enable HTTPS/SSL**

---

## 📧 Email Configuration

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail
2. **Create App Password:**
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select Mail and Windows Computer
   - Copy 16-character password
   - Use in `.env` as `SMTP_PASS`

3. **Set in `.env`:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=School Name
```

### Custom SMTP
Use your email provider's SMTP settings in `.env`

---

## 📊 Database

### Auto-initialization
Database tables are created automatically on first run if they don't exist.

### Tables Created
- Users (admin, teachers, staff)
- Students
- Classes
- Teachers
- Attendance
- Fees & Payments
- Exams & Results
- Assignments
- Leave Requests
- And more...

### Configuration
```env
DB_HOST=localhost
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306
AUTO_CREATE_DB=false  # Set true only for first setup
```

---

## 🧪 API Endpoints

### Authentication
```
POST   /api/login                  # User login
POST   /api/logout                 # User logout
GET    /api/auth/verify            # Verify token
POST   /api/auth/change-password   # Change password
```

### Students
```
GET    /api/students               # List all
GET    /api/students/:id           # Get one
POST   /api/students               # Create
PUT    /api/students/:id           # Update
DELETE /api/students/:id           # Delete
```

### Similar endpoints for:
- `/api/teachers`
- `/api/staff`
- `/api/classes`
- `/api/fees`
- `/api/exams`
- `/api/attendance`
- And more...

### Health Check
```
GET    /health                     # Server status
```

Response:
```json
{
  "success": true,
  "initialized": true,
  "timestamp": "2026-05-26T10:30:45.123Z"
}
```

---

## 🛠️ Scripts

```bash
# Development
npm run dev                  # Start with nodemon (hot reload)

# Production
npm run production           # Start in production mode
npm run validate            # Validate configuration
npm run validate:start      # Validate then start

# PM2 Management
npm run pm2:start           # Start with PM2
npm run pm2:restart         # Restart
npm run pm2:stop            # Stop
npm run pm2:logs            # View logs
npm run pm2:save            # Save for auto-startup
```

---

## 📋 Configuration Files

### `.env` - Environment Variables
```env
# Required
DB_HOST=localhost
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=password
JWT_SECRET=your_very_strong_secret_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app_password

# Optional
NODE_ENV=production
PORT=3000
AUTO_CREATE_DB=false
```

### `config/production.js` - Production Settings
Database pooling, security, CORS, logging

### `ecosystem.config.js` - PM2 Configuration
Cluster mode, resource limits, restart policy

### `.cpanel.yml` - cPanel Deployment
Backup, restore, deployment automation

### `.htaccess` - Apache Configuration
HTTPS redirect, compression, caching, headers

---

## 🆘 Troubleshooting

### "502 Bad Gateway"
```bash
# Check if app is running
ps aux | grep node

# View logs
tail -50 logs/app.log
```

### Database Connection Error
```bash
# Test connection
mysql -h localhost -u root -p your_database

# Check .env credentials
cat .env | grep DB_
```

### npm install Fails
```bash
rm -rf node_modules package-lock.json
npm install
```

### Emails Not Sending
- Verify SMTP credentials in `.env`
- Use Gmail App Password (not regular password)
- Check email configuration in app settings
- Review logs for errors

👉 **[Full Troubleshooting Guide](docs/CPANEL_DEPLOYMENT_COMPLETE.md#troubleshooting)**

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [Quick Start](docs/DEPLOYMENT_QUICK_START.md) | 30-min deployment checklist |
| [Full cPanel Guide](docs/CPANEL_DEPLOYMENT_COMPLETE.md) | Complete cPanel setup |
| [Project Structure](docs/PROJECT_STRUCTURE.md) | Architecture & code organization |
| [Database Setup](docs/README_DATABASE_SETUP.md) | Database configuration |
| [Server Integration](docs/SERVER_INTEGRATION.md) | Server-specific setup |
| [Permissions Guide](docs/DESIGNATION_PERMISSIONS_GUIDE.md) | Role-based access |
| [SMS Setup](docs/SMS_SETUP_GUIDE.md) | SMS notification setup |

---

## 🔄 Updates & Maintenance

### Keeping Dependencies Updated
```bash
npm update                      # Update packages
npm outdated                    # Check outdated packages
npm audit                       # Check security issues
npm audit fix                   # Fix security issues
```

### Database Backups
Ensure regular backups via cPanel Database Backups

### Log Rotation
Monitor `/logs/` directory and archive old logs

### Scheduled Tasks
- Fee reminders (daily at 9 AM)
- Birthday notifications (daily)
- Special notice emails (on demand)

---

## 📈 Performance Optimization

✅ Already Configured:
- Database connection pooling
- Static file caching (via `.htaccess`)
- Gzip compression
- CORS optimization
- JWT token-based auth (no session overhead)

Future Improvements:
- Redis caching
- CDN for static files
- Database query optimization
- Frontend minification

---

## 🤝 Support & Resources

### Documentation
- [Node.js Docs](https://nodejs.org/docs/)
- [Express Docs](https://expressjs.com/)
- [Sequelize Docs](https://sequelize.org/)
- [cPanel Docs](https://docs.cpanel.net/)

### Common Issues
1. **MySQL not running?** Start MySQL service
2. **Port already in use?** Change PORT in `.env`
3. **File permissions?** Ensure `logs/` and `uploads/` are writable
4. **CORS errors?** Check frontend/backend URLs match

---

## 📝 License

This project is proprietary software for internal use only.

---

## ✅ Pre-Deployment Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] `.env` file created with correct credentials
- [ ] Database created in cPanel/MySQL
- [ ] SMTP credentials tested
- [ ] `npm run validate` passes all checks
- [ ] Application starts without errors (`npm start`)
- [ ] Health endpoint responds (`/health`)
- [ ] Login page loads (`/`)
- [ ] Can create test records
- [ ] SSL/HTTPS configured
- [ ] Logs created in `logs/` directory
- [ ] Node.js app configured in cPanel
- [ ] Environment variables set in cPanel
- [ ] npm install run on server
- [ ] Application restarted

---

## 🎯 Getting Help

1. **Check logs first:**
   ```bash
   tail -100 logs/app.log
   ```

2. **Run validation:**
   ```bash
   npm run validate
   ```

3. **Check documentation:**
   - Look in `/docs/` folder for detailed guides
   - Check related documentation section above

4. **Test manually:**
   ```bash
   # Test database
   mysql -h localhost -u user -p database

   # Test API
   curl http://localhost:3000/health
   ```

---

**Last Updated:** May 26, 2026  
**Version:** 2.0 (Production Ready)  
**Status:** ✅ Ready for Deployment
