# FocusFlow — Habit & Mood Tracker (PWA)

**FocusFlow** is a clean, offline-first Progressive Web App for tracking daily habits and mood. No accounts. Your data stays on your device.

## Features
- Add habits, mark them done, and keep **streaks**
- **Edit** names and **reorder** via drag-and-drop
- Log daily **mood** (1–5)
- **History chart** (last 30 days)
- **Excel (.xlsx) Export/Import** powered by SheetJS
- **Theme toggle** (dark / light)
- **Reminders** at a daily time (works while the app is open)
- Offline + Installable (PWA)

## Local development
Service workers require a local server.

```bash
cd focusflow-pwa-v2
python3 -m http.server 5173
# then open http://localhost:5173
```

## Deploy
- Netlify Drop: drag the folder in and you're live.
- Or connect a GitHub repo for auto-deploys.

## Customize
- Update `manifest.json` (name/colors/icons)
- Replace icons in `/icons`
- Theme variables at top of `styles.css`
- Update contact email in `privacy.html`

## License
MIT — see `LICENSE`.
