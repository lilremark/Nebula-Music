# Docker Deployment

This folder contains the production Docker setup for Nebula Music 2.2.0.

The image uses:

- Node.js 24 Alpine for type-checking and building
- NGINX 1.30.3 Alpine from the verified unprivileged image
- A read-only runtime filesystem with all Linux capabilities dropped
- A dedicated `/healthz` container health endpoint

## Quick Start

Pull and run the published Docker Hub image:

```bash
docker pull lilremark/nebula-music:latest
docker run -d \
  --name nebula-music \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -p 8080:8080 \
  lilremark/nebula-music:latest
```

Open:

```text
http://localhost:8080
```

The published image supports `linux/amd64` and `linux/arm64`.

## Docker Compose

From the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Compose pulls `lilremark/nebula-music:latest` by default. To pin the 2.2.0
release:

```powershell
$env:NEBULA_VERSION = "2.2.0"
docker compose -f docker/docker-compose.yml up -d
```

Stop the Compose service:

```bash
docker compose -f docker/docker-compose.yml down
```

## Build Locally

Build the image:

```bash
docker build \
  --build-arg APP_VERSION=2.2.0 \
  -f docker/Dockerfile \
  -t nebula-music:2.2.0 .
```

Run the image:

```bash
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -p 8080:8080 \
  nebula-music:2.2.0
```

## Configuration

Compose supports two optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `NEBULA_VERSION` | `latest` | Docker Hub image tag used by Compose |
| `NEBULA_PORT` | `8080` | Host port mapped to container port 8080 |

PowerShell example:

```powershell
$env:NEBULA_PORT = "9090"
docker compose -f docker/docker-compose.yml up -d
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
