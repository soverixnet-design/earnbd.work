/*
 * SHAKIL m game voice chat
 *
 * Firebase Realtime Database is used only for room membership and WebRTC
 * signaling. Audio stays peer-to-peer and is never stored in Firebase.
 * Every game loads this module with a different `game` query parameter so a
 * room code can never accidentally connect players from another game.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  remove,
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
  ludo: "লুডু",
  card29: "২৯ কার্ড",
  carrom: "ক্যারাম",
  chess: "দাবা 3D",
  arcade: "খেলাঘর"
}[gameKey] || "গেম");

const css = document.createElement("style");
css.textContent = `
#smg-voice-chat{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:180;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#f8fafc}
#smg-voice-chat *{box-sizing:border-box}
#smg-vc-toggle{border:1px solid #ffffff38;border-radius:999px;padding:10px 14px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font:800 13px/1 system-ui,sans-serif;box-shadow:0 10px 26px #0007,0 0 18px #7c3aed66;cursor:pointer;white-space:nowrap}
#smg-vc-toggle[data-live="true"]{background:linear-gradient(135deg,#059669,#0ea5e9);box-shadow:0 10px 26px #0007,0 0 18px #22c55e99}
#smg-vc-panel{width:min(330px,calc(100vw - 24px));margin-top:8px;padding:14px;border:1px solid #ffffff2b;border-radius:18px;background:linear-gradient(160deg,#172554f5,#111827f5);box-shadow:0 20px 55px #000b,0 0 24px #2563eb44;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
#smg-vc-panel[hidden]{display:none}
#smg-vc-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
#smg-vc-head strong{font-size:15px;flex:1;color:#fde68a}
#smg-vc-close{border:0;background:#ffffff13;color:#fff;border-radius:10px;width:30px;height:30px;font-size:18px;cursor:pointer}
#smg-vc-status{min-height:34px;padding:8px 10px;border-radius:10px;background:#ffffff0e;color:#cbd5e1;font-size:12px;line-height:1.4;margin-bottom:10px}
#smg-vc-status[data-kind="ok"]{color:#bbf7d0;background:#064e3b88}
#smg-vc-status[data-kind="error"]{color:#fecaca;background:#7f1d1d88}
#smg-vc-status[data-kind="warn"]{color:#fde68a;background:#78350f88}
#smg-vc-label{display:block;color:#cbd5e1;font-size:11px;margin-bottom:4px}
#smg-vc-room{width:100%;padding:9px 10px;border:1px solid #ffffff2b;border-radius:10px;background:#020617aa;color:#fff;font:700 14px/1.2 system-ui,sans-serif;outline:0}
#smg-vc-room:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #3b82f633}
#smg-vc-actions,#smg-vc-tools{display:flex;gap:7px;margin-top:9px}
#smg-vc-actions button,#smg-vc-tools button{flex:1;border:0;border-radius:10px;padding:9px 8px;font:800 12px/1 system-ui,sans-serif;cursor:pointer;color:#fff;background:#334155}
#smg-vc-join{background:linear-gradient(135deg,#16a34a,#0d9488)!important}
#smg-vc-leave{background:#7f1d1d!important}
#smg-vc-tools button:disabled,#smg-vc-actions button:disabled{opacity:.45;cursor:not-allowed}
#smg-vc-members{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;min-height:22px}
#smg-vc-members span{padding:4px 7px;border-radius:999px;background:#ffffff14;color:#e2e8f0;font-size:11px}
#smg-vc-hint{margin:9px 0 0;color:#94a3b8;font-size:10px;line-height:1.35}
@media(max-width:520px){#smg-vc-toggle{padding:9px 11px;font-size:12px}#smg-vc-panel{padding:12px}}
`;
document.head.appendChild(css);

const root = document.createElement("div");
root.id = "smg-voice-chat";
root.innerHTML = `
  <button id="smg-vc-toggle" type="button" aria-expanded="false">🎙️ ভয়েস চ্যাট</button>
  <section id="smg-vc-panel" hidden aria-label="ভয়েস চ্যাট">
    <div id="smg-vc-head"><strong>🎙️ ${gameName} ভয়েস</strong><button id="smg-vc-close" type="button" aria-label="বন্ধ">×</button></div>
    <div id="smg-vc-status" data-kind="warn">লগইন করে একই রুম কোডে যোগ দিন।</div>
    <label id="smg-vc-label" for="smg-vc-room">ভয়েস রুম কোড</label>
    <input id="smg-vc-room" maxlength="48" autocomplete="off" placeholder="অনলাইন গেমের রুম কোড">
    <div id="smg-vc-actions"><button id="smg-vc-join" type="button">🎙️ যোগ দিন</button><button id="smg-vc-leave" type="button" disabled>ছেড়ে দিন</button></div>
    <div id="smg-vc-members" aria-live="polite"></div>
    <div id="smg-vc-tools"><button id="smg-vc-mute" type="button" disabled>🔇 মাইক বন্ধ</button></div>
    <p id="smg-vc-hint">একই গেমে থাকা খেলোয়াড়রা একই কোড ব্যবহার করলে কথা বলতে পারবেন। মাইক্রোফোনের অনুমতি লাগবে।</p>
  </section>`;
document.body.appendChild(root);

const $ = id => document.getElementById(id);
const toggle = $("smg-vc-toggle");
const panel = $("smg-vc-panel");
const statusEl = $("smg-vc-status");
const roomInput = $("smg-vc-room");
const joinBtn = $("smg-vc-join");
const leaveBtn = $("smg-vc-leave");
const muteBtn = $("smg-vc-mute");
const membersEl = $("smg-vc-members");

let currentUser = null;
let joined = false;
let joinedRaw = "";
let joinedPath = "";
let localStream = null;
let muted = false;
let memberUnsub = null;
let signalUnsub = null;
let memberDisconnect = null;
let members = {};
const peers = new Map();
const remoteAudio = new Map();
const signalQueue = new Map();

const safeKey = value => String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
const voicePath = raw => `voiceRooms/${safeKey(`${gameKey}-${raw}`)}`;
const nameOf = () => (currentUser?.displayName || currentUser?.email?.split("@")[0] || "Player").trim().slice(0, 24) || "Player";
const avatarOf = () => currentUser?.photoURL ? "🙂" : "👤";

function setStatus(text, kind = "warn") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function renderMembers() {
  const entries = Object.values(members || {}).filter(x => x && x.uid);
  membersEl.innerHTML = entries.length
    ? entries.map(x => `<span>${x.uid === currentUser?.uid ? "🎙️ " : "👤 "}${String(x.name || "Player").replace(/[<>]/g, "")}</span>`).join("")
    : "";
  if (joined) setStatus(`রুমে ${entries.length} জন · মাইক্রোফোন ${muted ? "বন্ধ" : "চালু"}`, "ok");
}

function updateControls() {
  const active = Boolean(joined);
  toggle.dataset.live = String(active);
  toggle.textContent = active ? "🎙️ ভয়েস চালু" : "🎙️ ভয়েস চ্যাট";
  joinBtn.disabled = active;
  leaveBtn.disabled = !active;
  muteBtn.disabled = !active;
  muteBtn.textContent = muted ? "🔊 মাইক চালু" : "🔇 মাইক বন্ধ";
}

function openPanel(open) {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open && !joined) roomInput.focus();
}

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
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
    ]
  });
  const entry = { pc, offerSent: false };
  peers.set(uid, entry);
  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = event => {
    if (event.candidate) sendSignal(uid, { type: "candidate", candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate });
  };
  pc.ontrack = event => {
    let audio = remoteAudio.get(uid);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
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
      if (connected) setStatus(`রুমে ${Object.keys(members || {}).length} জন · ${connected}টি ভয়েস সংযোগ চালু`, "ok");
    }
  };
  return entry;
}

async function addQueuedCandidates(uid, entry) {
  const queue = signalQueue.get(uid) || [];
  signalQueue.delete(uid);
  for (const candidate of queue) {
    try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
  }
}

async function handleSignal(message) {
  if (!joined || !message || !message.from || message.from === currentUser?.uid) return;
  const uid = String(message.from);
  if (message.type === "candidate") {
    const entry = createPeer(uid);
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
  if (entry.offerSent || entry.pc.signalingState !== "stable") return;
  entry.offerSent = true;
  try {
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    await sendSignal(uid, { type: "offer", offer: entry.pc.localDescription });
  } catch (e) { entry.offerSent = false; }
}

function syncPeers() {
  if (!joined || !currentUser) return;
  const ids = Object.keys(members || {}).filter(uid => uid !== currentUser.uid);
  ids.forEach(uid => { createPeer(uid); makeOffer(uid); });
  [...peers.keys()].filter(uid => !ids.includes(uid)).forEach(closePeer);
}

async function joinRoom() {
  if (joined) return;
  if (!currentUser) {
    setStatus("ভয়েস চ্যাটের জন্য আগে হোমপেজে লগইন করুন।", "error");
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setStatus("মাইক্রোফোনের জন্য HTTPS ব্রাউজার দরকার।", "error");
    return;
  }
  const raw = roomInput.value.trim();
  if (!raw) { setStatus("গেমের একই রুম কোড দিন।", "error"); return; }
  joinBtn.disabled = true;
  setStatus("মাইক্রোফোনের অনুমতি চাওয়া হচ্ছে…", "warn");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    joinedRaw = raw;
    joinedPath = voicePath(raw);
    const member = ref(db, `${joinedPath}/members/${currentUser.uid}`);
    const signals = ref(db, `${joinedPath}/signals/${currentUser.uid}`);
    await set(member, { uid: currentUser.uid, name: nameOf(), avatar: avatarOf(), joinedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    memberDisconnect = onDisconnect(member);
    await memberDisconnect.remove();
    memberUnsub = onValue(ref(db, `${joinedPath}/members`), snap => { members = snap.val() || {}; renderMembers(); syncPeers(); });
    signalUnsub = onChildAdded(signals, async snap => { const data = snap.val(); await handleSignal(data); remove(snap.ref).catch(() => {}); });
    joined = true;
    updateControls();
    setStatus("ভয়েস রুমে যোগ হয়েছে। অন্য খেলোয়াড়ের মাইক চালু হলে কথা শোনা যাবে।", "ok");
    renderMembers();
    syncPeers();
  } catch (e) {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    joinedRaw = "";
    joinedPath = "";
    joinBtn.disabled = false;
    setStatus(e?.name === "NotAllowedError" ? "মাইক্রোফোনের অনুমতি দেওয়া হয়নি।" : "ভয়েস রুমে যোগ দেওয়া যায়নি।", "error");
  }
}

async function leaveRoom() {
  if (!joined && !joinedPath) return;
  const path = joinedPath;
  joined = false;
  if (memberUnsub) memberUnsub();
  if (signalUnsub) signalUnsub();
  memberUnsub = signalUnsub = null;
  if (memberDisconnect) { try { await memberDisconnect.cancel(); } catch (e) {} memberDisconnect = null; }
  if (currentUser && path) await remove(ref(db, `${path}/members/${currentUser.uid}`)).catch(() => {});
  [...peers.keys()].forEach(closePeer);
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  members = {};
  joinedRaw = "";
  joinedPath = "";
  muted = false;
  renderMembers();
  updateControls();
  setStatus("ভয়েস রুম ছেড়ে দিয়েছেন।", "warn");
}

toggle.onclick = () => openPanel(panel.hidden);
$("smg-vc-close").onclick = () => openPanel(false);
joinBtn.onclick = joinRoom;
leaveBtn.onclick = leaveRoom;
muteBtn.onclick = () => {
  muted = !muted;
  if (localStream) localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
  updateControls();
  if (joined) setStatus(muted ? "মাইক বন্ধ আছে।" : "মাইক চালু আছে।", "ok");
};
roomInput.addEventListener("keydown", event => { if (event.key === "Enter") joinRoom(); });

window.smgVoiceSetRoom = emitRoom;
window.smgVoiceChat = { join: joinRoom, leave: leaveRoom, setRoom: emitRoom, game: gameKey };
window.addEventListener("smg-voice-room", event => emitRoom(event.detail?.roomId || event.detail));

onAuthStateChanged(auth, user => {
  currentUser = user || null;
  if (!currentUser && joined) leaveRoom();
  if (!currentUser) setStatus("লগইন করে একই রুম কোডে যোগ দিন।", "warn");
  else if (!joined) setStatus(`লগইন হয়েছে · ${gameName} ভয়েস রুমে যোগ দিতে কোড দিন।`, "ok");
});

// Online games can expose their current room without requesting the microphone
// automatically. The player still explicitly presses “যোগ দিন”.
let lastDetectedRoom = "";
setInterval(() => {
  try {
    const detected = typeof window.smgVoiceGetRoom === "function" ? window.smgVoiceGetRoom() : window.smgVoiceRoomId;
    if (detected && detected !== lastDetectedRoom) { lastDetectedRoom = String(detected); emitRoom(lastDetectedRoom); }
  } catch (e) {}
}, 600);

updateControls();
