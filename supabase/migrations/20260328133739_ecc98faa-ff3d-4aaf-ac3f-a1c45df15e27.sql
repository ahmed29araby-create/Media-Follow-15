
-- Create enums
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.file_status AS ENUM ('pending', 'approved', 'rejected', 'delete_requested');
CREATE TYPE public.quality_type AS ENUM ('original', 'proxy');
CREATE TYPE public.request_type AS ENUM ('edit', 'delete');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.org_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'member');

-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  disable_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  account_status public.account_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read org profiles" ON public.profiles FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User Roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin Settings
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(setting_key, organization_id)
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage own org settings" ON public.admin_settings FOR ALL TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Files
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  quality public.quality_type NOT NULL DEFAULT 'original',
  status public.file_status NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  drive_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own files" ON public.files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read org files" ON public.files FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can update org files" ON public.files FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Change Requests
CREATE TABLE public.change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_type public.request_type NOT NULL,
  new_file_name TEXT,
  reason TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own requests" ON public.change_requests FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read org requests" ON public.change_requests FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can update org requests" ON public.change_requests FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER update_change_requests_updated_at BEFORE UPDATE ON public.change_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Member Settings
CREATE TABLE public.member_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL DEFAULT 'uploads',
  price_per_video NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
ALTER TABLE public.member_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own member settings" ON public.member_settings FOR ALL TO authenticated USING (
  auth.uid() = user_id OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER update_member_settings_updated_at BEFORE UPDATE ON public.member_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member Subfolders
CREATE TABLE public.member_subfolders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_subfolders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can manage subfolders" ON public.member_subfolders FOR ALL TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Org Registration Requests
CREATE TABLE public.org_registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_name TEXT NOT NULL,
  org_email TEXT NOT NULL,
  admin_password TEXT NOT NULL,
  referral_code TEXT,
  whatsapp_phone TEXT,
  status public.org_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_registration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert registration requests" ON public.org_registration_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admins can read requests" ON public.org_registration_requests FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Super admins can update requests" ON public.org_registration_requests FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
);
CREATE TRIGGER update_org_requests_updated_at BEFORE UPDATE ON public.org_registration_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Org Appeals
CREATE TABLE public.org_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own appeals" ON public.org_appeals FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage appeals" ON public.org_appeals FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- Referral Codes
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read referral codes" ON public.referral_codes FOR SELECT USING (true);
CREATE POLICY "Org admins can manage referral codes" ON public.referral_codes FOR ALL TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Referral Credits
CREATE TABLE public.referral_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  source_description TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read credits" ON public.referral_credits FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  months INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Super admins can manage subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subscription Payments
CREATE TABLE public.subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  months INTEGER NOT NULL DEFAULT 1,
  payment_method TEXT NOT NULL DEFAULT 'vodafone_cash',
  receipt_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read payments" ON public.subscription_payments FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Org members can insert payments" ON public.subscription_payments FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Super admins can manage payments" ON public.subscription_payments FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
);
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for pending uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('pending_uploads', 'pending_uploads', false);
CREATE POLICY "Auth users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pending_uploads');
CREATE POLICY "Auth users can read own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pending_uploads');
