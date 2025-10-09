import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Edit, Trash2, Eye, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

interface VocabularyWord {
  id: string;
  word: string;
  definition: string;
  partOfSpeech: string;
}

interface ConversationTopic {
  id: string;
  titulo: string;
  promptSistema: string;
  nivel: string;
  vocabulario: VocabularyWord[];
  activo: boolean;
}

interface ConversationLog {
  id: string;
  usuario: string;
  tema: string;
  nivel: string;
  fecha: Date;
  puntuaciones: {
    gramatica: number;
    fluidez: number;
    ortografia: number;
  };
  puntuacionFinal: number;
  transcript: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  feedbackFinal: string;
}

const mockTopics: ConversationTopic[] = [
  {
    id: "1",
    titulo: "Presentaciones Personales",
    promptSistema: "Eres un tutor de inglés que ayuda a los estudiantes a practicar presentaciones personales. Mantén una conversación natural y haz preguntas de seguimiento sobre información personal básica.",
    nivel: "A1",
    vocabulario: [
      { id: "1", word: "name", definition: "nombre", partOfSpeech: "noun" },
      { id: "2", word: "age", definition: "edad", partOfSpeech: "noun" },
    ],
    activo: true
  },
  {
    id: "2",
    titulo: "Trabajo y Profesiones",
    promptSistema: "Guía una conversación sobre trabajos y profesiones. Ayuda al estudiante a practicar vocabulario relacionado con el trabajo y a describir responsabilidades laborales.",
    nivel: "B1",
    vocabulario: [
      { id: "3", word: "job", definition: "trabajo", partOfSpeech: "noun" },
      { id: "4", word: "responsibility", definition: "responsabilidad", partOfSpeech: "noun" },
    ],
    activo: true
  }
];

const mockLogs: ConversationLog[] = [
  {
    id: "1",
    usuario: "María García",
    tema: "Presentaciones Personales",
    nivel: "A1",
    fecha: new Date(2024, 0, 15),
    puntuaciones: {
      gramatica: 82,
      fluidez: 88,
      ortografia: 85
    },
    puntuacionFinal: 85,
    transcript: [
      { role: 'assistant', content: 'Hello! Please introduce yourself.', timestamp: new Date(2024, 0, 15, 10, 0) },
      { role: 'user', content: 'Hi, my name is Maria and I am 25 years old.', timestamp: new Date(2024, 0, 15, 10, 1) },
      { role: 'assistant', content: 'Nice to meet you, Maria! Where are you from?', timestamp: new Date(2024, 0, 15, 10, 2) },
    ],
    feedbackFinal: "Excelente trabajo en la pronunciación y gramática básica. Considera practicar más vocabulario descriptivo."
  },
  {
    id: "2",
    usuario: "Carlos López",
    tema: "Trabajo y Profesiones",
    nivel: "B1",
    fecha: new Date(2024, 0, 20),
    puntuaciones: {
      gramatica: 65,
      fluidez: 78,
      ortografia: 74
    },
    puntuacionFinal: 72,
    transcript: [
      { role: 'assistant', content: 'What do you do for work?', timestamp: new Date(2024, 0, 20, 14, 0) },
      { role: 'user', content: 'I work as teacher in elementary school.', timestamp: new Date(2024, 0, 20, 14, 1) },
    ],
    feedbackFinal: "Buen vocabulario profesional. Trabaja en el uso correcto de artículos (a/an/the)."
  }
];

