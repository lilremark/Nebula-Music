# Docker Deployment

This folder contains the production Docker setup for Nebula Music 2.1.3.

The image uses:

- Node.js 24 Alpine for type-checking and building
- NGINX 1.30.3 Alpine from the verified unprivileged image
- A read-only runtime filesystem with all Linux capabilities dropped
- A dedicated `/healthz` container health endpoint

## Quick Start

From the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Open:

```text
http://localhost:8080
```

The first build runs both the TypeScript check and production Vite build.

## Commands

Build the image:

```bash
docker build \
  --build-arg APP_VERSION=2.1.3 \
  -f docker/Dockerfile \
  -t nebula-music:2.1.3 .
```

Run the image:

```bash
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -p 8080:8080 \
  nebula-music:2.1.3
```

Stop the Compose service:

```bash
docker compose -f docker/docker-compose.yml down
```

## Configuration

Compose supports two optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `NEBULA_VERSION` | `2.1.3` | Build label and local image tag |
| `NEBULA_PORT` | `8080` | Host port mapped to container port 8080 |

PowerShell example:

```powershell
$env:NEBULA_PORT = "9090"
docker compose -f docker/docker-compose.yml up -d --build
```

The app is then available at `http://localhost:9090`.

## Health and Logs

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f nebula-music
```

The container is healthy when `http://localhost:8080/healthz` returns HTTP 204.

## Notes

- Nebula Music is a static browser app. Subsonic/OpenSubsonic credentials are entered in the UI and stored in the browser, not in the container.
- Your Subsonic-compatible server must be reachable from the user's browser, not just from the Docker container.
- If the app cannot connect to your music server, check HTTPS and CORS settings on the Subsonic server.
- No runtime environment variables or persistent volumes are required.
