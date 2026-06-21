import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Loader2, Bot, User, Paperclip, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../lib/api';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hello! I'm Gavel & Brief's legal assistant. Ask me any legal question about Indian law. You can also attach a case file or share your NyayID to get tailored answers."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;

    const userText = attachedFile
      ? `[Attached file: ${attachedFile.name}]${input.trim() ? ` — ${input.trim()}` : ''}`
      : input.trim();

    setInput('');
    setAttachedFile(null);
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_URL}/api/chat`, {
        message: input.trim() || `Please help me with this legal case file: ${attachedFile?.name}`,
        session_id: sessionId,
        case_file_reference: attachedFile ? attachedFile.name : null,
      });
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble responding. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `📎 I see you've attached "${file.name}". Please ask your question and I'll help you with this case document.`
      }]);
    }
    e.target.value = '';
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center transition-colors"
            style={{ background: '#7C1D2B' }}
            data-testid="chat-toggle-btn"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96 h-[530px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            data-testid="chat-panel"
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
              style={{ background: '#7C1D2B' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(201,168,76,0.25)' }}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Legal Assistant</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Indian law · Case file support</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors" data-testid="chat-close-btn">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-200' : ''
                  }`} style={msg.role === 'bot' ? { background: 'rgba(124,29,43,0.1)' } : {}}>
                    {msg.role === 'user'
                      ? <User className="w-3 h-3 text-slate-600" />
                      : <Bot className="w-3 h-3" style={{ color: '#7C1D2B' }} />}
                  </div>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`} style={msg.role === 'user' ? { background: '#7C1D2B' } : {}}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(124,29,43,0.1)' }}>
                    <Bot className="w-3 h-3" style={{ color: '#7C1D2B' }} />
                  </div>
                  <div className="bg-slate-100 px-3 py-2 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attached file indicator */}
            {attachedFile && (
              <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-2 bg-amber-50">
                <FileText className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700 font-medium truncate">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="ml-auto text-amber-400 hover:text-amber-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-200 p-3 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors flex-shrink-0"
                  title="Attach case file"
                  data-testid="chat-attach-btn"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={handleFileSelect} />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={attachedFile ? 'Ask about this file...' : 'Ask a legal question...'}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
                  data-testid="chat-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachedFile) || loading}
                  className="text-white p-2 rounded-lg disabled:opacity-50 transition-colors flex-shrink-0"
                  style={{ background: '#7C1D2B' }}
                  data-testid="chat-send-btn"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 text-center">
                General information only. Not legal advice. · 📎 Attach case files for context
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
