import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  exiting?: boolean;
};

type ToastContextType = {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
});

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    bar: 'bg-emerald-400',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-400',
    bar: 'bg-red-400',
  },
  info: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    icon: 'text-sky-400',
    bar: 'bg-sky-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    bar: 'bg-amber-400',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const value: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast('success', title, message),
    error: (title, message) => addToast('error', title, message),
    info: (title, message) => addToast('info', title, message),
    warning: (title, message) => addToast('warning', title, message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const Icon = ICONS[t.type];
          const style = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`${t.exiting ? 'animate-toastOut' : 'animate-toastIn'} 
                flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl 
                min-w-[300px] max-w-[400px] ${style.bg} ${style.border}
                bg-slate-900/90`}
            >
              <Icon size={18} className={`${style.icon} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{t.title}</p>
                {t.message && (
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-500 hover:text-slate-300 transition flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
