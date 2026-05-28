import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  avatar_url: string;
  role: 'admin' | 'member' | 'viewer';
  system_role: 'super_admin' | 'user';
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  profiles?: Profile;
};

export type Column = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  created_at: string;
};

export type Task = {
  id: string;
  column_id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  position: number;
  created_by: string | null;
  created_at: string;
  tags?: string[];
  profiles?: Profile;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
};

export type ActivityLog = {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_name: string;
  created_at: string;
  profiles?: Profile;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  project_id: string;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
};
