import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('razoragent_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/api/auth/me');
      if (res.data?.merchant) {
        setMerchant(res.data.merchant);
      }
    } catch (err) {
      console.warn('Session expired or invalid:', err.message);
      localStorage.removeItem('razoragent_token');
      setMerchant(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    if (res.data?.token) {
      localStorage.setItem('razoragent_token', res.data.token);
      setMerchant(res.data.merchant);
      return res.data;
    }
    throw new Error('Login failed');
  };

  const register = async (userData) => {
    const res = await api.post('/api/auth/register', userData);
    if (res.data?.token) {
      localStorage.setItem('razoragent_token', res.data.token);
      setMerchant(res.data.merchant);
      return res.data;
    }
    throw new Error('Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('razoragent_token');
    setMerchant(null);
  };

  const updateSettings = async (settings) => {
    const res = await api.patch('/api/auth/settings', settings);
    if (res.data?.merchant) {
      setMerchant(res.data.merchant);
    }
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ merchant, loading, login, register, logout, updateSettings, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
