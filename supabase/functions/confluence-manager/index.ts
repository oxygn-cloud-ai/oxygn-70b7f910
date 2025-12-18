import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to strip HTML tags and clean text for LLM consumption
function htmlToText(html: string): string {
  if (!html) return '';
  
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();
  
  return text;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log(`[confluence-manager] Action: ${action}`, params);

    // Get Confluence credentials from settings
    const getConfluenceConfig = async () => {
      const { data: settings, error } = await supabase
        .from('cyg_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['confluence_base_url', 'confluence_email', 'confluence_api_token']);
      
      if (error) throw error;
      
      const config: Record<string, string> = {};
      settings?.forEach(s => {
        config[s.setting_key] = s.setting_value || '';
      });
      
      return {
        baseUrl: config.confluence_base_url || '',
        email: config.confluence_email || '',
        apiToken: config.confluence_api_token || ''
      };
    };

    // Make authenticated request to Confluence API
    const confluenceRequest = async (endpoint: string, config: { baseUrl: string; email: string; apiToken: string }) => {
      const { baseUrl, email, apiToken } = config;
      
      if (!baseUrl || !email || !apiToken) {
        throw new Error('Confluence credentials not configured');
      }
      
      // Ensure baseUrl doesn't end with /wiki if we're adding it
      let cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      if (!cleanBaseUrl.endsWith('/wiki')) {
        cleanBaseUrl += '/wiki';
      }
      
      const url = `${cleanBaseUrl}/rest/api${endpoint}`;
      const auth = btoa(`${email}:${apiToken}`);
      
      console.log(`[confluence-manager] Requesting: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[confluence-manager] Confluence API error: ${response.status}`, errorText);
        throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    };

    let result;

    switch (action) {
      case 'test-connection': {
        const config = await getConfluenceConfig();
        try {
          const data = await confluenceRequest('/space?limit=1', config);
          result = { success: true, message: 'Connection successful', spaces: data.results?.length || 0 };
        } catch (error: unknown) {
          result = { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'list-spaces': {
        const config = await getConfluenceConfig();
        const data = await confluenceRequest('/space?limit=100', config);
        result = {
          spaces: data.results?.map((space: any) => ({
            key: space.key,
            name: space.name,
            type: space.type
          })) || []
        };
        break;
      }

      case 'search-pages': {
        const { query, spaceKey } = params;
        const config = await getConfluenceConfig();
        
        let cql = `type=page AND text~"${query}"`;
        if (spaceKey) {
          cql += ` AND space="${spaceKey}"`;
        }
        
        const data = await confluenceRequest(`/content/search?cql=${encodeURIComponent(cql)}&limit=25`, config);
        result = {
          pages: data.results?.map((page: any) => ({
            id: page.id,
            title: page.title,
            spaceKey: page.space?.key,
            spaceName: page.space?.name,
            url: page._links?.webui ? `${config.baseUrl}${page._links.webui}` : null
          })) || []
        };
        break;
      }

      case 'get-space-tree': {
        const { spaceKey } = params;
        const config = await getConfluenceConfig();
        
        // Fetch only root pages (pages with 0 or 1 ancestor - the space home)
        // This is much faster than fetching all pages
        const data = await confluenceRequest(
          `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&status=current&expand=ancestors&limit=100`,
          config
        );
        
        // Filter to only root-level pages (no ancestors or just the space home page)
        const rootPages = (data.results || [])
          .filter((page: any) => !page.ancestors || page.ancestors.length <= 1)
          .map((page: any) => ({
            id: page.id,
            title: page.title,
            spaceKey: page.space?.key,
            spaceName: page.space?.name,
            url: page._links?.webui ? `${config.baseUrl}${page._links.webui}` : null,
            hasChildren: true, // Assume all pages might have children, we'll check on expand
            children: [],
            loaded: false
          }))
          .sort((a: any, b: any) => a.title.localeCompare(b.title));
        
        result = { tree: rootPages, totalPages: rootPages.length };
        break;
      }

      case 'get-page-children': {
        const { pageId, spaceKey } = params;
        const config = await getConfluenceConfig();
        
        // Fetch children of a specific page
        const data = await confluenceRequest(
          `/content/${pageId}/child/page?limit=100`,
          config
        );
        
        const children = (data.results || []).map((page: any) => ({
          id: page.id,
          title: page.title,
          spaceKey: spaceKey,
          url: page._links?.webui ? `${config.baseUrl}${page._links.webui}` : null,
          hasChildren: true, // Assume might have children
          children: [],
          loaded: false
        })).sort((a: any, b: any) => a.title.localeCompare(b.title));
        
        result = { children, hasMore: data.size >= 100 };
        break;
      }

      case 'get-page': {
        const { pageId } = params;
        const config = await getConfluenceConfig();
        
        const data = await confluenceRequest(`/content/${pageId}?expand=body.storage,space`, config);
        
        const contentHtml = data.body?.storage?.value || '';
        const contentText = htmlToText(contentHtml);
        
        result = {
          page: {
            id: data.id,
            title: data.title,
            spaceKey: data.space?.key,
            spaceName: data.space?.name,
            url: data._links?.webui ? `${config.baseUrl}${data._links.webui}` : null,
            contentHtml,
            contentText
          }
        };
        break;
      }

      case 'attach-page': {
        const { pageId, assistantRowId, promptRowId } = params;
        const config = await getConfluenceConfig();
        
        // Fetch page content
        const data = await confluenceRequest(`/content/${pageId}?expand=body.storage,space`, config);
        
        const contentHtml = data.body?.storage?.value || '';
        const contentText = htmlToText(contentHtml);
        
        // Insert into database
        const { data: inserted, error } = await supabase
          .from('cyg_confluence_pages')
          .insert({
            assistant_row_id: assistantRowId || null,
            prompt_row_id: promptRowId || null,
            page_id: data.id,
            page_title: data.title,
            space_key: data.space?.key,
            space_name: data.space?.name,
            page_url: data._links?.webui ? `${config.baseUrl}${data._links.webui}` : null,
            content_html: contentHtml,
            content_text: contentText,
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced'
          })
          .select()
          .single();
        
        if (error) throw error;
        
        result = { success: true, page: inserted };
        break;
      }

      case 'detach-page': {
        const { rowId } = params;
        
        const { error } = await supabase
          .from('cyg_confluence_pages')
          .delete()
          .eq('row_id', rowId);
        
        if (error) throw error;
        
        result = { success: true };
        break;
      }

      case 'sync-page': {
        const { rowId } = params;
        const config = await getConfluenceConfig();
        
        // Get the existing record
        const { data: existing, error: fetchError } = await supabase
          .from('cyg_confluence_pages')
          .select('page_id')
          .eq('row_id', rowId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Fetch fresh content from Confluence
        const data = await confluenceRequest(`/content/${existing.page_id}?expand=body.storage,space`, config);
        
        const contentHtml = data.body?.storage?.value || '';
        const contentText = htmlToText(contentHtml);
        
        // Update the record
        const { data: updated, error: updateError } = await supabase
          .from('cyg_confluence_pages')
          .update({
            page_title: data.title,
            space_key: data.space?.key,
            space_name: data.space?.name,
            content_html: contentHtml,
            content_text: contentText,
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced'
          })
          .eq('row_id', rowId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        result = { success: true, page: updated };
        break;
      }

      case 'sync-to-openai': {
        const { rowId, assistantId } = params;
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        
        if (!openaiKey) {
          throw new Error('OpenAI API key not configured');
        }
        
        // Get the page content
        const { data: page, error: fetchError } = await supabase
          .from('cyg_confluence_pages')
          .select('*')
          .eq('row_id', rowId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Upload content as a file to OpenAI
        const fileContent = `# ${page.page_title}\n\nSpace: ${page.space_name || page.space_key}\nSource: ${page.page_url}\n\n---\n\n${page.content_text}`;
        
        const formData = new FormData();
        const blob = new Blob([fileContent], { type: 'text/plain' });
        formData.append('file', blob, `confluence-${page.page_id}.txt`);
        formData.append('purpose', 'assistants');
        
        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`
          },
          body: formData
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`OpenAI file upload failed: ${errorText}`);
        }
        
        const uploadedFile = await uploadResponse.json();
        
        // Update the database record with the OpenAI file ID
        const { error: updateError } = await supabase
          .from('cyg_confluence_pages')
          .update({ openai_file_id: uploadedFile.id })
          .eq('row_id', rowId);
        
        if (updateError) throw updateError;
        
        result = { success: true, openaiFileId: uploadedFile.id };
        break;
      }

      case 'list-attached': {
        const { assistantRowId, promptRowId } = params;
        
        let query = supabase.from('cyg_confluence_pages').select('*');
        
        if (assistantRowId) {
          query = query.eq('assistant_row_id', assistantRowId);
        }
        if (promptRowId) {
          query = query.eq('prompt_row_id', promptRowId);
        }
        
        const { data: pages, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        result = { pages: pages || [] };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[confluence-manager] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
