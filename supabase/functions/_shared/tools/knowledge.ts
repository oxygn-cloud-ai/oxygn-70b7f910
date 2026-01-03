/**
 * Knowledge Tool Module
 * Tools for searching Qonsol help/knowledge base
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';

const TOOL_NAMES = ['search_qonsol_help'] as const;

type KnowledgeToolName = typeof TOOL_NAMES[number];

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

export const knowledgeModule: ToolModule = {
  id: 'knowledge',
  name: 'Knowledge Base',
  version: '1.0.0',
  scopes: ['both'],
  requires: [
    { key: 'openAIApiKey', required: true, description: 'OpenAI API key for embeddings' }
  ],

  getTools(context: ToolContext): ToolDefinition[] {
    return [
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
  },

  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName as KnowledgeToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase, credentials } = context;

    if (toolName !== 'search_qonsol_help') {
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

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
        // Fallback to keyword search
        const { data: keywordResults, error: keywordError } = await supabase
          .from('q_app_knowledge')
          .select('title, topic, content')
          .eq('is_active', true)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%,topic.ilike.%${query}%`)
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
};
