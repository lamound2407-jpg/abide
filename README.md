# Abide

Tasks, calendar, goals, journal (Time with the Lord), and a scratchbook — one calm app instead of five disconnected ones. Built around Getting Things Done and *The Ruthless Elimination of Hurry*. See `ARCHITECTURE.md` for the full data model and reasoning behind every feature.

Currently: `src/App.jsx` is the working prototype (mock data, no backend yet) — responsive across phone, iPad, and laptop out of the box. Firebase is scaffolded but not wired in yet; that's the next milestone.

## Run it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Resize the browser window to see the phone → iPad → laptop layout switch.

## Connect Firebase (once you're ready to make it real)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it `abide`
2. **Build → Authentication** → enable Email/Password (add Google sign-in too if you want it)
3. **Build → Firestore Database** → Create database → production mode → pick the region closest to you
4. **Build → Storage** → enable (this is where Scratchbook drawings will live)
5. **Project settings → General → Your apps → Add app → Web** → copy the config values
6. `cp .env.example .env.local` and paste each value in
7. Restart `npm run dev`

`src/firebase.js` already reads those env vars — nothing else to wire up to get a connected Firebase project.

## Deploy

```bash
npm install -g firebase-tools   # once
firebase login
firebase init hosting           # choose "dist" as the public directory, single-page app: yes
npm run deploy
```

## Install on iPhone / iPad

Once deployed, open the URL in Safari → Share → **Add to Home Screen**. Because of the PWA config in `vite.config.js` and `index.html`, it opens full-screen with its own icon, no Safari address bar.

## Project structure

```
src/
  App.jsx        the whole app (prototype stage — will get split into components/ as it grows)
  firebase.js     Firebase init, reads .env.local
  main.jsx        React entry point
  index.css       minimal global reset
```

## Where to go next

See `ARCHITECTURE.md` → **"Suggested build order."** Short version: Firestore-backed task CRUD first, then Areas/Goals, then the recurrence engine, then Google Calendar sync.
