# Docker Deployment

This folder contains the production Docker setup for Nebula Music 3.0.0.

The image uses:

- Node.js 24 Alpine for type-checking and building
- NGINX 1.30.3 Alpine from the verified unprivileged image
- Updated Alpine packages and only the NGINX modules needed for static serving
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

Compose pulls `lilremark/nebula-music:latest` by default. To pin the 3.0.0
release:

```powershell
$env:NEBULA_VERSION = "3.0.0"
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
  --build-arg APP_VERSION=3.0.0 \
  -f docker/Dockerfile \
  -t nebula-music:3.0.0 .
```

Run the image:

```bash
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -p 8080:8080 \
  nebula-music:3.0.0
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

## Verify a Local Container

With the container running on port 8080 and development dependencies installed:

```powershell
$env:NEBULA_DOCKER_URL = "http://127.0.0.1:8080"
npm run test:docker
```

This checks NGINX health, security/cache headers, SPA routing, desktop and mobile
settings, keyboard navigation, theme switching, and decoded audio playback with
pause, resume, mute, and track changes. It uses a temporary Chromium profile with
no desktop preload and deterministic demo media; no personal music server is used.

## Health and Logs

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f nebula-music
```

The container is healthy when `http://localhost:8080/healthz` returns HTTP 204.

## Notes

- Desktop integration, desktop updates, and AI DJ settings/navigation are hidden in the Docker/browser edition. Player layout options still apply to browser playback.
- AI DJ currently requires the Windows Electron runtime, its IPC bridge, a Windows llama.cpp helper, and native speech synthesis. Mounting model files or adding an Ollama container alone does not enable it; browser support would require a separate inference/speech service and a web API integration.
- The build skips dependency install hooks because Electron and ONNX binaries are not used by the web app. Only the compiled web assets are copied into the runtime image; models, Node.js, and development dependencies are excluded from the final image.
- Nebula Music is a static browser app. Subsonic/OpenSubsonic credentials are entered in the UI and stored in the browser, not in the container.
- Your Subsonic-compatible server must be reachable from the user's browser, not just from the Docker container.
- If the app cannot connect to your music server, check HTTPS and CORS settings on the Subsonic server.
- Enter the final server base URL, including any reverse-proxy path. Browser API requests reject redirects so an authentication query cannot be forwarded to another host. Request deadlines also cover stalled response bodies.
- The bundled NGINX configuration sends a Content Security Policy and denies framing. It permits user-selected HTTP/HTTPS music and radio endpoints, the local Stream Deck websocket, artwork, and Google Fonts. Browser mixed-content and private-network restrictions still apply when the app is served over HTTPS.
- No runtime environment variables or persistent volumes are required.
