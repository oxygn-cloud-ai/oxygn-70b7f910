import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES, FK } from "../_shared/tables.ts";
import { fetchActiveModels, getDefaultModelFromSettings } from "../_shared/models.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Conversation manager request:', { action, assistant_row_id, user: validation.user?.email });

    // LIST - Fetch all assistants from database
    if (action === 'list') {
      // Fetch local assistant records with linked prompt names
      const { data: localAssistants, error: localError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select(`
          row_id,
          name,
          status,
          prompt_row_id,
          confluence_enabled,
          model_override,
          instructions,
          code_interpreter_enabled,
          file_search_enabled,
          ${FK.ASSISTANTS_PROMPT}(
            row_id,
            prompt_name
          )
        `);

      if (localError) {
        console.error('Failed to fetch assistants:', localError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch assistants' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get default model for display
      const defaultModel = await getDefaultModelFromSettings(supabase);

      // Format assistants for response
      const assistants = (localAssistants || []).map((la: any) => {
        const promptData = la?.[FK.ASSISTANTS_PROMPT.split('!')[0]] || la?.[TABLES.PROMPTS];
        return {
          row_id: la.row_id,
          name: la.name,
          model: la.model_override || defaultModel,
          status: la.status || 'active',
          prompt_row_id: la.prompt_row_id,
          prompt_name: promptData?.prompt_name || null,
          confluence_enabled: la.confluence_enabled || false,
          code_interpreter_enabled: la.code_interpreter_enabled || false,
          file_search_enabled: la.file_search_enabled || false,
        };
      });

      console.log(`Listed ${assistants.length} assistants`);

      return new Response(
        JSON.stringify({ assistants }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET - Get assistant details
    if (action === 'get') {
      const { data: assistant, error: fetchError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('row_id', assistant_row_id)
        .maybeSingle();

      if (fetchError || !assistant) {
        console.error('Failed to fetch assistant:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ assistant }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE - Update assistant configuration
    if (action === 'update') {
      const { updates } = body;

      if (!assistant_row_id || !updates) {
        return new Response(
          JSON.stringify({ error: 'assistant_row_id and updates are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update database
      const { error: updateError } = await supabase
        .from(TABLES.ASSISTANTS)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('row_id', assistant_row_id);

      if (updateError) {
        console.error('Failed to update assistant:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update assistant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Updated assistant:', assistant_row_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPLOAD_FILE - Upload a file for file_search
    if (action === 'upload_file') {
      const { file_content, filename, mime_type } = body;

      if (!assistant_row_id || !file_content || !filename) {
        return new Response(
          JSON.stringify({ error: 'assistant_row_id, file_content, and filename are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decode base64 content
      const binaryContent = Uint8Array.from(atob(file_content), c => c.charCodeAt(0));
      
      // Upload to OpenAI Files API
      const file = new File([binaryContent], filename, { type: mime_type || 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'assistants');

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        console.error('Failed to upload file:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to upload file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const uploadResult = await uploadResponse.json();
      console.log('Uploaded file to vector store:', uploadResult.id);

      // Save file record
      const { data: savedFile, error: saveError } = await supabase
        .from(TABLES.ASSISTANT_FILES)
        .insert({
          assistant_row_id,
          openai_file_id: uploadResult.id,
          original_filename: filename,
          mime_type,
          file_size: binaryContent.length,
          storage_path: `openai/${uploadResult.id}`,
          upload_status: 'uploaded',
        })
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save file record:', saveError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          file_id: uploadResult.id,
          file_record: savedFile,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE_VECTOR_STORE - Create a vector store for file_search
    if (action === 'create_vector_store') {
      const { name, file_ids } = body;

      if (!name) {
        return new Response(
          JSON.stringify({ error: 'name is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const vsBody: any = { name };
      if (file_ids?.length) {
        vsBody.file_ids = file_ids;
      }

      const vsResponse = await fetch('https://api.openai.com/v1/vector_stores', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vsBody),
      });

      if (!vsResponse.ok) {
        const error = await vsResponse.json();
        console.error('Failed to create vector store:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to create vector store' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const vsResult = await vsResponse.json();
      console.log('Created vector store:', vsResult.id);

      // Update assistant with vector store ID if assistant_row_id provided
      if (assistant_row_id) {
        await supabase
          .from(TABLES.ASSISTANTS)
          .update({ vector_store_id: vsResult.id })
          .eq('row_id', assistant_row_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          vector_store_id: vsResult.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ADD_FILE_TO_VECTOR_STORE - Add a file to an existing vector store
    if (action === 'add_file_to_vector_store') {
      const { vector_store_id, file_id } = body;

      if (!vector_store_id || !file_id) {
        return new Response(
          JSON.stringify({ error: 'vector_store_id and file_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const addResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vector_store_id}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id }),
      });

      if (!addResponse.ok) {
        const error = await addResponse.json();
        console.error('Failed to add file to vector store:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to add file to vector store' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Added file to vector store:', { vector_store_id, file_id });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST_FILES - List files for an assistant
    if (action === 'list_files') {
      const { data: files, error: filesError } = await supabase
        .from(TABLES.ASSISTANT_FILES)
        .select('*')
        .eq('assistant_row_id', assistant_row_id)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Failed to fetch files:', filesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch files' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ files: files || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE_FILE - Delete a file (supports both delete_file and delete-file)
    if (action === 'delete_file' || action === 'delete-file') {
      const { file_row_id, openai_file_id } = body;

      // Helper function to de-index file from vector store
      const deIndexFromVectorStore = async (vectorStoreId: string, fileId: string) => {
        try {
          const deIndexRes = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          });
          if (deIndexRes.ok) {
            console.log('De-indexed file from vector store:', { vectorStoreId, fileId });
          } else {
            const err = await deIndexRes.text();
            console.warn('Failed to de-index from vector store:', err);
          }
        } catch (e) {
          console.warn('Error de-indexing from vector store:', e);
        }
      };

      // If openai_file_id is provided directly, also use assistant_row_id to de-index
      if (openai_file_id) {
        // Get vector store ID from assistant if assistant_row_id provided
        if (assistant_row_id) {
          const { data: assistant } = await supabase
            .from(TABLES.ASSISTANTS)
            .select('vector_store_id')
            .eq('row_id', assistant_row_id)
            .maybeSingle();
          
          if (assistant?.vector_store_id) {
            await deIndexFromVectorStore(assistant.vector_store_id, openai_file_id);
          }
        }
        
        // Then delete from OpenAI Files API
        try {
          await fetch(`https://api.openai.com/v1/files/${openai_file_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          });
          console.log('Deleted file from OpenAI Files API:', openai_file_id);
        } catch (e) {
          console.warn('Failed to delete from OpenAI Files API:', e);
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Otherwise, use file_row_id to look up and delete
      if (file_row_id) {
        const { data: file } = await supabase
          .from(TABLES.ASSISTANT_FILES)
          .select('openai_file_id, assistant_row_id')
          .eq('row_id', file_row_id)
          .maybeSingle();

        if (file?.openai_file_id) {
          // Get vector store ID from assistant
          if (file.assistant_row_id) {
            const { data: assistant } = await supabase
              .from(TABLES.ASSISTANTS)
              .select('vector_store_id')
              .eq('row_id', file.assistant_row_id)
              .maybeSingle();
            
            if (assistant?.vector_store_id) {
              await deIndexFromVectorStore(assistant.vector_store_id, file.openai_file_id);
            }
          }
          
          // Delete from OpenAI Files API
          await fetch(`https://api.openai.com/v1/files/${file.openai_file_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          });
          console.log('Deleted file from OpenAI Files API:', file.openai_file_id);
        }

        await supabase
          .from(TABLES.ASSISTANT_FILES)
          .delete()
          .eq('row_id', file_row_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SYNC - Sync pending files to OpenAI vector store
    if (action === 'sync') {
      if (!assistant_row_id) {
        return new Response(
          JSON.stringify({ error: 'assistant_row_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get assistant to find vector_store_id
      const { data: assistant, error: assistantError } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('vector_store_id')
        .eq('row_id', assistant_row_id)
        .maybeSingle();

      if (assistantError || !assistant) {
        console.error('Failed to fetch assistant:', assistantError);
        return new Response(
          JSON.stringify({ error: 'Assistant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get pending files
      const { data: pendingFiles, error: filesError } = await supabase
        .from(TABLES.ASSISTANT_FILES)
        .select('*')
        .eq('assistant_row_id', assistant_row_id)
        .eq('upload_status', 'pending');

      if (filesError) {
        console.error('Failed to fetch pending files:', filesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch files' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!pendingFiles || pendingFiles.length === 0) {
        return new Response(
          JSON.stringify({ success: true, uploaded_count: 0, message: 'No pending files to sync' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Syncing ${pendingFiles.length} files for assistant ${assistant_row_id}`);

      // Ensure vector store exists
      let vectorStoreId = assistant?.vector_store_id;
      if (!vectorStoreId) {
        // Create new vector store
        const vsResponse = await fetch('https://api.openai.com/v1/vector_stores', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `assistant-${assistant_row_id}` }),
        });

        if (!vsResponse.ok) {
          const error = await vsResponse.json();
          console.error('Failed to create vector store:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create vector store' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const vsResult = await vsResponse.json();
        vectorStoreId = vsResult.id;
        console.log('Created vector store:', vectorStoreId);

        // Update assistant with vector store ID
        await supabase
          .from(TABLES.ASSISTANTS)
          .update({ vector_store_id: vectorStoreId })
          .eq('row_id', assistant_row_id);
      }

      let uploadedCount = 0;

      // Upload each pending file
      for (const file of pendingFiles) {
        try {
          // Download file from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('assistant-files')
            .download(file.storage_path);

          if (downloadError || !fileData) {
            console.error(`Failed to download file ${file.storage_path}:`, downloadError);
            await supabase
              .from(TABLES.ASSISTANT_FILES)
              .update({ upload_status: 'error' })
              .eq('row_id', file.row_id);
            continue;
          }

          // Upload to OpenAI Files API
          const formData = new FormData();
          formData.append('file', new Blob([fileData], { type: file.mime_type || 'application/octet-stream' }), file.original_filename);
          formData.append('purpose', 'assistants');

          const uploadResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            console.error(`Failed to upload file ${file.original_filename}:`, error);
            await supabase
              .from(TABLES.ASSISTANT_FILES)
              .update({ upload_status: 'error' })
              .eq('row_id', file.row_id);
            continue;
          }

          const uploadResult = await uploadResponse.json();
          console.log(`Uploaded file to OpenAI: ${uploadResult.id}`);

          // Add file to vector store
          const addResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file_id: uploadResult.id }),
          });

          if (!addResponse.ok) {
            const error = await addResponse.json();
            console.error(`Failed to add file to vector store:`, error);
          }

          // Update file record
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({
              openai_file_id: uploadResult.id,
              upload_status: 'uploaded',
            })
            .eq('row_id', file.row_id);

          uploadedCount++;
        } catch (e) {
          console.error(`Error processing file ${file.original_filename}:`, e);
          await supabase
            .from(TABLES.ASSISTANT_FILES)
            .update({ upload_status: 'error' })
            .eq('row_id', file.row_id);
        }
      }

      console.log(`Synced ${uploadedCount}/${pendingFiles.length} files`);

      return new Response(
        JSON.stringify({ success: true, uploaded_count: uploadedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete one or more assistants
    if (action === 'delete') {
      const { row_ids } = body;
      const idsToDelete = row_ids || (assistant_row_id ? [assistant_row_id] : []);

      if (!idsToDelete.length) {
        return new Response(
          JSON.stringify({ error: 'row_ids or assistant_row_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Deleting ${idsToDelete.length} assistants:`, idsToDelete);

      // Delete associated files first
      for (const rowId of idsToDelete) {
        // Get assistant's vector store ID for de-indexing
        const { data: assistant } = await supabase
          .from(TABLES.ASSISTANTS)
          .select('vector_store_id')
          .eq('row_id', rowId)
          .single();
        
        const vectorStoreId = assistant?.vector_store_id;
        
        const { data: files } = await supabase
          .from(TABLES.ASSISTANT_FILES)
          .select('openai_file_id')
          .eq('assistant_row_id', rowId);

        if (files) {
          for (const file of files) {
            if (file.openai_file_id) {
              // De-index from vector store first
              if (vectorStoreId) {
                try {
                  await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${file.openai_file_id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                  });
                  console.log('De-indexed file from vector store:', file.openai_file_id);
                } catch (e) {
                  console.warn('Failed to de-index from vector store:', e);
                }
              }
              
              // Then delete from OpenAI Files API
              try {
                await fetch(`https://api.openai.com/v1/files/${file.openai_file_id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                });
                console.log('Deleted file from OpenAI Files API:', file.openai_file_id);
              } catch (e) {
                console.warn('Failed to delete OpenAI file:', e);
              }
            }
          }
        }

        // Delete file records
        await supabase
          .from(TABLES.ASSISTANT_FILES)
          .delete()
          .eq('assistant_row_id', rowId);

        // Delete threads associated with this assistant
        await supabase
          .from(TABLES.THREADS)
          .delete()
          .eq('assistant_row_id', rowId);

        // Delete confluence pages associated with this assistant
        await supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .delete()
          .eq('assistant_row_id', rowId);
      }

      // Delete the assistants
      const { error: deleteError } = await supabase
        .from(TABLES.ASSISTANTS)
        .delete()
        .in('row_id', idsToDelete);

      if (deleteError) {
        console.error('Failed to delete assistants:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete assistants' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Deleted ${idsToDelete.length} assistants`);

      return new Response(
        JSON.stringify({ success: true, deleted_count: idsToDelete.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: list, get, update, delete, upload_file, create_vector_store, add_file_to_vector_store, list_files, delete_file, or sync' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversation manager error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
