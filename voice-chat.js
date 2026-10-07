/*
 * SHAKIL m game — direct voice lounge
 *
 * Room membership and WebRTC signaling live in Firebase Realtime Database;
 * audio itself stays peer-to-peer. Joining is listener-first: the browser
 * never asks for a microphone until the player presses the mic button.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  runTransaction,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const cfg = {
  apiKey: "AIzaSyCMwXWSbbFRTHcKx9nixhAg7hHvk-6yr-Y",
  authDomain: "earnbdwork.firebaseapp.com",
  databaseURL: "https://earnbdwork-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "earnbdwork",
  storageBucket: "earnbdwork.firebasestorage.app",
  messagingSenderId: "463458443517",
  appId: "1:463458443517:web:ed7e89c1ccb6eee3075e94"
};

const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getDatabase(app);
const gameKey = new URL(import.meta.url).searchParams.get("game") || "game";
const gameName = ({
  lounge: "সবার",
  ludo: "লুডু",
  card29: "২৯ কার্ড",
  carrom: "ক্যারাম",
  chess: "দাবা 3D",
  arcade: "খেলাঘর"
}[gameKey] || "গেম");
const VOICE_MAX = 5;
const DIRECT_ROOM_ID = "global-lounge";
const DIRECT_ROOM_LABEL = "SHAKIL m game Voice Lounge";

const css = document.createElement("style");
css.textContent = `
#smg-voice-chat{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:180;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#f8fafc}
#smg-voice-chat *{box-sizing:border-box}
#smg-vc-toggle{border:1px solid #ffffff38;border-radius:999px;padding:10px 14px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font:800 13px/1 system-ui,sans-serif;box-shadow:0 10px 26px #0007,0 0 18px #7c3aed66;cursor:pointer;white-space:nowrap}
#smg-vc-toggle[data-live="true"]{background:linear-gradient(135deg,#059669,#0ea5e9);box-shadow:0 10px 26px #0007,0 0 18px #22c55e99}
#smg-vc-panel{width:min(390px,calc(100vw - 24px));max-height:min(78vh,680px);overflow:auto;margin-top:8px;padding:14px;border:1px solid #ffffff2b;border-radius:18px;background:linear-gradient(160deg,#172554f7,#111827f7);box-shadow:0 20px 55px #000b,0 0 24px #2563eb44;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
#smg-vc-panel[hidden]{display:none}
#smg-vc-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
#smg-vc-head strong{font-size:15px;flex:1;color:#fde68a}
#smg-vc-close{border:0;background:#ffffff13;color:#fff;border-radius:10px;width:30px;height:30px;font-size:18px;cursor:pointer}
#smg-vc-status{min-height:34px;padding:8px 10px;border-radius:10px;background:#ffffff0e;color:#cbd5e1;font-size:12px;line-height:1.4;margin-bottom:10px}
#smg-vc-status[data-kind="ok"]{color:#bbf7d0;background:#064e3b88}
#smg-vc-status[data-kind="error"]{color:#fecaca;background:#7f1d1d88}
#smg-vc-status[data-kind="warn"]{color:#fde68a;background:#78350f88}
#smg-vc-direct{width:100%;border:1px solid #34d39999;border-radius:12px;padding:11px;background:linear-gradient(135deg,#047857,#0e7490);color:#fff;font:900 13px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 16px #0004}
#smg-vc-direct:disabled{opacity:.55;cursor:not-allowed}
#smg-vc-room-note{margin:7px 0 0;color:#a7f3d0;font-size:10px;line-height:1.4}
#smg-vc-advanced{margin-top:11px;border:1px solid #ffffff1c;border-radius:11px;background:#02061755}
#smg-vc-advanced summary{padding:8px 10px;color:#cbd5e1;font-size:11px;font-weight:800;cursor:pointer}
#smg-vc-advanced-body{padding:0 10px 10px}
#smg-vc-label{display:block;color:#cbd5e1;font-size:11px;margin-bottom:4px}
#smg-vc-room{width:100%;padding:9px 10px;border:1px solid #ffffff2b;border-radius:10px;background:#020617aa;color:#fff;font:700 14px/1.2 system-ui,sans-serif;outline:0}
#smg-vc-room:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #3b82f633}
#smg-vc-actions,#smg-vc-tools{display:flex;gap:7px;margin-top:9px}
#smg-vc-actions button,#smg-vc-tools button{flex:1;border:0;border-radius:10px;padding:9px 8px;font:800 12px/1.15 system-ui,sans-serif;cursor:pointer;color:#fff;background:#334155}
#smg-vc-join{background:linear-gradient(135deg,#16a34a,#0d9488)!important}
#smg-vc-leave{background:#7f1d1d!important}
#smg-vc-quick{width:100%;margin-top:9px;border:1px solid #fbbf2466;border-radius:10px;padding:9px;background:#78350f;color:#fde68a;font:800 12px/1.2 system-ui,sans-serif;cursor:pointer}
#smg-vc-quick[data-searching="true"]{background:#92400e;color:#fff}
#smg-vc-tools button:disabled,#smg-vc-actions button:disabled{opacity:.45;cursor:not-allowed}
#smg-vc-members{display:flex;flex-direction:column;gap:6px;margin-top:11px;min-height:22px}
.smg-vc-member{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:10px;background:#ffffff10;color:#e2e8f0;font-size:11px}
.smg-vc-member-name{display:flex;align-items:center;gap:5px;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.smg-vc-member-name em{font-style:normal;color:#fcd34d;font-size:9px}
.smg-vc-mod{display:flex;gap:4px;flex:0 0 auto}
.smg-vc-mod button{border:1px solid #ffffff1c;border-radius:7px;padding:4px 5px;background:#ffffff12;color:#e2e8f0;font-size:11px;cursor:pointer}
.smg-vc-mod button:hover{background:#ffffff2b}
#smg-vc-owner{margin-top:8px;color:#fcd34d;font-size:10px;font-weight:800}
#smg-vc-room-count{margin-top:8px;color:#cbd5e1;font-size:11px;font-weight:800}
#smg-vc-room-count[data-full="true"]{color:#fbbf24}
#smg-vc-games{margin-top:11px;padding:9px;border:1px solid #ffffff1c;border-radius:11px;background:#02061755}
#smg-vc-games[hidden]{display:none}
#smg-vc-games strong{display:block;color:#bfdbfe;font-size:11px;margin-bottom:7px}
#smg-vc-game-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#smg-vc-game-links a{padding:7px 6px;border-radius:8px;background:#1e40af;color:#fff;text-decoration:none;text-align:center;font-size:10px;font-weight:800}
#smg-vc-game-links a:hover{background:#2563eb}
#smg-vc-help{width:100%;margin-top:8px;border:1px solid #60a5fa55;border-radius:9px;padding:7px;background:#1e3a8a;color:#dbeafe;font:700 11px/1.2 system-ui,sans-serif;cursor:pointer}
#smg-vc-helpbox{margin-top:7px;padding:8px;border-radius:9px;background:#020617aa;color:#cbd5e1;font-size:10px;line-height:1.45}
#smg-vc-helpbox[hidden]{display:none}
#smg-vc-hint{margin:9px 0 0;color:#94a3b8;font-size:10px;line-height:1.4}
#smg-game-dock{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));z-index:190;display:flex;align-items:flex-end;justify-content:center;gap:8px;max-width:calc(100vw - 16px);transform:translateX(-50%);pointer-events:none}
#smg-game-dock>*{pointer-events:auto}
#smg-game-dock #smg-voice-chat{position:relative;right:auto;bottom:auto;display:block}
#smg-game-dock #smg-vc-panel{position:fixed;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 48px);margin:0;transform:translateX(-50%)}
#smg-game-dock #smg-online{position:relative;left:auto;bottom:auto}
#smg-game-dock #smg-online-panel{position:fixed;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 48px);margin:0;transform:translateX(-50%)}
@media(max-width:520px){#smg-vc-toggle{padding:9px 11px;font-size:12px}#smg-vc-panel{padding:12px;width:min(390px,calc(100vw - 16px))}}
`;
document.head.appendChild(css);

const root = document.createElement("div");
root.id = "smg-voice-chat";
root.innerHTML = `
  <button id="smg-vc-toggle" type="button" aria-expanded="false">🎙️ ভয়েস রুম</button>
  <section id="smg-vc-panel" hidden aria-label="ভয়েস রুম">
    <div id="smg-vc-head"><strong>🎙️ ${DIRECT_ROOM_LABEL}</strong><button id="smg-vc-close" type="button" aria-label="বন্ধ">×</button></div>
    <div id="smg-vc-status" data-kind="warn">লগইন করে সরাসরি Voice Lounge-এ ঢুকুন।</div>
    <button id="smg-vc-direct" type="button">🚪 সরাসরি Voice Lounge-এ ঢুকুন</button>
    <p id="smg-vc-room-note">কোনো কোড লাগবে না। ঢোকার সময় মাইক permission চাইবে না—শুধু কথা বলার সময় মাইক চালু করুন।</p>
    <details id="smg-vc-advanced"><summary>🔒 Private room code (ঐচ্ছিক)</summary><div id="smg-vc-advanced-body">
      <label id="smg-vc-label" for="smg-vc-room">ভয়েস রুম কোড</label>
      <input id="smg-vc-room" maxlength="48" autocomplete="off" placeholder="অনলাইন গেমের রুম কোড">
      <div id="smg-vc-actions"><button id="smg-vc-join" type="button">🎙️ কোড দিয়ে ঢুকুন</button><button id="smg-vc-leave" type="button" disabled>ছেড়ে দিন</button></div>
    </div></details>
    <button id="smg-vc-quick" type="button">⚡ কোড ছাড়া অন্যদের খুঁজুন</button>
    <div id="smg-vc-members" aria-live="polite"></div>
    <div id="smg-vc-owner"></div>
    <div id="smg-vc-room-count" aria-live="polite">0/${VOICE_MAX} জন</div>
    <div id="smg-vc-tools"><button id="smg-vc-mute" type="button" disabled>🎙️ মাইক চালু করুন</button><button id="smg-vc-sound" type="button" disabled>🔊 শব্দ চালু</button></div>
    <div id="smg-vc-games" hidden><strong>🎮 Voice room থেকে গেম শুরু করুন</strong><div id="smg-vc-game-links"></div></div>
    <button id="smg-vc-help" type="button">❔ মাইক permission কীভাবে দেবেন</button>
    <div id="smg-vc-helpbox" hidden>Room-এ ঢোকার জন্য permission লাগে না। কথা বলতে “মাইক চালু করুন” চাপুন। Android Chrome/Opera-তে ঠিকানা বারের 🔒 চিহ্ন → Permissions → Microphone → Allow করুন। ফোনের Settings → Apps → Browser → Permissions → Microphone-ও Allow থাকতে হবে।</div>
    <p id="smg-vc-hint">Room owner সদস্যকে mute, kick বা block করতে পারবেন। সর্বোচ্চ ${VOICE_MAX} জন একই room-এ থাকতে পারবেন।</p>
  </section>`;
const dock = document.getElementById("smg-game-dock") || (() => {
  const el = document.createElement("div");
  el.id = "smg-game-dock";
  document.body.appendChild(el);
  return el;
})();
dock.appendChild(root);

const $ = id => document.getElementById(id);
const toggle = $("smg-vc-toggle");
const panel = $("smg-vc-panel");
const statusEl = $("smg-vc-status");
const directBtn = $("smg-vc-direct");
const roomInput = $("smg-vc-room");
const joinBtn = $("smg-vc-join");
const leaveBtn = $("smg-vc-leave");
const quickBtn = $("smg-vc-quick");
const muteBtn = $("smg-vc-mute");
const soundBtn = $("smg-vc-sound");
const membersEl = $("smg-vc-members");
const ownerEl = $("smg-vc-owner");
const roomCountEl = $("smg-vc-room-count");
const gamesEl = $("smg-vc-games");
const gameLinksEl = $("smg-vc-game-links");
const helpBtn = $("smg-vc-help");
const helpBox = $("smg-vc-helpbox");

let currentUser = null;
let joined = false;
let joinedRaw = "";
let joinedPath = "";
let roomMeta = {};
let localStream = null;
let muted = false;
let memberUnsub = null;
let metaUnsub = null;
let blockUnsub = null;
let signalUnsub = null;
let memberDisconnect = null;
let members = {};
let peerRosterSignature = "";
let voiceQueueMode = false;
let voiceQueueUnsub = null;
let voiceMatchUnsub = null;
let voiceQueueDisconnect = null;
let voiceMatchInFlight = false;
let voiceQueueClaimed = false;
let autoJoinStarted = false;
const handledVoiceMatches = new Set();
const peers = new Map();
const remoteAudio = new Map();
const signalQueue = new Map();

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const safeKey = value => String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
const voicePath = raw => safeKey(raw) === DIRECT_ROOM_ID ? `voiceRooms/${DIRECT_ROOM_ID}` : `voiceRooms/${safeKey(`${gameKey}-${raw}`)}`;
const nameOf = () => (currentUser?.displayName || currentUser?.email?.split("@")[0] || "Player").trim().slice(0, 24) || "Player";
const avatarOf = () => currentUser?.photoURL ? "🙂" : "👤";
const gameLinks = [
  ["🎲", "লুডু", "earnbd-ludo-complete.html"],
  ["🃏", "২৯ কার্ড", "soverix-29-card-v3-final-pro.html"],
  ["🎯", "ক্যারাম", "soverix-carrom.html"],
  ["♟️", "দাবা 3D", "shakil-chess-3d.html"],
  ["🎮", "খেলাঘর", "soverix-modern-games.html"]
];

function renderGameLinks() {
  const room = encodeURIComponent(joinedRaw || DIRECT_ROOM_ID);
  gameLinksEl.innerHTML = gameLinks.map(([icon, label, href]) => {
    const joiner = href.includes("?") ? "&" : "?";
    return `<a href="${href}${joiner}voiceRoom=${room}">${icon} ${label}</a>`;
  }).join("");
}

async function micPermission() {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const result = await navigator.permissions.query({ name: "microphone" });
    return result.state || "unknown";
  } catch (e) { return "unknown"; }
}

function micError(e) {
  const code = String(e?.code || e?.name || "").toLowerCase();
  if (code === "voice-room-full") return `এই ভয়েস রুমে ইতিমধ্যে ${VOICE_MAX} জন আছে। অন্য রুমে যোগ দিন।`;
  if (code === "voice-blocked") return "Room owner আপনাকে এই voice room থেকে block করেছেন।";
  if (code.includes("permission-denied") || code.includes("permission_denied")) return "Firebase voice-room permission বন্ধ আছে। database.rules.json Firebase Realtime Database-এ deploy করুন।";
  if (code.includes("notallowed") || code.includes("securityerror")) return "মাইক্রোফোন ব্লক করা আছে। ঠিকানা বারের 🔒 → Permissions → Microphone → Allow করে আবার চেষ্টা করুন।";
  if (code.includes("notfound")) return "এই ডিভাইসে মাইক্রোফোন পাওয়া যায়নি। ফোনের Microphone permission ও headset যাচাই করুন।";
  if (code.includes("notreadable") || code.includes("abort")) return "অন্য কোনো অ্যাপ মাইক্রোফোন ব্যবহার করছে। সেটি বন্ধ করে আবার চেষ্টা করুন।";
  if (code.includes("secure") || code.includes("https")) return "ভয়েসের জন্য HTTPS পেজ দরকার। earnbd.work-এর live link ব্যবহার করুন।";
  return "মাইক্রোফোন চালু করা যায়নি। Browser ও ফোনের Microphone permission Allow করে আবার চেষ্টা করুন।";
}

async function requestMicrophone() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error("Secure context required"); e.name = "SecurityError"; throw e;
  }
  const state = await micPermission();
  if (state === "denied") { const e = new Error("Microphone permission denied"); e.name = "NotAllowedError"; throw e; }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (e) {
    if (["OverconstrainedError", "NotReadableError"].includes(e?.name)) return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    throw e;
  }
}

function setStatus(text, kind = "warn") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function mediaKey() {
  return Object.values(members || {}).filter(x => x?.uid).sort((a, b) => String(a.uid).localeCompare(String(b.uid))).map(x => `${x.uid}:${x.mic ? 1 : 0}`).join("|");
}

function renderMembers() {
  const entries = Object.values(members || {}).filter(x => x?.uid).sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  roomCountEl.textContent = `${entries.length}/${VOICE_MAX} জন`;
  roomCountEl.dataset.full = String(entries.length >= VOICE_MAX);
  ownerEl.textContent = roomMeta.ownerUid ? `👑 Room owner: ${entries.find(x => x.uid === roomMeta.ownerUid)?.name || "Player"}` : "";
  membersEl.innerHTML = entries.length ? entries.map(x => {
    const isOwner = roomMeta.ownerUid === x.uid;
    const isMe = x.uid === currentUser?.uid;
    const controls = roomMeta.ownerUid === currentUser?.uid && !isMe ? `<span class="smg-vc-mod"><button type="button" data-moderate="mute" data-uid="${esc(x.uid)}" title="Mute">🔇</button><button type="button" data-moderate="kick" data-uid="${esc(x.uid)}" title="Kick">✕</button><button type="button" data-moderate="block" data-uid="${esc(x.uid)}" title="Block">🚫</button></span>` : "";
    return `<div class="smg-vc-member"><span class="smg-vc-member-name"><span>${x.mic ? "🎙️" : "👂"}</span>${esc(x.name || "Player")}${isMe ? " (আপনি)" : ""}${isOwner ? " <em>OWNER</em>" : ""}</span>${controls}</div>`;
  }).join("") : "";
  if (joined) setStatus(`ভয়েস রুমে ${entries.length}/${VOICE_MAX} জন · ${localStream && !muted ? "মাইক চালু" : "শুধু শুনছেন"}`, "ok");
}

function updateControls() {
  const active = Boolean(joined);
  toggle.dataset.live = String(active);
  toggle.textContent = active ? "🎙️ রুমে আছেন" : "🎙️ ভয়েস রুম";
  directBtn.disabled = active;
  joinBtn.disabled = active;
  leaveBtn.disabled = !active;
  quickBtn.disabled = active;
  muteBtn.disabled = !active;
  soundBtn.disabled = !active;
  if (!localStream) muteBtn.textContent = "🎙️ মাইক চালু করুন";
  else muteBtn.textContent = muted ? "🔊 মাইক চালু" : "🔇 মাইক বন্ধ";
  quickBtn.dataset.searching = String(voiceQueueMode);
  quickBtn.textContent = voiceQueueMode ? "✖ খোঁজা বন্ধ করুন" : "⚡ কোড ছাড়া অন্যদের খুঁজুন";
  gamesEl.hidden = !active;
  if (active) renderGameLinks();
}

function openPanel(open) {
  if (open) window.dispatchEvent(new CustomEvent("smg-game-panel-open", { detail: "voice" }));
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open && !joined) directBtn.focus();
}

window.addEventListener("smg-game-panel-open", event => {
  if (event.detail !== "voice") openPanel(false);
});

function emitRoom(raw) {
  const value = String(raw || "").trim();
  if (!value) return;
  if (!joined) roomInput.value = value;
  window.dispatchEvent(new CustomEvent("smg-voice-room-ready", { detail: { game: gameKey, roomId: value } }));
}

function sendSignal(to, payload) {
  if (!joinedPath || !currentUser || !to) return Promise.resolve();
  const target = push(ref(db, `${joinedPath}/signals/${to}`));
  return set(target, { from: currentUser.uid, ...payload, at: serverTimestamp() }).catch(() => {});
}

function closePeer(uid) {
  const entry = peers.get(uid);
  if (entry) {
    try { entry.pc.ontrack = null; entry.pc.onicecandidate = null; entry.pc.close(); } catch (e) {}
  }
  peers.delete(uid);
  const audio = remoteAudio.get(uid);
  if (audio) { audio.srcObject = null; audio.remove(); }
  remoteAudio.delete(uid);
  signalQueue.delete(uid);
}

function createPeer(uid) {
  const old = peers.get(uid);
  if (old && old.pc.connectionState !== "closed") return old;
  if (!window.RTCPeerConnection) { setStatus("এই browser-এ WebRTC voice সমর্থন নেই। Chrome/Opera-এর HTTPS link ব্যবহার করুন।", "error"); return null; }
  const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] });
  const entry = { pc, offerSent: false };
  peers.set(uid, entry);
  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  else pc.addTransceiver("audio", { direction: "recvonly" });
  pc.onicecandidate = event => {
    if (event.candidate) sendSignal(uid, { type: "candidate", candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate });
  };
  pc.ontrack = event => {
    let audio = remoteAudio.get(uid);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = false;
      audio.setAttribute("aria-label", "অন্য খেলোয়াড়ের ভয়েস");
      audio.style.display = "none";
      document.body.appendChild(audio);
      remoteAudio.set(uid, audio);
    }
    if (event.streams?.[0]) audio.srcObject = event.streams[0];
    audio.play().catch(() => {});
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(pc.connectionState)) {
      closePeer(uid);
      if (joined && currentUser && currentUser.uid < uid) setTimeout(() => syncPeers(), 800);
    }
    if (joined) {
      const connected = [...peers.values()].filter(x => x.pc.connectionState === "connected").length;
      if (connected) setStatus(`ভয়েস রুমে ${Object.keys(members || {}).length}/${VOICE_MAX} জন · ${connected}টি সংযোগ চালু`, "ok");
    }
  };
  return entry;
}

async function addQueuedCandidates(uid, entry) {
  if (!entry) return;
  const queue = signalQueue.get(uid) || [];
  signalQueue.delete(uid);
  for (const candidate of queue) {
    try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
  }
}

async function handleSignal(message) {
  if (!joined || !message || !message.from || message.from === currentUser?.uid) return;
  const uid = String(message.from);
  if (message.type === "moderate") {
    if (message.action === "mute") {
      muted = true;
      if (localStream) localStream.getAudioTracks().forEach(track => { track.enabled = false; });
      updateControls();
      setStatus("Room owner আপনার মাইক বন্ধ করেছেন।", "warn");
    } else if (message.action === "kick" || message.action === "block") {
      setStatus(message.action === "block" ? "Room owner আপনাকে block করেছেন।" : "Room owner আপনাকে room থেকে বের করেছেন।", "error");
      await leaveRoom(false);
    }
    return;
  }
  if (message.type === "candidate") {
    const entry = createPeer(uid);
    if (!entry) return;
    if (entry.pc.remoteDescription) {
      try { await entry.pc.addIceCandidate(new RTCIceCandidate(message.candidate)); } catch (e) {}
    } else {
      const q = signalQueue.get(uid) || [];
      q.push(message.candidate);
      signalQueue.set(uid, q);
    }
    return;
  }
  if (message.type === "offer") {
    const entry = createPeer(uid);
    if (!entry) return;
    if (entry.pc.signalingState !== "stable" && currentUser.uid < uid) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(message.offer));
      await addQueuedCandidates(uid, entry);
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      await sendSignal(uid, { type: "answer", answer: entry.pc.localDescription });
    } catch (e) { setStatus("ভয়েস সংযোগ তৈরি করা যায়নি। আবার চেষ্টা করুন।", "error"); }
    return;
  }
  if (message.type === "answer") {
    const entry = peers.get(uid);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(message.answer));
      await addQueuedCandidates(uid, entry);
    } catch (e) {}
  }
}

async function makeOffer(uid) {
  if (!joined || !currentUser || currentUser.uid >= uid) return;
  const entry = createPeer(uid);
  if (!entry || entry.offerSent || entry.pc.signalingState !== "stable") return;
  entry.offerSent = true;
  try {
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    await sendSignal(uid, { type: "offer", offer: entry.pc.localDescription });
  } catch (e) { entry.offerSent = false; }
}

function syncPeers() {
  if (!joined || !currentUser) return;
  const signature = mediaKey();
  if (signature !== peerRosterSignature) {
    peerRosterSignature = signature;
    [...peers.keys()].forEach(closePeer);
  }
  const ids = Object.keys(members || {}).filter(uid => uid !== currentUser.uid);
  ids.forEach(uid => { createPeer(uid); makeOffer(uid); });
  [...peers.keys()].filter(uid => !ids.includes(uid)).forEach(closePeer);
}

async function setRoomMeta(path, raw) {
  const metaRef = ref(db, `${path}/meta`);
  const existing = await get(metaRef);
  if (existing.exists()) return existing.val() || {};
  const result = await runTransaction(metaRef, current => current || {
    ownerUid: currentUser.uid,
    title: raw === DIRECT_ROOM_ID ? DIRECT_ROOM_LABEL : `${gameName} Voice Room`,
    maxMembers: VOICE_MAX,
    createdAt: Date.now()
  });
  return result.snapshot.val() || {};
}

const voiceQueueRoot = () => ref(db, `voiceMatchmaking/${gameKey}/queue`);
const voiceMatchesRoot = () => ref(db, `voiceMatchmaking/${gameKey}/matches`);
const voiceQueueEntry = () => ({ uid: currentUser.uid, name: nameOf(), status: "waiting", createdAt: serverTimestamp() });

async function stopVoiceQueue(stopMic = false) {
  voiceQueueMode = false;
  voiceQueueClaimed = false;
  if (voiceQueueUnsub) voiceQueueUnsub();
  if (voiceMatchUnsub) voiceMatchUnsub();
  voiceQueueUnsub = voiceMatchUnsub = null;
  if (voiceQueueDisconnect) { await voiceQueueDisconnect.cancel().catch(() => {}); voiceQueueDisconnect = null; }
  if (currentUser) await remove(ref(db, `voiceMatchmaking/${gameKey}/queue/${currentUser.uid}`)).catch(() => {});
  if (stopMic && !joined && localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
  updateControls();
}

async function processVoiceMatches(raw) {
  if (!currentUser || !raw) return;
  for (const [id, match] of Object.entries(raw)) {
    if (!match || !Array.isArray(match.users) || !match.users.includes(currentUser.uid) || handledVoiceMatches.has(id)) continue;
    handledVoiceMatches.add(id);
    await stopVoiceQueue(false);
    roomInput.value = String(match.roomId || id);
    await joinRoom(match.roomId || id);
    break;
  }
}

async function processVoiceQueue(raw) {
  if (!voiceQueueMode || voiceQueueClaimed || !currentUser || voiceMatchInFlight) return;
  const waiting = Object.values(raw || {}).filter(x => x?.uid && x.status === "waiting").sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  if (waiting.length < 2) { setStatus(`⚡ ভয়েস ম্যাচ খোঁজা হচ্ছে · ২–${VOICE_MAX} জনের অপেক্ষা`, "warn"); return; }
  const group = waiting.slice(0, VOICE_MAX);
  if (group[0].uid !== currentUser.uid) return;
  voiceMatchInFlight = true;
  const id = `auto-${Math.floor(100000 + Math.random() * 900000)}`;
  const updates = {};
  updates[`voiceMatchmaking/${gameKey}/matches/${id}`] = { roomId: id, maxMembers: VOICE_MAX, users: group.map(x => x.uid), createdAt: serverTimestamp() };
  try { await update(ref(db), updates); voiceQueueClaimed = true; }
  catch (e) { setStatus("ভয়েস ম্যাচ তৈরি হয়নি। Firebase Rules বা নেটওয়ার্ক পরীক্ষা করুন।", "error"); }
  voiceMatchInFlight = false;
}

async function quickVoiceMatch() {
  if (joined) return;
  if (!currentUser) { setStatus("ভয়েস ম্যাচের জন্য আগে লগইন করুন।", "error"); return; }
  if (voiceQueueMode) { await stopVoiceQueue(true); setStatus("ভয়েস ম্যাচ খোঁজা বন্ধ হয়েছে।", "warn"); return; }
  try {
    voiceQueueClaimed = false;
    voiceQueueMode = true;
    const qref = ref(db, `voiceMatchmaking/${gameKey}/queue/${currentUser.uid}`);
    await set(qref, voiceQueueEntry());
    voiceQueueDisconnect = onDisconnect(qref); voiceQueueDisconnect.remove().catch(() => {});
    voiceQueueUnsub = onValue(voiceQueueRoot(), snap => processVoiceQueue(snap.val() || {}));
    voiceMatchUnsub = onValue(voiceMatchesRoot(), snap => processVoiceMatches(snap.val() || {}));
    updateControls();
    setStatus("⚡ কোড ছাড়া voice match খোঁজা হচ্ছে… মাইক ছাড়াই অপেক্ষা করতে পারবেন।", "warn");
  } catch (e) { setStatus(micError(e), "error"); }
}

async function joinRoom(rawOverride = "", options = {}) {
  if (joined) return true;
  if (!currentUser) { setStatus("ভয়েস রুমে ঢুকতে আগে হোমপেজে লগইন করুন।", "error"); return false; }
  const raw = String(rawOverride || roomInput.value || "").trim();
  if (!raw) { setStatus("সরাসরি Voice Lounge button চাপুন, অথবা private room code দিন।", "error"); return false; }
  joinBtn.disabled = true;
  directBtn.disabled = true;
  setStatus("Voice room-এ ঢোকা হচ্ছে… permission লাগবে না।", "warn");
  try {
    const path = voicePath(raw);
    const blockSnap = await get(ref(db, `${path}/blocks/${currentUser.uid}`));
    if (blockSnap.exists()) { const e = new Error("blocked"); e.code = "voice-blocked"; throw e; }
    const meta = await setRoomMeta(path, raw);
    if (options.requestMic && !localStream) localStream = await requestMicrophone();
    const member = ref(db, `${path}/members/${currentUser.uid}`);
    const signals = ref(db, `${path}/signals/${currentUser.uid}`);
    const beforeSnap = await get(ref(db, `${path}/members`));
    const before = beforeSnap.val() || {};
    const beforeEntries = Object.values(before).filter(x => x?.uid && x.uid !== currentUser.uid);
    if (beforeEntries.length >= VOICE_MAX) { const e = new Error("Voice room is full"); e.code = "voice-room-full"; throw e; }
    await set(member, { uid: currentUser.uid, name: nameOf(), avatar: avatarOf(), mic: Boolean(localStream && !muted), joinedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const afterSnap = await get(ref(db, `${path}/members`));
    const after = afterSnap.val() || {};
    const afterEntries = Object.values(after).filter(x => x?.uid).sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
    if (afterEntries.length > VOICE_MAX && !afterEntries.slice(0, VOICE_MAX).some(x => x.uid === currentUser.uid)) {
      await remove(member).catch(() => {});
      const e = new Error("Voice room is full"); e.code = "voice-room-full"; throw e;
    }
    if (meta.ownerUid && meta.ownerUid !== currentUser.uid) {
      const ownerStillPresent = await get(ref(db, `${path}/members/${meta.ownerUid}`));
      if (!ownerStillPresent.exists()) {
        await update(ref(db, `${path}/meta`), { ownerUid: currentUser.uid, updatedAt: serverTimestamp() }).catch(() => {});
        meta.ownerUid = currentUser.uid;
      }
    }
    joinedRaw = raw;
    joinedPath = path;
    roomMeta = meta;
    memberDisconnect = onDisconnect(member); await memberDisconnect.remove();
    memberUnsub = onValue(ref(db, `${path}/members`), snap => { members = snap.val() || {}; renderMembers(); syncPeers(); });
    metaUnsub = onValue(ref(db, `${path}/meta`), snap => { roomMeta = snap.val() || roomMeta; renderMembers(); });
    blockUnsub = onValue(ref(db, `${path}/blocks/${currentUser.uid}`), snap => { if (snap.exists() && joined) { setStatus("Room owner আপনাকে block করেছেন।", "error"); leaveRoom(false); } });
    signalUnsub = onChildAdded(signals, async snap => { const data = snap.val(); await handleSignal(data); remove(snap.ref).catch(() => {}); });
    joined = true;
    roomInput.value = raw;
    updateControls();
    setStatus(`Voice Lounge-এ ঢুকেছেন · ${localStream ? "মাইক চালু" : "শুধু শুনছেন"}`, "ok");
    renderMembers();
    syncPeers();
    return true;
  } catch (e) {
    if (options.requestMic && localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
    joinedRaw = ""; joinedPath = ""; roomMeta = {};
    joinBtn.disabled = false; directBtn.disabled = false;
    setStatus(micError(e), "error");
    return false;
  }
}

async function enableMicrophone() {
  if (!joined) return;
  try {
    setStatus("মাইক permission চাওয়া হচ্ছে…", "warn");
    if (!localStream) localStream = await requestMicrophone();
    muted = false;
    await set(ref(db, `${joinedPath}/members/${currentUser.uid}/mic`), true).catch(() => {});
    [...peers.keys()].forEach(closePeer);
    peerRosterSignature = "";
    updateControls();
    setStatus("মাইক চালু হয়েছে। এখন room-এ কথা বলতে পারবেন।", "ok");
    syncPeers();
  } catch (e) { setStatus(micError(e), "error"); }
}

function toggleSound() {
  remoteAudio.forEach(audio => { audio.muted = false; audio.play().catch(() => {}); });
  setStatus("অন্য খেলোয়াড়দের শব্দ চালু হয়েছে।", "ok");
}

async function moderate(uid, action) {
  if (!joined || roomMeta.ownerUid !== currentUser?.uid || !uid || uid === currentUser.uid) return;
  const target = ref(db, `${joinedPath}/members/${uid}`);
  if (action === "block") await set(ref(db, `${joinedPath}/blocks/${uid}`), { uid, by: currentUser.uid, at: serverTimestamp() }).catch(() => {});
  await sendSignal(uid, { type: "moderate", action });
  if (action === "kick" || action === "block") await remove(target).catch(() => {});
  if (action === "mute") setStatus("সদস্যের মাইক mute করার নির্দেশ পাঠানো হয়েছে।", "ok");
}

async function transferOrCloseOwner(path) {
  if (!currentUser || !path || roomMeta.ownerUid !== currentUser.uid) return;
  const snap = await get(ref(db, `${path}/members`)).catch(() => null);
  const others = Object.values(snap?.val() || {}).filter(x => x?.uid && x.uid !== currentUser.uid).sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  if (others[0]) await update(ref(db, `${path}/meta`), { ownerUid: others[0].uid, updatedAt: serverTimestamp() }).catch(() => {});
  else await remove(ref(db, `${path}/meta`)).catch(() => {});
}

async function leaveRoom(showStatus = true) {
  if (!joined && !joinedPath) { await stopVoiceQueue(true); return; }
  const path = joinedPath;
  await transferOrCloseOwner(path);
  joined = false;
  if (memberUnsub) memberUnsub();
  if (metaUnsub) metaUnsub();
  if (blockUnsub) blockUnsub();
  if (signalUnsub) signalUnsub();
  memberUnsub = metaUnsub = blockUnsub = signalUnsub = null;
  if (memberDisconnect) { try { await memberDisconnect.cancel(); } catch (e) {} memberDisconnect = null; }
  if (currentUser && path) await remove(ref(db, `${path}/members/${currentUser.uid}`)).catch(() => {});
  [...peers.keys()].forEach(closePeer);
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  members = {}; roomMeta = {}; joinedRaw = ""; joinedPath = ""; muted = false; peerRosterSignature = "";
  await stopVoiceQueue(true);
  renderMembers(); updateControls();
  if (showStatus) setStatus("ভয়েস রুম ছেড়ে দিয়েছেন।", "warn");
}

toggle.onclick = () => openPanel(panel.hidden);
$("smg-vc-close").onclick = () => openPanel(false);
directBtn.onclick = () => joinRoom(DIRECT_ROOM_ID);
joinBtn.onclick = () => joinRoom();
leaveBtn.onclick = () => leaveRoom();
quickBtn.onclick = quickVoiceMatch;
muteBtn.onclick = async () => {
  if (!localStream) { await enableMicrophone(); return; }
  muted = !muted;
  localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
  await set(ref(db, `${joinedPath}/members/${currentUser.uid}/mic`), !muted).catch(() => {});
  updateControls();
  if (joined) setStatus(muted ? "মাইক বন্ধ আছে।" : "মাইক চালু আছে।", "ok");
};
soundBtn.onclick = toggleSound;
helpBtn.onclick = () => { helpBox.hidden = !helpBox.hidden; };
roomInput.addEventListener("keydown", event => { if (event.key === "Enter") joinRoom(); });
membersEl.addEventListener("click", event => {
  const button = event.target.closest?.("button[data-moderate]");
  if (button) moderate(button.dataset.uid, button.dataset.moderate);
});

window.smgVoiceSetRoom = emitRoom;
window.smgVoiceChat = { join: joinRoom, leave: leaveRoom, setRoom: emitRoom, game: gameKey, directRoom: DIRECT_ROOM_ID };
window.addEventListener("smg-voice-room", event => emitRoom(event.detail?.roomId || event.detail));

onAuthStateChanged(auth, async user => {
  currentUser = user || null;
  if (!currentUser && (joined || voiceQueueMode)) await leaveRoom();
  if (!currentUser) { setStatus("লগইন করে সরাসরি Voice Lounge-এ ঢুকুন।", "warn"); return; }
  if (joined) return;
  const desiredRoom = new URLSearchParams(location.search).get("voiceRoom");
  if (desiredRoom && !autoJoinStarted) {
    autoJoinStarted = true;
    await joinRoom(desiredRoom);
  } else setStatus(`লগইন হয়েছে · ${DIRECT_ROOM_LABEL}-এ ঢুকতে button চাপুন।`, "ok");
});

// Online games expose their current private room without requesting a mic.
let lastDetectedRoom = "";
setInterval(() => {
  try {
    const detected = typeof window.smgVoiceGetRoom === "function" ? window.smgVoiceGetRoom() : window.smgVoiceRoomId;
    if (detected && detected !== lastDetectedRoom) { lastDetectedRoom = String(detected); emitRoom(lastDetectedRoom); }
  } catch (e) {}
}, 600);

updateControls();
