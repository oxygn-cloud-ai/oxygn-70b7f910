import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const isAllowedDomain = (email) => {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
};

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
      return;
    }
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROFILES_TBL || 'profiles')
        .select('display_name, avatar_url, email')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        
        // Check domain restriction
        if (currentUser && !isAllowedDomain(currentUser.email)) {
          // Defer sign out to avoid deadlock
          setTimeout(async () => {
            await supabase.auth.signOut();
            toast.error('Access denied. Only chocfin.com and oxygn.cloud accounts are allowed.');
          }, 0);
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setUserProfile(null);
        } else {
          setUser(currentUser);
          // Defer admin check and profile fetch to avoid Supabase client deadlock
          if (currentUser) {
            setTimeout(() => {
              checkAdminStatus(currentUser.id);
              fetchUserProfile(currentUser.id);
            }, 0);
          } else {
            setIsAdmin(false);
            setUserProfile(null);
          }
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      
      if (currentUser && !isAllowedDomain(currentUser.email)) {
        supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setUserProfile(null);
      } else {
        setUser(currentUser);
        if (currentUser) {
          checkAdminStatus(currentUser.id);
          fetchUserProfile(currentUser.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          hd: 'chocfin.com' // Hint for Google to show org accounts first
        }
      }
    });
    
    if (error) {
      toast.error(error.message);
      return { error };
    }
    
    return { error: null };
  };

  const signOut = async () => {
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
