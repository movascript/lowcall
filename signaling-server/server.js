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

// Store rooms and users
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Join room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    const roomSize = rooms.get(roomId).size;
    console.log(`${socket.id} joined room ${roomId} (count: ${roomSize})`);

    // If second user joined, tell the first user to start
    if (roomSize === 2) {
      const usersInRoom = Array.from(rooms.get(roomId));
      const firstUser = usersInRoom[0];
      console.log(`Sending 'ready' to first user: ${firstUser}`);
      io.to(firstUser).emit("ready");
    }
  });

  // Send offer
  socket.on("offer", (data) => {
    console.log("Offer received from:", socket.id, "to room:", data.roomId);
    socket.to(data.roomId).emit("offer", data.offer);
  });

  // Send answer
  socket.on("answer", (data) => {
    console.log("Answer received from:", socket.id, "to room:", data.roomId);
    socket.to(data.roomId).emit("answer", data.answer);
  });

  // Send ICE candidate
  socket.on("ice-candidate", (data) => {
    console.log("ICE candidate received from:", socket.id);
    socket.to(data.roomId).emit("ice-candidate", data.candidate);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit("user-disconnected");

        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// Serve static files
app.use(express.static("public"));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
