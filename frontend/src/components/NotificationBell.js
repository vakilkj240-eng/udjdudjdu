import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, Check, CheckCheck, Info, Phone, Users, CreditCard, MessageCircle, BarChart2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import API_URL from '../lib/api';

const iconMap = {
  info: Info,
  consultation: Phone,
  referral: Users,
  payment: CreditCard,
  case_message: MessageCircle,
  digest: BarChart2,
};

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [chatSummary, setChatSummary] = useState({ total_unread: 0, cases: [] });
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchChatSummary();
    }
    const interval = setInterval(() => {
      if (user) {
        fetchNotifications();
        fetchChatSummary();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/notifications`);
      setNotifications(data);
    } catch {}
  };

  const fetchChatSummary = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/messages/unread-summary`);
      setChatSummary(data);
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/read-all`, {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const notifUnread = notifications.filter(n => !n.read).length;
  const chatUnread = chatSummary?.total_unread || 0;
  const unreadCount = notifUnread + chatUnread;
  const chatCases = chatSummary?.cases || [];

  if (!user) return null;

  return (
    <div className="relative" ref={ref} data-testid="notification-bell">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative transition-colors"
        style={{ color: 'var(--theme-text-muted)' }}
        data-testid="notification-bell-btn"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            style={{ background: '#D4AF37', color: '#1A0A04' }}
            data-testid="notification-badge"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-10 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
          data-testid="notification-dropdown"
        >
          <div className="px-4 py-3 flex items-center justify-between"
               style={{ borderBottom: '1px solid var(--theme-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--theme-text-muted)' }}
                data-testid="mark-all-read"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {chatCases.length > 0 && (
              <div style={{ background: 'rgba(212,175,55,0.06)', borderBottom: '1px solid var(--theme-border)' }}>
                <div className="px-4 py-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
                     style={{ color: '#D4AF37' }}>
                  <MessageCircle className="w-3.5 h-3.5" /> Unread chat messages
                </div>
                {chatCases.map(cc => (
                  <div
                    key={cc.case_id}
                    className="px-4 py-2.5 cursor-pointer flex items-center justify-between gap-3 hover:bg-amber-50/10 transition-colors"
                    style={{ borderBottom: '1px solid var(--theme-border)' }}
                    onClick={() => {
                      setIsOpen(false);
                      window.location.href = user?.role === 'lawyer' ? '/lawyer/dashboard' : '/client/cases';
                    }}
                    data-testid={`chat-unread-${cc.case_id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ background: 'rgba(212,175,55,0.15)' }}>
                        <MessageCircle className="w-4 h-4" style={{ color: '#D4AF37' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                          {cc.case_type || 'Case'}{cc.nyay_id ? ` · ${cc.nyay_id}` : ''}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                          {cc.unread} new message{cc.unread !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5"
                          style={{ background: '#D4AF37', color: '#1A0A04' }}>
                      {cc.unread > 99 ? '99+' : cc.unread}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {notifications.length === 0 && chatCases.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                No notifications
              </div>
            ) : notifications.length === 0 ? null : (
              notifications.slice(0, 10).map(n => {
                const Icon = iconMap[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    className="px-4 py-3 cursor-pointer flex items-start gap-3 transition-colors hover:bg-amber-50/10"
                    style={{
                      borderBottom: '1px solid var(--theme-border)',
                      background: !n.read ? 'rgba(212,175,55,0.05)' : 'transparent',
                    }}
                    onClick={() => markRead(n.id)}
                    data-testid={`notification-item-${n.id}`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: !n.read ? 'rgba(212,175,55,0.15)' : 'var(--theme-bg)' }}>
                      <Icon className="w-4 h-4" style={{ color: !n.read ? '#D4AF37' : 'var(--theme-text-muted)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? 'font-semibold' : ''}`}
                         style={{ color: 'var(--theme-text)' }}>{n.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{n.message}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                           style={{ background: '#D4AF37' }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
