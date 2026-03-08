
-- Referral codes: each org gets a unique code
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Org admins can view their own referral code
CREATE POLICY "Org admins view own referral code"
ON public.referral_codes FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Super admins manage all referral codes
CREATE POLICY "Super admins manage referral codes"
ON public.referral_codes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Referrals: tracks which org referred which org
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referred_org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view own referrals"
ON public.referrals FOR SELECT TO authenticated
USING (referrer_org_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admins manage referrals"
ON public.referrals FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Referral credits: tracks credit balance per org
CREATE TABLE public.referral_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  source_description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view own credits"
ON public.referral_credits FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admins manage credits"
ON public.referral_credits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Allow authenticated users to read referral settings
CREATE POLICY "Authenticated read referral settings"
ON public.admin_settings FOR SELECT TO authenticated
USING (setting_key IN ('referral_percentage', 'credit_expiry_months') AND organization_id IS NULL);
