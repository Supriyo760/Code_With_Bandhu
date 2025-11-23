// server/src/server.ts

import express, { Express, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import SocketManager from './utils/socketManager';
import { v4 as uuidv4 } from 'uuid';
import { Room } from './models/Room';

// Routes
import roomRoutes from './routes/rooms';
import snippetRoutes from './routes/snippets';

dotenv.config();

const app: Express = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
  // Replace transports: ['websocket'] with this:
  transports: ['polling', 'websocket'], // Default fallback (more stable)
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// ---- SINGLE SOURCE OF TRUTH FOR ROOMS ----
const socketManager = new SocketManager(io);

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Log all events for debugging
  socket.onAny((event, ...args) => {
    console.log(`📡 [${socket.id}] Event:`, event, args[0] ?? '');
  });

  // CREATE ROOM — SAVE TO DB FIRST
socket.on('create-room', async ({ roomName, userName }) => {
  try {
    const newRoomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Create room in database (fixed model name)
    const dbRoom = await Room.create({
      roomId: newRoomId,
      name: roomName,
      createdBy: userName
    });

    // 2. Join via SocketManager (this will load from DB if needed)
    socket.join(newRoomId);
    await socketManager.joinRoom(newRoomId, socket, userName);

    // 3. Get users list from SocketManager
    const room = socketManager.getRoom(newRoomId);
    const users = room
      ? Array.from(room.users.values()).map((u) => ({
          socketId: u.socketId,
          userName: u.userName,
        }))
      : [];

    // 4. Send confirmation
    socket.emit('room-created', {
      roomId: newRoomId,
      users,
    });

    console.log(`✅ Room created and saved to DB: ${newRoomId}`);
  } catch (err) {
    console.error(`❌ Failed to create room: ${err instanceof Error ? err.message : String(err)}`);
    socket.emit('join-error', 'Failed to create room');
  }
});

  // JOIN ROOM
  socket.on('join-room', (data: { roomId: string; userName: string }) => {
    const { roomId, userName } = data;
    const rid = roomId.toUpperCase();

    console.log(`➡️  ${userName} is trying to join room ${rid}`);

    const room = socketManager.getRoom(rid);
    // console.log(
    //   '   Existing rooms:',
    //   Array.from(socketManager.getAllRooms().keys())
    // );

    if (!room) {
      console.log(`❌ Room not found: ${rid}`);
      socket.emit('join-error', 'Room not found!');
      return;
    }

    socket.join(rid);
    socketManager.joinRoom(rid, socket, userName);
    // Optionally emit a join-success event
    socket.emit('join-success');
    console.log(`✅ ${userName} joined room ${rid}`);
  });

  // CODE CHANGE
  socket.on('code-change', (data: { roomId: string; code: string; userId: string }) => {
    const { roomId, code, userId } = data;
    if (!roomId) return;
    socketManager.updateCode(roomId, code, userId);
  });

  // LANGUAGE CHANGE
  socket.on('language-change', (data: { roomId: string; language: string }) => {
    const { roomId, language } = data;
    if (!roomId || !language) return;
    socketManager.updateLanguage(roomId, language);
  });

  // CHAT MESSAGE
  socket.on('chat-message', (data: { roomId: string; message: string; userName: string }) => {
    const { roomId, message, userName } = data;
    if (!roomId || !message || !userName) return;

    socketManager.broadcastMessage(roomId, {
      id: uuidv4(),
      message,
      userName,
      timestamp: new Date(),
      userId: socket.id,
    });
  });

  // CURSOR POSITION (optional)
  socket.on('cursor-position', (data: { roomId: string; position: any; userName: string }) => {
    const { roomId, position, userName } = data;
    if (!roomId || !position) return;
    socketManager.broadcastCursorPosition(roomId, socket.id, userName, position);
  });

  // DISCONNECT
  socket.on('disconnect', () => {
  console.log(`❌ Client disconnected: ${socket.id}`);
  const rooms = socketManager.getAllRooms();
  rooms.forEach((room, roomId) => {
    if (room.users.has(socket.id)) {
      // Remove user, but don't delete room
      socketManager.leaveRoom(roomId, socket.id);
    }
  });
});
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/snippets', snippetRoutes);

// Debug endpoint to check rooms (visit http://localhost:5000/api/rooms)
app.get('/api/rooms', (req: Request, res: Response) => {
  const rooms = Array.from(socketManager.getAllRooms().keys());
  res.json({ 
    totalRooms: rooms.length,
    rooms: rooms 
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Server is running' });
});

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║     🚀 Server Running Successfully 🚀      ║
║                                            ║
║  📝 API: http://localhost:${PORT}              ║
║  🔗 WebSocket: ws://localhost:${PORT}         ║
╚════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

export { io, socketManager };