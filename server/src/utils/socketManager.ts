// server/src/utils/socketManager.ts
import { Server, Socket } from 'socket.io';
import type { Room as IRoom, User, ChatMessage, CursorPosition } from '../types';
import { Room as RoomModel } from '../models/Room';

class SocketManager {
  private rooms: Map<string, IRoom> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    console.log('🔌 SocketManager initialized with empty rooms map');
  }

  async joinRoom(roomId: string, socket: Socket, userName: string, avatar?: string): Promise<void> {
    console.log(`🔧 Joining room: ${roomId} for user: ${userName} (socket: ${socket.id})`);

    socket.join(roomId);

    // Check if room exists in memory
    let room = this.rooms.get(roomId);

    // If not in memory, fetch from DB
    if (!room) {
      console.log(`💾 Loading room from DB: ${roomId}`);
      const dbRoom = await RoomModel.findOne({ roomId });

      if (!dbRoom) {
        console.log(`❌ Room not found in DB: ${roomId}`);
        return; // Let caller handle error
      }

      // Create in-memory room from DB data
      room = {
        users: new Map(),
        code: dbRoom.code || '',
        language: dbRoom.language || 'javascript',
        createdAt: dbRoom.createdAt
      };
      this.rooms.set(roomId, room);
    }

    // Add user to room
    const user: User = {
      socketId: socket.id,
      userName,
      joinedAt: new Date(),
      avatar
    };

    room.users.set(socket.id, user);
    console.log(`👤 Added user to room ${roomId}: ${userName} (${socket.id})`);

    // Send current state to joining user
    socket.emit('code-update', {
      code: room.code,
      language: room.language
    });

    // Broadcast updated user list
    this.broadcastUsers(roomId);
  }

  leaveRoom(roomId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`👤 Removing user from room ${roomId}: ${socketId}`);
    room.users.delete(socketId);
    this.broadcastUsers(roomId);

    // Keep room alive for reconnection; don't delete when empty
    // if (room.users.size === 0) {
    //   console.log(`🗑️  Deleting empty room: ${roomId}`);
    //   this.rooms.delete(roomId);
    // }
  }

  public updateCode(roomId: string, code: string, userId: string, senderSocketId: string) {
    const room = this.getRoom(roomId);
    if (room) {
        // Find the user by the ID of the socket that sent the message
        const user = Array.from(room.users.values()).find(u => u.socketId === senderSocketId); // <-- FIXED
        if (user) {
            room.code = code;
            // Broadcast the change to everyone in the room
            this.io.to(roomId).emit('code-update', { roomId, code, userId: user.socketId });
        }
    }
}

  public updateLanguage(roomId: string, language: string, senderSocketId: string) {
    const room = this.getRoom(roomId);
    if (room) {
        const user = Array.from(room.users.values()).find(u => u.socketId === senderSocketId); // <-- FIXED
        if (user) {
            room.language = language;
            this.io.to(roomId).emit('language-update', language);
        }
    }
}

  broadcastUsers(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const users = Array.from(room.users.values()).map(user => ({
      socketId: user.socketId,
      userName: user.userName,
      joinedAt: user.joinedAt,
      avatar: user.avatar,
    }));

    console.log(`📢 Broadcasting users for ${roomId}: ${users.length} online`);
    this.io.to(roomId).emit('users-update', users);
  }

  broadcastMessage(roomId: string, message: ChatMessage): void {
    this.io.to(roomId).emit('new-message', {
      ...message,
      timestamp: message.timestamp.toISOString()
    });
  }

  broadcastCursorPosition(roomId: string, socketId: string, userName: string, position: CursorPosition): void {
    this.io.to(roomId).emit('cursor-update', {
      userId: socketId,
      position,
      userName
    });
  }

  getRoom(roomId: string): IRoom | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Map<string, IRoom> {
    return this.rooms;
  }

  // In-memory existence (not DB)
  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }
}

export default SocketManager;