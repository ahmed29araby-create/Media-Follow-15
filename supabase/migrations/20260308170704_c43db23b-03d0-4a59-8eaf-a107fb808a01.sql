CREATE POLICY "Authenticated read vodafone number"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (setting_key = 'vodafone_cash_number' AND organization_id IS NULL);