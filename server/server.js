const crypto = require("crypto");
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGINS = (
  process.env.CLIENT_ORIGIN ||
  "https://lowcall.ir,http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const io = socketIO(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"],
  },
  pingTimeout: 10000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;
const TURN_HOST = process.env.TURN_HOST || "lowcall.ir";
const TURN_SECRET = process.env.TURN_SECRET || "";
const DEBUG_TOKEN = process.env.DEBUG_TOKEN || "";

/** @type {Map<string, Map<string, string>>} roomId -> peerId -> socketId */
const rooms = new Map();

function allowCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && CLIENT_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

function isLocalRequest(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  );
}

function requireDebug(req, res, next) {
  if (DEBUG_TOKEN && req.query.token === DEBUG_TOKEN) return next();
  if (!DEBUG_TOKEN && isLocalRequest(req)) return next();
  res.status(403).json({ error: "forbidden" });
}

function isSocketAlive(socketId) {
  return io.sockets.sockets.has(socketId);
}

function evictDeadSockets(room, roomId) {
  for (const [peerId, socketId] of room) {
    if (!isSocketAlive(socketId)) {
      room.delete(peerId);
      console.log(`Evicted dead socket ${socketId} (${peerId}) from ${roomId}`);
    }
  }
}

function findRoomForSocket(socketId) {
  for (const [roomId, users] of rooms) {
    for (const [peerId, sid] of users) {
      if (sid === socketId) return { roomId, peerId, users };
    }
  }
  return null;
}

function handleDisconnect(socketId, notifyPeer = true) {
  const found = findRoomForSocket(socketId);
  if (!found) return;

  const { roomId, peerId, users } = found;
  if (users.get(peerId) !== socketId) return;

  users.delete(peerId);
  console.log(`Removed ${socketId} (${peerId}) from room ${roomId}`);

  if (notifyPeer) {
    io.to(roomId).emit("user-disconnected");
  }

  if (users.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
  }
}

function otherSocketId(room, socketId) {
  for (const sid of room.values()) {
    if (sid !== socketId) return sid;
  }
  return null;
}

function mintTurnCredential() {
  const ttl = 24 * 3600;
  const username = `${Math.floor(Date.now() / 1000) + ttl}:${crypto.randomBytes(4).toString("hex")}`;
  const credential = crypto
    .createHmac("sha1", TURN_SECRET)
    .update(username)
    .digest("base64");
  return { username, credential };
}

app.set("trust proxy", 1);
app.use(allowCors);

app.get("/ice", (req, res) => {
  const iceServers = [
    { urls: [`stun:${TURN_HOST}:3478`, "stun:stun3.l.google.com:3478"] },
  ];

  if (TURN_SECRET) {
    const { username, credential } = mintTurnCredential();
    iceServers.push(
      { urls: `turn:${TURN_HOST}:3478`, username, credential },
      { urls: `turns:${TURN_HOST}:5349`, username, credential },
    );
  } else {
    iceServers.push(
      {
        urls: `turn:${TURN_HOST}:3478`,
        username: "myuser",
        credential: "mypassword",
      },
      {
        urls: `turns:${TURN_HOST}:5349`,
        username: "myuser",
        credential: "mypassword",
      },
    );
  }

  res.json({
    iceServers,
    iceCandidatePoolSize: 2,
    bundlePolicy: "max-bundle",
    iceTransportPolicy: "all",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    timeStamp: Date.now(),
  });
});

app.get("/rooms", requireDebug, (req, res) => {
  const roomsInfo = {};
  rooms.forEach((users, roomId) => {
    roomsInfo[roomId] = {
      userCount: users.size,
      users: Array.from(users.entries()).map(([peerId, socketId]) => ({
        peerId,
        socketId,
      })),
    };
  });
  res.json({ totalRooms: rooms.size, rooms: roomsInfo });
});

app.get("/reset", requireDebug, (req, res) => {
  const stats = {
    roomsCleared: rooms.size,
    connectionsBeforeReset: io.engine.clientsCount,
  };
  io.sockets.sockets.forEach((socket) => socket.disconnect(true));
  rooms.clear();
  res.json({
    success: true,
    message: "All rooms cleared and connections reset",
    stats,
  });
});

io.on("connection", (socket) => {
  socket.on("join-room", (payload) => {
    const roomId = String(payload?.roomId || payload || "")
      .toLowerCase()
      .trim();
    const peerId = String(payload?.peerId || socket.id);

    if (!roomId || !/^[a-z0-9-]{1,32}$/.test(roomId)) {
      socket.emit("error-message", "Invalid room code");
      return;
    }

    handleDisconnect(socket.id, false);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    evictDeadSockets(room, roomId);

    const existingSocketId = room.get(peerId);
    if (existingSocketId && existingSocketId !== socket.id) {
      room.set(peerId, socket.id);
      socket.join(roomId);
      socket.currentRoom = roomId;
      socket.peerId = peerId;

      const stale = io.sockets.sockets.get(existingSocketId);
      if (stale) stale.disconnect(true);

      socket.emit("rejoined", { peers: room.size });
      return;
    }

    if (room.size >= 2 && !room.has(peerId)) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    room.set(peerId, socket.id);
    socket.currentRoom = roomId;
    socket.peerId = peerId;

    if (room.size === 2) {
      const sockets = Array.from(room.values());
      io.to(sockets[0]).emit("ready", { polite: false });
      io.to(sockets[1]).emit("ready", { polite: true });
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    roomId = String(roomId || "").toLowerCase();
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    roomId = String(roomId || "").toLowerCase();
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    roomId = String(roomId || "").toLowerCase();
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("audio-toggle", ({ roomId, enabled }) => {
    roomId = String(roomId || "").toLowerCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const other = otherSocketId(room, socket.id);
    if (other) io.to(other).emit("peer-audio-toggle", enabled);
  });

  socket.on("video-toggle", ({ roomId, enabled }) => {
    roomId = String(roomId || "").toLowerCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const other = otherSocketId(room, socket.id);
    if (other) io.to(other).emit("peer-video-toggle", enabled);
  });

  socket.on("screen-share", ({ roomId, enabled }) => {
    roomId = String(roomId || "").toLowerCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const other = otherSocketId(room, socket.id);
    if (other) io.to(other).emit("peer-screen-share", enabled);
  });

  socket.on("leave-room", (roomId) => {
    roomId = String(roomId || "").toLowerCase();
    socket.to(roomId).emit("user-disconnected");
    handleDisconnect(socket.id, false);
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket.id, true);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
