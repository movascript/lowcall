const { timeStamp } = require("console");
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

// ----------------------------------------- Debug endpoint -----------------------------------------

app.get("/rooms", (req, res) => {
  const roomsInfo = {};
  rooms.forEach((users, roomId) => {
    roomsInfo[roomId] = {
      userCount: users.size,
      users: Array.from(users),
    };
  });
  res.json({
    totalRooms: rooms.size,
    rooms: roomsInfo,
  });
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

  io.sockets.sockets.forEach((socket) => {
    socket.disconnect(true);
  });

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

// ----------------------------------------- SOCKET IO -----------------------------------------

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    // Clean up any previous room membership
    handleDisconnect(socket.id, false);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    if (room.size >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    room.add(socket.id);
    socket.currentRoom = roomId;

    console.log(`${socket.id} joined room ${roomId} (count: ${room.size})`);

    if (room.size === 2) {
      const usersInRoom = Array.from(room);
      const firstUser = usersInRoom[0];
      io.to(firstUser).emit("ready");
    }
  });

  socket.on("offer", (data) => {
    console.log("Offer received from:", socket.id, "to room:", data.roomId);
    socket.to(data.roomId).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    console.log("Answer received from:", socket.id, "to room:", data.roomId);
    socket.to(data.roomId).emit("answer", data.answer);
  });

  socket.on("ice-candidate", (data) => {
    console.log("ICE candidate received from:", socket.id);
    socket.to(data.roomId).emit("ice-candidate", data.candidate);
  });

  socket.on("audio-toggle", ({ roomId, enabled }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const otherUser = Array.from(room).find((id) => id !== socket.id);
    if (otherUser) {
      io.to(otherUser).emit("peer-audio-toggle", enabled);
    }
  });

  socket.on("video-toggle", ({ roomId, enabled }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const otherUser = Array.from(room).find((id) => id !== socket.id);
    if (otherUser) {
      io.to(otherUser).emit("peer-video-toggle", enabled);
    }
  });

  socket.on("leave-room", (roomId) => {
    console.log("User leaving room:", socket.id, roomId);
    socket.to(roomId).emit("user-disconnected");
    handleDisconnect(socket.id, true);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    handleDisconnect(socket.id, true);
  });

  socket.on("disconnecting", () => {
    console.log("User disconnecting:", socket.id);
    handleDisconnect(socket.id, true);
  });

  function handleDisconnect(socketId, notifyPeer = true) {
    rooms.forEach((users, roomId) => {
      if (users.has(socketId)) {
        users.delete(socketId);
        console.log(`Removed ${socketId} from room ${roomId}`);

        if (notifyPeer) {
          io.to(roomId).emit("user-disconnected");
        }

        if (users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  }
});

// ----------------------------------------- Server startup -----------------------------------------

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Debug endpoint: http://localhost:${PORT}/rooms`);
});
