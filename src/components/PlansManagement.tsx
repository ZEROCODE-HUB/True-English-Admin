import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import supabase from "@/lib/supabase";

interface Plan {
  id: string;
  label: string;
  duration_label: string;
  price_mxn: number;
  price_per_month_mxn: number;
  recommended: boolean;
  active: boolean;
  sort_order: number;
}

export default function PlansManagement() {
  const DURATION_OPTIONS = [
    { id: '1m', label: '1 mes', duration_label: '$249 MXN / mes', price_mxn: 249, price_per_month_mxn: 249 },
    { id: '3m', label: '3 meses', duration_label: '$233 MXN / mes', price_mxn: 699, price_per_month_mxn: 233 },
    { id: '12m', label: '12 meses', duration_label: '$208 MXN / mes', price_mxn: 2499, price_per_month_mxn: 208 }
  ];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [benefitsText, setBenefitsText] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      setPlans((data || []) as any);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudieron cargar los planes.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    const defaultDur = DURATION_OPTIONS[0];
    setEditing({ id: '', label: defaultDur.label, duration_label: defaultDur.duration_label, price_mxn: defaultDur.price_mxn, price_per_month_mxn: defaultDur.price_per_month_mxn, recommended: false, active: true, sort_order: 0 });
    setSelectedDuration(defaultDur.id);
    setBenefitsText('');
    setIsModalOpen(true);
  };

  const openEdit = async (p: Plan) => {
    setEditing(p);
    // try to infer duration option from id
    const match = DURATION_OPTIONS.find(d => d.id === p.id);
    setSelectedDuration(match ? match.id : null);
    // load benefits
    const { data } = await supabase.from('plan_benefits').select('benefit_label').eq('plan_id', p.id).order('sort_order', { ascending: true });
    setBenefitsText((data || []).map((b: any) => b.benefit_label).join('\n'));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const payloadId = editing.id && editing.id.trim() !== '' ? editing.id : (selectedDuration ?? editing.label.replace(/\s+/g, '').toLowerCase());
      const durationOpt = DURATION_OPTIONS.find(d => d.id === selectedDuration);
      const payload = {
        id: payloadId,
        label: editing.label,
        duration_label: durationOpt ? durationOpt.duration_label : editing.duration_label,
        price_mxn: editing.price_mxn,
        price_per_month_mxn: editing.price_per_month_mxn,
        recommended: editing.recommended,
        active: editing.active,
        sort_order: editing.sort_order
      };
      const { error } = await supabase.from('plans').upsert(payload);
      if (error) throw error;
      // replace benefits
      const planId = payload.id;
      await supabase.from('plan_benefits').delete().eq('plan_id', planId);
      const lines = benefitsText.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length) {
        const toInsert = lines.map((label, idx) => ({ plan_id: planId, benefit_label: label, sort_order: idx + 1 }));
        const { error: e2 } = await supabase.from('plan_benefits').insert(toInsert);
        if (e2) throw e2;
      }
      toast({ title: 'Guardado', description: 'Plan guardado correctamente.' });
      setIsModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo guardar el plan.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar plan?')) return;
    try {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Eliminado', description: 'Plan eliminado.' });
      load();
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'No se pudo eliminar.' }); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Gestión de planes</h1>
        <Button onClick={openCreate}>Nuevo Plan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Precio MXN</TableHead>
                <TableHead>Precio / mes</TableHead>
                <TableHead>Recomendado</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.id}</TableCell>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>{p.duration_label}</TableCell>
                  <TableCell>{p.price_mxn}</TableCell>
                  <TableCell>{p.price_per_month_mxn}</TableCell>
                  <TableCell>{p.recommended ? 'Sí' : '—'}</TableCell>
                  <TableCell>{p.active ? 'Sí' : '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>Eliminar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Duración</Label>
              <Select value={selectedDuration ?? ''} onValueChange={(v) => {
                setSelectedDuration(v || null);
                const opt = DURATION_OPTIONS.find(d => d.id === v);
                // Mantener el id estable al editar un plan existente (cambiar el id
                // crearía un plan nuevo y dejaría huérfanos los plan_benefits). Solo
                // se toma el id de la duración cuando es un plan nuevo (sin id).
                if (opt && editing) setEditing(prev => prev ? { ...prev, id: prev.id ? prev.id : opt.id, duration_label: opt.duration_label, label: opt.label, price_mxn: opt.price_mxn, price_per_month_mxn: opt.price_per_month_mxn } : prev);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona duración" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(d => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={editing?.label || ''} onChange={e => setEditing(prev => prev ? { ...prev, label: e.target.value } : prev)} />
            </div>
            <div>
              <Label>Precio total MXN</Label>
              <Input type="number" value={editing?.price_mxn ?? 0} onChange={e => setEditing(prev => prev ? { ...prev, price_mxn: Number(e.target.value) } : prev)} />
            </div>
            <div>
              <Label>Precio por mes MXN</Label>
              <Input type="number" value={editing?.price_per_month_mxn ?? 0} onChange={e => setEditing(prev => prev ? { ...prev, price_per_month_mxn: Number(e.target.value) } : prev)} />
            </div>
            <div className="flex items-center gap-4">
              <Label>Recomendado</Label>
              <Switch checked={editing?.recommended ?? false} onCheckedChange={(v: any) => setEditing(prev => prev ? { ...prev, recommended: !!v } : prev)} />
              <Label>Activo</Label>
              <Switch checked={editing?.active ?? true} onCheckedChange={(v: any) => setEditing(prev => prev ? { ...prev, active: !!v } : prev)} />
            </div>

            <div>
              <Label>Beneficios (uno por línea)</Label>
              <Textarea value={benefitsText} onChange={e => setBenefitsText(e.target.value)} rows={6} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
