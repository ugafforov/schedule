import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { offlineDB } from "@/lib/offline-db";

type User = {
  id: number;
  code: string;
  ownerName: string;
  role: string;
};

type LoginRequest = {
  accessCode: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isElectron: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const isElectron = window.electronAPI !== undefined;

  useEffect(() => {
    const savedUser = localStorage.getItem('offline-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('offline-user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      const authenticatedUser = await offlineDB.authenticateAccessCode(credentials.accessCode);
      setUser(authenticatedUser);
      localStorage.setItem('offline-user', JSON.stringify(authenticatedUser));
      setLocation('/dashboard');
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('offline-user');
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isElectron }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useOfflineAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useOfflineAuth must be used within an AuthProvider');
  }
  return context;
}