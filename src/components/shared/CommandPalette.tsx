import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { LayoutGrid, Users, Settings, Plus, Layout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function CommandPalette() {
  const { cmdOpen, setCmdOpen, projects, users } = useStore();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(!cmdOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [cmdOpen, setCmdOpen]);

  const runCommand = (command: () => void) => {
    setCmdOpen(false);
    command();
  };

  if (!cmdOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setCmdOpen(false)} 
      />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <Command className="flex flex-col w-full" label="Command Menu">
          <div className="flex items-center px-4 py-3 border-b border-slate-800">
            <Command.Input 
              autoFocus
              placeholder="Type a command or search..." 
              className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-none">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-medium text-slate-500 p-1">
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/'))}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-md cursor-pointer aria-selected:bg-slate-800 aria-selected:text-slate-100"
              >
                <LayoutGrid size={14} /> Dashboard
              </Command.Item>
              {profile?.role === 'admin' && (
                <Command.Item 
                  onSelect={() => runCommand(() => navigate('/users'))}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-md cursor-pointer aria-selected:bg-slate-800 aria-selected:text-slate-100"
                >
                  <Users size={14} /> Manage Users
                </Command.Item>
              )}
            </Command.Group>

            {projects.length > 0 && (
              <Command.Group heading="Projects" className="text-xs font-medium text-slate-500 p-1 mt-2">
                {projects.map(project => (
                  <Command.Item 
                    key={project.id}
                    onSelect={() => runCommand(() => navigate(`/project/${project.id}`))}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-md cursor-pointer aria-selected:bg-slate-800 aria-selected:text-slate-100"
                  >
                    <Layout size={14} className="text-indigo-400" />
                    {project.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className="text-xs font-medium text-slate-500 p-1 mt-2">
              <Command.Item 
                onSelect={() => runCommand(() => {
                  // Trigger project creation logic
                  alert('Create project clicked');
                })}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-md cursor-pointer aria-selected:bg-slate-800 aria-selected:text-slate-100"
              >
                <Plus size={14} /> Create new project...
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
