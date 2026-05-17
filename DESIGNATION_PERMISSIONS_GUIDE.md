# Designation-Based Permissions System

## Overview

This system provides **granular, action-level permissions** based on employee designations. Unlike role-based permissions (which control module access), designation-based permissions control **what actions** users can perform within each module.

## How It Works

### 1. Designations vs Roles

- **Role** (e.g., Teacher, Staff, Admin): Controls access to modules (can user see this module?)
- **Designation** (e.g., Computer Operator, Senior Teacher, Principal): Controls specific actions within modules (what can user do?)

### 2. Action Levels

Each designation can have these permissions for each module:

| Action | Meaning | Example |
|--------|---------|---------|
| **view** | Can see the data | Can view student list |
| **add** | Can create new records | Can add new student |
| **edit** | Can modify existing records | Can update student info |
| **delete** | Can remove records | Can delete student |
| **export** | Can export data to files | Can export attendance report |
| **import** | Can import data from files | Can bulk import students |
| **bulk_action** | Can perform actions on multiple records | Can mark attendance for entire class |

## Pre-configured Designations

### Computer Operator
**Description:** Staff member responsible for computer lab and data entry

**Permissions:**
- **Students**: Can view and add only (no edit/delete)
- **Teachers**: Can only view
- **Classes**: Can only view
- **Student Attendance**: Can add and edit (no delete)
- **Exams**: Can view and export
- **Fees**: Can view and export

**Use Case:** Data entry staff who inputs student information but cannot modify or delete it.

### Teacher
**Description:** Teaching staff member

**Permissions:**
- **Students**: Can view only
- **Classes**: Can view and edit
- **Student Attendance**: Can add, edit, and bulk mark
- **Exams**: Can create, edit, and export

**Use Case:** Teachers manage their classes and attendance but cannot add new students.

### Principal
**Description:** School principal with full access

**Permissions:**
- **All modules**: Can perform all actions (view, add, edit, delete, export, import, bulk)

**Use Case:** Principal has complete control over all school operations.

### Senior Teacher
**Description:** Senior teaching staff with additional management responsibilities

**Permissions:**
- **Students**: Can view and export
- **Teachers**: Can view only
- **Classes**: Can view and edit
- **Student Attendance**: Full access (can delete and bulk)
- **Exams**: Full access (can delete and bulk)

**Use Case:** Senior teacher supervises classes and manages attendance/exams.

### Accountant
**Description:** Finance and accounts management staff

**Permissions:**
- **Students**: Can view and export
- **Fees**: Full access (add, edit, export, import, bulk)
- **Fee Challan**: Full access
- **Teacher Salaries**: Full access
- **Revenue**: Can view and export

**Use Case:** Manages all financial transactions and reports.

### Receptionist
**Description:** Front office receptionist

**Permissions:**
- **Students**: Can view only
- **Teachers**: Can view only
- **Fees**: Can view only

**Use Case:** Reception staff answers queries about student/teacher info.

### Office Assistant
**Description:** Administrative assistant

**Permissions:**
- **Students**: Can view only
- **Classes**: Can view only

**Use Case:** Administrative support with minimal access.

## Real-World Example: Computer Operator

A teacher with the "Computer Operator" designation should:

✅ **CAN DO:**
- View the complete student list
- Add new students to the system
- Mark student attendance
- Edit attendance records
- Export attendance reports
- Export exam schedules

❌ **CANNOT DO:**
- Edit student information (names, rolls, fees, etc.)
- Delete students from system
- Delete attendance records
- Manage teacher information
- Manage fees

## How to Configure

### Step 1: Access Designation Permissions
Navigate to: **Admin Panel → Designation Permissions**

### Step 2: Select a Designation
Click on a designation from the left sidebar (e.g., "Computer Operator")

### Step 3: Configure Actions
For each module, toggle the checkboxes for allowed actions:
- ✓ Check = Permission Allowed
- □ Uncheck = Permission Denied

### Step 4: Save
Click "Save All Permissions" to apply changes

## Configuration Tips

### Adding Similar Designations

If you need a new designation similar to an existing one:
1. Copy an existing designation's configuration
2. Modify specific permissions as needed
3. Save with new designation name

### Restricting Dangerous Operations

For security, consider:
- Disabling **delete** for junior staff
- Allowing **edit** only for supervisors
- Requiring **approval workflow** for sensitive changes (implement separately)

### Audit Trail

For important designations like "Accountant":
- Enable **export** for audit reports
- Consider disabling **delete** to maintain records
- Implement activity logging (implement separately)

## Checking User Permissions

### In Admin Panel:
1. Go to **Staff/Teachers Management**
2. Check employee's **Designation** field
3. Verify their designation in **Designation Permissions**

### User Permissions Are Applied When:
- User logs in (designation loaded from profile)
- User performs an action (permission checked)
- UI renders (unavailable actions hidden)

## Common Scenarios

### Scenario 1: New Computer Operator
```
Designation: Computer Operator
Modules Needed: Students (add only), Attendance (full access), Export
Action: Enable add for students, disable edit/delete
Result: Can input data, cannot modify existing data
```

### Scenario 2: Deputy Principal
```
Designation: Senior Teacher (modified)
Add: Fees (view), Teacher management (view)
Remove: Nothing
Result: Full teaching permissions + fee/teacher visibility
```

### Scenario 3: Finance Clerk
```
Designation: Accountant (modified)
Remove: Teacher Salaries (delete)
Result: Can manage fees but cannot delete salary records
```

## Implementation Notes

- Permissions are checked in API layer before allowing operations
- UI dynamically hides unavailable actions based on designation
- Permissions are cached for performance
- Changes take effect immediately (no logout needed)

## Troubleshooting

### User Cannot Perform Expected Action:
1. Check user's **role** (must have module access)
2. Check user's **designation** (must have action permission)
3. Both must be enabled for action to work

### Designation Not Appearing:
1. Ensure designation is added to `permissions-detailed.json`
2. Restart the application
3. Check API response: `/api/designation-permissions/`

### Permission Changes Not Applied:
1. Clear browser cache
2. Log out and log in again
3. Check if changes were actually saved (look at timestamp)

## Best Practices

1. **Principle of Least Privilege:** Give only necessary permissions
2. **Regular Review:** Audit permissions quarterly
3. **Documentation:** Document why each designation has specific permissions
4. **Testing:** Test new permission configs with test users
5. **Backup:** Keep backup of working configurations
6. **Monitoring:** Monitor error logs for permission denials
