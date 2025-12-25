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
      
      console.log(`[confluence-manager] v1 Requesting: ${options.method || 'GET'} ${url}`);
      
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
        console.error(`[confluence-manager] Confluence API v1 error: ${response.status}`, errorText);
        throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    };

    // Make authenticated request to Confluence API v2 (required for folders, whiteboards, databases)
    const confluenceRequestV2 = async (
      endpoint: string, 
      config: { baseUrl: string; email: string; apiToken: string },
      options: { method?: string; body?: any } = {}
    ) => {
      const { baseUrl, email, apiToken } = config;
      
      if (!baseUrl || !email || !apiToken) {
        throw new Error('Confluence credentials not configured');
      }
      
      let cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      if (!cleanBaseUrl.endsWith('/wiki')) {
        cleanBaseUrl += '/wiki';
      }
      
      // v2 uses /api/v2 instead of /rest/api
      const url = `${cleanBaseUrl}/api/v2${endpoint}`;
      const auth = btoa(`${email}:${apiToken}`);
      
      console.log(`[confluence-manager] v2 Requesting: ${options.method || 'GET'} ${url}`);
      
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
        console.error(`[confluence-manager] Confluence API v2 error: ${response.status}`, errorText);
        throw new Error(`Confluence API v2 error: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    };

    // Map v2 API response to standard node format
    const mapV2NodeToStandard = (item: any, spaceKey: string, config: any) => ({
      id: String(item.id),
      title: item.title,
      type: item.type || 'page', // 'page', 'folder', 'whiteboard', 'database'
      spaceKey,
      url: item._links?.webui ? `${config.baseUrl}/wiki${item._links.webui}` : null,
      position: item.childPosition ?? null,
      hasChildren: item.type === 'folder' || item.type === 'page', // folders and pages can have children
      children: [],
      loaded: false,
      isFolder: item.type === 'folder',
      isWhiteboard: item.type === 'whiteboard',
      isDatabase: item.type === 'database',
    });

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

        console.log(`[confluence-manager] Fetching space tree for: ${spaceKey}`);

        // Step 1: Get space info + homepage ID using v1 API (reliable across all tenants)
        let spaceName = spaceKey;
        let spaceHomepageId: string | null = null;

        try {
          const spaceData = await confluenceRequest(`/space/${encodeURIComponent(spaceKey)}?expand=homepage`, config);
          spaceName = spaceData.name || spaceKey;
          spaceHomepageId = spaceData.homepage?.id ? String(spaceData.homepage.id) : null;
          console.log(`[confluence-manager] Space info: name=${spaceName} homepageId=${spaceHomepageId}`);
        } catch (e) {
          console.error('[confluence-manager] Failed to get space info:', e);
          throw new Error(`Could not access space: ${spaceKey}`);
        }

        // Step 2: Get homepage's direct children using v2 API (includes folders, pages, whiteboards, databases)
        // This is the correct way to get the top-level content tree
        const rootNodes: any[] = [];

        if (spaceHomepageId) {
          try {
            let cursor: string | null = null;
            
            while (true) {
              const url = cursor 
                ? `/pages/${spaceHomepageId}/direct-children?limit=250&cursor=${cursor}`
                : `/pages/${spaceHomepageId}/direct-children?limit=250`;
              
              const data = await confluenceRequestV2(url, config);
              
              const batch = (data?.results || []).map((item: any, idx: number) => ({
                id: String(item.id),
                title: item.title,
                type: item.type || 'page',
                spaceKey,
                spaceName,
                url: item._links?.webui ? `${config.baseUrl}/wiki${item._links.webui}` : null,
                position: item.childPosition ?? item.position ?? idx,
                hasChildren: item.type === 'folder' || item.type === 'page', // folders and pages can have children
                children: [],
                loaded: false, // lazy load children on expand
                isHomepage: false,
                isFolder: item.type === 'folder',
                isWhiteboard: item.type === 'whiteboard',
                isDatabase: item.type === 'database',
              }));
              
              rootNodes.push(...batch);
              
              if (data?._links?.next) {
                try {
                  const nextUrl = new URL(data._links.next, config.baseUrl);
                  cursor = nextUrl.searchParams.get('cursor');
                  if (!cursor) break;
                } catch {
                  break;
                }
              } else {
                break;
              }
              
              if (rootNodes.length > 500) break; // safety limit for initial load
            }
            
            console.log(`[confluence-manager] v2 direct-children fetched: ${rootNodes.length} items`);
          } catch (e) {
            console.log('[confluence-manager] v2 direct-children failed, falling back to v1:', e);
          }
        }

        // Fallback: If v2 failed or no homepage, use v1 pages-only approach
        if (rootNodes.length === 0) {
          console.log('[confluence-manager] Using v1 fallback for space tree');
          
          const fetchAllV1 = async (baseEndpoint: string, limit = 200) => {
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
              if (start > 5000) break;
            }

            return results;
          };

          const allPages = await fetchAllV1(
            `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&status=current&expand=ancestors,extensions.position,childTypes.page`,
            200
          );

          const getPosition = (content: any): number | null => {
            const pos = content?.extensions?.position;
            if (typeof pos === 'number' && Number.isFinite(pos)) return pos;
            if (typeof pos === 'string') {
              const n = Number(pos);
              return Number.isFinite(n) ? n : null;
            }
            return null;
          };

          const pageMap = new Map<string, any>();
          for (const content of allPages) {
            const ancestors = content.ancestors || [];
            const immediateParent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
            const parentId = immediateParent?.id ? String(immediateParent.id) : null;

            pageMap.set(String(content.id), {
              id: String(content.id),
              title: content.title,
              type: 'page',
              spaceKey,
              spaceName,
              url: content._links?.webui ? `${config.baseUrl}/wiki${content._links.webui}` : null,
              parentId,
              position: getPosition(content),
              hasChildren: content.childTypes?.page?.value || false,
              children: [],
              loaded: false, // lazy load
              isHomepage: String(content.id) === String(spaceHomepageId),
              isFolder: false,
              isWhiteboard: false,
              isDatabase: false,
            });
          }

          // Build tree structure
          for (const node of pageMap.values()) {
            if (node.parentId) {
              const parent = pageMap.get(node.parentId);
              if (parent) {
                parent.children.push(node);
                node.loaded = true; // if we have children inline, mark as loaded
              }
            }
          }

          // Mark parents as loaded if they have children populated
          for (const node of pageMap.values()) {
            if (node.children.length > 0) {
              node.loaded = true;
            }
          }

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

          // Find root nodes (no parent in our set, or parent is homepage)
          for (const node of pageMap.values()) {
            const hasParentInSet = node.parentId && pageMap.has(node.parentId);
            if (!hasParentInSet) rootNodes.push(node);
          }

          sortNodes(rootNodes);

          // Put homepage first if present
          if (spaceHomepageId) {
            const idx = rootNodes.findIndex((r) => r.id === String(spaceHomepageId));
            if (idx > 0) {
              const [home] = rootNodes.splice(idx, 1);
              rootNodes.unshift(home);
            }
          }
        } else {
          // Sort v2 results
          rootNodes.sort((a, b) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return (a.title || '').localeCompare(b.title || '');
          });
        }

        console.log(`[confluence-manager] Built tree with ${rootNodes.length} root nodes`);
        result = { tree: rootNodes, totalPages: rootNodes.length, totalBlogs: 0, spaceName };
        break;
      }

      case 'get-page-children': {
        const { pageId, spaceKey, nodeType } = params;
        const config = await getConfluenceConfig();

        const parentType = nodeType || 'page';
        console.log(`[confluence-manager] Getting direct children for ${parentType} ${pageId}`);

        // v2 canonical: */{id}/direct-children (mixed types)
        const base = (() => {
          switch (parentType) {
            case 'folder':
              return `/folders/${pageId}/direct-children`;
            case 'whiteboard':
              return `/whiteboards/${pageId}/direct-children`;
            case 'database':
              return `/databases/${pageId}/direct-children`;
            default:
              return `/pages/${pageId}/direct-children`;
          }
        })();

        try {
          const allChildren: any[] = [];
          let cursor: string | null = null;

          while (true) {
            const url = cursor ? `${base}?limit=250&cursor=${cursor}` : `${base}?limit=250`;
            const data = await confluenceRequestV2(url, config);

            const batch = (data?.results || []).map((item: any, idx: number) => ({
              id: String(item.id),
              title: item.title,
              type: item.type || 'page',
              spaceKey,
              url: item._links?.webui ? `${config.baseUrl}/wiki${item._links.webui}` : null,
              position: item.childPosition ?? item.position ?? idx,
              hasChildren: item.type === 'folder' || item.type === 'page',
              children: [],
              loaded: false,
              isFolder: item.type === 'folder',
              isWhiteboard: item.type === 'whiteboard',
              isDatabase: item.type === 'database',
            }));

            allChildren.push(...batch);

            if (data?._links?.next) {
              const nextUrl = new URL(data._links.next, config.baseUrl);
              cursor = nextUrl.searchParams.get('cursor');
              if (!cursor) break;
            } else {
              break;
            }

            if (allChildren.length > 5000) break;
          }

          allChildren.sort((a, b) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return a.title.localeCompare(b.title);
          });

          result = { children: allChildren };
        } catch (e) {
          console.log(`[confluence-manager] v2 direct-children failed for ${parentType}; falling back to v1 pages-only`, e);

          // Fallback to v1 (pages only)
          const allChildren: any[] = [];
          let start = 0;
          const limit = 200;

          while (true) {
            const data = await confluenceRequest(
              `/content/${pageId}/child/page?start=${start}&limit=${limit}&expand=extensions.position,childTypes.page`,
              config
            );

            const batch = (data.results || []).map((page: any, idx: number) => ({
              id: page.id,
              title: page.title,
              type: 'page',
              spaceKey,
              url: page._links?.webui ? `${config.baseUrl}/wiki${page._links.webui}` : null,
              position: page.extensions?.position ?? (start + idx),
              hasChildren: page.childTypes?.page?.value || false,
              children: [],
              loaded: false,
            }));

            allChildren.push(...batch);

            if (data.size < limit || !data._links?.next) break;
            start += limit;
            if (start > 5000) break;
          }

          allChildren.sort((a, b) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return a.title.localeCompare(b.title);
          });

          result = { children: allChildren };
        }

        break;
      }

      case 'get-folder-children': {
        // Redirect to get-page-children with folder type for backwards compatibility
        const { folderId, spaceKey } = params;
        console.log(`[confluence-manager] get-folder-children redirecting to get-page-children for folder ${folderId}`);
        
        // Call the unified handler with folder type
        const config = await getConfluenceConfig();
        const allChildren: any[] = [];
        let cursor: string | null = null;

        while (true) {
          const url = cursor
            ? `/folders/${folderId}/direct-children?limit=250&cursor=${cursor}`
            : `/folders/${folderId}/direct-children?limit=250`;

          const data = await confluenceRequestV2(url, config);

          const batch = (data?.results || []).map((item: any, idx: number) => ({
            id: String(item.id),
            title: item.title,
            type: item.type || 'page',
            spaceKey,
            url: item._links?.webui ? `${config.baseUrl}/wiki${item._links.webui}` : null,
            position: item.childPosition ?? item.position ?? idx,
            hasChildren: item.type === 'folder' || item.type === 'page',
            children: [],
            loaded: false,
            isFolder: item.type === 'folder',
            isWhiteboard: item.type === 'whiteboard',
            isDatabase: item.type === 'database',
          }));

          allChildren.push(...batch);

          if (data?._links?.next) {
            const nextUrl = new URL(data._links.next, config.baseUrl);
            cursor = nextUrl.searchParams.get('cursor');
            if (!cursor) break;
          } else {
            break;
          }

          if (allChildren.length > 500) break; // safety limit
        }

        allChildren.sort((a, b) => {
          const ap = a.position ?? Number.MAX_SAFE_INTEGER;
          const bp = b.position ?? Number.MAX_SAFE_INTEGER;
          if (ap !== bp) return ap - bp;
          return a.title.localeCompare(b.title);
        });

        result = { children: allChildren };
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
        
        // Fetch page content with ancestors and position for hierarchy and ordering
        const data = await confluenceRequest(`/content/${pageId}?expand=body.storage,space,ancestors,extensions.position`, config);
        
        const contentHtml = data.body?.storage?.value || '';
        const contentText = htmlToText(contentHtml);
        
        // Get parent page ID from ancestors (last ancestor is direct parent)
        const parentPageId = data.ancestors?.length > 0 
          ? data.ancestors[data.ancestors.length - 1]?.id 
          : null;
        
        // Determine content type from data or passed param
        const resolvedContentType = contentType || data.type || 'page';
        
        // Extract position from extensions
        const position = data.extensions?.position ?? null;
        
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
            position: position,
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
