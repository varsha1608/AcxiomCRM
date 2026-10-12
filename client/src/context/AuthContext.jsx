import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('acxiom_token');
    const saved = localStorage.getItem('acxiom_user');
    return (savedToken && saved) ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('acxiom_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('acxiom_token');
      if (!storedToken) {
        localStorage.removeItem('acxiom_user');
        sessionStorage.clear();
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('acxiom_user', JSON.stringify(data.user));
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        localStorage.removeItem('acxiom_token');
        localStorage.removeItem('acxiom_user');
        sessionStorage.clear();
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    // Purge any existing session storage and tokens before authenticating new identity
    localStorage.removeItem('acxiom_token');
    localStorage.removeItem('acxiom_user');
    sessionStorage.clear();
    setUser(null);
    setToken(null);

    const { data } = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password
    });
    if (data.success && data.user && data.token) {
      localStorage.setItem('acxiom_token', data.token);
      localStorage.setItem('acxiom_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const register = async (userData) => {
    localStorage.removeItem('acxiom_token');
    localStorage.removeItem('acxiom_user');
    sessionStorage.clear();
    setUser(null);
    setToken(null);

    const { data } = await api.post('/auth/register', userData);
    if (data.success) {
      localStorage.setItem('acxiom_token', data.token);
      localStorage.setItem('acxiom_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('acxiom_token');
      localStorage.removeItem('acxiom_user');
      sessionStorage.clear();
      setUser(null);
      setToken(null);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAdmin: user?.role === 'Admin',
    isManager: user?.role === 'Manager',
    isSalesExecutive: user?.role === 'Sales Executive'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
