import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Branch } from '../types';
import { apiRequest, TOKEN_KEY } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  branches: Branch[];
  currentBranch: Branch | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, branch_id?: number) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchUserRole: (role: 'ADMIN' | 'CASHIER') => Promise<void>;
  switchBranch: (branchId: number) => Promise<boolean>;
  refreshBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchBranches = async () => {
    try {
      const res = await apiRequest<Branch[]>('/api/auth/branches');
      if (res.success && res.data) {
        setBranches(res.data);
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  };

  // Check existing session on mount
  useEffect(() => {
    async function verifyUserSession() {
      fetchBranches();
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      const res = await apiRequest<{ user: User }>('/api/auth/me');
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

  const login = async (username: string, password: string, branch_id?: number) => {
    setIsLoading(true);
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, branch_id }),
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

  const switchBranch = async (branchId: number) => {
    try {
      const res = await apiRequest<{ branch_id: number; branch_name: string; branch_code: string }>('/api/auth/switch-branch', {
        method: 'POST',
        body: JSON.stringify({ branch_id: branchId }),
      });
      if (res.success && res.data && user) {
        setUser({
          ...user,
          branch_id: res.data.branch_id,
          branch_name: res.data.branch_name,
          branch_code: res.data.branch_code,
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to switch branch:', err);
      return false;
    }
  };

  // Helper for quick testing between Admin and Cashier accounts
  const switchUserRole = async (role: 'ADMIN' | 'CASHIER') => {
    if (role === 'ADMIN') {
      await login('admin', 'admin123');
    } else {
      await login('cashier', 'cashier123');
    }
  };

  const currentBranch = branches.find((b) => b.id === user?.branch_id) || (user?.branch_id ? {
    id: user.branch_id,
    name: user.branch_name || 'Current Branch',
    code: user.branch_code || 'BR-01',
    is_main: user.branch_id === 1,
    status: 'ACTIVE',
  } as Branch : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        branches,
        currentBranch,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchUserRole,
        switchBranch,
        refreshBranches: fetchBranches,
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
