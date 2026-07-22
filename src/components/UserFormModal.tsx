import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { User } from "./UserManagement";
import type { Company, Area } from "@/types/db";
import { supabase } from "@/lib/supabase";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Omit<User, 'id' | 'fechaRegistro'>) => void;
  user?: User | null;
  initialCompanyId?: string | null;
  initialAreaId?: string | null;
}
const interestOptions = ["Conversación", "Gramática", "Vocabulario", "Pronunciación", "Escucha", "Lectura", "Escritura", "Cultura", "Negocios", "Viajes"];
export default function UserFormModal({
  isOpen,
  onClose,
  onSave,
  user,
  initialCompanyId,
  initialAreaId,
}: UserFormModalProps) {
  const normalizeTipo = (t: unknown) => {
    if (!t) return "Alumno";
    const s = String(t).toLowerCase();
    return s === "externo" ? "Externo" : "Alumno";
  };
  const normalizeNivel = (n: unknown): string => {
    if (!n) return "__none__";
    const s = String(n).toUpperCase();
    if (s === "NULL" || s === "NONE" || s === "") return "__none__";
    return s;
  };
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    email: "",
    celular: "",
    fechaNacimiento: undefined as Date | undefined,
    intereses: [] as string[],
    nivelActual: "A1",
    estado: "activo" as "activo" | "inactivo",
    tipoUsuario: "Alumno" as "Alumno" | "Externo",
    password: "",
    companyId: "__none__" as string,
    areaId: "__none__" as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - i);
  const months = [
    { value: 0, label: "Enero" }, { value: 1, label: "Febrero" }, { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" }, { value: 4, label: "Mayo" }, { value: 5, label: "Junio" },
    { value: 6, label: "Julio" }, { value: 7, label: "Agosto" }, { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" }, { value: 10, label: "Noviembre" }, { value: 11, label: "Diciembre" },
  ];

  const getDayCount = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const parseInitialDate = (val: unknown): Date | undefined => {
    if (!val) return undefined;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return undefined;
  };
  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || "",
        apellido: user.apellido || "",
        email: user.email || "",
        celular: user.celular || "",
        fechaNacimiento: parseInitialDate(user.fechaNacimiento),
        intereses: user.intereses || [],
        nivelActual: normalizeNivel(user.nivelActual),
        estado: (user.estado as "activo" | "inactivo") || "activo",
        tipoUsuario: normalizeTipo(user.tipoUsuario),
        password: "",
        companyId: initialCompanyId || "__none__",
        areaId: initialAreaId || "__none__",
      });
    } else {
      setFormData({
        nombre: "",
        apellido: "",
        email: "",
        celular: "",
        fechaNacimiento: undefined,
        intereses: [],
        nivelActual: "A1",
        estado: "activo",
        tipoUsuario: "Alumno",
        password: "",
        companyId: "__none__",
        areaId: "__none__",
      });
    }
    setErrors({});
  }, [user, isOpen, initialCompanyId, initialAreaId]);

  useEffect(() => {
    if (!isOpen) return;
    supabase.from("companies").select("id, name, slug, active").eq("active", true).order("name").then(({ data }) => {
      setCompanies((data as Company[]) || []);
    });
  }, [isOpen]);

  useEffect(() => {
    if (formData.companyId && formData.companyId !== "__none__") {
      supabase.from("areas").select("id, company_id, name, active").eq("company_id", formData.companyId).eq("active", true).order("name").then(({ data }) => {
        setAreas((data as Area[]) || []);
      });
    } else {
      setAreas([]);
    }
  }, [formData.companyId]);
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!(formData.nombre || '').trim()) newErrors.nombre = "El nombre es requerido";
    if (!(formData.apellido || '').trim()) newErrors.apellido = "El apellido es requerido";
    if (!(formData.email || '').trim()) newErrors.email = "El email es requerido";
    if (!(formData.celular || '').trim()) newErrors.celular = "El celular es requerido";
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = "La fecha de nacimiento es requerida";
    if (!user && !(formData.password || '').trim()) newErrors.password = "La contraseña es requerida";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Formato de email inválido";
    }
    const phoneRegex = /^[+]?([0-9\s\-()]){7,}$/;
    if (formData.celular && !phoneRegex.test(formData.celular)) {
      newErrors.celular = "Formato de celular inválido";
    }

    const allowedNiveles = ["A1", "A2", "B1", "B2", "C1", "C2", "__none__"];
    if (formData.nivelActual && !allowedNiveles.includes(String(formData.nivelActual))) {
      newErrors.nivelActual = "Nivel inválido";
    }

    if (formData.tipoUsuario && !["Alumno", "Externo"].includes(String(formData.tipoUsuario))) {
      newErrors.tipoUsuario = "Tipo de usuario inválido";
    }

    if (Object.keys(newErrors).length > 0) {
      console.error('[UserFormModal] Validation errors:', newErrors, 'formData:', JSON.parse(JSON.stringify(formData)));
    }

    setErrors(newErrors);
    return newErrors;
  };

  const fieldLabels: Record<string, string> = {
    nombre: "Nombre", apellido: "Apellido", email: "Email",
    celular: "Celular", fechaNacimiento: "Fecha de nacimiento", password: "Contraseña",
    nivelActual: "Nivel", tipoUsuario: "Tipo de usuario",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      const fields = Object.keys(formErrors).map(k => fieldLabels[k] || k).join(", ");
      toast({ title: "Campos con errores", description: fields, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const email = String(formData.email || '').trim();
      const { data: existing, error } = await supabase.from('profiles').select('id').ilike('email', email).limit(1);
      if (error) {
        setErrors({ email: 'Error comprobando email' });
        toast({ title: "Error", description: "No se pudo verificar el email.", variant: "destructive" });
        return;
      }

      if (!user) {
        if (existing && existing.length > 0) {
          setErrors(prev => ({ ...prev, email: 'El email ya está registrado' }));
          return;
        }
      } else {
        const normalizedExisting = existing && existing.length > 0 ? existing[0] : null;
        if (normalizedExisting && String(normalizedExisting.id) !== String(user.id)) {
          setErrors(prev => ({ ...prev, email: 'Otro usuario ya usa ese email' }));
          return;
        }
      }

      const out = {
        nombre: String(formData.nombre || '').trim(),
        apellido: String(formData.apellido || '').trim(),
        email: email,
        celular: String(formData.celular || '').trim(),
        fechaNacimiento: formData.fechaNacimiento,
        intereses: formData.intereses,
        nivelActual: formData.nivelActual === "__none__" ? null : String(formData.nivelActual || '').toUpperCase(),
        estado: String(formData.estado || 'activo'),
        tipoUsuario: normalizeTipo(formData.tipoUsuario),
        password: formData.password,
        companyId: formData.companyId === "__none__" ? null : formData.companyId,
        areaId: formData.areaId === "__none__" ? null : formData.areaId,
      } as unknown as Omit<User, 'id' | 'fechaRegistro'> & { password?: string; companyId?: string | null; areaId?: string | null };

      await onSave(out);
      onClose();
    } catch (err) {
      console.error('Error guardando usuario', err);
      toast({ title: "Error", description: "Ocurrió un error al guardar. Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  const handleInterestChange = (interest: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        intereses: [...prev.intereses, interest]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        intereses: prev.intereses.filter(i => i !== interest)
      }));
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {user ? "Editar Usuario" : "Crear Nuevo Usuario"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" value={formData.nombre} onChange={e => setFormData(prev => ({
              ...prev,
              nombre: e.target.value
            }))} className={errors.nombre ? "border-destructive" : ""} />
            {errors.nombre && <p className="text-sm text-destructive">{errors.nombre}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido *</Label>
            <Input id="apellido" value={formData.apellido} onChange={e => setFormData(prev => ({
              ...prev,
              apellido: e.target.value
            }))} className={errors.apellido ? "border-destructive" : ""} />
            {errors.apellido && <p className="text-sm text-destructive">{errors.apellido}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Correo Electrónico *</Label>
          <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({
            ...prev,
            email: e.target.value
          }))} className={errors.email ? "border-destructive" : ""} />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="celular">Celular *</Label>
          <Input id="celular" value={formData.celular} onChange={e => setFormData(prev => ({
            ...prev,
            celular: e.target.value
          }))} placeholder="+34 666 123 456" className={errors.celular ? "border-destructive" : ""} />
          {errors.celular && <p className="text-sm text-destructive">{errors.celular}</p>}
        </div>

        <div className="space-y-2">
          <Label>Fecha de Nacimiento *</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Año</Label>
              <Select
                value={formData.fechaNacimiento ? String(formData.fechaNacimiento.getFullYear()) : ""}
                onValueChange={(val) => {
                  const year = parseInt(val);
                  const prev = formData.fechaNacimiento || new Date(2000, 0, 1);
                  const month = prev.getMonth();
                  const day = Math.min(prev.getDate(), getDayCount(year, month));
                  setFormData(prev => ({ ...prev, fechaNacimiento: new Date(year, month, day) }));
                  setErrors(prev => ({ ...prev, fechaNacimiento: "" }));
                }}
              >
                <SelectTrigger className={errors.fechaNacimiento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mes</Label>
              <Select
                value={formData.fechaNacimiento ? String(formData.fechaNacimiento.getMonth()) : ""}
                onValueChange={(val) => {
                  const month = parseInt(val);
                  const prev = formData.fechaNacimiento || new Date(2000, 0, 1);
                  const year = prev.getFullYear();
                  const day = Math.min(prev.getDate(), getDayCount(year, month));
                  setFormData(prev => ({ ...prev, fechaNacimiento: new Date(year, month, day) }));
                  setErrors(prev => ({ ...prev, fechaNacimiento: "" }));
                }}
              >
                <SelectTrigger className={errors.fechaNacimiento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Día</Label>
              <Select
                value={formData.fechaNacimiento ? String(formData.fechaNacimiento.getDate()) : ""}
                onValueChange={(val) => {
                  const day = parseInt(val);
                  const prev = formData.fechaNacimiento || new Date(2000, 0, 1);
                  setFormData(prev => ({ ...prev, fechaNacimiento: new Date(prev.getFullYear(), prev.getMonth(), day) }));
                  setErrors(prev => ({ ...prev, fechaNacimiento: "" }));
                }}
              >
                <SelectTrigger className={errors.fechaNacimiento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Día" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {(formData.fechaNacimiento
                    ? Array.from({ length: getDayCount(formData.fechaNacimiento.getFullYear(), formData.fechaNacimiento.getMonth()) }, (_, i) => i + 1)
                    : Array.from({ length: 31 }, (_, i) => i + 1)
                  ).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {formData.fechaNacimiento && (
            <p className="text-sm text-muted-foreground">{format(formData.fechaNacimiento, "dd/MM/yyyy")}</p>
          )}
          {errors.fechaNacimiento && <p className="text-sm text-destructive">{errors.fechaNacimiento}</p>}
        </div>



        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nivel">Nivel Actual</Label>
            <select id="nivel" value={formData.nivelActual} onChange={e => setFormData(prev => ({
              ...prev,
              nivelActual: e.target.value
            }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="__none__">Sin nivel</option>
              <option value="A1">A1 - Principiante</option>
              <option value="A2">A2 - Elemental</option>
              <option value="B1">B1 - Intermedio</option>
              <option value="B2">B2 - Intermedio Alto</option>
              <option value="C1">C1 - Avanzado</option>
              <option value="C2">C2 - Competencia</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoUsuario">Tipo de Usuario</Label>
            <select id="tipoUsuario" value={formData.tipoUsuario} onChange={e => setFormData(prev => ({
              ...prev,
              tipoUsuario: e.target.value as "Alumno" | "Externo"
            }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="Alumno">Alumno</option>
              <option value="Externo">Externo</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <select id="estado" value={formData.estado} onChange={e => setFormData(prev => ({
              ...prev,
              estado: e.target.value as "activo" | "inactivo"
            }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <select
              value={formData.companyId}
              onChange={(e) => setFormData(prev => ({ ...prev, companyId: e.target.value, areaId: "__none__" }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="__none__">Sin empresa</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {formData.companyId !== "__none__" && (
            <div className="space-y-2">
              <Label>Area</Label>
              <select
                value={formData.areaId}
                onChange={(e) => setFormData(prev => ({ ...prev, areaId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="__none__">Sin area especifica</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {user && user.codigoInvitacion && <div className="space-y-2">
          <Label htmlFor="codigo-invitacion">Código de Invitación</Label>
          <Input id="codigo-invitacion" value={user.codigoInvitacion} readOnly disabled className="font-mono text-lg tracking-wider bg-muted" />
        </div>}

        {!user && <div className="space-y-2">
          <Label htmlFor="password">Contraseña *</Label>
          <Input id="password" type="password" value={formData.password} onChange={e => setFormData(prev => ({
            ...prev,
            password: e.target.value
          }))} className={errors.password ? "border-destructive" : ""} placeholder="Contraseña para el nuevo usuario" />
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className={`bg-primary hover:bg-primary-hover ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? (user ? 'Actualizando...' : 'Creando...') : (user ? 'Actualizar Usuario' : 'Crear Usuario')}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}