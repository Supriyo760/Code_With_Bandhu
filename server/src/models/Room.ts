// server/src/models/Room.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  name: string;
  code: string;
  language: string;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

const roomSchema = new Schema<IRoom>({
  roomId: {
    type: String,
    required: [true, 'Room ID is required'],
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Room name is required']
  },
  code: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'javascript',
    enum: [
      'javascript', 'typescript', 'python', 'java', 'cpp', 
      'csharp', 'php', 'ruby', 'go', 'rust', 'html', 'css', 'sql'
    ]
  },
  createdBy: {
    type: String,
    required: [true, 'Creator username is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
});

roomSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

export const Room = mongoose.model<IRoom>('Room', roomSchema);