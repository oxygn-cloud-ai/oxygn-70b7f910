import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  if (!isAllowedDomain(user.email)) {
    return { valid: false, error: 'Access denied' };
  }

  return { valid: true, user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user
    const validation = await validateUser(req);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try the official organization costs endpoint first (requires Admin API key)
    // This endpoint gives recent spend data
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    
    let billingData: any = {
      subscription: null,
      credits: null,
      costs: null,
      error: null,
    };

    // Try subscription endpoint (legacy dashboard API)
    try {
      const subResponse = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (subResponse.ok) {
        billingData.subscription = await subResponse.json();
        console.log('Subscription data retrieved');
      } else {
        console.log('Subscription endpoint returned:', subResponse.status);
      }
    } catch (e) {
      console.log('Subscription endpoint error:', e);
    }

    // Try credit grants endpoint (legacy dashboard API)
    try {
      const creditsResponse = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (creditsResponse.ok) {
        billingData.credits = await creditsResponse.json();
        console.log('Credits data retrieved');
      } else {
        console.log('Credits endpoint returned:', creditsResponse.status);
      }
    } catch (e) {
      console.log('Credits endpoint error:', e);
    }

    // Try the usage endpoint for recent spend (requires usage permissions)
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startTime = Math.floor(startDate.getTime() / 1000);
      
      const usageResponse = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${startTime}`, 
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (usageResponse.ok) {
        billingData.costs = await usageResponse.json();
        console.log('Costs data retrieved');
      } else {
        const errorText = await usageResponse.text();
        console.log('Costs endpoint returned:', usageResponse.status, errorText);
      }
    } catch (e) {
      console.log('Costs endpoint error:', e);
    }

    // If no data could be retrieved, return a helpful message
    if (!billingData.subscription && !billingData.credits && !billingData.costs) {
      billingData.error = 'Unable to retrieve billing data. The API key may not have billing permissions. Check your OpenAI dashboard at platform.openai.com/usage';
    }

    return new Response(
      JSON.stringify(billingData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Billing check error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
