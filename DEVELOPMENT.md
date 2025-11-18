# Local Development Guide

Welcome to the MCDI project! This guide will help you set up and run the project locally using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mcdi
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

The default values work out of the box - no need to modify anything!

### 3. Start the Development Environment

```bash
docker-compose up -d
```

This will start all services in the background:
- NestJS application with hot reload
- MySQL database
- Redis cache
- phpMyAdmin (database UI)
- Redis Commander (Redis UI)
- Mailhog (email testing)

### 4. View Logs

```bash
# View all logs
docker-compose logs -f

# View only app logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app
```

### 5. Access the Application

| Service | URL | Credentials |
|---------|-----|-------------|
| **Application** | http://localhost:3000 | - |
| **phpMyAdmin** | http://localhost:8080 | user: `root`<br>password: `root_password` |
| **Redis Commander** | http://localhost:8081 | - |
| **Mailhog Web UI** | http://localhost:8025 | - |

## Development Workflow

### Hot Reload is Enabled!

The application has **hot reload enabled**. When you edit any `.ts` file in the `src/` directory:

1. Save the file in your IDE
2. NestJS automatically detects the change (~1-2 seconds)
3. TypeScript recompiles
4. Server restarts automatically
5. Changes are live!

You don't need to restart Docker containers when changing code.

### Making Code Changes

```bash
# Just edit files in your favorite IDE
code src/app.controller.ts

# Save the file
# Watch the logs to see the reload:
docker-compose logs -f app
```

You'll see output like:
```
[12:26:54 AM] File change detected. Starting incremental compilation...
[12:26:55 AM] Found 0 errors. Watching for file changes.
[Nest] Starting Nest application...
```

## Common Commands

### Managing Services

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart app

# Rebuild and restart (after dependency changes)
docker-compose up -d --build app

# View running containers
docker-compose ps
```

### Installing New Dependencies

When you need to install a new npm package:

```bash
# Method 1: Install inside the container
docker-compose exec app npm install package-name

# Method 2: Rebuild the container
docker-compose up -d --build app
```

After installing, restart the app:
```bash
docker-compose restart app
```

### Running Commands

```bash
# Run tests
docker-compose exec app npm run test

# Run linting
docker-compose exec app npm run lint

# Run build
docker-compose exec app npm run build

# Access container shell
docker-compose exec app sh

# Run any npm script
docker-compose exec app npm run <script-name>
```

### Database Operations

```bash
# Access MySQL CLI
docker-compose exec mysql mysql -u root -proot_password mcdi_db

# Import SQL file
docker-compose exec -T mysql mysql -u root -proot_password mcdi_db < backup.sql

# Export database
docker-compose exec mysql mysqldump -u root -proot_password mcdi_db > backup.sql
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli -a redis_password

# Clear all Redis cache
docker-compose exec redis redis-cli -a redis_password FLUSHALL

# Get specific key
docker-compose exec redis redis-cli -a redis_password GET key_name
```

## Troubleshooting

### Port Already in Use

If you see errors like `port is already allocated`:

1. Edit `.env` file and change the conflicting port:
```env
APP_PORT=3001
DB_PORT=3307
REDIS_PORT=6380
```

2. Restart services:
```bash
docker-compose down
docker-compose up -d
```

### Application Not Starting

```bash
# Check logs
docker-compose logs app

# Common fixes:
# 1. Restart the container
docker-compose restart app

# 2. Rebuild if dependencies changed
docker-compose up -d --build app

# 3. Remove dist folder if permission issues
rm -rf dist/
docker-compose restart app
```

### Hot Reload Not Working

```bash
# Restart the app container
docker-compose restart app

# If still not working, rebuild
docker-compose up -d --build app
```

### Database Connection Errors

1. Ensure MySQL is healthy:
```bash
docker-compose ps
```

Look for `(healthy)` status next to `mcdi-mysql`

2. Wait 30-60 seconds on first startup for MySQL to initialize

3. Check credentials in `.env` match docker-compose settings

### Permission Errors with dist/ folder

If you see `EACCES: permission denied` errors related to `dist/`:

```bash
# Remove the dist folder
rm -rf dist/

# Restart the app
docker-compose restart app
```

## Email Testing with Mailhog

Mailhog catches all emails sent by your application for testing.

### Configuration

Configure your NestJS mailer to use:
```typescript
{
  host: 'mailhog',
  port: 1025,
  // No authentication needed
}
```

### Viewing Emails

1. Send an email from your app
2. Open http://localhost:8025
3. See all emails in the web UI

## Stopping Development

```bash
# Stop all containers (keeps data)
docker-compose down

# Stop and remove all data (fresh start next time)
docker-compose down -v
```

## Database Management

### Using phpMyAdmin

1. Go to http://localhost:8080
2. Login with:
   - Username: `root`
   - Password: `root_password`
3. Select `mcdi_db` database from the left sidebar

### Using MySQL CLI

```bash
docker-compose exec mysql mysql -u root -proot_password mcdi_db
```

### Data Persistence

All database data is stored in Docker volumes and persists between restarts.

To completely reset the database:
```bash
docker-compose down -v
docker-compose up -d
```

## Redis Management

### Using Redis Commander

1. Go to http://localhost:8081
2. Browse keys, values, and manage cache

### Using Redis CLI

```bash
# Access CLI
docker-compose exec redis redis-cli -a redis_password

# Common commands:
KEYS *              # List all keys
GET key_name        # Get value
SET key val         # Set value
DEL key             # Delete key
FLUSHALL            # Clear everything
```

## Tips for Productive Development

1. **Keep logs open** while developing:
   ```bash
   docker-compose logs -f app
   ```

2. **Use multiple terminals**:
   - Terminal 1: Logs (`docker-compose logs -f app`)
   - Terminal 2: Running commands
   - Terminal 3: Git operations

3. **Install IDE extensions**:
   - ESLint
   - Prettier
   - TypeScript

4. **Hot reload works for**:
   - `.ts` files in `src/`
   - Controller changes
   - Service changes
   - Module changes

5. **Requires restart**:
   - Environment variable changes (restart: `docker-compose restart app`)
   - New dependencies (rebuild: `docker-compose up -d --build app`)
   - Docker configuration changes (restart: `docker-compose down && docker-compose up -d`)

## Environment Variables

All configuration is in `.env`. Key variables:

```env
# Application
APP_PORT=3000              # Host port for the app

# Database
DB_HOST=mysql              # Don't change (Docker service name)
DB_PORT=3306               # Host port for MySQL
DB_USERNAME=root           # MySQL user
DB_PASSWORD=root_password  # MySQL password
DB_DATABASE=mcdi_db        # Database name

# Redis
REDIS_HOST=redis           # Don't change (Docker service name)
REDIS_PORT=6379            # Host port for Redis
REDIS_PASSWORD=redis_password

# UI Ports
PHPMYADMIN_PORT=8080
REDIS_COMMANDER_PORT=8081
MAILHOG_UI_PORT=8025
MAILHOG_SMTP_PORT=1025
```

## Need Help?

- Check logs: `docker-compose logs app`
- Restart services: `docker-compose restart`
- Ask the team in the project chat
- Check [NestJS documentation](https://docs.nestjs.com/)

## Clean Slate

If everything is broken and you want to start fresh:

```bash
# Nuclear option - removes everything
docker-compose down -v
rm -rf dist/ node_modules/
docker-compose up -d --build
```

This will:
1. Stop all containers
2. Delete all volumes (database data)
3. Remove dist and node_modules
4. Rebuild everything from scratch
