import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { identifyUser, resetUser, trackEvent } from '@/lib/posthog';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

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
        .single();
      
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        
        setUser(currentUser);
        // Defer admin check and profile fetch to avoid Supabase client deadlock
        if (currentUser) {
          setTimeout(() => {
            checkAdminStatus(currentUser.id);
            fetchUserProfile(currentUser.id).then((profile) => {
              // Identify user in PostHog after profile is fetched
              identifyUser(currentUser, profile, isAdmin);
              // Track successful login
              trackEvent('user_login_success', {
                email: currentUser.email,
                provider: session?.user?.app_metadata?.provider || 'unknown',
              });
            });
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      
      setUser(currentUser);
      if (currentUser) {
        checkAdminStatus(currentUser.id);
        fetchUserProfile(currentUser.id).then((profile) => {
          // Identify user in PostHog
          identifyUser(currentUser, profile, isAdmin);
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/projects`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    
    if (error) {
      toast.error(error.message);
      return { error };
    }
    
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

  const value = {
    user,
    session,
    loading,
    isAdmin,
    userProfile,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
