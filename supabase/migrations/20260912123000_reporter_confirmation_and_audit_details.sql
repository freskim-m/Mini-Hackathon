-- Securely records a citizen confirmation without allowing direct complaint updates.
CREATE OR REPLACE FUNCTION public.confirm_complaint_resolution(p_complaint_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.complaints
    WHERE id = p_complaint_id
      AND status = 'zgjidhur'
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nuk mund ta konfirmoni këtë rast';
  END IF;

  UPDATE public.complaints
  SET confirmed_by_reporter = true
  WHERE id = p_complaint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_complaint_resolution(uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at
  ON public.admin_activity_log (created_at DESC);
