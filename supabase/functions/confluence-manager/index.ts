import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TABLES } from "../_shared/tables.ts";

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

// Parse template variables from Confluence template body
function parseTemplateVariables(body: string): string[] {
  const variables: string[] = [];
  // Match <at:var at:name="variableName" /> pattern
  const regex = /<at:var\s+at:name="([^"]+)"\s*\/?>/gi;
  let match;
  while ((match = regex.exec(body)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
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
        .from(TABLES.SETTINGS)
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

    // Make authenticated request to Confluence API v1
    const confluenceRequest = async (
      endpoint: string, 
      config: { baseUrl: string; email: string; apiToken: string },
      options: { method?: string; body?: any } = {}
    ) => {
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
      
      console.log(`[confluence-manager] Requesting: ${options.method || 'GET'} ${url}`);
      
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };
      
      if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(url, fetchOptions);
      
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
        const data = await confluenceRequest('/space?limit=100&expand=description.plain', config);
        result = {
          spaces: data.results?.map((space: any) => ({
            id: space.id, // Numeric ID for v2 API calls
            key: space.key,
            name: space.name,
            type: space.type,
            description: space.description?.plain?.value || ''
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
            url: page._links?.webui ? `${config.baseUrl}/wiki${page._links.webui}` : null
          })) || []
        };
        break;
      }

      case 'get-space-tree': {
        const { spaceKey } = params;
        const config = await getConfluenceConfig();

        console.log(`[confluence-manager] Fetching comprehensive space tree for: ${spaceKey}`);

        // Fetch space info to get the homepage
        let spaceHomepageId: string | null = null;
        let spaceName = spaceKey;
        try {
          const spaceData = await confluenceRequest(
            `/space/${encodeURIComponent(spaceKey)}?expand=homepage`,
            config
          );
          spaceHomepageId = spaceData.homepage?.id || null;
          spaceName = spaceData.name || spaceKey;
          console.log(`[confluence-manager] Space homepage ID: ${spaceHomepageId}`);
        } catch (e) {
          console.log(`[confluence-manager] Could not fetch space info:`, e);
        }

        // Confluence caps page size; fetch all pages with pagination
        const fetchAllContent = async (baseEndpoint: string, limit = 200) => {
          const results: any[] = [];
          let start = 0;

          while (true) {
            const sep = baseEndpoint.includes('?') ? '&' : '?';
            const endpoint = `${baseEndpoint}${sep}start=${start}&limit=${limit}`;
            const data = await confluenceRequest(endpoint, config);

            const pageResults = data?.results || [];
            results.push(...pageResults);

            const isLastPage = pageResults.length < limit || !data?._links?.next;
            if (isLastPage) break;

            start += limit;
            // Hard safety cap to avoid runaway loops
            if (start > 20000) break;
          }

          return results;
        };

        // Fetch all pages in the space with their ancestors + position (Confluence ordering)
        const allPages = await fetchAllContent(
          `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&status=current&expand=ancestors,extensions.position`,
          200
        );
        console.log(`[confluence-manager] Fetched ${allPages.length} pages from space ${spaceKey}`);

        // Fetch folders (Confluence Cloud feature)
        let allFolders: any[] = [];
        try {
          allFolders = await fetchAllContent(
            `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=folder&status=current&expand=ancestors,extensions.position`,
            200
          );
          console.log(`[confluence-manager] Fetched ${allFolders.length} folders from space ${spaceKey}`);
        } catch (e) {
          console.log(`[confluence-manager] Could not fetch folders (may not be supported):`, e);
        }

        // Fetch whiteboards
        let allWhiteboards: any[] = [];
        try {
          allWhiteboards = await fetchAllContent(
            `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=whiteboard&status=current&expand=ancestors,extensions.position`,
            200
          );
          console.log(`[confluence-manager] Fetched ${allWhiteboards.length} whiteboards from space ${spaceKey}`);
        } catch (e) {
          console.log(`[confluence-manager] Could not fetch whiteboards (may not be supported):`, e);
        }

        // Fetch databases
        let allDatabases: any[] = [];
        try {
          allDatabases = await fetchAllContent(
            `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=database&status=current&expand=ancestors,extensions.position`,
            200
          );
          console.log(`[confluence-manager] Fetched ${allDatabases.length} databases from space ${spaceKey}`);
        } catch (e) {
          console.log(`[confluence-manager] Could not fetch databases (may not be supported):`, e);
        }

        // Combine all content types
        const allContent = [...allPages, ...allFolders, ...allWhiteboards, ...allDatabases];
        console.log(`[confluence-manager] Total content items: ${allContent.length}`);

        // Fetch all blog posts in the space
        let blogPosts: any[] = [];
        try {
          blogPosts = await fetchAllContent(
            `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=blogpost&status=current`,
            200
          );
          console.log(`[confluence-manager] Fetched ${blogPosts.length} blog posts`);
        } catch (e) {
          console.log(`[confluence-manager] Could not fetch blogs:`, e);
        }

        const getPosition = (content: any): number | null => {
          const pos = content?.extensions?.position;
          if (typeof pos === 'number' && Number.isFinite(pos)) return pos;
          if (typeof pos === 'string') {
            const n = Number(pos);
            return Number.isFinite(n) ? n : null;
          }
          return null;
        };

        // Build nodes - first pass: create all nodes from ALL content types
        const pageMap = new Map<string, any>();
        let nullParentCount = 0;
        let missingParentCount = 0;
        
        for (const content of allContent) {
          // Get immediate parent from ancestors array (last element is immediate parent)
          const ancestors = content.ancestors || [];
          const immediateParent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
          const parentId = immediateParent?.id ? String(immediateParent.id) : null;
          
          // Determine content type for icon display
          const contentType = content.type || 'page';
          
          pageMap.set(String(content.id), {
            id: String(content.id),
            title: content.title,
            type: contentType,
            spaceKey: content.space?.key || spaceKey,
            spaceName: content.space?.name || spaceName,
            url: content._links?.webui ? `${config.baseUrl}/wiki${content._links.webui}` : null,
            parentId,
            position: getPosition(content),
            children: [],
            loaded: true,
            isHomepage: String(content.id) === String(spaceHomepageId),
            isFolder: contentType === 'folder',
            isWhiteboard: contentType === 'whiteboard',
            isDatabase: contentType === 'database',
          });
          
          if (!parentId) nullParentCount++;
        }
        
        console.log(`[confluence-manager] Content items with null parentId: ${nullParentCount}`);

        // Fix orphans by finding their nearest existing ancestor
        // This handles cases where a page's immediate parent wasn't fetched
        let reparentedCount = 0;
        for (const content of allContent) {
          const node = pageMap.get(String(content.id));
          if (!node || !node.parentId) continue;
          
          const parent = pageMap.get(node.parentId);
          if (parent) continue; // Parent exists, no fix needed
          
          // Parent is missing - walk up ancestors array to find nearest existing ancestor
          const ancestors = content.ancestors || [];
          // Walk backwards from second-to-last (since last is the missing parent)
          for (let i = ancestors.length - 2; i >= 0; i--) {
            const ancestorId = String(ancestors[i].id);
            if (pageMap.has(ancestorId)) {
              node.parentId = ancestorId; // Re-parent to existing ancestor
              reparentedCount++;
              break;
            }
          }
          // If no ancestor found in pageMap, node becomes a root item
        }
        
        console.log(`[confluence-manager] Re-parented ${reparentedCount} orphaned items to existing ancestors`);

        // Attach children to parents
        for (const node of pageMap.values()) {
          if (node.parentId) {
            const parent = pageMap.get(node.parentId);
            if (parent) {
              parent.children.push(node);
            } else {
              missingParentCount++;
            }
          }
        }
        
        console.log(`[confluence-manager] Content items with missing parent in set: ${missingParentCount}`);

        const sortNodes = (nodes: any[]) => {
          nodes.sort((a, b) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return (a.title || '').localeCompare(b.title || '');
          });
          for (const n of nodes) {
            if (n.children?.length) sortNodes(n.children);
          }
        };

        // Roots: pages with no parent in our set (should only be homepage + orphans)
        const roots: any[] = [];
        for (const node of pageMap.values()) {
          const hasParentInSet = node.parentId && pageMap.has(node.parentId);
          if (!hasParentInSet) roots.push(node);
        }

        sortNodes(roots);

        // Make homepage appear first (Confluence sidebar behavior)
        const homepageIdStr = spaceHomepageId ? String(spaceHomepageId) : null;
        if (homepageIdStr) {
          const idx = roots.findIndex((r) => r.id === homepageIdStr);
          if (idx > 0) {
            const [home] = roots.splice(idx, 1);
            roots.unshift(home);
          }
        }

        // Mark hasChildren from built tree
        const markHasChildren = (nodes: any[]) => {
          for (const n of nodes) {
            n.hasChildren = (n.children?.length || 0) > 0;
            if (n.hasChildren) markHasChildren(n.children);
          }
        };
        markHasChildren(roots);

        const tree: any[] = [...roots];

        // Blog section (separate content type; Confluence shows it separately)
        if (blogPosts.length > 0) {
          const blogNodes = blogPosts.map((blog: any) => ({
            id: blog.id,
            title: blog.title,
            type: 'blogpost',
            spaceKey,
            spaceName,
            url: blog._links?.webui ? `${config.baseUrl}/wiki${blog._links.webui}` : null,
            hasChildren: false,
            children: [],
            loaded: true,
            position: getPosition(blog),
            isBlogpost: true, // Mark as attachable blog post
          }));

          // Keep Confluence ordering (position) if present; otherwise fallback to title
          blogNodes.sort((a: any, b: any) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return (a.title || '').localeCompare(b.title || '');
          });

          tree.push({
            id: `__blog_container_${spaceKey}`,
            title: 'Blog',
            type: 'container',
            isContainer: true,
            isBlogContainer: true,
            hasChildren: true,
            children: blogNodes,
            loaded: true,
            spaceKey,
          });
        }

        console.log(`[confluence-manager] Built tree with ${tree.length} top-level items, ${allPages.length} pages total`);

        result = { tree, totalPages: allPages.length, totalBlogs: blogPosts.length, spaceName };
        break;
      }

      case 'get-page-children': {
        const { pageId, spaceKey } = params;
        const config = await getConfluenceConfig();

        // Fetch children of a specific page (Confluence returns them in the UI order)
        const data = await confluenceRequest(
          `/content/${pageId}/child/page?limit=200&expand=extensions.position`,
          config
        );

        const children = (data.results || []).map((page: any) => ({
          id: page.id,
          title: page.title,
          type: 'page',
          spaceKey,
          url: page._links?.webui ? `${config.baseUrl}/wiki${page._links.webui}` : null,
          // We don't know if it has children until expanded; keep lazy-loading behavior
          hasChildren: true,
          children: [],
          loaded: false,
        }));

        result = { children, hasMore: data.size >= 200 };
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
            url: data._links?.webui ? `${config.baseUrl}/wiki${data._links.webui}` : null,
            contentHtml,
            contentText
          }
        };
        break;
      }

      case 'list-templates': {
        const { spaceKey } = params;
        const config = await getConfluenceConfig();
        
        console.log(`[confluence-manager] Fetching templates for space: ${spaceKey}`);
        
        // Fetch content templates for the space
        const data = await confluenceRequest(
          `/template/page?spaceKey=${encodeURIComponent(spaceKey)}&expand=body`,
          config
        );
        
        const templates = (data.results || []).map((template: any) => {
          const bodyValue = template.body?.storage?.value || template.body?.value || '';
          const variables = parseTemplateVariables(bodyValue);
          
          return {
            templateId: template.templateId,
            name: template.name,
            description: template.description || '',
            templateType: template.templateType,
            variables,
            body: bodyValue
          };
        });
        
        console.log(`[confluence-manager] Found ${templates.length} templates`);
        
        result = { templates };
        break;
      }

      case 'create-page': {
        const { spaceKey, parentId, title, body, templateId } = params;
        
        // Validate required fields
        if (!spaceKey) {
          throw new Error('Space key is required');
        }
        if (!title) {
          throw new Error('Page title is required');
        }
        
        console.log(`[confluence-manager] Creating page:`, {
          spaceKey,
          parentId: parentId || 'none',
          title,
          bodyLength: body?.length || 0
        });
        
        const config = await getConfluenceConfig();
        
        const pageData: any = {
          type: 'page',
          title,
          space: { key: spaceKey },
          body: {
            storage: {
              value: body,
              representation: 'storage'
            }
          }
        };
        
        // Add parent page/folder if specified
        if (parentId) {
          pageData.ancestors = [{ id: parentId }];
        }
        
        const createdPage = await confluenceRequest('/content', config, {
          method: 'POST',
          body: pageData
        });
        
        const pageUrl = createdPage._links?.webui 
          ? `${config.baseUrl}/wiki${createdPage._links.webui}` 
          : null;
        
        console.log(`[confluence-manager] Created page: ${createdPage.id} - ${createdPage.title}`);
        
        result = {
          success: true,
          page: {
            id: createdPage.id,
            title: createdPage.title,
            spaceKey: createdPage.space?.key,
            url: pageUrl
          }
        };
        break;
      }

      case 'attach-page': {
        const { pageId, assistantRowId, promptRowId, contentType } = params;
        const config = await getConfluenceConfig();
        
        // Fetch page content with ancestors for hierarchy
        const data = await confluenceRequest(`/content/${pageId}?expand=body.storage,space,ancestors`, config);
        
        const contentHtml = data.body?.storage?.value || '';
        const contentText = htmlToText(contentHtml);
        
        // Get parent page ID from ancestors (last ancestor is direct parent)
        const parentPageId = data.ancestors?.length > 0 
          ? data.ancestors[data.ancestors.length - 1]?.id 
          : null;
        
        // Determine content type from data or passed param
        const resolvedContentType = contentType || data.type || 'page';
        
        // Insert into database
        const { data: inserted, error } = await supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .insert({
            assistant_row_id: assistantRowId || null,
            prompt_row_id: promptRowId || null,
            page_id: data.id,
            page_title: data.title,
            space_key: data.space?.key,
            space_name: data.space?.name,
            page_url: data._links?.webui ? `${config.baseUrl}/wiki${data._links.webui}` : null,
            content_html: contentHtml,
            content_text: contentText,
            parent_page_id: parentPageId,
            content_type: resolvedContentType,
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced'
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Auto-enable confluence_enabled on the assistant for live browsing
        if (assistantRowId) {
          const { error: updateError } = await supabase
            .from(TABLES.ASSISTANTS)
            .update({ confluence_enabled: true })
            .eq('row_id', assistantRowId);
          
          if (updateError) {
            console.log('[confluence-manager] Warning: Could not auto-enable confluence on assistant:', updateError);
          } else {
            console.log('[confluence-manager] Auto-enabled confluence_enabled on assistant:', assistantRowId);
          }
        }
        
        result = { success: true, page: inserted, confluenceAutoEnabled: !!assistantRowId };
        break;
      }

      case 'detach-page': {
        const { rowId } = params;
        
        const { error } = await supabase
          .from(TABLES.CONFLUENCE_PAGES)
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
          .from(TABLES.CONFLUENCE_PAGES)
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
          .from(TABLES.CONFLUENCE_PAGES)
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

      case 'sync-to-vector-store': 
      case 'sync-to-openai': {
        // Support both old and new action names for backwards compatibility
        const { rowId, assistantId } = params;
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        
        if (!openaiKey) {
          throw new Error('OpenAI API key not configured');
        }
        
        // Get the page content
        const { data: page, error: fetchError } = await supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .select('*')
          .eq('row_id', rowId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Upload content as a file for vector store indexing
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
          throw new Error(`File upload failed: ${errorText}`);
        }
        
        const uploadedFile = await uploadResponse.json();
        
        // Update the database record with the file ID for vector store
        const { error: updateError } = await supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .update({ openai_file_id: uploadedFile.id })
          .eq('row_id', rowId);
        
        if (updateError) throw updateError;
        
        result = { success: true, openaiFileId: uploadedFile.id };
        break;
      }

      case 'list-attached': {
        const { assistantRowId, promptRowId } = params;
        
        let query = supabase.from(TABLES.CONFLUENCE_PAGES).select('*');
        
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

    // IMPORTANT: Always return 200 so the web client can read the JSON body.
    // `supabase.functions.invoke` hides the response body on non-2xx.
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
