import { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useStore } from '../../stores/useStore';
import { cn } from '../../lib/utils';
import { Menu } from 'lucide-react';
import { CreateProjectModal } from './CreateProjectModal';

export function Layout({ children }: { children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useStore();

  // Handle keyboard shortcut for sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 w-64 border-r border-slate-800 bg-slate-900",
          !sidebarOpen && "-translate-x-full lg:hidden" // We might want a collapsed state later, but for now simple hide
        )}
      >
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header (Shows when sidebar is hidden on small screens) */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl shrink-0">
          <button 
            onClick={toggleSidebar}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      
      {/* Global Modals */}
      <CreateProjectModal />
    </div>
  );
}
