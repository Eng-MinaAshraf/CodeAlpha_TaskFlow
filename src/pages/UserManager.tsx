import { useState, useEffect } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Users, Shield, User as UserIcon,
  Search, Trash2, CheckCircle, ShieldAlert, ShieldCheck,
  UserPlus, Crown, Lock, AlertTriangle, Skull
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function UserManager() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Hard Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }

  // ─── ROLE CHANGE (Super Admin only, via secure RPC) ───
  async function updateRole(userId: string, newRole: 'admin' | 'member' | 'viewer') {
    if (userId === currentUser?.id) return;
    setUpdating(userId);

    const { error } = await supabase.rpc('admin_update_user_role', {
      target_user_id: userId,
      new_role: newRole,
    });

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated', { description: `Changed to ${newRole}` });
    } else {
      toast.error('Update failed', { description: error.message });
    }
    setUpdating(null);
  }

  // ─── HARD DELETE (Super Admin only, via secure RPC) ───
  async function hardDeleteUser(userId: string) {
    setDeleting(true);
    const targetUser = users.find(u => u.id === userId);

    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId,
    });

    if (error) {
      toast.error('Deletion failed', { description: error.message });
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
      const result = data as any;
      toast.success('User permanently deleted', {
        description: `${targetUser?.username ?? 'User'} has been erased. ${result?.transferred_projects ?? 0} project(s) transferred to you.`,
        duration: 6000,
      });
    }
    setDeleting(false);
    setConfirmDeleteId(null);
    setDeleteConfirmText('');
  }

  const filtered = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    members: users.filter(u => u.role === 'member').length,
    viewers: users.filter(u => u.role === 'viewer').length,
  };

  // ✅ FIX: Use system_role instead of role for Super Admin check
  const isSuperAdmin = currentProfile?.system_role === 'super_admin';
  const userToDelete = users.find(u => u.id === confirmDeleteId);
  const deleteConfirmRequired = userToDelete?.username ?? '';

  if (!isSuperAdmin && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={48} className="text-red-500/50 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You need Super Admin privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Team Directory
            <span className="text-xs font-medium px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20 flex items-center gap-1">
              <Lock size={12} /> Super Admin
            </span>
          </h1>
          <p className="text-slate-400 mt-1">Manage global roles and permissions</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
          { label: 'Admins', value: stats.admins, icon: Crown, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
          { label: 'Members', value: stats.members, icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Viewers', value: stats.viewers, icon: ShieldAlert, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className={cn("rounded-xl p-5 border", stat.bg, stat.border)}
          >
            <div className="flex items-center gap-2 mb-3">
              <stat.icon size={16} className={stat.color} />
              <span className="text-slate-300 text-sm font-medium">{stat.label}</span>
            </div>
            <span className={cn("text-3xl font-bold tracking-tight", stat.color)}>{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative group w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 w-full"
          />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl"
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">System Role</th>
              <th className="px-6 py-4">Global Role</th>
              <th className="px-6 py-4">Status</th>
              {/* ✅ FIX: Actions column only visible to Super Admin */}
              {isSuperAdmin && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-10 w-48 bg-slate-800 rounded-lg animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-800 rounded-full animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-800 rounded-full animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-6 w-24 bg-slate-800 rounded-full animate-pulse" /></td>
                  {isSuperAdmin && <td className="px-6 py-4"><div className="h-8 w-8 bg-slate-800 rounded-lg ml-auto animate-pulse" /></td>}
                </tr>
              ))
            ) : filtered.map((user, idx) => (
              <motion.tr 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + (idx * 0.05) }}
                key={user.id} 
                className="hover:bg-slate-800/30 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={18} className="text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                        {user.username}
                        {user.id === currentUser?.id && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">You</span>
                        )}
                        {user.system_role === 'super_admin' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Crown size={9} /> Super Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">ID: {user.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <SystemRoleBadge systemRole={user.system_role} />
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle size={12} />
                    Active
                  </span>
                </td>
                {/* ✅ FIX: Actions only rendered for Super Admin */}
                {isSuperAdmin && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Don't allow modifying Super Admin or self */}
                      {user.system_role !== 'super_admin' && user.id !== currentUser?.id ? (
                        <>
                          <select
                            value={user.role}
                            disabled={updating === user.id}
                            onChange={(e) => updateRole(user.id, e.target.value as 'admin' | 'member' | 'viewer')}
                            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 cursor-pointer transition-all"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button 
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDeleteId(user.id)}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600 italic">
                          {user.system_role === 'super_admin' ? 'Protected' : 'You'}
                        </span>
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="py-24 text-center">
            <UserPlus size={48} className="text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No users found.</p>
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          HARD DELETE CONFIRMATION MODAL (Double Confirm)
         ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmDeleteId && userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => { setConfirmDeleteId(null); setDeleteConfirmText(''); }} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-slate-900 border border-red-500/30 rounded-xl w-full max-w-md p-6 shadow-2xl shadow-red-500/10"
            >
              {/* Danger Icon */}
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-2 ring-red-500/20">
                <Skull size={28} className="text-red-500" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white text-center mb-1">
                ⚠️ Permanent Database Deletion
              </h3>
              <p className="text-red-400 text-xs text-center font-semibold uppercase tracking-wider mb-4">
                This action cannot be undone
              </p>

              {/* Warning Details */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-slate-300 text-sm">
                    You are about to <span className="text-red-400 font-bold">permanently erase</span>{' '}
                    <span className="text-white font-semibold">"{userToDelete.username}"</span> from the database.
                  </p>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 ml-6">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    User profile and auth record will be deleted forever
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    All their comments and notifications will be deleted
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    All their project memberships will be removed
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    Their owned projects will be transferred to you
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    Tasks they created/assigned will have their author cleared
                  </li>
                </ul>
              </div>

              {/* Double Confirmation Input */}
              <div className="mb-5">
                <label className="text-sm text-slate-400 block mb-2">
                  Type <span className="text-white font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded">{userToDelete.username}</span> to confirm:
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={userToDelete.username}
                  className="border-red-500/30 focus:border-red-500 focus:ring-red-500/20"
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => { setConfirmDeleteId(null); setDeleteConfirmText(''); }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 gap-2" 
                  onClick={() => hardDeleteUser(confirmDeleteId)} 
                  disabled={deleting || deleteConfirmText !== deleteConfirmRequired}
                >
                  {deleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Skull size={14} />
                      Delete Forever
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Role Badge Components ───

function SystemRoleBadge({ systemRole }: { systemRole: string }) {
  if (systemRole === 'super_admin') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
        <Crown size={12} />
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-500/10 text-slate-400 border-slate-500/20">
      <UserIcon size={12} />
      User
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles = {
    admin: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    member: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    viewer: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  }[role] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

  const icons = {
    admin: <ShieldCheck size={12} />,
    member: <Shield size={12} />,
    viewer: <ShieldAlert size={12} />,
  }[role] || <Shield size={12} />;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles)}>
      {icons}
      {role}
    </span>
  );
}
