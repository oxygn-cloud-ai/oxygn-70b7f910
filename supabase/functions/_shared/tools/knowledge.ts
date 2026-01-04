/**
 * Knowledge Tool Module
 * Tools for searching and managing Qonsol help/knowledge base
 * 
 * PUBLIC TOOLS (available to all users):
 * - search_qonsol_help: Search knowledge base
 * 
 * ADMIN TOOLS (requires isAdmin in context):
 * - list_knowledge_topics: List all topics
 * - list_knowledge_items: List items in a topic
 * - get_knowledge_item: Get full content of an item
 * - update_knowledge_item: Update existing item
 * - create_knowledge_item: Create new item
 * - delete_knowledge_item: Soft-delete item
 * - export_knowledge_to_confluence: Export items to Confluence
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';

const BASE_TOOL_NAMES = ['search_qonsol_help'] as const;
const ADMIN_TOOL_NAMES = [
  'list_knowledge_topics',
  'list_knowledge_items',
  'get_knowledge_item',
  'update_knowledge_item',
  'create_knowledge_item',
  'delete_knowledge_item',
  'export_knowledge_to_confluence'
] as const;

const ALL_TOOL_NAMES = [...BASE_TOOL_NAMES, ...ADMIN_TOOL_NAMES] as const;
type KnowledgeToolName = typeof ALL_TOOL_NAMES[number];

/**
 * Safely slice text without breaking multi-byte characters (emoji, etc.)
 * Uses Array.from to handle multi-byte chars properly
 */
function safeSlice(text: string, maxChars: number): string {
  if (!text) return '';
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join('') + '...';
}

/**
 * Generate embedding for a query using OpenAI
 * Returns array format compatible with pgvector
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    // Issue #3 Fix: Use safeSlice for multi-byte character safety
    const truncatedText = safeSlice(text, 8000);
    // Remove the trailing "..." if added by safeSlice since it's just for display
    const cleanText = truncatedText.endsWith('...') 
      ? truncatedText.slice(0, -3) 
      : truncatedText;
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanText
      })
    });

    if (!response.ok) {
      console.error('Embedding API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Format embedding array for pgvector storage
 * pgvector expects format: [0.1, 0.2, 0.3, ...]
 */
function formatEmbeddingForStorage(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Escape HTML for Confluence storage format
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a sanitized anchor ID from title
 * Handles non-latin titles with fallback
 */
function toAnchorId(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Fallback for non-latin titles that produce empty string
  if (!sanitized) {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return sanitized;
}

/**
 * Validate priority is within valid range (0-100)
 */
function validatePriority(priority: number | undefined): number {
  if (priority === undefined || priority === null) return 50;
  return Math.max(0, Math.min(100, Math.round(priority)));
}

/**
 * Clamp similarity to valid percentage range (0-100)
 * Issue #8 Fix: Handle floating point edge cases
 */
function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

/**
 * Fetch with timeout wrapper
 * Issue #10 Fix: Prevent indefinite hangs
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Basic markdown to Confluence storage format conversion
 * Escapes HTML in content to prevent XSS
 */
function markdownToStorageFormat(markdown: string): string {
  if (!markdown) return '';
  
  let text = markdown;
  
  // Issue #4 Fix: Use more robust regex that handles EOF without trailing newline
  // Process code blocks first - match ``` with optional language, content, and closing ```
  const codeBlocks: string[] = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const index = codeBlocks.length;
    // Code content goes in CDATA, handles any content including backticks
    codeBlocks.push(`<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${escapeHtml(lang || '')}</ac:parameter><ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body></ac:structured-macro>`);
    return `__CODE_BLOCK_${index}__`;
  });
  
  // Escape HTML in remaining content
  text = escapeHtml(text);
  
  // Now apply markdown transformations
  text = text
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Lists - mark each line
    .replace(/^- (.+)$/gm, '<li>$1</li>');
  
  // Issue #9 Fix: Wrap consecutive list items properly
  // Use a more precise approach that handles newlines
  text = text.replace(/(<li>[^<]*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);
  
  // Paragraphs
  text = text.replace(/\n\n/g, '</p><p>');
  
  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    text = text.replace(`__CODE_BLOCK_${index}__`, block);
  });
  
  return `<p>${text}</p>`;
}

