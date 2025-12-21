-- Update the prompt_owner_emails view to reference q_prompts instead of cyg_prompts
CREATE OR REPLACE VIEW public.prompt_owner_emails AS
SELECT 
  p.row_id as prompt_row_id,
  p.owner_id,
  public.get_user_email(p.owner_id) as owner_email
FROM public.q_prompts p
WHERE p.owner_id IS NOT NULL;