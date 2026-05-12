import { createContext } from 'react';

/**
 * ToastContext — internal context object for the Toast primitive.
 *
 * Lives in its own file so ToastProvider.jsx can stay component-only
 * (react-refresh/only-export-components requires components and contexts
 * to be in separate files for Fast Refresh to work).
 *
 * Consumers should NOT import this directly — use the useToast() hook,
 * which handles the missing-provider case with a clear error.
 */
export const ToastContext = createContext(null);
