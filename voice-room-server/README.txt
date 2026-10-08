SHAKIL m game — voice-room backend

এই ফোল্ডারটি Socket.IO + LiveKit backend। GitHub Pages-এ শুধু `index.html` থাকে; এই server আলাদা Node service হিসেবে চালাতে হবে।

Render/Railway সেটআপ
1. এই repository-র `voice-room-server` folder-কে service root করুন।
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variables দিন:
   - `LIVEKIT_URL` — LiveKit project-এর `wss://...` URL
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `CORS_ORIGIN=https://earnbd.work`
5. Deploy হওয়ার পর backend URL-টি homepage-এ `?voiceServer=https://YOUR-SERVICE.example.com` দিয়ে পরীক্ষা করুন। স্থায়ীভাবে সেট করতে `window.SHAKIL_VOICE_SERVER_URL`-কে HTML-এ service URL দিয়ে দিন।

`/healthz` endpoint-এ `{ "ok": true }` এলে server চালু। LiveKit credentials না দিলে room/chat দেখা যাবে, কিন্তু আসল voice publish হবে না। Browser-এর mic permission নিরাপত্তার কারণে bypass করা যায় না; permission শুধু ব্যবহারকারী নিজে দিলে চালু হবে।
