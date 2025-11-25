export interface User {
  socketId: string;
  userName: string;
  joinedAt: Date;
  avatar?: string; 
}

export interface Room {
  users: Map<string, User>;
  code: string;
  language: string;
  createdAt: Date;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface ChatMessage {
  id: string;
  message: string;
  userName: string;
  timestamp: Date;
  userId: string;
  avatar?: string;
}

export interface SnippetData {
  roomId: string;
  title: string;
  code: string;
  language: string;
  savedBy: string;
}

export interface RoomData {
  roomId: string;
  name: string;
  code: string;
  language: string;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface SocketMessage {
  roomId: string;
  code?: string;
  language?: string;
  userId?: string;
  message?: string;
  userName?: string;
  position?: CursorPosition;
  timestamp?: string;
}