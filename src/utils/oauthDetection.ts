/**
 * Detects if the current URL contains OAuth callback markers,
 * indicating a redirect flow is in progress and session hydration
 * has not yet completed.
 */
export const isOAuthCallbackInProgress = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;

  // Implicit flow: tokens in hash
  if (
    hash &&
    (hash.includes('access_token') ||
      hash.includes('refresh_token') ||
      hash.includes('id_token'))
  ) {
    return true;
  }

  // Authorization code flow: params in query string
  const params = new URLSearchParams(search);
  if (params.has('code') || params.has('state') || params.has('error')) {
    return true;
  }

  return false;
};
