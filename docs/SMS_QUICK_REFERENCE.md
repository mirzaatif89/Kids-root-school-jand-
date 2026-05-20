# 🚀 SMS System - Quick Reference

## 📱 Files Created

### Backend Files
- `routes/smsService.js` - SMS sending logic (supports multiple gateways)
- `routes/smsRoutes.js` - API endpoints for SMS operations

### Frontend Files
- `sms_sender.html` - Standalone HTML UI
- `components/SMSBulkSender.jsx` - React component

### Documentation
- `SMS_SETUP_GUIDE.md` - Gateway setup instructions
- `SMS_IMPLEMENTATION_GUIDE.md` - Complete integration guide
- `SERVER_INTEGRATION.md` - Code snippets for server.js
- `SERVER_COMPLETE_EXAMPLE.js` - Full server.js example

### Testing
- `test-sms.js` - Automated test suite

---

## ⚡ 60-Second Setup

### 1. Get API Key (Choose One)

**Fast2SMS (Pakistan/India):**
```
Go to https://www.fast2sms.com → Sign up → Dashboard → API KEY
```

**Twilio (Global):**
```
Go to https://www.twilio.com → Sign up → Get API credentials
```

### 2. Update `.env`

```env
SMS_GATEWAY=fast2sms
FAST2SMS_API_KEY=your_key_here
SCHOOL_PHONE_NUMBER=+92-300-1234567
```

### 3. Install & Integrate

```bash
npm install axios
```

Then in your **server.js**, add after other imports:
```javascript
const { router: smsRouter, initializeSMSLog } = require('./routes/smsRoutes');

// After sequelize init:
initializeSMSLog(sequelize);

// With other routes:
app.use('/api/sms', smsRouter);
```

### 4. Test

```bash
npm start
node test-sms.js
```

### 5. Use

Open browser: `http://localhost:3000/sms_sender.html`

---

## 🔌 API Quick Reference

### Send Bulk SMS
```bash
POST /api/sms/send-bulk
{
  "studentIds": [1, 2, 3],
  "messageTemplate": "Hi {NAME}, call {SCHOOL_PHONE}",
  "schoolPhone": "+92-300-1234567"
}
```

### Send Single SMS
```bash
POST /api/sms/send-single
{
  "phoneNumber": "+92-300-1111111",
  "studentName": "Ahmed",
  "messageTemplate": "Hi {NAME}!",
  "schoolPhone": "+92-300-1234567"
}
```

### Get Logs
```bash
GET /api/sms/logs?limit=50&status=sent
```

### Get Stats
```bash
GET /api/sms/stats
```

---

## 💬 Message Variables

- `{NAME}` - Student name
- `{PHONE}` - Student phone
- `{SCHOOL_PHONE}` - School number

**Example:**
```
Hi {NAME}, your fees are due. Call us: {SCHOOL_PHONE}
```

---

## 🧪 Quick Test Commands

```bash
# Check server
curl http://localhost:3000

# Get students
curl http://localhost:3000/api/students

# Get SMS logs
curl http://localhost:3000/api/sms/logs

# Get stats
curl http://localhost:3000/api/sms/stats

# Run test suite
npm install axios
node test-sms.js
```

---

## 📊 SMS Gateway Comparison

| Gateway | Cost | Setup | Best For |
|---------|------|-------|----------|
| **Fast2SMS** | 0.015/SMS | 5 min ⭐ | Pakistan/India |
| **Twilio** | 0.0075/SMS | 10 min | Global |
| **AWS SNS** | 0.0645/SMS | 20 min | Enterprise |

---

## 🎯 Next Steps

1. **Choose gateway** → Get API key
2. **Update .env** → Add credentials
3. **Add to server.js** → Integrate routes
4. **Test** → Run `node test-sms.js`
5. **Use UI** → Open `sms_sender.html`
6. **Monitor** → Check `/api/sms/logs`

---

## ⚠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "API key invalid" | Check .env file, restart server |
| "Invalid phone number" | Use format: +92-300-1234567 |
| "404 on /api/sms" | Add route to server.js, restart |
| "Students not loading" | Check /api/students endpoint |
| "SMS not sent" | Check /api/sms/logs for errors |

---

## 📚 Full Guides

📖 **Setup Guide:** `SMS_SETUP_GUIDE.md`  
📖 **Implementation:** `SMS_IMPLEMENTATION_GUIDE.md`  
📖 **Server Code:** `SERVER_INTEGRATION.md`  

---

## 🎓 Template Examples

```javascript
// Academic
"Hi {NAME}, new assignment posted. Check portal."

// Fees
"Dear {NAME}, fees due. Reply or call {SCHOOL_PHONE}"

// Attendance  
"Your attendance is low {NAME}. Call: {SCHOOL_PHONE}"

// Event
"Hi {NAME}, school event on Friday. See you!"

// Emergency
"URGENT {NAME}: Call school immediately {SCHOOL_PHONE}"
```

---

## 🔐 Security

✅ Never commit `.env` to GitHub  
✅ Use different keys for dev/prod  
✅ Log all SMS for audit  
✅ Validate phone numbers  
✅ Rate limit SMS sending  

---

**Version:** 1.0  
**Last Updated:** January 2024  
**Status:** Production Ready ✅
