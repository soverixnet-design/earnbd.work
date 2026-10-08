# SHAKIL m game

নতুন homepage হলো `index.html`—এখানে Voice Lounge, profile, room list, chat, gifts, wallet demo, ranking এবং embedded Ludo/Carrom game আছে। পুরনো root website files সরানো হয়েছে; rollback-এর জন্য আগের commit/backup branch রাখা আছে।

## Live voice room

`voice-room-server/` হলো Socket.IO + LiveKit backend। GitHub Pages HTML serve করতে পারে, কিন্তু Node/WebSocket server চালাতে পারে না। তাই backend-টি Render/Railway-এর মতো Node host-এ deploy করে homepage-এ:

```text
https://earnbd.work/?voiceServer=https://YOUR-SERVICE.example.com
```

দিয়ে পরীক্ষা করুন। স্থায়ী ব্যবহারে `window.SHAKIL_VOICE_SERVER_URL`-এ backend URL সেট করুন। Backend-এর environment variables `voice-room-server/.env.example`-এ আছে।

LiveKit credentials না থাকলে homepage-এর offline demo rooms/games চলবে; real-time voice publish হবে না। Browser mic permission নিরাপত্তার কারণে bypass করা যায় না—ব্যবহারকারীকে নিজে Allow চাপতে হবে।

## Deploy backend

`voice-room-server`-এর জন্য:

- Build: `npm install`
- Start: `npm start`
- Health check: `/healthz`
- Environment: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CORS_ORIGIN`

Owner room lock, kick এবং block করতে পারে। Room state বর্তমানে process memory-তে থাকে; server restart হলে room list reset হয়। স্থায়ী login, wallet এবং admin data-এর জন্য আলাদা authenticated database pass লাগবে।

## Security

GitHub-এ API secret, LiveKit secret, Firebase service account বা personal access token রাখবেন না। Browser-side public config secret নয়, কিন্তু backend credentials কখনো HTML-এ দেবেন না।
