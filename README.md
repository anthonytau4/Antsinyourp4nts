# Killer Quiz — Foodfight Remaster (Online-ready)

## What changed
- Auto-connects immediately when you click Create/Join
- Create generates a code if input is blank
- Share link auto-joins: `/?room=ABC123`
- `/health` endpoint for hosting platforms
- WebSocket keepalive ping

## Local run
```bash
npm install
npm start
```
Open http://localhost:3000 in two windows.

## Online run (recommended)
Deploy this folder as a Node web service (start command: `npm start`). The client connects to the same domain automatically.

If you host the HTML on a different domain, set in `index.html` before the game script:
```html
<script>window.KQ_SERVER = "wss://YOUR-SERVER-DOMAIN";</script>
```
