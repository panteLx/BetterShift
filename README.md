# BetterShift

A modern shift management application built with Next.js and SQLite. BetterShift helps you organize and manage work shifts across multiple calendars with customizable presets, color coding, shift statistics and password protection.

## Features

- 📅 **Multiple Calendars**: Create, manage and delete multiple shift calendars
- ⏰ **Shift Management**: Add, edit, and delete shifts with start/end times
- 🎨 **Color Coding**: Assign colors to calendars for better visualization
- 📋 **Shift Presets**: Create reusable shift templates for faster scheduling
- 📝 **Calendar Notes**: Add custom notes to any day (e.g., "Morning shift because afternoon hairdresser")
- 🗓️ **Calendar View**: Interactive monthly calendar with week-based layout
- 🔒 **Password Protection**: Secure calendars with optional passwords
- 🌐 **Internationalization (i18n)**: Supports multiple languages with automatic detection and manual switching
- 📊 **Shift Statistics**: View statistics for shifts over different time periods
- 🔄 **Real-time Synchronization**: Automatic data refresh and offline handling with server-sent events
- 💾 **SQLite Database**: Lightweight, file-based database with Drizzle ORM
- 🐳 **Docker Support**: Easy deployment with Docker and Docker Compose

## Prerequisites

- Node.js 20+ (for local development)
- Docker and Docker Compose (for containerized deployment)

## Getting Started

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/pantelx/bettershift.git
   cd bettershift
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up the database**

   ```bash
   # Generate and apply database migrations
   npm run db:migrate
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Docker Deployment

2. **Build and run with Docker Compose**

   ```bash
   docker-compose up -d

   # Generate and apply database migrations
   docker compose exec bettershift npm run db:migrate
   ```

3. **Access the application**
   The application will be available at the port specified in your docker-compose file (default: 3000)

### Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Database Management

### Available Commands

```bash
# Generate new migrations after schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Push schema changes directly to the database
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue in the repository.
