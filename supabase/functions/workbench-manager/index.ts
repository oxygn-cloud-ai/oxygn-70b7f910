import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  if (!isAllowedDomain(user.email)) {
    return { valid: false, error: 'Access denied. Only chocfin.com and oxygn.cloud accounts are allowed.' };
  }

  return { valid: true, user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = validation.user?.id;
    console.log('Workbench manager request from:', validation.user?.email);

    const { action, ...params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Action:', action, 'Params:', JSON.stringify(params).substring(0, 200));

    switch (action) {
      // Thread management
      case 'create_thread': {
        const { title } = params;
        
        const { data, error } = await supabase
          .from('q_workbench_threads')
          .insert({
            title: title || 'New Thread',
            owner_id: userId,
            user_id: userId,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        console.log('Created thread:', data.row_id);
        return new Response(
          JSON.stringify({ success: true, thread: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_thread': {
        const { thread_row_id, updates } = params;

        // Verify ownership
        const { data: existing } = await supabase
          .from('q_workbench_threads')
          .select('owner_id')
          .eq('row_id', thread_row_id)
          .single();

        if (!existing || existing.owner_id !== userId) {
          return new Response(
            JSON.stringify({ error: 'Thread not found or not authorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('q_workbench_threads')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('row_id', thread_row_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, thread: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_thread': {
        const { thread_row_id } = params;

        // Soft delete
        const { error } = await supabase
          .from('q_workbench_threads')
          .update({ is_active: false })
          .eq('row_id', thread_row_id)
          .eq('owner_id', userId);

        if (error) throw error;

        console.log('Deleted thread:', thread_row_id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // File sync to OpenAI
      case 'sync_file': {
        const { file_row_id } = params;

        // Get file record
        const { data: file, error: fileError } = await supabase
          .from('q_workbench_files')
          .select('*')
          .eq('row_id', file_row_id)
          .single();

        if (fileError || !file) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('workbench-files')
          .download(file.storage_path);

        if (downloadError || !fileData) {
          throw new Error('Failed to download file from storage');
        }

        const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAIApiKey) {
          throw new Error('OpenAI API key not configured');
        }

        // Upload to OpenAI
        const formData = new FormData();
        formData.append('purpose', 'assistants');
        formData.append('file', new File([fileData], file.original_filename, { type: file.mime_type }));

        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
          body: formData
        });

        if (!uploadResponse.ok) {
          const err = await uploadResponse.json();
          throw new Error(err.error?.message || 'Failed to upload to OpenAI');
        }

        const uploadResult = await uploadResponse.json();
        console.log('Uploaded to OpenAI:', uploadResult.id);

        // Update database record
        await supabase
          .from('q_workbench_files')
          .update({
            openai_file_id: uploadResult.id,
            upload_status: 'synced'
          })
          .eq('row_id', file_row_id);

        return new Response(
          JSON.stringify({ success: true, openai_file_id: uploadResult.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Confluence page sync
      case 'sync_confluence_page': {
        const { link_row_id } = params;

        // Get page link record
        const { data: link, error: linkError } = await supabase
          .from('q_workbench_confluence_links')
          .select('*')
          .eq('row_id', link_row_id)
          .single();

        if (linkError || !link) {
          return new Response(
            JSON.stringify({ error: 'Confluence link not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get confluence_base_url from settings (shared org-wide)
        const { data: baseUrlSetting } = await supabase
          .from('q_settings')
          .select('setting_value')
          .eq('setting_key', 'confluence_base_url')
          .single();

        const confluenceBaseUrl = baseUrlSetting?.setting_value;
        
        // Get user-specific credentials from encrypted store
        const encryptionKey = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY');

        if (!encryptionKey) {
          return new Response(
            JSON.stringify({ error: 'Encryption key not configured. Please contact administrator.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: emailResult } = await supabase.rpc('decrypt_credential', {
          p_user_id: userId,
          p_service: 'confluence',
          p_key: 'email',
          p_encryption_key: encryptionKey
        });

        const { data: tokenResult } = await supabase.rpc('decrypt_credential', {
          p_user_id: userId,
          p_service: 'confluence',
          p_key: 'api_token',
          p_encryption_key: encryptionKey
        });

        const confluenceEmail = emailResult;
        const confluenceToken = tokenResult;

        if (!confluenceBaseUrl || !confluenceEmail || !confluenceToken) {
          return new Response(
            JSON.stringify({ error: 'Confluence credentials not configured. Please set up your credentials in Settings > Integrations.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Ensure baseUrl has correct format
        let cleanBaseUrl = confluenceBaseUrl.replace(/\/+$/, '');
        if (!cleanBaseUrl.endsWith('/wiki')) {
          cleanBaseUrl += '/wiki';
        }

        // Fetch page content
        const pageResponse = await fetch(
          `${cleanBaseUrl}/api/v2/pages/${link.page_id}?body-format=storage`,
          {
            headers: {
              'Authorization': `Basic ${btoa(`${confluenceEmail}:${confluenceToken}`)}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!pageResponse.ok) {
          const errorText = await pageResponse.text();
          console.error('[workbench-manager] Confluence API error:', pageResponse.status, errorText);
          throw new Error(`Failed to fetch Confluence page: ${pageResponse.status}`);
        }

        const pageData = await pageResponse.json();
        
        // Extract text content
        const htmlContent = pageData.body?.storage?.value || '';
        const textContent = htmlContent
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Update record
        await supabase
          .from('q_workbench_confluence_links')
          .update({
            content_text: textContent,
            page_title: pageData.title || link.page_title,
            sync_status: 'synced'
          })
          .eq('row_id', link_row_id);

        console.log('[workbench-manager] Synced Confluence page:', link.page_id);

        return new Response(
          JSON.stringify({ success: true, content_length: textContent.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('Error in workbench-manager:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
