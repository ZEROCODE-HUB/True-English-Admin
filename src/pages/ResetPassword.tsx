import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Parse tokens from URL hash or query (Supabase recovery sends them in the hash)
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);
      const access_token = hashParams.get("access_token") || queryParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token") || queryParams.get("refresh_token");

      if (access_token || refresh_token) {
        // Set session so we can call updateUser
        supabase.auth.setSession({ access_token: access_token ?? undefined, refresh_token: refresh_token ?? undefined })
          .then(() => {
            setHasToken(true);
          })
          .catch(() => {
            // If setSession fails, still allow user to try if backend accepted link
            setHasToken(true);
          });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error(updateError);
        setError(updateError.message || "Error al cambiar la contraseña.");
        setLoading(false);
        return;
      }

      // Clear session so user can sign in again
      await supabase.auth.signOut();

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasToken && !success && (
            <div className="text-sm text-muted-foreground mb-4">Se requiere el enlace de restablecimiento. Por favor utiliza el enlace que recibiste por correo.</div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="text-green-600 font-medium">Contraseña actualizada correctamente.</div>
              <div>Vuelve a la app para iniciar sesión.</div>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/login')}>Ir a iniciar sesión</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Nueva contraseña</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Confirmar contraseña</label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              <div className="flex items-center justify-between">
                <Button type="submit" disabled={loading || !hasToken}>
                  {loading ? 'Cambiando...' : 'Cambiar contraseña'}
                </Button>
                <Button variant="ghost" onClick={() => navigate('/')}>
                  Volver
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
