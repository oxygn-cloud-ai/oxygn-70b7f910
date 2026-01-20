-- Create validation function for response_format
CREATE OR REPLACE FUNCTION public.validate_response_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip validation if response_format is null or empty
  IF NEW.response_format IS NULL OR NEW.response_format = '' THEN
    RETURN NEW;
  END IF;
  
  -- Check if response_format is valid JSON
  BEGIN
    PERFORM NEW.response_format::jsonb;
  EXCEPTION WHEN others THEN
    -- If it's a known legacy format, auto-convert it
    IF NEW.response_format = 'json_object' THEN
      NEW.response_format := '{"type": "json_object"}';
    ELSIF NEW.response_format = 'json_schema' THEN
      NEW.response_format := '{"type": "json_schema"}';
    ELSIF NEW.response_format = 'text' THEN
      NEW.response_format := '{"type": "text"}';
    ELSE
      RAISE EXCEPTION 'response_format must be valid JSON, got: %', NEW.response_format;
    END IF;
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger on q_prompts table
DROP TRIGGER IF EXISTS validate_response_format_trigger ON q_prompts;
CREATE TRIGGER validate_response_format_trigger
  BEFORE INSERT OR UPDATE ON q_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_response_format();