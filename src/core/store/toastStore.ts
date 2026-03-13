import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ToastType = 'info' | 'success' | 'error' | 'loading';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  txHash?: string;
  duration?: number; // ms, default 5000
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
}

export const useToastStore = create<ToastState & ToastActions>()(
  immer((set) => ({
    toasts: [],

    addToast: (toast) => {
      const id = Math.random().toString(36).substring(2, 9);
      set((state) => {
        state.toasts.push({ ...toast, id });
      });
      
      const duration = toast.duration ?? 5000;
      if (duration !== Infinity) {
        setTimeout(() => {
          set((state) => {
            state.toasts = state.toasts.filter(t => t.id !== id);
          });
        }, duration);
      }
      
      return id;
    },

    removeToast: (id) =>
      set((state) => {
        state.toasts = state.toasts.filter((t) => t.id !== id);
      }),

    updateToast: (id, updates) =>
      set((state) => {
        const toast = state.toasts.find((t) => t.id === id);
        if (toast) {
          Object.assign(toast, updates);
        }
      }),
  }))
);
