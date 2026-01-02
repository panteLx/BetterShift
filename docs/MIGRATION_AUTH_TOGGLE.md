# Enabling Authentication on an Existing Instance

This guide explains how to enable authentication on a BetterShift instance that was previously running without it.

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Migration Steps](#migration-steps)
3. [Handling Orphaned Calendars](#handling-orphaned-calendars)
4. [FAQ](#faq)

---

## Before You Start

### Prerequisites

- BetterShift instance running with `AUTH_ENABLED=false`
- Existing calendars created without authentication
- Database backup (recommended)

### What Happens to Existing Data

When you enable authentication:

| Data Type      | Behavior                                                  |
| -------------- | --------------------------------------------------------- |
| Calendars      | Become "orphaned" (no owner) - invisible to regular users |
| Shifts         | Preserved with their calendars                            |
| Presets        | Preserved with their calendars                            |
| Notes          | Preserved with their calendars                            |
| External Syncs | Preserved with their calendars                            |

Existing data is **not deleted** - it becomes orphaned and must be assigned to users through the admin panel.

---

## Migration Steps

### Step 1: Backup Your Database

Before making any changes, create a backup:

```bash
# SQLite database location (default)
cp ./data/sqlite.db ./data/sqlite.db.backup

# Or if using Docker
docker cp bettershift:/app/data/sqlite.db ./sqlite.db.backup
```

### Step 2: Generate Auth Secret

Generate a secure secret for Better Auth:

```bash
npx @better-auth/cli secret
```

Copy the output - you'll need it in the next step.

### Step 3: Configure Environment Variables

Update your `.env` file:

```bash
# Enable authentication
AUTH_ENABLED=true

# Set the generated secret
BETTER_AUTH_SECRET=your-generated-secret-here

# Set your application URL
BETTER_AUTH_URL=https://your-domain.com

# Optional: Configure registration and guest access
ALLOW_USER_REGISTRATION=true
ALLOW_GUEST_ACCESS=false
```

### Step 4: Restart the Application

```bash
# Docker Compose
docker-compose restart

# Or if running directly
npm run build && npm start
```

### Step 5: Create the First User (Superadmin)

1. Navigate to your BetterShift URL
2. Click "Register" (or use OAuth if configured)
3. Create your account

The first registered user automatically becomes **superadmin** with full administrative access.

### Step 6: Assign Orphaned Calendars

After logging in as superadmin:

1. Go to `/admin/calendars`
2. Orphaned calendars appear at the top with a red "Orphaned" badge
3. For each orphaned calendar:
   - Click the action menu
   - Select "Transfer Ownership"
   - Search for and select the appropriate user
   - Confirm the transfer

---

## Handling Orphaned Calendars

### What Are Orphaned Calendars?

Orphaned calendars have no owner (`ownerId = null`). This occurs when:

- Calendars existed before auth was enabled
- The owner was deleted
- Database inconsistencies

### Visibility

Orphaned calendars are **invisible** to all regular users, even superadmins using the normal calendar view. They can only be managed through the admin panel at `/admin/calendars`.

### Resolution Options

| Option            | When to Use                                  |
| ----------------- | -------------------------------------------- |
| **Transfer**      | Assign to the appropriate user               |
| **Delete**        | Remove if no longer needed (superadmin only) |
| **Bulk Transfer** | Move multiple calendars to one user          |

### Bulk Transfer Workflow

For instances with many orphaned calendars:

1. Go to `/admin/calendars`
2. Filter by "Orphaned Only"
3. Select multiple calendars using checkboxes
4. Click "Transfer Selected"
5. Choose the destination user
6. Confirm the bulk transfer

---

## FAQ

### What happens to existing calendars?

They become orphaned (no owner) but retain all data. Assign them to users via the admin panel.

### Can users still access their old calendars?

No, orphaned calendars are invisible until assigned. Users need to login, then an admin must transfer ownership to them.

### What if I want to disable auth again?

Set `AUTH_ENABLED=false` in your environment. Calendars with owners will still work, but ownership restrictions won't be enforced.

### Can I keep some calendars public?

Yes, after assigning an owner:

1. Open calendar settings
2. Set "Guest Permission" to "Read" or "Write"
3. Enable `ALLOW_GUEST_ACCESS=true` in environment

### How do I add more admins?

1. Login as superadmin
2. Go to `/admin/users`
3. Find the user
4. Click Edit
5. Change role to "Admin"
6. Save

### What if I lose access to the superadmin account?

If you have database access, you can manually update the user role:

```sql
UPDATE user SET role = 'superadmin' WHERE email = 'your-email@example.com';
```

Then restart the application.

### Is there a way to auto-assign calendars?

Not currently. Calendars must be manually assigned through the admin panel. For large migrations, consider a database script.

---

## Rollback Procedure

If you need to revert to no-auth mode:

1. Set `AUTH_ENABLED=false` in `.env`
2. Restart the application
3. All calendars become accessible again (ownership ignored when auth disabled)

Note: User accounts and calendar ownership data are preserved in the database for future re-enabling.
