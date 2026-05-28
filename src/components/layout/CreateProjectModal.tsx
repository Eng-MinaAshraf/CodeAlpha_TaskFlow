import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../stores/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from 'sonner';

export function CreateProjectModal() {
  const { user } = useAuth();
  const { createProjectModalOpen, setCreateProjectModalOpen, addProject } = useStore();
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setCreating(true);

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), description: newDesc.trim(), owner_id: user.id })
      .select()
      .single();

    if (error) { 
      toast.error('Failed to create project', { description: error.message }); 
      setCreating(false); 
      return; 
    }

    // Default columns
    await supabase.from('columns').insert([
      { project_id: project.id, title: 'To Do', position: 0 },
      { project_id: project.id, title: 'In Progress', position: 1 },
      { project_id: project.id, title: 'Done', position: 2 },
    ]);

    addProject(project);
    setNewName('');
    setNewDesc('');
    setCreateProjectModalOpen(false);
    setCreating(false);
    toast.success('Project created successfully!');
  }

  return (
    <AnimatePresence>
      {createProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setCreateProjectModalOpen(false)} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl"
          >
            <h2 className="text-xl font-semibold text-white mb-5">Create Project</h2>
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Website Redesign"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (Optional)</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="flex w-full rounded-md border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 resize-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setCreateProjectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating || !newName.trim()}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
