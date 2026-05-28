/*
  # Project Management Tool Schema

  1. New Tables
    - `profiles` - User profiles
    - `projects` - Top-level projects
    - `project_members` - Members and roles per project
    - `columns` - Kanban columns
    - `tasks` - Task cards
    - `task_comments` - Comments on tasks
    - `activity_logs` - Audit log

  2. Security
    - RLS enabled on all tables
    - Policies scoped to project membership
    - Note: project SELECT policy is added after project_members table exists
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Projects (basic table — RLS policies added after project_members)
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Helper functions to break RLS recursion
CREATE OR REPLACE FUNCTION public.check_is_project_member(p_id uuid, u_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_id AND user_id = u_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_project_owner(p_id uuid, u_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_id AND owner_id = u_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now add projects RLS policies (project_members exists)
CREATE POLICY "Project members can view project"
  ON projects FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    check_is_project_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Project owner can update"
  ON projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owner can delete"
  ON projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- project_members RLS policies
CREATE POLICY "Project members can view membership"
  ON project_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    check_is_project_owner(project_id, auth.uid()) OR
    check_is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Project admin or owner can add members"
  ON project_members FOR INSERT TO authenticated
  WITH CHECK (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "Project owner can delete members"
  ON project_members FOR DELETE TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid())
  );

-- Columns
CREATE TABLE IF NOT EXISTS columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view columns"
  ON columns FOR SELECT TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    check_is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Non-viewer members can insert columns"
  ON columns FOR INSERT TO authenticated
  WITH CHECK (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  );

CREATE POLICY "Non-viewer members can update columns"
  ON columns FOR UPDATE TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  )
  WITH CHECK (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  );

CREATE POLICY "Admin/owner can delete columns"
  ON columns FOR DELETE TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view tasks"
  ON tasks FOR SELECT TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    check_is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Non-viewer members can insert tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  );

CREATE POLICY "Non-viewer members can update tasks"
  ON tasks FOR UPDATE TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  )
  WITH CHECK (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  );

CREATE POLICY "Non-viewer members can delete tasks"
  ON tasks FOR DELETE TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
    )
  );

-- Task Comments
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view comments"
  ON task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (
        check_is_project_owner(t.project_id, auth.uid()) OR
        check_is_project_member(t.project_id, auth.uid())
      )
    )
  );

CREATE POLICY "Non-viewer members can insert comments"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (
        check_is_project_owner(t.project_id, auth.uid()) OR
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member')
        )
      )
    )
  );

CREATE POLICY "Comment author can delete own comment"
  ON task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view activity"
  ON activity_logs FOR SELECT TO authenticated
  USING (
    check_is_project_owner(project_id, auth.uid()) OR
    check_is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Project members can log activity"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (
      check_is_project_owner(project_id, auth.uid()) OR
      check_is_project_member(project_id, auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_columns_project_id ON columns(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
