import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Users, UserPlus, BookOpen, Clock, Download, Eye } from "lucide-react";
import StudentDetailModal from "./StudentDetailModal";
const kpiData = [{
  title: "Usuarios Activos Hoy",
  value: "247",
  icon: Users,
  color: "text-primary"
}, {
  title: "Nuevos Registros (7 días)",
  value: "64",
  icon: UserPlus,
  color: "text-accent"
}, {
  title: "Lecciones Completadas Hoy",
  value: "1,429",
  icon: BookOpen,
  color: "text-success"
}, {
  title: "Tiempo Promedio de Sesión",
  value: "24 min",
  icon: Clock,
  color: "text-warning"
}];

interface Student {
  id: string;
  nombre: string;
  nivelActual: string;
  empresa: string;
  ultimaLeccion: string;
  puntosAcumulados: number;
  tiempoDedicado: string;
  correo: string;
  testsRealizados: { nombre: string; calificacion: number }[];
  logros: string[];
}

const mockStudents: Student[] = [
  {
    id: "1",
    nombre: "Juan Pérez",
    nivelActual: "A2",
    empresa: "Tech Solutions",
    ultimaLeccion: "Presente Simple",
    puntosAcumulados: 450,
    tiempoDedicado: "24h 30min",
    correo: "juan.perez@techsolutions.com",
    testsRealizados: [
      { nombre: "Test A1", calificacion: 85 },
      { nombre: "Test A2", calificacion: 78 }
    ],
    logros: ["Primera Lección Completada", "Racha de 7 días", "100 Puntos Acumulados"]
  },
  {
    id: "2",
    nombre: "María García",
    nivelActual: "B1",
    empresa: "Global Corp",
    ultimaLeccion: "Past Continuous",
    puntosAcumulados: 680,
    tiempoDedicado: "35h 15min",
    correo: "maria.garcia@globalcorp.com",
    testsRealizados: [
      { nombre: "Test A2", calificacion: 92 },
      { nombre: "Test B1", calificacion: 88 }
    ],
    logros: ["Racha de 30 días", "500 Puntos Acumulados", "10 Lecciones Completadas"]
  },
  {
    id: "3",
    nombre: "Carlos Rodríguez",
    nivelActual: "A1",
    empresa: "Tech Solutions",
    ultimaLeccion: "Saludos Básicos",
    puntosAcumulados: 120,
    tiempoDedicado: "8h 45min",
    correo: "carlos.rodriguez@techsolutions.com",
    testsRealizados: [
      { nombre: "Test A1", calificacion: 65 }
    ],
    logros: ["Primera Lección Completada"]
  },
  {
    id: "4",
    nombre: "Ana Martínez",
    nivelActual: "B2",
    empresa: "Innovation Labs",
    ultimaLeccion: "Conditional Sentences",
    puntosAcumulados: 920,
    tiempoDedicado: "52h 20min",
    correo: "ana.martinez@innovationlabs.com",
    testsRealizados: [
      { nombre: "Test B1", calificacion: 95 },
      { nombre: "Test B2", calificacion: 90 }
    ],
    logros: ["Racha de 60 días", "1000 Puntos Acumulados", "25 Lecciones Completadas", "Experto en Gramática"]
  }
];

export default function Dashboard() {
  const [nameFilter, setNameFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const itemsPerPage = 5;

  const filteredStudents = mockStudents.filter(student => {
    const matchesName = student.nombre.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesLevel = levelFilter === "all" || student.nivelActual === levelFilter;
    const matchesCompany = student.empresa.toLowerCase().includes(companyFilter.toLowerCase());
    return matchesName && matchesLevel && matchesCompany;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

  const handleExportCSV = () => {
    const headers = ["Nombre", "Nivel Actual", "Empresa", "Última Lección", "Puntos Acumulados", "Tiempo Dedicado"];
    const csvContent = [
      headers.join(","),
      ...filteredStudents.map(s => 
        `"${s.nombre}","${s.nivelActual}","${s.empresa}","${s.ultimaLeccion}",${s.puntosAcumulados},"${s.tiempoDedicado}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "desempeno_alumnos.csv";
    link.click();
  };

  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Panel de Control</h1>
        <p className="text-muted-foreground">Bienvenido al panel de administración de TrueEnglish Academy</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => <Card key={index} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>)}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Estadísticas de Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Nivel A1</span>
                  <span>45%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{
                  width: '45%'
                }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Nivel B1</span>
                  <span>30%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{
                  width: '30%'
                }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Desempeño de Alumnos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nombre..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por nivel" />
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
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por empresa..."
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              />
            </div>
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Nivel Actual</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Última Lección</TableHead>
                <TableHead>Puntos</TableHead>
                <TableHead>Tiempo Dedicado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.nombre}</TableCell>
                  <TableCell>{student.nivelActual}</TableCell>
                  <TableCell>{student.empresa}</TableCell>
                  <TableCell>{student.ultimaLeccion}</TableCell>
                  <TableCell>{student.puntosAcumulados}</TableCell>
                  <TableCell>{student.tiempoDedicado}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver más
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>;
}