const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 10000,
  pingInterval: 10000,
});

const PORT = 3000;
const rooms = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSocketAlive(socketId) {
  return io.sockets.sockets.has(socketId);
}

function evictDeadSockets(room, roomId) {
  for (const socketId of room) {
    if (!isSocketAlive(socketId)) {
      room.delete(socketId);
      console.log(`Evicted dead socket ${socketId} from room ${roomId}`);
    }
  }
}

function handleDisconnect(socketId, notifyPeer = true) {
  rooms.forEach((users, roomId) => {
    if (!users.has(socketId)) return;

    users.delete(socketId);
    console.log(`Removed ${socketId} from room ${roomId}`);

    if (notifyPeer) {
      io.to(roomId).emit("user-disconnected");
    }

    if (users.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }
  });
}

// ─── Debug endpoints ──────────────────────────────────────────────────────────

app.get("/rooms", (req, res) => {
  const roomsInfo = {};
  rooms.forEach((users, roomId) => {
    roomsInfo[roomId] = {
      userCount: users.size,
      users: Array.from(users),
    };
  });
  res.json({ totalRooms: rooms.size, rooms: roomsInfo });
});

app.get("/reset", (req, res) => {
  const stats = {
    roomsCleared: rooms.size,
    connectionsBeforeReset: io.engine.clientsCount,
    roomDetails: {},
  };
  rooms.forEach((users, roomId) => {
    stats.roomDetails[roomId] = {
      userCount: users.size,
      users: Array.from(users),
    };
  });
  io.sockets.sockets.forEach((socket) => socket.disconnect(true));
  rooms.clear();
  console.log("Server reset - all rooms and connections cleared");
  res.json({
    success: true,
    message: "All rooms cleared and connections reset",
    stats,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    timeStamp: Date.now(),
  });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    roomId = roomId.toLowerCase();

    handleDisconnect(socket.id, false);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    evictDeadSockets(room, roomId);

    if (room.size >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    room.add(socket.id);
    socket.currentRoom = roomId;

    console.log(`${socket.id} joined room ${roomId} (count: ${room.size})`);

    if (room.size === 2) {
      const firstUser = Array.from(room)[0];
      io.to(firstUser).emit("ready");
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    roomId = roomId.toLowerCase();
    console.log("Offer from:", socket.id, "room:", roomId);
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    roomId = roomId.toLowerCase();
    console.log("Answer from:", socket.id, "room:", roomId);
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    roomId = roomId.toLowerCase();
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("ice-restart", ({ roomId }) => {
    roomId = roomId.toLowerCase();
    console.log("ICE restart requested by:", socket.id, "room:", roomId);
    socket.to(roomId).emit("ice-restart");
  });

  socket.on("audio-toggle", ({ roomId, enabled }) => {
    roomId = roomId.toLowerCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const other = Array.from(room).find((id) => id !== socket.id);
    if (other) io.to(other).emit("peer-audio-toggle", enabled);
  });

  socket.on("video-toggle", ({ roomId, enabled }) => {
    roomId = roomId.toLowerCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const other = Array.from(room).find((id) => id !== socket.id);
    if (other) io.to(other).emit("peer-video-toggle", enabled);
  });

  socket.on("leave-room", (roomId) => {
    roomId = roomId.toLowerCase();
    console.log("User leaving room:", socket.id, roomId);
    socket.to(roomId).emit("user-disconnected");
    handleDisconnect(socket.id, false);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    handleDisconnect(socket.id, true);
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Debug endpoint: http://localhost:${PORT}/rooms`);
});
