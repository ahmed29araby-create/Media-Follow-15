CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, account_status, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'account_status', 'pending')::account_status,
    CASE WHEN NEW.raw_user_meta_data->>'organization_id' IS NOT NULL 
         THEN (NEW.raw_user_meta_data->>'organization_id')::uuid 
         ELSE NULL END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS admin_settings_setting_key_key;

GRANT INSERT ON public.org_registration_requests TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete own org settings' AND tablename = 'admin_settings') THEN
    CREATE POLICY "Admins can delete own org settings"
    ON public.admin_settings FOR DELETE TO authenticated
    USING (
      (organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.user_id = auth.uid()))
      OR has_role(auth.uid(), 'super_admin'::app_role)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admin can manage global settings' AND tablename = 'admin_settings') THEN
    CREATE POLICY "Super admin can manage global settings"
    ON public.admin_settings FOR ALL TO authenticated
    USING (organization_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (organization_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;