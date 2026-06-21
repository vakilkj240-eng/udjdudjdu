import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import API_URL from '../lib/api';

const POLL_INTERVAL_MS = 5000;

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const CaseChat = ({ caseId, currentUserId, currentUserName, otherPartyName }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/messages`);
      setMessages(data.messages || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/cases/${caseId}/messages`, {
        content: trimmed,
      });
      setMessages((prev) => [...prev, data]);
      setDraft('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 360 }} data-testid={`case-chat-${caseId}`}>
      <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-semibold">Case Chat</span>
          {otherPartyName && (
            <span className="text-xs text-slate-300">· with {otherPartyName}</span>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Live</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50" style={{ maxHeight: 380 }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Start the conversation below</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.is_mine || m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${m.id}`}
              >
                <div className={`max-w-[78%] rounded-2xl px-4 py-2 ${
                  isMine
                    ? 'bg-slate-900 text-white rounded-br-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                }`}>
                  {!isMine && (
                    <p className="text-[10px] font-semibold text-amber-600 mb-0.5">{m.sender_name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 max-h-32"
          data-testid={`chat-input-${caseId}`}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
          data-testid={`chat-send-${caseId}`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </form>
    </div>
  );
};

export default CaseChat;