const ConversationManagement = () => {
  const [topics, setTopics] = useState<ConversationTopic[]>(mockTopics);
  const [logs] = useState<ConversationLog[]>(mockLogs);
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [selectedLog, setSelectedLog] = useState<ConversationLog | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ConversationTopic | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [userFilter, setUserFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => {} });
  const { toast } = useToast();

  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const partsOfSpeech = ["noun", "verb", "adjective", "adverb", "preposition", "conjunction"];

  const handleCreateTopic = () => {
    setEditingTopic({
      id: "",
      titulo: "",
      promptSistema: "",
      nivel: "A1",
      vocabulario: [],
      activo: true
    });
    setIsTopicModalOpen(true);
  };

  const handleEditTopic = (topic: ConversationTopic) => {
    setEditingTopic({ ...topic });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = () => {
    if (!editingTopic) return;

    if (editingTopic.id) {
      setTopics(topics.map(t => t.id === editingTopic.id ? editingTopic : t));
      toast({ title: "Tema actualizado", description: "El tema ha sido actualizado correctamente." });
    } else {
      const newTopic = { ...editingTopic, id: Date.now().toString() };
      setTopics([...topics, newTopic]);
      toast({ title: "Tema creado", description: "El tema ha sido creado correctamente." });
    }

    setIsTopicModalOpen(false);
    setEditingTopic(null);
  };

  const handleDeleteTopic = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setTopics(topics.filter(t => t.id !== id));
        toast({ title: "Tema eliminado", description: "El tema ha sido eliminado correctamente." });
      },
    });
  };

  const handleToggleTopicStatus = (id: string) => {
    setTopics(topics.map(t => 
      t.id === id ? { ...t, activo: !t.activo } : t
    ));
  };

  const addVocabularyWord = () => {
    if (!editingTopic) return;
    const newWord: VocabularyWord = {
      id: Date.now().toString(),
      word: "",
      definition: "",
      partOfSpeech: "noun"
    };
    setEditingTopic({
      ...editingTopic,
      vocabulario: [...editingTopic.vocabulario, newWord]
    });
  };

  const updateVocabularyWord = (index: number, field: keyof VocabularyWord, value: string) => {
    if (!editingTopic) return;
    const updatedVocabulary = editingTopic.vocabulario.map((word, i) => 
      i === index ? { ...word, [field]: value } : word
    );
    setEditingTopic({ ...editingTopic, vocabulario: updatedVocabulary });
  };

  const removeVocabularyWord = (index: number) => {
    if (!editingTopic) return;
    setEditingTopic({
      ...editingTopic,
      vocabulario: editingTopic.vocabulario.filter((_, i) => i !== index)
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesUser = !userFilter || log.usuario.toLowerCase().includes(userFilter.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.nivel === levelFilter;
    const matchesDate = !dateFilter || format(log.fecha, 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');
    return matchesUser && matchesLevel && matchesDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Conversaciones con IA</h1>
      </div>

      <Tabs defaultValue="topics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="topics">Temas de Conversación</TabsTrigger>
          <TabsTrigger value="logs">Logs de Conversaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Temas de Conversación</h2>
            <Button onClick={handleCreateTopic}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Tema
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Card key={topic.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{topic.titulo}</CardTitle>
                      <CardDescription>
                        <Badge variant="secondary">{topic.nivel}</Badge>
                      </CardDescription>
                    </div>
                    <Switch
                      checked={topic.activo}
                      onCheckedChange={() => handleToggleTopicStatus(topic.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {topic.promptSistema}
                  </p>
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Vocabulario ({topic.vocabulario.length} palabras)</p>
                    <div className="flex flex-wrap gap-1">
                      {topic.vocabulario.slice(0, 3).map((word) => (
                        <Badge key={word.id} variant="outline" className="text-xs">
                          {word.word}
                        </Badge>
                      ))}
                      {topic.vocabulario.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{topic.vocabulario.length - 3} más
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditTopic(topic)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteTopic(topic.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Logs de Conversaciones</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label htmlFor="user-filter">Usuario</Label>
                  <Input
                    id="user-filter"
                    placeholder="Buscar por usuario..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="level-filter">Nivel</Label>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      {levels.map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter ? format(dateFilter, "PPP", { locale: es }) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFilter}
                        onSelect={setDateFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => {
                    setUserFilter("");
                    setLevelFilter("all");
                    setDateFilter(undefined);
                  }}>
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tema de Conversación</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Puntuación Final</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.usuario}</TableCell>
                      <TableCell>{log.tema}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.nivel}</Badge>
                      </TableCell>
                      <TableCell>{format(log.fecha, "PPP", { locale: es })}</TableCell>
                      <TableCell>
                        <Badge variant={log.puntuacionFinal >= 80 ? "default" : log.puntuacionFinal >= 60 ? "secondary" : "destructive"}>
                          {log.puntuacionFinal}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setIsLogModalOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Topic Modal */}
      <Dialog open={isTopicModalOpen} onOpenChange={setIsTopicModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTopic?.id ? "Editar Tema" : "Nuevo Tema"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título del Tema</Label>
              <Input
                id="titulo"
                value={editingTopic?.titulo || ""}
                onChange={(e) => setEditingTopic(prev => prev ? { ...prev, titulo: e.target.value } : null)}
              />
            </div>
            <div>
              <Label htmlFor="nivel">Nivel Asociado</Label>
              <Select
                value={editingTopic?.nivel}
                onValueChange={(value) => setEditingTopic(prev => prev ? { ...prev, nivel: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="prompt">Prompt del Sistema para la IA</Label>
              <Textarea
                id="prompt"
                rows={6}
                value={editingTopic?.promptSistema || ""}
                onChange={(e) => setEditingTopic(prev => prev ? { ...prev, promptSistema: e.target.value } : null)}
                placeholder="Describe cómo debe comportarse la IA en esta conversación..."
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Palabras de Vocabulario Clave</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVocabularyWord}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Palabra
                </Button>
              </div>
              <div className="space-y-3">
                {editingTopic?.vocabulario.map((word, index) => (
                  <div key={word.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Label>Palabra</Label>
                      <Input
                        value={word.word}
                        onChange={(e) => updateVocabularyWord(index, 'word', e.target.value)}
                        placeholder="Palabra en inglés"
                      />
                    </div>
                    <div className="col-span-4">
                      <Label>Definición</Label>
                      <Input
                        value={word.definition}
                        onChange={(e) => updateVocabularyWord(index, 'definition', e.target.value)}
                        placeholder="Definición en español"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Parte del discurso</Label>
                      <Select
                        value={word.partOfSpeech}
                        onValueChange={(value) => updateVocabularyWord(index, 'partOfSpeech', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {partsOfSpeech.map((pos) => (
                            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeVocabularyWord(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsTopicModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTopic}>
                {editingTopic?.id ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversation Log Modal */}
      <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalle de Conversación</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Usuario</Label>
                  <p className="font-medium">{selectedLog.usuario}</p>
                </div>
                <div>
                  <Label>Tema</Label>
                  <p className="font-medium">{selectedLog.tema}</p>
                </div>
                <div>
                  <Label>Nivel</Label>
                  <Badge variant="secondary">{selectedLog.nivel}</Badge>
                </div>
                <div>
                  <Label>Fecha</Label>
                  <p className="font-medium">{format(selectedLog.fecha, "PPP", { locale: es })}</p>
                </div>
              </div>
              
              <div>
                <Label>Puntuaciones Detalladas</Label>
                <div className="grid gap-4 md:grid-cols-4 mt-2">
                  <div>
                    <Label className="text-sm text-muted-foreground">Gramática</Label>
                    <Badge variant={selectedLog.puntuaciones.gramatica >= 80 ? "default" : selectedLog.puntuaciones.gramatica >= 60 ? "secondary" : "destructive"}>
                      {selectedLog.puntuaciones.gramatica}%
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fluidez</Label>
                    <Badge variant={selectedLog.puntuaciones.fluidez >= 80 ? "default" : selectedLog.puntuaciones.fluidez >= 60 ? "secondary" : "destructive"}>
                      {selectedLog.puntuaciones.fluidez}%
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Ortografía</Label>
                    <Badge variant={selectedLog.puntuaciones.ortografia >= 80 ? "default" : selectedLog.puntuaciones.ortografia >= 60 ? "secondary" : "destructive"}>
                      {selectedLog.puntuaciones.ortografia}%
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Puntuación Final</Label>
                    <Badge variant={selectedLog.puntuacionFinal >= 80 ? "default" : selectedLog.puntuacionFinal >= 60 ? "secondary" : "destructive"}>
                      {selectedLog.puntuacionFinal}%
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Transcripción de la Conversación</Label>
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
                  {selectedLog.transcript.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {format(message.timestamp, "HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>Feedback Final</Label>
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <p className="text-sm">{selectedLog.feedbackFinal}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
};

export default ConversationManagement;