import { useContext } from 'react';
import { ToastContext } from '../components/ui/toastContext';

/**
 * useToast — consumer hook for the Toast primitive.
 *
 * Returns { show, dismiss }:
 *   - show({ message, variant, duration, action }) → toastId
 *       message: string | ReactNode (required)
 *       variant: 'success' | 'error' | 'info' | 'warning' (default 'info')
 *       duration: ms; 0 = sticky (default 3000)
 *       action:  { label, onClick } — optional, renders a button next to the message
 *   - dismiss(toastId): removes a toast immediately
 *
 * Throws if used outside <ToastProvider>. ToastProvider is mounted in App.jsx
 * so every consumer in the rendered tree is covered.
 */
export default function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return ctx;
}
