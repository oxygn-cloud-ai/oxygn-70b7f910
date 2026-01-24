import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TABLES } from '../_shared/tables.ts';
import { corsHeaders } from "../_shared/cors.ts";

// Helper: Create response with CORS headers
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Validation
const VALID_ACTIONS = ['commit', 'rollback', 'history', 'diff', 'tag', 'pin', 'preview', 'cleanup'];

function validateInput(action: string, body: any): { valid: boolean; error?: string } {
  if (!VALID_ACTIONS.includes(action)) {
    return { valid: false, error: `Invalid action: ${action}` };
  }
  
  switch (action) {
    case 'commit':
      if (!body.prompt_row_id) return { valid: false, error: 'prompt_row_id required' };
      if (body.commit_message?.length > 500) return { valid: false, error: 'commit_message max 500 chars' };
      if (body.tag_name && !/^[\w\-\.]{1,50}$/.test(body.tag_name)) {
        return { valid: false, error: 'tag_name: alphanumeric, max 50 chars' };
      }
      break;
    case 'rollback':
      if (!body.prompt_row_id || !body.version_id) {
        return { valid: false, error: 'prompt_row_id and version_id required' };
      }
      break;
    case 'history':
      if (!body.prompt_row_id) return { valid: false, error: 'prompt_row_id required' };
      if (body.limit && (body.limit < 1 || body.limit > 100)) {
        return { valid: false, error: 'limit: 1-100' };
      }
      break;
    case 'diff':
      if (!body.prompt_row_id) return { valid: false, error: 'prompt_row_id required' };
      break;
    case 'tag':
    case 'pin':
    case 'preview':
      if (!body.version_id) return { valid: false, error: 'version_id required' };
      break;
  }
  
  return { valid: true };
}

// LCS-based line diff
function computeLineDiff(oldText: string | null, newText: string | null): Array<{
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: { old?: number; new?: number };
}> {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const result: Array<any> = [];
  
  // LCS computation
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack for matches
  const matches: Array<{ oldIndex: number; newIndex: number }> = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  // Build diff output
  let oldIdx = 0, newIdx = 0, oldLineNum = 1, newLineNum = 1;
  
  for (const match of matches) {
    while (oldIdx < match.oldIndex) {
      result.push({ type: 'removed', content: oldLines[oldIdx++], lineNumber: { old: oldLineNum++ } });
    }
    while (newIdx < match.newIndex) {
      result.push({ type: 'added', content: newLines[newIdx++], lineNumber: { new: newLineNum++ } });
    }
    result.push({
      type: 'unchanged',
      content: oldLines[oldIdx],
      lineNumber: { old: oldLineNum++, new: newLineNum++ }
    });
    oldIdx++; newIdx++;
  }
  
  while (oldIdx < oldLines.length) {
    result.push({ type: 'removed', content: oldLines[oldIdx++], lineNumber: { old: oldLineNum++ } });
  }
  while (newIdx < newLines.length) {
    result.push({ type: 'added', content: newLines[newIdx++], lineNumber: { new: newLineNum++ } });
  }
  
  return result;
}

