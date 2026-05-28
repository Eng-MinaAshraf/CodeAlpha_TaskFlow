import { useState, useEffect } from 'react';
import { supabase, Notification } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Bell, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(id, username, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setNotifications(data);
  }

  async function markAsRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors relative"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-slate-900" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 lg:left-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]"
            >
              <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-800/50">
                <h3 className="font-semibold text-slate-200 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No notifications
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        onClick={() => {
                          markAsRead(notification.id);
                          setIsOpen(false);
                          if (notification.project_id) {
                            navigate(`/project/${notification.project_id}`);
                          }
                        }}
                        className={cn(
                          "p-3 hover:bg-slate-800/50 cursor-pointer transition-colors flex gap-3",
                          !notification.is_read ? "bg-slate-800/20" : "opacity-70"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          {notification.actor?.avatar_url ? (
                            <img src={notification.actor.avatar_url} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-slate-300">
                              {notification.actor?.username?.[0]?.toUpperCase() ?? '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 leading-tight">
                            <span className="font-medium text-slate-200">{notification.actor?.username}</span>{' '}
                            {notification.action}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(notification.created_at)}</p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
