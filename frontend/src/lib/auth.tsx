import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { authApi } from './api';
import type { User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, email: string, password: string, referrerCode?: string) => Promise<{ success: boolean; message?: string }>;
  loginWithTelegram: (refCode?: string) => Promise<{ botUrl: string; token: string }>;
  pollTelegramAuth: (token: string) => void;
  cancelTelegramPoll: () => void;
  telegramAuthStatus: 'idle' | 'waiting' | 'confirmed' | 'expired';
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramAuthStatus, setTelegramAuthStatus] = useState<'idle' | 'waiting' | 'confirmed' | 'expired'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const savedToken = localStorage.getItem('tradyx_token');
    const savedUser = localStorage.getItem('tradyx_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const setAuth = useCallback((jwt: string, userData: User) => {
    localStorage.setItem('tradyx_token', jwt);
    localStorage.setItem('tradyx_user', JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.token) {
        setAuth(response.token, response.user);
        return { success: true };
      }
      return { success: false, message: response.message || 'Login failed' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Connection error' };
    }
  };

  const register = async (username: string, email: string, password: string, referrerCode?: string) => {
    try {
      const response = await authApi.register(username, email, password, referrerCode);
      if (response.success && response.token) {
        setAuth(response.token, response.user);
        return { success: true };
      }
      return { success: false, message: response.message || 'Registration failed' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Connection error' };
    }
  };

  const cancelTelegramPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const loginWithTelegram = async (refCode?: string) => {
    cancelTelegramPoll();
    const result = await authApi.telegramInit(refCode);
    setTelegramAuthStatus('waiting');
    return result;
  };

  const pollTelegramAuth = useCallback((authToken: string) => {
    cancelTelegramPoll();
    pollCountRef.current = 0;
    setTelegramAuthStatus('waiting');

    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      // Expire after 5 minutes (150 polls * 2s)
      if (pollCountRef.current > 150) {
        cancelTelegramPoll();
        setTelegramAuthStatus('expired');
        return;
      }

      try {
        const result = await authApi.telegramCheck(authToken);
        if (result.confirmed && result.jwtToken && result.user) {
          cancelTelegramPoll();
          setAuth(result.jwtToken, result.user);
          setTelegramAuthStatus('confirmed');
        }
      } catch {
        // Ignore polling errors, keep trying
      }
    }, 2000);
  }, [cancelTelegramPoll, setAuth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelTelegramPoll();
  }, [cancelTelegramPoll]);

  const logout = () => {
    cancelTelegramPoll();
    localStorage.removeItem('tradyx_token');
    localStorage.removeItem('tradyx_user');
    setToken(null);
    setUser(null);
    setTelegramAuthStatus('idle');
  };

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated: !!token, isLoading,
      login, register, loginWithTelegram, pollTelegramAuth, cancelTelegramPoll, telegramAuthStatus,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
