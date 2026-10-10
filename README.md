# SHAKIL m game

নতুন homepage হলো `index.html`—এখানে Voice Lounge, profile, room list, chat, gifts, virtual wallet, ranking, Agency/Admin/BD policy এবং ছয়টি লোকাল গেম আছে: Ludo, Carrom, Night Food Wheel, Singh Food Wheel, Slots ও Jackpot Fruit। প্রতিটি গেমের নিজস্ব SVG logo `assets/game-logos/`-এ রাখা হয়েছে; নতুন চারটি গেম `games/` ফোল্ডারে রাখা হয়েছে; কোনো Claude/artifact লিংকের ওপর নির্ভর করে না। সাধারণ ইউজার স্ক্রিনে admin panel দেখানো হয় না।

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
