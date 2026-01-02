import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FileHealth {
  row_id: string;
  original_filename: string;
  openai_file_id: string | null;
  storage_path: string;
  status: 'healthy' | 'missing_openai' | 'missing_storage' | 'orphaned';
  error?: string;
}

interface HealthResult {
  assistant_row_id: string;
  assistant_name: string;
  prompt_name: string;
  status: 'healthy' | 'degraded' | 'broken' | 'not_configured';
  vector_store: {
    status: 'exists' | 'missing' | 'not_configured';
    id?: string;
    error?: string;
  };
  files: {
    total_in_db: number;
    healthy: number;
    missing_openai: number;
    missing_storage: number;
    details: FileHealth[];
  };
  errors: string[];
}

interface RepairResult {
  assistant_row_id: string;
  success: boolean;
  actions: string[];
  new_vector_store_id?: string;
  files_reuploaded: number;
  errors: string[];
}

// Check if a vector store exists in OpenAI
async function checkVectorStore(vectorStoreId: string, openaiKey: string): Promise<{ exists: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    
    if (response.ok) {
      return { exists: true };
    } else if (response.status === 404) {
      return { exists: false, error: 'Vector store not found in OpenAI' };
    } else {
      const errorText = await response.text();
      return { exists: false, error: `OpenAI API error: ${response.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { exists: false, error: `Network error: ${message}` };
  }
}

// Check if a file exists in OpenAI
async function checkOpenAIFile(fileId: string, openaiKey: string): Promise<{ exists: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
    });
    
    if (response.ok) {
      return { exists: true };
    } else if (response.status === 404) {
      return { exists: false, error: 'File not found in OpenAI' };
    } else {
      const errorText = await response.text();
      return { exists: false, error: `OpenAI API error: ${response.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { exists: false, error: `Network error: ${message}` };
  }
}

// Create a new vector store in OpenAI
async function createVectorStore(name: string, openaiKey: string): Promise<{ id?: string; error?: string }> {
  try {
    const response = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ name }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { id: data.id };
    } else {
      const errorText = await response.text();
      return { error: `Failed to create vector store: ${response.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Network error: ${message}` };
  }
}

// Upload a file to OpenAI
async function uploadFileToOpenAI(fileContent: ArrayBuffer, filename: string, openaiKey: string): Promise<{ id?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), filename);
    formData.append('purpose', 'assistants');
    
    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: formData,
    });
    
    if (response.ok) {
      const data = await response.json();
      return { id: data.id };
    } else {
      const errorText = await response.text();
      return { error: `Failed to upload file: ${response.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Network error: ${message}` };
  }
}

// Add file to vector store
async function addFileToVectorStore(vectorStoreId: string, fileId: string, openaiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ file_id: fileId }),
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `Failed to add file to vector store: ${response.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Network error: ${message}` };
  }
}

