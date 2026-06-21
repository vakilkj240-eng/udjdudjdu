import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Users } from 'lucide-react';
import API_URL from '../lib/api';

const VideoRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const websocket = useRef(null);
  const localStream = useRef(null);

  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    startMedia();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    if (websocket.current) {
      websocket.current.close();
    }
  };

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      connectWebSocket();
    } catch (err) {
      console.error('Media error:', err);
      setConnectionStatus('Camera/mic access denied');
    }
  };

  const connectWebSocket = () => {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    websocket.current = new WebSocket(`${wsUrl}/ws/video/${roomId}`);

    websocket.current.onopen = () => {
      setConnectionStatus('Waiting for peer...');
    };

    websocket.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'room_info') {
        setPeerCount(data.peer_count);
        if (data.peer_count >= 2) {
          createOffer();
        }
      } else if (data.type === 'peer_joined') {
        setPeerCount(data.peer_count);
        setConnectionStatus('Peer joined! Connecting...');
        createOffer();
      } else if (data.type === 'peer_left') {
        setPeerCount(data.peer_count);
        setConnectionStatus('Peer disconnected');
        setConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      } else if (data.type === 'offer') {
        await handleOffer(data);
      } else if (data.type === 'answer') {
        await handleAnswer(data);
      } else if (data.type === 'ice-candidate') {
        await handleIceCandidate(data);
      }
    };

    websocket.current.onerror = () => setConnectionStatus('Connection error');
    websocket.current.onclose = () => setConnectionStatus('Disconnected');
  };

  const createPeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && websocket.current?.readyState === WebSocket.OPEN) {
        websocket.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
        setConnectionStatus('Connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
        setConnectionStatus('Connection lost');
      }
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    peerConnection.current = pc;
    return pc;
  };

  const createOffer = async () => {
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    websocket.current.send(JSON.stringify({
      type: 'offer',
      sdp: offer.sdp
    }));
  };

  const handleOffer = async (data) => {
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    websocket.current.send(JSON.stringify({
      type: 'answer',
      sdp: answer.sdp
    }));
  };

  const handleAnswer = async (data) => {
    if (peerConnection.current) {
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
      );
    }
  };

  const handleIceCandidate = async (data) => {
    if (peerConnection.current && data.candidate) {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setAudioEnabled(!audioEnabled);
    }
  };

  const endCall = () => {
    cleanup();
    navigate('/client/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="video-room-page">
      <div className="h-screen flex flex-col">
        {/* Top bar */}
        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
            <span className="text-slate-300 text-sm">{connectionStatus}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <Users className="w-4 h-4" />
              <span>{peerCount} in room</span>
            </div>
            <span className="text-slate-500 text-xs font-mono">{roomId}</span>
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 relative flex items-center justify-center p-4 gap-4">
          {/* Remote video (large) */}
          <div className="flex-1 h-full bg-slate-900 rounded-2xl overflow-hidden relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="remote-video"
            />
            {!connected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Video className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">Waiting for peer to join...</p>
                  <p className="text-slate-500 text-xs mt-1">Share this room ID: <span className="font-mono text-amber-400">{roomId}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Local video (small, picture-in-picture) */}
          <div className="absolute bottom-8 right-8 w-56 h-40 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              data-testid="local-video"
            />
            {!videoEnabled && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">You</span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-center gap-4 border-t border-slate-800" data-testid="video-controls">
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              audioEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            data-testid="toggle-audio-btn"
          >
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              videoEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            data-testid="toggle-video-btn"
          >
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          <button
            onClick={endCall}
            className="w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
            data-testid="end-call-btn"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>

      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
};

export default VideoRoom;
