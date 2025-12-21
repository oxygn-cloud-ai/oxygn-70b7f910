import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES, FK } from "../_shared/tables.ts";
import { getConfluenceToolsAssistants, getBuiltinToolsAssistants } from "../_shared/tools.ts";

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

// Legacy alias for backward compatibility - now uses shared module
function getConfluenceTools() {
  return getConfluenceToolsAssistants();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user and domain
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User validated:', validation.user?.email);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { action, assistant_row_id, ...body } = await req.json();

    console.log('Assistant manager request:', { action, assistant_row_id, user: validation.user?.email });

    // LIST - Fetch all assistants from OpenAI and cross-reference with local data
    if (action === 'list') {
      // Fetch all assistants from OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/assistants?limit=100', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      if (!openaiResponse.ok) {
        const error = await openaiResponse.json();
        console.error('Failed to fetch OpenAI assistants:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to fetch assistants from OpenAI' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const openaiData = await openaiResponse.json();
      const openaiAssistants = openaiData.data || [];

      // Fetch local assistant records with linked prompt names
      const { data: localAssistants, error: localError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select(`
          row_id,
          name,
          status,
          openai_assistant_id,
          prompt_row_id,
          confluence_enabled,
          ${FK.ASSISTANTS_PROMPT}(
            row_id,
            prompt_name
          )
        `);

      if (localError) {
        console.error('Failed to fetch local assistants:', localError);
      }

      // Create a map of openai_assistant_id -> local record
      const localMap = new Map();
      (localAssistants || []).forEach((la: any) => {
        if (la.openai_assistant_id) {
          localMap.set(la.openai_assistant_id, la);
        }
      });

      // Enrich OpenAI assistants with local data
      const enrichedAssistants = openaiAssistants.map((oa: any) => {
        const local = localMap.get(oa.id);
        const promptData = local?.[FK.ASSISTANTS_PROMPT.split('!')[0]] || local?.[TABLES.PROMPTS];
        return {
          openai_id: oa.id,
          name: oa.name,
          model: oa.model,
          created_at: oa.created_at,
          local_row_id: local?.row_id || null,
          local_status: local?.status || null,
          prompt_row_id: local?.prompt_row_id || null,
          prompt_name: promptData?.prompt_name || null,
          is_orphaned: !local,
          confluence_enabled: local?.confluence_enabled || false,
        };
      });

      console.log(`Listed ${enrichedAssistants.length} assistants from OpenAI`);

      return new Response(
        JSON.stringify({ assistants: enrichedAssistants }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INSTANTIATE - Create Assistant in OpenAI
    if (action === 'instantiate') {
      // Fetch assistant config
      const { data: assistant, error: fetchError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .single();

      if (fetchError || !assistant) {
        console.error('Failed to fetch assistant:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch tool defaults if using global
      let toolConfig = {
        code_interpreter_enabled: assistant.code_interpreter_enabled,
        file_search_enabled: assistant.file_search_enabled,
        function_calling_enabled: assistant.function_calling_enabled,
      };

      if (assistant.use_global_tool_defaults) {
        const { data: defaults } = await supabase
          .from(TABLES.ASSISTANT_TOOL_DEFAULTS)
          .select('*')
          .limit(1)
          .single();

        if (defaults) {
          toolConfig = {
            code_interpreter_enabled: defaults.code_interpreter_enabled,
            file_search_enabled: defaults.file_search_enabled,
            function_calling_enabled: defaults.function_calling_enabled,
          };
        }
      }

      // Fetch prompt for model settings if not overridden
      const { data: prompt } = await supabase
        .from(TABLES.PROMPTS)
        .select('model, temperature, max_tokens, top_p')
        .eq('row_id', assistant.prompt_row_id)
        .single();

      const modelId = assistant.model_override || prompt?.model || 'gpt-4o';
      
      // Resolve temperature, max_tokens, top_p (assistant overrides first, then prompt values)
      const temperature = assistant.temperature_override 
        ? parseFloat(assistant.temperature_override) 
        : (prompt?.temperature ? parseFloat(prompt.temperature) : undefined);
      const maxTokens = assistant.max_tokens_override 
        ? parseInt(assistant.max_tokens_override, 10) 
        : (prompt?.max_tokens ? parseInt(prompt.max_tokens, 10) : undefined);
      const topP = assistant.top_p_override 
        ? parseFloat(assistant.top_p_override) 
        : (prompt?.top_p ? parseFloat(prompt.top_p) : undefined);

      // Fetch files separately
      const { data: filesData } = await supabase
        .from(TABLES.ASSISTANT_FILES)
        .select('*')
        .eq('assistant_row_id', assistant_row_id);

      // Upload files to OpenAI if any
      const uploadedFileIds: string[] = [];
      const files = filesData || [];

      for (const file of files) {
        if (file.openai_file_id) {
          uploadedFileIds.push(file.openai_file_id);
          continue;
        }

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from('assistant-files')
          .download(file.storage_path);

        if (downloadError || !fileData) {
          console.error('Failed to download file:', file.storage_path, downloadError);
          continue;
        }

        // Upload to OpenAI Files API - convert Blob to File to preserve filename
        const fileWithName = new File(
          [fileData],
          file.original_filename,
          { type: file.mime_type || 'application/octet-stream' }
        );
        const formData = new FormData();
        formData.append('file', fileWithName);
        formData.append('purpose', 'assistants');
        console.log('Uploading file with name:', file.original_filename);

        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          uploadedFileIds.push(uploadResult.id);

          // Update file record with OpenAI file ID
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ openai_file_id: uploadResult.id, upload_status: 'uploaded' })
            .eq('row_id', file.row_id);

          console.log('Uploaded file to OpenAI:', uploadResult.id);
        } else {
          const error = await uploadResponse.json();
          console.error('Failed to upload file to OpenAI:', error);
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
        }
      }

      // Create vector store if file_search is enabled and we have files
      let vectorStoreId = assistant.vector_store_id;

      if (toolConfig.file_search_enabled && uploadedFileIds.length > 0 && !vectorStoreId) {
        // Check if using shared vector store
        if (assistant.use_shared_vector_store && assistant.shared_vector_store_row_id) {
          const { data: sharedStore } = await supabase
            .from(TABLES.VECTOR_STORES)
            .select('openai_vector_store_id')
            .eq('row_id', assistant.shared_vector_store_row_id)
            .single();

          if (sharedStore?.openai_vector_store_id) {
            vectorStoreId = sharedStore.openai_vector_store_id;
          }
        }

        // Create new vector store if not using shared
        if (!vectorStoreId) {
          const vsResponse = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: `${assistant.name} - Vector Store`,
              file_ids: uploadedFileIds,
            }),
          });

          if (vsResponse.ok) {
            const vsResult = await vsResponse.json();
            vectorStoreId = vsResult.id;
            console.log('Created vector store:', vectorStoreId);
          } else {
            console.error('Failed to create vector store:', await vsResponse.json());
          }
        }
      }

      // Build tools array
      const tools: any[] = [];
      if (toolConfig.code_interpreter_enabled) {
        tools.push({ type: 'code_interpreter' });
      }
      if (toolConfig.file_search_enabled) {
        tools.push({ type: 'file_search' });
      }
      // Add Confluence tools if enabled
      if (assistant.confluence_enabled) {
        tools.push(...getConfluenceTools());
      }

      // Create Assistant in OpenAI
      const assistantBody: any = {
        name: assistant.name,
        instructions: assistant.instructions || '',
        model: modelId,
        tools,
      };
      
      // Add model parameter overrides if set
      if (temperature !== undefined && !isNaN(temperature)) {
        assistantBody.temperature = temperature;
      }
      if (topP !== undefined && !isNaN(topP)) {
        assistantBody.top_p = topP;
      }

      // Add tool resources - files go to vector store for file_search, not code_interpreter
      if (vectorStoreId && toolConfig.file_search_enabled) {
        assistantBody.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] },
        };
      }

      console.log('Creating OpenAI Assistant:', { name: assistant.name, model: modelId, temperature, topP, tools: tools.length, confluenceEnabled: assistant.confluence_enabled });

      const createResponse = await fetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(assistantBody),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error('Failed to create assistant:', error);
        
        await supabase
          .from(TABLES.ASSISTANTS)
          .update({ 
            status: 'error', 
            last_error: error.error?.message || 'Failed to create assistant' 
          })
          .eq('row_id', assistant_row_id);

        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to create assistant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdAssistant = await createResponse.json();
      console.log('Created assistant:', createdAssistant.id);

      // Update database with OpenAI IDs
      await supabase
        .from(TABLES.ASSISTANTS)
        .update({
          openai_assistant_id: createdAssistant.id,
          vector_store_id: vectorStoreId,
          status: 'active',
          last_instantiated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('row_id', assistant_row_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          assistant_id: createdAssistant.id,
          vector_store_id: vectorStoreId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RE-INSTANTIATE - Re-enable a destroyed assistant
    if (action === 're-instantiate') {
      // First update status to not_instantiated, then call instantiate logic
      const { data: assistant, error: fetchError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .single();

      if (fetchError || !assistant) {
        console.error('Failed to fetch assistant:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset status and clear any old OpenAI ID
      await supabase
        .from(TABLES.ASSISTANTS)
        .update({ 
          status: 'not_instantiated', 
          openai_assistant_id: null,
          last_error: null 
        })
        .eq('row_id', assistant_row_id);

      // Re-fetch after status update
      const { data: refreshedAssistant } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .single();

      if (!refreshedAssistant) {
        return new Response(
          JSON.stringify({ error: 'Assistant not found after refresh' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch tool defaults if using global
      let toolConfig = {
        code_interpreter_enabled: refreshedAssistant.code_interpreter_enabled,
        file_search_enabled: refreshedAssistant.file_search_enabled,
        function_calling_enabled: refreshedAssistant.function_calling_enabled,
      };

      if (refreshedAssistant.use_global_tool_defaults) {
        const { data: defaults } = await supabase
          .from(TABLES.ASSISTANT_TOOL_DEFAULTS)
          .select('*')
          .limit(1)
          .single();

        if (defaults) {
          toolConfig = {
            code_interpreter_enabled: defaults.code_interpreter_enabled,
            file_search_enabled: defaults.file_search_enabled,
            function_calling_enabled: defaults.function_calling_enabled,
          };
        }
      }

      // Fetch prompt for model
      const { data: prompt } = await supabase
        .from(TABLES.PROMPTS)
        .select('model')
        .eq('row_id', refreshedAssistant.prompt_row_id)
        .single();

      const modelId = refreshedAssistant.model_override || prompt?.model || 'gpt-4o';

      // Build tools
      const tools: any[] = [];
      if (toolConfig.code_interpreter_enabled) tools.push({ type: 'code_interpreter' });
      if (toolConfig.file_search_enabled) tools.push({ type: 'file_search' });
      // Add Confluence tools if enabled
      if (refreshedAssistant.confluence_enabled) {
        tools.push(...getConfluenceTools());
      }

      const assistantBody: any = {
        name: refreshedAssistant.name,
        instructions: refreshedAssistant.instructions || '',
        model: modelId,
        tools,
      };

      console.log('Re-instantiating OpenAI Assistant:', { name: refreshedAssistant.name, model: modelId, confluenceEnabled: refreshedAssistant.confluence_enabled });

      const createResponse = await fetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(assistantBody),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error('Failed to re-instantiate assistant:', error);
        
        await supabase
          .from(TABLES.ASSISTANTS)
          .update({ 
            status: 'error', 
            last_error: error.error?.message || 'Failed to re-instantiate assistant' 
          })
          .eq('row_id', assistant_row_id);

        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to re-instantiate assistant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdAssistant = await createResponse.json();
      console.log('Re-instantiated assistant:', createdAssistant.id);

      await supabase
        .from(TABLES.ASSISTANTS)
        .update({
          openai_assistant_id: createdAssistant.id,
          status: 'active',
          last_instantiated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('row_id', assistant_row_id);

      return new Response(
        JSON.stringify({ success: true, assistant_id: createdAssistant.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DESTROY - Delete Assistant from OpenAI (marks as 'destroyed' locally)
    if (action === 'destroy') {
      const { data: assistant } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('openai_assistant_id, vector_store_id')
        .eq('row_id', assistant_row_id)
        .single();

      if (assistant?.openai_assistant_id) {
        // Delete assistant from OpenAI
        await fetch(`https://api.openai.com/v1/assistants/${assistant.openai_assistant_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
          },
        });
        console.log('Deleted OpenAI assistant:', assistant.openai_assistant_id);
      }

      // Update database - mark as destroyed
      await supabase
        .from(TABLES.ASSISTANTS)
        .update({
          openai_assistant_id: null,
          status: 'destroyed',
          last_error: null,
        })
        .eq('row_id', assistant_row_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DESTROY_BY_OPENAI_ID - Delete assistant by OpenAI ID (for orphaned assistants)
    if (action === 'destroy_by_openai_id') {
      const { openai_assistant_id } = body;
      
      if (!openai_assistant_id) {
        return new Response(
          JSON.stringify({ error: 'openai_assistant_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete from OpenAI
      const deleteResponse = await fetch(`https://api.openai.com/v1/assistants/${openai_assistant_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      if (!deleteResponse.ok) {
        const error = await deleteResponse.json();
        console.error('Failed to delete OpenAI assistant:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to delete assistant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Deleted orphaned OpenAI assistant:', openai_assistant_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE - Update Assistant in OpenAI
    if (action === 'update') {
      const { data: assistant } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .single();

      if (!assistant?.openai_assistant_id) {
        return new Response(
          JSON.stringify({ error: 'Assistant not instantiated' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build update body
      const updateBody: any = {};
      if (body.name) updateBody.name = body.name;
      if (body.instructions !== undefined) updateBody.instructions = body.instructions;
      if (body.model) updateBody.model = body.model;
      
      // Handle Confluence tools update
      if (body.confluence_enabled !== undefined) {
        // Fetch tool defaults to rebuild tools array
        let toolConfig = {
          code_interpreter_enabled: assistant.code_interpreter_enabled,
          file_search_enabled: assistant.file_search_enabled,
        };

        if (assistant.use_global_tool_defaults) {
          const { data: defaults } = await supabase
            .from(TABLES.ASSISTANT_TOOL_DEFAULTS)
            .select('*')
            .limit(1)
            .single();

          if (defaults) {
            toolConfig = {
              code_interpreter_enabled: defaults.code_interpreter_enabled,
              file_search_enabled: defaults.file_search_enabled,
            };
          }
        }

        const tools: any[] = [];
        if (toolConfig.code_interpreter_enabled) tools.push({ type: 'code_interpreter' });
        if (toolConfig.file_search_enabled) tools.push({ type: 'file_search' });
        if (body.confluence_enabled) {
          tools.push(...getConfluenceTools());
        }
        updateBody.tools = tools;
      }

      const updateResponse = await fetch(
        `https://api.openai.com/v1/assistants/${assistant.openai_assistant_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify(updateBody),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to update assistant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Updated OpenAI assistant:', assistant.openai_assistant_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SYNC - Upload pending files to OpenAI and update assistant
    if (action === 'sync') {
      const { data: assistant } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .single();

      if (!assistant) {
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch files separately
      const { data: filesData } = await supabase
        .from(TABLES.ASSISTANT_FILES)
        .select('*')
        .eq('assistant_row_id', assistant_row_id);

      const files = filesData || [];
      const pendingFiles = files.filter((f: any) => !f.openai_file_id || f.upload_status === 'pending');
      const existingFileIds: string[] = files.filter((f: any) => f.openai_file_id).map((f: any) => f.openai_file_id);
      const newlyUploadedFileIds: string[] = [];

      console.log('Syncing files:', { total: files.length, pending: pendingFiles.length, alreadyUploaded: existingFileIds.length });

      // Upload pending files to OpenAI
      for (const file of pendingFiles) {
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from('assistant-files')
          .download(file.storage_path);

        if (downloadError || !fileData) {
          console.error('Failed to download file:', file.storage_path, downloadError);
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
          continue;
        }

        // Convert Blob to File to preserve filename in Deno
        const fileWithName = new File(
          [fileData],
          file.original_filename,
          { type: file.mime_type || 'application/octet-stream' }
        );
        const formData = new FormData();
        formData.append('file', fileWithName);
        formData.append('purpose', 'assistants');
        console.log('Uploading file with name:', file.original_filename);

        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          newlyUploadedFileIds.push(uploadResult.id);

          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ openai_file_id: uploadResult.id, upload_status: 'uploaded' })
            .eq('row_id', file.row_id);

          console.log('Uploaded file to OpenAI:', uploadResult.id, file.original_filename);
        } else {
          const error = await uploadResponse.json();
          console.error('Failed to upload file to OpenAI:', error);
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
        }
      }

      // Combine all file IDs for tool resources
      const allFileIds = [...existingFileIds, ...newlyUploadedFileIds];

      // If assistant is active and has files, update its tool resources
      if (assistant.openai_assistant_id && allFileIds.length > 0) {
        // Fetch global defaults first
        const { data: globalDefaults } = await supabase
          .from(TABLES.ASSISTANT_TOOL_DEFAULTS)
          .select('*')
          .limit(1)
          .single();

        // Determine tool config
        const toolConfig = {
          code_interpreter_enabled: assistant.use_global_tool_defaults 
            ? globalDefaults?.code_interpreter_enabled 
            : (assistant.code_interpreter_enabled ?? globalDefaults?.code_interpreter_enabled ?? false),
          file_search_enabled: assistant.use_global_tool_defaults 
            ? globalDefaults?.file_search_enabled 
            : (assistant.file_search_enabled ?? globalDefaults?.file_search_enabled ?? true),
        };

        console.log('Tool config for sync:', toolConfig);

        // Create or update vector store if file_search is enabled
        let vectorStoreId = assistant.vector_store_id;

        if (toolConfig.file_search_enabled) {
          if (vectorStoreId && newlyUploadedFileIds.length > 0) {
            // Add ONLY newly uploaded files to existing vector store
            for (const fileId of newlyUploadedFileIds) {
              const addFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                  'OpenAI-Beta': 'assistants=v2',
                },
                body: JSON.stringify({ file_id: fileId }),
              });
              if (!addFileResponse.ok) {
                const error = await addFileResponse.json();
                console.error('Failed to add file to vector store:', fileId, error);
              }
            }
            console.log('Added', newlyUploadedFileIds.length, 'new files to existing vector store:', vectorStoreId);
          } else if (!vectorStoreId && allFileIds.length > 0) {
            // Create new vector store with all files
            const vsResponse = await fetch('https://api.openai.com/v1/vector_stores', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',
              },
              body: JSON.stringify({
                name: `${assistant.name} - Vector Store`,
                file_ids: allFileIds,
              }),
            });

            if (vsResponse.ok) {
              const vsResult = await vsResponse.json();
              vectorStoreId = vsResult.id;
              console.log('Created new vector store:', vectorStoreId);

              await supabase
                .from(TABLES.ASSISTANTS)
                .update({ vector_store_id: vectorStoreId })
                .eq('row_id', assistant_row_id);
            }
          }
        }

        // Update assistant with tool resources
        const toolResources: any = {};
        if (toolConfig.file_search_enabled && vectorStoreId) {
          toolResources.file_search = { vector_store_ids: [vectorStoreId] };
        }

        if (Object.keys(toolResources).length > 0) {
          const updateResponse = await fetch(
            `https://api.openai.com/v1/assistants/${assistant.openai_assistant_id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',
              },
              body: JSON.stringify({ tool_resources: toolResources }),
            }
          );

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            console.error('Failed to update assistant tool resources:', error);
          } else {
            console.log('Updated assistant with new tool resources');
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Synced ${newlyUploadedFileIds.length} files`,
          uploaded_count: newlyUploadedFileIds.length,
          total_files: allFileIds.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ DELETE-FILE ACTION ============
    if (action === 'delete-file') {
      const { openai_file_id, assistant_row_id } = body;

      if (!openai_file_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'openai_file_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log('[delete-file] Start', { openai_file_id, assistant_row_id });

      // Resolve assistant context
      let openaiAssistantId: string | null = null;
      let vectorStoreId: string | null = null;
      let toolConfig: { code_interpreter_enabled: boolean; file_search_enabled: boolean } | null = null;
      let remainingFileIds: string[] = [];

      if (assistant_row_id) {
        const { data: assistant, error: assistantError } = await supabase
          .from(TABLES.ASSISTANTS)
          .select('openai_assistant_id, vector_store_id, use_shared_vector_store, shared_vector_store_row_id, use_global_tool_defaults, code_interpreter_enabled, file_search_enabled')
          .eq('row_id', assistant_row_id)
          .single();

        if (assistantError) {
          console.error('[delete-file] Could not fetch assistant:', assistantError);
        } else if (assistant) {
          openaiAssistantId = assistant.openai_assistant_id;
          vectorStoreId = assistant.vector_store_id;

          // Get tool config
          if (assistant.use_global_tool_defaults) {
            const { data: defaults } = await supabase
              .from(TABLES.ASSISTANT_TOOL_DEFAULTS)
              .select('code_interpreter_enabled, file_search_enabled')
              .limit(1)
              .single();
            toolConfig = defaults ? { code_interpreter_enabled: !!defaults.code_interpreter_enabled, file_search_enabled: !!defaults.file_search_enabled } : null;
          } else {
            toolConfig = { code_interpreter_enabled: !!assistant.code_interpreter_enabled, file_search_enabled: !!assistant.file_search_enabled };
          }

          // Fetch remaining file IDs (after we delete this one)
          const { data: remainingFiles } = await supabase
            .from(TABLES.ASSISTANT_FILES)
            .select('openai_file_id')
            .eq('assistant_row_id', assistant_row_id)
            .not('openai_file_id', 'is', null)
            .neq('openai_file_id', openai_file_id);

          remainingFileIds = (remainingFiles || []).map((f: any) => f.openai_file_id).filter(Boolean);
        }
      }

      // 1) Remove from vector store if applicable
      if (vectorStoreId && toolConfig?.file_search_enabled) {
        try {
          const removeVsRes = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${openai_file_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
          });
          if (!removeVsRes.ok) {
            const errText = await removeVsRes.text();
            console.log('[delete-file] Could not remove from vector store (may not exist):', errText);
          } else {
            console.log('[delete-file] Removed file from vector store');
          }
        } catch (e) {
          console.error('[delete-file] Error removing from vector store:', e);
        }
      }

      // 2) Delete file from OpenAI Files API
      try {
        const delRes = await fetch(`https://api.openai.com/v1/files/${openai_file_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        });
        if (!delRes.ok) {
          const errText = await delRes.text();
          console.log('[delete-file] Could not delete from Files API (may not exist):', errText);
        } else {
          console.log('[delete-file] Deleted from Files API');
        }
      } catch (e) {
        console.error('[delete-file] Error deleting from Files API:', e);
      }

      // 3) Update assistant tool_resources with remaining files
      if (openaiAssistantId && toolConfig?.file_search_enabled && vectorStoreId) {
        try {
          const toolResources: any = { file_search: { vector_store_ids: [vectorStoreId] } };
          const updateRes = await fetch(`https://api.openai.com/v1/assistants/${openaiAssistantId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Beta': 'assistants=v2' },
            body: JSON.stringify({ tool_resources: toolResources }),
          });
          if (!updateRes.ok) {
            console.error('[delete-file] Could not update assistant tool_resources:', await updateRes.text());
          } else {
            console.log('[delete-file] Refreshed assistant tool_resources');
          }
        } catch (e) {
          console.error('[delete-file] Error updating assistant:', e);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Assistant manager error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
