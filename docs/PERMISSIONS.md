# Permissions and Sharing Guide

This guide explains how calendar permissions work in BetterShift, including sharing calendars with other users and managing access levels.

## Table of Contents

1. [Permission Bundles](#permission-bundles)
2. [Calendar Ownership](#calendar-ownership)
3. [Sharing Calendars](#sharing-calendars)
4. [Access Tokens (Share Links)](#access-tokens-share-links)
5. [Guest Access](#guest-access)
6. [Calendar Discovery](#calendar-discovery)
7. [Permission Resolution](#permission-resolution)
8. [Best Practices](#best-practices)

---

## Permission Bundles

BetterShift doesn't use a fixed access ladder. Instead, each calendar owner defines named **permission bundles** — groups of individual capabilities — and assigns a bundle to each person, to guest access, and to each share link. What "editing" or "viewing" means on a calendar is entirely up to the owner: a bundle can allow "only stamp existing presets", "create and edit shifts but never touch anyone else's", or any other combination.

### Starter bundles

Every calendar is created with four bundles: **Read**, **Contribute**, **Manage**, and **Admin**. Their names are shown translated into your interface language until one is renamed — after a rename, the custom name is used everywhere instead. From the "Groups" tab in a calendar's Permissions settings, an owner can rename, clone, edit the capabilities of, or delete any bundle. A bundle currently assigned to a person, a link, or guest access can't be deleted — the delete action lists what's still using it so you can reassign first.

Recommended defaults for a newly created calendar:

| Bundle | Grants |
| --- | --- |
| **Read** | View shifts, notes & events, and statistics; sign up for shifts with open slots |
| **Contribute** | Everything in Read, plus: create shifts, stamp presets, create presets, edit/delete shifts, presets, and notes/events you created yourself |
| **Manage** | Everything in Contribute, plus: edit/delete shifts, presets, and notes/events created by anyone, and sign up other people |
| **Admin** | Everything in Manage, plus: manage external calendar sync, delete sync log entries, manage shares, manage guest access & links, and manage calendar settings |

These are only a starting point. Every capability can be added to or removed from any bundle, including the four starter ones — there's nothing special about them once edited, aside from the translated name.

### Capability catalog

The bundle editor groups capabilities by area:

**Viewing**
- View shifts — see the calendar and its shifts
- View notes & events — see notes and events on the calendar
- View statistics — see the statistics/summary panel

**Shifts**
- Stamp presets — add a shift by picking an existing preset
- Create shifts — create new shifts freely, not limited to a preset
- Edit own shifts / Edit any shift — change shifts you created vs. any shift regardless of who created it
- Delete own shifts / Delete any shift — remove shifts you created vs. any shift

**Notes & events**
- Manage own notes & events / Manage any notes & events — create, edit, or delete notes and events you created vs. anyone's (creating a new one only needs one of the two)

**Signups**
- Sign up self — join or leave shifts that have open slots
- Sign up others — add or remove other people from a shift's signups; this also lets you see the calendar's members (owner + shares), since that list is how you pick who to add

**Presets**
- Create presets — add new presets
- Manage own presets / Manage any presets — edit or delete presets you created vs. anyone's; reordering the calendar's shared preset list specifically needs "manage any presets", since it changes the order for everyone regardless of who created which preset

**External sync**
- Manage external sync — set up, edit, and remove external calendar subscriptions
- Delete sync logs — remove entries from the sync log

**Administrative**
- Manage shares — decide who has access to the calendar, and edit any bundle's contents (see [Who can assign or edit bundles](#who-can-assign-or-edit-bundles))
- Manage guest access — control public access and share links, and edit any bundle's contents
- Manage calendar settings — change the calendar's name, color, and other calendar-wide settings

### Editing your own vs. anyone's entries

For shifts, presets, and notes/events, a bundle can separately grant editing/deleting entries you created and editing/deleting anyone's. This is what lets an owner allow contributors to manage their own work without touching other people's.

One rule to keep in mind: an entry with no known creator — imported legacy data, an entry whose creator account was later deleted, or one added by an anonymous guest — counts as "your own" for **anyone** holding the matching own-capability, not just for the calendar owner. If you rely on the own/any split to keep contributors from editing each other's entries, be aware that creator-less entries are fair game for everyone with the "own" capability.

### Capabilities that can never reach a guest or a link

Five capabilities can never be granted through guest access or a share link, no matter what an owner ticks into the bundle used there:

- Manage shares
- Manage guest access
- Manage calendar settings
- Manage external sync
- Delete sync logs

The bundle picker shown when assigning guest access or a link only offers bundles that don't contain any of these. If you try to add one of them to a bundle that's already assigned to guest access or a link, saving the change is rejected and you're told which assignment is blocking it. This lockout is enforced again on the server independently of what a bundle claims to contain, so it holds even for bundles edited or reassigned later — a guest or link can never end up with administrative or sync-management capabilities by any path.

### Read access is enforced everywhere

Viewing shifts, notes & events, statistics, and the member list is checked on every request that reads that data, not just used to decide what the interface shows. A bundle without "view statistics", for example, gets the statistics endpoint blocked outright — removing a button from the UI isn't what keeps the underlying data private. As a UX improvement, the client also hides the corresponding controls and summaries (the statistics panel and its button, replaced by a plain "all shifts in month" link when absent, and the preset-stamp bar) when these capabilities are missing, though the server-side enforcement above remains the actual security boundary.

### Who can assign or edit bundles

Assigning a bundle to a person needs **manage shares**. Assigning a bundle to guest access or to a link needs **manage guest access**. Editing what a bundle actually contains — its ticked capabilities, its name — needs either of those two capabilities as well: anyone who can assign a bundle can just as easily edit a bundle's contents directly, so this isn't a wider grant than manage shares/manage guest access already imply. Both are subject to the same cap: a non-owner can only create or assign a bundle whose capabilities are a subset of their own current access (see [Managing Shares](#managing-shares)).

### Signups

The "sign up self" and "sign up others" capabilities let people join/leave shifts (for themselves or for others) through a bundle — except an anonymous visitor with no account or session, who can never sign up for someone else's shift regardless of what a bundle says. Signups as a whole are additionally gated by a separate calendar-wide "Signups enabled" switch, next to the signup capabilities in the same Permissions settings, independent of any bundle.

---

## Calendar Ownership

### How Ownership Works

- The user who creates a calendar is automatically the **owner**
- There is exactly one owner per calendar
- Ownership can be transferred via the admin panel (admin or superadmin required)

### Owner Capabilities

- Full control over calendar settings
- Every capability, regardless of bundles — an owner is never gated by the bundle system
- Create, edit, and delete permission bundles
- Assign bundles to people, guest access, and links
- Create/manage access tokens
- Delete the calendar permanently

---

## Sharing Calendars

### Share with Specific Users

Anyone with the **manage shares** capability (owners always have it) can share a calendar with other registered users:

1. Open the calendar's Permissions settings
2. Go to the "Assignments" tab, "People" section
3. Search for a user by name or email
4. Pick a bundle from the bundle picker
5. Click "Invite"

### Managing Shares

From the same tab, you can:

- View everyone with access and which bundle they hold
- Change a person's bundle at any time
- Remove access for a specific person

Anyone with manage shares can assign any bundle to anyone they could already grant themselves. The calendar owner can assign any bundle, including Admin. A non-owner is capped to bundles whose capabilities are a subset of their own current access — someone who only holds a narrow custom bundle plus manage shares cannot hand out Admin, even to themselves.

---

## Access Tokens (Share Links)

Access tokens provide a way to share calendars via a URL. With Guest Access enabled globally (admin panel → System Settings) the recipient needs no account; otherwise they sign in first and the link's bundle applies afterwards.

### Creating Access Tokens

1. Open the calendar's Permissions settings
2. Go to the "Assignments" tab, "Links" section
3. Configure:
   - **Name**: Description for your reference
   - **Bundle**: Which guest-eligible permission bundle the link grants
   - **Expiration**: Optional expiry date
4. Click "Create link" and copy it; the token is shown only once

Only bundles that don't contain any of the guest-locked capabilities (see [Permission Bundles](#capabilities-that-can-never-reach-a-guest-or-a-link)) appear in the picker.

### Token Properties

| Property    | Description                                       |
| ----------- | ------------------------------------------------- |
| Name        | Identifier for the token (e.g., "Team View Link") |
| Bundle      | Which guest-eligible permission bundle the link grants |
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
- Users with tokens can access the calendar without logging in when Guest Access is enabled globally
- Treat share links like passwords - anyone with the link has access
- Set expiration dates for temporary access
- Monitor usage in token management

### Token vs. User Sharing

| Aspect                              | Access Token                | User Sharing        |
| ------------------------------------ | --------------------------- | ------------------- |
| Requires account                     | Only if guest access is off | Yes                 |
| Trackable per-user                   | No                           | Yes                 |
| Revocable per-person                 | No (revoke token)            | Yes                 |
| Can hold administrative capabilities | No, ever                     | Yes                 |
| Best for                             | Public/temporary access      | Team collaboration  |

---

## Guest Access

Guest access allows unauthenticated users to view or edit calendars without any token or account, using whichever permission bundle the calendar has assigned to it.

### Configuration

1. Enable globally: Turn on Guest Access in the admin panel under System Settings
2. Assign per-calendar: In the calendar's Permissions settings, "Assignments" tab, pick a bundle under "Public access" (or "No access" to disable it for this calendar)

The per-calendar bundle applies to visitors without an account only while Guest Access is enabled globally; otherwise they are sent to the login page. Signed-in users get it through [Calendar Discovery](#calendar-discovery), whatever the setting says. Access links work even when public access is set to "No access", but with Guest Access disabled a recipient without a session is sent to the login page first; the link's bundle applies once they sign in.

### Guest Access Bundles

The "Public access" picker in the Assignments tab only offers bundles that are guest-eligible (see [Capabilities that can never reach a guest or a link](#capabilities-that-can-never-reach-a-guest-or-a-link)) — the Admin bundle and any custom bundle holding one of the five locked capabilities are never offered here. Picking "No access" removes guest access entirely for this calendar.

### Guest vs. Token Access

| Aspect    | Guest Access            | Token Access             |
| --------- | ------------------------ | ------------------------- |
| URL       | Standard calendar URL    | Special token URL         |
| Scope     | Per-calendar setting     | Per-token setting          |
| Tracking  | No tracking              | Usage count, last used     |
| Revocable | Change calendar setting  | Delete/disable token       |
| Security  | Public to everyone       | Limited to link holders    |

---

## Calendar Discovery

Signed-in users can discover and subscribe to any calendar that has a guest access bundle assigned (i.e., public access is not set to "No access"). This does not depend on the global Guest Access setting, which only governs visitors without an account.

### Finding Public Calendars

1. Click your profile menu
2. Select "Shared Calendars"
3. View available public calendars
4. Click "Subscribe" to add to your calendar list

### Managing Subscriptions

- **Subscribed calendars** appear in your calendar selector
- **Dismiss**: Hide a calendar from your view (can be re-subscribed)
- **Owned calendars** cannot be dismissed

### Subscription vs. Sharing

| Aspect                | Subscription                  | Sharing                    |
| ---------------------- | ------------------------------ | --------------------------- |
| Bundle source           | Calendar's guest access bundle | Bundle chosen when sharing  |
| Initiated by            | User subscribing               | Owner/manage-shares holder  |
| Can be dismissed        | Yes                             | Yes                          |
| Effective capabilities  | As set by the guest access bundle | As granted when sharing  |

---

## Permission Resolution

When a user accesses a calendar, BetterShift resolves their capabilities in this order:

1. **Owner check**: Is the user the calendar owner? → full access, no bundle involved.
2. **Share check**: Is the user explicitly shared with? → that share's bundle.
3. **Token check**: Valid access token in the request's cookie? → that link's bundle.
4. **Guest bundle check**: Does the calendar have a guest access bundle assigned, and is `ALLOW_GUEST_ACCESS` enabled? An anonymous visitor gets that bundle directly. A signed-in user who is neither the owner nor explicitly shared only gets it if they're subscribed to the calendar (see [Calendar Discovery](#calendar-discovery)) — a public calendar someone dismissed grants them nothing until they re-subscribe.
5. **No access**: None of the above → access denied.

The first matching rule determines the bundle, and therefore the capabilities, that apply. Whatever the resolved bundle contains, a token or guest-bundle source additionally has the five guest-locked capabilities filtered out before anything is granted (see [Capabilities that can never reach a guest or a link](#capabilities-that-can-never-reach-a-guest-or-a-link)) — this happens regardless of what the bundle's saved contents claim.

---

## Best Practices

1. **Grant the minimum bundle needed**: Start from Read or Contribute rather than handing out Manage or Admin by default
2. **Prefer user sharing over tokens**: Better tracking and individual revocation
3. **Set token expiration**: Don't leave tokens valid indefinitely
4. **Review shares and bundle assignments periodically**: Remove access that's no longer needed
5. **Split own/any capabilities deliberately**: If you want contributors to only touch their own entries, don't also tick the matching "any" capability
6. **Consider public access carefully**: Public calendars are open to every signed-in user, and to everyone when Guest Access is enabled globally
