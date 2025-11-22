# BetterShift

A modern shift management application built with Next.js and SQLite. BetterShift helps you organize and manage work shifts across multiple calendars with customizable presets.

## Features

- 📅 **Multiple Calendars**: Create and manage multiple shift calendars
- ⏰ **Shift Management**: Add, edit, and delete shifts with start/end times
- 🎨 **Color Coding**: Assign colors to calendars for better visualization
- 📋 **Shift Presets**: Create reusable shift templates for faster scheduling
- 🗓️ **Calendar View**: Interactive monthly calendar with week-based layout
- 💾 **SQLite Database**: Lightweight, file-based database with Drizzle ORM
- 🐳 **Docker Support**: Easy deployment with Docker and Docker Compose

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with React 19
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **TypeScript**: Full type safety

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

1. **Create override configuration**

   ```bash
   cp docker-compose.override.yml.example docker-compose.override.yml
   ```

   Edit `docker-compose.override.yml` to customize ports or other settings.

2. **Build and run with Docker Compose**

   ```bash
   docker-compose up -d --build

   # Generate and apply database migrations
   docker compose exec bettershift npm run db:migrate
   ```

3. **Access the application**
   The application will be available at the port specified in your override file (default: 3000)

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

### Database Location

- **Development**: SQLite database file location depends on your configuration
- **Production/Docker**: `./data/sqlite.db` (persisted in the `data` volume)

## Project Structure

```
bettershift/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── calendars/    # Calendar endpoints
│   │   ├── presets/      # Preset endpoints
│   │   └── shifts/       # Shift endpoints
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── calendar-*.tsx    # Calendar components
│   ├── preset-*.tsx      # Preset components
│   └── shift-*.tsx       # Shift components
├── lib/                   # Utility functions
│   ├── db/               # Database configuration
│   │   ├── index.ts     # Database client
│   │   └── schema.ts    # Drizzle schema
│   ├── date-utils.ts    # Date helper functions
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # General utilities
├── data/                  # SQLite database directory
├── drizzle/              # Database migrations
├── docker-compose.yml    # Docker configuration
└── Dockerfile            # Docker image definition
```

## API Endpoints

### Calendars

- `GET /api/calendars` - List all calendars
- `POST /api/calendars` - Create a new calendar
- `GET /api/calendars/[id]` - Get calendar by ID
- `PUT /api/calendars/[id]` - Update calendar
- `DELETE /api/calendars/[id]` - Delete calendar

### Shifts

- `GET /api/shifts?calendarId=<id>&startDate=<date>&endDate=<date>` - List shifts
- `POST /api/shifts` - Create a new shift
- `GET /api/shifts/[id]` - Get shift by ID
- `PUT /api/shifts/[id]` - Update shift
- `DELETE /api/shifts/[id]` - Delete shift

### Presets

- `GET /api/presets?calendarId=<id>` - List presets
- `POST /api/presets` - Create a new preset
- `GET /api/presets/[id]` - Get preset by ID
- `PUT /api/presets/[id]` - Update preset
- `DELETE /api/presets/[id]` - Delete preset

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and not yet licensed for public use.

## Support

For issues and questions, please open an issue in the repository.
