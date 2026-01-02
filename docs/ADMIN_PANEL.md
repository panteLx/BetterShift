# Admin Panel Guide

This guide covers the admin panel features in BetterShift, including user management, calendar administration, and audit logging.

## Table of Contents

1. [Overview](#overview)
2. [Roles and Permissions](#roles-and-permissions)
3. [User Management](#user-management)
4. [Calendar Management](#calendar-management)
5. [Audit Logs](#audit-logs)
6. [Rate Limiting](#rate-limiting)

---

## Overview

The admin panel is available at `/admin` and provides system-wide management capabilities. Access requires authentication with an admin or superadmin role.

### Accessing the Admin Panel

1. Login with an admin account
2. Click your profile menu in the header
3. Select "Admin Panel"

Or navigate directly to `/admin`.

---

## Roles and Permissions

BetterShift uses a three-tier role system:

| Role           | Description         | Capabilities                                                                                            |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| **user**       | Standard user       | Manage own calendars, view shared calendars                                                             |
| **admin**      | Administrator       | View users/calendars/logs, edit regular users, reset passwords, transfer calendars                      |
| **superadmin** | Super Administrator | All admin capabilities plus: delete users, delete calendars, delete audit logs, ban/unban, role changes |

### Permission Matrix

| Feature                         | Superadmin | Admin | User |
| ------------------------------- | ---------- | ----- | ---- |
| **User Management**             |            |       |      |
| View all users                  | Yes        | Yes   | No   |
| Edit regular users (role: user) | Yes        | Yes   | No   |
| Edit admins/superadmins         | Yes        | No    | No   |
| Delete regular users            | Yes        | No    | No   |
| Ban/Unban users                 | Yes        | No    | No   |
| Change user roles               | Yes        | No    | No   |
| Reset passwords                 | Yes        | Yes   | No   |
| **Calendar Management**         |            |       |      |
| View all calendars              | Yes        | Yes   | No   |
| Transfer calendar ownership     | Yes        | Yes   | No   |
| Delete any calendar             | Yes        | No    | No   |
| **Orphaned Calendars**          |            |       |      |
| View orphaned calendars         | Yes        | Yes   | No   |
| Assign orphaned calendars       | Yes        | Yes   | No   |
| Delete orphaned calendars       | Yes        | No    | No   |
| **Audit Logs**                  |            |       |      |
| View all audit logs             | Yes        | Yes   | No   |
| Delete audit logs               | Yes        | No    | No   |
| **System Stats**                |            |       |      |
| View system statistics          | Yes        | Yes   | No   |

### First User Promotion

The first user to register automatically becomes a **superadmin**. This ensures there's always an administrator who can manage the system.

### Role Assignment

- Superadmins can promote users to admin via the user management page
- Superadmins cannot be demoted (protection against lockout)
- Admins cannot modify other admins or superadmins

---

## User Management

Location: `/admin/users`

### User Table

The user table displays all registered users with:

- Avatar, name, and email
- Role badge (User, Admin, Superadmin)
- Status badge (Active, Banned)
- Registration date
- Action menu

### Available Actions

| Action         | Admin              | Superadmin | Description                                |
| -------------- | ------------------ | ---------- | ------------------------------------------ |
| View Details   | Yes                | Yes        | View user profile, calendars, and activity |
| Edit User      | Regular users only | Yes        | Change name, email                         |
| Change Role    | No                 | Yes        | Promote/demote user roles                  |
| Reset Password | Yes                | Yes        | Generate new password for user             |
| Ban User       | No                 | Yes        | Temporarily or permanently ban with reason |
| Unban User     | No                 | Yes        | Remove ban from user                       |
| Delete User    | No                 | Yes        | Permanently delete user and their data     |

Admins can only edit users with the "user" role. They cannot modify other admins or superadmins.

### Banning Users

When banning a user:

1. Click the action menu and select "Ban User"
2. Enter a ban reason (required)
3. Optionally set an expiration date
4. Confirm the ban

Banned users:

- Cannot login (see ban reason on login page)
- Have all sessions revoked immediately
- Cannot access the API
- Are automatically unbanned after expiration (if set)

### Deleting Users

Deleting a user permanently removes:

- User account and profile
- All sessions
- All owned calendars (including shifts, presets, notes)
- All calendar shares they created

This action cannot be undone. A confirmation dialog requires typing the user's email.

---

## Calendar Management

Location: `/admin/calendars`

### Calendar Table

Displays all calendars in the system with:

- Calendar name and color indicator
- Owner information (or "Orphaned" badge)
- Statistics (shifts, notes, presets, shares)
- Guest permission setting
- Action menu

### Orphaned Calendars

Calendars without an owner (orphaned) appear at the top of the list with a red "Orphaned" badge. This happens when:

- The calendar was created before auth was enabled
- The owner was deleted
- Database migration issues

Orphaned calendars are invisible to regular users and can only be managed through the admin panel.

### Available Actions

| Action             | Admin | Superadmin | Description                          |
| ------------------ | ----- | ---------- | ------------------------------------ |
| View Details       | Yes   | Yes        | View calendar info and statistics    |
| Edit Calendar      | Yes   | Yes        | Change name, color, guest permission |
| Transfer Ownership | Yes   | Yes        | Assign calendar to a different user  |
| Delete Calendar    | No    | Yes        | Permanently delete calendar          |

### Transferring Calendars

To transfer calendar ownership:

1. Click the action menu and select "Transfer"
2. Search for the new owner by name or email
3. Select the user from results
4. Confirm the transfer

The previous owner loses access (unless re-shared), and the new owner gains full control.

### Bulk Operations

Superadmins can select multiple calendars for:

- **Bulk Transfer**: Assign all selected calendars to one user
- **Bulk Delete**: Delete all selected calendars

Use these carefully - bulk operations cannot be undone.

---

## Audit Logs

Location: `/admin/logs`

The audit log tracks all significant actions in the system for security and compliance.

### Logged Events

| Category        | Events                                          |
| --------------- | ----------------------------------------------- |
| Authentication  | Login, logout, registration, password change    |
| User Management | Ban, unban, delete, role change, password reset |
| Calendar        | Create, delete, transfer, share changes         |
| Admin Actions   | All admin panel operations                      |

### Log Entry Details

Each log entry includes:

- Timestamp
- Action type
- Actor (who performed the action)
- Severity level (Info, Warning, Error, Critical)
- Metadata (additional context)
- IP address and user agent

### Filtering Logs

Filter audit logs by:

- Action type (dropdown)
- Severity level
- Date range
- Search text (searches action and metadata)

### Deleting Old Logs

Superadmins can delete logs older than a specified date:

1. Click "Delete Old Logs"
2. Select the cutoff date
3. Review what will be deleted
4. Confirm deletion

Consider exporting logs before deletion for compliance purposes.

---

## Rate Limiting

Admin operations are rate-limited to prevent abuse:

```bash
# User mutations (ban/unban/delete/edit): 10 per minute
RATE_LIMIT_ADMIN_USER_MUTATIONS=10
RATE_LIMIT_ADMIN_USER_MUTATIONS_WINDOW=60

# Password resets: 5 per 5 minutes
RATE_LIMIT_ADMIN_PASSWORD_RESET=5
RATE_LIMIT_ADMIN_PASSWORD_RESET_WINDOW=300

# Bulk operations: 3 per 5 minutes
RATE_LIMIT_ADMIN_BULK_OPERATIONS=3
RATE_LIMIT_ADMIN_BULK_OPERATIONS_WINDOW=300

# Calendar mutations: 10 per minute
RATE_LIMIT_ADMIN_CALENDAR_MUTATIONS=10
RATE_LIMIT_ADMIN_CALENDAR_MUTATIONS_WINDOW=60
```

---

## Security Considerations

1. **Audit everything**: All admin actions are logged with IP and user agent
2. **Principle of least privilege**: Only grant admin roles when necessary
3. **Regular review**: Periodically review admin users and audit logs
4. **Protect superadmin**: The superadmin account should use a strong, unique password
5. **Session security**: Admin sessions follow the same security as regular sessions
