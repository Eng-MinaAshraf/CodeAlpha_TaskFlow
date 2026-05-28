import { useState, useMemo } from 'react';
import { Column, Task, Profile, supabase } from '../lib/supabase';
import { PRIORITY_CONFIG } from '../pages/BoardPage';
import { formatDate, cn } from '../lib/utils';
import { Flag, Clock, User, CheckCircle2, Circle, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type ColumnWithTasks = Column & { tasks: (Task & { assignee?: Profile })[] };

type Props = {
  columns: ColumnWithTasks[];
  onTaskClick: (task: Task, columnId: string) => void;
  onUpdateTask?: (updatedTask: any) => void;
};

type SortKey = 'title' | 'priority' | 'due_date' | 'column';
type SortConfig = {
  key: SortKey;
  direction: 'asc' | 'desc';
} | null;

export default function ProjectList({ columns, onTaskClick, onUpdateTask }: Props) {
  const { user } = useAuth();
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Flatten tasks for the list view
  const allTasks = useMemo(() => {
    return columns.flatMap(col => 
      col.tasks.map(task => ({ ...task, columnTitle: col.title }))
    );
  }, [columns]);

  // Filter and Sort Tasks
  const processedTasks = useMemo(() => {
    let sortedTasks = [...allTasks];

    // Filter
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      sortedTasks = sortedTasks.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.columnTitle.toLowerCase().includes(q) ||
        t.assignee?.username?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortConfig !== null) {
      sortedTasks.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

        // Custom sorting logic for priority
        if (sortConfig.key === 'priority') {
          const pOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = pOrder[a.priority as keyof typeof pOrder] || 0;
          bValue = pOrder[b.priority as keyof typeof pOrder] || 0;
        }

        // Custom sorting for column
        if (sortConfig.key === 'column') {
          aValue = a.columnTitle;
          bValue = b.columnTitle;
        }

        // Handle nulls
        if (aValue === null) aValue = '';
        if (bValue === null) bValue = '';

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortedTasks;
  }, [allTasks, filterQuery, sortConfig]);

  const requestSort = (key: SortKey | null) => {
    if (!key) return;
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  async function toggleTaskStatus(task: any) {
    if (!user) return;
    const doneCol = columns.find(c => c.title.toLowerCase().includes('done') || c.title.toLowerCase().includes('complete'));
    const todoCol = columns[0]; // Assuming first col is To Do

    if (!doneCol || !todoCol) {
      toast.error('Could not find appropriate columns to move task');
      return;
    }

    const isDone = task.column_id === doneCol.id;
    const targetCol = isDone ? todoCol : doneCol;
    const targetPosition = targetCol.tasks.length;
    
    // Optimistic UI update
    if (onUpdateTask) {
      onUpdateTask({ ...task, column_id: targetCol.id, position: targetPosition });
    }

    const { error } = await supabase
      .from('tasks')
      .update({ column_id: targetCol.id, position: targetPosition })
      .eq('id', task.id);

    if (error) toast.error('Failed to update status');
    else toast.success(isDone ? 'Marked as To Do' : 'Marked as Done');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/30 flex items-center gap-4 shrink-0">
        <input
          type="text"
          placeholder="Filter tasks..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-64"
        />
        <div className="text-slate-500 text-sm ml-auto">
          Showing {processedTasks.length} tasks
        </div>
      </div>

      {/* List Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
        <div className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('title')}>
          Task Name <ArrowUpDown size={12} className={cn("opacity-0 transition-opacity", sortConfig?.key === 'title' && "opacity-100 text-indigo-400")} />
        </div>
        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('column')}>
          Status <ArrowUpDown size={12} className={cn("opacity-0 transition-opacity", sortConfig?.key === 'column' && "opacity-100 text-indigo-400")} />
        </div>
        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('priority')}>
          Priority <ArrowUpDown size={12} className={cn("opacity-0 transition-opacity", sortConfig?.key === 'priority' && "opacity-100 text-indigo-400")} />
        </div>
        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('due_date')}>
          Due Date <ArrowUpDown size={12} className={cn("opacity-0 transition-opacity", sortConfig?.key === 'due_date' && "opacity-100 text-indigo-400")} />
        </div>
        <div className="col-span-1 text-right">Assignee</div>
      </div>

      {/* List Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {processedTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No tasks found.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {processedTasks.map((task, idx) => {
              const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              const isDone = task.columnTitle.toLowerCase().includes('done') || task.columnTitle.toLowerCase().includes('complete');

              return (
                <div 
                  key={task.id} 
                  onClick={() => onTaskClick(task, task.column_id)}
                  className="grid grid-cols-12 gap-4 px-6 py-3 items-center group hover:bg-slate-800/40 cursor-pointer transition-colors animate-fadeIn"
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                      className={cn("text-slate-500 hover:text-indigo-400 transition-colors", isDone && "text-emerald-500 hover:text-emerald-400")}
                    >
                      {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    <span className={cn("text-sm font-medium text-slate-200 truncate", isDone && "text-slate-500 line-through")}>
                      {task.title}
                    </span>
                  </div>
                  
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-sm text-slate-400 truncate">{task.columnTitle}</span>
                  </div>

                  <div className="col-span-2 flex items-center gap-1.5">
                    <Flag size={12} className={priority.color} />
                    <span className={cn("text-sm", priority.color)}>{priority.label}</span>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    {task.due_date ? (
                      <>
                        <Clock size={12} className={isOverdue && !isDone ? "text-red-400" : "text-slate-500"} />
                        <span className={cn("text-sm", isOverdue && !isDone ? "text-red-400 font-medium" : "text-slate-400")}>
                          {formatDate(task.due_date)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-600">-</span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end">
                    {task.assignee ? (
                      <div 
                        className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-medium overflow-hidden group-hover:ring-2 ring-indigo-500/30 transition-all"
                        title={task.assignee.username}
                      >
                        {task.assignee.avatar_url ? (
                          <img src={task.assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          task.assignee.username[0].toUpperCase()
                        )}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-600" title="Unassigned">
                        <User size={12} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
