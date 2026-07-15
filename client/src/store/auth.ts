import { create } from "zustand";
import { api } from "@/lib/api";
import type { Role, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
  canWrite: () => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  // При открытии страницы проверяем токен — поэтому изначально true.
  loading: true,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    set({ user: data.user });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null });
  },

  loadMe: async () => {
    if (!localStorage.getItem("token")) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user });
    } catch {
      localStorage.removeItem("token");
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },

  can: (...roles) => {
    const role = get().user?.role;
    return !!role && roles.includes(role);
  },

  canWrite: () => get().can("admin", "accountant"),
}));