// Deep diff for JSONB
function computeDeepDiff(oldVal: any, newVal: any, path = ''): Array<{
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}> {
  const changes: Array<any> = [];
  
  if (oldVal === newVal) return changes;
  if (oldVal === null && newVal !== null) {
    return [{ path: path || 'root', type: 'added', newValue: newVal }];
  }
  if (oldVal !== null && newVal === null) {
    return [{ path: path || 'root', type: 'removed', oldValue: oldVal }];
  }
  if (typeof oldVal !== typeof newVal) {
    return [{ path: path || 'root', type: 'modified', oldValue: oldVal, newValue: newVal }];
  }
  
  if (typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal)) {
    const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in oldVal)) {
        changes.push({ path: childPath, type: 'added', newValue: newVal[key] });
      } else if (!(key in newVal)) {
        changes.push({ path: childPath, type: 'removed', oldValue: oldVal[key] });
      } else {
        changes.push(...computeDeepDiff(oldVal[key], newVal[key], childPath));
      }
    }
  } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
    changes.push({ path: path || 'root', type: 'modified', oldValue: oldVal, newValue: newVal });
  }
  
  return changes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Timeout wrapper
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization required', code: 'AUTH_REQUIRED' }, 401);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid authentication', code: 'AUTH_INVALID' }, 401);
    }
    
    const body = await req.json();
    const { action } = body;
    
    const validation = validateInput(action, body);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error, code: 'INVALID_INPUT' }, 400);
    }
    
    let result: any;
    
    switch (action) {
      case 'commit': {
        const { data, error } = await supabase.rpc('create_prompt_version', {
          p_prompt_row_id: body.prompt_row_id,
          p_commit_message: body.commit_message || null,
          p_commit_type: 'manual',
          p_tag_name: body.tag_name || null
        });
        if (error) throw error;
        result = data?.[0] || data;
        break;
      }
      
      case 'rollback': {
        const { data, error } = await supabase.rpc('rollback_prompt_version', {
          p_prompt_row_id: body.prompt_row_id,
          p_target_version_id: body.version_id,
          p_create_backup: body.create_backup !== false
        });
        if (error) throw error;
        result = data?.[0] || data;
        break;
      }
      
      case 'history': {
        const limit = Math.min(body.limit || 50, 100);
        const offset = body.offset || 0;
        
        const { data, error, count } = await supabase
          .from(TABLES.PROMPT_VERSIONS)
          .select('row_id, version_number, commit_message, commit_type, fields_changed, tag_name, is_pinned, created_at, created_by', { count: 'exact' })
          .eq('prompt_row_id', body.prompt_row_id)
          .order('version_number', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (error) throw error;
        result = { versions: data || [], total: count || 0 };
        break;
      }
      
      case 'diff': {
        let oldSnapshot: any;
        let newSnapshot: any;
        
        // version_b is the base (older)
        if (body.version_b) {
          const { data, error } = await supabase
            .from(TABLES.PROMPT_VERSIONS)
            .select('snapshot')
            .eq('row_id', body.version_b)
            .single();
          if (error) throw error;
          oldSnapshot = data.snapshot;
        } else {
          // Default: most recent committed version
          const { data, error } = await supabase
            .from(TABLES.PROMPT_VERSIONS)
            .select('snapshot')
            .eq('prompt_row_id', body.prompt_row_id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();
          if (error && error.code !== 'PGRST116') throw error;
          oldSnapshot = data?.snapshot || {};
        }
        
        // version_a is target (newer/current)
        if (body.version_a) {
          const { data, error } = await supabase
            .from(TABLES.PROMPT_VERSIONS)
            .select('snapshot')
            .eq('row_id', body.version_a)
            .single();
          if (error) throw error;
          newSnapshot = data.snapshot;
        } else {
          // Default: current prompt state
          const { data, error } = await supabase
            .from(TABLES.PROMPTS)
            .select('*')
            .eq('row_id', body.prompt_row_id)
            .single();
          if (error) throw error;
          newSnapshot = data;
        }
        
        const textFields = ['input_admin_prompt', 'input_user_prompt', 'note'];
        const jsonFields = ['post_action_config', 'question_config', 'variable_assignments_config', 'extracted_variables', 'system_variables'];
        const changes: Array<any> = [];
        
        const allKeys = new Set([...Object.keys(oldSnapshot || {}), ...Object.keys(newSnapshot || {})]);
        
        for (const field of allKeys) {
          const oldVal = oldSnapshot?.[field];
          const newVal = newSnapshot?.[field];
          
          if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
          
          if (textFields.includes(field)) {
            changes.push({
              field,
              type: oldVal === undefined ? 'added' : newVal === undefined ? 'removed' : 'modified',
              textDiff: computeLineDiff(oldVal, newVal)
            });
          } else if (jsonFields.includes(field)) {
            changes.push({
              field,
              type: oldVal === undefined ? 'added' : newVal === undefined ? 'removed' : 'modified',
              deepDiff: computeDeepDiff(oldVal, newVal)
            });
          } else {
            changes.push({
              field,
              type: oldVal === undefined ? 'added' : newVal === undefined ? 'removed' : 'modified',
              oldValue: oldVal,
              newValue: newVal
            });
          }
        }
        
        result = { changes };
        break;
      }
      
      case 'tag': {
        const { error } = await supabase
          .from(TABLES.PROMPT_VERSIONS)
          .update({ tag_name: body.tag_name || null })
          .eq('row_id', body.version_id);
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      case 'pin': {
        const { error } = await supabase
          .from(TABLES.PROMPT_VERSIONS)
          .update({ is_pinned: !!body.is_pinned })
          .eq('row_id', body.version_id);
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      case 'preview': {
        const { data, error } = await supabase
          .from(TABLES.PROMPT_VERSIONS)
          .select('*')
          .eq('row_id', body.version_id)
          .single();
        if (error) throw error;
        result = {
          snapshot: data.snapshot,
          metadata: {
            version_number: data.version_number,
            commit_message: data.commit_message,
            created_at: data.created_at,
            tag_name: data.tag_name,
            is_pinned: data.is_pinned
          }
        };
        break;
      }
      
      case 'cleanup': {
        const { data, error } = await supabase.rpc('cleanup_old_prompt_versions', {
          p_max_age_days: body.max_age_days || 90,
          p_min_versions_to_keep: body.min_versions || 10
        });
        if (error) throw error;
        result = { deleted_count: data };
        break;
      }
    }
    
    clearTimeout(timeout);
    return jsonResponse(result);
    
  } catch (error) {
    clearTimeout(timeout);
    console.error('prompt-versions error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAbort = error instanceof Error && error.name === 'AbortError';
    
    if (isAbort) {
      return jsonResponse({ error: 'Request timeout', code: 'TIMEOUT' }, 504);
    }
    
    const isClientError = message.includes('not found') || 
                          message.includes('Not authorized') ||
                          message.includes('already exists');
    
    return jsonResponse(
      { error: message, code: isClientError ? 'CLIENT_ERROR' : 'SERVER_ERROR' },
      isClientError ? 400 : 500
    );
  }
});
