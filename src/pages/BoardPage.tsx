import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, Project, Column, Task, Profile } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Trash2, LayoutGrid, Clock, Flag, Check, Pencil, MoreHorizontal,
  BarChart2, List as ListIcon, Kanban, Users
} from 'lucide-react';
import TaskModal from '../components/TaskModal';
import ProjectList from '../components/ProjectList';
import ProjectAnalytics from '../components/ProjectAnalytics';
import TeamManagementModal from '../components/TeamManagementModal';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn, getAvatarColor, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type ColumnWithTasks = Column & { tasks: (Task & { assignee?: Profile })[] };

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-700/50', border: 'border-slate-600/30' },
  medium: { label: 'Medium', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  high: { label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export default function BoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'analytics'>('board');
  
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColTitle, setEditingColTitle] = useState('');
  
  // RBAC state
  const [userProjectRole, setUserProjectRole] = useState<'owner' | 'admin' | 'member' | 'viewer'>('viewer');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const isSuperAdmin = profile?.system_role === 'super_admin';
  const canManage = userProjectRole === 'owner' || userProjectRole === 'admin' || isSuperAdmin;
  const canEdit = canManage || userProjectRole === 'member';

  // DnD state
  const [activeColumn, setActiveColumn] = useState<ColumnWithTasks | null>(null);
  const [activeTask, setActiveTask] = useState<Task & { assignee?: Profile } | null>(null);

  // Use a ref to keep track of the latest columns state for DnD event handlers
  const columnsRef = useRef<ColumnWithTasks[]>([]);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }), // 3px drag before activation
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (projectId) {
      fetchBoard();

      // Subscribe to Realtime Changes
      const channel = supabase.channel(`board-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, payload => {
          // Simplistic realtime refetch for now to keep state consistent with dnd-kit
          fetchBoard();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` }, payload => {
          fetchBoard();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [projectId]);

  async function fetchBoard() {
    if (!projectId) return;
    setLoading(true);
    
    const [projectRes, colsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('columns').select('*').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('position')
    ]);

    if (projectRes.error) {
      toast.error('Project not found');
      navigate('/');
      return;
    }

    setProject(projectRes.data);

    // Determine current user's role in this project
    if (user) {
      if (projectRes.data.owner_id === user.id) {
        setUserProjectRole('owner');
      } else {
        const { data: memberData } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (memberData) {
          setUserProjectRole(memberData.role as 'admin' | 'member' | 'viewer');
        } else {
          setUserProjectRole('viewer');
        }
      }
    }

    // Resolve assignees
    const assigneeIds = [...new Set((tasksRes.data ?? []).map(t => t.assignee_id).filter(Boolean))];
    let assigneeMap = new Map<string, Profile>();
    if (assigneeIds.length > 0) {
      const { data: assigneeProfiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', assigneeIds);
      assigneeMap = new Map((assigneeProfiles ?? []).map(p => [p.id, p as Profile]));
    }

    const columnsWithTasks: ColumnWithTasks[] = (colsRes.data ?? []).map(col => ({
      ...col,
      tasks: (tasksRes.data ?? [])
        .filter(t => t.column_id === col.id)
        .map(t => ({ ...t, assignee: t.assignee_id ? assigneeMap.get(t.assignee_id) : undefined })),
    }));

    setColumns(columnsWithTasks);
    setLoading(false);
  }

  async function logActivity(action: string, entity: string, entityName: string) {
    if (!user || !project) return;
    await supabase.from('activity_logs').insert({
      project_id: project.id,
      user_id: user.id,
      action,
      entity,
      entity_name: entityName,
    });
  }

  // Column Actions
  async function addColumn() {
    if (!newColumnTitle.trim() || !user || !project) return;
    const position = columns.length;
    const { data, error } = await supabase
      .from('columns')
      .insert({ project_id: project.id, title: newColumnTitle.trim(), position })
      .select().single();
      
    if (error) { toast.error('Failed to add column'); return; }
    if (data) {
      setColumns(prev => [...prev, { ...data, tasks: [] }]);
      await logActivity('created', 'column', data.title);
      toast.success('Column added');
    }
    setNewColumnTitle('');
    setAddingColumn(false);
  }

  async function deleteColumn(col: ColumnWithTasks) {
    if (col.tasks.length > 0) {
      toast.error('Cannot delete', { description: 'Remove all tasks from this column first' });
      return;
    }
    await supabase.from('columns').delete().eq('id', col.id);
    setColumns(prev => prev.filter(c => c.id !== col.id));
    toast.success('Column deleted');
  }

  async function renameColumn(col: ColumnWithTasks) {
    if (!editingColTitle.trim()) { setEditingColId(null); return; }
    await supabase.from('columns').update({ title: editingColTitle.trim() }).eq('id', col.id);
    setColumns(prev => prev.map(c => c.id === col.id ? { ...c, title: editingColTitle.trim() } : c));
    setEditingColId(null);
  }

  function handleTaskUpdate(updatedTask: Task) {
    setColumns(prev => {
      return prev.map(c => {
        const hasTask = c.tasks.some(t => t.id === updatedTask.id);
        if (hasTask) {
          if (c.id === updatedTask.column_id) {
            return { ...c, tasks: c.tasks.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t) };
          } else {
            return { ...c, tasks: c.tasks.filter(t => t.id !== updatedTask.id) };
          }
        } else {
          if (c.id === updatedTask.column_id) {
            return { ...c, tasks: [...c.tasks, updatedTask as any] };
          }
          return c;
        }
      });
    });
  }

  // Task Actions
  async function addTask(columnId: string) {
    if (!newTaskTitle.trim() || !user || !project) return;
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    const position = col.tasks.length;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        column_id: columnId,
        project_id: project.id,
        title: newTaskTitle.trim(),
        position,
        created_by: user.id,
      })
      .select().single();
      
    if (error) { toast.error('Failed to add task'); return; }
    if (data) {
      setColumns(prev => prev.map(c => c.id === columnId ? { ...c, tasks: [...c.tasks, data] } : c));
      await logActivity('created', 'task', data.title);
      toast.success('Task added');
    }
    setNewTaskTitle('');
    setAddingTaskCol(null);
  }

  // DnD Handlers
  const columnsId = useMemo(() => columns.map(col => col.id), [columns]);

  function onDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData?.type === 'Column') {
      setActiveColumn(activeData.column);
      return;
    }
    if (activeData?.type === 'Task') {
      setActiveTask(activeData.task);
      return;
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    // Dropping a Task over another Task
    if (isActiveTask && isOverTask) {
      setColumns(columns => {
        const activeIndex = columns.findIndex(col => col.tasks.some(t => t.id === activeId));
        const overIndex = columns.findIndex(col => col.tasks.some(t => t.id === overId));
        if (activeIndex === -1 || overIndex === -1) return columns;

        const activeCol = columns[activeIndex];
        const overCol = columns[overIndex];

        const activeTaskIndex = activeCol.tasks.findIndex(t => t.id === activeId);
        const overTaskIndex = overCol.tasks.findIndex(t => t.id === overId);

        if (activeCol.id === overCol.id) {
          // Same column sort
          const newTasks = arrayMove(activeCol.tasks, activeTaskIndex, overTaskIndex);
          return columns.map((col, i) => i === activeIndex ? { ...col, tasks: newTasks } : col);
        } else {
          // Cross column move
          const activeTask = activeCol.tasks[activeTaskIndex];
          const newColumns = [...columns];
          newColumns[activeIndex] = {
            ...activeCol,
            tasks: activeCol.tasks.filter(t => t.id !== activeId)
          };
          const newOverTasks = [...overCol.tasks];
          newOverTasks.splice(overTaskIndex, 0, { ...activeTask, column_id: overCol.id });
          newColumns[overIndex] = { ...overCol, tasks: newOverTasks };
          return newColumns;
        }
      });
    }

    // Dropping a Task over an empty Column
    if (isActiveTask && isOverColumn) {
      setColumns(columns => {
        const activeIndex = columns.findIndex(col => col.tasks.some(t => t.id === activeId));
        const overIndex = columns.findIndex(col => col.id === overId);
        if (activeIndex === -1 || overIndex === -1) return columns;

        const activeCol = columns[activeIndex];
        const overCol = columns[overIndex];
        if (activeCol.id === overCol.id) return columns;

        const activeTaskIndex = activeCol.tasks.findIndex(t => t.id === activeId);
        const activeTask = activeCol.tasks[activeTaskIndex];
        
        const newColumns = [...columns];
        newColumns[activeIndex] = { ...activeCol, tasks: activeCol.tasks.filter(t => t.id !== activeId) };
        newColumns[overIndex] = { ...overCol, tasks: [...overCol.tasks, { ...activeTask, column_id: overCol.id }] };
        return newColumns;
      });
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveColumn = active.data.current?.type === 'Column';
    if (isActiveColumn) {
      setColumns(columns => {
        const activeColumnIndex = columns.findIndex(col => col.id === activeId);
        const overColumnIndex = columns.findIndex(col => col.id === overId);
        const newColumns = arrayMove(columns, activeColumnIndex, overColumnIndex);
        
        // Sync column positions to DB in background
        Promise.all(newColumns.map((col, idx) => 
          supabase.from('columns').update({ position: idx }).eq('id', col.id)
        )).catch(console.error);
        
        return newColumns;
      });
      return;
    }

    const isActiveTask = active.data.current?.type === 'Task';
    if (isActiveTask) {
       const latestColumns = columnsRef.current;
       const task = active.data.current?.task;
       const colId = latestColumns.find(c => c.tasks.some(t => t.id === task.id))?.id;
       if (!colId) return;
       
       const col = latestColumns.find(c => c.id === colId);
       if (!col) return;

       const finalIndex = col.tasks.findIndex(t => t.id === task.id);
       
       // Update the dragged task's final position and column
       await supabase.from('tasks').update({ 
         column_id: colId, 
         position: finalIndex 
       }).eq('id', task.id);
       
       // Sync positions of ALL tasks in the target column to prevent DOM mismatch
       Promise.all(col.tasks.map((t, idx) => 
         supabase.from('tasks').update({ position: idx }).eq('id', t.id)
       )).catch(console.error);
       
       if (task.column_id !== colId) {
         logActivity('moved', 'task', task.title);
       }
    }
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-2 h-8 bg-sky-500/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl shrink-0 h-14 flex items-center px-6 justify-between animate-fadeInDown">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-indigo-400" />
            <h1 className="text-white font-semibold tracking-tight text-lg">{project.name}</h1>
            <span className="ml-2 bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">
              {columns.reduce((sum, c) => sum + c.tasks.length, 0)} Tasks
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => setViewMode('board')} 
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all", viewMode === 'board' ? "bg-slate-800 text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300")}
            >
              <Kanban size={14} /> Board
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all", viewMode === 'list' ? "bg-slate-800 text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300")}
            >
              <ListIcon size={14} /> List
            </button>
            <button 
              onClick={() => setViewMode('analytics')} 
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all", viewMode === 'analytics' ? "bg-slate-800 text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300")}
            >
              <BarChart2 size={14} /> Analytics
            </button>
          </div>

          {/* Right side: Team & Role */}
          <div className="flex items-center gap-3">
            {/* User Role Badge */}
            <div className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
              isSuperAdmin ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
              userProjectRole === 'owner' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
              userProjectRole === 'admin' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
              userProjectRole === 'member' ? "bg-sky-500/10 border-sky-500/30 text-sky-400" :
              "bg-slate-500/10 border-slate-500/30 text-slate-400"
            )}>
              {isSuperAdmin ? 'Super Admin' : userProjectRole === 'owner' ? 'Owner' : userProjectRole.charAt(0).toUpperCase() + userProjectRole.slice(1)}
            </div>

            {/* Manage Team Button */}
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTeamModal(true)}
                className="gap-1.5 text-xs"
              >
                <Users size={14} />
                Team
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'board' && (
          <div className="h-full overflow-x-auto overflow-y-hidden p-6 scrollbar-thin">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
              <div className="flex gap-5 h-full items-start min-w-max">
                <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
                  {columns.map(col => (
                    <ColumnContainer
                      key={col.id}
                      column={col}
                      editingColId={editingColId}
                      editingColTitle={editingColTitle}
                      setEditingColId={setEditingColId}
                      setEditingColTitle={setEditingColTitle}
                      renameColumn={renameColumn}
                      deleteColumn={deleteColumn}
                      addingTaskCol={addingTaskCol}
                      setAddingTaskCol={setAddingTaskCol}
                      newTaskTitle={newTaskTitle}
                      setNewTaskTitle={setNewTaskTitle}
                      addTask={addTask}
                      onTaskClick={(t: Task) => { setSelectedTask(t); setSelectedColumnId(col.id); }}
                    />
                  ))}
                </SortableContext>

                {/* Add Column Button */}
                {canEdit && (
                <div className="flex-shrink-0 w-72 h-fit">
                  {addingColumn ? (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 animate-in fade-in zoom-in-95">
                      <Input
                        value={newColumnTitle}
                        onChange={e => setNewColumnTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingColumn(false); }}
                        placeholder="Column name..."
                        autoFocus
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addColumn}>Add</Button>
                        <Button size="icon" variant="ghost" onClick={() => setAddingColumn(false)}><X size={14}/></Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingColumn(true)}
                      className="w-full flex items-center gap-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-dashed border-slate-800 hover:border-slate-700 px-4 py-3 rounded-xl transition-all font-medium"
                    >
                      <Plus size={16} /> Add Column
                    </button>
                  )}
                </div>
                )}
              </div>

              <DragOverlay>
                {activeColumn && <ColumnContainer column={activeColumn} isOverlay />}
                {activeTask && <TaskCard task={activeTask} isOverlay />}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="h-full bg-slate-950 animate-fadeIn">
            <ProjectList 
              columns={columns} 
              onTaskClick={(t: Task, colId: string) => { setSelectedTask(t); setSelectedColumnId(colId); }} 
              onUpdateTask={handleTaskUpdate}
            />
          </div>
        )}

        {viewMode === 'analytics' && (
          <div className="h-full overflow-y-auto bg-slate-950 animate-fadeIn">
            <ProjectAnalytics columns={columns} />
          </div>
        )}
      </div>

      {/* Task Modal */}
      {selectedTask && selectedColumnId && (
        <TaskModal
          task={selectedTask}
          project={project}
          columnId={selectedColumnId}
          columns={columns}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={(id) => setColumns(prev => prev.map(c => ({...c, tasks: c.tasks.filter(t => t.id !== id)})))}
          onLog={logActivity}
        />
      )}

      {/* Team Management Modal */}
      {project && (
        <TeamManagementModal
          project={project}
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          currentUserRole={userProjectRole}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}

// Subcomponents

function ColumnContainer({ 
  column, isOverlay, editingColId, editingColTitle, setEditingColId, setEditingColTitle, renameColumn, deleteColumn, addingTaskCol, setAddingTaskCol, newTaskTitle, setNewTaskTitle, addTask, onTaskClick
}: any) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'Column', column },
    disabled: editingColId === column.id || addingTaskCol === column.id
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const tasksIds = useMemo(() => column.tasks.map((t: Task) => t.id), [column.tasks]);

  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="flex-shrink-0 w-80 h-[500px] border-2 border-indigo-500/50 bg-indigo-500/5 rounded-xl opacity-50" />;
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn("flex-shrink-0 w-80 flex flex-col max-h-full bg-slate-900/50 border border-slate-800/80 rounded-xl", isOverlay && "rotate-2 scale-105 shadow-2xl ring-2 ring-indigo-500")}
    >
      {/* Header */}
      <div 
        {...attributes} 
        {...listeners} 
        className="flex items-center justify-between p-3 cursor-grab active:cursor-grabbing border-b border-slate-800/50"
      >
        {editingColId === column.id ? (
          <Input
            value={editingColTitle}
            onChange={e => setEditingColTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') renameColumn(column); if (e.key === 'Escape') setEditingColId(null); }}
            onBlur={() => renameColumn(column)}
            autoFocus
            className="h-8 text-sm"
          />
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="font-semibold text-slate-200 text-sm">{column.title}</span>
            <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">{column.tasks.length}</span>
          </div>
        )}
        <div className="flex items-center">
          <button onClick={() => { setEditingColId(column.id); setEditingColTitle(column.title); }} className="p-1.5 text-slate-500 hover:text-slate-300 rounded"><Pencil size={14}/></button>
          {column.tasks.length === 0 && (
            <button onClick={() => deleteColumn(column)} className="p-1.5 text-slate-500 hover:text-red-400 rounded"><Trash2 size={14}/></button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        <div className="flex flex-col gap-2 min-h-[50px]">
          <SortableContext items={tasksIds} strategy={verticalListSortingStrategy}>
            {column.tasks.map((task: Task) => (
              <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
            ))}
          </SortableContext>
        </div>
      </div>

      {/* Footer Add Task */}
      <div className="p-2 border-t border-slate-800/50 mt-auto">
        {addingTaskCol === column.id ? (
          <div className="animate-in slide-in-from-top-2">
            <textarea
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask(column.id); } if (e.key === 'Escape') setAddingTaskCol(null); }}
              placeholder="Task title..."
              className="w-full bg-slate-800 text-sm text-slate-100 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <Button size="sm" onClick={() => addTask(column.id)}>Add</Button>
              <Button size="icon" variant="ghost" onClick={() => setAddingTaskCol(null)}><X size={14}/></Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingTaskCol(column.id)} className="w-full flex items-center gap-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 p-2 rounded-lg transition-colors text-sm font-medium group">
            <Plus size={16} className="group-hover:text-indigo-400 transition-colors" /> New issue
          </button>
        )}
      </div>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: any, onClick: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task }
  });

  const style = { transition, transform: CSS.Transform.toString(transform) };

  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="h-24 bg-slate-800 border border-slate-700/50 rounded-lg opacity-30" />;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, isOverlay }: { task: any, isOverlay?: boolean }) {
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className={cn(
      "bg-slate-900 border border-slate-700/60 hover:border-slate-600 rounded-lg p-3 cursor-grab active:cursor-grabbing group transition-colors shadow-sm",
      isOverlay && "rotate-3 scale-105 shadow-xl ring-2 ring-indigo-500 cursor-grabbing bg-slate-800"
    )}>
      <p className="text-slate-200 text-sm font-medium mb-3 leading-snug">{task.title}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded border", priority.bg, priority.color, priority.border)}>
            <Flag size={10} />
          </span>
          {task.due_date && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", isOverdue ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400')}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        
        {task.assignee && (
          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-medium overflow-hidden">
            {task.assignee.avatar_url ? (
               <img src={task.assignee.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
               task.assignee.username[0].toUpperCase()
            )}
          </div>
        )}
      </div>
    </div>
  );
}
