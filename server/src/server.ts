// server/src/server.ts

import express, { Express, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import SocketManager from './utils/socketManager';
import { v4 as uuidv4 } from 'uuid';

// IMPORTANT: rename model import to avoid confusion with in-memory Room type
import { Room as RoomModel } from './models/Room';

// Types (only for hints)
import type { User } from './types';

// REST routes
import runRoutes from './routes/run';
import roomRoutes from './routes/rooms';
import snippetRoutes from './routes/snippets';

// Minimal typings for WebRTC signalling payloads (server only forwards JSON)
type RTCSessionDescriptionInitLike = { type?: string; sdp?: string };
type RTCIceCandidateInitLike = { candidate?: string; sdpMLineIndex?: number | null; sdpMid?: string | null };

dotenv.config();

const app: Express = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
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
type RoomState = {
  language: string;
  output: string;
};

const roomState = new Map<string, RoomState>();

// ---------------- Socket.IO connection handlers ----------------
io.on('connection', (socket: Socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on(
  'run-output',
  (data: { roomId: string; output: string; language: string }) => {
    const { roomId, output, language } = data;
    console.log(`run-output from ${socket.id} in room ${roomId}`);
    io.to(roomId).emit('run-output', { output, language });

  // 👇 Persist in roomState
      const prev = roomState.get(roomId) || { language, output };
      prev.language = language;
      prev.output = output;
      roomState.set(roomId, prev);

  }
);

socket.on('get-call-peers', (roomId: string) => {
    const callRoom = `${roomId}-call`;
    const peers = io.sockets.adapter.rooms.get(callRoom);
    if (peers) {
        // Send list of existing peers to the new caller
        socket.emit('call-peers-list', Array.from(peers).filter(id => id !== socket.id));
    }
});
  
  // CREATE ROOM — save to DB first, then join in-memory room
  socket.on(
    'create-room',
    async ({
      roomName,
      userName,
      avatar,
    }: {
      roomName: string;
      userName: string;
      avatar?: string;
    }) => {
      try {
        const newRoomId = Math.random().toString(36).substring(2, 10).toUpperCase();

        await RoomModel.create({
          roomId: newRoomId,
          name: roomName,
          createdBy: userName,
        });

        // 👇 ADD THIS
        roomState.set(newRoomId, {
          language: 'javascript', // default
          output: '',             // no output yet
        });

        socket.join(newRoomId);
        await socketManager.joinRoom(newRoomId, socket, userName, avatar);

        const room = socketManager.getRoom(newRoomId);
        const users = room
          ? Array.from(room.users.values()).map((u: any) => ({
              socketId: u.socketId,
              userName: u.userName,
              joinedAt: u.joinedAt,
              avatar: u.avatar,
            }))
          : [];

        socket.emit('room-created', { roomId: newRoomId, users });
        console.log(`✅ Room created and saved to DB: ${newRoomId}`);
      } catch (err) {
        console.error(
          `❌ Failed to create room: ${err instanceof Error ? err.message : String(err)}`
        );
        socket.emit('join-error', 'Failed to create room');
      }
    }
  );

  // JOIN ROOM — check existence (in memory or DB), then join once
  socket.on(
    'join-room',
    async ({
      roomId,
      userName,
      avatar,
    }: {
      roomId: string;
      userName: string;
      avatar?: string;
    }) => {
      const rid = roomId.toUpperCase();
      console.log(`➡️  ${userName} is trying to join room ${rid}`);

      const existsInMemory = socketManager.getRoom(rid);
      const existsInDb =
        existsInMemory ? true : !!(await RoomModel.findOne({ roomId: rid }));

      if (!existsInDb) {
        console.log(`❌ Room not found: ${rid}`);
        socket.emit('join-error', 'Room not found!');
        return;
      }

      socket.join(rid);
      await socketManager.joinRoom(rid, socket, userName, avatar);

      // 👇 NEW: send current language & last output to this socket
      const state = roomState.get(rid);
      if (state) {
        // Current language
        socket.emit('language-update', state.language);

        // Last output, if any
        if (state.output) {
          socket.emit('run-output', {
            output: state.output,
            language: state.language,
          });
        }
      }

      socket.emit('join-success');
      console.log(`✅ ${userName} joined room ${rid}`);
    }
  );

  // CODE CHANGE
  socket.on('code-change', (data: { roomId: string; code: string; userId: string }) => {
    const { roomId, code, userId } = data;
    if (!roomId) return;
    socketManager.updateCode(roomId, code, userId, socket.id);
  });

  // LANGUAGE CHANGE
  socket.on('language-change', (data: { roomId: string; language: string }) => {
    const { roomId, language } = data;
    if (!roomId || !language) return;
    socketManager.updateLanguage(roomId, socket.id, language);
    io.to(roomId).emit('language-update', language);

  // 👇 Persist in roomState
    const prev = roomState.get(roomId) || { language, output: '' };
    prev.language = language;
    roomState.set(roomId, prev);

  });

  // CHAT MESSAGE
  socket.on(
    'chat-message',
    (data: { roomId: string; message: string; userName: string; avatar?: string }) => {
      const { roomId, message, userName, avatar } = data;
      if (!roomId || !message || !userName) return;

      socketManager.broadcastMessage(roomId, {
        id: uuidv4(),
        message,
        userName,
        timestamp: new Date(),
        userId: socket.id,
        avatar,
      });
    }
  );

  // CURSOR POSITION (optional)
  socket.on(
    'cursor-position',
    (data: { roomId: string; position: any; userName: string }) => {
      const { roomId, position, userName } = data;
      if (!roomId || !position) return;
      socketManager.broadcastCursorPosition(roomId, socket.id, userName, position);
    }
  );

  // --- WebRTC video call signalling (server only relays JSON) ---
  socket.on('join-call', (roomId: string) => {
    const callRoom = `${roomId}-call`;
    socket.join(callRoom);
    socket.to(callRoom).emit('user-joined-call', socket.id);
  });

  socket.on(
    'webrtc-offer',
    (data: { roomId: string; to: string; offer: RTCSessionDescriptionInitLike }) => {
      socket.to(data.to).emit('webrtc-offer', { from: socket.id, offer: data.offer });
    }
  );

  socket.on(
    'webrtc-answer',
    (data: { roomId: string; to: string; answer: RTCSessionDescriptionInitLike }) => {
      socket.to(data.to).emit('webrtc-answer', { from: socket.id, answer: data.answer });
    }
  );

  socket.on(
    'webrtc-ice-candidate',
    (data: { roomId: string; to: string; candidate: RTCIceCandidateInitLike }) => {
      socket.to(data.to).emit('webrtc-ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    }
  );

  socket.on('leave-call', (roomId: string) => {
    socket.to(roomId).emit('user-left-call', socket.id);
    
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    const rooms = socketManager.getAllRooms();
    rooms.forEach((room: any, roomId: string) => {
      if (room.users.has(socket.id)) {
        socketManager.leaveRoom(roomId, socket.id);
      }
    });
  });
});

// ---------------- API Routes ----------------
app.use('/api/rooms', roomRoutes);
app.use('/api/snippets', snippetRoutes);
app.use('/api/run', runRoutes);

// Debug endpoint (avoid clashing with /api/rooms router)
app.get('/api/debug/rooms', (req: Request, res: Response) => {
  const rooms = Array.from(socketManager.getAllRooms().keys());
  res.json({ totalRooms: rooms.length, rooms });
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