import { create } from 'zustand';
import { setTokens, clearTokens, isAuthenticated } from '@/lib/auth';

interface AuthState {
  isLoggedIn: boolean;
  login: (tokens: { access_token: string; id_token: string; refresh_token: string }) => void;
  logout: () => void;
  hydrate: () => void;
}

// Set a cookie so middleware can check auth server-side
const setCookie = (name: string, value: string, days = 1) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,

  hydrate: () => set({ isLoggedIn: isAuthenticated() }),

  login: (tokens) => {
    setTokens(tokens);
    setCookie('id_token', tokens.id_token, 1);
    set({ isLoggedIn: true });
  },

  logout: () => {
    clearTokens();
    deleteCookie('id_token');
    set({ isLoggedIn: false });
    window.location.href = '/login';
  },
}));
