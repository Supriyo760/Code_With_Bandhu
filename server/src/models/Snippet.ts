import mongoose, { Schema, Document } from 'mongoose';

export interface ISnippet extends Document {
  roomId: string;
  title: string;
  code: string;
  language: string;
  savedBy: string;
  createdAt: Date;
}

const snippetSchema = new Schema<ISnippet>({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'javascript',
    enum: [
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'csharp',
      'php',
      'ruby',
      'go',
      'rust',
      'html',
      'css',
      'sql'
    ]
  },
  savedBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

export const Snippet = mongoose.model<ISnippet>('Snippet', snippetSchema);