
-- Allow any authenticated user to look up referral codes by code value (for discount code validation)
CREATE POLICY "Authenticated lookup referral codes"
ON public.referral_codes FOR SELECT TO authenticated
USING (true);
