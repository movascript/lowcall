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
});

const PORT = process.env.PORT || 3000;

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    const roomSize = rooms.get(roomId).size;
    console.log(`${socket.id} joined room ${roomId} (count: ${roomSize})`);

    if (roomSize === 2) {
      const usersInRoom = Array.from(rooms.get(roomId));
      const firstUser = usersInRoom[0];
      console.log(`Sending 'ready' to first user: ${firstUser}`);
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

  socket.on("leave-room", (roomId) => {
    console.log("User leaving room:", socket.id, roomId);
    socket.to(roomId).emit("user-disconnected");
    handleDisconnect(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    handleDisconnect(socket.id);
  });

  function handleDisconnect(socketId) {
    rooms.forEach((users, roomId) => {
      if (users.has(socketId)) {
        users.delete(socketId);
        socket.to(roomId).emit("user-disconnected");

        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
