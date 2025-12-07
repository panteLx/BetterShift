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
> BetterShift is a modern shift management application built with Next.js 16 and SQLite. It helps you organize and manage work shifts across multiple calendars with customizable presets, color coding, password protection and external calendar synchronization. Perfect for anyone managing variable work schedules.

## 🔗 Quick Links

**Demo:** [bettershift.pantelx.com](https://bettershift.pantelx.com)

**Discord Server:** [Join our Discord for community discussions and support](https://discord.gg/Ma4SnagqwE)

**Self-Hosting:** [Check out the Deployment Guide](#%EF%B8%8F-deployment-guide)

**Support the Project:** [Buy Me A Coffee](https://www.buymeacoffee.com/pantel) or [Become a GitHub Sponsor](https://github.com/sponsors/pantelx)

---

## ✨ Key Features

### 📅 Smart Shift Calendar Management

- **Multiple Calendars** — Create unlimited shift calendars with custom names and colors for different jobs, people or schedules
- **Interactive Month View** — Navigate shifts effortlessly with a clean, week-based calendar layout
- **One-Click Shift Toggle** — Left-click any day to instantly add or remove shifts using your active preset
- **Daily Notes** — Right-click any day to attach context notes (e.g., "Early shift for doctor appointment")
- **External Calendar Sync** — Subscribe to external calendars (Google, Outlook, iCal) with automatic or manual refresh
- **Sync Notification Center** — Monitor external calendar sync status, errors, and updates in real-time

### 🎨 Flexible Customization

- **Shift Presets** — Build reusable templates with custom labels, times, and color-coded categories
- **Visual Organization** — Color-code calendars and shifts for instant visual recognition
- **Quick Preset Switching** — Change active presets on the fly to adapt to different shift patterns
- **Auto-Save Templates** — Automatically save new shift configurations as presets for future use

### 🔒 Privacy & Security

- **Password Protection** — Lock individual calendars with SHA-256 encrypted passwords
- **Secure Local Storage** — All data stays on your server; passwords are hashed and never stored in plaintext
- **Per-Calendar Access Control** — Different calendars can have different security levels

### 🌍 International by Design

- **Multi-Language Support** — Full German and English translations built-in
- **Smart Language Detection** — Automatically uses your browser's language preference
- **Persistent Settings** — Language choice saved in cookies across sessions
- **Easy Switching** — Toggle languages anytime from the footer

### 📊 Insightful Analytics

- **Flexible Time Periods** — View statistics for current month, last 30 days, or custom date ranges
- **Real-Time Stats** — Shift totals and hour calculations update instantly when you make changes
- **Work Pattern Analysis** — Understand your schedule with aggregated shift data

### ⚡ Live Updates & Sync

- **Server-Sent Events (SSE)** — Changes appear instantly across all open browser tabs
- **Connection Monitoring** — Visual indicators show real-time sync status
- **Offline Resilience** — Graceful handling when connection drops, auto-reconnect on restore
- **Background Refresh** — Data updates silently without disrupting your workflow

### 🛠️ Modern Foundation

- **Next.js 16 + React 19** — Built on the latest App Router architecture for peak performance
- **SQLite + Drizzle ORM** — Lightweight file-based database with full TypeScript type safety
- **Tailwind CSS 4** — Modern, responsive design with shadcn/ui component library
- **Docker Ready** — One-command deployment with Docker Compose for easy self-hosting

---

## 🛠️ Deployment Guide

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

---

## 📦 Versioning & Releases

BetterShift uses [Semantic Versioning](https://semver.org/) (semver) for version management. Releases are automatically created on GitHub when version tags are pushed.

### Available Docker Tags

**Stable Releases**:

- `ghcr.io/pantelx/bettershift:latest` - Always points to the latest stable release
- `ghcr.io/pantelx/bettershift:v1.0.1` - Specific version (immutable)
- `ghcr.io/pantelx/bettershift:v1.0` - Latest patch of minor version
- `ghcr.io/pantelx/bettershift:v1` - Latest minor of major version

**Development Builds**:

- `ghcr.io/pantelx/bettershift:dev` - Latest development build from main branch (unstable)

**Pull Request Builds**:

- `ghcr.io/pantelx/bettershift:pr-123` - Build for pull request #123 (testing only)

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
