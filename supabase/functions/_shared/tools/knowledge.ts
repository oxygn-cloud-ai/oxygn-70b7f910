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
 * Generate embedding for a query using OpenAI
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000)
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
 * Escape HTML for Confluence storage format
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Basic markdown to Confluence storage format conversion
 */
function markdownToStorageFormat(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>');
  
  // Wrap consecutive list items
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  return `<p>${html}</p>`;
}

export const knowledgeModule: ToolModule = {
  id: 'knowledge',
  name: 'Knowledge Base',
  version: '2.0.0',
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
          description: 'Get the full content of a specific knowledge item by its row_id',
          parameters: {
            type: 'object',
            properties: {
              row_id: { type: 'string', description: 'The UUID row_id of the knowledge item' }
            },
            required: ['row_id'],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: 'function',
          name: 'update_knowledge_item',
          description: 'Update an existing knowledge item. Only provide fields you want to change.',
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
          description: 'Soft-delete a knowledge item (marks as inactive)',
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
          description: 'Export knowledge items to a Confluence page',
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
          // Fallback to keyword search with proper sanitization
          // Escape LIKE wildcards to prevent injection
          const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
          const likePattern = `%${sanitizedQuery}%`;
          
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
              content: r.content?.slice(0, 1000)
            }))
          });
        }

        // Semantic search with embedding
        const { data: semanticResults, error: semanticError } = await supabase.rpc(
          'search_knowledge',
          {
            query_embedding: JSON.stringify(embedding),
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
            content: r.content?.slice(0, 1000),
            relevance: Math.round(r.similarity * 100)
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
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .select('row_id, title, priority, version, updated_at')
          .eq('is_active', true)
          .eq('topic', topic)
          .order('priority', { ascending: false })
          .order('title', { ascending: true });
        
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ items: data, count: data?.length || 0 });
      }

      case 'get_knowledge_item': {
        const { row_id } = args;
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .select('*')
          .eq('row_id', row_id)
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ item: data });
      }

      case 'update_knowledge_item': {
        const { row_id, title, content, topic, keywords, priority } = args;
        
        // Build update object with only provided fields
        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
          updated_by: userId
        };
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (topic !== undefined) updates.topic = topic;
        if (keywords !== undefined) updates.keywords = keywords;
        if (priority !== undefined) updates.priority = priority;
        
        // Increment version
        const { data: current } = await supabase
          .from('q_app_knowledge')
          .select('version')
          .eq('row_id', row_id)
          .single();
        
        updates.version = (current?.version || 1) + 1;

        const { data, error } = await supabase
          .from('q_app_knowledge')
          .update(updates)
          .eq('row_id', row_id)
          .select()
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        
        // Regenerate embedding if content changed
        if (content !== undefined && credentials.openAIApiKey) {
          try {
            const embedding = await generateEmbedding(content, credentials.openAIApiKey);
            if (embedding) {
              await supabase
                .from('q_app_knowledge')
                .update({ embedding: JSON.stringify(embedding) })
                .eq('row_id', row_id);
            }
          } catch (e) {
            console.error('Failed to regenerate embedding:', e);
            // Non-fatal - item was still updated
          }
        }
        
        return JSON.stringify({ success: true, item: data });
      }

      case 'create_knowledge_item': {
        const { title, content, topic, keywords, priority } = args;
        
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .insert({
            title,
            content,
            topic,
            keywords: keywords || [],
            priority: priority ?? 50,
            is_active: true,
            version: 1,
            created_by: userId,
            updated_by: userId
          })
          .select()
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        
        // Generate embedding
        if (credentials.openAIApiKey) {
          try {
            const embedding = await generateEmbedding(content, credentials.openAIApiKey);
            if (embedding) {
              await supabase
                .from('q_app_knowledge')
                .update({ embedding: JSON.stringify(embedding) })
                .eq('row_id', data.row_id);
            }
          } catch (e) {
            console.error('Failed to generate embedding:', e);
          }
        }
        
        return JSON.stringify({ success: true, item: data });
      }

      case 'delete_knowledge_item': {
        const { row_id } = args;
        
        const { data, error } = await supabase
          .from('q_app_knowledge')
          .update({ 
            is_active: false, 
            updated_at: new Date().toISOString(),
            updated_by: userId
          })
          .eq('row_id', row_id)
          .select('title')
          .single();
        
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, deleted: data?.title });
      }

      case 'export_knowledge_to_confluence': {
        const { row_ids, space_key, parent_id, page_title } = args;
        
        // Fetch knowledge items
        const { data: items, error: fetchError } = await supabase
          .from('q_app_knowledge')
          .select('row_id, title, topic, content, priority, keywords')
          .in('row_id', row_ids)
          .eq('is_active', true);
        
        if (fetchError) return JSON.stringify({ error: fetchError.message });
        if (!items?.length) return JSON.stringify({ error: 'No active items found for provided row_ids' });
        
        // Build Confluence storage format HTML
        const tocItems = items.map((i: any) => 
          `<li><ac:link><ri:page ri:content-title="${escapeHtml(i.title)}" /></ac:link></li>`
        ).join('');
        
        const contentSections = items.map((item: any) => `
          <h2>${escapeHtml(item.title)}</h2>
          <ac:structured-macro ac:name="info">
            <ac:rich-text-body>
              <p><strong>Topic:</strong> ${escapeHtml(item.topic)} | <strong>Priority:</strong> ${item.priority || 'N/A'}</p>
            </ac:rich-text-body>
          </ac:structured-macro>
          ${markdownToStorageFormat(item.content)}
          <hr/>
        `).join('\n');
        
        const body = `
          <h1>Table of Contents</h1>
          <ul>${tocItems}</ul>
          <hr/>
          ${contentSections}
          <p><em>Exported from Qonsol Knowledge Base on ${new Date().toISOString().split('T')[0]}</em></p>
        `;
        
        // Call confluence-manager edge function
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const response = await fetch(`${supabaseUrl}/functions/v1/confluence-manager`, {
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
        });
        
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
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }
};
