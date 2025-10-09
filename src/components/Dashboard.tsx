import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, BookOpen, Clock } from "lucide-react";
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
export default function Dashboard() {
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
    </div>;
}