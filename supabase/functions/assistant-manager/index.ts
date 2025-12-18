import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
        .from('cyg_assistants')
        .select(`
          row_id,
          name,
          status,
          openai_assistant_id,
          prompt_row_id,
          cyg_prompts!cyg_assistants_prompt_row_id_fkey(
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
        return {
          openai_id: oa.id,
          name: oa.name,
          model: oa.model,
          created_at: oa.created_at,
          local_row_id: local?.row_id || null,
          local_status: local?.status || null,
          prompt_row_id: local?.prompt_row_id || null,
          prompt_name: local?.cyg_prompts?.prompt_name || null,
          is_orphaned: !local,
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
        .from('cyg_assistants')
        .select('*, cyg_assistant_files(*)')
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
          .from('cyg_assistant_tool_defaults')
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
        .from('cyg_prompts')
        .select('model, temperature, max_tokens, top_p')
        .eq('row_id', assistant.prompt_row_id)
        .single();

      const modelId = assistant.model_override || prompt?.model || 'gpt-4o';

      // Upload files to OpenAI if any
      const uploadedFileIds: string[] = [];
      const files = assistant.cyg_assistant_files || [];

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

        // Upload to OpenAI Files API
        const formData = new FormData();
        formData.append('file', fileData, file.original_filename);
        formData.append('purpose', 'assistants');

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
            .from('cyg_assistant_files')
            .update({ openai_file_id: uploadResult.id, upload_status: 'uploaded' })
            .eq('row_id', file.row_id);

          console.log('Uploaded file to OpenAI:', uploadResult.id);
        } else {
          const error = await uploadResponse.json();
          console.error('Failed to upload file to OpenAI:', error);
          await supabase
            .from('cyg_assistant_files')
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
            .from('cyg_vector_stores')
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

      // Create Assistant in OpenAI
      const assistantBody: any = {
        name: assistant.name,
        instructions: assistant.instructions || '',
        model: modelId,
        tools,
      };

      // Add tool resources if we have files
      if (vectorStoreId && toolConfig.file_search_enabled) {
        assistantBody.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] },
        };
      }
      if (toolConfig.code_interpreter_enabled && uploadedFileIds.length > 0) {
        assistantBody.tool_resources = {
          ...assistantBody.tool_resources,
          code_interpreter: { file_ids: uploadedFileIds },
        };
      }

      console.log('Creating OpenAI Assistant:', { name: assistant.name, model: modelId, tools: tools.length });

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
          .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
        .update({ 
          status: 'not_instantiated', 
          openai_assistant_id: null,
          last_error: null 
        })
        .eq('row_id', assistant_row_id);

      // Now instantiate (reuse instantiate logic by making recursive call)
      const instantiateReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ action: 'instantiate', assistant_row_id }),
      });

      // Inline instantiate logic to avoid recursion issues
      // ... Actually, let's just duplicate the core instantiate code here for simplicity
      // Re-fetch after status update
      const { data: refreshedAssistant } = await supabase
        .from('cyg_assistants')
        .select('*, cyg_assistant_files(*)')
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
          .from('cyg_assistant_tool_defaults')
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
        .from('cyg_prompts')
        .select('model')
        .eq('row_id', refreshedAssistant.prompt_row_id)
        .single();

      const modelId = refreshedAssistant.model_override || prompt?.model || 'gpt-4o';

      // Build tools
      const tools: any[] = [];
      if (toolConfig.code_interpreter_enabled) tools.push({ type: 'code_interpreter' });
      if (toolConfig.file_search_enabled) tools.push({ type: 'file_search' });

      const assistantBody: any = {
        name: refreshedAssistant.name,
        instructions: refreshedAssistant.instructions || '',
        model: modelId,
        tools,
      };

      console.log('Re-instantiating OpenAI Assistant:', { name: refreshedAssistant.name, model: modelId });

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
          .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
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
        .from('cyg_assistants')
        .select('*, cyg_assistant_files(*)')
        .eq('row_id', assistant_row_id)
        .single();

      if (!assistant) {
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const files = assistant.cyg_assistant_files || [];
      const pendingFiles = files.filter((f: any) => !f.openai_file_id || f.upload_status === 'pending');
      const uploadedFileIds: string[] = files.filter((f: any) => f.openai_file_id).map((f: any) => f.openai_file_id);

      console.log('Syncing files:', { total: files.length, pending: pendingFiles.length, alreadyUploaded: uploadedFileIds.length });

      // Upload pending files to OpenAI
      for (const file of pendingFiles) {
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from('assistant-files')
          .download(file.storage_path);

        if (downloadError || !fileData) {
          console.error('Failed to download file:', file.storage_path, downloadError);
          await supabase
            .from('cyg_assistant_files')
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
          continue;
        }

        const formData = new FormData();
        formData.append('file', fileData, file.original_filename);
        formData.append('purpose', 'assistants');

        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          uploadedFileIds.push(uploadResult.id);

          await supabase
            .from('cyg_assistant_files')
            .update({ openai_file_id: uploadResult.id, upload_status: 'uploaded' })
            .eq('row_id', file.row_id);

          console.log('Uploaded file to OpenAI:', uploadResult.id, file.original_filename);
        } else {
          const error = await uploadResponse.json();
          console.error('Failed to upload file to OpenAI:', error);
          await supabase
            .from('cyg_assistant_files')
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
        }
      }

      // If assistant is active and has files, update its tool resources
      if (assistant.openai_assistant_id && uploadedFileIds.length > 0) {
        // Fetch tool config
        let toolConfig = {
          code_interpreter_enabled: assistant.code_interpreter_enabled,
          file_search_enabled: assistant.file_search_enabled,
        };

        if (assistant.use_global_tool_defaults) {
          const { data: defaults } = await supabase
            .from('cyg_assistant_tool_defaults')
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

        // Create or update vector store if file_search is enabled
        let vectorStoreId = assistant.vector_store_id;

        if (toolConfig.file_search_enabled && uploadedFileIds.length > 0) {
          if (vectorStoreId) {
            // Add files to existing vector store
            for (const fileId of uploadedFileIds) {
              await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                  'OpenAI-Beta': 'assistants=v2',
                },
                body: JSON.stringify({ file_id: fileId }),
              });
            }
            console.log('Added files to existing vector store:', vectorStoreId);
          } else {
            // Create new vector store
            const vsResponse = await fetch('https://api.openai.com/v1/vector_stores', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',
              },
              body: JSON.stringify({
                name: `${assistant.name} - Vector Store`,
                file_ids: uploadedFileIds,
              }),
            });

            if (vsResponse.ok) {
              const vsResult = await vsResponse.json();
              vectorStoreId = vsResult.id;
              console.log('Created new vector store:', vectorStoreId);

              await supabase
                .from('cyg_assistants')
                .update({ vector_store_id: vectorStoreId })
                .eq('row_id', assistant_row_id);
            }
          }
        }

        // Update assistant with new tool resources
        const toolResources: any = {};
        if (toolConfig.file_search_enabled && vectorStoreId) {
          toolResources.file_search = { vector_store_ids: [vectorStoreId] };
        }
        if (toolConfig.code_interpreter_enabled && uploadedFileIds.length > 0) {
          toolResources.code_interpreter = { file_ids: uploadedFileIds };
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
          message: `Synced ${pendingFiles.length} files`,
          uploaded_count: pendingFiles.length,
          total_files: uploadedFileIds.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: list, instantiate, re-instantiate, destroy, destroy_by_openai_id, update, or sync' }),
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