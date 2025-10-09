import { useState } from "react";
import { Plus, Edit, Trash2, Search, ToggleLeft, ToggleRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OnboardingQuizModal from "./OnboardingQuizModal";
import LessonQuizModal from "./LessonQuizModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
export interface OnboardingQuestion {
  id: string;
  pregunta: string;
  opcion1: string;
  opcion2: string;
  opcion3: string;
  opcion4: string;
  respuestaCorrecta: number; // 1-4
  incluirEnTest: boolean;
}
export interface Lesson {
  id: string;
  titulo: string;
  nivel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
}
export interface LevelQuestion {
  id: string;
  nivel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  pregunta: string;
  opcion1: string;
  opcion2: string;
  opcion3: string;
  opcion4: string;
  respuestaCorrecta: number; // 1-4
  incluirEnTest: boolean;
}
export interface LessonQuestion {
  id: string;
  lessonId: string;
  lessonTitle: string;
  tipo: "quizz-leccion" | "desafio-semanal";
  pregunta: string;
  opciones: string[];
  respuestaCorrecta: number;
  activa: boolean;
}

export interface Challenge {
  id: string;
  titulo: string;
  nivel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  lessonId: string;
  lessonTitle: string;
  activo: boolean;
}

export interface ChallengeQuestion {
  id: string;
  challengeId: string;
  pregunta: string;
  imagen?: string;
  audio?: string;
  opciones: string[];
  respuestaCorrecta: number;
  activa: boolean;
}
const mockOnboardingQuestions: OnboardingQuestion[] = [{
  id: "1",
  pregunta: "What is the correct form of the verb 'to be' for 'I'?",
  opcion1: "am",
  opcion2: "is",
  opcion3: "are",
  opcion4: "be",
  respuestaCorrecta: 1,
  incluirEnTest: true
}, {
  id: "2",
  pregunta: "Which sentence is correct?",
  opcion1: "She go to school",
  opcion2: "She goes to school",
  opcion3: "She going to school",
  opcion4: "She goed to school",
  respuestaCorrecta: 2,
  incluirEnTest: false
}];
const mockLevelQuestions: LevelQuestion[] = [{
  id: "1",
  nivel: "A1",
  pregunta: "Select the correct article: 'This is ___ apple'",
  opcion1: "a",
  opcion2: "an",
  opcion3: "the",
  opcion4: "no article",
  respuestaCorrecta: 2,
  incluirEnTest: true
}, {
  id: "2",
  nivel: "A1",
  pregunta: "What is the plural of 'child'?",
  opcion1: "childs",
  opcion2: "childes",
  opcion3: "children",
  opcion4: "child",
  respuestaCorrecta: 3,
  incluirEnTest: true
}, {
  id: "3",
  nivel: "A2",
  pregunta: "Choose the correct past tense: 'Yesterday I ___ to the store'",
  opcion1: "go",
  opcion2: "went",
  opcion3: "going",
  opcion4: "gone",
  respuestaCorrecta: 2,
  incluirEnTest: false
}, {
  id: "4",
  nivel: "B1",
  pregunta: "Complete with the correct modal: 'You ___ study harder for the exam'",
  opcion1: "can",
  opcion2: "should",
  opcion3: "will",
  opcion4: "might",
  respuestaCorrecta: 2,
  incluirEnTest: true
}, {
  id: "5",
  nivel: "B2",
  pregunta: "Choose the correct conditional: 'If I ___ you, I would take that job'",
  opcion1: "am",
  opcion2: "was",
  opcion3: "were",
  opcion4: "would be",
  respuestaCorrecta: 3,
  incluirEnTest: true
}, {
  id: "6",
  nivel: "C1",
  pregunta: "Select the most appropriate word: 'The evidence was ___'",
  opcion1: "compelling",
  opcion2: "good",
  opcion3: "nice",
  opcion4: "interesting",
  respuestaCorrecta: 1,
  incluirEnTest: false
}];
const mockLessons: Lesson[] = [{
  id: "1",
  titulo: "Presente Simple",
  nivel: "A1"
}, {
  id: "2",
  titulo: "Past Continuous",
  nivel: "A2"
}, {
  id: "3",
  titulo: "Future Perfect",
  nivel: "B1"
}, {
  id: "4",
  titulo: "Conditionals",
  nivel: "B2"
}, {
  id: "5",
  titulo: "Subjunctive Mood",
  nivel: "C1"
}];
const mockLessonQuestions: LessonQuestion[] = [{
  id: "1",
  lessonId: "1",
  lessonTitle: "Presente Simple",
  tipo: "quizz-leccion",
  pregunta: "Complete: 'She _____ English every day'",
  opciones: ["speak", "speaks", "speaking", "spoke"],
  respuestaCorrecta: 2,
  activa: true
}, {
  id: "2",
  lessonId: "1",
  lessonTitle: "Presente Simple",
  tipo: "desafio-semanal",
  pregunta: "What were you doing yesterday at 3 PM?",
  opciones: ["I was studying", "I am studying", "I study", "I will study"],
  respuestaCorrecta: 1,
  activa: true
}, {
  id: "3",
  lessonId: "2",
  lessonTitle: "Past Continuous",
  tipo: "quizz-leccion",
  pregunta: "Choose the correct form: 'While I _____, the phone rang'",
  opciones: ["was reading", "am reading", "read", "have read"],
  respuestaCorrecta: 1,
  activa: true
}];

const mockChallenges: Challenge[] = [
  {
    id: "1",
    titulo: "Desafío de Verbos Irregulares",
    nivel: "A2",
    lessonId: "2",
    lessonTitle: "Past Continuous",
    activo: true
  },
  {
    id: "2",
    titulo: "Desafío de Condicionales",
    nivel: "B2",
    lessonId: "4",
    lessonTitle: "Conditionals",
    activo: false
  }
];

const mockChallengeQuestions: ChallengeQuestion[] = [
  {
    id: "1",
    challengeId: "1",
    pregunta: "What is the past tense of 'go'?",
    opciones: ["goed", "went", "gone", "going"],
    respuestaCorrecta: 2,
    activa: true
  },
  {
    id: "2",
    challengeId: "1",
    pregunta: "Select the correct past form: 'eat'",
    imagen: "https://example.com/eat.jpg",
    opciones: ["eated", "ate", "eaten", "eating"],
    respuestaCorrecta: 2,
    activa: true
  },
  {
    id: "3",
    challengeId: "2",
    pregunta: "Complete: If I ___ rich, I would travel the world",
    audio: "https://example.com/audio.mp3",
    opciones: ["am", "was", "were", "would be"],
    respuestaCorrecta: 3,
    activa: false
  }
];
export default function QuizManagement() {
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>(mockOnboardingQuestions);
  const [levelQuestions, setLevelQuestions] = useState<LevelQuestion[]>(mockLevelQuestions);
  const [lessonQuestions, setLessonQuestions] = useState<LessonQuestion[]>(mockLessonQuestions);
  const [challenges, setChallenges] = useState<Challenge[]>(mockChallenges);
  const [challengeQuestions, setChallengeQuestions] = useState<ChallengeQuestion[]>(mockChallengeQuestions);
  const [lessons] = useState<Lesson[]>(mockLessons);

  // Level selection state
  const [selectedLevel, setSelectedLevel] = useState<"A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null>(null);

  // Lesson selection state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonSearchTerm, setLessonSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  
  // Challenge state
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeSearchTerm, setChallengeSearchTerm] = useState("");
  const [challengeLevelFilter, setChallengeLevelFilter] = useState("all");
  
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingOnboardingQuestion, setEditingOnboardingQuestion] = useState<OnboardingQuestion | null>(null);
  const [editingLevelQuestion, setEditingLevelQuestion] = useState<LevelQuestion | null>(null);
  const [editingLessonQuestion, setEditingLessonQuestion] = useState<LessonQuestion | null>(null);
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
    title?: string;
    description?: string;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });
  
  const {
    toast
  } = useToast();
  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.titulo.toLowerCase().includes(lessonSearchTerm.toLowerCase());
    const matchesLevel = levelFilter === "all" || lesson.nivel === levelFilter;
    return matchesSearch && matchesLevel;
  });
  
  const filteredChallenges = challenges.filter(challenge => {
    const matchesSearch = challenge.titulo.toLowerCase().includes(challengeSearchTerm.toLowerCase());
    const matchesLevel = challengeLevelFilter === "all" || challenge.nivel === challengeLevelFilter;
    return matchesSearch && matchesLevel;
  });
  
  const selectedLessonQuestions = selectedLesson ? lessonQuestions.filter(q => q.lessonId === selectedLesson.id) : [];
  const selectedLevelQuestions = selectedLevel ? levelQuestions.filter(q => q.nivel === selectedLevel) : [];
  const selectedChallengeQuestions = selectedChallenge ? challengeQuestions.filter(q => q.challengeId === selectedChallenge.id) : [];
  const quizLeccionQuestions = selectedLessonQuestions.filter(q => q.tipo === "quizz-leccion");
  const desafioQuestions = selectedLessonQuestions.filter(q => q.tipo === "desafio-semanal");
  const levels: Array<"A1" | "A2" | "B1" | "B2" | "C1" | "C2"> = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const handleToggleOnboardingQuestion = (questionId: string) => {
    setOnboardingQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      incluirEnTest: !q.incluirEnTest
    } : q));
    toast({
      title: "Estado actualizado",
      description: "El estado de inclusión en el test ha sido actualizado."
    });
  };
  const handleToggleLevelQuestion = (questionId: string) => {
    setLevelQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      incluirEnTest: !q.incluirEnTest
    } : q));
    toast({
      title: "Estado actualizado",
      description: "El estado de inclusión en el test ha sido actualizado."
    });
  };
  const handleToggleLessonQuestion = (questionId: string) => {
    setLessonQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      activa: !q.activa
    } : q));
    toast({
      title: "Estado actualizado",
      description: "El estado de la pregunta ha sido actualizado."
    });
  };
  
  const handleToggleChallenge = (challengeId: string) => {
    setChallenges(prev => prev.map(c => c.id === challengeId ? {
      ...c,
      activo: !c.activo
    } : c));
    toast({
      title: "Estado actualizado",
      description: "El estado del desafío ha sido actualizado."
    });
  };
  
  const handleToggleChallengeQuestion = (questionId: string) => {
    setChallengeQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      activa: !q.activa
    } : q));
    toast({
      title: "Estado actualizado",
      description: "El estado de la pregunta ha sido actualizado."
    });
  };
  
  const handleDeleteOnboardingQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setOnboardingQuestions(prev => prev.filter(q => q.id !== questionId));
        toast({
          title: "Pregunta eliminada",
          description: "La pregunta ha sido eliminada correctamente."
        });
      },
    });
  };
  
  const handleDeleteLevelQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setLevelQuestions(prev => prev.filter(q => q.id !== questionId));
        toast({
          title: "Pregunta eliminada",
          description: "La pregunta ha sido eliminada correctamente."
        });
      },
    });
  };
  
  const handleDeleteLessonQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setLessonQuestions(prev => prev.filter(q => q.id !== questionId));
        toast({
          title: "Pregunta eliminada",
          description: "La pregunta ha sido eliminada correctamente."
        });
      },
    });
  };
  
  const handleDeleteChallenge = (challengeId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setChallenges(prev => prev.filter(c => c.id !== challengeId));
        setChallengeQuestions(prev => prev.filter(q => q.challengeId !== challengeId));
        toast({
          title: "Desafío eliminado",
          description: "El desafío y sus preguntas han sido eliminados correctamente."
        });
      },
    });
  };
  
  const handleDeleteChallengeQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        setChallengeQuestions(prev => prev.filter(q => q.id !== questionId));
        toast({
          title: "Pregunta eliminada",
          description: "La pregunta ha sido eliminada correctamente."
        });
      },
    });
  };
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestión de Quizzes</h1>
        <p className="text-muted-foreground">Administra las preguntas para todos los tipos de evaluaciones</p>
      </div>

      <Tabs defaultValue="onboarding" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="onboarding">Quiz de Onboarding</TabsTrigger>
          <TabsTrigger value="level">Quiz de Nivel</TabsTrigger>
          <TabsTrigger value="lessons">Quiz de Lección</TabsTrigger>
          <TabsTrigger value="challenges">Desafío</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Banco de Preguntas de Onboarding ({onboardingQuestions.length})</CardTitle>
              <Button onClick={() => {
              setEditingOnboardingQuestion(null);
              setIsOnboardingModalOpen(true);
            }} className="bg-primary hover:bg-primary-hover">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Pregunta
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pregunta</TableHead>
                    <TableHead>Respuesta Correcta</TableHead>
                    <TableHead>Incluir en Test</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingQuestions.map(question => <TableRow key={question.id}>
                      <TableCell className="max-w-md">
                        <div className="truncate">{question.pregunta}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          Opción {question.respuestaCorrecta}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleOnboardingQuestion(question.id)} className={question.incluirEnTest ? "text-success" : "text-muted-foreground"}>
                          {question.incluirEnTest ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                        setEditingOnboardingQuestion(question);
                        setIsOnboardingModalOpen(true);
                      }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteOnboardingQuestion(question.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="level" className="space-y-6">
          {!selectedLevel ?
        // Step 1: Level Selection
        <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Seleccionar Nivel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {levels.map(level => <Card key={level} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedLevel(level)}>
                      <CardContent className="p-6 text-center">
                        <h3 className="font-semibold text-2xl mb-2">{level}</h3>
                        <p className="text-sm text-muted-foreground">
                          {levelQuestions.filter(q => q.nivel === level).length} preguntas
                        </p>
                      </CardContent>
                    </Card>)}
                </div>
              </CardContent>
            </Card> :
        // Step 2: Question Management for Selected Level
        <>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Quiz de Nivel {selectedLevel}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gestionar preguntas para el nivel {selectedLevel}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedLevel(null)}>
                    Cambiar Nivel
                  </Button>
                </CardHeader>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Banco de Preguntas de Nivel {selectedLevel} ({selectedLevelQuestions.length})</CardTitle>
                  <Button onClick={() => {
                setEditingLevelQuestion(null);
                setIsLevelModalOpen(true);
              }} className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Pregunta
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pregunta</TableHead>
                        <TableHead>Respuesta Correcta</TableHead>
                        <TableHead>Incluir en Test</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLevelQuestions.map(question => <TableRow key={question.id}>
                          <TableCell className="max-w-md">
                            <div className="truncate">{question.pregunta}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Opción {question.respuestaCorrecta}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleLevelQuestion(question.id)} className={question.incluirEnTest ? "text-success" : "text-muted-foreground"}>
                              {question.incluirEnTest ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                          setEditingLevelQuestion(question);
                          setIsLevelModalOpen(true);
                        }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteLevelQuestion(question.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>)}
                      {selectedLevelQuestions.length === 0 && <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            No hay preguntas para este nivel
                          </TableCell>
                        </TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>}
        </TabsContent>

        <TabsContent value="lessons" className="space-y-6">
          {!selectedLesson ?
        // Step 1: Lesson Selection
        <>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Seleccionar Lección
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                      <Input placeholder="Buscar por nombre de lección..." value={lessonSearchTerm} onChange={e => setLessonSearchTerm(e.target.value)} />
                    </div>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                      <SelectTrigger className="w-[200px]">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLessons.map(lesson => <Card key={lesson.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedLesson(lesson)}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{lesson.titulo}</h3>
                            <Badge variant="outline">{lesson.nivel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {lessonQuestions.filter(q => q.lessonId === lesson.id).length} preguntas
                          </p>
                        </CardContent>
                      </Card>)}
                  </div>
                </CardContent>
              </Card>
            </> :
        // Step 2: Question Management by Type
        <>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedLesson.titulo}
                      <Badge variant="outline">{selectedLesson.nivel}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gestión de preguntas por tipo
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedLesson(null)}>
                    Cambiar Lección
                  </Button>
                </CardHeader>
              </Card>

              {/* Quiz de Lección Section */}
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Quiz de Lección ({quizLeccionQuestions.length})
                  </CardTitle>
                  <Button onClick={() => {
                setEditingLessonQuestion(null);
                setIsLessonModalOpen(true);
              }} className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Pregunta
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pregunta</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quizLeccionQuestions.map(question => <TableRow key={question.id}>
                          <TableCell className="max-w-md">
                            <div className="truncate">{question.pregunta}</div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleLessonQuestion(question.id)} className={question.activa ? "text-success" : "text-muted-foreground"}>
                              {question.activa ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                          setEditingLessonQuestion(question);
                          setIsLessonModalOpen(true);
                        }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteLessonQuestion(question.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>)}
                      {quizLeccionQuestions.length === 0 && <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                            No hay preguntas de quiz para esta lección
                          </TableCell>
                        </TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </>}
        </TabsContent>

        <TabsContent value="challenges" className="space-y-6">
          {!selectedChallenge ? (
            // Step 1: Challenge List
            <>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Desafíos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder="Buscar por nombre de desafío..."
                        value={challengeSearchTerm}
                        onChange={(e) => setChallengeSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={challengeLevelFilter} onValueChange={setChallengeLevelFilter}>
                      <SelectTrigger className="w-[200px]">
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
                    <Button className="bg-primary hover:bg-primary-hover">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Desafío
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Lección Asociada</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChallenges.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableCell className="font-medium">{challenge.titulo}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{challenge.nivel}</Badge>
                          </TableCell>
                          <TableCell>{challenge.lessonTitle}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleChallenge(challenge.id)}
                              className={challenge.activo ? "text-success" : "text-muted-foreground"}
                            >
                              {challenge.activo ? (
                                <ToggleRight className="w-5 h-5" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedChallenge(challenge)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteChallenge(challenge.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredChallenges.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            No se encontraron desafíos
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            // Step 2: Challenge Questions View
            <>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedChallenge.titulo}
                      <Badge variant="outline">{selectedChallenge.nivel}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Lección: {selectedChallenge.lessonTitle}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedChallenge(null)}>
                    Volver a Desafíos
                  </Button>
                </CardHeader>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    Preguntas del Desafío ({selectedChallengeQuestions.length})
                  </CardTitle>
                  <Button className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Pregunta
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pregunta</TableHead>
                        <TableHead>Recursos</TableHead>
                        <TableHead>Respuesta Correcta</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedChallengeQuestions.map((question) => (
                        <TableRow key={question.id}>
                          <TableCell className="max-w-md">
                            <div className="truncate">{question.pregunta}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {question.imagen && (
                                <Badge variant="secondary" className="text-xs">
                                  Imagen
                                </Badge>
                              )}
                              {question.audio && (
                                <Badge variant="secondary" className="text-xs">
                                  Audio
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Opción {question.respuestaCorrecta}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleChallengeQuestion(question.id)}
                              className={question.activa ? "text-success" : "text-muted-foreground"}
                            >
                              {question.activa ? (
                                <ToggleRight className="w-5 h-5" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteChallengeQuestion(question.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedChallengeQuestions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            No hay preguntas para este desafío
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
        title={deleteDialog.title}
        description={deleteDialog.description}
      />

      <OnboardingQuizModal isOpen={isOnboardingModalOpen} onClose={() => setIsOnboardingModalOpen(false)} onSave={questionData => {
      if (editingOnboardingQuestion) {
        setOnboardingQuestions(prev => prev.map(q => q.id === editingOnboardingQuestion.id ? {
          ...q,
          ...questionData
        } : q));
        toast({
          title: "Pregunta actualizada",
          description: "La pregunta ha sido actualizada correctamente."
        });
      } else {
        const newQuestion: OnboardingQuestion = {
          ...questionData,
          id: Date.now().toString()
        };
        setOnboardingQuestions(prev => [...prev, newQuestion]);
        toast({
          title: "Pregunta creada",
          description: "La nueva pregunta ha sido creada correctamente."
        });
      }
      setIsOnboardingModalOpen(false);
    }} question={editingOnboardingQuestion} />

      <OnboardingQuizModal isOpen={isLevelModalOpen} onClose={() => setIsLevelModalOpen(false)} onSave={questionData => {
      if (editingLevelQuestion) {
        setLevelQuestions(prev => prev.map(q => q.id === editingLevelQuestion.id ? {
          ...q,
          ...questionData,
          nivel: selectedLevel!
        } : q));
        toast({
          title: "Pregunta actualizada",
          description: "La pregunta ha sido actualizada correctamente."
        });
      } else {
        const newQuestion: LevelQuestion = {
          ...questionData,
          id: Date.now().toString(),
          nivel: selectedLevel!
        };
        setLevelQuestions(prev => [...prev, newQuestion]);
        toast({
          title: "Pregunta creada",
          description: "La nueva pregunta ha sido creada correctamente."
        });
      }
      setIsLevelModalOpen(false);
    }} question={editingLevelQuestion} />

      <LessonQuizModal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} onSave={questionData => {
      if (editingLessonQuestion) {
        setLessonQuestions(prev => prev.map(q => q.id === editingLessonQuestion.id ? {
          ...q,
          ...questionData
        } : q));
        toast({
          title: "Pregunta actualizada",
          description: "La pregunta ha sido actualizada correctamente."
        });
      } else {
        const newQuestion: LessonQuestion = {
          ...questionData,
          id: Date.now().toString()
        };
        setLessonQuestions(prev => [...prev, newQuestion]);
        toast({
          title: "Pregunta creada",
          description: "La nueva pregunta ha sido creada correctamente."
        });
      }
      setIsLessonModalOpen(false);
    }} question={editingLessonQuestion} />
    </div>;
}