// Check health of a single assistant
async function checkAssistantHealth(
  supabase: any,
  assistantRowId: string,
  openaiKey: string
): Promise<HealthResult> {
  const errors: string[] = [];
  
  // Fetch assistant with prompt info
  const { data: assistant, error: assistantError } = await supabase
    .from('q_assistants')
    .select('row_id, name, vector_store_id, prompt_row_id, q_prompts!inner(prompt_name)')
    .eq('row_id', assistantRowId)
    .single();
  
  if (assistantError || !assistant) {
    return {
      assistant_row_id: assistantRowId,
      assistant_name: 'Unknown',
      prompt_name: 'Unknown',
      status: 'broken',
      vector_store: { status: 'not_configured' },
      files: { total_in_db: 0, healthy: 0, missing_openai: 0, missing_storage: 0, details: [] },
      errors: [`Failed to fetch assistant: ${assistantError?.message || 'Not found'}`],
    };
  }
  
  const result: HealthResult = {
    assistant_row_id: assistant.row_id,
    assistant_name: assistant.name || 'Unnamed',
    prompt_name: assistant.q_prompts?.prompt_name || 'Unknown',
    status: 'healthy',
    vector_store: { status: 'not_configured' },
    files: { total_in_db: 0, healthy: 0, missing_openai: 0, missing_storage: 0, details: [] },
    errors: [],
  };
  
  // Check vector store
  if (assistant.vector_store_id) {
    const vsCheck = await checkVectorStore(assistant.vector_store_id, openaiKey);
    if (vsCheck.exists) {
      result.vector_store = { status: 'exists', id: assistant.vector_store_id };
    } else {
      result.vector_store = { status: 'missing', id: assistant.vector_store_id, error: vsCheck.error };
      result.status = 'broken';
      errors.push(`Vector store ${assistant.vector_store_id} not found in OpenAI`);
    }
  }
  
  // Fetch files
  const { data: files, error: filesError } = await supabase
    .from('q_assistant_files')
    .select('row_id, original_filename, openai_file_id, storage_path, upload_status')
    .eq('assistant_row_id', assistantRowId);
  
  if (filesError) {
    errors.push(`Failed to fetch files: ${filesError.message}`);
  } else if (files && files.length > 0) {
    result.files.total_in_db = files.length;
    
    for (const file of files) {
      const fileHealth: FileHealth = {
        row_id: file.row_id,
        original_filename: file.original_filename,
        openai_file_id: file.openai_file_id,
        storage_path: file.storage_path,
        status: 'healthy',
      };
      
      // Check if file exists in OpenAI
      if (file.openai_file_id) {
        const fileCheck = await checkOpenAIFile(file.openai_file_id, openaiKey);
        if (!fileCheck.exists) {
          fileHealth.status = 'missing_openai';
          fileHealth.error = fileCheck.error;
          result.files.missing_openai++;
          if (result.status === 'healthy') result.status = 'degraded';
        } else {
          result.files.healthy++;
        }
      } else {
        // No OpenAI file ID means it was never uploaded
        fileHealth.status = 'missing_openai';
        fileHealth.error = 'Never uploaded to OpenAI';
        result.files.missing_openai++;
        if (result.status === 'healthy') result.status = 'degraded';
      }
      
      result.files.details.push(fileHealth);
    }
  }
  
  result.errors = errors;
  return result;
}

