import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from '@/components/ui/sonner';
import { identifyUser, resetUser, trackEvent } from '@/lib/posthog';
import { isOAuthCallbackInProgress } from '@/utils/oauthDetection';
import type { User, Session } from '@supabase/supabase-js';

/**
 * User profile data from the profiles table
 */
interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  email: string;
}

/**
 * Auth context value shape
 */
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  userProfile: UserProfile | null;
  // Tenant context
  tenantId: string | null;
  tenantName: string | null;
  tenantRole: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  tenantStatus: string | null;
  isTenantAdmin: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  isAuthenticated: boolean;
}

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // Tenant state
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantRole, setTenantRole] = useState<AuthContextValue['tenantRole']>(null);
  const [tenantStatus, setTenantStatus] = useState<string | null>(null);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const mountedRef = useRef(true);
  const initialSessionHandledRef = useRef(false);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!userId) {
      setUserProfile(null);
      return null;
    }
    try {
      const tableName = (import.meta.env.VITE_PROFILES_TBL || 'profiles') as 'profiles';
      const { data, error } = await supabase
        .from(tableName)
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

  const setupAuthenticatedUser = async (currentUser: User, shouldTrackLogin = false, provider = 'unknown') => {
    if (!mountedRef.current) return;
    
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
    
    identifyUser(currentUser, profile, adminStatus);
    
    if (shouldTrackLogin) {
      trackEvent('user_login_success', {
        email: currentUser.email,
        provider,
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return;
        
        console.debug('[Auth] onAuthStateChange:', event);
        
        if (event === 'INITIAL_SESSION') {
          setSession(newSession);
          const currentUser = newSession?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            // Session resolved (either from stored session or hash tokens) — finalize
            initialSessionHandledRef.current = true;
            setLoading(false);
            setTimeout(() => {
              setupAuthenticatedUser(currentUser, false);
            }, 0);
          } else if (!isOAuthCallbackInProgress()) {
            // No callback in progress, genuinely unauthenticated
            initialSessionHandledRef.current = true;
            setLoading(false);
          }
          // else: callback markers in URL but session not ready yet
          // keep loading=true, wait for SIGNED_IN event from hash token processing
          return;
        }
        
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        
        setUser(currentUser);
        
        if (currentUser) {
          const isActualLogin = event === 'SIGNED_IN' && initialSessionHandledRef.current;
          const provider = newSession?.user?.app_metadata?.provider || 'unknown';
          
          // Mark as handled if not already (covers callback case where INITIAL_SESSION had null)
          if (!initialSessionHandledRef.current) {
            initialSessionHandledRef.current = true;
          }
          setLoading(false);
          
          // Defer to avoid Supabase client deadlock
          setTimeout(() => {
            setupAuthenticatedUser(currentUser, isActualLogin, provider);
          }, 0);
        } else {
          setIsAdmin(false);
          setUserProfile(null);
          resetUser();
          initialSessionHandledRef.current = true;
          setLoading(false);
        }
      }
    );

    // Safety timeout: if no auth event resolves within 5 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      if (!mountedRef.current) return;
      if (!initialSessionHandledRef.current) {
        console.warn('[Auth] Safety timeout: no session after 5s');
        initialSessionHandledRef.current = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Whitelisted emails for password login (preview testing)
  const WHITELISTED_EMAILS = (import.meta.env.VITE_WHITELISTED_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
        extraParams: { prompt: 'select_account' }
      });
      
      if (result.error) {
        toast.error(result.error.message);
        return { error: result.error };
      }
      
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
      return { error };
    }
  };

  const signInWithPassword = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const emailDomain = email.toLowerCase().split('@')[1];
    const isAllowedDomain = ['chocfin.com', 'oxygn.cloud'].includes(emailDomain);
    const isWhitelisted = WHITELISTED_EMAILS.includes(email.toLowerCase());
    
    if (!isAllowedDomain && !isWhitelisted) {
      const error = new Error('Email/password login is only available for authorized accounts');
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

  const signUpWithPassword = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const emailDomain = email.toLowerCase().split('@')[1];
    const isAllowedDomain = ['chocfin.com', 'oxygn.cloud'].includes(emailDomain);
    const isWhitelisted = WHITELISTED_EMAILS.includes(email.toLowerCase());
    
    if (!isAllowedDomain && !isWhitelisted) {
      const error = new Error('Email/password signup is only available for authorized accounts');
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

  const signOut = async (): Promise<{ error: Error | null }> => {
    trackEvent('user_logout', {
      email: user?.email,
    });
    resetUser();
    
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed out successfully');
    }
    return { error };
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    isPlatformAdmin: false,
    userProfile,
    tenantId,
    tenantName,
    tenantRole,
    tenantStatus,
    isTenantAdmin,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
