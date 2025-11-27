// src/App.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import {
  Users,
  MessageSquare,
  Share2,
  Code2,
  LogIn,
  Plus,
  Video as VideoIcon,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEditor } from './context/EditorContext';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
// import Avatar from './components/Avatar';

// Pick backend URL based on env (dev vs prod)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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

// STUN server for WebRTC (for demo / dev)
const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// ----------- Video Tile Component -------------
interface VideoTileProps {
  stream: MediaStream;
  label: string;
  isLocal: boolean;
  speakerEnabled: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  label,
  isLocal,
  speakerEnabled,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-purple-500/50 bg-black/50 aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || !speakerEnabled}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] px-2 py-0.5 text-white font-semibold">
        {label}
      </div>
    </div>
  );
};
// ------------------------------------------------

function App() {
  const {
    roomId,
    setRoomId,
    users,
    setUsers,
    currentUser,
    setCurrentUser,
    avatar,
    setAvatar,
    messages,
    addMessage,
  } = useEditor();

  const socketRef = useRef<Socket | null>(null);

  const [userName, setUserName] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [language, setLanguage] = useState('javascript');

  const [view, setView] = useState<'join' | 'create'>('create');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [roomNameForCreation, setRoomNameForCreation] = useState('');

  // Judge0 runner
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  // Video call state
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{
    [socketId: string]: MediaStream;
  }>({});
  const peerConnections = useRef<{
    [socketId: string]: RTCPeerConnection;
  }>({});

  // Media toggles
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

const [code, setCode] = useState<string>('');
// A "safety net" function to prevent setting code to an object
const safeSetCode = (newCode: any) => {
  if (typeof newCode === 'string') {
    setCode(newCode);
  } else {
    // If it's not a string, log an error and do nothing.
    // This prevents the "Objects are not valid as a React child" crash.
    console.error("❌ Invalid data received for 'code' state. Expected a string, but got:", newCode);
  }
};

  // ---------- URL Room handling ----------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) setRoomIdToJoin(rid.toUpperCase());
  }, []);

  // ---------- Core Socket.IO setup ----------
  useEffect(() => {
    if (!socketRef.current) {
      const s = io(API_BASE_URL, {
        transports: ['polling', 'websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = s;
    }

    const s = socketRef.current;
    if (!s) return;

    const onConnect = () =>
      console.log('✅ Connected to server, socket id:', s.id);
    const onConnectError = (err: any) => {
      console.error('❌ Socket connect_error:', err?.message || err);
      toast.error('Failed to connect to server');
    };

    const onCodeUpdate = (data: {
      roomId: string;
      code: string;
      userId: string;
    }) => {
      const isSelf = data.userId === s.id;
      if (!isSelf && typeof data.code === 'string') {
        safeSetCode(data.code);
      }
    };

    const onLanguageUpdate = (newLanguage: string) => {
      setLanguage(newLanguage);
    };

    const onUsersUpdate = (usersList: any[]) => {
      setUsers(usersList);
      if (usersList.some((u) => u.socketId === s.id)) {
        setIsJoined(true);
      }
    };

    const onNewMessage = (msg: any) => addMessage(msg);

    const onRoomCreated = (data: { roomId: string; users: any[] }) => {
      setRoomId(data.roomId);
      setUsers(data.users);
      setCurrentUser((prev) => prev || userName);
      setIsJoined(true);

      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('room', data.roomId);
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${urlParams}`,
      );

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

    const onDisconnect = () => {
      console.log('🔌 Disconnected from server');
      // We keep editor state; the user can refresh to reconnect.
    };

    s.on('connect', onConnect);
    s.on('connect_error', onConnectError);
    s.on('code-update', onCodeUpdate);
    s.on('language-update', onLanguageUpdate);
    s.on('users-update', onUsersUpdate);
    s.on('new-message', onNewMessage);
    s.on('room-created', onRoomCreated);
    s.on('join-error', onJoinError);
    s.on('join-success', onJoinSuccess);
    s.on('disconnect', onDisconnect);

    return () => {
      s.off('connect', onConnect);
      s.off('connect_error', onConnectError);
      s.off('code-update', onCodeUpdate);
      s.off('language-update', onLanguageUpdate);
      s.off('users-update', onUsersUpdate);
      s.off('new-message', onNewMessage);
      s.off('room-created', onRoomCreated);
      s.off('join-error', onJoinError);
      s.off('join-success', onJoinSuccess);
      s.off('disconnect', onDisconnect);
    };
  }, [addMessage, roomIdToJoin, safeSetCode, setUsers, setCurrentUser, setRoomId, userName]);

  // ---------- WebRTC helper ----------
  const createPeerConnection = useCallback(
    (otherSocketId: string) => {
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnections.current[otherSocketId] = pc;

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStreams((prev) => ({
          ...prev,
          [otherSocketId]: remoteStream,
        }));
      };

      pc.onicecandidate = (event) => {
        const s = socketRef.current;
        if (event.candidate && s && roomId) {
          s.emit('webrtc-ice-candidate', {
            roomId,
            to: otherSocketId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      return pc;
    },
    [localStream, roomId],
  );

  // ---------- WebRTC signalling listeners ----------
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    // In App.tsx useEffect (client signalling setup)

const onCallPeersList = (peerIds: string[]) => {
    if (!localStream || !roomId) return;
    
    // For every peer already in the room, initiate an offer
    peerIds.forEach(peerId => {
        // Avoid re-creating if they somehow reconnected
        if (!peerConnections.current[peerId]) { 
            const pc = createPeerConnection(peerId);

            // Since *I* initiated this connection, I send the offer
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                s.emit('webrtc-offer', { roomId, to: peerId, offer });
              });
        }
    });
};
s.on('call-peers-list', onCallPeersList);
// ... remember to add s.off('call-peers-list', onCallPeersList) in cleanup

    const onUserJoinedCall = async (otherSocketId: string) => {
    // Check if *we* have an active local stream OR if the new person is the broadcaster
    // We will always try to create a connection if we detect a new peer.
    
    if (!roomId || !s) return;
    
    // --- CRUCIAL CHECK ---
    // Only create connection if we aren't already connected to them
    if (peerConnections.current[otherSocketId]) {
        console.log(`Already peering with ${otherSocketId}`);
        return;
    }

    const pc = createPeerConnection(otherSocketId);

    // If I am the broadcaster (I have localStream), I create the offer and send it
    if (localStream) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('webrtc-offer', { roomId, to: otherSocketId, offer });
    } 
    // If I am a VIEWER (localStream is null), I just wait for an offer back.
    // The broadcaster (who has localStream) must send the offer first.
};


    const onWebrtcOffer = async (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!roomId) return;
      const pc = createPeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      s.emit('webrtc-answer', {
        roomId,
        to: data.from,
        answer,
      });
    };

    const onWebrtcAnswer = async (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnections.current[data.from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    const onWebrtcIceCandidate = async (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnections.current[data.from];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate', err);
      }
    };

    const onUserLeftCall = (otherSocketId: string) => {
      const pc = peerConnections.current[otherSocketId];
      if (pc) {
        pc.close();
        delete peerConnections.current[otherSocketId];
      }
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[otherSocketId];
        return copy;
      });
    };

    const onRunOutput = (data: { output: string; language: string }) => {
  console.log('Received run-output payload:', data);
  setOutput(data.output);
  setLanguage(data.language);
  // optional: sync language if you want:
  // setLanguage(data.language);
};

    s.on('user-joined-call', onUserJoinedCall);
    s.on('webrtc-offer', onWebrtcOffer);
    s.on('webrtc-answer', onWebrtcAnswer);
    s.on('webrtc-ice-candidate', onWebrtcIceCandidate);
    s.on('user-left-call', onUserLeftCall);
    s.on('run-output', onRunOutput);

    return () => {
      s.off('user-joined-call', onUserJoinedCall);
      s.off('webrtc-offer', onWebrtcOffer);
      s.off('webrtc-answer', onWebrtcAnswer);
      s.off('webrtc-ice-candidate', onWebrtcIceCandidate);
      s.off('user-left-call', onUserLeftCall);
      s.off('call-peers-list', onCallPeersList);
      s.off('run-output', onRunOutput);
    };
  }, [localStream, roomId, createPeerConnection]);

  // ---------- Video Call Controls ----------
  const startCall = async () => {
    const s = socketRef.current;
    if (!roomId || !s) {
      toast.error('Join a room first');
      return;
    }
    if (inCall) {
      toast('Already in call');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setInCall(true);
      setVideoEnabled(true);
      setAudioEnabled(true);
      setSpeakerEnabled(true);

    
      
      s.emit('join-call', roomId);
      // NEW: Ask who is already in the signalling room so I can offer them immediately
    s.emit('get-call-peers', roomId); 
    } catch (err: any) {
      console.error('getUserMedia error', err);
      toast.error('Could not access camera/microphone: ' + err.name);
    }
  };

  const leaveCall = () => {
    const s = socketRef.current;
    if (!inCall || !s) return;

    s.emit('leave-call', roomId);

    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStreams({});
    setInCall(false);
    setVideoEnabled(true);
    setAudioEnabled(true);
    setSpeakerEnabled(true);
  };

  const toggleVideo = () => {
    if (!localStream) {
      toast.error('Not in a call');
      return;
    }
    const newEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = newEnabled;
    });
    setVideoEnabled(newEnabled);
  };

  const toggleAudio = () => {
    if (!localStream) {
      toast.error('Not in a call');
      return;
    }
    const newEnabled = !audioEnabled;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = newEnabled;
    });
    setAudioEnabled(newEnabled);
  };

  const toggleSpeaker = () => {
    const newEnabled = !speakerEnabled;
    setSpeakerEnabled(newEnabled);
  };

  // ---------- Room join/create ----------
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

  const handleCreateRoom = () => {
    const s = socketRef.current;
    if (!userName.trim()) return toast.error('Enter your name!');
    if (!roomNameForCreation.trim())
      return toast.error('Enter a room name!');
    if (!avatar) return toast.error('Please choose an avatar!');
    if (!s || !s.connected) return toast.error('Not connected to server yet');

    setCurrentUser(userName);
    s.emit('create-room', { roomName: roomNameForCreation, userName, avatar });
  };

  // ---------- Chat ----------
  const sendMessage = () => {
    const s = socketRef.current;
    if (!inputMessage.trim() || !s || !roomId) return;

    s.emit('chat-message', {
      roomId,
      message: inputMessage,
      userName: currentUser || userName || 'Anonymous',
      avatar,
    });
    setInputMessage('');
  };

  // ---------- Share ----------
  const copyLink = () => {
    if (!roomId) return toast.error('No room ID available');
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Room link copied!');
  };

  // ---------- Run code via Judge0 ----------
  const runCode = async (codeToRun: string, lang: string) => {
  if (!codeToRun.trim()) {
    toast.error('Nothing to run');
    return;
  }

  setIsRunning(true);
  setOutput('');

  try {
    const res = await fetch(`${API_BASE_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeToRun, language: lang }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Execution failed');
    }

    let out = '';
    if (data.stdout) out += data.stdout;
    if (data.stderr) out += (out ? '\n' : '') + data.stderr;
    if (data.compile_output)
      out += (out ? '\n' : '') + data.compile_output;

    const finalOutput = out || '(no output)';
    setOutput(finalOutput);

    // 🔥 Broadcast this output to everyone in the room
    const s = socketRef.current;
    if (s && roomId) {
      s.emit('run-output', {
        roomId,
        output: finalOutput,
        language: lang,
      });
    }
  } catch (err: any) {
    console.error(err);
    setOutput(`Error: ${err.message || 'Run failed'}`);
    toast.error(err.message || 'Run failed');
  } finally {
    setIsRunning(false);
  }
};
  // ---------------- LOGIN / ROOM SELECTION ----------------
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
            Code With Bandhu
          </h1>

          <AnimatePresence mode="wait">
            {view === 'join' ? (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-lg font-semibold mb-4 text-purple-300">
                  Join a Room
                </h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg focus:ring-purple-500 text-white"
                  />

                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      Choose an avatar:
                    </p>
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
                    onChange={(e) =>
                      setRoomIdToJoin(e.target.value.toUpperCase())
                    }
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
              <motion.div
                key="create"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-lg font-semibold mb-4 text-purple-300">
                  Create a Room
                </h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg focus:ring-purple-500 text-white"
                  />

                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      Choose an avatar:
                    </p>
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
                    onChange={(e) =>
                      setRoomNameForCreation(e.target.value)
                    }
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
              {view === 'join'
                ? "Don't have a room?"
                : 'Already have a room?'}
              <button
                onClick={() =>
                  setView(view === 'join' ? 'create' : 'join')
                }
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

  // ------------------ MAIN EDITOR / WORKSPACE ------------------
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
            <h1 className="text-sm font-semibold tracking-wide uppercase text-slate-200/90">
              Code With Bandhu
            </h1>
            <p className="text-[11px] text-slate-400">
              Room{' '}
              <span className="font-mono text-purple-300">{roomId}</span>
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

        <div className="flex items-center gap-2">
          {/* Video call controls */}
          {!inCall ? (
            <motion.button
              onClick={startCall}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-600 to-red-600 px-3 py-1.5 text-xs font-semibold shadow-md shadow-pink-500/40"
            >
              <VideoIcon className="h-3 w-3" />
              <span>Join Call</span>
            </motion.button>
          ) : (
            <motion.button
              onClick={leaveCall}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold shadow"
            >
              <VideoOff className="h-3 w-3" />
              <span>Leave Call</span>
            </motion.button>
          )}

          {/* Run Button */}
          <motion.button
  onClick={() => {
    if (!roomId) {
      toast.error('No room to run code in');
      return;
    }

    const codeToRun = code;
    const langToRun = language;

    if (!codeToRun.trim()) {
      toast.error('Nothing to run');
      return;
    }

    // Run locally; runCode will broadcast output to others
    runCode(codeToRun, langToRun);
  }}
            whileHover={{ scale: isRunning ? 1 : 1.05 }}
            disabled={isRunning}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-md ${
              isRunning
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-lime-500 shadow-emerald-500/40'
            }`}
          >
            <span>{isRunning ? 'Running…' : 'Run'}</span>
          </motion.button>

          {/* Share Button */}
          <motion.button
            onClick={copyLink}
            whileHover={{
              scale: 1.05,
              boxShadow: '0 0 12px rgba(59,130,246,0.6)',
            }}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-1.5 text-xs font-semibold shadow-md shadow-blue-500/40"
          >
            <Share2 className="h-4 w-4" />
            <span>Share link</span>
          </motion.button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="relative flex-1 p-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full overflow-hidden rounded-2xl border border-purple-500/30 bg-black/60 shadow-[0_0_40px_rgba(129,140,248,0.25)] flex flex-col"
          >
            {/* Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                width="100%"
                language={language}
                value={code}
                onChange={(value) => {
                  const s = socketRef.current;
                  if (value !== undefined) {
                    safeSetCode(value);
                    if (s && roomId && s.connected) {
                      s.emit('code-change', {
                        roomId,
                        code: value,
                        userId: s.id,
                      });
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
            </div>

            {/* Output */}
            <div className="h-32 border-t border-purple-500/30 bg-black/90 px-3 py-2 text-xs font-mono overflow-auto">
              <div className="text-[10px] text-slate-400 mb-1">
                Output (via Judge0, language: {language})
              </div>
              {output ? (
                output.split('\n').map((line, idx) => (
                  <div
                    key={idx}
                    className="text-slate-100 whitespace-pre-wrap"
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-600">
                  Press Run to execute code…
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Sidebar – Users + Chat + Video */}
        <div className="w-80 p-3">
          <motion.div
            initial={{ x: 260 }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 90, damping: 16 }}
            className="flex h-full flex-col rounded-2xl border border-purple-500/30 bg-black/70 backdrop-blur-2xl"
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
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                    <span className="text-slate-100 truncate">
                      {user.userName}{' '}
                      {user.socketId === socketRef.current?.id
                        ? '(You)'
                        : ''}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Chat + Video */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Chat */}
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-purple-500/30 px-3 py-2 text-xs font-semibold text-blue-200 flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  Room Chat
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-xs">
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
                        className="h-6 w-6 rounded-full object-cover flex-shrink-0"
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
                        <p className="mb-0.5 text-[10px] font-bold opacity-80">
                          {msg.userName}
                        </p>
                        <p className="text-[11px] break-words">
                          {msg.message}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-2 border-t border-purple-500/30 px-2 py-2 flex-shrink-0">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && sendMessage()
                    }
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

              {/* Video Call Panel */}
              {(inCall || Object.keys(remoteStreams).length > 0) && (
                <div className="border-t border-purple-500/30 px-2 py-2 flex-shrink-0">
                  <p className="text-[10px] text-purple-400 mb-1 font-semibold">
                    Video Call (
                    {Object.keys(remoteStreams).length + (localStream ? 1 : 0)}{' '}
                    participant
                    {Object.keys(remoteStreams).length + (localStream ? 1 : 0) !== 1 ? 's' : ''}
                    )
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {localStream && (
                      <VideoTile
                        stream={localStream}
                        label={currentUser || userName || 'You'}
                        isLocal={true}
                        speakerEnabled={speakerEnabled}
                      />
                    )}
                    {Object.entries(remoteStreams).map(
                      ([id, stream]) => (
                        <VideoTile
                          key={id}
                          stream={stream}
                          label={
                            users.find(
                              (u: any) => u.socketId === id,
                            )?.userName || id.slice(0, 6)
                          }
                          isLocal={false}
                          speakerEnabled={speakerEnabled}
                        />
                      ),
                    )}
                  </div>

                  {/* Media control buttons */}
                  <div className="flex justify-center gap-3">
                    {/* Video toggle */}
                    <button
                      onClick={toggleVideo}
                      className={`flex items-center justify-center w-10 h-10 rounded-md border ${
                        videoEnabled
                          ? 'bg-green-600 border-green-400'
                          : 'bg-slate-700 border-slate-500'
                      }`}
                      title={
                        videoEnabled
                          ? 'Turn camera off'
                          : 'Turn camera on'
                      }
                    >
                      {videoEnabled ? (
                        <VideoIcon className="w-4 h-4" />
                      ) : (
                        <VideoOff className="w-4 h-4" />
                      )}
                    </button>

                    {/* Microphone toggle */}
                    <button
                      onClick={toggleAudio}
                      className={`flex items-center justify-center w-10 h-10 rounded-md border ${
                        audioEnabled
                          ? 'bg-green-600 border-green-400'
                          : 'bg-slate-700 border-slate-500'
                      }`}
                      title={
                        audioEnabled
                          ? 'Mute microphone'
                          : 'Unmute microphone'
                      }
                    >
                      {audioEnabled ? (
                        <Mic className="w-4 h-4" />
                      ) : (
                        <MicOff className="w-4 h-4" />
                      )}
                    </button>

                    {/* Speaker toggle */}
                    <button
                      onClick={toggleSpeaker}
                      className={`flex items-center justify-center w-10 h-10 rounded-md border ${
                        speakerEnabled
                          ? 'bg-blue-600 border-blue-400'
                          : 'bg-slate-700 border-slate-500'
                      }`}
                      title={
                        speakerEnabled
                          ? 'Mute speakers'
                          : 'Unmute speakers'
                      }
                    >
                      {speakerEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default App;