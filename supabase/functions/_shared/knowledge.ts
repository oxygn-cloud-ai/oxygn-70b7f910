// Knowledge base utilities for Qonsol expert knowledge system

/**
 * Load Qonsol knowledge for injection into system prompts
 * Fetches knowledge items by topic and priority, with optional token limit
 */
export async function loadQonsolKnowledge(
  supabase: any,
  topics?: string[],
  maxChars: number = 8000
): Promise<string> {
  try {
    let query = supabase
      .from('q_app_knowledge')
      .select('topic, title, content, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (topics?.length) {
      query = query.in('topic', topics);
    }

    const { data: knowledge, error } = await query.limit(50);

    if (error) {
      console.error('Error loading knowledge:', error);
      return '';
    }

    if (!knowledge?.length) return '';

    let result = '\n\n## Qonsol Knowledge Base\n\n';
    let currentLength = result.length;

    // Group by topic for better organization
    const byTopic: Record<string, any[]> = {};
    for (const item of knowledge) {
      if (!byTopic[item.topic]) byTopic[item.topic] = [];
      byTopic[item.topic].push(item);
    }

    for (const [topic, items] of Object.entries(byTopic)) {
      const topicHeader = `### ${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\n`;
      
      if (currentLength + topicHeader.length > maxChars) break;
      result += topicHeader;
      currentLength += topicHeader.length;

      for (const item of items) {
        const section = `#### ${item.title}\n${item.content}\n\n`;
        if (currentLength + section.length > maxChars) break;
        result += section;
        currentLength += section.length;
      }
    }

    return result;
  } catch (error) {
    console.error('Error in loadQonsolKnowledge:', error);
    return '';
  }
}

/**
 * Semantic search knowledge base using embeddings
 * Requires query to be embedded first
 */
export async function searchKnowledgeByEmbedding(
  supabase: any,
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 5,
  filterTopics?: string[]
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_topics: filterTopics || null
    });

    if (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchKnowledgeByEmbedding:', error);
    return [];
  }
}

/**
 * Keyword-based knowledge search (fallback when no embeddings)
 */
export async function searchKnowledgeByKeywords(
  supabase: any,
  query: string,
  limit: number = 5,
  filterTopics?: string[]
): Promise<any[]> {
  try {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    let queryBuilder = supabase
      .from('q_app_knowledge')
      .select('row_id, topic, title, content')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (filterTopics?.length) {
      queryBuilder = queryBuilder.in('topic', filterTopics);
    }

    const { data, error } = await queryBuilder.limit(50);

    if (error) {
      console.error('Error in keyword search:', error);
      return [];
    }

    // Score and filter results
    const scored = (data || []).map((item: any) => {
      const text = `${item.title} ${item.content}`.toLowerCase();
      const score = searchTerms.reduce((acc, term) => {
        return acc + (text.includes(term) ? 1 : 0);
      }, 0);
      return { ...item, score };
    });

    return scored
      .filter((item: any) => item.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('Error in searchKnowledgeByKeywords:', error);
    return [];
  }
}

/**
 * Generate embedding using OpenAI API
 */
export async function generateEmbedding(
  text: string,
  openAIApiKey: string
): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000) // Limit input size
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Embedding API error:', error);
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
 * Search knowledge with automatic embedding generation
 */
export async function searchKnowledge(
  supabase: any,
  query: string,
  openAIApiKey?: string,
  options: {
    matchThreshold?: number;
    matchCount?: number;
    filterTopics?: string[];
  } = {}
): Promise<any[]> {
  const { matchThreshold = 0.7, matchCount = 5, filterTopics } = options;

  // Try semantic search if we have an API key
  if (openAIApiKey) {
    const embedding = await generateEmbedding(query, openAIApiKey);
    if (embedding) {
      const results = await searchKnowledgeByEmbedding(
        supabase, 
        embedding, 
        matchThreshold, 
        matchCount, 
        filterTopics
      );
      if (results.length > 0) return results;
    }
  }

  // Fall back to keyword search
  return searchKnowledgeByKeywords(supabase, query, matchCount, filterTopics);
}

/**
 * Get the search_qonsol_help tool definition
 * Uses Responses API format (flat structure with name at top level)
 */
export function getQonsolHelpTool() {
  return {
    type: "function",
    function: {
      name: "search_qonsol_help",
      description: "Search the Qonsol knowledge base for help on a specific topic or feature. Use this to find documentation about prompts, templates, variables, cascades, files, confluence integration, and more.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query - a topic name, feature, or question about Qonsol"
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  };
}

/**
 * Handle the search_qonsol_help tool call
 */
export async function handleQonsolHelpToolCall(
  args: { query: string; topics?: string[] },
  supabase: any,
  openAIApiKey?: string
): Promise<string> {
  const results = await searchKnowledge(supabase, args.query, openAIApiKey, {
    matchCount: 5,
    filterTopics: args.topics
  });

  if (results.length === 0) {
    return JSON.stringify({
      message: `No knowledge found for "${args.query}". Try broader terms or different topics.`,
      suggestions: ['prompts', 'templates', 'variables', 'cascade', 'troubleshooting']
    });
  }

  return JSON.stringify({
    message: `Found ${results.length} relevant knowledge items`,
    results: results.map((r: any) => ({
      topic: r.topic,
      title: r.title,
      content: r.content,
      similarity: r.similarity
    }))
  });
}
