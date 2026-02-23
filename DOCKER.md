# Docker Deployment Guide

Complete Docker setup for Marionette with Docker Compose.

## Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Services

### Backend
- **Container**: `marionette-backend`
- **Port**: 8787
- **Health Check**: `http://localhost:8787/health`
- **Database**: SQLite at `./db/marionette.db`

### Frontend
- **Container**: `marionette-frontend`
- **Port**: 5173 (mapped to port 80 in container)
- **Server**: nginx
- **API Proxy**: Requests to `/api` are proxied to backend

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Configuration

### Environment Variables

Backend (`docker-compose.yml`):
```yaml
environment:
  - NODE_ENV=production
  - PORT=8787
  - DATABASE_URL=sqlite:/app/db/marionette.db
```

Frontend (`docker-compose.yml`):
```yaml
environment:
  - VITE_API_URL=http://localhost:8787
  - VITE_WS_URL=ws://localhost:8787
```

### Ports

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8787
- **WebSocket**: ws://localhost:8787/stream

## Database

The SQLite database is stored in `./db/marionette.db` and is mounted as a volume, so data persists across container restarts.

### Initialize Database

The database will be created automatically on first run. If you need to reset it:

```bash
# Stop services
docker-compose down

# Remove database
rm db/marionette.db

# Recreate database
sqlite3 db/marionette.db < db/schema.sql

# Start services
docker-compose up -d
```

## Commands

### Build and Start
```bash
# Build and start in detached mode
docker-compose up -d --build

# Build without starting
docker-compose build

# Start without building
docker-compose up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Stop and Remove
```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and volumes
docker-compose down -v
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Execute Commands in Containers
```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell  
docker-compose exec frontend sh

# Run command in backend
docker-compose exec backend node dist/migrate.js
```

## Development vs Production

### Development
For local development, use `pnpm dev` instead of Docker:
```bash
pnpm dev  # Starts backend + frontend with hot reload
```

### Production
Use Docker Compose for production deployments:
```bash
docker-compose up -d --build
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Check if database directory exists
ls -la db/

# Recreate containers
docker-compose down
docker-compose up -d --build
```

### Frontend can't connect to backend
```bash
# Check if backend is healthy
curl http://localhost:8787/health

# Check network connectivity
docker-compose exec frontend wget -O- http://backend:8787/health
```

### Port already in use
```bash
# Find process using port 8787
lsof -ti:8787

# Kill process
lsof -ti:8787 | xargs kill -9

# Or change port in docker-compose.yml
ports:
  - "8788:8787"  # Use different host port
```

### Database permission errors
```bash
# Fix permissions
chmod 755 db/
chmod 644 db/marionette.db

# Restart
docker-compose restart backend
```

## Health Checks

Backend health check runs every 30 seconds:
```bash
# Manual health check
curl http://localhost:8787/health

# Check container health status
docker-compose ps
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-20T..."}
```

## Networking

Services communicate via the `marionette-network` bridge network:
- Frontend → Backend: `http://backend:8787`
- Host → Frontend: `http://localhost:5173`
- Host → Backend: `http://localhost:8787`

## Volumes

- `./db:/app/db` - Database persistence
- `db-data` - Named volume for additional data (optional)

## Building Images Separately

```bash
# Build backend
docker build -t marionette-backend:latest -f apps/server/Dockerfile .

# Build frontend
docker build -t marionette-frontend:latest -f apps/web/Dockerfile .

# Run manually
docker run -d -p 8787:8787 --name backend marionette-backend:latest
docker run -d -p 5173:80 --name frontend marionette-frontend:latest
```

## Performance

### Resource Limits
Add to `docker-compose.yml` if needed:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Multi-stage Builds
Both Dockerfiles use multi-stage builds to minimize image size:
- Builder stage: Compiles TypeScript
- Production stage: Only includes compiled code

## Security

1. **Non-root user**: Consider adding non-root user in Dockerfiles
2. **Secrets**: Never commit `.env` files with secrets
3. **Network isolation**: Use Docker networks for service communication
4. **Image scanning**: Run `docker scan` to check for vulnerabilities

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and test
        run: docker-compose up -d --build
      - name: Run tests
        run: docker-compose exec backend pnpm test
```

## Backup

### Backup Database
```bash
# Create backup
docker-compose exec backend sh -c 'sqlite3 /app/db/marionette.db .dump' > backup.sql

# Or copy file
cp db/marionette.db db/marionette.db.backup
```

### Restore Database
```bash
# Stop backend
docker-compose stop backend

# Restore from SQL dump
sqlite3 db/marionette.db < backup.sql

# Or restore file
cp db/marionette.db.backup db/marionette.db

# Start backend
docker-compose start backend
```

## Next Steps

1. Configure environment variables for your deployment
2. Set up reverse proxy (nginx/Caddy) for SSL/TLS
3. Configure automated backups
4. Set up monitoring (Prometheus + Grafana)
5. Enable log aggregation (ELK stack or similar)

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review [README.md](README.md)
- Open issue on GitHub
