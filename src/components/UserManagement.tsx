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
  Check,
  X
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
import UserFormModal from "./UserFormModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [total, setTotal] = useState(0);

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
          nivelActual: p['nivel_actual'] ? String(p['nivel_actual']) : null,
          fechaRegistro: p['created_at'] ? String(p['created_at']) : null,
          estado: p['status'] ? String(p['status']) : null,
          tipoUsuario: p['tipo'] ? String(p['tipo']) : null,
          codigoInvitacion: p['code'] ? String(p['code']) : null,
        }));
        setUsers(mapped);
        setTotal(typeof count === 'number' ? count : mapped.length);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
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
        // Delete profile row in Supabase
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        setUsers(users.filter(u => u.id !== userId));
        toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
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
    // Map form data to DB columns
    const payload = {
      email: userData.email,
      name: userData.nombre,
      last_name: userData.apellido,
      phone: userData.celular ?? null,
      birth_date: userData.fechaNacimiento ?? null,
      nivel_actual: userData.nivelActual ?? null,
      status: userData.estado ?? 'activo',
      tipo: userData.tipoUsuario ?? 'Alumno',
      code: userData.codigoInvitacion ?? null,
    };

    if (editingUser) {
      // Update profile row
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Usuario actualizado', description: 'Los datos del usuario han sido actualizados correctamente.' });
        await fetchUsers();
      }
    } else {
      // Creating new user: create auth user then insert profile
      try {
        const password = String(userData.password ?? '');
        if (!password) {
          toast({ title: 'Error', description: 'La contraseña es requerida para crear un usuario.', variant: 'destructive' });
          return;
        }
        const { data: signData, error: signError } = await supabase.auth.signUp({ email: String(userData.email ?? ''), password });
        if (signError) {
          toast({ title: 'Error creando usuario', description: signError.message, variant: 'destructive' });
          return;
        }
        const signObj = signData as { user?: { id?: string } } | undefined;
        const userId = signObj?.user?.id;
        if (!userId) {
          toast({ title: 'Error', description: 'No se pudo obtener el id del usuario creado.', variant: 'destructive' });
          return;
        }
        const insertObj = { id: userId, ...payload };
        // Use upsert to avoid duplicate-key errors if a profile already exists for this id
        const { error: insertError } = await supabase.from('profiles').upsert(insertObj, { onConflict: 'id' });
        if (insertError) {
          toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
          return;
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

  // fetch invited students on mount
  useEffect(() => {
    fetchInvitedStudents();
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

  const handleInviteUser = () => {
    setInviteEmail("");
    setInviteName("");
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setInviteCode(code);
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
        nivelActual: p['nivel_actual'] ? String(p['nivel_actual']) : null,
        fechaRegistro: p['created_at'] ? String(p['created_at']) : null,
        estado: p['status'] ? String(p['status']) : null,
        tipoUsuario: p['tipo'] ? String(p['tipo']) : null,
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

    const insertObj = {
      name: inviteName,
      email: inviteEmail,
      code: inviteCode,
      tipo: 'Alumno',
      status: 'invitado',
    };

    // insert into `invitations` table (create this table in Supabase)
    const { error } = await supabase.from('invitations').insert(insertObj);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setIsInviteModalOpen(false);
    setInviteEmail('');
    setInviteName('');
    setInviteCode('');
    toast({ title: 'Invitación enviada', description: 'La invitación ha sido guardada.' });
    await fetchInvitedStudents();
  };

  const handleResendInvitation = (studentId: string) => {
    // For now we just show a toast - real email sending requires backend
    toast({ title: 'Email reenviado', description: 'La invitación ha sido reenviada.' });
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
          <Button onClick={handleInviteUser} variant="outline" className="bg-secondary hover:bg-secondary/80">
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
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Reenviar Email
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo de Usuario</TableHead>
                <TableHead>Nivel Actual</TableHead>
                <TableHead>Fecha de Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nombre}</TableCell>
                  <TableCell>{user.apellido}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.tipoUsuario === 'Alumno' ? 'default' : 'outline'}>
                      {user.tipoUsuario}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={levelColors[user.nivelActual as keyof typeof levelColors]}>
                      {user.nivelActual}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(user.fechaRegistro, "dd/MM/yyyy")}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        user={editingUser}
      />

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
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendInvitation}>
              Enviar Invitación
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