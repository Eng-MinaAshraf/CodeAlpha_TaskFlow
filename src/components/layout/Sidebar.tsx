import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../stores/useStore';
import { cn, getAvatarColor } from '../../lib/utils';
import { 
  LayoutGrid, Plus, Users, Settings, 
  LogOut, Search, X
} from 'lucide-react';
import { useState } from 'react';
import { Notifications } from './Notifications';
import { SettingsModal } from './SettingsModal';

export function Sidebar() {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { projects, setSidebarOpen, setCmdOpen, setCreateProjectModalOpen } = useStore();
  const [showSettings, setShowSettings] = useState(false);

  // Auto-close sidebar on mobile when navigating
  const handleNav = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutGrid },
    { name: 'Members', path: '/users', icon: Users, adminOnly: true },
  ];

  // ✅ FIX: Use system_role (immutable) instead of role (project-level)
  const isSuperAdmin = profile?.system_role === 'super_admin';
  const avatarLetter = profile?.username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?';
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center px-4 justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 text-slate-100 font-semibold tracking-tight">
          <img 
            src="/taskflow-symbol.png" 
            alt="TaskFlow" 
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]"
            draggable={false}
          />
          <span className="bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">TaskFlow</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search Trigger & Notifications */}
      <div className="px-3 pt-4 pb-2 shrink-0 flex items-center gap-2">
        <button
          onClick={() => setCmdOpen(true)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-md transition-colors group"
        >
          <Search size={14} className="group-hover:text-slate-300" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 font-mono text-[10px] font-medium text-slate-500 bg-slate-800 rounded">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
        <Notifications />
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
        <div className="space-y-0.5">
          {navItems.filter(i => !i.adminOnly || isSuperAdmin).map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNav}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location.pathname === item.path 
                  ? "bg-indigo-500/10 text-indigo-400" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon size={16} className={location.pathname === item.path ? "text-indigo-400" : "text-slate-500"} />
              {item.name}
            </Link>
          ))}
        </div>

        {/* Projects List */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projects</h3>
            <button 
              onClick={() => setCreateProjectModalOpen(true)}
              aria-label="Add New Project"
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.map(project => {
              const isActive = location.pathname.includes(`/project/${project.id}`);
              const color = getAvatarColor(project.name);
              return (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  onClick={handleNav}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm group transition-colors",
                    isActive 
                      ? "bg-slate-800 text-slate-100 font-medium" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full bg-gradient-to-br", color)} />
                  <span className="truncate flex-1">{project.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-slate-300">{avatarLetter}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{profile?.username}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-md hover:bg-slate-800"
            >
              <Settings size={14} />
            </button>
            <button 
              onClick={signOut}
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
