import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  try {
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const OWNER = Deno.env.get('GITHUB_OWNER');
    const REPO = Deno.env.get('GITHUB_REPO');
    
    if (!githubToken) {
      console.error('GITHUB_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OWNER || !REPO) {
      console.error('GITHUB_OWNER or GITHUB_REPO not configured');
      return new Response(
        JSON.stringify({ error: 'Repository configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching latest release for ${OWNER}/${REPO}`);

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Qonsol-App',
        },
      }
    );

    if (!response.ok) {
      // Handle "no releases" case (404)
      if (response.status === 404) {
        console.log('No releases found for repository');
        return new Response(
          JSON.stringify({ 
            error: 'No releases found',
            tag_name: null,
            name: null,
            published_at: null,
            html_url: null
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorText = await response.text();
      console.error(`GitHub API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const release = await response.json();
    
    console.log(`Found release: ${release.tag_name} (${release.name})`);

    return new Response(
      JSON.stringify({
        tag_name: release.tag_name,
        name: release.name,
        published_at: release.published_at,
        html_url: release.html_url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    console.error('Error fetching GitHub release:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
