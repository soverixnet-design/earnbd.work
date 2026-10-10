# SHAKIL m game

নতুন homepage হলো দেওয়া `shakil_x5f_game_x5f_voice_x5f_party.html`-এর design shell—পুরনো homepage layout সরিয়ে `index.html`-এ সেটি রাখা হয়েছে। `assets/shakil-bridge.js` এই shell-এর ভেতরে কার্যকর Games, Voice Rooms, Login/Profile, Wallet, Ranking এবং policy controls বসায়। সাধারণ ইউজার স্ক্রিনে admin panel দেখানো হয় না।

ছয়টি লোকাল গেম একই design-এর Games dock থেকে খোলে: Ludo, Carrom, Night Food Wheel, Singh Food Wheel, Slots ও Jackpot Fruit। প্রতিটির নিজস্ব SVG logo `assets/game-logos/`-এ আছে; গেমের ফাইল `games/`-এ। কোনো Claude/artifact link-এর ওপর game launch নির্ভর করে না।

## কীভাবে চালু/যোগ করবেন

1. এই repository-র `main` branch-ই hosting source রাখুন—root `index.html` বদলাবেন না; নতুন game যোগ করতে `games/<game>.html`, `assets/game-logos/<game>.svg` এবং `assets/shakil-bridge.js`-এর `GAME_META`-তে একটি entry যোগ করুন।
2. Firebase Console-এ Email/Password sign-in চালু করুন এবং `firestore.rules` publish করুন; client config bridge-এ আগে থেকেই আছে।
3. পাঁচ-seat online voice চালাতে `voice-room-server/` আলাদা Node host-এ deploy করে URL-টি `?voiceServer=https://YOUR-SERVICE.example.com` হিসেবে homepage-এ দিন। LiveKit variables না থাকলে demo room দেখা যাবে, কিন্তু real voice হবে না।
4. GitHub-এ commit/publish হওয়ার পর `https://earnbd.work/` থেকে নতুন shell দেখা যাবে।

## Login and game balance

Firebase Email/Password login থাকলে profile, game statistics এবং global ranking Firestore-এ sync করার চেষ্টা করে; Firebase unavailable হলে local guest fallback থাকে। নতুন guest/account-এ `100,000,000` free-play coins থাকে। Wallet-এ প্রদর্শনী হিসাব হিসেবে `10,000,000 virtual coins = $1` দেখানো হয়, কিন্তু এগুলো virtual এবং cash-out বা real-money wagering-এর জন্য নয়। Gift/store coins আলাদা রাখা হয়েছে; wallet-এ কোনো টাকা জমা বা cash-out flow নেই। Virtual coin request শুধু in-app ledger-এ রেকর্ড হয়।
`firestore.rules`-এ user-only profile এবং authenticated leaderboard access-এর baseline rules আছে; Firebase Console/CLI থেকে rules publish করার পর cloud sync চালু হবে।

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

Owner room lock, kick এবং block করতে পারে। Room state বর্তমানে process memory-তে থাকে; server restart হলে room list reset হয়। স্থায়ী voice-room state, wallet ledger এবং admin data-এর জন্য authenticated database/backend pass লাগবে।

## Security

GitHub-এ API secret, LiveKit secret, Firebase service account বা personal access token রাখবেন না। Browser-side public config secret নয়, কিন্তু backend credentials কখনো HTML-এ দেবেন না।
