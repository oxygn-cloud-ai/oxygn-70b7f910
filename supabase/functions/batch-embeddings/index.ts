import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; status?: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header', status: 401 };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return { valid: false, error: 'Server configuration error', status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token', status: 401 };
  }

  if (!isAllowedDomain(user.email)) {
    return { valid: false, error: 'Access denied: domain not allowed', status: 403 };
  }

  // Check if user is admin (this is an admin-only utility function)
  const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
  
  if (!isAdmin) {
    return { valid: false, error: 'Access denied: admin privileges required', status: 403 };
  }

  return { valid: true };
}

async function generateEmbedding(text: string, openAIApiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate user authentication, domain, and admin status
  const validation = await validateUser(req);
  if (!validation.valid) {
    console.log(`Access denied: ${validation.error}`);
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: validation.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch items without embeddings
    const { data: items, error: fetchError } = await supabase
      .from('q_app_knowledge')
      .select('row_id, title, content, keywords')
      .eq('is_active', true)
      .is('embedding', null);

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No items need embeddings', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${items.length} items for embedding generation`);

    const results: { row_id: string; title: string; success: boolean; error?: string }[] = [];

    for (const item of items) {
      try {
        // Concatenate title, content, and keywords for embedding
        const textParts = [item.title, item.content];
        if (item.keywords && item.keywords.length > 0) {
          textParts.push(item.keywords.join(' '));
        }
        const text = textParts.join('\n\n');

        console.log(`Generating embedding for: ${item.title}`);

        const embedding = await generateEmbedding(text, openAIApiKey);

        // Update the item with the embedding
        const { error: updateError } = await supabase
          .from('q_app_knowledge')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('row_id', item.row_id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        results.push({ row_id: item.row_id, title: item.title, success: true });
        console.log(`Successfully embedded: ${item.title}`);

        // Rate limit protection - 200ms delay between requests
        await delay(200);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process ${item.title}: ${errorMessage}`);
        results.push({ row_id: item.row_id, title: item.title, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${items.length} items`,
        processed: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Batch embeddings error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
