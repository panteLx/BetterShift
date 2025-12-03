<h1 align="center" id="title">BetterShift</h1>
<div align="center">

![BetterShift](https://img.shields.io/badge/BetterShift-Shift%20Management-blue?style=for-the-badge)
![Checks](https://img.shields.io/github/check-runs/pantelx/bettershift/main?style=for-the-badge&label=Checks)

[![Discord](https://img.shields.io/badge/Discord-Join%20our%20Community-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/Ma4SnagqwE)
[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy%20Me%20A%20Coffee-orange?style=for-the-badge)](https://buymeacoffee.com/pantel)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/pantelx)

</div>

> **Note**
>
> BetterShift is a modern shift management application built with Next.js 16 and SQLite. It helps you organize and manage work shifts across multiple calendars with customizable presets, color coding, and password protection. Perfect for anyone managing variable work schedules.

## 🔗 Quick Links

**Demo:** [bettershift.pantelx.com](https://bettershift.pantelx.com)

**Discord Server:** [Join our Discord for community discussions and support](https://discord.gg/Ma4SnagqwE)

**Self-Hosting:** [Check out the Deployment Guide](#%EF%B8%8F-deployment-guide)

**Support the Project:** [Buy Me A Coffee](https://www.buymeacoffee.com/pantel) or [Become a GitHub Sponsor](https://github.com/sponsors/pantelx)

---

## ✨ Key Features

### 📅 Calendar & Shift Management

- **Multiple Calendars**: Create and manage multiple shift calendars with custom names and colors
- **Interactive Calendar View**: Month-based calendar with week-based layout for easy navigation
- **Quick Shift Toggle**: Left-click any day to toggle shifts using your selected preset
- **Shift Presets**: Create reusable shift templates with custom times, colors, and labels
- **Drag & Drop**: Reorder calendars and presets with intuitive drag-and-drop functionality
- **Calendar Notes**: Right-click any day to add custom notes (e.g., "Morning shift because afternoon hairdresser")
- **ICloud Sync**: Import shifts from multiple iCloud calendars with individual sync management

### 🎨 Customization & Organization

- **Color Coding**: Assign colors to calendars and presets for better visualization
- **Preset Management**: Create, edit, and delete shift presets with auto-save functionality
- **Custom Shift Times**: Define exact start and end times for each shift
- **Flexible Scheduling**: Easily create one-time shifts or use presets for recurring patterns

### 🔒 Security & Privacy

- **Password Protection**: Secure individual calendars with optional passwords
- **Local Storage**: Passwords are securely hashed using SHA-256
- **Export Functionality**: Export calendar data for backup or migration

### 🌐 Internationalization

- **Multi-Language Support**: Built-in support for German and English
- **Automatic Detection**: Automatically detects browser language preference
- **Manual Switching**: Easy language switcher in the header
- **Cookie-Based Preference**: Your language choice persists across sessions

### 📊 Statistics & Insights

- **Shift Statistics**: View detailed statistics for different time periods
- **Customizable Periods**: Analyze shifts for current month, last 30 days, or custom ranges
- **Real-time Updates**: Statistics automatically refresh when shifts are modified

### 🔄 Real-Time Synchronization

- **Server-Sent Events**: Real-time updates across multiple browser tabs
- **Offline Handling**: Graceful handling of offline scenarios
- **Automatic Refresh**: Data refreshes automatically when changes are detected

### 💾 Modern Tech Stack

- **Next.js 16 App Router**: Latest Next.js with React 19 for optimal performance
- **SQLite with Drizzle ORM**: Lightweight, file-based database with type-safe queries
- **Tailwind CSS 4**: Modern styling with shadcn/ui components
- **Docker Support**: Easy deployment with Docker and Docker Compose

---

## 🛠️ Deployment Guide

### 💻 Local Development

```bash
# Clone the repository
$ git clone https://github.com/pantelx/bettershift.git && cd bettershift

# Install dependencies
$ npm install

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

## ❓ Frequently Asked Questions

### What is BetterShift?

BetterShift is a shift management application designed for people with variable work schedules. It allows you to manage multiple calendars, create shift presets, add notes to specific days, and view statistics about your working hours.

### How do I protect a calendar with a password?

1. Open the calendar settings
2. Click "Manage Password"
3. Set a password for the calendar
4. The password will be required for editing or viewing that calendar

### How do I add a shift quickly?

1. Select a preset from the preset selector
2. Click on any day in the calendar
3. The shift will be created automatically with the preset's settings
4. Click the same day again to remove the shift

### How do I add notes to a specific day?

Right-click (or long-press on mobile) on any day in the calendar to open the note dialog. You can add, edit, or delete notes for that day.

### Does BetterShift work offline?

BetterShift requires a server connection to save data. However, it handles offline scenarios gracefully and will attempt to reconnect automatically.

### What languages are supported?

Currently, BetterShift supports:

- German (Deutsch)
- English

The application automatically detects your browser language and uses the appropriate translation.

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
