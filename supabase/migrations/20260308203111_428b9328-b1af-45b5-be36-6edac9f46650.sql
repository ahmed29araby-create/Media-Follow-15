
DROP POLICY IF EXISTS "Admins select org settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins insert org settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins update org settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins delete org settings" ON admin_settings;
DROP POLICY IF EXISTS "Authenticated read vodafone number" ON admin_settings;

CREATE POLICY "Admins select org settings" ON admin_settings
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id IS NULL)
  );

CREATE POLICY "Admins insert org settings" ON admin_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id IS NULL)
  );

CREATE POLICY "Admins update org settings" ON admin_settings
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id IS NULL)
  );

CREATE POLICY "Admins delete org settings" ON admin_settings
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
    OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id IS NULL)
  );

CREATE POLICY "Authenticated read vodafone number" ON admin_settings
  FOR SELECT TO authenticated
  USING (setting_key = 'vodafone_cash_number' AND organization_id IS NULL);
