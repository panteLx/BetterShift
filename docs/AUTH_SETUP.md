# Authentication Setup Guide

This guide covers how to configure the authentication system in BetterShift, including local credentials, OAuth providers, and custom OIDC integration.

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [Email and Password Authentication](#email-and-password-authentication)
4. [OAuth Providers](#oauth-providers)
5. [Custom OIDC Provider](#custom-oidc-provider)
6. [Session Management](#session-management)
7. [Rate Limiting](#rate-limiting)
8. [Troubleshooting](#troubleshooting)

---

## Overview

BetterShift uses [Better Auth](https://www.better-auth.com/) for authentication. The system supports:

- Email/password authentication
- OAuth providers (Google, GitHub, Discord)
- Custom OIDC providers (Keycloak, Authentik, Authelia, etc.)
- Session-based authentication with secure cookies
- Role-based access control (user, admin, superadmin)

Authentication is **enabled by default** for security. You can disable it by setting `AUTH_ENABLED=false` for single-user deployments.

---

## Basic Configuration

### Required Environment Variables

```bash
# Enable/disable authentication (default: true)
AUTH_ENABLED=true

# Required when auth is enabled - generate with: npx @better-auth/cli secret
BETTER_AUTH_SECRET=your-secret-here

# Your application URL (used for OAuth callbacks)
BETTER_AUTH_URL=http://localhost:3000
```

### Access Control

```bash
# Allow new user registration (default: true)
ALLOW_USER_REGISTRATION=true

# Allow viewing calendars without login (default: false)
ALLOW_GUEST_ACCESS=false
```

### First User Setup

The first user to register becomes the **superadmin** with full system access. This happens automatically - no manual configuration required.

---

## Email and Password Authentication

Email/password authentication is enabled by default when auth is active. Users can:

- Register with email and password
- Login with credentials
- Change password from profile settings
- Reset password (admin can reset via admin panel)

### Password Requirements

Passwords are hashed using BCrypt. There are no specific complexity requirements enforced by default, but you can implement custom validation in your deployment.

---

## OAuth Providers

BetterShift supports three built-in OAuth providers. Configure any combination based on your needs.

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Create an **OAuth 2.0 Client ID** (Web application)
5. Add authorized redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`
6. Configure environment variables:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set Authorization callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`
4. Configure environment variables:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to **OAuth2 > General**
4. Add redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/discord`
5. Configure environment variables:

```bash
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
```

---

## Custom OIDC Provider

For enterprise SSO or self-hosted identity providers, BetterShift supports generic OIDC configuration.

### Supported Providers

Any OIDC-compliant provider works, including:

- Keycloak
- Authentik
- Authelia
- Okta
- Azure AD
- Auth0

### Configuration

```bash
# Enable custom OIDC
CUSTOM_OIDC_ENABLED=true

# Display name shown on login button
CUSTOM_OIDC_NAME=Company SSO

# OAuth credentials
CUSTOM_OIDC_CLIENT_ID=bettershift
CUSTOM_OIDC_CLIENT_SECRET=your-client-secret

# OIDC Discovery URL (must include /.well-known/openid-configuration)
CUSTOM_OIDC_ISSUER=https://sso.example.com/.well-known/openid-configuration

# Scopes to request (space-separated)
CUSTOM_OIDC_SCOPES=openid profile email
```

### Callback URL

Configure your OIDC provider with this callback URL:

```
{BETTER_AUTH_URL}/api/auth/oauth2/callback/custom-oidc
```

### Keycloak Example

1. Create a new client in your Keycloak realm
2. Set **Client Protocol** to `openid-connect`
3. Set **Access Type** to `confidential`
4. Add Valid Redirect URI: `https://bettershift.example.com/api/auth/oauth2/callback/custom-oidc`
5. Copy Client ID and Client Secret
6. Configure BetterShift:

```bash
CUSTOM_OIDC_ENABLED=true
CUSTOM_OIDC_NAME=Keycloak
CUSTOM_OIDC_CLIENT_ID=bettershift
CUSTOM_OIDC_CLIENT_SECRET=your-keycloak-secret
CUSTOM_OIDC_ISSUER=https://keycloak.example.com/realms/myrealm/.well-known/openid-configuration
```

### Authentik Example

1. Create a new OAuth2/OpenID Provider in Authentik
2. Create an Application linked to the provider
3. Set Redirect URI: `https://bettershift.example.com/api/auth/oauth2/callback/custom-oidc`
4. Configure BetterShift:

```bash
CUSTOM_OIDC_ENABLED=true
CUSTOM_OIDC_NAME=Authentik
CUSTOM_OIDC_CLIENT_ID=your-authentik-client-id
CUSTOM_OIDC_CLIENT_SECRET=your-authentik-secret
CUSTOM_OIDC_ISSUER=https://authentik.example.com/application/o/bettershift/.well-known/openid-configuration
```

---

## Session Management

### Session Configuration

```bash
# Session lifetime in seconds (default: 7 days)
SESSION_MAX_AGE=604800

# Session refresh interval in seconds (default: 1 day)
SESSION_UPDATE_AGE=86400
```

### User Session Control

Users can manage their sessions from the profile page:

- View all active sessions (device, browser, IP, last activity)
- Revoke all other sessions (keeps current session active)

### Admin Session Control

Admins can revoke user sessions through the admin panel when banning users.

---

## Rate Limiting

BetterShift includes built-in rate limiting to prevent abuse. All limits are configurable via environment variables.

### Authentication Limits

```bash
# Login attempts: 5 per minute per IP
RATE_LIMIT_AUTH_REQUESTS=5
RATE_LIMIT_AUTH_WINDOW=60

# Registration: 3 per 10 minutes per IP
RATE_LIMIT_REGISTER_REQUESTS=3
RATE_LIMIT_REGISTER_WINDOW=600

# Password change: 3 per hour per user
RATE_LIMIT_PASSWORD_CHANGE_REQUESTS=3
RATE_LIMIT_PASSWORD_CHANGE_WINDOW=3600
```

### Response Headers

Rate-limited endpoints return these headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Troubleshooting

### OAuth Callback Errors

**Problem**: OAuth login fails with "invalid_redirect_uri"

**Solution**: Ensure the callback URL in your provider matches exactly:

- Google: `{BETTER_AUTH_URL}/api/auth/callback/google`
- GitHub: `{BETTER_AUTH_URL}/api/auth/callback/github`
- Discord: `{BETTER_AUTH_URL}/api/auth/callback/discord`
- Custom OIDC: `{BETTER_AUTH_URL}/api/auth/oauth2/callback/custom-oidc`

### OIDC Discovery Fails

**Problem**: Custom OIDC login shows "discovery failed"

**Solution**: Verify the issuer URL ends with `/.well-known/openid-configuration` and is accessible from your server.

### Session Not Persisting

**Problem**: Users are logged out unexpectedly

**Solution**:

1. Check `BETTER_AUTH_SECRET` is set and consistent across restarts
2. Verify cookies are not blocked by browser or proxy
3. Check `BETTER_AUTH_TRUSTED_ORIGINS` includes your domain

### Registration Disabled for OIDC Users

**Problem**: New OIDC users cannot login when `ALLOW_USER_REGISTRATION=false`

**Solution**: This is expected behavior. When registration is disabled, only existing users can login via OIDC. Create user accounts first via the admin panel, then users can link their OIDC accounts.

---

## Security Recommendations

1. **Use HTTPS in production** - Set `BETTER_AUTH_URL` to your HTTPS URL
2. **Set trusted origins** - Configure `BETTER_AUTH_TRUSTED_ORIGINS` for CORS protection
3. **Rotate secrets periodically** - Change `BETTER_AUTH_SECRET` and regenerate sessions
4. **Monitor failed logins** - Check audit logs for suspicious activity
5. **Use strong passwords** - Educate users about password security
6. **Enable MFA** (future feature) - When available, enable for admin accounts
