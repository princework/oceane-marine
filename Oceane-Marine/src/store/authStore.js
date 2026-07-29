"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      success: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setSuccess: (success) => set({ success }),
      
      signup: async (employeeId, employeeName, email, password, role) => {
        set({ isLoading: true, error: null, success: false });

        try {
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId,
              employeeName,
              email,
              password,
              role,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Signup failed");
          }

          set({
            user: data.user || null,
            isAuthenticated: !!data.user,
            isLoading: false,
            error: null,
          });

          return { success: true };
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Signup failed",
            isLoading: false,
          });

          return { success: false, error: err.message };
        }
      },

  
      login: async (email, password) => {
        set({ isLoading: true, error: null, success: false });

        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Login failed");
          }

          // Cookie is already set by API
          set({
            user: data.user || null,
            isAuthenticated: !!data.user,
            isLoading: false,
            error: null,
          });

          return { success: true };
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Login failed",
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });

          return { success: false, error: err.message };
        }
      },

      logout: async () => {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } catch {}

        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // -------------------------
      // FETCH LOGGED-IN USER
      // (Called on page refresh)
      // -------------------------
      fetchUser: async () => {
        set({ isLoading: true, error: null, success: false });

        try {
          const res = await fetch("/api/auth/me");
          const data = await res.json();

          if (!res.ok || !data) {
            throw new Error("Not authenticated");
          }

          const user = data.user ?? data;

          set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
            error: null,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // -------------------------
      // Role & Permission Helpers
      // -------------------------
      hasRole: (role) => {
        const user = get().user;
        return user?.roles?.includes(role) ?? false;
      },

      hasPermission: (module, action) => {
        const user = get().user;
        return user?.permissions?.[module]?.[action] === true;
      },
    }),

    // -------------------------
    // Persist Only Necessary Data
    // -------------------------
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
