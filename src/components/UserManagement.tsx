import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Mail,
  Loader2,
  Check,
  X,
  Download,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import UserFormModal from "./UserFormModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import StudentProgressModal from "./StudentProgressModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { StudentProgress } from "@/types/db";
import { msToHumanHours, msToDecimalHours, fmtDate } from "@/lib/format";

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  celular?: string;
  fechaNacimiento?: string | null;
  intereses?: string[];
  nivelActual?: string | null;
  fechaRegistro?: string;
  estado?: string | null;
  tipoUsuario?: string | null;
  codigoInvitacion?: string | null;
}

// Invitations will be stored in `profiles` as rows with a `code` field.

// We'll fetch users from Supabase `profiles` table

const levelColors = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800"
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitedStudents, setInvitedStudents] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showInvited, setShowInvited] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [resendSendingId, setResendSendingId] = useState<string | null>(null);


  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [total, setTotal] = useState(0);

  // Avance de alumnos (RPC admin_get_students_progress): mapa por id para la tabla + arreglo completo para export
  const [progressById, setProgressById] = useState<Record<string, StudentProgress>>({});
  const [allProgress, setAllProgress] = useState<StudentProgress[]>([]);
  const [exporting, setExporting] = useState(false);
  const [progressModal, setProgressModal] = useState<StudentProgress | null>(null);
  const [membershipsByUser, setMembershipsByUser] = useState<Record<string, { companyId: string; companyName: string; areaId: string | null; areaName: string | null }>>({});

  const fetchProgress = async () => {
    try {
      const { data, error } = await supabase.rpc("admin_get_students_progress");
      if (error) {
        console.error("failed to load student progress", error);
        return;
      }
      const rows = (data ?? []) as StudentProgress[];
      setAllProgress(rows);
      const map: Record<string, StudentProgress> = {};
      rows.forEach((r) => { map[r.id] = r; });
      setProgressById(map);
    } catch (err) {
      console.error("error calling admin_get_students_progress", err);
    }
  };

  // Fetch profiles from Supabase with server-side pagination, search and filters
  const fetchUsers = async (opts?: { page?: number }) => {
    setLoading(true);
    const currentPage = opts?.page ?? page;
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });

      const term = searchTerm.trim();
      if (term) {
        // search across name, last_name and email
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
      }

      if (filterLevel && filterLevel !== 'all') query = query.eq('nivel_actual', filterLevel);
      if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus);

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setUsers([]);
        setTotal(0);
      } else if (data) {
        const mapped: User[] = (data as Record<string, unknown>[]).map((p) => ({
          id: String(p['id'] ?? ''),
          nombre: String(p['name'] ?? ''),
          apellido: String(p['last_name'] ?? ''),
          email: String(p['email'] ?? ''),
          celular: String(p['phone'] ?? ''),
          fechaNacimiento: p['birth_date'] ? String(p['birth_date']) : null,
          nivelActual: p['nivel_actual'] && String(p['nivel_actual']).toUpperCase() !== 'NULL' ? String(p['nivel_actual']) : null,
          fechaRegistro: p['created_at'] ? String(p['created_at']) : null,
          estado: p['status'] ? String(p['status']) : null,
          // normalize stored tipo to lowercase for consistent comparisons
          tipoUsuario: p['tipo'] ? String(p['tipo']).toLowerCase() : null,
          codigoInvitacion: p['code'] ? String(p['code']) : null,
        }));
        setUsers(mapped);
        setTotal(typeof count === 'number' ? count : mapped.length);
        fetchMemberships(mapped.map(u => u.id));
      } else {
        setUsers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberships = async (userIds: string[]) => {
    if (userIds.length === 0) { setMembershipsByUser({}); return; }
    const { data } = await supabase
      .from("company_memberships")
      .select("profile_id, company_id, area_id, companies!company_id(name), areas!area_id(name)")
      .in("profile_id", userIds);
    const map: Record<string, { companyId: string; companyName: string; areaId: string | null; areaName: string | null }> = {};
    (data || []).forEach((r: any) => {
      const pid = r.profile_id;
      if (!map[pid]) {
        map[pid] = {
          companyId: r.company_id,
          companyName: r.companies?.name ?? "—",
          areaId: r.area_id,
          areaName: r.areas?.name ?? null,
        };
      }
    });
    setMembershipsByUser(map);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          // Try invoking via supabase client
          let invokeResult: any;
          try {
            invokeResult = await supabase.functions.invoke('delete-user', {
              method: 'POST',
              body: JSON.stringify({ userId }),
            });
          } catch (invokeErr) {
            console.error('supabase.functions.invoke threw', invokeErr);
            invokeResult = { error: invokeErr };
          }

          // If supabase client returned an error, attempt fetch fallback
          if (invokeResult?.error) {
            // Try to extract server message
            const serverMsg = invokeResult?.error?.message || String(invokeResult?.error);
            console.warn('Invoke error, attempting fetch fallback:', serverMsg);

            // build functions URL from VITE_SUPABASE_URL
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
            const projectHost = supabaseUrl.replace(/^https?:\/\//, '').replace('.supabase.co', '');
            const functionsUrl = `https://${projectHost}.functions.supabase.co/delete-user`;

            // Get session token to forward Authorization
            const sessionResp = await supabase.auth.getSession();
            const token = sessionResp?.data?.session?.access_token;

            try {
              const resp = await fetch(functionsUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ userId }),
              });
              const text = await resp.text();
              let parsed: any = null;
              try { parsed = JSON.parse(text); } catch { }
              if (!resp.ok) {
                const msg = parsed?.error ? `${parsed.error}: ${parsed.details ?? ''}` : text || resp.statusText;
                toast({ title: 'Error', description: `Function error: ${msg}`, variant: 'destructive' });
                console.error('Function fetch response error', resp.status, text);
                return;
              }
            } catch (fetchErr) {
              toast({ title: 'Error', description: `No se pudo invocar la función: ${String(fetchErr)}`, variant: 'destructive' });
              console.error('fetch fallback failed', fetchErr);
              return;
            }
          }

          // Success: update UI
          setUsers(users.filter(u => u.id !== userId));
          toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
        } catch (err) {
          toast({ title: 'Error', description: String(err), variant: 'destructive' });
          console.error('final delete error', err);
        }
      },
    });
  };

  const handleToggleStatus = (userId: string) => {
    // Toggle status in DB
    (async () => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      const newStatus = user.estado === 'activo' ? 'inactivo' : 'activo';
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setUsers(users.map(u => u.id === userId ? { ...u, estado: newStatus } : u));
      toast({ title: 'Estado actualizado', description: 'El estado del usuario ha sido actualizado.' });
    })();
  };

  const handleSaveUser = async (userData: Record<string, unknown>) => {
    const rawBirth = userData.fechaNacimiento;
    const birthDate = rawBirth instanceof Date ? format(rawBirth, 'yyyy-MM-dd') : rawBirth ?? null;

    const payload = {
      email: userData.email,
      name: userData.nombre,
      last_name: userData.apellido,
      phone: userData.celular ?? null,
      birth_date: birthDate,
      nivel_actual: userData.nivelActual ?? null,
      status: userData.estado ?? 'activo',
      tipo: (userData.tipoUsuario ? String(userData.tipoUsuario) : 'alumno').toLowerCase(),
      code: userData.codigoInvitacion ?? null,
    };

    if (editingUser) {
      // Update profile row
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Handle membership
        const companyId = userData.companyId as string | null;
        const areaId = userData.areaId as string | null;
        const existing = membershipsByUser[editingUser.id];
        if (companyId) {
          if (existing && existing.companyId === companyId) {
            // Same company — update area if changed
            if (existing.areaId !== areaId) {
              await supabase.from("company_memberships").update({ area_id: areaId }).eq("profile_id", editingUser.id).eq("company_id", companyId);
            }
          } else {
            // New company — delete old membership if any, create new
            if (existing) {
              await supabase.from("company_memberships").delete().eq("profile_id", editingUser.id).eq("company_id", existing.companyId);
            }
            await supabase.from("company_memberships").insert({ profile_id: editingUser.id, company_id: companyId, area_id: areaId, active: true });
          }
        } else if (existing) {
          // No company selected — remove membership
          await supabase.from("company_memberships").delete().eq("profile_id", editingUser.id).eq("company_id", existing.companyId);
        }
        toast({ title: 'Usuario actualizado', description: 'Los datos del usuario han sido actualizados correctamente.' });
        await fetchUsers();
      }
    } else {
      // Creating new user via Edge Function to avoid creating session for the new user
      try {
        const password = String(userData.password ?? '');
        if (!password) {
          toast({ title: 'Error', description: 'La contraseña es requerida para crear un usuario.', variant: 'destructive' });
          return;
        }

        const fnPayload = {
          email: String(userData.email ?? ''),
          password,
          name: userData.nombre ?? null,
          last_name: userData.apellido ?? null,
          phone: userData.celular ?? null,
          birth_date: userData.fechaNacimiento ?? null,
          nivel_actual: userData.nivelActual ?? null,
          status: userData.estado ?? 'activo',
          tipo: userData.tipoUsuario ?? 'alumno',
          code: userData.codigoInvitacion ?? null,
        };

        // Try invoking via supabase client
        let fnResult: any;
        try {
          fnResult = await supabase.functions.invoke('create-user', { method: 'POST', body: JSON.stringify(fnPayload) });
        } catch (invokeErr) {
          console.error('functions.invoke error', invokeErr);
          fnResult = { error: invokeErr };
        }

        if (fnResult?.error) {
          // fallback to direct fetch
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const projectHost = supabaseUrl.replace(/^https?:\/\//, '').replace('.supabase.co', '');
          const functionsUrl = `https://${projectHost}.functions.supabase.co/create-user`;
          const sessionResp = await supabase.auth.getSession();
          const token = sessionResp?.data?.session?.access_token;
          try {
            const resp = await fetch(functionsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify(fnPayload),
            });
            const text = await resp.text();
            let parsed = null;
            try { parsed = JSON.parse(text); } catch { }
            if (!resp.ok) {
              const msg = parsed?.error ? `${parsed.error}: ${parsed.details ?? ''}` : text || resp.statusText;
              toast({ title: 'Error', description: `Function error: ${msg}`, variant: 'destructive' });
              console.error('create-user function error', resp.status, text);
              return;
            }
            fnResult = { data: parsed };
          } catch (fetchErr) {
            toast({ title: 'Error', description: `No se pudo invocar la función: ${String(fetchErr)}`, variant: 'destructive' });
            console.error('fetch create-user failed', fetchErr);
            return;
          }
        }

        // Create membership if company selected
        const companyId = userData.companyId as string | null;
        const areaId = userData.areaId as string | null;
        if (companyId) {
          const newUserId = fnResult?.data?.id || fnResult?.data?.user?.id;
          if (newUserId) {
            await supabase.from("company_memberships").insert({ profile_id: newUserId, company_id: companyId, area_id: areaId, active: true });
          }
        }

        toast({ title: 'Usuario creado', description: 'El nuevo usuario ha sido creado correctamente.' });
        await fetchUsers();
      } catch (err) {
        toast({ title: 'Error', description: String(err), variant: 'destructive' });
      }
    }

    setIsModalOpen(false);
  };

  // Re-fetch when filters/search change (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchUsers({ page: 1 });
    // also refresh invited students when filters/search change
    fetchInvitedStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, filterStatus, searchTerm]);

  // Fetch when page changes
  useEffect(() => {
    fetchUsers({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // fetch invited students + student progress on mount
  useEffect(() => {
    fetchInvitedStudents();
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the search input so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredUsers = users;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Exporta el avance a Excel respetando los filtros activos (nivel, estado, búsqueda)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const term = searchTerm.trim().toLowerCase();
      const filtered = allProgress.filter((s) => {
        if (filterLevel !== "all" && (s.nivel_actual ?? "") !== filterLevel) return false;
        if (filterStatus !== "all" && (s.status ?? "") !== filterStatus) return false;
        if (term) {
          const hay = `${s.name ?? ""} ${s.last_name ?? ""} ${s.email ?? ""}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        toast({ title: "Sin datos", description: "No hay alumnos que coincidan con los filtros." });
        return;
      }

      // Carga diferida: exceljs es pesado, solo se descarga al exportar
      const { exportToXlsx } = await import("@/lib/export");
      await exportToXlsx<StudentProgress>({
        filename: "reporte_alumnos.xlsx",
        sheetName: "Avance de Alumnos",
        rows: filtered,
        columns: [
          { header: "Nombre", width: 18, value: (s) => s.name ?? "" },
          { header: "Apellido", width: 18, value: (s) => s.last_name ?? "" },
          { header: "Email", width: 30, value: (s) => s.email ?? "" },
          { header: "Empresa", width: 18, value: (s) => s.company ?? "" },
          { header: "Tipo", width: 12, value: (s) => s.tipo ?? "" },
          { header: "Nivel", width: 10, value: (s) => s.nivel_actual ?? "Sin nivel" },
          { header: "Estado", width: 12, value: (s) => s.status ?? "" },
          { header: "Puntos", width: 10, numFmt: "0", value: (s) => s.puntos ?? 0 },
          { header: "% Avance (nivel)", width: 16, numFmt: "0", value: (s) => s.pct_avance ?? 0 },
          { header: "Lecciones completadas", width: 20, numFmt: "0", value: (s) => s.completed_total ?? 0 },
          { header: "Lecciones totales", width: 16, numFmt: "0", value: (s) => s.lessons_total ?? 0 },
          { header: "Horas totales", width: 14, numFmt: "0.0", value: (s) => msToDecimalHours(s.horas_totales_ms) },
          { header: "Horas del mes", width: 14, numFmt: "0.0", value: (s) => msToDecimalHours(s.horas_mes_ms) },
          { header: "Racha actual", width: 12, numFmt: "0", value: (s) => s.streak_count ?? 0 },
          { header: "Mejor racha", width: 12, numFmt: "0", value: (s) => s.streak_best ?? 0 },
          { header: "Logros", width: 10, numFmt: "0", value: (s) => s.logros_count ?? 0 },
          { header: "Última actividad", width: 16, value: (s) => fmtDate(s.ultima_actividad) },
          { header: "Fecha de registro", width: 16, value: (s) => fmtDate(s.created_at) },
        ],
      });

      toast({ title: "Exportado", description: `Se exportaron ${filtered.length} alumno(s) a Excel.` });
    } catch (err) {
      toast({ title: "Error", description: `No se pudo exportar: ${String(err)}`, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleInviteUser = () => {
    setInviteEmail("");
    setInviteName("");
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setInviteCode(code);
    // ensure inviteSending is reset when opening the modal
    setInviteSending(false);
    setIsInviteModalOpen(true);
  };

  const toggleShowInvited = async () => {
    const next = !showInvited;
    setShowInvited(next);
    if (next) await fetchInvitedStudents();
  };

  async function fetchInvitedStudents() {
    try {
      // use a separate `invitations` table to avoid FK constraints on `profiles.id`
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setInvitedStudents([]);
        return;
      }
      const mapped: User[] = (data as Record<string, unknown>[]).map((p) => ({
        id: String(p['id'] ?? ''),
        nombre: String(p['name'] ?? ''),
        apellido: String(p['last_name'] ?? ''),
        email: String(p['email'] ?? ''),
        celular: String(p['phone'] ?? ''),
        fechaNacimiento: p['birth_date'] ? String(p['birth_date']) : null,
        nivelActual: p['nivel_actual'] && String(p['nivel_actual']).toUpperCase() !== 'NULL' ? String(p['nivel_actual']) : null,
        fechaRegistro: p['created_at'] ? String(p['created_at']) : null,
        estado: p['status'] ? String(p['status']) : null,
        tipoUsuario: p['tipo'] ? String(p['tipo']).toLowerCase() : null,
        codigoInvitacion: p['code'] ? String(p['code']) : null,
      }));
      setInvitedStudents(mapped);
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
      setInvitedStudents([]);
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteName) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos.', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({ title: 'Email inválido', description: 'El formato del email no es válido.', variant: 'destructive' });
      return;
    }

    try {
      // Si el email ya es usuario, solo bloqueamos si YA tiene acceso. Si existe
      // pero sin acceso (p. ej. entró con Google), permitimos invitarlo: recibirá
      // el código y lo activará desde la pantalla de código de la app
      // (validate-code en modo authenticated marca hasStudentCode sobre su cuenta).
      const { data: accessStatus, error: accessErr } = await supabase.rpc('email_access_status', { p_email: inviteEmail });
      if (accessErr) {
        toast({ title: 'Error', description: accessErr.message, variant: 'destructive' });
        return;
      }
      if ((accessStatus as { has_access?: boolean } | null)?.has_access) {
        toast({ title: 'Error', description: 'Este usuario ya tiene acceso a la app.', variant: 'destructive' });
        return;
      }

      // Check if an invitation for this email already exists
      const { data: existingInvites, error: errInvites } = await supabase
        .from('invitations')
        .select('id')
        .ilike('email', inviteEmail)
        .limit(1);
      if (errInvites) {
        toast({ title: 'Error', description: errInvites.message, variant: 'destructive' });
        return;
      }
      if (existingInvites && existingInvites.length > 0) {
        toast({ title: 'Error', description: 'Ya se ha enviado una invitación a este email.', variant: 'destructive' });
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const insertObj = {
        name: inviteName,
        email: inviteEmail,
        code: inviteCode,
        tipo: 'alumno',
        status: 'invitado',
        email_status: 'pending',
        expires_at: expiresAt.toISOString(),
      };

      // insert into `invitations` table (create this table in Supabase)
      const { error } = await supabase.from('invitations').insert(insertObj);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY as string;
      const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL as string;

      const iosLink = "https://apps.apple.com/app/idYOUR_IOS_APP_ID";
      const androidLink = "https://play.google.com/store/apps/details?id=YOUR_ANDROID_PACKAGE";

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#0b2540;">
          <h2 style="margin-top:0">Invitación a TrueEnglish Academy</h2>
          <p>Hola ${inviteName},</p>
          <p>Este es tu código para registrarte en la aplicación TrueEnglish:</p>
          <p style="font-size:20px;font-weight:700;color:#015ea8;">${insertObj.code}</p>

          <p>Descárgala aquí:</p>
          <p style="display:flex;gap:10px;margin:12px 0;">
            <a href="${iosLink}" style="display:inline-block;padding:10px 14px;background:#015ea8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">App Store (iOS)</a>
            <a href="${androidLink}" style="display:inline-block;padding:10px 14px;background:#0a66c2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Google Play (Android)</a>
          </p>

          <p>Introduce este código en la aplicación (pantalla de código de estudiante) para activar tu acceso.</p>

          <p style="margin-top:18px">Si tienes problemas, visita <a href="${window.location.origin}" style="color:#015ea8;text-decoration:underline;">nuestra web</a> o contacta con soporte.</p>
        </div>`;

      const text = `Hola ${inviteName},\n\nEste es tu codigo para registrarte en TrueEnglish: ${insertObj.code}\n\nDescarga la app para iOS: ${iosLink} \nAndroid: ${androidLink}\n\nIntroduce este codigo en la app (pantalla de codigo de estudiante) para activar tu acceso.`;

      const payload = {
        from: FROM_EMAIL,
        to: inviteEmail,
        subject: `Invitación a TrueEnglish Academy - ${insertObj.code}`,
        html,
        text,
      };

      // La invitación YA quedó creada arriba. El envío del email es best-effort:
      // Resend no admite llamadas desde el navegador (CORS), así que si falla NO
      // tratamos toda la invitación como fallida — avisamos y queda el botón
      // "Reenviar" (o compartir el código que se muestra en el modal).
      let emailOk = false;
      let emailErrMsg = '';
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok) {
          emailOk = true;
        } else {
          console.error('resend error', data);
          emailErrMsg = String(data?.error?.message || data?.error || `Error ${resp.status}`);
        }
      } catch (mailErr) {
        console.error('resend fetch failed', mailErr);
        emailErrMsg = 'el servicio de email no respondió';
      }

      await supabase.from('invitations')
        .update(emailOk
          ? { email_status: 'sent', email_sent_at: new Date().toISOString() }
          : { email_status: 'failed' })
        .ilike('email', inviteEmail);

      if (emailOk) {
        toast({ title: 'Invitación enviada', description: 'La invitación fue creada y el email se envió correctamente.' });
      } else {
        toast({
          title: 'Invitación creada (email no enviado)',
          description: `Código: ${insertObj.code}. Hubo un problema al enviar el email (${emailErrMsg}). Usa "Reenviar" o comparte el código con el alumno.`,
        });
      }

      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteCode('');
      await fetchInvitedStudents();
    } catch (err) {
      console.error('Failed to send invitation', err);
      toast({ title: 'Error', description: 'No se pudo procesar la invitación.', variant: 'destructive' });
    }
    finally {
      setInviteSending(false);
    }
  };

  const handleResendInvitation = async (studentId: string) => {
    setResendSendingId(studentId);
    try {
      // fetch invitation row by id
      const { data, error } = await supabase.from('invitations').select('*').eq('id', studentId).single();
      if (error || !data) {
        toast({ title: 'Error', description: error?.message || 'Invitación no encontrada', variant: 'destructive' });
        return;
      }

      const invite = data as Record<string, unknown>;
      const inviteEmail = String(invite['email'] ?? '');
      const inviteName = String(invite['name'] ?? '');
      const code = String(invite['code'] ?? '');

      if (!inviteEmail) {
        toast({ title: 'Error', description: 'El registro de invitación no tiene email.', variant: 'destructive' });
        return;
      }

      const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY as string;
      const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL as string;

      const iosLink = "https://apps.apple.com/app/idYOUR_IOS_APP_ID";
      const androidLink = "https://play.google.com/store/apps/details?id=YOUR_ANDROID_PACKAGE";

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#0b2540;">
          <h2 style="margin-top:0">Invitación a TrueEnglish Academy</h2>
          <p>Hola ${inviteName || inviteEmail},</p>
          <p>Este es tu código para registrarte en la aplicación TrueEnglish:</p>
          <p style="font-size:20px;font-weight:700;color:#015ea8;">${code}</p>

          <p>Descárgala aquí:</p>
          <p style="display:flex;gap:10px;margin:12px 0;">
            <a href="${iosLink}" style="display:inline-block;padding:10px 14px;background:#015ea8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">App Store (iOS)</a>
            <a href="${androidLink}" style="display:inline-block;padding:10px 14px;background:#0a66c2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Google Play (Android)</a>
          </p>

          <p>Introduce este código en la aplicación (pantalla de código de estudiante) para activar tu acceso.</p>

          <p style="margin-top:18px">Si tienes problemas, visita <a href="${window.location.origin}" style="color:#015ea8;text-decoration:underline;">nuestra web</a> o contacta con soporte.</p>
        </div>`;

      const text = `Hola ${inviteName || inviteEmail},\n\nEste es tu codigo para registrarte en TrueEnglish: ${code}\n\nDescarga la app para iOS: ${iosLink} \nAndroid: ${androidLink}\n\nIntroduce este codigo en la app (pantalla de codigo de estudiante) para activar tu acceso.`;

      const payload = {
        from: FROM_EMAIL,
        to: inviteEmail,
        subject: `Invitación a TrueEnglish Academy - ${code}`,
        html,
        text,
      };

      let emailOk = false;
      let emailErrMsg = '';
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify(payload),
        });
        const dataResp = await resp.json().catch(() => null);
        if (resp.ok) {
          emailOk = true;
        } else {
          console.error('resend resend error', dataResp);
          emailErrMsg = String(dataResp?.error?.message || dataResp?.error || `Error ${resp.status}`);
        }
      } catch (mailErr) {
        console.error('resend fetch failed', mailErr);
        emailErrMsg = 'el servicio de email no respondió';
      }

      await supabase.from('invitations')
        .update(emailOk
          ? { email_status: 'sent', email_sent_at: new Date().toISOString() }
          : { email_status: 'failed' })
        .eq('id', studentId);

      if (emailOk) {
        toast({ title: 'Email reenviado', description: 'La invitación fue reenviada correctamente.' });
      } else {
        toast({ title: 'No se pudo enviar el email', description: `Comparte el código con el alumno: ${code}. (${emailErrMsg})` });
      }
    } catch (err) {
      console.error('Failed to resend invitation', err);
      toast({ title: 'Error', description: 'Error al reenviar la invitación.', variant: 'destructive' });
    } finally {
      setResendSendingId(null);
    }
  };

  const handleDeleteInvitedStudent = (studentId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        const { error } = await supabase.from('invitations').delete().eq('id', studentId);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Invitación eliminada', description: 'Invitación eliminada correctamente.' });
        await fetchInvitedStudents();
        await fetchUsers();
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los usuarios de la plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" disabled={exporting || allProgress.length === 0}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar a Excel
          </Button>
          <Button onClick={handleInviteUser} variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground">
            <Mail className="w-4 h-4 mr-2" />
            Invitar Alumno
          </Button>
          <Button onClick={handleCreateUser} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </Button>
          <Button variant="outline" onClick={toggleShowInvited}>
            {showInvited ? 'Ocultar Invitados' : 'Ver Invitados'}
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar y Filtrar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nombre, apellido o email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                <SelectItem value="A1">A1</SelectItem>
                <SelectItem value="A2">A2</SelectItem>
                <SelectItem value="B1">B1</SelectItem>
                <SelectItem value="B2">B2</SelectItem>
                <SelectItem value="C1">C1</SelectItem>
                <SelectItem value="C2">C2</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>



      {showInvited && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Estudiantes Invitados ({invitedStudents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invitedStudents.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">No hay estudiantes invitados</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Código de Invitación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitedStudents.map((inv) => (
                    <TableRow key={inv.id || inv.email}>
                      <TableCell className="font-medium">{inv.nombre}</TableCell>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {inv.codigoInvitacion}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(inv.id)}
                            disabled={resendSendingId === inv.id}
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            {resendSendingId === inv.id ? 'Reenviando...' : 'Reenviar Email'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteInvitedStudent(inv.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Usuarios ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Nombre</TableHead>
                <TableHead className="whitespace-nowrap">Apellido</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="min-w-[180px]">Empresa</TableHead>
                <TableHead className="whitespace-nowrap">Tipo</TableHead>
                <TableHead className="whitespace-nowrap">Nivel</TableHead>
                <TableHead className="text-center whitespace-nowrap">Puntos</TableHead>
                <TableHead className="whitespace-nowrap">% Avance</TableHead>
                <TableHead className="whitespace-nowrap">Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const prog = progressById[user.id];
                return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium whitespace-nowrap">{user.nombre}</TableCell>
                  <TableCell className="whitespace-nowrap">{user.apellido}</TableCell>
                  <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                  <TableCell className="min-w-[180px]">
                    {membershipsByUser[user.id] ? (
                      <span className="text-sm whitespace-nowrap">
                        {membershipsByUser[user.id].companyName}
                        {membershipsByUser[user.id].areaName && (
                          <span className="text-muted-foreground"> — {membershipsByUser[user.id].areaName}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={user.tipoUsuario === 'alumno' ? 'default' : 'outline'}>
                      {user.tipoUsuario}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge className={user.nivelActual && levelColors[user.nivelActual as keyof typeof levelColors] ? levelColors[user.nivelActual as keyof typeof levelColors] : 'bg-gray-100 text-gray-600'}>
                      {user.nivelActual ? user.nivelActual : 'Sin nivel'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{prog ? prog.puntos : '—'}</TableCell>
                  <TableCell>
                    {prog ? (
                      <div className="flex items-center gap-1.5 min-w-[90px]">
                        <Progress value={prog.pct_avance} className="h-2 w-14" />
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{prog.pct_avance}%</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{format(user.fechaRegistro, "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={user.estado === 'activo' ? 'default' : 'secondary'}>
                      {user.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => prog && setProgressModal(prog)}
                        disabled={!prog}
                        title="Ver avance"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(user.id)}
                        className={user.estado === 'activo' ? 'text-warning' : 'text-success'}
                      >
                        {user.estado === 'activo' ?
                          <PowerOff className="w-4 h-4" /> :
                          <Power className="w-4 h-4" />
                        }
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        user={editingUser}
        initialCompanyId={editingUser ? (membershipsByUser[editingUser.id]?.companyId ?? null) : null}
        initialAreaId={editingUser ? (membershipsByUser[editingUser.id]?.areaId ?? null) : null}
      />

      {progressModal && (
        <StudentProgressModal
          progress={progressModal}
          onClose={() => setProgressModal(null)}
        />
      )}

      {/* Pagination controls (moved to bottom) */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <span>
              Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} de {total}
            </span>
          ) : (
            <span>No hay usuarios</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button disabled={page <= 1 || loading} variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <div className="text-sm">
            Página {page} / {totalPages}
          </div>
          <Button disabled={page >= totalPages || loading} variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Siguiente
          </Button>
        </div>
      </div>

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invitar Alumno</DialogTitle>
            <DialogDescription>
              Ingresa los datos del alumno que deseas invitar a la plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-name" className="text-sm font-medium">
                Nombre
              </label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nombre del alumno"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-code" className="text-sm font-medium">
                Código de Invitación
              </label>
              <Input
                id="invite-code"
                value={inviteCode}
                readOnly
                disabled
                className="font-mono text-lg tracking-wider bg-muted"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} disabled={inviteSending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendInvitation}
              disabled={inviteSending || !inviteName.trim() || !inviteEmail.trim()}
              className={inviteSending || !inviteName.trim() || !inviteEmail.trim() ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {inviteSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Invitación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* resend confirmation removed - resending shows a toast immediately */}

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
}