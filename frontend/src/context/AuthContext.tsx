import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, LoginPayload, RegisterPayload, VerifyOtpPayload } from '../types/auth.types';
import { authApi } from '../api/auth.api';
import { getStoredToken, setStoredToken, removeStoredToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  registerInit: (payload: RegisterPayload) => Promise<{ requiresOtp: boolean; email?: string; userId?: string }>;
  registerVerify: (payload: VerifyOtpPayload) => Promise<User>;
  resendRegisterOtp: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { user: profile } = await authApi.getMe();
      setUser(profile);
      setToken(currentToken);
    } catch (error) {
      // Token expired or invalid
      removeStoredToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const registerInit = async (payload: RegisterPayload) => {
    const res = await authApi.register(payload);
    return {
      requiresOtp: res.requiresOtp,
      email: res.email || payload.email,
      userId: res.userId
    };
  };

  const registerVerify = async (payload: VerifyOtpPayload) => {
    const res = await authApi.verifyRegisterOtp(payload);
    return res.user;
  };

  const resendRegisterOtp = async (email: string) => {
    await authApi.resendRegisterOtp({ email });
  };

  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        registerInit,
        registerVerify,
        resendRegisterOtp,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
