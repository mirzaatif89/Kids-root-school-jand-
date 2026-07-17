# SMS Gateway Configuration Guide

## 🔧 Choose Your SMS Gateway

Your school CRM supports multiple SMS gateways. Choose one based on your region:

### Option 1: **Twilio** (Global - Recommended)
- ✅ Most reliable, supports 150+ countries
- 📱 Website: https://www.twilio.com
- 💰 Free trial: $15 credit
- 📋 Steps:
  1. Sign up at https://www.twilio.com/console
  2. Get phone number (+1 or any country)
  3. Copy Account SID and Auth Token
  4. Add to `.env`:
     ```
     SMS_GATEWAY=twilio
     TWILIO_ACCOUNT_SID=your_account_sid
     TWILIO_AUTH_TOKEN=your_auth_token
     TWILIO_PHONE_NUMBER=+1234567890
     ```

### Option 2: **Fast2SMS** (India/Pakistan - Cheapest)
- ✅ Very cheap, popular in South Asia
- 📌 Website: https://www.fast2sms.com
- 💰 1000 SMS free on signup
- 📋 Steps:
  1. Sign up at https://www.fast2sms.com
  2. Verify mobile number
  3. Get API key from Dashboard
  4. Add to `.env`:
     ```
     SMS_GATEWAY=fast2sms
     FAST2SMS_API_KEY=your_api_key
     ```

### Option 3: **AWS SNS** (for AWS users)
- ✅ Enterprise solution, pay-per-use
- 📋 Steps:
  1. Create AWS account and IAM user
  2. Enable SNS service
  3. Add to `.env`:
     ```
     SMS_GATEWAY=aws_sns
     AWS_ACCESS_KEY_ID=your_access_key
     AWS_SECRET_ACCESS_KEY=your_secret_key
     AWS_REGION=ap-south-1
     ```

## 📨 SMS Parameters

```javascript
// Phone numbers supported formats:
"+92-300-1234567"  // Pakistan
"+92300-1234567"
"03001234567"      // Will auto-add country code as +92
"+91-98765-43210"  // India
"+1-555-123-4567"  // USA
```

## 💬 Message Template Variables

Your messages can use these placeholders:
- `{NAME}` - Student name
- `{PHONE}` - Student phone number  
- `{SCHOOL_PHONE}` - Your school's phone number

Example:
```
Hi {NAME}, Important announcement from school. 
Reply or call us at {SCHOOL_PHONE} for details.
```

## 🎯 SMS Length Limits

- **Single SMS**: 160 characters (ASCII) or 70 characters (Unicode)
- **Multiple SMS**: Longer messages are split automatically
- Your component shows character count in real-time

## 🚀 Quick Setup (Recommended: Fast2SMS for Pakistan/India)

1. Go to https://www.fast2sms.com
2. Sign up with your email
3. Verify mobile number
4. Log in → Dashboard → API KEY
5. Copy your API key
6. Update `.env`:
   ```
   SMS_GATEWAY=fast2sms
   FAST2SMS_API_KEY=your_api_key_here
   SCHOOL_PHONE_NUMBER=+92-300-1234567
   ```
7. Restart server
8. Test in UI

## ✅ Testing Your Setup

```bash
# Test SMS sending
curl -X POST http://localhost:3000/api/sms/send-single \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+92-300-1234567",
    "studentName": "Ahmed Ali",
    "messageTemplate": "Hi {NAME}, this is a test message from {SCHOOL_PHONE}",
    "schoolPhone": "+92-300-1234567"
  }'
```

## 📊 Monitoring SMS Status

Check SMS logs at:
```
GET /api/sms/logs          # View all SMS history
GET /api/sms/stats         # View statistics
```

## ⚠️ Common Issues

**Issue**: "Invalid phone number"
- **Fix**: Ensure phone starts with + or country code (e.g., +92)

**Issue**: "Gateway not responding"
- **Fix**: Check API key and internet connection

**Issue**: "Message not delivered"
- **Fix**: Check SMS logs for error details, verify recipient number format

## 🔐 Security Tips

✅ Never commit `.env` to GitHub
✅ Use different API keys for development and production
✅ Set rate limits to prevent SMS spam
✅ Log all SMS for compliance
