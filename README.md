# Chaos Run — Friendly Clash

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/uKg-gta/Friendly-Clash)

A responsive multiplayer browser obstacle-race game for phones, tablets, and laptops.

## Features
- Create a room and invite friends with a four-character code
- Up to 8 players per room
- Shared real-time player positions using Socket.IO
- Server-authoritative movement and obstacle collision
- Keyboard (WASD / arrow keys) and mobile touch controls
- Responsive UI and race timer

## Requirements
Node.js 20+ and npm.

## Run locally
```bash
npm install
npm start
``
Open http://localhost:3000. To test multiplayer, use multiple browser windows. For other devices, deploy the server or use your computer's LAN address.

## Deploy
Use the Deploy to Render button above, or open the Render Dashboard and choose New > Blueprint. Connect the `uKg-gta/Friendly-Clash` repository and select branch `main`. Review the Blueprint and click Deploy Blueprint. Render uses `render.yaml` at the repository root. Build command: `npm install`; start command: `npm start`. The service listens on the provider's `PORT`. Do not use static-only hosting because the Socket.IO server is required.

## Notes
- Room state is in memory; restarting the server clears active rooms.
- No user accounts, database, matchmaking, or robust reconnect support yet.
- Before a public launch, add input rate limits, automated tests, session recovery, and production monitoring.

## License
No license has been selected yet.