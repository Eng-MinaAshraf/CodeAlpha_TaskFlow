import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { useStore } from './stores/useStore';
import AppRoutes from './routes';
import AuthPage from './pages/AuthPage';
import { Layout } from './components/layout/Layout';
import { CommandPalette } from './components/shared/CommandPalette';
import Intro from './components/shared/Intro';
import { AnimatePresence, motion } from 'framer-motion';

function AppContent() {
  const { user, loading } = useAuth();
  const { initializeGlobalData, initialized, resetStore } = useStore();

  useEffect(() => {
    if (user && !initialized) {
      initializeGlobalData();
    }
    if (!user && initialized) {
      // User signed out — clear all stale data
      resetStore();
    }
  }, [user, initialized, initializeGlobalData, resetStore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center animate-float">
              <div className="w-5 h-5 rounded-lg bg-sky-500" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-sky-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <Layout>
        <AppRoutes />
      </Layout>
      <CommandPalette />
    </BrowserRouter>
  );
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        {showIntro ? (
          <motion.div
            key="intro"
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              y: -50,
              scale: 1.05,
              filter: "blur(15px)",
              transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
            }}
            className="fixed inset-0 z-[9999]"
          >
            <Intro onComplete={() => setShowIntro(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full min-h-screen"
          >
            <AppContent />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster theme="dark" position="bottom-right" richColors />
    </AuthProvider>
  );
}
