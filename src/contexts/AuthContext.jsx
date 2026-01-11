import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { identifyUser, resetUser, trackEvent } from '@/lib/posthog';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// DEVELOPMENT ONLY: Mock user/session/profile for local testing
// These objects are completely removed from production builds by Vite's dead code elimination
const devMockUser = import.meta.env.DEV ? {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@localhost.test',
  user_metadata: { 
    full_name: 'Development User',
    avatar_url: null 
  },
  app_metadata: { provider: 'dev-bypass' },
  created_at: new Date().toISOString(),
} : null;

const devMockSession = import.meta.env.DEV ? {
  user: devMockUser,
  access_token: 'dev-mock-token',
  expires_at: Date.now() + 86400000, // 24 hours
} : null;

const devMockProfile = import.meta.env.DEV ? {
  display_name: 'Development User',
  email: 'dev@localhost.test',
  avatar_url: null,
} : null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const mountedRef = useRef(true);

  const checkAdminStatus = async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('is_admin', { _user_id: userId });
      if (!error) {
        setIsAdmin(!!data);
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
    }
  };

  const fetchUserProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROFILES_TBL || 'profiles')
        .select('display_name, avatar_url, email')
        .eq('id', userId)
        .maybeSingle();
      
      if (!error && data) {
        setUserProfile(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUserProfile(null);
      return null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        setSession(session);
        const currentUser = session?.user ?? null;
        
        setUser(currentUser);
        // Defer admin check and profile fetch to avoid Supabase client deadlock
        if (currentUser) {
          setTimeout(async () => {
            if (!mountedRef.current) return;
            // Check admin status and get result for PostHog identification
            let adminStatus = false;
            try {
              const { data, error } = await supabase.rpc('is_admin', { _user_id: currentUser.id });
              if (!error && mountedRef.current) {
                adminStatus = !!data;
                setIsAdmin(adminStatus);
              }
            } catch (err) {
              console.error('Error checking admin status:', err);
              if (mountedRef.current) setIsAdmin(false);
            }
            
            const profile = await fetchUserProfile(currentUser.id);
            if (!mountedRef.current) return;
            // Identify user in PostHog with fresh admin status (skip in dev mode)
            if (!import.meta.env.DEV) {
              identifyUser(currentUser, profile, adminStatus);
              // Track successful login
              trackEvent('user_login_success', {
                email: currentUser.email,
                provider: session?.user?.app_metadata?.provider || 'unknown',
              });
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setUserProfile(null);
          resetUser();
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!mountedRef.current) return;
        setSession(session);
        const currentUser = session?.user ?? null;
        
        setUser(currentUser);
        if (currentUser) {
          // Check admin status and get result for PostHog identification
          let adminStatus = false;
          try {
            const { data, error } = await supabase.rpc('is_admin', { _user_id: currentUser.id });
            if (!error && mountedRef.current) {
              adminStatus = !!data;
              setIsAdmin(adminStatus);
            }
          } catch (err) {
            console.error('Error checking admin status:', err);
            if (mountedRef.current) setIsAdmin(false);
          }
          
          const profile = await fetchUserProfile(currentUser.id);
          if (!mountedRef.current) return;
          // Identify user in PostHog with fresh admin status
          identifyUser(currentUser, profile, adminStatus);
        }
        if (mountedRef.current) setLoading(false);
      })
      .catch(err => {
        console.error('Failed to get initial session:', err);
        if (mountedRef.current) setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // Whitelisted emails for password login (preview testing)
  // Read from env variable - no hardcoded fallback for security
  const WHITELISTED_EMAILS = (import.meta.env.VITE_WHITELISTED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/projects`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    
    if (error) {
      toast.error(error.message);
      return { error };
    }
    
    return { error: null };
  };

  const signInWithPassword = async (email, password) => {
    // Only allow whitelisted emails
    if (!WHITELISTED_EMAILS.includes(email.toLowerCase())) {
      const error = { message: 'Email/password login is only available for authorized accounts' };
      toast.error(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    return { error: null };
  };

  const signUpWithPassword = async (email, password) => {
    // Only allow whitelisted emails
    if (!WHITELISTED_EMAILS.includes(email.toLowerCase())) {
      const error = { message: 'Email/password signup is only available for authorized accounts' };
      toast.error(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/projects`
      }
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success('Account created successfully');
    return { error: null };
  };

  const signOut = async () => {
    // Track logout before resetting
    trackEvent('user_logout', {
      email: user?.email,
    });
    resetUser();
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed out successfully');
    }
    return { error };
  };

  // DEVELOPMENT ONLY: Use mock values in dev mode
  // This entire block uses values that are removed from production builds
  const isDev = import.meta.env.DEV;

  const value = {
    user: isDev ? devMockUser : user,
    session: isDev ? devMockSession : session,
    loading: isDev ? false : loading,
    isAdmin: isDev ? true : isAdmin,  // Dev user has admin access
    userProfile: isDev ? devMockProfile : userProfile,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut: isDev ? async () => {
      console.warn('[DEV MODE] Sign out is a no-op in development');
      return { error: null };
    } : signOut,
    isAuthenticated: isDev ? true : !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
