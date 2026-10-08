import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
const srv = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(srv, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] }
});

app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static('public'));
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'shakil-m-game-voice' }));

const rooms = new Map();
let nextRoomId = 1;

const clean = (value, fallback, max) => {
  const text = String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
  return text || fallback;
};
const roomView = (room) => ({
  id: room.id,
  name: room.name,
  o: room.ownerName,
  e: '🎙️',
  n: room.members.size,
  pw: Boolean(room.password),
  owner: room.owner,
  cat: 'লাইভ',
  seats: room.seats,
  lock: room.lock,
  chat: room.chat.slice(-60)
});
const broadcastRooms = () => io.emit('rooms', [...rooms.values()].map(roomView));
const addChat = (room, text) => {
  room.chat.push(clean(text, '', 300));
  if (room.chat.length > 200) room.chat.shift();
};

app.get('/token', async (req, res) => {
  const { room, name, id } = req.query;
  const socket = io.sockets.sockets.get(String(id || ''));
  if (!socket || String(socket.data.room) !== String(room)) {
    return res.status(403).json({ error: 'not in room' });
  }
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: 'LiveKit is not configured' });
  }
  try {
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: String(id),
      name: clean(name, 'user', 30)
    });
    token.addGrant({ roomJoin: true, room: `r${room}`, canPublish: true, canSubscribe: true });
    return res.json({ token: await token.toJwt(), url: process.env.LIVEKIT_URL });
  } catch {
    return res.status(500).json({ error: 'could not create voice token' });
  }
});

function leaveRoom(socket) {
  const room = rooms.get(socket.data.room);
  if (!room) return;
  room.members.delete(socket.id);
  room.seats = room.seats.map((seat) => seat && seat.sid === socket.id ? null : seat);
  if (!room.members.size) rooms.delete(room.id);
  else if (room.owner === socket.id) {
    room.owner = [...room.members][0];
    room.ownerName = io.sockets.sockets.get(room.owner)?.data.n || 'ইউজার';
  }
  socket.data.room = null;
}

function enter(socket, room, name) {
  leaveRoom(socket);
  socket.data.room = room.id;
  socket.data.n = clean(name, 'ইউজার', 20);
  room.members.add(socket.id);
  if (!room.ownerName) room.ownerName = socket.data.n;
  addChat(room, `✨ ${socket.data.n} রুমে এসেছেন`);
}

io.on('connection', (socket) => {
  socket.emit('rooms', [...rooms.values()].map(roomView));
  const current = () => rooms.get(socket.data.room);

  socket.on('create', (payload = {}, ack) => {
    const id = nextRoomId++;
    const capacity = Math.min(12, Math.max(4, Number(payload.sc) || 8));
    const room = {
      id,
      name: clean(payload.name, 'রুম', 30),
      ownerName: clean(payload.n, 'ইউজার', 20),
      owner: socket.id,
      password: String(payload.pw || '').slice(0, 40),
      seats: Array(capacity).fill(null),
      lock: {},
      chat: [],
      members: new Set(),
      blocked: new Set()
    };
    rooms.set(id, room);
    enter(socket, room, payload.n);
    if (typeof ack === 'function') ack(id);
    broadcastRooms();
  });

  socket.on('join', (payload = {}, ack) => {
    const room = rooms.get(Number(payload.id));
    const allowed = room && !room.blocked.has(socket.id) &&
      (!room.password || room.owner === socket.id || String(payload.pw || '') === room.password);
    if (!allowed) return typeof ack === 'function' && ack(false);
    enter(socket, room, payload.n);
    if (typeof ack === 'function') ack(true);
    broadcastRooms();
  });

  socket.on('leave', () => { leaveRoom(socket); broadcastRooms(); });

  socket.on('seat', ({ i } = {}) => {
    const room = current();
    const index = Number(i);
    if (!room || !Number.isInteger(index)) return;
    const mine = room.seats.findIndex((seat) => seat && seat.sid === socket.id);
    if (index < 0) {
      if (mine >= 0) room.seats[mine] = null;
    } else if (index < room.seats.length && room.seats[index] === null && !room.lock[index]) {
      if (mine >= 0) room.seats[mine] = null;
      room.seats[index] = { sid: socket.id, n: socket.data.n, e: '😎', m: 1 };
    }
    broadcastRooms();
  });

  socket.on('mute', (value) => {
    const room = current();
    const seat = room?.seats.find((item) => item && item.sid === socket.id);
    if (seat) { seat.m = value ? 1 : 0; broadcastRooms(); }
  });

  socket.on('chat', ({ t } = {}) => {
    const room = current();
    if (room && t) { addChat(room, `${socket.data.n}: ${t}`); broadcastRooms(); }
  });

  socket.on('gift', ({ g } = {}) => {
    const room = current();
    if (room && g) { addChat(room, `🎁 ${socket.data.n} পাঠালেন ${g}`); broadcastRooms(); }
  });

  socket.on('lock', (i) => {
    const room = current();
    const index = Number(i);
    if (room && room.owner === socket.id && Number.isInteger(index) && index >= 0 && index < room.seats.length) {
      room.lock[index] = !room.lock[index];
      broadcastRooms();
    }
  });

  socket.on('kick', (i) => {
    const room = current();
    const index = Number(i);
    const target = room && room.seats[index];
    if (!room || room.owner !== socket.id || !target || target.sid === socket.id) return;
    room.seats[index] = null;
    io.to(target.sid).emit('kicked');
    broadcastRooms();
  });

  socket.on('block', (i) => {
    const room = current();
    const index = Number(i);
    const target = room && room.seats[index];
    if (!room || room.owner !== socket.id || !target || target.sid === socket.id) return;
    room.blocked.add(target.sid);
    room.seats[index] = null;
    io.to(target.sid).emit('blocked');
    broadcastRooms();
  });

  socket.on('disconnect', () => { leaveRoom(socket); broadcastRooms(); });
});

const port = Number(process.env.PORT) || 3000;
srv.listen(port, () => console.log(`voice room listening on ${port}`));
