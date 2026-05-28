import { useMemo } from 'react';
import { Column, Task, Profile } from '../lib/supabase';
import { PRIORITY_CONFIG } from '../pages/BoardPage';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';

type ColumnWithTasks = Column & { tasks: (Task & { assignee?: Profile })[] };

type Props = {
  columns: ColumnWithTasks[];
};

export default function ProjectAnalytics({ columns }: Props) {
  // 1. Task Distribution by Column (Bar Chart)
  const columnData = useMemo(() => {
    return columns.map(col => ({
      name: col.title,
      tasks: col.tasks.length,
      fill: '#6366f1' // indigo-500
    }));
  }, [columns]);

  // 2. Task Priority Distribution (Pie Chart)
  const priorityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    columns.forEach(col => {
      col.tasks.forEach(task => {
        if (counts[task.priority as keyof typeof counts] !== undefined) {
          counts[task.priority as keyof typeof counts]++;
        }
      });
    });

    const colors = {
      low: '#94a3b8',    // slate-400
      medium: '#38bdf8', // sky-400
      high: '#fbbf24',   // amber-400
      urgent: '#f87171', // red-400
    };

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => ({
        name: PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG]?.label ?? key,
        value: count,
        fill: colors[key as keyof typeof colors]
      }));
  }, [columns]);

  // Stats
  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const completedTasks = columns.find(c => c.title.toLowerCase().includes('done') || c.title.toLowerCase().includes('complete'))?.tasks.length || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Tasks" value={totalTasks} />
        <StatCard title="Completed Tasks" value={completedTasks} />
        <StatCard title="Completion Rate" value={`${completionRate}%`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-300 font-medium mb-6">Tasks by Column</h3>
          <div className="h-64">
            <ResponsiveContainer width="99%" height={250} minWidth={1}>
              <BarChart data={columnData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Bar dataKey="tasks" radius={[4, 4, 0, 0]}>
                  {columnData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-300 font-medium mb-6">Tasks by Priority</h3>
          <div className="h-64 flex items-center justify-center">
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="99%" height={250} minWidth={1}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm">No tasks available</p>
            )}
            
            {/* Legend */}
            <div className="flex flex-col gap-3 ml-8">
              {priorityData.map(entry => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="text-slate-300 text-sm">{entry.name}</span>
                  <span className="text-slate-500 text-sm font-medium ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
      <span className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">{title}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  );
}
