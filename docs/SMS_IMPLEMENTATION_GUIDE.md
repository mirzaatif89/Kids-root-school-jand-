# 📱 SMS Bulk Sender - Complete Implementation Guide

## 🎯 What You Get

A **complete school CRM SMS system** that allows you to:

✅ Select multiple students  
✅ Send **personalized SMS** with student names  
✅ Messages sent from **your school's phone number**  
✅ Track SMS delivery history  
✅ Support multiple SMS gateways  
✅ Beautiful React/HTML UI  

---

## 🚀 Quick Start (5 Minutes)

### 1️⃣ **Get SMS Gateway API Key**

Choose one based on your region:

#### Option A: **Fast2SMS** (Pakistan/India - RECOMMENDED)
```
1. Go to https://www.fast2sms.com
2. Sign up with email
3. Verify phone number
4. Dashboard → API KEY → Copy your API key
```

#### Option B: **Twilio** (Global)
```
1. Go to https://www.twilio.com
2. Sign up → Get phone number
3. Copy Account SID and Auth Token
```

### 2️⃣ **Update .env File**

```env
# For Fast2SMS (Recommended)
SMS_GATEWAY=fast2sms
FAST2SMS_API_KEY=paste_your_api_key_here
SCHOOL_PHONE_NUMBER=+92-300-1234567

# OR for Twilio
SMS_GATEWAY=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3️⃣ **Install Dependencies**

```bash
npm install axios
```

### 4️⃣ **Integrate in Your Node.js Server**

Open your `server.js` and add these lines:

```javascript
// Add this import at the top
const { router: smsRouter, initializeSMSLog } = require('./routes/smsRoutes');

// In your sequelize initialization section, add:
// initializeSMSLog(sequelize);

// Add this route (example: after other routes)
app.use('/api/sms', smsRouter);

// Make sure your Student model exists:
// The API expects: id, name, phoneNumber fields
```

### 5️⃣ **Access the UI**

Open in browser:
```
http://localhost:3000/sms_sender.html
```

---

## 📊 Project Structure

```
your-project/
├── routes/
│   ├── smsService.js          ← SMS sending logic (Twilio, Fast2SMS, AWS)
│   └── smsRoutes.js           ← API endpoints (/api/sms/send-bulk, etc)
├── components/
│   └── SMSBulkSender.jsx      ← React component
├── sms_sender.html            ← Standalone HTML UI
├── .env                       ← Configuration (updated)
└── server.js                  ← Your main server
```

---

## 🔌 API Endpoints

### **POST /api/sms/send-bulk**
Send SMS to multiple students

**Request:**
```json
{
    "studentIds": [1, 2, 3],
    "messageTemplate": "Hi {NAME}, Important update. Call: {SCHOOL_PHONE}",
    "schoolPhone": "+92-300-1234567"
}
```

**Response:**
```json
{
    "success": true,
    "results": {
        "successful": [
            {
                "student": "Ahmed Ali",
                "phone": "+92-300-1111111",
                "messageId": "SM1234567890",
                "status": "sent"
            }
        ],
        "failed": [],
        "summary": {
            "totalRequested": 1,
            "totalSent": 1,
            "totalFailed": 0
        }
    }
}
```

### **POST /api/sms/send-single**
Send SMS to one student

**Request:**
```json
{
    "studentId": 1,
    "phoneNumber": "+92-300-1111111",
    "studentName": "Ahmed Ali",
    "messageTemplate": "Hi {NAME}, Test message",
    "schoolPhone": "+92-300-1234567"
}
```

### **GET /api/sms/logs**
Get SMS history

**Query Params:**
- `limit`: 50 (default)
- `offset`: 0 (default)
- `status`: sent/failed/pending (optional)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "studentName": "Ahmed Ali",
            "phoneNumber": "+92-300-1111111",
            "messageContent": "Hi Ahmed Ali...",
            "status": "sent",
            "gateway": "Fast2SMS",
            "sentAt": "2024-01-15T10:30:00Z"
        }
    ],
    "pagination": {
        "total": 150,
        "limit": 50,
        "offset": 0
    }
}
```

### **GET /api/sms/stats**
Get SMS statistics

**Response:**
```json
{
    "success": true,
    "stats": {
        "total": 500,
        "sent": 480,
        "failed": 20,
        "pending": 0,
        "successRate": "96.00%"
    }
}
```

---

## 💬 Message Templates & Variables

Your messages can use these placeholders:

| Variable | Example | Usage |
|----------|---------|-------|
| `{NAME}` | Ahmed | "Hi {NAME}, your fees are due" |
| `{PHONE}` | 03001234567 | "Your registered phone: {PHONE}" |
| `{SCHOOL_PHONE}` | +92-300-9876543 | "Contact us at {SCHOOL_PHONE}" |

**Example Messages:**

