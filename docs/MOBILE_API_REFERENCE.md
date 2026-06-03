# Kids Roots Jand CRM API Reference

Base URL:

```text
https://kidsrootsjand.com
```

All JSON APIs are under:

```text
https://kidsrootsjand.com/api
```

## Auth

### Login

```http
POST /api/login
Content-Type: application/json
```

Body:

```json
{
  "username": "admin",
  "password": "Admin@KidsRoots2026"
}
```

Response:

```json
{
  "success": true,
  "token": "JWT_TOKEN",
  "sessionId": "SESSION_ID",
  "permissions": {},
  "user": {
    "id": "admin",
    "fullName": "Administrator",
    "role": "Admin",
    "username": "admin"
  }
}
```

For protected APIs, send:

```http
Authorization: Bearer JWT_TOKEN
```

### Session

```http
POST /api/session/heartbeat
POST /api/session/end
GET /api/active-sessions
DELETE /api/active-sessions/:sessionId
POST /api/active-sessions/logout
```

## Students

```http
GET /api/students
POST /api/students
DELETE /api/students/:id
GET /api/student/me
POST /api/student/me
```

`POST /api/students` accepts one student object or an array of student objects.

Common student fields:

```json
{
  "id": "student-id",
  "fullName": "Student Name",
  "fatherName": "Father Name",
  "rollNo": "101",
  "classGrade": "Class 1",
  "campusName": "Main Campus",
  "phone": "03000000000",
  "email": "student@example.com",
  "username": "student101",
  "password": "password123"
}
```

## Teachers And Staff

```http
GET /api/teachers
POST /api/teachers
DELETE /api/teachers/:id
GET /api/teacher/me
POST /api/teacher/me

GET /api/staff
POST /api/staff
DELETE /api/staff/:id
```

## Attendance

```http
GET /api/student-attendance
POST /api/student-attendance
GET /api/teacher-attendance
POST /api/teacher-attendance
```

Student attendance body:

```json
{
  "studentId": "student-id",
  "date": "2026-05-29",
  "status": "Present"
}
```

Teacher attendance body:

```json
{
  "teacherId": "teacher-id",
  "date": "2026-05-29",
  "status": "Present"
}
```

Valid status values include:

```text
Present, Absent, Leave, Late, Not Marked
```

## Fees

```http
GET /api/class-fees
POST /api/class-fees
PUT /api/class-fees/history/:id
DELETE /api/class-fees/history/:id

POST /api/fees/challan-token
POST /api/fees/challan-tokens
POST /api/fees/manual-payment
GET /api/fees/payments
POST /api/fees/fine-charge
POST /api/fees/mark-unpaid
GET /api/fees/due-balances
GET /api/fees/pay/:token
POST /api/fees/send-pending-reminders
```

Manual payment body example:

```json
{
  "studentId": "student-id",
  "studentName": "Student Name",
  "rollNo": "101",
  "classGrade": "Class 1",
  "session": "2026",
  "feeMonth": "May 2026",
  "amount": 5000,
  "status": "Paid"
}
```

## Leave Requests

```http
GET /api/leave-requests
POST /api/leave-requests
POST /api/leave-requests/:id
DELETE /api/leave-requests/:id
```

## Assignments

```http
GET /api/student-assignments
POST /api/student-assignments
```

## Announcements And Website Data

```http
GET /api/special-notices
POST /api/special-notices
DELETE /api/special-notices/:id

GET /api/banners
POST /api/banners
DELETE /api/banners/:id

GET /api/date-sheet
POST /api/date-sheet
```

## Branches

```http
GET /api/branches
POST /api/branches
DELETE /api/branches/:id
```

## Library

```http
GET /api/library/issues
POST /api/library/issues
POST /api/library/issues/:id/return
DELETE /api/library/issues/:id
```

## Cafe And Transport

```http
GET /api/cafe/contracts
POST /api/cafe/contracts
DELETE /api/cafe/contracts/:id

GET /api/transport/assignments
POST /api/transport/assignments
DELETE /api/transport/assignments/:id
```

## Email

```http
GET /api/email/config
POST /api/email/send
POST /api/email/execute-all
POST /api/email/send-birthday-greetings
```

## Admin And Permissions

```http
GET /api/permissions
POST /api/permissions
GET /api/designation-permissions
POST /api/designation-permissions

GET /api/admin-credentials
POST /api/admin-credentials
POST /api/admin-credentials/request-otp
POST /api/admin-credentials/verify-otp
POST /api/admin-password/forgot/request-otp
POST /api/admin-password/forgot/reset

POST /api/reset-data
```

## Health

```http
GET /health
```

## Socket.IO Events

The backend also uses Socket.IO at the same domain:

```text
https://kidsrootsjand.com
```

Common emitted events:

```text
students_update
teachers_update
fee_payment_update
date_sheet_update
```

