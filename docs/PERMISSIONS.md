# Permissions and Sharing Guide

This guide explains how calendar permissions work in BetterShift, including sharing calendars with other users and managing access levels.

## Table of Contents

1. [Permission Hierarchy](#permission-hierarchy)
2. [Calendar Ownership](#calendar-ownership)
3. [Sharing Calendars](#sharing-calendars)
4. [Access Tokens (Share Links)](#access-tokens-share-links)
5. [Guest Access](#guest-access)
6. [Calendar Discovery](#calendar-discovery)

---

## Permission Hierarchy

BetterShift uses a four-level permission hierarchy for calendars:

| Level     | Can View | Can Edit | Can Share | Can Delete |
| --------- | -------- | -------- | --------- | ---------- |
| **owner** | Yes      | Yes      | Yes       | Yes        |
| **admin** | Yes      | Yes      | Yes       | No         |
| **write** | Yes      | Yes      | No        | No         |
| **read**  | Yes      | No       | No        | No         |

### Permission Details

- **owner**: Full control over the calendar, including deletion
- **admin**: Can manage calendar settings and share with others, but cannot delete
- **write**: Can create, edit, and delete shifts, notes, and presets
- **read**: View-only access to all calendar data

---

## Calendar Ownership

### How Ownership Works

- The user who creates a calendar is automatically the **owner**
- There is exactly one owner per calendar
- Ownership can be transferred via the admin panel (admin or superadmin required)

### Owner Capabilities

- Full control over calendar settings
- Grant/revoke access to other users
- Set guest permission level
- Create/manage access tokens
- Delete the calendar permanently

---

## Sharing Calendars

### Share with Specific Users

Owners and admins can share calendars with other registered users:

1. Open the calendar settings
2. Go to "Sharing" section
3. Search for users by name or email
4. Select permission level (admin, write, or read)
5. Click "Share"

### Managing Shares

From calendar settings, you can:

- View all users with access
- Change permission levels
- Remove access for specific users

### Share Permissions

| Sharer's Role | Can Share With | Max Permission |
| ------------- | -------------- | -------------- |
| owner         | Anyone         | admin          |
| admin         | Anyone         | admin          |
| write         | Cannot share   | -              |
| read          | Cannot share   | -              |

---

## Access Tokens (Share Links)

Access tokens provide a way to share calendars via a URL, without requiring the recipient to have an account.

### Creating Access Tokens

1. Open calendar settings
2. Navigate to "Access Tokens" section
3. Click "Create Token"
4. Configure:
   - **Name**: Description for your reference
   - **Permission**: read or write
   - **Expiration**: Optional expiry date
5. Copy the generated link

### Token Properties

| Property    | Description                                       |
| ----------- | ------------------------------------------------- |
| Name        | Identifier for the token (e.g., "Team View Link") |
| Permission  | `read` or `write` access level                    |
| Expiration  | Optional date when token becomes invalid          |
| Active      | Can be disabled without deletion                  |
| Usage Count | Number of times the token was used                |
| Last Used   | Timestamp of most recent access                   |

### Managing Tokens

- **Deactivate**: Temporarily disable without deleting
- **Reactivate**: Re-enable a deactivated token
- **Delete**: Permanently remove the token

### Security Considerations

- Tokens are stored in cookies after first validation
- Users with tokens can access the calendar without logging in
- Treat share links like passwords - anyone with the link has access
- Set expiration dates for temporary access
- Monitor usage in token management

### Token vs. User Sharing

| Aspect                   | Access Token            | User Sharing       |
| ------------------------ | ----------------------- | ------------------ |
| Requires account         | No                      | Yes                |
| Trackable per-user       | No                      | Yes                |
| Revocable per-person     | No (revoke token)       | Yes                |
| Can set admin permission | No                      | Yes                |
| Best for                 | Public/temporary access | Team collaboration |

---

## Guest Access

Guest access allows unauthenticated users to view or edit calendars without any token or account.

### Configuration

1. Enable globally: Set `ALLOW_GUEST_ACCESS=true` in environment
2. Enable per-calendar: Set "Guest Permission" in calendar settings

### Guest Permission Levels

| Setting   | Description                            |
| --------- | -------------------------------------- |
| **none**  | No guest access (default)              |
| **read**  | Guests can view calendar data          |
| **write** | Guests can view and edit calendar data |

### Guest vs. Token Access

| Aspect    | Guest Access            | Token Access            |
| --------- | ----------------------- | ----------------------- |
| URL       | Standard calendar URL   | Special token URL       |
| Scope     | Per-calendar setting    | Per-token setting       |
| Tracking  | No tracking             | Usage count, last used  |
| Revocable | Change calendar setting | Delete/disable token    |
| Security  | Public to everyone      | Limited to link holders |

---

## Calendar Discovery

When guest access is enabled and calendars are set to allow guests, authenticated users can discover and subscribe to public calendars.

### Finding Public Calendars

1. Click your profile menu
2. Select "Browse Calendars"
3. View available public calendars
4. Click "Subscribe" to add to your calendar list

### Managing Subscriptions

- **Subscribed calendars** appear in your calendar selector
- **Dismiss**: Hide a calendar from your view (can be re-subscribed)
- **Owned calendars** cannot be dismissed

### Subscription vs. Sharing

| Aspect            | Subscription                | Sharing                   |
| ----------------- | --------------------------- | ------------------------- |
| Permission source | Calendar's guest permission | Explicit share permission |
| Initiated by      | User subscribing            | Owner/admin sharing       |
| Can be dismissed  | Yes                         | Yes                       |
| Permission level  | As set on calendar          | As granted when sharing   |

---

## Permission Resolution

When a user accesses a calendar, BetterShift resolves permissions in this order:

1. **Owner check**: Is user the calendar owner? → `owner`
2. **Share check**: Is user explicitly shared? → Use share permission
3. **Subscription check**: Is user subscribed to public calendar? → Use guest permission
4. **Token check**: Valid access token in cookie? → Use token permission
5. **Guest check**: Guest access enabled + calendar allows guests? → Use guest permission
6. **No access**: None of the above → Access denied

The first matching rule determines the permission level.

---

## Best Practices

1. **Use appropriate permission levels**: Grant minimum required access
2. **Prefer user sharing over tokens**: Better tracking and individual revocation
3. **Set token expiration**: Don't leave tokens valid indefinitely
4. **Review shares periodically**: Remove access that's no longer needed
5. **Use read permission by default**: Only grant write when editing is required
6. **Consider guest access carefully**: Public calendars are visible to everyone
