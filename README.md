<div align="center">
<img width="150" height="150" alt="logo" src="https://github.com/user-attachments/assets/47c81850-366e-413a-b209-cb2a0d0e534a" />
  
# BetterShift

**Your favorite shift management application!**

_BetterShift is a self-hosted shift management application for teams and individuals with variable work schedules. Create unlimited calendars, toggle shifts with a single click, and share them with your team via user accounts, links, or public access. Sync external calendars from Google, Outlook, or iCal, export to ICS/PDF, and manage everything through an admin panel with role-based permissions and audit logging._

![Version](https://img.shields.io/github/v/release/pantelx/bettershift?style=flat-square&label=version)
![Build](https://img.shields.io/github/check-runs/pantelx/bettershift/main?style=flat-square&label=build)
![License](https://img.shields.io/github/license/pantelx/bettershift?style=flat-square)

[Demo](https://bettershift.pantelx.com) · [Documentation](#documentation) · [Quick Start](#quick-start) · [Discord](https://discord.gg/Ma4SnagqwE)

<details>
<summary>Show Screenshots</summary>
<img width="1920" height="1080" alt="calendar_page" src="https://github.com/user-attachments/assets/9b8b01b5-0a5d-4359-8024-5764866cf92a" />
<img width="1920" height="1080" alt="admin_panel" src="https://github.com/user-attachments/assets/976e1c4d-6c7c-4462-abe7-8d81edb33666" />
</details>

## Features

| Feature            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| **Calendars**      | Unlimited calendars with custom colors and names                |
| **Presets**        | Reusable shift templates with labels, times, and colors         |
| **External Sync**  | Subscribe to Google Calendar, Outlook, or iCal feeds            |
| **Sharing**        | Share via user accounts, guest access, or shareable links       |
| **Authentication** | Email/password, OAuth (Google, GitHub, Discord), or custom OIDC |
| **Admin Panel**    | User management, calendar administration, audit logging         |
| **Statistics**     | Real-time shift tracking with visual charts                     |
| **Export**         | Download calendars as ICS or PDF                                |
| **Localization**   | English, German, Italian, Spanish                                        |
| **PWA**            | Installable on mobile and desktop                               |

## Quick Start

</div>

### Docker

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  --name bettershift \
  ghcr.io/pantelx/bettershift:latest
```

Open http://localhost:3000. The first registered user becomes superadmin.

### Docker Compose

```bash
git clone https://github.com/pantelx/bettershift.git
cd bettershift
cp .env.example .env
# Edit .env and set BETTER_AUTH_SECRET
docker-compose up -d
```

### From Source

```bash
git clone https://github.com/pantelx/bettershift.git
cd bettershift
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

<div align="center">

## Documentation

| Document                                         | Description                               |
| ------------------------------------------------ | ----------------------------------------- |
| [Authentication Setup](docs/AUTH_SETUP.md)       | Email/password, OAuth, OIDC configuration |
| [Admin Panel](docs/ADMIN_PANEL.md)               | User management, calendar administration  |
| [Permissions](docs/PERMISSIONS.md)               | Sharing, access tokens, guest access      |
| [Migration Guide](docs/MIGRATION_AUTH_TOGGLE.md) | Enable auth on existing instances         |

## Configuration

</div>

### Required

```bash
AUTH_ENABLED=true
BETTER_AUTH_SECRET=          # npx @better-auth/cli secret
BETTER_AUTH_URL=http://localhost:3000
```

### Optional: OAuth Providers

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

### Optional: Custom OIDC

```bash
CUSTOM_OIDC_ENABLED=true
CUSTOM_OIDC_NAME=Company SSO
CUSTOM_OIDC_CLIENT_ID=
CUSTOM_OIDC_CLIENT_SECRET=
CUSTOM_OIDC_ISSUER=https://sso.example.com/.well-known/openid-configuration
```

See [.env.example](.env.example) for all options.

<div align="center">

## Database Commands

</div>

```bash
npm run db:migrate    # Apply migrations
npm run db:generate   # Generate migrations after schema changes
npm run db:studio     # Open Drizzle Studio GUI
```

<div align="center">

## Docker Images

Images are available at `ghcr.io/pantelx/bettershift`:

| Tag      | Description                  |
| -------- | ---------------------------- |
| `latest` | Latest stable release        |
| `vX.Y.Z` | Specific version             |
| `dev`    | Development build (unstable) |

## Tech Stack

| Layer     | Technology                        |
| --------- | --------------------------------- |
| Framework | Next.js 16, React 19, TypeScript  |
| Database  | SQLite, Drizzle ORM               |
| Auth      | Better Auth                       |
| UI        | Tailwind CSS, shadcn/ui, Radix UI |
| i18n      | next-intl                         |

## Contributing

Contributions are welcome. Please follow these steps:

Fork the repository -
Create a feature branch -
Run `npm test` before committing -
Submit a pull request

## Support

[Discord](https://discord.gg/Ma4SnagqwE) -
[GitHub Issues](https://github.com/pantelx/bettershift/issues) -
[Buy Me a Coffee](https://www.buymeacoffee.com/pantel) -
[GitHub Sponsors](https://github.com/sponsors/pantelx)

## License

MIT License. See [LICENSE](LICENSE) for details.

</div>
