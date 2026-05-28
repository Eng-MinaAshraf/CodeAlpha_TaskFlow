import { useState, useEffect } from 'react';
import { supabase, Task, TaskComment, Column, Project, Profile } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Editor } from './ui/Editor';
import { Button } from './ui/Button';
import {
  X, Flag, Calendar, AlignLeft, MessageSquare,
  Trash2, Check, User, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate } from '../lib/utils';
import { PRIORITY_CONFIG } from '../pages/BoardPage';
import { CheckCircle2, Circle, Tag, Plus } from 'lucide-react';

type Props = {
  task: Task;
  project: Project;
  columnId: string;
  columns: (Column & { tasks: Task[] })[];
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onLog: (action: string, entity: string, name: string) => Promise<void>;
};

export default function TaskModal({ task, project, columns, onClose, onUpdate, onDelete, onLog }: Props) {
  const { user } = useAuth();
  
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [columnId, setColumnId] = useState(task.column_id);
  const [tags, setTags] = useState<string[]>(task.tags ?? []);
  const [newTag, setNewTag] = useState('');
  
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  
  const [comments, setComments] = useState<(TaskComment & { profiles?: Profile })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [members, setMembers] = useState<Profile[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  
  // Dropdowns
  const [showPriority, setShowPriority] = useState(false);
  const [showAssignee, setShowAssignee] = useState(false);
  const [showColumn, setShowColumn] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchMembers();
    fetchActivity();
    fetchSubtasks();
  }, [task.id]);

  async function fetchSubtasks() {
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', task.id).order('position');
    if (data) setSubtasks(data);
  }

  async function fetchComments() {
    const { data: commentsData } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at');
    if (!commentsData?.length) { setComments([]); return; }
    
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
    const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    
    setComments(commentsData.map(c => ({ ...c, profiles: profileMap.get(c.user_id) as Profile })));
  }

  async function fetchMembers() {
    const [{ data: owner }, { data: memberRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', project.owner_id).maybeSingle(),
      supabase.from('project_members').select('user_id').eq('project_id', project.id)
    ]);
    
    const all = owner ? [owner] : [];
    if (memberRows?.length) {
      const memberIds = memberRows.map(r => r.user_id).filter(id => id !== project.owner_id);
      if (memberIds.length) {
        const { data: memberProfiles } = await supabase.from('profiles').select('*').in('id', memberIds);
        (memberProfiles ?? []).forEach(p => all.push(p));
      }
    }
    setMembers(all);
  }

  async function fetchActivity() {
    const { data: logsData } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('project_id', project.id)
      .eq('entity_name', task.title)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!logsData?.length) return;
    const userIds = [...new Set(logsData.map(l => l.user_id).filter(Boolean))];
    const { data: profilesData } = await supabase.from('profiles').select('id, username').in('id', userIds);
    const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    setActivity(logsData.map(l => ({ ...l, profiles: profileMap.get(l.user_id) })));
  }

  async function saveTask(overrides?: Partial<Task>) {
    setSaving(true);
    const updates = { 
      title: title.trim(), 
      description: description.trim(), 
      priority, 
      due_date: dueDate || null, 
      assignee_id: assigneeId || null, 
      column_id: columnId, 
      tags,
      ...overrides
    };
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', task.id).select().single();
    if (error) { toast.error('Save failed'); } 
    else if (data) { 
      onUpdate({ ...task, ...data }); 
      await onLog('updated', 'task', title.trim()); 
      toast.success('Task saved'); 
      
      // Notifications logic
      if (user) {
        const notificationsToInsert = [];
        
        // Mentions in description
        const mentionRegex = /data-id="([^"]+)"/g;
        const mentionedIds = new Set<string>();
        let match;
        while ((match = mentionRegex.exec(description)) !== null) {
          mentionedIds.add(match[1]);
        }
        
        Array.from(mentionedIds).forEach(mentionedId => {
          if (mentionedId !== user.id) {
            notificationsToInsert.push({
              user_id: mentionedId, actor_id: user.id, action: 'mentioned you in a task', entity_type: 'task', entity_id: task.id, project_id: project.id
            });
          }
        });

        // Assignment
        if (assigneeId && assigneeId !== task.assignee_id && assigneeId !== user.id) {
          notificationsToInsert.push({
            user_id: assigneeId, actor_id: user.id, action: 'assigned you a task', entity_type: 'task', entity_id: task.id, project_id: project.id
          });
        }

        if (notificationsToInsert.length > 0) {
          await supabase.from('notifications').insert(notificationsToInsert);
        }
      }
    }
    setSaving(false);
  }

  async function deleteTask() {
    setConfirmDelete(false);
    onDelete(task.id);
    onClose();
    
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      toast.error('Failed to delete task');
    } else {
      await onLog('deleted', 'task', task.title);
      toast.success('Task deleted');
    }
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag('');
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter(t => t !== tagToRemove));
  }

  async function addSubtask(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newSubtask.trim()) {
      e.preventDefault();
      const { data } = await supabase.from('subtasks').insert({ task_id: task.id, title: newSubtask.trim(), position: subtasks.length }).select().single();
      if (data) setSubtasks([...subtasks, data]);
      setNewSubtask('');
    }
  }

  async function toggleSubtask(id: string, is_completed: boolean) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, is_completed } : s));
    await supabase.from('subtasks').update({ is_completed }).eq('id', id);
  }

  async function deleteSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id));
    await supabase.from('subtasks').delete().eq('id', id);
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    
    // Extract mentions from HTML: <span data-type="mention" data-id="user-uuid">
    const mentionRegex = /data-id="([^"]+)"/g;
    const mentionedIds = new Set<string>();
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentionedIds.add(match[1]);
    }

    const { data, error } = await supabase.from('task_comments').insert({ task_id: task.id, user_id: user.id, content: newComment.trim() }).select().single();
    if (error) { toast.error('Comment failed'); return; }
    
    if (data) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setComments(prev => [...prev, { ...data, profiles: profile as Profile }]);
      toast.success('Comment added');

      // Send notifications
      const notificationsToInsert = Array.from(mentionedIds).filter(id => id !== user.id).map(mentionedId => ({
        user_id: mentionedId,
        actor_id: user.id,
        action: 'mentioned you in a comment',
        entity_type: 'task',
        entity_id: task.id,
        project_id: project.id
      }));

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }
    }
    setNewComment('');
  }

  const currentPriority = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const currentColumn = columns.find(c => c.id === columnId);
  const assignee = members.find(m => m.id === assigneeId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Slide-over Panel */}
      <motion.div 
        initial={{ x: '100%', opacity: 0.5 }} 
        animate={{ x: 0, opacity: 1 }} 
        exit={{ x: '100%', opacity: 0.5 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col"
      >
        {/* Header Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <span className="text-indigo-400">{project.name}</span>
            <span>/</span>
            <span>{currentColumn?.title}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="text-slate-500 hover:text-red-400 hover:bg-red-500/10">
              <Trash2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Title */}
            <div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => saveTask()}
                className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-600 focus:outline-none resize-none transition-colors border-b border-transparent focus:border-indigo-500/50 pb-1"
                placeholder="Task title"
              />
            </div>

            {/* Meta Attributes Panel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-800/30 border border-slate-800/60 rounded-xl">
              
              {/* Status/Column */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1.5 block">Status</label>
                <div className="relative">
                  <button onClick={() => { setShowColumn(!showColumn); setShowAssignee(false); setShowPriority(false); }} className="flex items-center gap-2 w-full text-left text-sm text-slate-300 hover:bg-slate-800 p-1.5 -ml-1.5 rounded-md transition-colors">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    {currentColumn?.title}
                  </button>
                  <AnimatePresence>
                    {showColumn && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                        {columns.map(col => (
                          <button key={col.id} onClick={() => { setColumnId(col.id); setShowColumn(false); saveTask({ column_id: col.id }); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 flex justify-between items-center text-slate-300">
                            {col.title} {columnId === col.id && <Check size={14} className="text-indigo-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1.5 block">Priority</label>
                <div className="relative">
                  <button onClick={() => { setShowPriority(!showPriority); setShowColumn(false); setShowAssignee(false); }} className="flex items-center gap-2 w-full text-left text-sm text-slate-300 hover:bg-slate-800 p-1.5 -ml-1.5 rounded-md transition-colors">
                    <Flag size={14} className={currentPriority.color} />
                    {currentPriority.label}
                  </button>
                  <AnimatePresence>
                    {showPriority && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                        {Object.entries(PRIORITY_CONFIG).map(([val, conf]) => (
                          <button key={val} onClick={() => { setPriority(val as Task['priority']); setShowPriority(false); saveTask({ priority: val as Task['priority'] }); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-2"><Flag size={12} className={conf.color} /> {conf.label}</span>
                            {priority === val && <Check size={14} className="text-indigo-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1.5 block">Assignee</label>
                <div className="relative">
                  <button onClick={() => { setShowAssignee(!showAssignee); setShowColumn(false); setShowPriority(false); }} className="flex items-center gap-2 w-full text-left text-sm text-slate-300 hover:bg-slate-800 p-1.5 -ml-1.5 rounded-md transition-colors">
                    {assignee ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] border border-indigo-500/40">
                        {assignee.username[0].toUpperCase()}
                      </div>
                    ) : <User size={14} className="text-slate-500" />}
                    {assignee ? assignee.username : 'Unassigned'}
                  </button>
                  <AnimatePresence>
                    {showAssignee && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-48 overflow-y-auto">
                        <button onClick={() => { setAssigneeId(''); setShowAssignee(false); saveTask({ assignee_id: null }); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-slate-400 flex justify-between items-center">
                          Unassigned {!assigneeId && <Check size={14} className="text-indigo-400" />}
                        </button>
                        {members.map(m => (
                          <button key={m.id} onClick={() => { setAssigneeId(m.id); setShowAssignee(false); saveTask({ assignee_id: m.id }); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 flex justify-between items-center text-slate-300">
                            {m.username} {assigneeId === m.id && <Check size={14} className="text-indigo-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1.5 block">Due Date</label>
                <div className="flex items-center gap-2 w-full text-left text-sm text-slate-300 hover:bg-slate-800 p-1.5 -ml-1.5 rounded-md transition-colors">
                  <Calendar size={14} className="text-slate-500" />
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} onBlur={() => saveTask()} className="bg-transparent focus:outline-none w-full" />
                </div>
              </div>

            </div>

            {/* Labels / Tags */}
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                <Tag size={16} /> Labels
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md border border-slate-700">
                    {tag}
                    <button onClick={() => { removeTag(tag); saveTask(); }} className="text-slate-500 hover:text-red-400"><X size={12} /></button>
                  </span>
                ))}
                <input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { handleAddTag(e); if (e.key === 'Enter') setTimeout(() => saveTask(), 100); }}
                  placeholder="Add label..."
                  className="bg-transparent border border-dashed border-slate-700 text-xs text-slate-300 px-2 py-1 rounded-md focus:outline-none focus:border-indigo-500 w-24 placeholder-slate-600"
                />
              </div>
            </div>

            {/* Description Editor */}
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                <AlignLeft size={16} /> Description
              </div>
              <Editor content={description} onChange={setDescription} mentionUsers={members} />
              {description !== task.description && (
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={() => saveTask()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                <CheckCircle2 size={16} /> Subtasks
              </div>
              
              <div className="space-y-2 mb-3">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 group">
                    <button onClick={() => toggleSubtask(sub.id, !sub.is_completed)} className={cn("text-slate-500 hover:text-indigo-400 transition-colors", sub.is_completed && "text-emerald-500 hover:text-emerald-400")}>
                      {sub.is_completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    <span className={cn("text-sm text-slate-300 flex-1", sub.is_completed && "line-through text-slate-500")}>{sub.title}</span>
                    <button onClick={() => deleteSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Plus size={16} className="text-slate-500" />
                <input
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={addSubtask}
                  placeholder="Add a subtask..."
                  className="flex-1 bg-transparent border-none text-sm text-slate-300 placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Activity & Comments Tabs */}
            <div className="pt-6 border-t border-slate-800/60 mt-4">
              <div className="flex items-center gap-6 border-b border-slate-800 mb-6">
                <button 
                  onClick={() => setActiveTab('comments')} 
                  className={cn("pb-2 text-sm font-semibold transition-colors flex items-center gap-2", activeTab === 'comments' ? "text-indigo-400 border-b-2 border-indigo-400" : "text-slate-500 hover:text-slate-300")}
                >
                  <MessageSquare size={14}/> Comments <span className="bg-slate-800 text-xs px-1.5 py-0.5 rounded-full">{comments.length}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('activity')} 
                  className={cn("pb-2 text-sm font-semibold transition-colors flex items-center gap-2", activeTab === 'activity' ? "text-indigo-400 border-b-2 border-indigo-400" : "text-slate-500 hover:text-slate-300")}
                >
                  <Activity size={14}/> Activity Log
                </button>
              </div>
              
              {activeTab === 'comments' && (
                <div className="animate-fadeIn">
                  <div className="space-y-4 mb-6">
                    {comments.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No comments yet.</p>
                    ) : (
                      comments.map((item: any) => (
                        <div key={`comment-${item.id}`} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.profiles?.avatar_url ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs text-slate-300 font-medium">{item.profiles?.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-semibold text-slate-200 text-sm">{item.profiles?.username}</span>
                              <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl rounded-tl-none p-3 text-sm text-slate-300">
                              <div dangerouslySetInnerHTML={{ __html: item.content }} className="prose prose-sm prose-invert" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="flex gap-3 items-start relative mt-8">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <span className="text-xs text-indigo-400 font-medium">{user?.email?.[0].toUpperCase()}</span>
                    </div>
                    <form onSubmit={postComment} className="flex-1 relative">
                      <Editor content={newComment} onChange={setNewComment} placeholder="Write a comment..." mentionUsers={members} />
                      <div className="flex justify-end mt-2">
                        <Button type="submit" size="sm" disabled={!newComment || newComment === '<p></p>'}>Comment</Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="animate-fadeIn space-y-4 mb-6">
                  {activity.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No recent activity for this task.</p>
                  ) : (
                    activity.map((item: any) => (
                      <div key={`log-${item.id}`} className="flex items-start gap-3 pl-2 opacity-80">
                        <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Activity size={10} className="text-slate-400" />
                        </div>
                        <div className="flex-1 text-sm text-slate-400">
                          <span className="font-medium text-slate-300">{item.profiles?.username ?? 'Someone'}</span> {item.action} {item.entity} <span className="text-indigo-400">"{item.entity_name}"</span>
                          <span className="text-xs text-slate-600 ml-2">{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
              <Trash2 size={32} className="mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Delete this task?</h3>
              <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={() => { deleteTask(); onClose(); }}>Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
