import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StudentDetailModalProps {
  student: {
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
  };
  onClose: () => void;
}

export default function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil del Alumno</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{student.nombre}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Correo</p>
                <p className="font-medium">{student.correo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{student.empresa}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nivel Actual</p>
                <Badge className="mt-1">{student.nivelActual}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progreso de Aprendizaje</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Puntos Acumulados</p>
                <p className="text-2xl font-bold text-primary">{student.puntosAcumulados}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiempo Dedicado</p>
                <p className="text-2xl font-bold text-accent">{student.tiempoDedicado}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Última Lección Aprendida</p>
                <p className="font-medium">{student.ultimaLeccion}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tests Realizados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Test</TableHead>
                    <TableHead className="text-right">Calificación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.testsRealizados.map((test, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{test.nombre}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={test.calificacion >= 80 ? "default" : "secondary"}>
                          {test.calificacion}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logros Obtenidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {student.logros.map((logro, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {logro}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
