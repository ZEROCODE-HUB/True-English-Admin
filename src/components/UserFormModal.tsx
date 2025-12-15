import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { User } from "./UserManagement";
import { supabase } from "@/lib/supabase";
interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Omit<User, 'id' | 'fechaRegistro'>) => void;
  user?: User | null;
}
const interestOptions = ["Conversación", "Gramática", "Vocabulario", "Pronunciación", "Escucha", "Lectura", "Escritura", "Cultura", "Negocios", "Viajes"];
export default function UserFormModal({
  isOpen,
  onClose,
  onSave,
  user
}: UserFormModalProps) {
  const normalizeTipo = (t: unknown) => {
    if (!t) return "Alumno";
    const s = String(t).toLowerCase();
    return s === "externo" ? "Externo" : "Alumno";
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
    password: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        celular: user.celular,
        fechaNacimiento: user.fechaNacimiento,
        intereses: user.intereses,
        nivelActual: user.nivelActual,
        estado: user.estado,
        tipoUsuario: normalizeTipo(user.tipoUsuario),
        password: ""
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
        password: ""
      });
    }
    setErrors({});
  }, [user, isOpen]);
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nombre.trim()) newErrors.nombre = "El nombre es requerido";
    if (!formData.apellido.trim()) newErrors.apellido = "El apellido es requerido";
    if (!formData.email.trim()) newErrors.email = "El email es requerido";
    if (!formData.celular.trim()) newErrors.celular = "El celular es requerido";
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = "La fecha de nacimiento es requerida";
    if (!user && !formData.password.trim()) newErrors.password = "La contraseña es requerida";

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Formato de email inválido";
    }
    // Phone simple validation (allow + and digits, min 7 chars)
    const phoneRegex = /^[+]?([0-9\s\-()]){7,}$/;
    if (formData.celular && !phoneRegex.test(formData.celular)) {
      newErrors.celular = "Formato de celular inválido";
    }

    // nivelActual must be one of allowed values
    const allowedNiveles = ["A1", "A2", "B1", "B2", "C1", "C2"];
    if (formData.nivelActual && !allowedNiveles.includes(String(formData.nivelActual))) {
      newErrors.nivelActual = "Nivel inválido";
    }

    // tipoUsuario must be Alumno or Externo
    if (formData.tipoUsuario && !["Alumno", "Externo"].includes(String(formData.tipoUsuario))) {
      newErrors.tipoUsuario = "Tipo de usuario inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const email = String(formData.email).trim();
      // Check uniqueness in profiles
      const { data: existing, error } = await supabase.from('profiles').select('id').ilike('email', email).limit(1);
      if (error) {
        setErrors({ email: 'Error comprobando email' });
        return;
      }

      if (!user) {
        // creating: if any existing profile, prevent
        if (existing && existing.length > 0) {
          setErrors(prev => ({ ...prev, email: 'El email ya está registrado' }));
          return;
        }
      } else {
        // editing: if email changed and belongs to another user, prevent
        const normalizedExisting = existing && existing.length > 0 ? existing[0] : null;
        if (normalizedExisting && String(normalizedExisting.id) !== String(user.id)) {
          setErrors(prev => ({ ...prev, email: 'Otro usuario ya usa ese email' }));
          return;
        }
      }

      // normalize fields before sending back
      const out = {
        nombre: String(formData.nombre).trim(),
        apellido: String(formData.apellido).trim(),
        email: email,
        celular: String(formData.celular).trim(),
        fechaNacimiento: formData.fechaNacimiento,
        intereses: formData.intereses,
        nivelActual: String(formData.nivelActual).toUpperCase(),
        estado: String(formData.estado),
        tipoUsuario: normalizeTipo(formData.tipoUsuario),
        password: formData.password
      } as Omit<User, 'id' | 'fechaRegistro'> & { password?: string };

      await onSave(out);
      onClose();
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.fechaNacimiento && "text-muted-foreground", errors.fechaNacimiento && "border-destructive")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.fechaNacimiento ? format(formData.fechaNacimiento, "dd/MM/yyyy") : <span>Selecciona una fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={formData.fechaNacimiento} onSelect={date => setFormData(prev => ({
                ...prev,
                fechaNacimiento: date
              }))} disabled={date => date > new Date() || date < new Date("1900-01-01")} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {errors.fechaNacimiento && <p className="text-sm text-destructive">{errors.fechaNacimiento}</p>}
        </div>



        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nivel">Nivel Actual</Label>
            <select id="nivel" value={formData.nivelActual} onChange={e => setFormData(prev => ({
              ...prev,
              nivelActual: e.target.value
            }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
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