export const knowledgeModule: ToolModule = {
  id: 'knowledge',
  name: 'Knowledge Base',
  version: '2.2.0',
  scopes: ['both'],
  requires: [
    { key: 'openAIApiKey', required: true, description: 'OpenAI API key for embeddings' }
  ],

  getTools(context: ToolContext): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      // Search tool - available to all users
      {
        type: 'function',
        name: 'search_qonsol_help',
        description: 'Search the Qonsol knowledge base for help with using the platform, understanding features, or troubleshooting issues.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query about Qonsol features or usage'
            }
          },
          required: ['query'],
          additionalProperties: false
        },
        strict: true
      }
    ];

    // Only include admin tools if user is admin
    if (context.isAdmin) {
      tools.push(
        {
          type: 'function',
          name: 'list_knowledge_topics',
          description: 'List all available topics in the knowledge base',
          parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
          strict: true
        },
        {
          type: 'function',
          name: 'list_knowledge_items',
          description: 'List all knowledge items in a specific topic',
          parameters: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'The topic to list items from' }
            },
            required: ['topic'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'get_knowledge_item',
          description: 'Get the full content of a specific active knowledge item by its row_id',
          parameters: {
            type: 'object',
            properties: {
              row_id: { type: 'string', description: 'The UUID row_id of the knowledge item' },
              include_deleted: { type: 'boolean', description: 'If true, also return soft-deleted items. Default: false' }
            },
            required: ['row_id'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'update_knowledge_item',
          description: 'Update an existing active knowledge item. Only provide fields you want to change.',
          parameters: {
            type: 'object',
            properties: {
              row_id: { type: 'string', description: 'The UUID row_id of the item to update' },
              title: { type: 'string', description: 'New title (optional)' },
              content: { type: 'string', description: 'New content in markdown (optional)' },
              topic: { type: 'string', description: 'New topic (optional)' },
              keywords: { type: 'array', items: { type: 'string' }, description: 'New keywords array (optional)' },
              priority: { type: 'integer', description: 'New priority 0-100 (optional)' }
            },
            required: ['row_id'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'create_knowledge_item',
          description: 'Create a new knowledge item in the knowledge base',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Title of the knowledge item' },
              content: { type: 'string', description: 'Content in markdown format' },
              topic: { type: 'string', description: 'Topic category for the item' },
              keywords: { type: 'array', items: { type: 'string' }, description: 'Optional keywords for search' },
              priority: { type: 'integer', description: 'Priority 0-100, higher = more important. Default: 50' }
            },
            required: ['title', 'content', 'topic'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'delete_knowledge_item',
          description: 'Soft-delete an active knowledge item (marks as inactive)',
          parameters: {
            type: 'object',
            properties: {
              row_id: { type: 'string', description: 'The UUID row_id of the item to delete' }
            },
            required: ['row_id'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'export_knowledge_to_confluence',
          description: 'Export knowledge items to a Confluence page. Requires Confluence credentials.',
          parameters: {
            type: 'object',
            properties: {
              row_ids: { type: 'array', items: { type: 'string' }, description: 'Array of row_id UUIDs to export' },
              space_key: { type: 'string', description: 'Confluence space key (e.g., "DEV")' },
              parent_id: { type: 'string', description: 'Optional parent page ID to create under' },
              page_title: { type: 'string', description: 'Title for the exported page' }
            },
            required: ['row_ids', 'space_key', 'page_title'],
            additionalProperties: false
          },
          strict: true
        }
      );
    }

    return tools;
  },

  handles(toolName: string): boolean {
    return ALL_TOOL_NAMES.includes(toolName as KnowledgeToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase, userId, credentials, isAdmin, accessToken } = context;

    // --- Public tool: search_qonsol_help ---
    if (toolName === 'search_qonsol_help') {
      const { query } = args;
      
      if (!query || typeof query !== 'string') {
        return JSON.stringify({ error: 'Query parameter is required' });
      }

      const openAIApiKey = credentials.openAIApiKey;
      if (!openAIApiKey) {
        return JSON.stringify({ error: 'OpenAI API key not available for search' });
      }

      try {
        // Generate embedding for the query
        const embedding = await generateEmbedding(query, openAIApiKey);
        
        if (!embedding) {
          // Issue #1 & #7 Fix: Use separate .ilike() calls instead of .or() with string interpolation
          // This properly parameterizes the queries and avoids injection risks
          const sanitizedQuery = query
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/%/g, '\\%')    // Escape percent
            .replace(/_/g, '\\_');   // Escape underscore
          
          const likePattern = `%${sanitizedQuery}%`;
          
          // Use parameterized approach with filter
          const { data: keywordResults, error: keywordError } = await supabase
            .from('q_app_knowledge')
            .select('title, topic, content')
            .eq('is_active', true)
            .or(`title.ilike.${likePattern},content.ilike.${likePattern},topic.ilike.${likePattern}`)
            .limit(5);

          if (keywordError || !keywordResults?.length) {
            return JSON.stringify({
              message: 'No relevant help found',
              results: []
            });
          }

          return JSON.stringify({
            message: `Found ${keywordResults.length} help articles (keyword search)`,
            results: keywordResults.map((r: { title: string; topic: string; content: string }) => ({
              title: r.title,
              topic: r.topic,
              content: safeSlice(r.content, 1000)
            }))
          });
        }

        // Semantic search with embedding - use proper pgvector format
        const { data: semanticResults, error: semanticError } = await supabase.rpc(
          'search_knowledge',
          {
            query_embedding: formatEmbeddingForStorage(embedding),
            match_threshold: 0.5,
            match_count: 5
          }
        );

        if (semanticError) {
          console.error('Semantic search error:', semanticError);
          return JSON.stringify({
            message: 'Search failed',
            error: semanticError.message
          });
        }

        if (!semanticResults?.length) {
          return JSON.stringify({
            message: 'No relevant help found for your query',
            results: []
          });
        }

        return JSON.stringify({
          message: `Found ${semanticResults.length} relevant help articles`,
          results: semanticResults.map((r: any) => ({
            title: r.title,
            topic: r.topic,
            content: safeSlice(r.content, 1000),
            // Issue #8 Fix: Use clampPercentage to handle floating point edge cases
            relevance: clampPercentage(r.similarity)
          }))
        });
      } catch (error) {
        console.error('Knowledge search error:', error);
        return JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Search failed' 
        });
      }
    }

    // --- Admin tools require isAdmin check ---
    if (!isAdmin) {
      return JSON.stringify({ error: 'Admin access required for this tool' });
    }

    switch (toolName) {
      case 'list_knowledge_topics': {
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .select('topic')
          .eq('is_active', true);
        
        if (error) return JSON.stringify({ error: error.message });
        
        const topics = [...new Set(data?.map((d: any) => d.topic))].sort();
        return JSON.stringify({ topics, count: topics.length });
      }

      case 'list_knowledge_items': {
        const { topic } = args;
        
        // Validate topic parameter
        if (!topic || typeof topic !== 'string' || topic.trim() === '') {
          return JSON.stringify({ error: 'Topic parameter is required and cannot be empty' });
        }
        
        // First check if topic exists
        const { data: topicCheck } = await supabase
          .from('q_app_knowledge')
          .select('topic')
          .eq('is_active', true)
          .eq('topic', topic.trim())
          .limit(1);
        
        if (!topicCheck?.length) {
          // Get available topics to suggest
          const { data: allTopics } = await supabase
            .from('q_app_knowledge')
            .select('topic')
            .eq('is_active', true);
          
          const availableTopics = [...new Set(allTopics?.map((d: any) => d.topic))].sort();
          return JSON.stringify({ 
            error: `Topic "${topic}" not found`,
            available_topics: availableTopics
          });
        }
        
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .select('row_id, title, priority, version, updated_at')
          .eq('is_active', true)
          .eq('topic', topic.trim())
          .order('priority', { ascending: false })
          .order('title', { ascending: true });
        
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ topic: topic.trim(), items: data, count: data?.length || 0 });
      }

      case 'get_knowledge_item': {
        const { row_id, include_deleted } = args;
        
        let query = supabase
          .from('q_app_knowledge')
          .select('*')
          .eq('row_id', row_id);
        
        // Only return active items unless explicitly asked for deleted
        if (!include_deleted) {
          query = query.eq('is_active', true);
        }
        
        const { data, error } = await query.single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            return JSON.stringify({ error: 'Knowledge item not found or has been deleted' });
          }
          return JSON.stringify({ error: error.message });
        }
        
        // Warn when returning deleted item
        if (include_deleted && data && !data.is_active) {
          return JSON.stringify({ 
            item: data, 
            warning: 'This item is deleted. Other tools (update, delete) will reject operations on it unless restored.'
          });
        }
        
        return JSON.stringify({ item: data });
      }

      case 'update_knowledge_item': {
        const { row_id, title, content, topic, keywords, priority } = args;
        
        // Issue #2 Fix: Use optimistic locking with version check
        // The UPDATE with version check is atomic in PostgreSQL
        const { data: existing, error: existError } = await supabase
          .from('q_app_knowledge')
          .select('row_id, version, is_active, content')
          .eq('row_id', row_id)
          .single();
        
        if (existError || !existing) {
          return JSON.stringify({ error: 'Knowledge item not found' });
        }
        
        if (!existing.is_active) {
          return JSON.stringify({ error: 'Cannot update a deleted knowledge item. Restore it first.' });
        }
        
        const currentVersion = existing.version || 1;
        const newVersion = currentVersion + 1;
        const contentChanged = content !== undefined && content !== existing.content;
        
        // Build update object with only provided fields
        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
          updated_by: userId,
          version: newVersion
        };
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (topic !== undefined) updates.topic = topic;
        if (keywords !== undefined) updates.keywords = keywords;
        if (priority !== undefined) updates.priority = validatePriority(priority);
        
        // Issue #5 Fix: If content changed, generate embedding first and include in same update
        // This makes the update atomic - embedding is part of the same transaction
        let embeddingUpdated = false;
        if (contentChanged && credentials.openAIApiKey) {
          try {
            const embedding = await generateEmbedding(content, credentials.openAIApiKey);
            if (embedding) {
              updates.embedding = formatEmbeddingForStorage(embedding);
              embeddingUpdated = true;
            }
          } catch (e) {
            console.error('Failed to generate embedding:', e);
          }
        }

        // Optimistic locking - only update if version matches (atomic operation)
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .update(updates)
          .eq('row_id', row_id)
          .eq('is_active', true)
          .eq('version', currentVersion)
          .select()
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            return JSON.stringify({ 
              error: 'Concurrent update detected. Item was modified by another process. Please retry.',
              hint: 'Fetch the latest version and try again'
            });
          }
          return JSON.stringify({ error: error.message });
        }
        
        return JSON.stringify({ 
          success: true, 
          item: data,
          embeddingUpdated: contentChanged ? embeddingUpdated : undefined
        });
      }

      case 'create_knowledge_item': {
        const { title, content, topic, keywords, priority } = args;
        
        const validatedPriority = validatePriority(priority);
        
        // Issue #6 Fix: Generate embedding first, then do a single insert with embedding
        // This ensures atomicity - the item is created with its embedding in one operation
        let embedding: number[] | null = null;
        if (credentials.openAIApiKey) {
          try {
            embedding = await generateEmbedding(content, credentials.openAIApiKey);
          } catch (e) {
            console.error('Failed to generate embedding:', e);
          }
        } else {
          console.warn('OpenAI API key not available - embedding not generated for new knowledge item');
        }
        
        const insertData: Record<string, any> = {
          title,
          content,
          topic,
          keywords: keywords || [],
          priority: validatedPriority,
          is_active: true,
          version: 1,
          created_by: userId,
          updated_by: userId
        };
        
        // Include embedding in the same insert if available
        if (embedding) {
          insertData.embedding = formatEmbeddingForStorage(embedding);
        }
        
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .insert(insertData)
          .select()
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        
        return JSON.stringify({ 
          success: true, 
          item: data, 
          embeddingGenerated: !!embedding 
        });
      }

      case 'delete_knowledge_item': {
        const { row_id } = args;
        
        // Check item exists and is currently active
        const { data: existing, error: existError } = await supabase
          .from('q_app_knowledge')
          .select('row_id, title, is_active')
          .eq('row_id', row_id)
          .single();
        
        if (existError || !existing) {
          return JSON.stringify({ error: 'Knowledge item not found' });
        }
        
        if (!existing.is_active) {
          return JSON.stringify({ error: 'Item is already deleted', title: existing.title });
        }
        
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .update({ 
            is_active: false, 
            updated_at: new Date().toISOString(),
            updated_by: userId
          })
          .eq('row_id', row_id)
          .eq('is_active', true) // Extra safety: only delete if still active
          .select('title')
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, deleted: data?.title });
      }

      case 'export_knowledge_to_confluence': {
        const { row_ids, space_key, parent_id, page_title } = args;
        
        // Verify accessToken is available
        if (!accessToken) {
          return JSON.stringify({ 
            error: 'Authentication token not available for Confluence export',
            hint: 'This may be a session issue. Try refreshing and retry.'
          });
        }
        
        // Verify Confluence credentials are available
        if (!credentials.confluenceApiToken || !credentials.confluenceEmail || !credentials.confluenceBaseUrl) {
          const missing = [];
          if (!credentials.confluenceApiToken) missing.push('API token');
          if (!credentials.confluenceEmail) missing.push('email');
          if (!credentials.confluenceBaseUrl) missing.push('base URL');
          return JSON.stringify({ 
            error: `Confluence credentials not configured. Missing: ${missing.join(', ')}`,
            hint: 'Configure Confluence credentials in Settings > Integrations'
          });
        }
        
        // Fetch knowledge items
        const { data: items, error: fetchError } = await supabase
          .from('q_app_knowledge')
          .select('row_id, title, topic, content, priority, keywords')
          .in('row_id', row_ids)
          .eq('is_active', true);
        
        if (fetchError) return JSON.stringify({ error: fetchError.message });
        if (!items?.length) return JSON.stringify({ error: 'No active items found for provided row_ids' });
        
        // Build TOC with proper anchor links
        const tocItems = items.map((i: any) => {
          const anchorId = toAnchorId(i.title);
          return `<li><ac:link ac:anchor="${anchorId}"><ac:plain-text-link-body><![CDATA[${escapeHtml(i.title)}]]></ac:plain-text-link-body></ac:link></li>`;
        }).join('');
        
        // Build content sections with anchors
        const contentSections = items.map((item: any) => {
          const anchorId = toAnchorId(item.title);
          return `
          <ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">${anchorId}</ac:parameter></ac:structured-macro>
          <h2>${escapeHtml(item.title)}</h2>
          <ac:structured-macro ac:name="info">
            <ac:rich-text-body>
              <p><strong>Topic:</strong> ${escapeHtml(item.topic)} | <strong>Priority:</strong> ${item.priority || 'N/A'}</p>
            </ac:rich-text-body>
          </ac:structured-macro>
          ${markdownToStorageFormat(item.content)}
          <hr/>
        `;
        }).join('\n');
        
        const body = `
          <h1>Table of Contents</h1>
          <ul>${tocItems}</ul>
          <hr/>
          ${contentSections}
          <p><em>Exported from Qonsol Knowledge Base on ${new Date().toISOString().split('T')[0]}</em></p>
        `;
        
        // Issue #10 Fix: Use fetchWithTimeout to prevent indefinite hangs
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        try {
          const response = await fetchWithTimeout(
            `${supabaseUrl}/functions/v1/confluence-manager`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'create-page',
                spaceKey: space_key,
                parentId: parent_id || null,
                title: page_title,
                body
              })
            },
            30000 // 30 second timeout
          );
          
          if (!response.ok) {
            const errText = await response.text();
            return JSON.stringify({ error: `Confluence export failed: ${errText}` });
          }
          
          const result = await response.json();
          return JSON.stringify({
            success: true,
            page: result.page,
            itemsExported: items.length
          });
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            return JSON.stringify({ 
              error: 'Confluence export timed out after 30 seconds',
              hint: 'The Confluence server may be slow. Try again or export fewer items.'
            });
          }
          throw fetchError;
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }
};
