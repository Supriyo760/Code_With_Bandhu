// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { Users, MessageSquare, Share2, Code2, LogIn, Plus } from 'lucide-react';
import { useEditor } from './context/EditorContext';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from './components/Avatar';

const AVATAR_OPTIONS = [
  '/avatars/avatar1.png',
  '/avatars/avatar2.png',
  '/avatars/avatar3.png',
  '/avatars/avatar4.png',
  '/avatars/avatar5.png',
  '/avatars/avatar6.png',
  '/avatars/avatar7.png',
  '/avatars/avatar8.png',
  '/avatars/avatar9.png',
  '/avatars/avatar10.png',
];

// All supported languages for Monaco
const ALL_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
];

function App() {
  const {
    roomId, setRoomId,
    code, setCode,
    users, setUsers,
    currentUser, setCurrentUser,
    avatar, setAvatar,
    messages, addMessage
  } = useEditor();

  const socketRef = useRef<Socket | null>(null);
  const [userName, setUserName] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [language, setLanguage] = useState('javascript');

  // UI state for join/create
  const [view, setView] = useState<'join' | 'create'>('create');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [roomNameForCreation, setRoomNameForCreation] = useState('');

  // Read ?room=... from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) setRoomIdToJoin(rid.toUpperCase());
  }, []);

  // Create Socket.IO connection once
  useEffect(() => {
    if (!socketRef.current) {
      const s = io('http://localhost:5000', {
        transports: ['polling', 'websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = s;
    }

    const s = socketRef.current;

    const onConnect = () => console.log('✅ Connected to server, socket id:', s!.id);
    const onConnectError = (err: any) => {
      console.error('❌ Socket connect_error:', err?.message || err);
      toast.error('Failed to connect to server');
    };
    const onCodeUpdate = (data: any) => {
      const isSelf = data.userId && data.userId === s!.id;
      if (!isSelf) {
        if (typeof data.code === 'string') setCode(data.code);
        if (data.language) setLanguage(data.language);
      }
    };
    const onLanguageUpdate = (newLanguage: string) => setLanguage(newLanguage);
    const onUsersUpdate = (usersList: any[]) => {
      setUsers(usersList);
      if (s && usersList.some((u) => u.socketId === s.id)) setIsJoined(true);
    };
    const onNewMessage = (msg: any) => addMessage(msg);
    const onRoomCreated = (data: { roomId: string; users: any[] }) => {
      setRoomId(data.roomId);
      setUsers(data.users);
      setCurrentUser((prev) => prev || userName);
      setIsJoined(true);

      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('room', data.roomId);
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);

      toast.success(`Room "${data.roomId}" created!`);
    };
    const onJoinError = (message: string) => {
      toast.error(message);
      setIsJoined(false);
    };
    const onJoinSuccess = () => {
      setIsJoined(true);
      toast.success(`Joined room ${roomIdToJoin}!`);
    };
    const onDisconnect = () => console.log('🔌 Disconnected from server');

    s!.on('connect', onConnect);
    s!.on('connect_error', onConnectError);
    s!.on('code-update', onCodeUpdate);
    s!.on('language-update', onLanguageUpdate);
    s!.on('users-update', onUsersUpdate);
    s!.on('new-message', onNewMessage);
    s!.on('room-created', onRoomCreated);
    s!.on('join-error', onJoinError);
    s!.on('join-success', onJoinSuccess);
    s!.on('disconnect', onDisconnect);

    return () => {
      s!.off('connect', onConnect);
      s!.off('connect_error', onConnectError);
      s!.off('code-update', onCodeUpdate);
      s!.off('language-update', onLanguageUpdate);
      s!.off('users-update', onUsersUpdate);
      s!.off('new-message', onNewMessage);
      s!.off('room-created', onRoomCreated);
      s!.off('join-error', onJoinError);
      s!.off('join-success', onJoinSuccess);
      s!.off('disconnect', onDisconnect);
    };
  }, [addMessage, roomIdToJoin, setCode, setUsers, setCurrentUser, setRoomId]);

  // Join existing room
  const joinRoom = () => {
    const s = socketRef.current;
    if (!userName.trim()) return toast.error('Enter your name!');
    if (!roomIdToJoin.trim()) return toast.error('Room ID is required!');
    if (!avatar) return toast.error('Please choose an avatar!');
    if (!s || !s.connected) return toast.error('Not connected to server yet');

    const rid = roomIdToJoin.toUpperCase();
    setRoomId(rid);
    setCurrentUser(userName);

    s.emit('join-room', { roomId: rid, userName, avatar });
  };

  // Create new room
  const handleCreateRoom = () => {
    const s = socketRef.current;
    if (!userName.trim()) return toast.error('Enter your name!');
    if (!roomNameForCreation.trim()) return toast.error('Enter a room name!');
    if (!avatar) return toast.error('Please choose an avatar!');
    if (!s || !s.connected) return toast.error('Not connected to server yet');

    setCurrentUser(userName);
    s.emit('create-room', { roomName: roomNameForCreation, userName, avatar });
  };

  // Send chat message
  const sendMessage = () => {
    const s = socketRef.current;
    if (!inputMessage.trim()) return;
    if (!s || !roomId) return;

    s.emit('chat-message', {
      roomId,
      message: inputMessage,
      userName: currentUser || userName || 'Anonymous',
      avatar,
    });
    setInputMessage('');
  };

  // Copy room link
  const copyLink = () => {
    if (!roomId) return toast.error('No room ID available');
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Room link copied!');
  };

  // ------------- LOGIN / ROOM SELECTION SCREEN -------------
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-2xl bg-black/40 backdrop-blur-xl border border-purple-500/20 p-8"
        >
          <h1 className="text-2xl font-bold text-center mb-6 text-white">
            CollabCode
          </h1>

          <AnimatePresence mode="wait">
            {view === 'join' ? (
              <motion.div key="join" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-lg font-semibold mb-4 text-purple-300">Join a Room</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg focus:ring-purple-500 text-white"
                  />

                  {/* Avatar Selection */}
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Choose an avatar:</p>
                    <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                      {AVATAR_OPTIONS.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAvatar(url)}
                          className={`rounded-full border p-0.5 transition-transform ${
                            avatar === url
                              ? 'border-purple-500 ring-2 ring-purple-500 scale-105'
                              : 'border-transparent hover:border-slate-500 hover:scale-105'
                          }`}
                        >
                          <img
                            src={url}
                            alt="avatar"
                            className="rounded-full object-cover"
                            style={{ width: 56, height: 56 }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={roomIdToJoin}
                    onChange={(e) => setRoomIdToJoin(e.target.value.toUpperCase())}
                    placeholder="Room ID"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg font-mono text-center text-lg focus:ring-purple-500 text-white"
                  />
                  <button
                    onClick={joinRoom}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <LogIn size={18} /> Join Room
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="create" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-lg font-semibold mb-4 text-purple-300">Create a Room</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg focus:ring-purple-500 text-white"
                  />

                  {/* Avatar Selection */}
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Choose an avatar:</p>
                    <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                      {AVATAR_OPTIONS.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAvatar(url)}
                          className={`rounded-full border p-0.5 transition-transform ${
                            avatar === url
                              ? 'border-purple-500 ring-2 ring-purple-500 scale-105'
                              : 'border-transparent hover:border-slate-500 hover:scale-105'
                          }`}
                        >
                          <img
                            src={url}
                            alt="avatar"
                            className="rounded-full object-cover"
                            style={{ width: 56, height: 56 }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={roomNameForCreation}
                    onChange={(e) => setRoomNameForCreation(e.target.value)}
                    placeholder="Room Name (e.g., My Awesome Project)"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg focus:ring-purple-500 text-white"
                  />
                  <button
                    onClick={handleCreateRoom}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> Create Room
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              {view === 'join' ? "Don't have a room?" : 'Already have a room?'}
              <button
                onClick={() => setView(view === 'join' ? 'create' : 'join')}
                className="font-semibold text-purple-400 hover:text-purple-300 ml-1"
              >
                {view === 'join' ? 'Create one' : 'Join one'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ------------- MAIN EDITOR / WORKSPACE SCREEN -------------
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050816] text-white overflow-y-auto">
      <Toaster position="top-right" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(129,140,248,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(244,114,182,0.1),transparent_55%)] opacity-80" />

      <header className="relative z-20 flex items-center justify-between border-b border-purple-500/30 bg-black/60 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/40"
          >
            <Code2 className="h-5 w-5" />
          </motion.div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide uppercase text-slate-200/90">NebulaLab</h1>
            <p className="text-[11px] text-slate-400">
              Room <span className="font-mono text-purple-300">{roomId}</span>
            </p>
          </div>

          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value;
              setLanguage(newLang);
              const s = socketRef.current;
              if (s && roomId) {
                s.emit('language-change', { roomId, language: newLang });
              }
            }}
            className="ml-4 rounded-full border border-purple-500/40 bg-slate-950/80 px-4 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/70"
          >
            {ALL_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <motion.button
          onClick={copyLink}
          whileHover={{ scale: 1.05, boxShadow: '0 0 12px rgba(59,130,246,0.6)' }}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-1.5 text-xs font-semibold shadow-md shadow-blue-500/40"
        >
          <Share2 className="h-4 w-4" />
          <span>Share link</span>
        </motion.button>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="relative flex-1 p-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full overflow-hidden rounded-2xl border border-purple-500/30 bg-black/60 shadow-[0_0_40px_rgba(129,140,248,0.25)]"
          >
            <Editor
              height="100%"
              width="100%"
              language={language}
              value={code}
              onChange={(value) => {
                const s = socketRef.current;
                if (value !== undefined) {
                  setCode(value);
                  if (s && roomId) {
                    s.emit('code-change', { roomId, code: value, userId: s.id });
                  }
                }
              }}
              theme="vs-dark"
              options={{
                fontSize: 15,
                minimap: { enabled: true },
                wordWrap: 'on',
                automaticLayout: true,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </motion.div>
        </div>

        {/* Sidebar – Users + Chat */}
        <motion.div
          initial={{ x: 260 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}
          className="flex w-80 flex-col border-l border-purple-500/30 bg-black/70 backdrop-blur-2xl h-full"
        >
          {/* Users */}
          <div className="border-b border-purple-500/30 px-4 py-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-200">
              <Users className="h-4 w-4 text-green-400" />
              Online ({users.length})
            </h3>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {users.map((user: any) => (
                <motion.div
                  key={user.socketId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-slate-900/80 px-3 py-2 text-xs"
                >
                  <img
                    src={user.avatar || '/avatars/avatar1.png'}
                    alt={user.userName}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                  />
                  <span className="text-slate-100 truncate">
                    {user.userName} {user.socketId === socketRef.current?.id ? '(You)' : ''}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-purple-500/30 px-3 py-2 text-xs font-semibold text-blue-200">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              Room Chat
            </div>

            {/* Scrollable Messages - using fixed max-height relative to viewport height */}
            <div
              className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-xs"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              {messages.map((msg: any) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 my-1 pr-1"
                >
                  <img
                    src={msg.avatar || '/avatars/avatar1.png'}
                    alt={msg.userName}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 24, height: 24 }}
                  />
                  <div
                    className={`rounded-lg border px-3 py-2 text-left ${
                      msg.userId === socketRef.current?.id
                        ? 'border-blue-500/40 bg-blue-600/70'
                        : 'border-slate-600/60 bg-slate-800/80'
                    }`}
                    style={{
                      maxWidth: 'calc(100% - 60px)',
                      wordWrap: 'break-word',
                    }}
                  >
                    <p className="mb-0.5 text-[10px] font-bold opacity-80">{msg.userName}</p>
                    <p className="text-[11px] break-words">{msg.message}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 border-t border-purple-500/30 px-2 py-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-blue-500/40 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              />
              <motion.button
                onClick={sendMessage}
                whileHover={{ scale: 1.05 }}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold shadow shadow-blue-500/40"
              >
                Send
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;