import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function SubscriptionsManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, profiles(name,last_name,email), plans(label)")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "No se pudieron cargar suscripciones", description: error.message, variant: "destructive" });
        setSubscriptions([]);
        return;
      }

      setSubscriptions((data as any[]) || []);
    } catch (err: any) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter((s) => {
      const name = s.profiles ? `${s.profiles.name ?? ""} ${s.profiles.last_name ?? ""}` : "";
      const email = s.profiles?.email ?? "";
      const plan = s.plans?.label ?? s.plan_id ?? "";
      return `${name} ${email} ${plan} ${s.provider ?? ""} ${s.status ?? ""}`.toLowerCase().includes(q);
    });
  }, [subscriptions, query]);

  const emptyRows = 5;

  const renderStatus = (st: string | undefined) => {
    const s = (st || "").toLowerCase();
    if (s === "active") return <Badge className="bg-green-100 text-green-800">Activo</Badge>;
    if (s === "past_due") return <Badge className="bg-yellow-100 text-yellow-800">Pago Pendiente</Badge>;
    if (s === "canceled" || s === "cancelled") return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
    if (s === "trialing") return <Badge className="bg-blue-100 text-blue-800">En Prueba</Badge>;
    return <Badge className="bg-muted text-muted-foreground">{st ?? "-"}</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Gestión de Suscripciones</h2>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por usuario, plan, estado..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <Button variant="ghost" onClick={fetchSubscriptions} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refrescar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suscripciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Suscriptor</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: emptyRows }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-20 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                  : filtered.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No hay suscripciones.
                        </TableCell>
                      </TableRow>
                    )
                    : filtered.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">{s.profiles ? `${s.profiles.name ?? ""} ${s.profiles.last_name ?? ""}` : s.provider_customer_id ?? "-"}</div>
                            <div className="text-xs text-muted-foreground">{s.profiles?.email ?? "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>{s.plans?.label ?? s.plan_id ?? "-"}</TableCell>
                        <TableCell className="capitalize">{s.provider ?? "-"}</TableCell>
                        <TableCell>{renderStatus(s.status)}</TableCell>
                        <TableCell>
                          {s.current_period_start || s.current_period_end ? (
                            <div className="text-sm">
                              <div>{s.current_period_start ? new Date(s.current_period_start).toLocaleDateString() : "-"}</div>
                              <div className="text-xs text-muted-foreground">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "-"}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => toast({ title: "Ver", description: "Funcionalidad de ver suscripción aún no implementada." })}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
