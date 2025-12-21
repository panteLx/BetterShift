<div align="center">
  <img src="public/android/android-launchericon-512-512.png" alt="BetterShift Logo" width="300" height="300" />
</div>

<h1 align="center" id="title">BetterShift</h1>
<div align="center">

![BetterShift](https://img.shields.io/badge/BetterShift-Shift%20Management-blue?style=for-the-badge)
![Version](https://img.shields.io/github/v/release/pantelx/bettershift?style=for-the-badge&label=Version)
![Checks](https://img.shields.io/github/check-runs/pantelx/bettershift/main?style=for-the-badge&label=Checks)

[![Discord](https://img.shields.io/badge/Discord-Join%20our%20Community-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/Ma4SnagqwE)
[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy%20Me%20A%20Coffee-orange?style=for-the-badge)](https://buymeacoffee.com/pantel)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/pantelx)

</div>

> **Note**
>
> BetterShift is a modern shift management application designed to simplify variable work schedules. Manage unlimited calendars with one-click shift toggles, reusable presets, and real-time synchronization across devices. Features include external calendar integration (Google, Outlook, iCal), password-protected calendars, ICS/PDF export, live statistics, calendar comparison and multi-language support. Built with Next.js 16 and SQLite for fast, self-hosted deployment.

## 🔗 Quick Links

**Demo:** [bettershift.pantelx.com](https://bettershift.pantelx.com)

**Discord Server:** [Join our Discord for community discussions and support](https://discord.gg/Ma4SnagqwE)

**Self-Hosting:** [Check out the Deployment Guide](#%EF%B8%8F-deployment-guide)

**Support the Project:** [Buy Me A Coffee](https://www.buymeacoffee.com/pantel) or [Become a GitHub Sponsor](https://github.com/sponsors/pantelx)

---

## ✨ Key Features

### 📅 Calendar & Shift Management

- **Multiple Calendars** — Unlimited calendars with custom names and colors
- **Interactive Month View** — Clean, week-based calendar layout with one-click shift toggles
- **Quick Actions** — Left-click to add/remove shifts, right-click to add notes or events
- **External Calendar Sync** — Subscribe to Google, Outlook or iCal calendars with auto/manual refresh
- **Sync Monitoring** — Real-time sync status and error notifications
- **Calendar Comparison** — Overlay multiple calendars for easy shift comparison

### 🎨 Customization & Organization

- **Shift Presets** — Reusable templates with custom labels, times, and colors
- **Visual Organization** — Color-code calendars and shifts for instant recognition
- **Auto-Save Templates** — Automatically save shift configurations for future use
- **Export Options** — Download as ICS or PDF with flexible time range filters

### 🔒 Security & Privacy

- **Password Protection** — SHA-256 encrypted calendar passwords
- **Per-Calendar Access** — Different security levels for each calendar

### 📊 Analytics & Live Updates

- **Real-Time Statistics** — Instant shift tracking and hour calculations with visual charts
- **Server-Sent Events** — Changes sync instantly across all open browser tabs

### 🌍 Multi-Language & Themes

- **Built-in Translations** — Full German, English, and Italian support
- **Dark/Light Theme** — Toggle themes with system preference detection
- **Responsive Design** — Optimized for desktop and mobile devices

### 🔔 Modern Stack & Updates

- **Auto Update Checks** — Detects new releases with visual notifications
- **Integrated Changelog** — View release notes directly in the app
- **PWA Support** — Installable as a Progressive Web App
- **Next.js 16 + React 19** — Latest App Router architecture
- **SQLite + Drizzle ORM** — Type-safe database with file-based storage
- **Docker Ready** — Two-command deployment with Docker Compose

---

## 🛠️ Deployment Guide

### 🐳 Docker Deployment

Deploy using Docker for easy containerized hosting:

**Option 1: Using pre-built images from GitHub Container Registry**

Available image tags:

- `:latest` - Latest stable release (recommended for production)
- `:v1.0.0` - Specific version (use for pinned deployments)
- `:dev` - Latest development build from main branch (bleeding edge, may be unstable)
- `:pr-123` - Pull request builds (for testing PRs before merge)

```bash
# Pull the latest stable release (recommended)
$ docker pull ghcr.io/pantelx/bettershift:latest

# Or pull the latest development build
$ docker pull ghcr.io/pantelx/bettershift:dev

# Or pull a specific version
$ docker pull ghcr.io/pantelx/bettershift:v1.0.0

# Run the container
$ docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  --name bettershift \
  ghcr.io/pantelx/bettershift:latest

# Apply database migrations
$ docker exec bettershift npm run db:migrate
```

**Option 2: Build locally with docker-compose**

```bash
# Clone the repository
$ git clone https://github.com/pantelx/bettershift.git && cd bettershift

# Copy the example environment file
$ cp .env.example .env

# Adjust .env settings as needed

# Build and start the container
$ docker-compose up -d --build

# Apply database migrations
$ docker compose exec bettershift npm run db:migrate

# Access the application at http://localhost:3000 (or your configured port)
```

### 🏗️ Production Build

```bash
# Build the application
$ npm run build

# Start production server
$ npm start
```

### 💻 Local Development

```bash
# Clone the repository
$ git clone https://github.com/pantelx/bettershift.git && cd bettershift

# Install dependencies
$ npm install

# Copy the example environment file
$ cp .env.example .env

# Adjust .env settings as needed

# Set up the database
$ npm run db:migrate

# Start the development server
$ npm run dev

# Open your browser at http://localhost:3000
```

---

## 📦 Versioning & Releases

### Available Docker Tags

**Stable Releases**:

- `ghcr.io/pantelx/bettershift:latest` - Always points to the latest stable release
- `ghcr.io/pantelx/bettershift:v1.0.1` - Specific version (immutable)
- `ghcr.io/pantelx/bettershift:v1.0` - Latest patch of minor version
- `ghcr.io/pantelx/bettershift:v1` - Latest minor of major version

**Development Builds**:

- `ghcr.io/pantelx/bettershift:dev` - Latest development build from main branch (unstable)

---

## 🗄️ Database Management

### Available Commands

```bash
# Generate new migrations after schema changes
$ npm run db:generate

# Apply migrations to the database
$ npm run db:migrate

# Open Drizzle Studio (database GUI)
$ npm run db:studio
```

> **Note**
>
> Never run `npm run db:push` in production. Always use migrations (`db:generate` + `db:migrate`) for safe schema changes.

---

## 🧪 Testing & Quality Assurance

### Local Testing

Run these commands before submitting a pull request:

```bash
# Run all tests (lint + build with TypeScript check)
$ npm test

# Full CI test suite (includes database migration test)
$ npm run test:ci

# Run individual checks
$ npm run lint         # ESLint code quality check
$ npm run build        # Next.js production build (includes TypeScript validation)

```

**Recommended Pre-Commit Workflow:**

1. Run `npm test` to catch issues early
2. Fix any TypeScript or linting errors
3. Ensure build completes successfully
4. Commit and push your changes

---

## 💖 Support the Project

Your support helps maintain and improve this project! Please consider:

- [Buy me a coffee](https://www.buymeacoffee.com/pantel)
- [Become a GitHub Sponsor](https://github.com/sponsors/pantelx)
- Join our Discord community for support and updates
- Contribute on GitHub

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🙏 Credits

Special thanks to:

- All contributors who have contributed through code, testing, and ideas
- The community for their feedback, support, and patience
- Project supporters who have financially supported this initiative

---

## 📄 License

MIT
