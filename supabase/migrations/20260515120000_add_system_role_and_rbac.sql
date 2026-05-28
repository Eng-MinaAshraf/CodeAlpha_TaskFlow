-- Add system_role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS system_role text DEFAULT 'user' CHECK (system_role IN ('super_admin', 'user'));

-- Create super admin check function
CREATE OR REPLACE FUNCTION public.check_is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND system_role = 'super_admin'
  );
$$;

-- Update is_member_of to include super_admin bypass
CREATE OR REPLACE FUNCTION public.is_member_of(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN
    check_is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects WHERE id = p_id AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members WHERE project_id = p_id AND user_id = auth.uid()
    );
END;
$function$;

-- PROJECTS policies
DROP POLICY IF EXISTS "view_projects" ON projects;
CREATE POLICY "view_projects"
  ON projects FOR SELECT TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    owner_id = auth.uid() OR
    is_member_of(id)
  );

DROP POLICY IF EXISTS "Project owner can update" ON projects;
CREATE POLICY "Project owner can update"
  ON projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR check_is_super_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR check_is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Project owner can delete" ON projects;
CREATE POLICY "Project owner can delete"
  ON projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR check_is_super_admin(auth.uid()));

-- PROJECT_MEMBERS policies
DROP POLICY IF EXISTS "view_members" ON project_members;
CREATE POLICY "view_members"
  ON project_members FOR SELECT TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    is_member_of(project_id)
  );

DROP POLICY IF EXISTS "insert_members" ON project_members;
CREATE POLICY "insert_members"
  ON project_members FOR INSERT TO authenticated
  WITH CHECK (
    check_is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "delete_members" ON project_members;
CREATE POLICY "delete_members"
  ON project_members FOR DELETE TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "update_members" ON project_members;
CREATE POLICY "update_members"
  ON project_members FOR UPDATE TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  )
  WITH CHECK (
    check_is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

-- TASK_COMMENTS policies
DROP POLICY IF EXISTS "Members can view comments" ON task_comments;
CREATE POLICY "Members can view comments"
  ON task_comments FOR SELECT TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (
        EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert comments" ON task_comments;
CREATE POLICY "Members can insert comments"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (
      check_is_super_admin(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = task_id
        AND (
          EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.owner_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin','member'))
        )
      )
    )
  );

-- ACTIVITY_LOGS policies
DROP POLICY IF EXISTS "view_activity" ON activity_logs;
CREATE POLICY "view_activity"
  ON activity_logs FOR SELECT TO authenticated
  USING (
    check_is_super_admin(auth.uid()) OR
    is_member_of(project_id)
  );

DROP POLICY IF EXISTS "Members can log activity" ON activity_logs;
CREATE POLICY "Members can log activity"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (
      check_is_super_admin(auth.uid()) OR
      is_member_of(project_id)
    )
  );
