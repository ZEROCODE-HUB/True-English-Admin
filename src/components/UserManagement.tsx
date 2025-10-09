import { useState } from "react";
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

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  fechaNacimiento: Date;
  intereses: string[];
  nivelActual: string;
  fechaRegistro: Date;
  estado: 'activo' | 'inactivo';
  tipoUsuario: 'Alumno' | 'Externo';
  codigoInvitacion?: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  nombre: string;
  codigoInvitacion: string;
  fechaInvitacion: Date;
}

const mockUsers: User[] = [
  {
    id: "1",
    nombre: "María",
    apellido: "García",
    email: "maria.garcia@email.com",
    celular: "+34 666 123 456",
    fechaNacimiento: new Date("1990-05-15"),
    intereses: ["Conversación", "Gramática", "Vocabulario"],
    nivelActual: "B1",
    fechaRegistro: new Date("2024-01-15"),
    estado: "activo",
    tipoUsuario: "Alumno",
    codigoInvitacion: "123456"
  },
  {
    id: "2",
    nombre: "Carlos",
    apellido: "López",
    email: "carlos.lopez@email.com",
    celular: "+34 666 789 012",
    fechaNacimiento: new Date("1985-08-22"),
    intereses: ["Pronunciación", "Escucha"],
    nivelActual: "A2",
    fechaRegistro: new Date("2024-02-10"),
    estado: "activo",
    tipoUsuario: "Alumno",
    codigoInvitacion: "789012"
  },
  {
    id: "3",
    nombre: "Ana",
    apellido: "Martínez",
    email: "ana.martinez@email.com",
    celular: "+34 666 345 678",
    fechaNacimiento: new Date("1992-12-03"),
    intereses: ["Conversación", "Cultura"],
    nivelActual: "C1",
    fechaRegistro: new Date("2023-11-20"),
    estado: "inactivo",
    tipoUsuario: "Externo",
    codigoInvitacion: "345678"
  }
];

const levelColors = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800", 
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800"
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => {} });
  const { toast } = useToast();

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = filterLevel === "all" || user.nivelActual === filterLevel;
    const matchesStatus = filterStatus === "all" || user.estado === filterStatus;

    return matchesSearch && matchesLevel && matchesStatus;
  });

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
      onConfirm: () => {
        setUsers(users.filter(u => u.id !== userId));
        toast({
          title: "Usuario eliminado",
          description: "El usuario ha sido eliminado correctamente.",
        });
      },
    });
  };

  const handleToggleStatus = (userId: string) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, estado: user.estado === 'activo' ? 'inactivo' : 'activo' }
        : user
    ));
    toast({
      title: "Estado actualizado",
      description: "El estado del usuario ha sido actualizado.",
    });
  };

  const handleSaveUser = (userData: Omit<User, 'id' | 'fechaRegistro'>) => {
    if (editingUser) {
      // Update existing user
      setUsers(users.map(user => 
        user.id === editingUser.id 
          ? { ...userData, id: editingUser.id, fechaRegistro: editingUser.fechaRegistro }
          : user
      ));
      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario han sido actualizados correctamente.",
      });
    } else {
      // Create new user
      const newUser: User = {
        ...userData,
        id: Date.now().toString(),
        fechaRegistro: new Date()
      };
      setUsers([...users, newUser]);
      toast({
        title: "Usuario creado",
        description: "El nuevo usuario ha sido creado correctamente.",
      });
    }
    setIsModalOpen(false);
  };

  const handleInviteUser = () => {
    setInviteEmail("");
    setInviteName("");
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setInviteCode(code);
    setIsInviteModalOpen(true);
  };

  const handleSendInvitation = () => {
    if (!inviteEmail || !inviteName) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos.",
        variant: "destructive",
      });
      return;
    }

    const newInvitation: PendingInvitation = {
      id: Date.now().toString(),
      email: inviteEmail,
      nombre: inviteName,
      codigoInvitacion: inviteCode,
      fechaInvitacion: new Date()
    };

    setPendingInvitations([...pendingInvitations, newInvitation]);
    setIsInviteModalOpen(false);
    toast({
      title: "Invitación enviada",
      description: "La invitación ha sido enviada correctamente.",
    });
  };

  const handleResendInvitation = (invitationId: string) => {
    setSelectedInvitationId(invitationId);
    setResendConfirmOpen(true);
  };

  const handleConfirmResend = () => {
    if (!selectedInvitationId) return;
    
    toast({
      title: "Email reenviado",
      description: "La invitación ha sido reenviada correctamente.",
    });
    setResendConfirmOpen(false);
    setSelectedInvitationId(null);
  };

  const handleDeleteInvitation = (invitationId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setPendingInvitations(pendingInvitations.filter(inv => inv.id !== invitationId));
        toast({
          title: "Invitación eliminada",
          description: "La invitación ha sido eliminada.",
        });
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

      {pendingInvitations.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Invitaciones Pendientes ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
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
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.nombre}</TableCell>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {invitation.codigoInvitacion}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation.id)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Reenviar Email
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteInvitation(invitation.id)}
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

      <Dialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar reenvío</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas reenviar la invitación a este usuario?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmResend}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
}