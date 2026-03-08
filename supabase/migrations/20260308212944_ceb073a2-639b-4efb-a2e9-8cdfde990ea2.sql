
-- Add disable_reason to organizations
ALTER TABLE public.organizations ADD COLUMN disable_reason text;

-- Create org_appeals table
CREATE TABLE public.org_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid
);

ALTER TABLE public.org_appeals ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins manage appeals" ON public.org_appeals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Org admins can insert appeals for their own org
CREATE POLICY "Admins insert own org appeals" ON public.org_appeals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id = get_user_organization_id(auth.uid())
  );

-- Org admins can view their own appeals
CREATE POLICY "Admins view own org appeals" ON public.org_appeals
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() AND
    organization_id = get_user_organization_id(auth.uid())
  );
