-- Drop the duplicate unique constraint on q_rate_limits
-- We already have 'unique_rate_limit_window' index, so the original constraint is redundant
ALTER TABLE q_rate_limits DROP CONSTRAINT IF EXISTS q_rate_limits_user_id_endpoint_window_start_key;