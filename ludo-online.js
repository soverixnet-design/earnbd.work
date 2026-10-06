/* Firebase Ludo rooms + code-free matchmaking for SHAKIL m game. */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  push,
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
const $ = id => document.getElementById(id);

let user = null;
let roomCode = "";
let roomData = null;
let roomUnsub = null;
let eventsUnsub = null;
let playerDisconnect = null;
let bridgeStarted = false;
let pendingEvents = [];
let seenEvents = new Set();
let queueMode = false;
let queueUnsub = null;
let matchUnsub = null;
let queueDisconnect = null;
let matchInFlight = false;
let handledMatches = new Set();
let desiredPlayers = 2;

const profile = () => {
  const p = window.smgLudoGetProfile?.() || {};
  return {
    uid: user?.uid || "",
    name: String(p.name || user?.displayName || user?.email?.split("@")[0] || "Player").slice(0, 24),
    avatar: String(p.avatar || "😎").slice(0, 4),
    id: String(p.id || "").replace(/\D/g, "").slice(0, 8)
  };
};
const codeKey = value => String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
const roomRef = code => ref(db, `onlineRooms/ludo/${codeKey(code)}`);
const playersRef = code => ref(db, `onlineRooms/ludo/${codeKey(code)}/players`);
const eventsRef = code => ref(db, `onlineRooms/ludo/${codeKey(code)}/events`);
const queueRoot = ref(db, "matchmaking/ludo/queue");
const matchesRoot = ref(db, "matchmaking/ludo/matches");
const newCode = prefix => `${prefix || ""}${Math.floor(100000 + Math.random() * 900000)}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function notice(text, kind = "") {
  if ($("oe")) { $("oe").textContent = text; $("oe").dataset.kind = kind; }
  if ($("lb")) $("lb").textContent = text;
}

function ensureUser() {
  if (user) return true;
  notice("অনলাইন খেলতে আগে হোমপেজে লগইন করুন।", "error");
  return false;
}

function injectControls() {
  const style = document.createElement("style");
  style.textContent = `
    #smg-ludo-size{width:100%;padding:10px;border:1px solid #fff5;border-radius:10px;background:#ffffff18;color:#fff;font:700 15px system-ui}
    #smg-ludo-size option{color:#111}
    #smg-ludo-copy{margin-top:3px}
    #oe[data-kind="error"]{color:#fecaca}
    #oe[data-kind="ok"]{color:#bbf7d0}
  `;
  document.head.appendChild(style);
  const o1 = $("o1");
  if (!o1) return;
  const select = document.createElement("select");
  select.id = "smg-ludo-size";
  select.setAttribute("aria-label", "অনলাইন খেলোয়াড় সংখ্যা");
  select.innerHTML = `<option value="2">২ জনের রুম (দ্রুত ম্যাচ)</option><option value="4">৪ জনের রুম</option>`;
  o1.insertBefore(select, o1.firstChild);
  select.onchange = () => { desiredPlayers = Number(select.value) === 4 ? 4 : 2; };
  $("fm").textContent = "⚡ কোড ছাড়া অনলাইন ম্যাচ";
  $("mkr").textContent = "➕ নিজের রুম তৈরি করুন";
  $("jn").textContent = "🔑 কোড দিয়ে যোগ দিন";
}

function showOnlinePanel() {
  $("mb").hidden = true;
  $("olp").hidden = false;
  $("o1").hidden = false;
  $("o2").hidden = true;
  notice(user ? "কোড ছাড়া ম্যাচ খুঁজুন অথবা নিজের রুম তৈরি করুন।" : "অনলাইন খেলতে আগে লগইন করুন।");
}

function playerEntry() {
  const p = profile();
  return { uid: p.uid, name: p.name, avatar: p.avatar, playerId: p.id, joinedAt: serverTimestamp(), online: true };
}

function renderPlayers(data) {
  const list = Object.values(data?.players || {}).filter(x => x && x.uid);
  if ($("pl")) $("pl").innerHTML = list.map(x => `<div class="pl">${escapeHtml(x.avatar || "🙂")} ${escapeHtml(x.name || "Player")}${x.uid === user?.uid ? " · আপনি" : ""}</div>`).join("");
  const max = Number(data?.maxPlayers || 2);
  const status = data?.status === "playing" ? "🎮 খেলা চলছে" : `${list.length}/${max} জন · আরেকজনের অপেক্ষা`;
  if ($("ot") && roomCode) $("ot").textContent = `রুম কোড: ${roomCode} · ${status}`;
  if ($("go")) { $("go").hidden = !data || data.host !== user?.uid; $("go").disabled = list.length < 2 || data?.status === "playing"; }
}

function stopRoomListeners() {
  if (roomUnsub) roomUnsub();
  if (eventsUnsub) eventsUnsub();
  roomUnsub = eventsUnsub = null;
  if (playerDisconnect) { playerDisconnect.cancel().catch(() => {}); playerDisconnect = null; }
}

function sendGameEvent(action) {
  if (!roomCode || !user || !roomData || roomData.status !== "playing") return Promise.resolve();
  const event = push(eventsRef(roomCode));
  return set(event, { ...action, uid: user.uid, at: serverTimestamp() }).catch(() => {});
}

function applyEvent(event) {
  if (!event || event.uid === user?.uid) return;
  if (!bridgeStarted) { pendingEvents.push(event); return; }
  window.smgLudoBridge?.receive(event);
}

function startBridge(data) {
  if (!user || !roomCode || !data?.players) return;
  const activeUids = Array.isArray(data.activeUids) ? data.activeUids : Object.keys(data.players).sort();
  if (!activeUids.includes(user.uid)) return;
  const names = ["লাল", "সবুজ", "হলুদ", "নীল"], avatars = ["🟥", "🟩", "🟨", "🟦"], ids = [];
  const owners = data.owners || {};
  activeUids.forEach((uid, seat) => {
    const p = data.players[uid] || {};
    names[seat] = p.name || `প্লেয়ার ${seat + 1}`;
    avatars[seat] = p.avatar || avatars[seat];
    ids[seat] = p.playerId || "";
  });
  const seat = activeUids.indexOf(user.uid);
  window.smgLudoBridge.online?.({ code: roomCode, host: data.host === user.uid, seat, owners, names, avatars, ids, activePlayers: activeUids.map((_, i) => i) });
  window.smgVoiceSetRoom?.(roomCode);
  bridgeStarted = true;
  const queued = pendingEvents.splice(0);
  queued.forEach(applyEvent);
}

async function maybeStart(data) {
  if (!user || !data || data.status !== "waiting" || data.host !== user.uid) return;
  const list = Object.values(data.players || {}).filter(x => x && x.uid).sort((a, b) => a.uid.localeCompare(b.uid));
  const max = Number(data.maxPlayers || 2);
  if (list.length < 2 || (!data.autoStart && !$("go").dataset.startNow)) return;
  if (!data.autoStart && !$("go").dataset.startNow) return;
  const active = list.slice(0, Math.min(max, list.length));
  const owners = {};
  active.forEach((p, i) => { owners[i] = p.uid; });
  await update(roomRef(roomCode), { status: "playing", activeUids: active.map(p => p.uid), owners, startedAt: serverTimestamp() }).catch(() => {});
}

function attachRoom(code) {
  const next = codeKey(code);
  if (!next) return;
  stopRoomListeners();
  roomCode = next;
  roomData = null;
  bridgeStarted = false;
  pendingEvents = [];
  seenEvents = new Set();
  $("cd").value = roomCode;
  $("o1").hidden = true;
  $("o2").hidden = false;
  roomUnsub = onValue(roomRef(roomCode), snap => {
    const data = snap.val();
    if (!data) { notice("রুমটি আর নেই।", "error"); return; }
    roomData = data;
    renderPlayers(data);
    if (data.status === "playing") startBridge(data);
    else maybeStart(data);
  }, () => notice("রুম ডেটা পড়া যাচ্ছে না। Firebase rules পরীক্ষা করুন।", "error"));
  eventsUnsub = onChildAdded(eventsRef(roomCode), snap => {
    if (seenEvents.has(snap.key)) return;
    seenEvents.add(snap.key);
    applyEvent(snap.val());
  });
  playerDisconnect = onDisconnect(ref(db, `onlineRooms/ludo/${roomCode}/players/${user.uid}`));
  playerDisconnect.remove().catch(() => {});
  window.smgVoiceSetRoom?.(roomCode);
}

async function createRoom() {
  if (!ensureUser()) return;
  await leaveCurrent(false);
  desiredPlayers = Number($("smg-ludo-size")?.value || desiredPlayers || 2) === 4 ? 4 : 2;
  const code = newCode("");
  const entry = playerEntry();
  const data = { host: user.uid, maxPlayers: desiredPlayers, autoStart: desiredPlayers === 2, status: "waiting", createdAt: serverTimestamp(), players: { [user.uid]: entry } };
  try {
    await set(roomRef(code), data);
    attachRoom(code);
    $("go").dataset.startNow = "";
    notice(`রুম তৈরি হয়েছে। কোডটি কপি করে বন্ধুকে দিন।`, "ok");
  } catch (e) { notice("রুম তৈরি করা যায়নি। Firebase rules deploy আছে কি না দেখুন।", "error"); }
}

async function joinRoom(code, fromMatch = false) {
  if (!ensureUser()) return;
  const next = codeKey(code || $("cd")?.value);
  if (!next) { notice("রুম কোড লিখুন।", "error"); return; }
  if (!fromMatch) await leaveCurrent(false);
  try {
    const snap = await get(roomRef(next));
    const data = snap.val();
    if (!data) { notice("এই কোডের রুম পাওয়া যায়নি।", "error"); return; }
    const list = Object.values(data.players || {}).filter(x => x && x.uid);
    const alreadyMatched = fromMatch && Boolean(data.players?.[user.uid]);
    if (data.status === "playing" || (!alreadyMatched && list.length >= Number(data.maxPlayers || 2))) { notice("রুমটি শুরু হয়ে গেছে বা পূর্ণ।", "error"); return; }
    await update(ref(db), { [`onlineRooms/ludo/${next}/players/${user.uid}`]: playerEntry() });
    attachRoom(next);
    notice("রুমে যোগ হয়েছে। হোস্ট শুরু করলে খেলা চালু হবে।", "ok");
  } catch (e) { notice("রুমে যোগ দেওয়া যায়নি। লগইন ও Firebase rules পরীক্ষা করুন।", "error"); }
}

async function startNow() {
  if (!ensureUser() || !roomCode || !roomData || roomData.host !== user.uid) return;
  $("go").dataset.startNow = "1";
  await maybeStart({ ...roomData, autoStart: false });
}

async function copyOrShare() {
  if (!roomCode) return;
  const url = new URL(location.href);
  url.searchParams.set("room", roomCode);
  const text = `SHAKIL m game লুডু রুম: ${roomCode}\n${url.href}`;
  try {
    if (navigator.share) await navigator.share({ title: "SHAKIL m game লুডু", text, url: url.href });
    else await navigator.clipboard.writeText(text);
    notice("রুম কোড/লিংক শেয়ার করার জন্য প্রস্তুত।", "ok");
  } catch (e) {
    try { await navigator.clipboard.writeText(text); notice("লিংক কপি হয়েছে। বন্ধুকে পাঠান।", "ok"); } catch (x) { notice(`রুম কোড: ${roomCode}`, "ok"); }
  }
}

async function leaveQueue() {
  queueMode = false;
  if (queueUnsub) queueUnsub();
  if (matchUnsub) matchUnsub();
  queueUnsub = matchUnsub = null;
  if (queueDisconnect) { await queueDisconnect.cancel().catch(() => {}); queueDisconnect = null; }
  if (user) await remove(ref(db, `matchmaking/ludo/queue/${user.uid}`)).catch(() => {});
  if ($("fm")) $("fm").textContent = "⚡ কোড ছাড়া অনলাইন ম্যাচ";
}

async function processMatches(raw) {
  if (!user || !raw) return;
  for (const [id, match] of Object.entries(raw)) {
    if (!match || !Array.isArray(match.users) || !match.users.includes(user.uid) || handledMatches.has(id)) continue;
    handledMatches.add(id);
    await remove(ref(db, `matchmaking/ludo/queue/${user.uid}`)).catch(() => {});
    await leaveQueue();
    await joinRoom(match.roomId || id, true);
    break;
  }
}

async function processQueue(raw) {
  if (!queueMode || !user || matchInFlight) return;
  const waiting = Object.values(raw || {}).filter(x => x && x.uid && x.status === "waiting" && Number(x.maxPlayers || 2) === desiredPlayers).sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  const target = desiredPlayers;
  if (waiting.length < 2) { notice(`⚡ অনলাইন ম্যাচ খোঁজা হচ্ছে · ${waiting.length} জন অপেক্ষায়`); return; }
  const group = waiting.slice(0, target);
  if (group.length < 2 || group[0].uid !== user.uid) return;
  matchInFlight = true;
  const code = newCode("m");
  const players = {};
  group.forEach(x => { players[x.uid] = { ...x, status: undefined }; delete players[x.uid].status; });
  const updates = {};
  updates[`onlineRooms/ludo/${code}`] = { host: group[0].uid, maxPlayers: target, autoStart: true, status: "waiting", createdAt: serverTimestamp(), players };
  updates[`matchmaking/ludo/matches/${code}`] = { roomId: code, users: group.map(x => x.uid), createdAt: serverTimestamp() };
  await update(ref(db), updates).catch(() => {});
  matchInFlight = false;
}

async function quickMatch() {
  if (!ensureUser()) return;
  if (queueMode) { await leaveQueue(); notice("অনলাইন ম্যাচ খোঁজা বন্ধ হয়েছে।"); return; }
  await leaveCurrent(false);
  desiredPlayers = Number($("smg-ludo-size")?.value || 2) === 4 ? 4 : 2;
  queueMode = true;
  const qref = ref(db, `matchmaking/ludo/queue/${user.uid}`);
  await set(qref, { ...playerEntry(), maxPlayers: desiredPlayers, status: "waiting", createdAt: serverTimestamp() }).catch(() => {});
  queueDisconnect = onDisconnect(qref); queueDisconnect.remove().catch(() => {});
  if (queueUnsub) queueUnsub();
  if (matchUnsub) matchUnsub();
  queueUnsub = onValue(queueRoot, snap => processQueue(snap.val() || {}));
  matchUnsub = onValue(matchesRoot, snap => processMatches(snap.val() || {}));
  $("fm").textContent = "✖ ম্যাচ খোঁজা বন্ধ করুন";
  notice("⚡ কোড ছাড়া অনলাইন ম্যাচ খোঁজা হচ্ছে…");
}

async function leaveCurrent(showMenu = true) {
  await leaveQueue();
  const oldCode = roomCode, oldData = roomData;
  stopRoomListeners();
  if (oldCode && user && oldData?.players?.[user.uid]) {
    const others = Object.values(oldData.players).filter(x => x && x.uid && x.uid !== user.uid);
    if (oldData.host === user.uid && others.length) await update(roomRef(oldCode), { host: others[0].uid }).catch(() => {});
    else if (!others.length) await remove(roomRef(oldCode)).catch(() => {});
    else await remove(ref(db, `onlineRooms/ludo/${oldCode}/players/${user.uid}`)).catch(() => {});
  }
  if (bridgeStarted) { window.smgLudoBridge?.leave?.(); bridgeStarted = false; }
  roomCode = ""; roomData = null; pendingEvents = []; seenEvents = new Set();
  if (showMenu) { $("olp").hidden = true; $("o1").hidden = false; $("o2").hidden = true; $("mb").hidden = false; }
}

window.smgLudoOnlineLeave = () => leaveCurrent(true);

injectControls();
$("onl").onclick = showOnlinePanel;
$("mkr").onclick = createRoom;
$("jn").onclick = () => joinRoom($("cd").value);
$("fm").onclick = quickMatch;
$("go").onclick = startNow;
$("smg-ludo-copy")?.addEventListener("click", copyOrShare);
$("ob").onclick = () => leaveCurrent(true);
window.smgLudoBridge.send = sendGameEvent;

const invite = new URL(location.href).searchParams.get("room");
if (invite) { $("cd").value = codeKey(invite); notice("ইনভাইট রুম কোড পাওয়া গেছে—অনলাইনে ঢুকে যোগ দিন।", "ok"); }

onAuthStateChanged(auth, async next => {
  user = next || null;
  if (!user) { notice("লগইন করলে রুম তৈরি, কোড শেয়ার ও অনলাইন ম্যাচ খেলতে পারবেন。"); return; }
  if (invite && !roomCode) { showOnlinePanel(); await joinRoom(invite); }
});
