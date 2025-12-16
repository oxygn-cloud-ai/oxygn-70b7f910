import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...body } = await req.json();
    console.log('OpenAI proxy request:', { action, hasBody: !!body });

    // Health check / connection test
    if (action === 'health') {
      console.log('Running health check...');
      const start = Date.now();
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
      });

      const latency = Date.now() - start;
      console.log('Health check response:', response.status, 'latency:', latency);

      if (response.ok) {
        return new Response(
          JSON.stringify({ status: 'success', message: `Connected (${latency}ms)`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorData = await response.json().catch(() => ({}));
      console.error('Health check failed:', errorData);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429) {
        const message = errorData.error?.code === 'insufficient_quota' 
          ? 'Quota exceeded - check billing' 
          : 'Rate limited - try again later';
        return new Response(
          JSON.stringify({ status: 'warning', message, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status >= 500) {
        return new Response(
          JSON.stringify({ status: 'warning', message: `OpenAI server error (${response.status})`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'error', message: errorData.error?.message || 'Unknown error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List models
    if (action === 'models') {
      console.log('Fetching models...');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch models:', response.status);
        return new Response(
          JSON.stringify({ status: 'error', message: 'Could not fetch models', available: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const chatModels = data.data
        .filter((m: any) => m.id.includes('gpt'))
        .map((m: any) => m.id)
        .sort();

      console.log('Found models:', chatModels.length);
      return new Response(
        JSON.stringify({ status: 'success', message: `${chatModels.length} GPT models available`, available: chatModels }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chat completions (main API call)
    if (action === 'chat') {
      console.log('Processing chat request...');
      const { model, messages, web_search_enabled, ...settings } = body;

      const modelId = model || 'gpt-4o-mini';
      
      // Models that don't support temperature parameter
      const noTemperatureModels = ['o1', 'o3', 'o4', 'gpt-5'];
      const isNoTempModel = noTemperatureModels.some(m => modelId.toLowerCase().includes(m));
      
      // Models that use max_completion_tokens instead of max_tokens
      const useMaxCompletionTokens = ['gpt-5', 'gpt-4.1', 'o3', 'o4'].some(m => modelId.toLowerCase().includes(m));

      const requestBody: any = {
        model: modelId,
        messages,
      };

      // Add web search tool if enabled
      if (web_search_enabled) {
        console.log('Web search enabled for this request');
        requestBody.tools = [
          {
            type: "web_search_preview",
            search_context_size: "medium"
          }
        ];
      }

      // Add optional parameters based on model capabilities
      if (!isNoTempModel && settings.temperature !== undefined) {
        requestBody.temperature = settings.temperature;
      }
      
      if (settings.max_tokens !== undefined) {
        if (useMaxCompletionTokens) {
          requestBody.max_completion_tokens = settings.max_tokens;
        } else {
          requestBody.max_tokens = settings.max_tokens;
        }
      }
      
      if (!isNoTempModel && settings.top_p !== undefined) {
        requestBody.top_p = settings.top_p;
      }
      if (settings.frequency_penalty !== undefined) requestBody.frequency_penalty = settings.frequency_penalty;
      if (settings.presence_penalty !== undefined) requestBody.presence_penalty = settings.presence_penalty;

      console.log('OpenAI request:', { 
        model: requestBody.model, 
        messageCount: messages?.length, 
        isNoTempModel,
        webSearchEnabled: !!web_search_enabled 
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('OpenAI API error:', responseData);
        return new Response(
          JSON.stringify({ error: responseData.error?.message || 'OpenAI API error' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('OpenAI response received, tokens:', responseData.usage);
      
      // Extract citations if web search was used
      let citations = [];
      if (web_search_enabled && responseData.choices?.[0]?.message?.annotations) {
        citations = responseData.choices[0].message.annotations
          .filter((a: any) => a.type === 'url_citation')
          .map((a: any) => ({
            url: a.url_citation?.url,
            title: a.url_citation?.title,
            text: a.text
          }));
        console.log('Web search citations found:', citations.length);
      }

      return new Response(
        JSON.stringify({ ...responseData, citations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: health, models, or chat' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
