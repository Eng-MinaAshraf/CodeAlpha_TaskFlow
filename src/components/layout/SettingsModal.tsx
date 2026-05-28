import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, User, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from 'sonner';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username, avatar_url: avatarUrl })
      .eq('id', user.id);
      
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
      // Update local profile state if needed or wait for next load/realtime
      onClose();
    }
    setSaving(false);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">User Settings</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden mb-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-slate-600" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <User size={14} /> Username
                </label>
                <Input 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required
                  placeholder="Your username..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <ImageIcon size={14} /> Avatar URL
                </label>
                <Input 
                  value={avatarUrl} 
                  onChange={e => setAvatarUrl(e.target.value)} 
                  placeholder="https://example.com/avatar.png"
                />
                <p className="text-xs text-slate-500 mt-2">Paste a direct image link to update your avatar.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
