/**
 * Figma Manager Edge Function
 * Handles Figma file attachment, sync, and metadata retrieval
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { TABLES } from "../_shared/tables.ts";
import { validateFigmaManagerInput } from "../_shared/validation.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getFigmaAccessToken } from "../_shared/credentials.ts";
import { ERROR_CODES, buildErrorResponse, getHttpStatus } from "../_shared/errorCodes.ts";

// ============================================================================
// Types
// ============================================================================

interface FigmaConfig {
  accessToken: string;
}

interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
  version: string;
}

// ============================================================================
// Helpers
// ============================================================================

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

  return { valid: true, user };
}

async function figmaRequest(
  endpoint: string,
  config: FigmaConfig,
  options: { method?: string; body?: any } = {}
): Promise<any> {
  const { accessToken } = config;
  
  if (!accessToken) {
    throw new Error('Figma access token not configured');
  }

  const url = `https://api.figma.com/v1${endpoint}`;
  
  console.log(`[figma-manager] Requesting: ${options.method || 'GET'} ${url}`);
  
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'X-Figma-Token': accessToken,
      'Content-Type': 'application/json',
    },
  };
  
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[figma-manager] API Error ${response.status}:`, errorText);
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  try {
    // Validate user authentication
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('[figma-manager] Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = validation.user?.id;
    const authHeader = req.headers.get('Authorization')!;
    console.log('[figma-manager] Request from:', validation.user?.email);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let requestBody: any;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, ...params } = requestBody;
    
    // Validate input
    const validationResult = validateFigmaManagerInput({ action, ...params });
    if (!validationResult.valid) {
      return new Response(
        JSON.stringify({ error: validationResult.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[figma-manager] Action: ${action}`, params);

    // Get Figma access token
    const getFigmaConfig = async (): Promise<FigmaConfig> => {
      const accessToken = await getFigmaAccessToken(authHeader);
      
      if (!accessToken) {
        throw new Error('Figma access token not configured. Please set up your credentials in Settings → Integrations → Figma.');
      }

      return { accessToken };
    };

    // Action handlers
    switch (action) {
      case 'test-connection': {
        try {
          const config = await getFigmaConfig();
          // Test by fetching user info
          const user = await figmaRequest('/me', config);
          return new Response(
            JSON.stringify({ 
              success: true, 
              connected: true,
              user: { 
                id: user.id, 
                handle: user.handle,
                email: user.email 
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              connected: false,
              error: error instanceof Error ? error.message : 'Connection failed'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get-file': {
        const { fileKey } = params;
        const config = await getFigmaConfig();
        
        const file = await figmaRequest(`/files/${fileKey}?depth=1`, config);
        
        return new Response(
          JSON.stringify({
            success: true,
            file: {
              key: fileKey,
              name: file.name,
              thumbnail_url: file.thumbnailUrl,
              last_modified: file.lastModified,
              version: file.version,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-nodes': {
        const { fileKey, nodeIds } = params;
        const config = await getFigmaConfig();
        
        let endpoint = `/files/${fileKey}/nodes`;
        if (nodeIds && nodeIds.length > 0) {
          endpoint += `?ids=${nodeIds.join(',')}`;
        }
        
        const data = await figmaRequest(endpoint, config);
        
        return new Response(
          JSON.stringify({
            success: true,
            nodes: data.nodes || {}
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'attach-file': {
        const { fileKey, promptRowId } = params;
        
        if (!promptRowId) {
          return new Response(
            JSON.stringify({ error: 'promptRowId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch file metadata from Figma
        const config = await getFigmaConfig();
        const file = await figmaRequest(`/files/${fileKey}?depth=1`, config);
        
        // Get next position
        const { data: existingFiles } = await supabase
          .from(TABLES.FIGMA_FILES)
          .select('position')
          .eq('prompt_row_id', promptRowId)
          .order('position', { ascending: false })
          .limit(1);
        
        const nextPosition = existingFiles && existingFiles.length > 0 
          ? (existingFiles[0].position || 0) + 1 
          : 0;

        // Insert into database
        const { data: insertedFile, error: insertError } = await supabase
          .from(TABLES.FIGMA_FILES)
          .insert({
            prompt_row_id: promptRowId,
            file_key: fileKey,
            file_name: file.name,
            thumbnail_url: file.thumbnailUrl,
            last_modified: file.lastModified,
            version: file.version,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            position: nextPosition,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[figma-manager] Insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to attach file' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, file: insertedFile }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'detach-file': {
        const { rowId } = params;
        
        const { error: deleteError } = await supabase
          .from(TABLES.FIGMA_FILES)
          .delete()
          .eq('row_id', rowId);

        if (deleteError) {
          console.error('[figma-manager] Delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to detach file' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync-file': {
        const { rowId } = params;
        
        // Get existing file record
        const { data: existingFile, error: fetchError } = await supabase
          .from(TABLES.FIGMA_FILES)
          .select('*')
          .eq('row_id', rowId)
          .single();

        if (fetchError || !existingFile) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch latest from Figma
        const config = await getFigmaConfig();
        const file = await figmaRequest(`/files/${existingFile.file_key}?depth=1`, config);
        
        // Update database
        const { data: updatedFile, error: updateError } = await supabase
          .from(TABLES.FIGMA_FILES)
          .update({
            file_name: file.name,
            thumbnail_url: file.thumbnailUrl,
            last_modified: file.lastModified,
            version: file.version,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('row_id', rowId)
          .select()
          .single();

        if (updateError) {
          console.error('[figma-manager] Update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to sync file' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, file: updatedFile }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-attached': {
        const { promptRowId } = params;
        
        let query = supabase
          .from(TABLES.FIGMA_FILES)
          .select('*')
          .order('position', { ascending: true });

        if (promptRowId) {
          query = query.eq('prompt_row_id', promptRowId);
        }

        const { data: files, error: listError } = await query;

        if (listError) {
          console.error('[figma-manager] List error:', listError);
          return new Response(
            JSON.stringify({ error: 'Failed to list attached files' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, files: files || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add-comment': {
        const { fileKey, comment } = params;
        
        if (!comment) {
          return new Response(
            JSON.stringify({ error: 'comment is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const config = await getFigmaConfig();
        const result = await figmaRequest(`/files/${fileKey}/comments`, config, {
          method: 'POST',
          body: { message: comment }
        });

        return new Response(
          JSON.stringify({ success: true, comment: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[figma-manager] Unhandled error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    return new Response(
      JSON.stringify(
        isNotConfigured 
          ? buildErrorResponse(ERROR_CODES.FIGMA_NOT_CONFIGURED, errorMessage)
          : { error: errorMessage }
      ),
      { 
        status: isNotConfigured ? 400 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
