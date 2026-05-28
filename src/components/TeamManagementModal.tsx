import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, ProjectMember, Project } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  X, Search, UserPlus, Users, Shield, ShieldCheck, Eye, Crown, ChevronDown,
  Check, Trash2, Loader2
} from 'lucide-react';

type Props = {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer';
  isSuperAdmin?: boolean;
};

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', desc: 'Can manage members & settings' },
  member: { label: 'Member', icon: Shield, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', desc: 'Can create & edit tasks' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', desc: 'Read-only access' },
};

export default function TeamManagementModal({ project, isOpen, onClose, currentUserRole, isSuperAdmin = false }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<(ProjectMember & { profiles: Profile })[]>([]);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Search / invite
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [showInviteRoleDropdown, setShowInviteRoleDropdown] = useState(false);

  // Role change dropdown
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null);

  // Delete confirmation
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  
  // Permanent user deletion (Super Admin)
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  useEffect(() => {
    if (isOpen) {
      fetchTeam();
    }
  }, [isOpen]);

  async function fetchTeam() {
    setLoading(true);

    // Fetch owner profile
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', project.owner_id)
      .single();
    setOwner(ownerData);

    // Fetch members with profiles
    const { data: memberRows } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', project.id);

    if (memberRows?.length) {
      const userIds = memberRows.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
      setMembers(
        memberRows.map(m => ({
          ...m,
          profiles: profileMap.get(m.user_id) as Profile,
        })).filter(m => m.profiles) // filter out any missing profiles
      );
    } else {
      setMembers([]);
    }

    setLoading(false);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${value.trim()}%`)
        .limit(10);

      // Filter out existing members and the owner
      const existingIds = new Set([project.owner_id, ...members.map(m => m.user_id)]);
      setSearchResults((data ?? []).filter(p => !existingIds.has(p.id)));
      setSearching(false);
    }, 400);
  }

  async function inviteMember(profile: Profile) {
    if (!user) return;

    const { error } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: profile.id,
      role: inviteRole,
    });

    if (error) {
      toast.error('Failed to add member', { description: error.message });
      return;
    }

    // Send notification
    if (profile.id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: profile.id,
        actor_id: user.id,
        action: 'added you to project',
        entity_type: 'project',
        entity_id: project.id,
        project_id: project.id,
      });
    }

    toast.success(`${profile.username} added as ${ROLE_CONFIG[inviteRole].label}`);
    setSearchQuery('');
    setSearchResults([]);
    fetchTeam();
  }

  async function changeRole(memberId: string, userId: string, newRole: 'admin' | 'member' | 'viewer') {
    const { error } = await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to update role');
      return;
    }

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    setRoleDropdownId(null);
    toast.success('Role updated');
  }

  async function removeMember(memberId: string, username: string) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to remove member');
      return;
    }

    setMembers(prev => prev.filter(m => m.id !== memberId));
    setConfirmRemoveId(null);
    toast.success(`${username} removed from project`);
  }

  async function deleteUserPermanently(userId: string, username: string) {
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });

    if (error) {
      toast.error('Failed to delete user', { description: error.message });
      return;
    }

    setMembers(prev => prev.filter(m => m.user_id !== userId));
    setConfirmDeleteUserId(null);
    setDeleteConfirmText('');
    toast.success(`${username} has been permanently deleted`);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => { if (!confirmRemoveId) onClose(); }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Team Management</h2>
              <p className="text-xs text-slate-500">{project.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Invite Section (only for owner/admin) */}
        {canManage && (
          <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={14} className="text-indigo-400" />
              <span className="text-sm font-medium text-slate-300">Add Members</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search by username..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {/* Role selector for invite */}
              <div className="relative">
                <button
                  onClick={() => setShowInviteRoleDropdown(!showInviteRoleDropdown)}
                  className={cn(
                    "h-9 px-3 flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
                    ROLE_CONFIG[inviteRole].bg, ROLE_CONFIG[inviteRole].border, ROLE_CONFIG[inviteRole].color
                  )}
                >
                  {ROLE_CONFIG[inviteRole].label}
                  <ChevronDown size={12} />
                </button>
                <AnimatePresence>
                  {showInviteRoleDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1"
                    >
                      {(Object.entries(ROLE_CONFIG) as [string, typeof ROLE_CONFIG.admin][]).map(([key, conf]) => (
                        <button
                          key={key}
                          onClick={() => { setInviteRole(key as 'admin' | 'member' | 'viewer'); setShowInviteRoleDropdown(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <conf.icon size={14} className={conf.color} />
                              <span className={cn("text-sm font-medium", conf.color)}>{conf.label}</span>
                            </div>
                            {inviteRole === key && <Check size={14} className="text-indigo-400" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 ml-6">{conf.desc}</p>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search Results */}
            <AnimatePresence>
              {(searchResults.length > 0 || searching) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-2 border border-slate-800 rounded-lg overflow-hidden bg-slate-800/50"
                >
                  {searching ? (
                    <div className="p-3 flex items-center justify-center text-slate-500 text-sm gap-2">
                      <Loader2 size={14} className="animate-spin" /> Searching...
                    </div>
                  ) : (
                    searchResults.map(profile => (
                      <button
                        key={profile.id}
                        onClick={() => inviteMember(profile)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-xs text-indigo-400 font-semibold">{profile.username[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{profile.username}</p>
                        </div>
                        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                          <UserPlus size={12} /> Add
                        </span>
                      </button>
                    ))
                  )}
                  {!searching && searchResults.length === 0 && searchQuery.trim() && (
                    <div className="p-3 text-center text-slate-500 text-sm">No users found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Members List */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Project Owner */}
              {owner && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/30">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                    {owner.avatar_url ? (
                      <img src={owner.avatar_url} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm text-amber-400 font-semibold">{owner.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200 truncate">{owner.username}</p>
                      {owner.id === user?.id && (
                        <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                    <Crown size={12} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">Owner</span>
                  </div>
                </div>
              )}

              {/* Regular Members */}
              {members.map(member => {
                const roleConf = ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.member;
                const isCurrentUser = member.user_id === user?.id;

                return (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/30 transition-colors group">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      {member.profiles?.avatar_url ? (
                        <img src={member.profiles.avatar_url} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm text-slate-300 font-semibold">{member.profiles?.username?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200 truncate">{member.profiles?.username}</p>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                    </div>

                    {/* Role Badge / Dropdown */}
                    <div className="relative">
                      {canManage && !isCurrentUser ? (
                        <button
                          onClick={() => setRoleDropdownId(roleDropdownId === member.id ? null : member.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:opacity-80",
                            roleConf.bg, roleConf.border, roleConf.color
                          )}
                        >
                          <roleConf.icon size={12} />
                          {roleConf.label}
                          <ChevronDown size={10} />
                        </button>
                      ) : (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
                          roleConf.bg, roleConf.border, roleConf.color
                        )}>
                          <roleConf.icon size={12} />
                          {roleConf.label}
                        </div>
                      )}

                      {/* Role Dropdown */}
                      <AnimatePresence>
                        {roleDropdownId === member.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                            className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1"
                          >
                            {(Object.entries(ROLE_CONFIG) as [string, typeof ROLE_CONFIG.admin][]).map(([key, conf]) => (
                              <button
                                key={key}
                                onClick={() => changeRole(member.id, member.user_id, key as 'admin' | 'member' | 'viewer')}
                                className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <conf.icon size={14} className={conf.color} />
                                    <span className={cn("text-sm font-medium", conf.color)}>{conf.label}</span>
                                  </div>
                                  {member.role === key && <Check size={14} className="text-indigo-400" />}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 ml-6">{conf.desc}</p>
                              </button>
                            ))}
                            <div className="border-t border-slate-700 mt-1 pt-1">
                              <button
                                onClick={() => { setRoleDropdownId(null); setConfirmRemoveId(member.id); }}
                                className="w-full text-left px-3 py-2 hover:bg-red-500/10 transition-colors flex items-center gap-2 text-red-400"
                              >
                                <Trash2 size={14} />
                                <span className="text-sm font-medium">Remove from project</span>
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => { setRoleDropdownId(null); setConfirmDeleteUserId(member.user_id); }}
                                  className="w-full text-left px-3 py-2 hover:bg-red-500/10 transition-colors flex items-center gap-2 text-red-500"
                                >
                                  <Trash2 size={14} />
                                  <span className="text-sm font-bold">Delete user permanently</span>
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}

              {members.length === 0 && !loading && (
                <div className="text-center py-8 text-slate-500">
                  <Users size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No team members yet</p>
                  {canManage && <p className="text-xs mt-1">Use the search above to add members</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {members.length + 1} member{members.length !== 0 ? 's' : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </motion.div>

      {/* Remove Confirmation Modal */}
      <AnimatePresence>
        {confirmRemoveId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/60" onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(null); }} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 size={32} className="mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Remove member?</h3>
              <p className="text-slate-400 text-sm mb-6">
                They will lose access to this project and all its tasks.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(null); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const member = members.find(m => m.id === confirmRemoveId);
                    if (member) await removeMember(member.id, member.profiles?.username ?? 'Member');
                  }}
                >
                  Remove
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permanent Delete User Confirmation (Super Admin) */}
      <AnimatePresence>
        {confirmDeleteUserId && (() => {
          const targetMember = members.find(m => m.user_id === confirmDeleteUserId);
          const targetName = targetMember?.profiles?.username ?? 'User';
          return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setConfirmDeleteUserId(null); setDeleteConfirmText(''); }} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <Trash2 size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Delete User Permanently</h3>
                <p className="text-slate-400 text-sm text-center mb-1">
                  This will permanently delete <span className="text-red-400 font-semibold">{targetName}</span> and:
                </p>
                <ul className="text-xs text-slate-500 mb-4 space-y-1 list-disc list-inside">
                  <li>All projects they own</li>
                  <li>All tasks they created</li>
                  <li>All their memberships</li>
                  <li>All their comments & activity</li>
                </ul>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-400 mb-2 font-medium">Type <span className="font-bold">DELETE</span> to confirm:</p>
                  <Input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="text-sm h-9 border-red-500/30 focus:border-red-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={(e) => { e.stopPropagation(); setConfirmDeleteUserId(null); setDeleteConfirmText(''); }}>Cancel</Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteConfirmText !== 'DELETE'}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteUserPermanently(confirmDeleteUserId, targetName);
                    }}
                  >
                    Delete Forever
                  </Button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
