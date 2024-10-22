import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "./supabase.js";
import { useQueryClient } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Session } from "@supabase/supabase-js";

const SupabaseAuthContext = createContext<
  | { session: Session | null; loading: boolean; logout: () => Promise<void> }
  | undefined
>(undefined);

export const SupabaseAuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <SupabaseAuthProviderInner>{children}</SupabaseAuthProviderInner>;
};

export const SupabaseAuthProviderInner = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    );

    getSession();

    return () => {
      authListener.subscription.unsubscribe();
      setLoading(false);
    };
  }, [queryClient]);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    queryClient.invalidateQueries({ queryKey: ["user"] });
    setLoading(false);
  };

  return (
    <SupabaseAuthContext.Provider value={{ session, loading, logout }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  return useContext(SupabaseAuthContext);
};

export const SupabaseAuthUI = () => (
  <Auth
    supabaseClient={supabase}
    appearance={{ theme: ThemeSupa }}
    theme="default"
    providers={[]}
  />
);
