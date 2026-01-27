/**
 * Shared CORS Configuration for Supabase Edge Functions
 * 
 * This module provides secure CORS headers with origin whitelisting.
 * All edge functions should use this instead of wildcard '*' origins.
 * 
 * Usage:
 * ```typescript
 * import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
 * 
 * serve(async (req) => {
 *   const origin = req.headers.get('Origin');
 *   const corsHeaders = getCorsHeaders(origin);
 *   
 *   if (req.method === 'OPTIONS') {
 *     return handleCorsOptions(corsHeaders);
 *   }
 *   
 *   // ... your handler code
 *   return new Response(JSON.stringify(data), {
 *     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
 *   });
 * });
 * ```
 */

/**
 * Whitelisted origins that are allowed to make cross-origin requests.
 * Add production domains and development URLs as needed.
 */
const ALLOWED_ORIGINS: readonly string[] = [
  // Production
  'https://qonsol.app',
  'https://www.qonsol.app',
  
  // Lovable preview/deploy URLs
  'https://id-preview--5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovable.app',
  'https://5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovableproject.com',
  
  // Development
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

/**
 * Default fallback origin when request origin is not in whitelist.
 * Using first production origin as fallback.
 */
const DEFAULT_ORIGIN = ALLOWED_ORIGINS[0];

/**
 * Check if an origin is in the allowed list.
 * Supports exact match and subdomain matching for lovable.app domains.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Allow any lovable.app subdomain (for preview deployments)
  if (origin.endsWith('.lovable.app')) return true;
  
  return false;
}

/**
 * Get CORS headers with proper origin handling.
 * 
 * @param requestOrigin - The Origin header from the incoming request
 * @returns CORS headers object to include in the response
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  // If the request origin is allowed, echo it back (proper CORS)
  // Otherwise, use the default origin (which will cause the browser to block the request)
  const allowedOrigin = isAllowedOrigin(requestOrigin) 
    ? requestOrigin! 
    : DEFAULT_ORIGIN;
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * 
 * @param corsHeaders - CORS headers from getCorsHeaders()
 * @returns Response for OPTIONS request
 */
export function handleCorsOptions(corsHeaders: Record<string, string>): Response {
  return new Response(null, { 
    status: 204, 
    headers: corsHeaders 
  });
}

// Legacy corsHeaders export removed - all functions must use getCorsHeaders(origin)
// See module documentation for migration pattern
