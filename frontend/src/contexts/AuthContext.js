import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_URL from '../lib/api';

// Global axios defaults — 15s timeout, keeps requests snappy
axios.defaults.timeout = 15000;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

// Silently ping the backend so Render wakes up before the user hits login
const warmUpBackend = () => {
  if (!API_URL) return; // dev mode uses Vite proxy — no cold start
  axios.get(`${API_URL}/api/health`, { timeout: 30000 }).catch(() => {});
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const doLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    setUser(null);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          const detail = err.response?.data?.detail || '';
          if (detail === 'Token expired' || detail === 'Not authenticated' || detail === 'Invalid token') {
            doLogout();
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [doLogout]);

  useEffect(() => {
    checkAuth();
    warmUpBackend(); // wake Render as soon as app loads
  }, []);

  const checkAuth = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  };

  // ✅ Login
  const login = async (email, password) => {
    const { data } = await axios.post(
      `${API_URL}/api/auth/login`,
      { email, password }
    );

    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
    }
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  const register = async (userData) => {
    const { data } = await axios.post(
      `${API_URL}/api/auth/register`,
      userData
    );

    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
    }
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = doLogout;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
