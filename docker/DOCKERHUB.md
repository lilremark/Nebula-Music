# Nebula Music

**A self-hosted music player for Subsonic and OpenSubsonic libraries, served from Docker and played in your browser.**

Connect your Navidrome, Gonic, Airsonic, or other compatible music server and browse your library from a desktop, tablet, or phone. Nebula 3.0 includes light and dark themes, a floating playback dock, a Now Playing sidebar, and a full-screen player.

[Source code](https://github.com/lilremark/Nebula-Music) · [Deployment documentation](https://github.com/lilremark/Nebula-Music/blob/main/docker/README.md) · [Report an issue](https://github.com/lilremark/Nebula-Music/issues)

## Screenshots

Nebula 3.0 in Demo Mode. All screenshots use the demo library.

![Nebula 3.0 Home in dark mode, with featured albums, Quick Picks, and Your Rotation](https://raw.githubusercontent.com/lilremark/Nebula-Music/main/screenshots/v3-home-demo.png)

![Nebula 3.0 in light mode with the Now Playing sidebar](https://raw.githubusercontent.com/lilremark/Nebula-Music/main/screenshots/v3-home-light-demo.png)

![Full-screen player with artwork, seeking, and playback controls](https://raw.githubusercontent.com/lilremark/Nebula-Music/main/screenshots/v3-player-demo.png)

## Features

- **Your music library:** browse artists, albums, tracks, playlists, favorites, and genres; search across your collection.
- **Discovery:** featured albums, Quick Picks, Your Rotation, random mixes, and listening statistics.
- **Playback controls:** queue management, repeat, seeking, volume, playback speed, and pitch controls.
- **Flexible players:** floating playback dock, Now Playing sidebar, full-screen player, and mobile playback controls.
- **Sound and visuals:** equalizer, AutoEq headphone profiles, waveform progress, visualizers, and synchronized lyrics where available.
- **Internet radio:** direct streams and HLS playlists.
- **Browser integration:** Media Session controls, keyboard shortcuts, responsive layouts, and light/dark themes.
- **Demo Mode:** try the interface before connecting a music server.

## Before you start

You need Docker and an existing Subsonic-compatible music server. This image serves the Nebula web player; it does not host your music library or replace Navidrome, Gonic, or Airsonic.

Your music server must be reachable from the **browser you use to open Nebula**. Container-to-server connectivity alone is not enough: the browser makes music-server requests directly.

## Quick start with Docker Compose

Save the following as `compose.yaml`:

```yaml
services:
  nebula-music:
    image: lilremark/nebula-music:3.0.0
    pull_policy: always
    restart: unless-stopped
    ports:
      - "8080:8080"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=16m
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

Start Nebula:

```bash
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080), enter your music-server URL and credentials, and connect. If Docker runs on another machine, replace `localhost` with that machine's hostname or IP address. You can also choose **Try Demo Mode** on the setup screen.

To use another host port, change `8080:8080` to, for example, `9090:8080`. Keep the container port at `8080`.

## Run without Compose

```bash
docker run -d \
  --name nebula-music \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -p 8080:8080 \
  lilremark/nebula-music:3.0.0
```

## Tags and architectures

| Tag | Use |
| --- | --- |
| `3.0.0` | Pin the published 3.0.0 image |
| `3.0` | Follow the 3.0 release line |
| `latest` | Follow the latest stable Docker release |

All three tags currently point to Nebula **3.0.0**, with **`linux/amd64`** and **`linux/arm64`** images. Docker selects the architecture that matches your host.

## Configuration and storage

Enter the music-server URL and credentials in Nebula's setup screen or Connection settings. No runtime environment variables or persistent volumes are required.

Settings, credentials, caches, and listening statistics are stored in the browser. Recreating the container does not clear that browser data. Another browser or device has its own settings; clearing site data removes that browser's saved data. Changing the URL, scheme, or port used to open Nebula creates a separate browser storage origin.

The container serves static web assets through unprivileged NGINX on port `8080`. The examples above run it with a read-only filesystem, temporary storage under `/tmp`, no additional Linux capabilities, and privilege escalation disabled.

## Docker edition and AI DJ

The Docker image provides the **browser edition**. Desktop integration, native app updates, and AI DJ settings/navigation are hidden. Browser playback layouts, including the dock and sidebar, remain available.

AI DJ currently requires the Windows Electron app, its native IPC bridge, the Windows llama.cpp helper, and native speech synthesis. Mounting model files or adding an Ollama container does not enable AI DJ in this image. Browser AI DJ support would need a separate inference/speech service and a web API integration.

For native desktop downloads, see [GitHub Releases](https://github.com/lilremark/Nebula-Music/releases).

## Update

Change the image tag in `compose.yaml` to the release you want, or use `latest` to follow stable Docker releases. Then run:

```bash
docker compose pull
docker compose up -d
```

For a deployment created with `docker run`, pull the desired image and recreate the container with the same options. Music remains on your music server and browser data remains in your browser.

## Health and logs

The image includes a health check. `GET /healthz` on container port `8080` returns HTTP **204** when NGINX is responding. This checks the web container, not connectivity to your music server.

```bash
docker compose ps
docker compose logs --tail=100 nebula-music
```

## Connection troubleshooting

- **Cannot reach the server:** check that its URL is accessible from the browser's device. Use the final server base URL, including any reverse-proxy path; API requests reject redirects.
- **CORS errors:** configure the music server or its reverse proxy to allow requests from Nebula's origin, including its scheme and port.
- **HTTPS and HTTP:** an HTTPS-hosted player may be blocked from connecting to an HTTP music server. Serve both over HTTPS where possible. Browser mixed-content and private-network restrictions still apply.
- **TLS error or binary-looking HTTP 400:** container port `8080` serves plain HTTP. Open `http://HOST:8080` directly, or terminate HTTPS at a reverse proxy and forward to Nebula over HTTP. Sending HTTPS directly to port `8080` will fail.
- **Red STDERR startup entries:** NGINX `[notice]` messages, graceful SIGQUIT shutdowns, and workers exiting with code `0` are normal lifecycle logs. Check the message severity and HTTP status rather than the log viewer's color.
- **Playback formats:** codec support depends on the browser. Configure transcoding on your music server for formats that browser cannot play.
- **Reverse proxy:** forward traffic to container port `8080`. Serving Nebula from its own hostname at the site root keeps asset URLs straightforward.

## Links and license

- [GitHub repository](https://github.com/lilremark/Nebula-Music)
- [Docker deployment guide and local builds](https://github.com/lilremark/Nebula-Music/blob/main/docker/README.md)
- [Issues and feature requests](https://github.com/lilremark/Nebula-Music/issues)
- [MIT license](https://github.com/lilremark/Nebula-Music/blob/main/LICENSE.txt)
