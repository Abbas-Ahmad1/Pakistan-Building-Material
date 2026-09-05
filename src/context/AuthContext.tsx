import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest, TOKEN_KEY } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchUserRole: (role: 'ADMIN' | 'CASHIER') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check existing session on mount
  useEffect(() => {
    async function verifyUserSession() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      const res = await apiRequest('/api/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        setToken(savedToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    }

    verifyUserSession();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (res.success && res.data) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, message: res.message || 'Login failed' };
  };

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  // Helper for quick testing between Admin and Cashier accounts
  const switchUserRole = async (role: 'ADMIN' | 'CASHIER') => {
    if (role === 'ADMIN') {
      await login('admin', 'admin123');
    } else {
      await login('cashier', 'cashier123');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
