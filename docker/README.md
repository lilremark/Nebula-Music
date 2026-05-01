# Docker Deployment

This folder contains the production Docker build for Nebula Music.

## Quick Start

From the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Open:

```text
http://localhost:8080
```

## Commands

Build the image:

```bash
docker build -f docker/Dockerfile -t nebula-music:latest .
```

Run the image:

```bash
docker run --rm -p 8080:80 nebula-music:latest
```

Stop the Compose service:

```bash
docker compose -f docker/docker-compose.yml down
```

## Notes

- Nebula Music is a static browser app. Subsonic credentials are entered in the UI and stored in the browser, not in the container.
- Your Subsonic-compatible server must be reachable from the user's browser, not just from the Docker container.
- If the app cannot connect to your music server, check HTTPS and CORS settings on the Subsonic server.
