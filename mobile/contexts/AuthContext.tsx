import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "@/lib/api";
import storage from "@/lib/storage";
import type { User, LoginRequest, RegisterRequest } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const storedToken = await storage.getToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      setToken(storedToken);
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      await storage.clearAll();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    await storage.setToken(response.access_token);
    await storage.setUser(response.user);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    await storage.setToken(response.access_token);
    await storage.setUser(response.user);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await storage.clearAll();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
