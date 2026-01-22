import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { identifyUser, resetUser, trackEvent } from '@/lib/posthog';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface AuthError {
  message: string;
}

export interface AuthResult {
  error: AuthError | null;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  userProfile: null,
  signInWithGoogle: async () => ({ error: null }),
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  isAuthenticated: false,
});

export const useAuth = (): AuthContextValue => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const mountedRef = useRef(true);
  const initialSessionHandledRef = useRef(false);

  const checkAdminStatus = async (userId: string): Promise<void> => {
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

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
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
        setUserProfile(data as UserProfile);
        return data as UserProfile;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUserProfile(null);
      return null;
    }
  };

  const setupAuthenticatedUser = async (
    currentUser: User, 
    shouldTrackLogin = false, 
    provider = 'unknown'
  ): Promise<void> => {
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
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return;
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        
        setUser(currentUser);
        
        if (currentUser) {
          // SIGNED_IN fires both on actual login AND initial session restoration
          // We only want to track actual logins (after initial session has been handled)
          const isActualLogin = event === 'SIGNED_IN' && initialSessionHandledRef.current;
          const provider = newSession?.user?.app_metadata?.provider || 'unknown';
          
          // Defer to avoid Supabase client deadlock
          setTimeout(() => {
            setupAuthenticatedUser(currentUser, isActualLogin, provider);
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
          // This is initial session restoration - not an actual login
          await setupAuthenticatedUser(currentUser, false);
        }
        // Mark initial session as handled so subsequent SIGNED_IN events are real logins
        initialSessionHandledRef.current = true;
        if (mountedRef.current) setLoading(false);
      })
      .catch(err => {
        console.error('Failed to get initial session:', err);
        initialSessionHandledRef.current = true; // Still mark as handled on error
        if (mountedRef.current) setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // Whitelisted emails for password login (preview testing)
  // Read from env variable - no hardcoded fallback for security
  const WHITELISTED_EMAILS: string[] = (import.meta.env.VITE_WHITELISTED_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const signInWithGoogle = async (): Promise<AuthResult> => {
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

  const signInWithPassword = async (email: string, password: string): Promise<AuthResult> => {
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

  const signUpWithPassword = async (email: string, password: string): Promise<AuthResult> => {
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

  const signOut = async (): Promise<AuthResult> => {
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
    return { error: error || null };
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    userProfile,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
