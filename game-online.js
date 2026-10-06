/*
 * Shared Firebase online lobby for every non-Ludo game.
 *
 * The lobby protocol is deliberately game-agnostic: every page gets the same
 * room-code, invite-link, 2/4-player and no-code matchmaking flow. A game
 * adapter can listen for smg-game-online-start/stop/action events and send
 * moves through window.smgGameOnline.send().
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, remove, onValue, onChildAdded,
  onDisconnect, push, serverTimestamp
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
const params = new URL(import.meta.url).searchParams;
const gameKey = String(params.get("game") || "game").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 24);
const gameName = ({
  card29: "২৯ কার্ড",
  carrom: "ক্যারাম",
  chess: "দাবা 3D",
  arcade: "খেলাঘর"
}[gameKey] || "গেম");
const $ = id => document.getElementById(id);

const css = document.createElement("style");
css.textContent = `
#smg-online{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:175;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#f8fafc}
#smg-online *{box-sizing:border-box}
#smg-online-toggle{border:1px solid #ffffff40;border-radius:999px;padding:10px 14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;font:800 13px/1 system-ui,sans-serif;box-shadow:0 10px 26px #0008,0 0 18px #0ea5e966;cursor:pointer;white-space:nowrap}
#smg-online-toggle[data-live="true"]{background:linear-gradient(135deg,#059669,#0d9488);box-shadow:0 10px 26px #0008,0 0 18px #22c55e88}
#smg-online-panel{width:min(350px,calc(100vw - 24px));margin-bottom:8px;padding:14px;border:1px solid #ffffff2b;border-radius:18px;background:linear-gradient(160deg,#0f2b54f5,#111827f5);box-shadow:0 20px 55px #000b,0 0 24px #2563eb44;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
#smg-online-panel[hidden]{display:none}
#smg-online-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
#smg-online-head strong{font-size:15px;flex:1;color:#fde68a}
#smg-online-close{border:0;background:#ffffff13;color:#fff;border-radius:10px;width:30px;height:30px;font-size:18px;cursor:pointer}
#smg-online-status{min-height:34px;padding:8px 10px;border-radius:10px;background:#ffffff0e;color:#cbd5e1;font-size:12px;line-height:1.4;margin-bottom:10px}
#smg-online-status[data-kind="ok"]{color:#bbf7d0;background:#064e3b88}
#smg-online-status[data-kind="error"]{color:#fecaca;background:#7f1d1d88}
#smg-online-status[data-kind="warn"]{color:#fde68a;background:#78350f88}
#smg-online-size{width:100%;padding:9px;border:1px solid #ffffff2b;border-radius:10px;background:#ffffff12;color:#fff;font:700 13px system-ui,sans-serif;margin-bottom:8px}
#smg-online-size option{color:#111}
#smg-online-code{width:100%;padding:9px 10px;border:1px solid #ffffff2b;border-radius:10px;background:#020617aa;color:#fff;font:700 14px/1.2 system-ui,sans-serif;outline:0;text-transform:uppercase}
#smg-online-code:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #3b82f633}
#smg-online-actions,#smg-online-room-actions{display:flex;gap:7px;margin-top:8px}
#smg-online-actions button,#smg-online-room-actions button{flex:1;border:0;border-radius:10px;padding:9px 7px;font:800 12px/1.1 system-ui,sans-serif;cursor:pointer;color:#fff;background:#334155}
#smg-online-quick{background:linear-gradient(135deg,#f59e0b,#d97706)!important;color:#261200!important}
#smg-online-create{background:linear-gradient(135deg,#16a34a,#0d9488)!important}
#smg-online-join{background:linear-gradient(135deg,#2563eb,#4f46e5)!important}
#smg-online-share{background:#7c3aed!important}
#smg-online-start{background:#059669!important}
#smg-online-leave{background:#7f1d1d!important}
#smg-online-actions button:disabled,#smg-online-room-actions button:disabled{opacity:.45;cursor:not-allowed}
#smg-online-room[hidden]{display:none}
#smg-online-players{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;min-height:22px}
#smg-online-players span{padding:4px 7px;border-radius:999px;background:#ffffff14;color:#e2e8f0;font-size:11px}
#smg-online-hint{margin:9px 0 0;color:#94a3b8;font-size:10px;line-height:1.35}
@media(max-width:520px){#smg-online-toggle{padding:9px 11px;font-size:12px}#smg-online-panel{padding:12px}}
`;
document.head.appendChild(css);

const root = document.createElement("div");
root.id = "smg-online";
root.innerHTML = `
  <section id="smg-online-panel" hidden aria-label="অনলাইন রুম">
    <div id="smg-online-head"><strong>🌐 ${gameName} অনলাইন</strong><button id="smg-online-close" type="button" aria-label="বন্ধ">×</button></div>
    <div id="smg-online-status" data-kind="warn">লগইন করে রুম তৈরি বা ম্যাচ খুঁজুন।</div>
    <select id="smg-online-size" aria-label="অনলাইন খেলোয়াড় সংখ্যা"><option value="2">২ জনের রুম (দ্রুত ম্যাচ)</option><option value="4">৪ জনের রুম</option></select>
    <div id="smg-online-actions"><button id="smg-online-quick" type="button">⚡ কোড ছাড়া ম্যাচ</button><button id="smg-online-create" type="button">➕ রুম তৈরি</button></div>
    <input id="smg-online-code" maxlength="24" autocomplete="off" placeholder="রুম কোড বা শেয়ার লিংক">
    <div id="smg-online-room-actions"><button id="smg-online-join" type="button">🔑 কোড দিয়ে যোগ দিন</button><button id="smg-online-share" type="button" hidden>📋 শেয়ার</button></div>
    <div id="smg-online-room" hidden><div id="smg-online-players" aria-live="polite"></div><div id="smg-online-room-actions"><button id="smg-online-start" type="button" hidden>▶ শুরু করুন</button><button id="smg-online-leave" type="button">ছেড়ে দিন</button></div></div>
    <p id="smg-online-hint">একই সিস্টেমে code room, share-link এবং code-free matchmaking কাজ করে।</p>
  </section>
  <button id="smg-online-toggle" type="button" aria-expanded="false">🌐 অনলাইন</button>`;
document.body.appendChild(root);

const panel = $("smg-online-panel");
const toggle = $("smg-online-toggle");
const statusEl = $("smg-online-status");
const sizeEl = $("smg-online-size");
const codeEl = $("smg-online-code");
const quickBtn = $("smg-online-quick");
const createBtn = $("smg-online-create");
const joinBtn = $("smg-online-join");
const shareBtn = $("smg-online-share");
const roomEl = $("smg-online-room");
const playersEl = $("smg-online-players");
const startBtn = $("smg-online-start");
const leaveBtn = $("smg-online-leave");

let currentUser = null;
let desiredPlayers = 2;
let roomCode = "";
let roomData = null;
let roomUnsub = null;
let eventsUnsub = null;
let memberDisconnect = null;
let queueMode = false;
let queueUnsub = null;
let matchUnsub = null;
let queueDisconnect = null;
let matchInFlight = false;
let bridgeStarted = false;
let seenEvents = new Set();
let handledMatches = new Set();

const gameRoomRef = code => ref(db, `onlineRooms/${gameKey}/${safeKey(code)}`);
const gameEventsRef = code => ref(db, `onlineRooms/${gameKey}/${safeKey(code)}/events`);
const queueRoot = () => ref(db, `matchmaking/${gameKey}/queue`);
const matchesRoot = () => ref(db, `matchmaking/${gameKey}/matches`);
const safeKey = value => String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));
const nameOf = () => String(currentUser?.displayName || currentUser?.email?.split("@")[0] || "Player").slice(0, 24) || "Player";
const profileOf = () => window.smgGameGetProfile?.() || {};

function setStatus(text, kind = "warn") { statusEl.textContent = text; statusEl.dataset.kind = kind; }
function openPanel(open = true) { panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); if (open && !currentUser) setStatus("অনলাইন রুমের জন্য আগে লগইন করুন।", "warn"); }
function dispatch(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: { game: gameKey, ...detail } })); }
function entry() { const p = profileOf(); return { uid: currentUser.uid, name: String(p.name || nameOf()).slice(0, 24), avatar: String(p.avatar || "👤").slice(0, 4), joinedAt: serverTimestamp(), online: true }; }
function ensureUser() { if (currentUser) return true; openPanel(true); setStatus("অনলাইন খেলতে আগে লগইন করুন।", "error"); return false; }

function renderRoom(data) {
  roomData = data || null;
  const list = Object.values(data?.players || {}).filter(x => x && x.uid);
  playersEl.innerHTML = list.map(p => `<span>${String(p.avatar || "👤").replace(/[<>]/g, "")} ${String(p.name || "Player").replace(/[<>]/g, "")}${p.uid === currentUser?.uid ? " · আপনি" : ""}</span>`).join("");
  roomEl.hidden = !roomCode;
  shareBtn.hidden = !roomCode;
  const max = Number(data?.maxPlayers || desiredPlayers || 2);
  const playing = data?.status === "playing";
  if (roomCode) setStatus(`রুম কোড: ${roomCode} · ${list.length}/${max} জন${playing ? " · 🎮 খেলা চলছে" : " · অপেক্ষা করছে"}`, playing ? "ok" : "warn");
  startBtn.hidden = !roomCode || data?.host !== currentUser?.uid;
  startBtn.disabled = list.length < 2 || playing;
  startBtn.textContent = playing ? "🎮 খেলা চলছে" : "▶ শুরু করুন";
  quickBtn.disabled = Boolean(roomCode);
  createBtn.disabled = Boolean(roomCode);
  joinBtn.disabled = Boolean(roomCode);
  sizeEl.disabled = Boolean(roomCode);
  if (playing && !bridgeStarted) {
    const ids = Array.isArray(data.activeUids) ? data.activeUids : Object.keys(data.players || {}).sort();
    const seat = Math.max(0, ids.indexOf(currentUser?.uid));
    bridgeStarted = true;
    dispatch("smg-game-online-start", { code: roomCode, host: data.host === currentUser?.uid, seat, maxPlayers: max, players: ids.map(uid => data.players[uid] || { uid }), activeUids: ids });
  }
}

function stopListeners() {
  if (roomUnsub) roomUnsub();
  if (eventsUnsub) eventsUnsub();
  roomUnsub = eventsUnsub = null;
  if (memberDisconnect) { memberDisconnect.cancel().catch(() => {}); memberDisconnect = null; }
}

async function leaveQueue() {
  queueMode = false;
  if (queueUnsub) queueUnsub();
  if (matchUnsub) matchUnsub();
  queueUnsub = matchUnsub = null;
  if (queueDisconnect) { await queueDisconnect.cancel().catch(() => {}); queueDisconnect = null; }
  if (currentUser) await remove(ref(db, `matchmaking/${gameKey}/queue/${currentUser.uid}`)).catch(() => {});
  quickBtn.textContent = "⚡ কোড ছাড়া ম্যাচ";
  quickBtn.dataset.searching = "false";
}

async function maybeStart(data) {
  if (!currentUser || !data || data.status !== "waiting" || data.host !== currentUser.uid) return;
  const list = Object.values(data.players || {}).filter(x => x && x.uid).sort((a, b) => a.uid.localeCompare(b.uid));
  if (list.length < 2 || (!data.autoStart && startBtn.dataset.manual !== "1")) return;
  const active = list.slice(0, Math.min(Number(data.maxPlayers || 2), list.length));
  const owners = {}; active.forEach((p, i) => { owners[i] = p.uid; });
  await update(gameRoomRef(roomCode), { status: "playing", activeUids: active.map(x => x.uid), owners, startedAt: serverTimestamp() }).catch(e => setStatus("রুম শুরু করা যায়নি। Firebase Rules deploy আছে কি না দেখুন।", "error"));
}

function attachRoom(code) {
  const next = safeKey(code);
  if (!next) return;
  stopListeners();
  roomCode = next; roomData = null; bridgeStarted = false; seenEvents = new Set();
  codeEl.value = roomCode;
  roomUnsub = onValue(gameRoomRef(roomCode), snap => { const data = snap.val(); if (!data) { setStatus("রুমটি আর নেই।", "error"); return; } renderRoom(data); maybeStart(data); }, () => setStatus("রুম ডেটা পড়া যাচ্ছে না। Firebase Rules deploy করুন।", "error"));
  eventsUnsub = onChildAdded(gameEventsRef(roomCode), snap => { if (seenEvents.has(snap.key)) return; seenEvents.add(snap.key); const action = snap.val(); if (!action || action.uid === currentUser?.uid) return; dispatch("smg-game-online-action", { action, uid: action.uid, room: roomCode }); });
  memberDisconnect = onDisconnect(ref(db, `onlineRooms/${gameKey}/${roomCode}/players/${currentUser.uid}`));
  memberDisconnect.remove().catch(() => {});
  renderRoom({ status: "waiting", host: currentUser.uid, maxPlayers: desiredPlayers, players: { [currentUser.uid]: entry() } });
}

async function createRoom() {
  if (!ensureUser()) return;
  await leaveCurrent(false);
  desiredPlayers = Number(sizeEl.value) === 4 ? 4 : 2;
  const code = newCode();
  try {
    await set(gameRoomRef(code), { host: currentUser.uid, maxPlayers: desiredPlayers, autoStart: desiredPlayers === 2, status: "waiting", createdAt: serverTimestamp(), players: { [currentUser.uid]: entry() } });
    attachRoom(code); setStatus("রুম তৈরি হয়েছে। কোড বা শেয়ার লিংক বন্ধুকে দিন।", "ok");
  } catch (e) { setStatus("রুম তৈরি হয়নি। Firebase Rules deploy এবং login যাচাই করুন।", "error"); }
}

async function joinRoom(raw, fromMatch = false) {
  if (!ensureUser()) return;
  const value = String(raw || codeEl.value || "").trim();
  let codeValue = value;
  try { const parsed = new URL(value, location.href); codeValue = parsed.searchParams.get("room") || parsed.pathname.split("/").filter(Boolean).pop() || value; } catch (_) {}
  const code = safeKey(codeValue);
  if (!code) { setStatus("রুম কোড দিন।", "error"); return; }
  if (!fromMatch) await leaveCurrent(false);
  try {
    const snap = await get(gameRoomRef(code));
    const data = snap.val();
    if (!data) { setStatus("এই কোডের রুম পাওয়া যায়নি।", "error"); return; }
    const list = Object.values(data.players || {}).filter(x => x && x.uid);
    const alreadyMatched = fromMatch && Boolean(data.players?.[currentUser.uid]);
    if (data.status === "playing" || (!alreadyMatched && list.length >= Number(data.maxPlayers || 2))) { setStatus("রুমটি শুরু হয়ে গেছে বা পূর্ণ।", "error"); return; }
    if (!alreadyMatched) await update(ref(db), { [`onlineRooms/${gameKey}/${code}/players/${currentUser.uid}`]: entry() });
    attachRoom(code); setStatus("রুমে যোগ হয়েছে। হোস্ট শুরু করলে খেলা চালু হবে।", "ok");
  } catch (e) { setStatus(String(e?.code || "").includes("permission") ? "Firebase Rules deploy না হলে রুমে ঢোকা যাবে না।" : "রুমে যোগ দেওয়া যায়নি।", "error"); }
}

async function startRoom() { if (!ensureUser() || !roomCode || roomData?.host !== currentUser.uid) return; startBtn.dataset.manual = "1"; await maybeStart({ ...roomData, autoStart: false }); }

async function copyShare() {
  if (!roomCode) return;
  const url = new URL(location.href); url.searchParams.set("room", roomCode);
  const text = `${gameName} রুম কোড: ${roomCode}\n${url.href}`;
  try { if (navigator.share) await navigator.share({ title: `SHAKIL m game · ${gameName}`, text, url: url.href }); else await navigator.clipboard.writeText(text); setStatus("রুম কোড/লিংক শেয়ারের জন্য প্রস্তুত।", "ok"); }
  catch (e) { try { await navigator.clipboard.writeText(text); setStatus("লিংক কপি হয়েছে। বন্ধুকে পাঠান।", "ok"); } catch (_) { setStatus(`রুম কোড: ${roomCode}`, "ok"); } }
}

async function processMatches(raw) {
  if (!currentUser || !raw) return;
  for (const [id, match] of Object.entries(raw)) {
    if (!match || !Array.isArray(match.users) || !match.users.includes(currentUser.uid) || handledMatches.has(id)) continue;
    handledMatches.add(id); await leaveQueue(); await joinRoom(match.roomId || id, true); break;
  }
}

async function processQueue(raw) {
  if (!queueMode || !currentUser || matchInFlight) return;
  const waiting = Object.values(raw || {}).filter(x => x && x.uid && x.status === "waiting" && Number(x.maxPlayers || 2) === desiredPlayers).sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  if (waiting.length < desiredPlayers) { setStatus(`⚡ অনলাইন ম্যাচ খোঁজা হচ্ছে · ${waiting.length}/${desiredPlayers} জন অপেক্ষায়`, "warn"); return; }
  const group = waiting.slice(0, desiredPlayers);
  if (group[0].uid !== currentUser.uid) return;
  matchInFlight = true;
  const code = `m${newCode()}`;
  const players = {}; group.forEach(x => { players[x.uid] = { uid: x.uid, name: x.name || "Player", avatar: x.avatar || "👤", joinedAt: x.createdAt || serverTimestamp(), online: true }; });
  const updates = {};
  updates[`onlineRooms/${gameKey}/${code}`] = { host: group[0].uid, maxPlayers: desiredPlayers, autoStart: true, status: "waiting", createdAt: serverTimestamp(), players };
  updates[`matchmaking/${gameKey}/matches/${code}`] = { roomId: code, users: group.map(x => x.uid), createdAt: serverTimestamp() };
  await update(ref(db), updates).catch(() => {}); matchInFlight = false;
}

async function quickMatch() {
  if (!ensureUser()) return;
  if (queueMode) { await leaveQueue(); setStatus("অনলাইন ম্যাচ খোঁজা বন্ধ হয়েছে।", "warn"); return; }
  await leaveCurrent(false); desiredPlayers = Number(sizeEl.value) === 4 ? 4 : 2; queueMode = true;
  const qref = ref(db, `matchmaking/${gameKey}/queue/${currentUser.uid}`);
  try { await set(qref, { ...entry(), maxPlayers: desiredPlayers, status: "waiting", createdAt: serverTimestamp() }); }
  catch (e) { queueMode = false; setStatus("ম্যাচ queue চালু হয়নি। Firebase Rules deploy করুন।", "error"); return; }
  queueDisconnect = onDisconnect(qref); queueDisconnect.remove().catch(() => {});
  queueUnsub = onValue(queueRoot(), snap => processQueue(snap.val() || {}));
  matchUnsub = onValue(matchesRoot(), snap => processMatches(snap.val() || {}));
  quickBtn.dataset.searching = "true"; quickBtn.textContent = "✖ খোঁজা বন্ধ করুন"; setStatus("⚡ কোড ছাড়া অনলাইন ম্যাচ খোঁজা হচ্ছে…", "warn");
}

async function leaveCurrent(show = true) {
  await leaveQueue();
  const oldCode = roomCode, oldData = roomData;
  stopListeners();
  if (oldCode && currentUser && oldData?.players?.[currentUser.uid]) {
    const others = Object.values(oldData.players || {}).filter(x => x && x.uid && x.uid !== currentUser.uid);
    if (oldData.host === currentUser.uid && others.length) await update(gameRoomRef(oldCode), { host: others[0].uid }).catch(() => {});
    else if (!others.length) await remove(gameRoomRef(oldCode)).catch(() => {});
    else await remove(ref(db, `onlineRooms/${gameKey}/${oldCode}/players/${currentUser.uid}`)).catch(() => {});
  }
  if (bridgeStarted) dispatch("smg-game-online-stop", { code: oldCode });
  roomCode = ""; roomData = null; bridgeStarted = false; seenEvents = new Set(); startBtn.dataset.manual = "";
  shareBtn.hidden = true; roomEl.hidden = true; quickBtn.disabled = false; createBtn.disabled = false; joinBtn.disabled = false; sizeEl.disabled = false;
  if (show) setStatus("অনলাইন মেনু প্রস্তুত।", "warn");
}

function send(action = {}) {
  if (!roomCode || !currentUser || roomData?.status !== "playing") return Promise.resolve(false);
  const payload = { ...action, t: String(action.t || action.type || "action"), uid: currentUser.uid, at: serverTimestamp() };
  return set(push(gameEventsRef(roomCode)), payload).then(() => true).catch(() => false);
}

sizeEl.onchange = () => { desiredPlayers = Number(sizeEl.value) === 4 ? 4 : 2; };
toggle.onclick = () => openPanel(panel.hidden);
$("smg-online-close").onclick = () => openPanel(false);
quickBtn.onclick = quickMatch;
createBtn.onclick = createRoom;
joinBtn.onclick = () => joinRoom(codeEl.value);
shareBtn.onclick = copyShare;
startBtn.onclick = startRoom;
leaveBtn.onclick = () => leaveCurrent(true);
codeEl.addEventListener("keydown", e => { if (e.key === "Enter") joinRoom(codeEl.value); });

window.smgGameOnline = { game: gameKey, open: () => openPanel(true), close: () => openPanel(false), send, leave: () => leaveCurrent(true), getRoom: () => roomCode, isPlaying: () => Boolean(roomCode && roomData?.status === "playing") };

const invite = new URL(location.href).searchParams.get("room");
if (invite) { codeEl.value = safeKey(invite); openPanel(true); setStatus("ইনভাইট রুম কোড পাওয়া গেছে—যোগ দেওয়া হচ্ছে…", "ok"); }
onAuthStateChanged(auth, async user => {
  currentUser = user || null;
  if (!currentUser) { if (!roomCode) setStatus("লগইন করে রুম তৈরি বা ম্যাচ খুঁজুন।", "warn"); return; }
  setStatus("কোড দিয়ে রুমে ঢুকুন, নিজের রুম বানান অথবা code-free ম্যাচ খুঁজুন।", "ok");
  if (invite && !roomCode) await joinRoom(invite);
});
