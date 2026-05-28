import { useState, useEffect } from 'react';
import { supabase, Project } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  LayoutGrid, Plus, Folder, Search, Trash2, MoreVertical, Layout, Clock, CheckCircle2, Shield
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { getAvatarColor, cn, formatDate } from '../lib/utils';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.system_role === 'super_admin';
  const { projects, setProjects, initialized, setCreateProjectModalOpen } = useStore();
  const [loading, setLoading] = useState(!initialized);
  const [search, setSearch] = useState('');
  
  // Modals
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [initialized]);

  // Close menus
  useEffect(() => {
    function handleClick() { setMenuOpenId(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  async function fetchProjects() {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }

  // Logic moved to global CreateProjectModal

  async function deleteProject(projectId: string) {
    const project = projects.find(p => p.id === projectId);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast.error('Failed to delete project', { description: error.message });
    } else {
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted', { description: `"${project?.name}" has been removed.` });
    }
    setConfirmDeleteId(null);
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Projects</h1>
            {isSuperAdmin && (
              <span className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                <Shield size={12} /> Super Admin
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            {isSuperAdmin ? 'Managing all platform projects' : 'Manage your workspaces and teams'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group w-full sm:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => setCreateProjectModalOpen(true)} className="gap-2">
            <Plus size={16} />
            New Project
          </Button>
        </div>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-800/50 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30"
        >
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-500">
            <Folder size={32} />
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-1">
            {search ? 'No projects found' : 'Create your first project'}
          </h3>
          <p className="text-slate-500 mb-6 max-w-sm text-center">
            {search ? 'Try adjusting your search query.' : 'Get started by creating a new project to track your team\'s tasks.'}
          </p>
          {!search && (
            <Button onClick={() => setCreateProjectModalOpen(true)} className="gap-2">
              <Plus size={16} /> Create Project
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={i}
                isOwner={project.owner_id === user?.id}
                isSuperAdmin={isSuperAdmin}
                menuOpen={menuOpenId === project.id}
                onToggleMenu={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpenId(prev => prev === project.id ? null : project.id); }}
                onDelete={(e) => { e.preventDefault(); setConfirmDeleteId(project.id); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}


      {/* Delete Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setConfirmDeleteId(null)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Delete Project</h3>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete this project? This action cannot be undone and all tasks will be lost.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDeleteId(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => deleteProject(confirmDeleteId)}>
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({
  project, index, isOwner, isSuperAdmin, menuOpen, onToggleMenu, onDelete
}: {
  project: Project; index: number; isOwner: boolean; isSuperAdmin: boolean; menuOpen: boolean; 
  onToggleMenu: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const color = getAvatarColor(project.name);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Link 
        to={`/project/${project.id}`}
        className="group block bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all duration-200 h-full relative overflow-hidden"
      >
        <div className={cn("absolute top-0 left-0 w-1 h-full bg-gradient-to-b opacity-50 group-hover:opacity-100 transition-opacity", color)} />
        
        <div className="flex justify-between items-start mb-4">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-lg", color)}>
            <Layout size={20} className="text-white" />
          </div>
          
          {(isOwner || isSuperAdmin) && (
            <div className="relative">
              <button
                onClick={onToggleMenu}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-md transition-colors"
              >
                <MoreVertical size={16} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20"
                  >
                    <button
                      onClick={onDelete}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-100 mb-1 group-hover:text-indigo-400 transition-colors">{project.name}</h3>
        <p className="text-sm text-slate-400 line-clamp-2 mb-6 h-10">
          {project.description || 'No description provided.'}
        </p>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/50 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            {formatDate(project.created_at)}
          </div>
          {isOwner && (
            <div className="flex items-center gap-1 text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 size={12} /> Owner
            </div>
          )}
          {!isOwner && isSuperAdmin && (
            <div className="flex items-center gap-1 text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full font-medium">
              <Shield size={12} />
              Admin
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
