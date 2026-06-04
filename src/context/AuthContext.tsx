import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRole = async (u: User | null) => {
    if (!u) { setIsAdmin(false); return; }
    try {
      const { data } = await supabase.from('profiles').select('rol').eq('id', u.id).single();
      setIsAdmin(String(data?.rol ?? '').toLowerCase() === 'admin');
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUser(u);
        await loadRole(u);
      } catch (e) {
        // Un fallo aquí (token inválido, red) no debe dejar la app colgada en
        // `loading` (que pinta la pantalla en blanco vía RequireAuth).
        console.error('[Auth] init error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // IMPORTANTE: NO hacer `await` de llamadas a Supabase dentro de este
      // callback. supabase-js mantiene un lock mientras corre el callback, y una
      // consulta (como loadRole -> supabase.from) esperaría ese mismo lock,
      // provocando un deadlock que cuelga la app (pantalla en blanco) al
      // refrescarse el token. Actualizamos el user de forma síncrona y diferimos
      // la consulta de rol fuera del callback con setTimeout(0).
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      setTimeout(() => { loadRole(u); }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export default AuthContext;
