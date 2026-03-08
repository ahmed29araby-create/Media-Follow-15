
-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add organization_id to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.change_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create member_settings table
CREATE TABLE IF NOT EXISTS public.member_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_name text NOT NULL DEFAULT 'uploads',
  price_per_video numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
ALTER TABLE public.member_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_member_settings_updated_at BEFORE UPDATE ON public.member_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  type text NOT NULL DEFAULT 'info',
  related_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, account_status, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'account_status', 'pending')::account_status,
    (NEW.raw_user_meta_data->>'organization_id')::uuid
  );
  RETURN NEW;
END;
$$;

-- Drop ALL existing RLS policies and recreate

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view org profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins update org profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Files
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Admins can view all files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;

CREATE POLICY "Users view own files" ON public.files FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view org files" ON public.files FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Users insert own files" ON public.files FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own files" ON public.files FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins update org files" ON public.files FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));

-- Change Requests
DROP POLICY IF EXISTS "Users can view own requests" ON public.change_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.change_requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.change_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.change_requests;

CREATE POLICY "Users view own requests" ON public.change_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view org requests" ON public.change_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Users create requests" ON public.change_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins update org requests" ON public.change_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));

-- Admin Settings
DROP POLICY IF EXISTS "Admins can select settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.admin_settings;

CREATE POLICY "Admins select org settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Admins insert org settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Admins update org settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Admins delete org settings" ON public.admin_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));

-- User Roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "View roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- Organizations
CREATE POLICY "Super admins manage orgs" ON public.organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Org members view own org" ON public.organizations FOR SELECT TO authenticated USING (id = public.get_user_organization_id(auth.uid()));

-- Member Settings
CREATE POLICY "Admins manage member settings" ON public.member_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id(auth.uid())));
CREATE POLICY "Members view own settings" ON public.member_settings FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Notifications
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
