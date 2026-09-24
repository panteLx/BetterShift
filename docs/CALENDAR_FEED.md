# Calendar Feed Guide

This guide explains the subscribable ICS feed link for a calendar — what it is, how to add it to Google Calendar, Apple Calendar, Outlook, or Home Assistant, and its limits.

## Table of Contents

1. [What the Link Is](#what-the-link-is)
2. [Creating, Rotating, and Revoking](#creating-rotating-and-revoking)
3. [Google Calendar](#google-calendar)
4. [Apple Calendar](#apple-calendar)
5. [Outlook](#outlook)
6. [Home Assistant](#home-assistant)
7. [Refresh Behavior](#refresh-behavior)
8. [Rate Limiting](#rate-limiting)
9. [Times and Locale](#times-and-locale)

---

## What the Link Is

Every calendar can have one feed link per user: a secret URL of the form `https://<your-instance>/api/feed/<token>.ics` (the `.ics` suffix is optional — clients that require it, and clients that don't, both work). Anyone who has the URL can fetch the calendar's shifts as an ICS calendar, read-only; calendar notes are not included.

The link is not a separate grant of access — it follows whatever access you currently have to the calendar. Every fetch re-checks it: if your share is removed, your account is deleted or banned, or (for a link created while `AUTH_ENABLED=false`) the instance later turns auth on, the feed returns `404` from the next fetch on, with no separate step to revoke it. Links created with auth off therefore stop working once auth is on; each user recreates theirs after signing in. Guests without an account cannot create a feed link.

## Creating, Rotating, and Revoking

Feed links live in the calendar settings under **Import & Export**, in the **Export** tab, as the "Subscription Link" option alongside the ICS and PDF export formats. From there:

- **Create Link** generates the link for you, for this calendar, if you don't already have one.
- **Regenerate** (rotate) replaces it with a new token; the old URL stops working immediately, so any app already subscribed needs the new link re-entered.
- **Revoke** deletes it outright.

There is exactly one link per user and calendar — creating again after a revoke issues a fresh token, it does not reuse the old one.

## Google Calendar

Google Calendar only supports adding a feed by URL from the desktop web app, not the mobile app:

1. In the left sidebar, next to **Other calendars**, click **+** → **From URL**.
2. Paste the feed URL and click **Add calendar**.

Google Calendar ignores the feed's refresh hint and re-polls on its own internal schedule (see [Refresh Behavior](#refresh-behavior)).

## Apple Calendar

1. **File → New Calendar Subscription…**
2. Paste the feed URL and click **Subscribe**.
3. In the subscription's settings, set **Auto-refresh** to how often you want it checked (Apple defaults to every few hours).

## Outlook

1. **Add calendar → Subscribe from web**.
2. Paste the feed URL and confirm.

## Home Assistant

1. **Settings → Devices & services → Add integration**.
2. Search for **Remote Calendar** and paste the feed URL.

## Refresh Behavior

The feed publishes `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` as `PT1H` (one hour) to hint how often it should be re-fetched. Most clients honor this loosely; Google Calendar ignores it entirely and refreshes on its own schedule, typically somewhere between several hours and a day. None of this is something BetterShift or the calendar owner can force — a client that has already cached the feed will keep serving stale data until it decides to poll again.

## Rate Limiting

Feed requests are rate limited per feed owner (not per calendar or per client), via:

- `RATE_LIMIT_CALENDAR_FEED_REQUESTS` (default `60`)
- `RATE_LIMIT_CALENDAR_FEED_WINDOW`, in seconds (default `600`)

An app that polls one feed on a normal schedule stays well under the default; the limit exists mainly to bound abuse of a leaked link.

## Times and Locale

Event times in the feed are written in UTC, computed from the server's `TZ` environment variable — the same conversion the regular ICS export uses. Custom field labels in event descriptions are rendered in the instance's `DEFAULT_LOCALE`, not the subscriber's own locale, since the feed has no per-request user to localize for.