// Repair an assistant's OpenAI resources
async function repairAssistant(
  supabase: any,
  assistantRowId: string,
  openaiKey: string
): Promise<RepairResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let filesReuploaded = 0;
  let newVectorStoreId: string | undefined;
  
  // Fetch assistant
  const { data: assistant, error: assistantError } = await supabase
    .from('q_assistants')
    .select('row_id, name, vector_store_id')
    .eq('row_id', assistantRowId)
    .single();
  
  if (assistantError || !assistant) {
    return {
      assistant_row_id: assistantRowId,
      success: false,
      actions: [],
      files_reuploaded: 0,
      errors: [`Failed to fetch assistant: ${assistantError?.message || 'Not found'}`],
    };
  }
  
  let vectorStoreId = assistant.vector_store_id;
  
  // Check and repair vector store
  if (vectorStoreId) {
    const vsCheck = await checkVectorStore(vectorStoreId, openaiKey);
    if (!vsCheck.exists) {
      actions.push(`Vector store ${vectorStoreId} is missing, creating new one...`);
      const createResult = await createVectorStore(`Assistant: ${assistant.name || assistantRowId}`, openaiKey);
      
      if (createResult.id) {
        newVectorStoreId = createResult.id;
        vectorStoreId = createResult.id;
        
        // Update database with new vector store ID
        const { error: updateError } = await supabase
          .from('q_assistants')
          .update({ vector_store_id: createResult.id })
          .eq('row_id', assistantRowId);
        
        if (updateError) {
          errors.push(`Failed to update vector store ID in database: ${updateError.message}`);
        } else {
          actions.push(`Created new vector store: ${createResult.id}`);
        }
      } else {
        errors.push(`Failed to create vector store: ${createResult.error}`);
      }
    } else {
      actions.push('Vector store exists, no repair needed');
    }
  } else {
    // No vector store configured - create one
    actions.push('No vector store configured, creating new one...');
    const createResult = await createVectorStore(`Assistant: ${assistant.name || assistantRowId}`, openaiKey);
    
    if (createResult.id) {
      newVectorStoreId = createResult.id;
      vectorStoreId = createResult.id;
      
      const { error: updateError } = await supabase
        .from('q_assistants')
        .update({ vector_store_id: createResult.id })
        .eq('row_id', assistantRowId);
      
      if (updateError) {
        errors.push(`Failed to update vector store ID in database: ${updateError.message}`);
      } else {
        actions.push(`Created new vector store: ${createResult.id}`);
      }
    } else {
      errors.push(`Failed to create vector store: ${createResult.error}`);
    }
  }
  
  // Fetch and repair files
  const { data: files, error: filesError } = await supabase
    .from('q_assistant_files')
    .select('row_id, original_filename, openai_file_id, storage_path')
    .eq('assistant_row_id', assistantRowId);
  
  if (filesError) {
    errors.push(`Failed to fetch files: ${filesError.message}`);
  } else if (files && files.length > 0) {
    for (const file of files) {
      // Check if file needs repair
      let needsReupload = false;
      
      if (file.openai_file_id) {
        const fileCheck = await checkOpenAIFile(file.openai_file_id, openaiKey);
        if (!fileCheck.exists) {
          needsReupload = true;
          actions.push(`File "${file.original_filename}" missing from OpenAI, re-uploading...`);
        }
      } else {
        needsReupload = true;
        actions.push(`File "${file.original_filename}" never uploaded, uploading...`);
      }
      
      if (needsReupload && file.storage_path) {
        // Download from Supabase storage
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from('assistant-files')
          .download(file.storage_path);
        
        if (downloadError) {
          errors.push(`Failed to download "${file.original_filename}" from storage: ${downloadError.message}`);
          continue;
        }
        
        // Upload to OpenAI
        const fileContent = await fileData.arrayBuffer();
        const uploadResult = await uploadFileToOpenAI(fileContent, file.original_filename, openaiKey);
        
        if (uploadResult.id) {
          // Update database with new file ID
          const { error: updateError } = await supabase
            .from('q_assistant_files')
            .update({ openai_file_id: uploadResult.id, upload_status: 'uploaded' })
            .eq('row_id', file.row_id);
          
          if (updateError) {
            errors.push(`Failed to update file ID for "${file.original_filename}": ${updateError.message}`);
          } else {
            actions.push(`Re-uploaded "${file.original_filename}" with new ID: ${uploadResult.id}`);
            filesReuploaded++;
            
            // Add to vector store if we have one
            if (vectorStoreId) {
              const addResult = await addFileToVectorStore(vectorStoreId, uploadResult.id, openaiKey);
              if (addResult.success) {
                actions.push(`Added "${file.original_filename}" to vector store`);
              } else {
                errors.push(`Failed to add "${file.original_filename}" to vector store: ${addResult.error}`);
              }
            }
          }
        } else {
          errors.push(`Failed to upload "${file.original_filename}" to OpenAI: ${uploadResult.error}`);
        }
      }
    }
  }
  
  return {
    assistant_row_id: assistantRowId,
    success: errors.length === 0,
    actions,
    new_vector_store_id: newVectorStoreId,
    files_reuploaded: filesReuploaded,
    errors,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { action, assistant_row_id } = await req.json();
    
    console.log(`[resource-health] Action: ${action}, Assistant: ${assistant_row_id || 'all'}`);
    
    switch (action) {
      case 'check_assistant': {
        if (!assistant_row_id) {
          return new Response(JSON.stringify({ error: 'assistant_row_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const result = await checkAssistantHealth(supabase, assistant_row_id, openaiKey);
        console.log(`[resource-health] Check result for ${assistant_row_id}:`, result.status);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'check_all': {
        // Get all assistants
        const { data: assistants, error: listError } = await supabase
          .from('q_assistants')
          .select('row_id, name');
        
        if (listError) {
          return new Response(JSON.stringify({ error: `Failed to list assistants: ${listError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const results: HealthResult[] = [];
        for (const assistant of assistants || []) {
          const result = await checkAssistantHealth(supabase, assistant.row_id, openaiKey);
          results.push(result);
        }
        
        console.log(`[resource-health] Checked ${results.length} assistants`);
        
        return new Response(JSON.stringify({ assistants: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'repair_assistant': {
        if (!assistant_row_id) {
          return new Response(JSON.stringify({ error: 'assistant_row_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const result = await repairAssistant(supabase, assistant_row_id, openaiKey);
        console.log(`[resource-health] Repair result for ${assistant_row_id}:`, result.success ? 'success' : 'failed');
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('[resource-health] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
