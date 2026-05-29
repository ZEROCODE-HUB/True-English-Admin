import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Plus, Pencil, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "trialing", label: "En Prueba" },
  { value: "past_due", label: "Pago Pendiente" },
  { value: "canceled", label: "Cancelada" },
];

export default function SubscriptionsManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  // Opciones para el modal (usuarios y planes) y estado del formulario.
  const [profiles, setProfiles] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = { user_id: "", plan_id: "", status: "active", current_period_start: "", current_period_end: "" };
  const [form, setForm] = useState({ ...emptyForm });

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

  const fetchOptions = async () => {
    try {
      const [{ data: profs }, { data: pls }] = await Promise.all([
        supabase.from("profiles").select("id,name,last_name,email").order("created_at", { ascending: false }).limit(500),
        supabase.from("plans").select("id,label").order("sort_order", { ascending: true }),
      ]);
      setProfiles(profs || []);
      setPlans(pls || []);
    } catch (err) {
      console.error("failed to load subscription options", err);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchOptions();
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

  const profileLabel = (p: any) => {
    const name = `${p.name ?? ""} ${p.last_name ?? ""}`.trim();
    return name ? `${name} — ${p.email ?? ""}` : (p.email ?? p.id);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      user_id: s.user_id ?? "",
      plan_id: s.plan_id ?? "",
      status: s.status ?? "active",
      current_period_start: s.current_period_start ? String(s.current_period_start).slice(0, 10) : "",
      current_period_end: s.current_period_end ? String(s.current_period_end).slice(0, 10) : "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.user_id) {
      toast({ title: "Falta el usuario", description: "Selecciona un usuario.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        user_id: form.user_id,
        plan_id: form.plan_id || null,
        status: form.status,
        provider: "manual",
        cancel_at_period_end: false,
        current_period_start: form.current_period_start || null,
        current_period_end: form.current_period_end || null,
      };
      let error: any = null;
      if (editingId) {
        ({ error } = await supabase.from("subscriptions").update(payload).eq("id", editingId));
      } else {
        ({ error } = await supabase.from("subscriptions").insert(payload));
      }
      if (error) throw error;
      toast({ title: "Guardado", description: "Suscripción guardada correctamente." });
      setIsModalOpen(false);
      fetchSubscriptions();
    } catch (err: any) {
      toast({ title: "No se pudo guardar", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSub = async (s: any) => {
    if (!confirm("¿Cancelar esta suscripción?")) return;
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
      toast({ title: "Cancelada", description: "La suscripción se marcó como cancelada." });
      fetchSubscriptions();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? String(err), variant: "destructive" });
    }
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
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva suscripción
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
                            <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {(s.status || "").toLowerCase() !== "canceled" && (s.status || "").toLowerCase() !== "cancelled" && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleCancelSub(s)}>
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar suscripción" : "Nueva suscripción"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm((p) => ({ ...p, user_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={form.plan_id} onValueChange={(v) => setForm((p) => ({ ...p, plan_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((pl) => (
                    <SelectItem key={pl.id} value={pl.id}>{pl.label ?? pl.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Inicio del periodo</Label>
                <Input type="date" value={form.current_period_start} onChange={(e) => setForm((p) => ({ ...p, current_period_start: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Fin del periodo</Label>
                <Input type="date" value={form.current_period_end} onChange={(e) => setForm((p) => ({ ...p, current_period_end: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
