import { create } from 'zustand';
import { setTokens, clearTokens, isAuthenticated } from '@/lib/auth';

interface AuthState {
  isLoggedIn: boolean;
  login: (tokens: { access_token: string; id_token: string; refresh_token: string }) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,

  hydrate: () => set({ isLoggedIn: isAuthenticated() }),

  login: (tokens) => {
    setTokens(tokens);
    set({ isLoggedIn: true });
  },

  logout: () => {
    clearTokens();
    set({ isLoggedIn: false });
    window.location.href = '/login';
  },
}));