```javascript
// Academic Update
"Hi {NAME}, you have new assignments. Check portal: {SCHOOL_PHONE}"

// Attendance
"Dear {NAME}, Your attendance is low. Please meet teacher or call {SCHOOL_PHONE}"

// Fee Reminder
"Hello {NAME}, School fees due. Pay online or visit office. Call: {SCHOOL_PHONE}"

// Emergency
"URGENT: {NAME}, please contact school immediately at {SCHOOL_PHONE}"

// Event Invitation
"Hi {NAME}, You're invited to our annual school event! Details on student portal."
```

---

## 🔐 Using React Component

If you're using React, import the component:

```jsx
import SMSBulkSender from './components/SMSBulkSender';

function App() {
    return (
        <div>
            <SMSBulkSender />
        </div>
    );
}

export default App;
```

---

## 🛠️ Database Schema

The system automatically creates an SMS log table:

```sql
CREATE TABLE sms_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studentId INT,
    studentName VARCHAR(255),
    phoneNumber VARCHAR(20),
    messageContent TEXT,
    messageTemplate TEXT,
    status ENUM('pending', 'sent', 'failed', 'delivered'),
    messageId VARCHAR(255),
    gateway VARCHAR(50),
    error TEXT,
    schoolPhone VARCHAR(20),
    sentAt DATETIME,
    deliveredAt DATETIME,
    createdAt DATETIME DEFAULT NOW()
);
```

---

## 🧪 Testing the API

### Test with cURL:

```bash
# Test single SMS
curl -X POST http://localhost:3000/api/sms/send-single \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+92-300-1234567",
    "studentName": "Test Student",
    "messageTemplate": "Hi {NAME}, this is a test from {SCHOOL_PHONE}",
    "schoolPhone": "+92-300-9999999"
  }'

# Get SMS logs
curl http://localhost:3000/api/sms/logs

# Get statistics
curl http://localhost:3000/api/sms/stats
```

### Test with JavaScript:

```javascript
// Send to multiple students
const response = await fetch('/api/sms/send-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        studentIds: [1, 2, 3, 4, 5],
        messageTemplate: 'Hi {NAME}, Important notice. Call: {SCHOOL_PHONE}',
        schoolPhone: '+92-300-1234567'
    })
});

const result = await response.json();
console.log(result);
```

---

## 📱 Supported Phone Formats

The system automatically formats phone numbers:

```
Input Format           → Normalized Format
03001234567           → +92-300-1234567
+92-300-1234567       → +92-300-1234567
92-300-1234567        → +92-300-1234567
+1-555-123-4567       → +1-555-123-4567
555-123-4567          → +92-555-123-4567 (Pakistan default)
```

---

## ⚙️ SMS Gateway Comparison

| Feature | Fast2SMS | Twilio | AWS SNS |
|---------|----------|--------|---------|
| **Cost** | $0.015/SMS | $0.0075/SMS | $0.0645/SMS |
| **Coverage** | 150+ | 150+ | 150+ |
| **Setup Time** | 5 min | 10 min | 20 min |
| **Best For** | Pakistan/India | Global | Enterprise |
| **API** | Simple | Full-featured | Complex |

---

## 🐛 Troubleshooting

### Problem: "Invalid phone number"
**Solution:** Ensure phone starts with country code
- ❌ Wrong: `3001234567`
- ✅ Right: `+92-300-1234567` or `03001234567`

### Problem: "API key not working"
**Solution:**
1. Verify API key in Fast2SMS/Twilio dashboard
2. Restart Node.js server
3. Check `.env` file has correct key

### Problem: "Message not sent"
**Solution:**
1. Check `/api/sms/logs` for error details
2. Verify recipient phone number format
3. Check SMS gateway balance/quota

### Problem: "404 on /api/sms routes"
**Solution:**
1. Make sure `app.use('/api/sms', smsRouter);` is in `server.js`
2. Make sure `/routes/smsRoutes.js` exists
3. Restart server: `npm start`

---

## 📋 Checklist

- [ ] Signed up for SMS gateway (Fast2SMS or Twilio)
- [ ] Got API key/credentials
- [ ] Updated `.env` file
- [ ] Ran `npm install axios`
- [ ] Added SMS routes to `server.js`
- [ ] Restarted server
- [ ] Tested at `http://localhost:3000/sms_sender.html`
- [ ] Verified student list loads
- [ ] Sent test SMS to 1-2 students
- [ ] Checked `/api/sms/logs` for delivery status

---

## 🎓 Next Steps

1. **Add SMS Scheduling:** Send SMS at specific times
2. **Add Retry Logic:** Automatically retry failed messages
3. **Add Whatsapp:** Use Twilio WhatsApp API
4. **Add Unsubscribe:** Handle STOP requests
5. **Add Analytics:** Track delivery rates and engagement
6. **Add Webhook:** Receive delivery confirmations

---

## 📞 Support

For issues, check:
- SMS gateway dashboard for error messages
- `/api/sms/logs` API for detailed logs
- Browser console for JavaScript errors
- Node.js console for server errors

---

**Happy SMS Sending! 🚀**
