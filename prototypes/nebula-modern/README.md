# Nebula Music modern-direction prototype

Throwaway, read-only design exploration. It does not import Nebula's store, services, persistence, or production UI.

Run from the repository root:

```powershell
npx vite --config prototypes/nebula-modern/vite.config.ts
```

Open `http://127.0.0.1:4175/?variant=A`. Use the bottom switcher or the left/right arrow keys to compare:

- A — Listening Canvas
- B — Library Index
- C — Cover Wall

All interactions are local preview state only.
