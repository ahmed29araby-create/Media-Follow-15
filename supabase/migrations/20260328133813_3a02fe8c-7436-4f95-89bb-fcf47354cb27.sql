
-- Add missing columns to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'vodafone_cash';
ALTER TABLE public.subscriptions ADD COLUMN granted_by UUID;

-- Add missing columns to subscription_payments
ALTER TABLE public.subscription_payments ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_payments ADD COLUMN sender_phone TEXT;
ALTER TABLE public.subscription_payments ADD COLUMN screenshot_path TEXT;
ALTER TABLE public.subscription_payments ADD COLUMN referral_code_used TEXT;

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referred_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read referrals" ON public.referrals FOR SELECT TO authenticated USING (
  referrer_org_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR referred_org_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Authenticated can insert referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (true);

-- Add referral_id FK to referral_credits
ALTER TABLE public.referral_credits ADD CONSTRAINT referral_credits_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE SET NULL;
