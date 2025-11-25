// src/context/EditorContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface EditorContextType {
  roomId: string;
  setRoomId: (id: string) => void;
  code: string;
  setCode: (code: string) => void;
  users: any[];
  setUsers: (users: any[]) => void;
  currentUser: string;
  setCurrentUser: (user: string) => void;
  avatar: string;
  setAvatar: (url: string) => void;
  messages: any[];
  addMessage: (message: any) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
  const [roomId, setRoomId] = useState('');
  const [code, setCode] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [avatar, setAvatar] = useState(''); // <- NEW
  const [messages, setMessages] = useState([]);

  const addMessage = (message: any) => {
    setMessages((prev) => [...prev, message]);
  };

  return (
    <EditorContext.Provider
      value={{
        roomId,
        setRoomId,
        code,
        setCode,
        users,
        setUsers,
        currentUser,
        setCurrentUser,
        avatar,
        setAvatar,
        messages,
        addMessage,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};