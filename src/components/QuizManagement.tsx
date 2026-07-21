import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Search, ToggleLeft, ToggleRight, Eye, Lock } from "lucide-react";
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
import CreateChallengeQuestionModal from "./CreateChallengeQuestionModal";
import CreateChallengeModal from "./CreateChallengeModal";
import { useToast } from "@/hooks/use-toast";
import quizzes from "@/lib/quizzes";
import { supabase } from "@/lib/supabase";
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

  points?: number;
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

interface AssignmentInfo {
  companyId: string;
  companyName: string;
  areaId: string | null;
  areaName: string | null;
}

export default function QuizManagement() {
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);
  const [levelQuestions, setLevelQuestions] = useState<LevelQuestion[]>([]);
  const [lessonQuestions, setLessonQuestions] = useState<LessonQuestion[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeQuestions, setChallengeQuestions] = useState<ChallengeQuestion[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignmentsByLesson, setAssignmentsByLesson] = useState<Record<string, AssignmentInfo[]>>({});
  // Debug / raw response
  const [onboardingRawData, setOnboardingRawData] = useState<any[]>([]);
  const [showOnboardingRaw, setShowOnboardingRaw] = useState(false);

  // Helper refresh functions
  const refreshOnboarding = async () => {
    try {
      const data = await quizzes.listOnboardingQuestions();
      setOnboardingRawData(data || []);
      const mapped: OnboardingQuestion[] = (data || []).map((q: any) => {
        const opts = q.question_options || [];
        const correctIdx = q.correct_option_id ? (opts.findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1;
        return {
          id: q.id,
          pregunta: q.title ?? q.title,
          opcion1: opts?.[0]?.text ?? '',
          opcion2: opts?.[1]?.text ?? '',
          opcion3: opts?.[2]?.text ?? '',
          opcion4: opts?.[3]?.text ?? '',
          respuestaCorrecta: correctIdx || 1,
          incluirEnTest: q.include_in_test ?? false
        };
      });
      setOnboardingQuestions(mapped);
    } catch (err) {
      console.error('failed to refresh onboarding', err);
    }
  };

  const refreshLevelQuestions = async (level: string | null) => {
    if (!level) return;
    try {
      const data = await quizzes.listQuestions('level', { level });
      const mapped: LevelQuestion[] = (data || []).map((q: any) => ({
        id: q.id,
        nivel: q.level ?? level,
        pregunta: q.title ?? q.title,
        opcion1: q.question_options?.[0]?.text ?? '',
        opcion2: q.question_options?.[1]?.text ?? '',
        opcion3: q.question_options?.[2]?.text ?? '',
        opcion4: q.question_options?.[3]?.text ?? '',
        respuestaCorrecta: q.correct_option_id ? ((q.question_options || []).findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1,
        incluirEnTest: q.include_in_test ?? false,
      }));
      setLevelQuestions(mapped);
    } catch (err) {
      console.error('failed to refresh level questions', err);
    }
  };

  const refreshLessonQuestions = async (lessonId?: string | null) => {
    if (!lessonId) return;
    try {
      const data = await quizzes.listQuestions('lesson', { lesson_id: lessonId });
      const mapped: LessonQuestion[] = (data || []).map((q: any) => ({
        id: q.id,
        lessonId: q.lesson_id ?? lessonId,
        lessonTitle: '',
        tipo: q.kind === 'challenge' ? 'desafio-semanal' : 'quizz-leccion',
        pregunta: q.title ?? q.title,
        opciones: (q.question_options || []).map((o: any) => o.text),
        respuestaCorrecta: q.correct_option_id ? ((q.question_options || []).findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1,
        activa: q.active ?? true,
        points: q.points ?? 0
      }));
      setLessonQuestions(mapped);
    } catch (err) {
      console.error('failed to refresh lesson questions', err);
    }
  };

  const refreshChallenges = async () => {
    try {
      const data = await quizzes.listChallenges();
      const mapped: Challenge[] = (data || []).map((c: any) => ({
        id: c.id,
        titulo: c.title ?? c.titulo ?? '',
        nivel: c.level ?? c.nivel ?? 'A1',
        lessonId: c.lesson_id ?? c.lessonId ?? '',
        lessonTitle: c.lesson_title ?? '',
        activo: typeof c.active === 'boolean' ? c.active : (c.activo ?? true),
        points: (c.points ?? c.puntos ?? 0) as number
      }));
      setChallenges(mapped);
    } catch (err) {
      console.error('Failed to refresh challenges', err);
    }
  };

  // Onboarding per-level helpers
  const [selectedOnboardingLevel, setSelectedOnboardingLevel] = useState<"A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null>(null);
  const [onboardingCountsByLevel, setOnboardingCountsByLevel] = useState<Record<string, number>>({});
  const [initialLessonParam, setInitialLessonParam] = useState<string | null>(null);
  const [initialChallengeParam, setInitialChallengeParam] = useState<string | null>(null);
  // Level counts (only for 'level' kind quizzes)
  const [levelCountsByLevel, setLevelCountsByLevel] = useState<Record<string, number>>({});
  // Lesson counts (only for 'lesson' kind quizzes)
  const [lessonCountsByLesson, setLessonCountsByLesson] = useState<Record<string, number>>({});

  const refreshOnboardingByLevel = async (level?: string | null) => {
    try {
      if (!level) return;
      const data = await quizzes.listQuestions('onboarding', { level });
      const mapped: OnboardingQuestion[] = (data || []).map((q: any) => {
        const opts = q.question_options || [];
        const correctIdx = q.correct_option_id ? (opts.findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1;
        return {
          id: q.id,
          pregunta: q.title ?? q.title,
          opcion1: opts?.[0]?.text ?? '',
          opcion2: opts?.[1]?.text ?? '',
          opcion3: opts?.[2]?.text ?? '',
          opcion4: opts?.[3]?.text ?? '',
          respuestaCorrecta: correctIdx || 1,
          incluirEnTest: q.include_in_test ?? false
        };
      });
      setOnboardingQuestions(mapped);
      // also update counts map
      await loadOnboardingCounts();
    } catch (err) {
      console.error('failed to refresh onboarding by level', err);
    }
  };

  // URL query param helpers
  const setQueryParam = (key: string, value?: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (value && value !== '') url.searchParams.set(key, value);
      else url.searchParams.delete(key);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // noop in non-browser environments
    }
  };

  const getQueryParam = (key: string) => {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch (e) {
      return null;
    }
  };

  const loadOnboardingCounts = async () => {
    try {
      // Fetch only onboarding questions to avoid mixing with 'level' quizzes
      const data = await quizzes.listOnboardingQuestions();
      const counts: Record<string, number> = {};
      (data || []).forEach((q: any) => {
        // defensive: ensure we only count items that are explicitly onboarding
        if ((q.kind && q.kind !== 'onboarding')) return;
        const lvl = q.level ?? 'A1';
        counts[lvl] = (counts[lvl] || 0) + 1;
      });
      setOnboardingCountsByLevel(counts);
    } catch (err) {
      console.error('failed to load onboarding counts', err);
    }
  };

  const loadLevelCounts = async () => {
    try {
      const data = await quizzes.listQuestions('level');
      const counts: Record<string, number> = {};
      (data || []).forEach((q: any) => {
        if (q.kind && q.kind !== 'level') return;
        const lvl = q.level ?? 'A1';
        counts[lvl] = (counts[lvl] || 0) + 1;
      });
      setLevelCountsByLevel(counts);
    } catch (err) {
      console.error('failed to load level counts', err);
    }
  };

  const loadLessonCounts = async () => {
    try {
      const data = await quizzes.listQuestions('lesson');
      const counts: Record<string, number> = {};
      (data || []).forEach((q: any) => {
        if (q.kind && q.kind !== 'lesson') return;
        const lid = q.lesson_id ?? q.lessonId ?? 'unknown';
        counts[lid] = (counts[lid] || 0) + 1;
      });
      setLessonCountsByLesson(counts);
    } catch (err) {
      console.error('failed to load lesson counts', err);
    }
  };

  const fetchAssignments = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) { setAssignmentsByLesson({}); return; }
    const { data } = await supabase
      .from("lesson_assignments")
      .select("lesson_id, company_id, area_id, companies!company_id(name), areas!area_id(name)")
      .in("lesson_id", lessonIds);
    const map: Record<string, AssignmentInfo[]> = {};
    (data || []).forEach((r: any) => {
      const lid = r.lesson_id;
      if (!map[lid]) map[lid] = [];
      map[lid].push({
        companyId: r.company_id,
        companyName: r.companies?.name ?? "—",
        areaId: r.area_id,
        areaName: r.areas?.name ?? null,
      });
    });
    setAssignmentsByLesson(map);
  }, []);

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
  const [isCreateChallengeQuestionModalOpen, setIsCreateChallengeQuestionModalOpen] = useState(false);
  const [isCreateChallengeModalOpen, setIsCreateChallengeModalOpen] = useState(false);
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
    onConfirm: () => { },
  });

  const {
    toast
  } = useToast();

  const [loadingChallenges, setLoadingChallenges] = useState(false);



  useEffect(() => {
    let mounted = true;
    const loadQuestions = async () => {
      if (!selectedChallenge) return;
      try {
        const { questions } = await quizzes.getChallengeWithQuestions(selectedChallenge.id);
        if (!mounted) return;
        const mappedQ: ChallengeQuestion[] = (questions || []).map((q: any) => ({
          id: q.id,
          challengeId: selectedChallenge.id,
          pregunta: q.title ?? q.title,
          imagen: q.image_url ?? null,
          audio: q.audio_url ?? null,
          opciones: (q.question_options || []).map((o: any) => o.text),
          respuestaCorrecta: 1,
          activa: q.active ?? true
        }));
        setChallengeQuestions(mappedQ);
      } catch (err) {
        console.error('failed to load challenge questions', err);
        toast({ title: 'Error', description: 'No se pudieron cargar las preguntas del desafío' });
      }
    };
    loadQuestions();
    return () => { mounted = false };
  }, [selectedChallenge]);

  useEffect(() => {
    // On mount: restore selections from URL params (if any)
    const restoreFromParams = async () => {
      try {
        const ob = getQueryParam('onboarding');
        const lvl = getQueryParam('level');
        const lessonId = getQueryParam('lesson');
        const challengeId = getQueryParam('challenge');
        if (ob) {
          setSelectedOnboardingLevel(ob as any);
          await refreshOnboardingByLevel(ob);
        }
        if (lvl) {
          setSelectedLevel(lvl as any);
          // refreshLevelQuestions will be triggered by selectedLevel effect
        }
        if (lessonId) {
          // wait for lessons to load and set selectedLesson later
          setInitialLessonParam(lessonId);
        }
        if (challengeId) {
          setInitialChallengeParam(challengeId);
        }
      } catch (e) {
        console.error('failed to restore params', e);
      }
    };
    restoreFromParams();
  }, []);

  useEffect(() => {
    // Load challenges from DB
    let mounted = true;
    const load = async () => {
      setLoadingChallenges(true);
      try {
        const data = await quizzes.listChallenges();
        if (!mounted) return;
        // Map DB rows to UI shape
        const mapped: Challenge[] = (data || []).map((c: any) => ({
          id: c.id,
          titulo: c.title ?? c.titulo ?? '',
          nivel: c.level ?? c.nivel ?? 'A1',
          lessonId: c.lesson_id ?? c.lessonId ?? '',
          lessonTitle: c.lesson_title ?? '',
          activo: typeof c.active === 'boolean' ? c.active : (c.activo ?? true),
          points: (c.points ?? c.puntos ?? 0) as number
        }));
        setChallenges(mapped);
      } catch (err: any) {
        console.error('Failed to load challenges', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los desafíos' });
      } finally {
        setLoadingChallenges(false);
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  // After lessons loaded, if there was a lesson param, select it
  useEffect(() => {
    if (!initialLessonParam) return;
    if (lessons.length === 0) return;
    const found = lessons.find(l => l.id === initialLessonParam);
    if (found) {
      setSelectedLesson(found);
    }
    setInitialLessonParam(null);
  }, [lessons, initialLessonParam]);

  // After challenges loaded, if there was a challenge param, select it
  useEffect(() => {
    if (!initialChallengeParam) return;
    if (challenges.length === 0) return;
    const found = challenges.find(c => c.id === initialChallengeParam);
    if (found) {
      setSelectedChallenge(found);
    }
    setInitialChallengeParam(null);
  }, [challenges, initialChallengeParam]);

  // Resolve lesson titles for challenges once lessons are loaded
  useEffect(() => {
    if (lessons.length === 0 || challenges.length === 0) return;
    const updated = challenges.map(c => {
      if (c.lessonId && !c.lessonTitle) {
        const found = lessons.find(l => l.id === c.lessonId);
        return { ...c, lessonTitle: found?.titulo ?? "Lección eliminada" };
      }
      return c;
    });
    if (JSON.stringify(updated) !== JSON.stringify(challenges)) {
      setChallenges(updated);
    }
  }, [lessons, challenges]);

  useEffect(() => {
    // Load lessons from DB
    let mounted = true;
    const loadLessons = async () => {
      try {
        const data = await quizzes.listLessons();
        if (!mounted) return;
        const mapped: Lesson[] = (data || []).map((l: any) => ({
          id: l.id,
          titulo: l.title ?? l.titulo ?? '',
          nivel: l.level ?? l.nivel ?? 'A1'
        }));
        setLessons(mapped);
        // load lesson counts so cards show numbers immediately
        loadLessonCounts();
        fetchAssignments(mapped.map((l: any) => l.id));
      } catch (err) {
        console.error('failed to load lessons', err);
      }
    };
    loadLessons();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    // Load onboarding questions
    let mounted = true;
    const loadOnboarding = async () => {
      try {
        const data = await quizzes.listOnboardingQuestions();
        if (!mounted) return;
        // store raw data for debugging if needed
        setOnboardingRawData(data || []);
        const mapped: OnboardingQuestion[] = (data || []).map((q: any) => {
          const opts = q.question_options || [];
          const correctIdx = q.correct_option_id ? (opts.findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1;
          return {
            id: q.id,
            pregunta: q.title ?? q.title,
            opcion1: opts?.[0]?.text ?? '',
            opcion2: opts?.[1]?.text ?? '',
            opcion3: opts?.[2]?.text ?? '',
            opcion4: opts?.[3]?.text ?? '',
            respuestaCorrecta: correctIdx || 1,
            incluirEnTest: q.include_in_test ?? false
          };
        });
        setOnboardingQuestions(mapped);
        console.debug('onboarding questions loaded:', mapped.length, mapped);
        toast({ title: 'Onboarding cargado', description: `${mapped.length} preguntas cargadas desde la base de datos.` });
        // additional debug: if zero, print raw data
        if ((data || []).length === 0) console.debug('raw onboarding data from API is empty', data);
        // load counts per level for onboarding selector
        await loadOnboardingCounts();
      } catch (err) {
        console.error('failed to load onboarding questions', err);
      }
    };
    loadOnboarding();
    return () => { mounted = false };
  }, []);


  useEffect(() => {
    // Load level questions for selectedLevel
    let mounted = true;
    const loadLevel = async () => {
      if (!selectedLevel) return setLevelQuestions([]);
      try {
        const data = await quizzes.listQuestions('level', { level: selectedLevel });
        if (!mounted) return;
        const mapped: LevelQuestion[] = (data || []).map((q: any) => ({
          id: q.id,
          nivel: q.level ?? selectedLevel,
          pregunta: q.title ?? q.title,
          opcion1: q.question_options?.[0]?.text ?? '',
          opcion2: q.question_options?.[1]?.text ?? '',
          opcion3: q.question_options?.[2]?.text ?? '',
          opcion4: q.question_options?.[3]?.text ?? '',
          respuestaCorrecta: 1,
          incluirEnTest: q.include_in_test ?? false
        }));
        setLevelQuestions(mapped);
      } catch (err) {
        console.error('failed to load level questions', err);
      }
    };
    loadLevel();
    // also ensure level counts are loaded
    loadLevelCounts();
    return () => { mounted = false };
  }, [selectedLevel]);

  useEffect(() => {
    // Load lesson questions when a lesson is selected
    let mounted = true;
    const loadLessonQuestions = async () => {
      if (!selectedLesson) return setLessonQuestions([]);
      try {
        const data = await quizzes.listQuestions('lesson', { lesson_id: selectedLesson.id });
        if (!mounted) return;
        const mapped: LessonQuestion[] = (data || []).map((q: any) => ({
          id: q.id,
          lessonId: q.lesson_id ?? selectedLesson.id,
          lessonTitle: selectedLesson.titulo,
          tipo: q.kind === 'challenge' ? 'desafio-semanal' : 'quizz-leccion',
          pregunta: q.title ?? q.title,
          opciones: (q.question_options || []).map((o: any) => o.text),
          respuestaCorrecta: 1,
          activa: q.active ?? true,
          points: q.points ?? 0
        }));
        setLessonQuestions(mapped);
      } catch (err) {
        console.error('failed to load lesson questions', err);
      }
    };
    loadLessonQuestions();
    return () => { mounted = false };
  }, [selectedLesson]);
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
    (async () => {
      try {
        const current = onboardingQuestions.find(q => q.id === questionId);
        const newVal = !current?.incluirEnTest;
        await quizzes.updateQuestion(questionId, { include_in_test: newVal });
        if (selectedOnboardingLevel) {
          await refreshOnboardingByLevel(selectedOnboardingLevel);
        } else {
          await refreshOnboarding();
        }
        await loadOnboardingCounts();
        toast({ title: 'Estado actualizado', description: 'El estado de inclusión en el test ha sido actualizado.' });
      } catch (err) {
        console.error('failed to toggle onboarding include_in_test', err);
        toast({ title: 'Error', description: 'No se pudo actualizar la pregunta.' });
      }
    })();
  };
  const handleToggleLevelQuestion = (questionId: string) => {
    (async () => {
      try {
        const current = levelQuestions.find(q => q.id === questionId);
        const newVal = !current?.incluirEnTest;
        await quizzes.updateQuestion(questionId, { include_in_test: newVal });
        await refreshLevelQuestions(selectedLevel);
        await loadLevelCounts();
        toast({ title: 'Estado actualizado', description: 'El estado de inclusión en el test ha sido actualizado.' });
      } catch (err) {
        console.error('failed to toggle level include_in_test', err);
        toast({ title: 'Error', description: 'No se pudo actualizar la pregunta.' });
      }
    })();
  };
  const handleToggleLessonQuestion = (questionId: string) => {
    (async () => {
      try {
        const current = lessonQuestions.find(q => q.id === questionId);
        const newVal = !current?.activa;
        await quizzes.updateQuestion(questionId, { active: newVal });
        await refreshLessonQuestions(current?.lessonId);
        await loadLessonCounts();
        toast({ title: 'Estado actualizado', description: 'El estado de la pregunta ha sido actualizado.' });
      } catch (err) {
        console.error('failed to toggle lesson question active', err);
        toast({ title: 'Error', description: 'No se pudo actualizar la pregunta.' });
      }
    })();
  };

  const handleToggleChallenge = (challengeId: string) => {
    (async () => {
      try {
        const current = challenges.find(c => c.id === challengeId);
        const newVal = !current?.activo;
        await quizzes.updateChallenge(challengeId, { active: newVal });
        await refreshChallenges();
        toast({ title: 'Estado actualizado', description: 'El estado del desafío ha sido actualizado.' });
      } catch (err) {
        console.error('failed to toggle challenge active', err);
        toast({ title: 'Error', description: 'No se pudo actualizar el desafío.' });
      }
    })();
  };

  const handleToggleChallengeQuestion = (questionId: string) => {
    (async () => {
      try {
        const current = challengeQuestions.find(q => q.id === questionId);
        const newVal = !current?.activa;
        await quizzes.updateQuestion(questionId, { active: newVal });
        if (selectedChallenge) {
          const { questions } = await quizzes.getChallengeWithQuestions(selectedChallenge.id);
          const mappedQ: ChallengeQuestion[] = (questions || []).map((q: any) => ({
            id: q.id,
            challengeId: selectedChallenge.id,
            pregunta: q.title ?? q.title,
            imagen: q.image_url ?? null,
            audio: q.audio_url ?? null,
            opciones: (q.question_options || []).map((o: any) => o.text),
            respuestaCorrecta: q.correct_option_id ? ((q.question_options || []).findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1,
            activa: q.active ?? true
          }));
          setChallengeQuestions(mappedQ);
        }
        toast({ title: 'Estado actualizado', description: 'El estado de la pregunta ha sido actualizado.' });
      } catch (err) {
        console.error('failed to toggle challenge question active', err);
        toast({ title: 'Error', description: 'No se pudo actualizar la pregunta.' });
      }
    })();
  };

  const handleDeleteOnboardingQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          await quizzes.deleteQuestion(questionId);
          if (selectedOnboardingLevel) {
            await refreshOnboardingByLevel(selectedOnboardingLevel);
          } else {
            await refreshOnboarding();
          }
          await loadOnboardingCounts();
          toast({ title: 'Pregunta eliminada', description: 'La pregunta ha sido eliminada correctamente.' });
        } catch (err) {
          console.error('failed to delete onboarding question', err);
          toast({ title: 'Error', description: 'No se pudo eliminar la pregunta.' });
        }
      },
    });
  };

  const handleDeleteLevelQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          await quizzes.deleteQuestion(questionId);
          await refreshLevelQuestions(selectedLevel);
          await loadLevelCounts();
          toast({ title: 'Pregunta eliminada', description: 'La pregunta ha sido eliminada correctamente.' });
        } catch (err) {
          console.error('failed to delete level question', err);
          toast({ title: 'Error', description: 'No se pudo eliminar la pregunta.' });
        }
      },
    });
  };

  const handleDeleteLessonQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          await quizzes.deleteQuestion(questionId);
          await refreshLessonQuestions(selectedLesson?.id);
          await loadLessonCounts();
          toast({ title: 'Pregunta eliminada', description: 'La pregunta ha sido eliminada correctamente.' });
        } catch (err) {
          console.error('failed to delete lesson question', err);
          toast({ title: 'Error', description: 'No se pudo eliminar la pregunta.' });
        }
      },
    });
  };

  const handleDeleteChallenge = (challengeId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          await quizzes.deleteChallenge(challengeId);
          await refreshChallenges();
          setChallengeQuestions(prev => prev.filter(q => q.challengeId !== challengeId));
          toast({ title: 'Desafío eliminado', description: 'El desafío y sus preguntas han sido eliminados correctamente.' });
        } catch (err) {
          console.error('failed to delete challenge', err);
          toast({ title: 'Error', description: 'No se pudo eliminar el desafío.' });
        }
      },
    });
  };

  const handleDeleteChallengeQuestion = (questionId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: async () => {
        try {
          await quizzes.deleteQuestion(questionId);
          if (selectedChallenge) {
            const { questions } = await quizzes.getChallengeWithQuestions(selectedChallenge.id);
            const mappedQ: ChallengeQuestion[] = (questions || []).map((q: any) => ({
              id: q.id,
              challengeId: selectedChallenge.id,
              pregunta: q.title ?? q.title,
              imagen: q.image_url ?? null,
              audio: q.audio_url ?? null,
              opciones: (q.question_options || []).map((o: any) => o.text),
              respuestaCorrecta: q.correct_option_id ? ((q.question_options || []).findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1,
              activa: q.active ?? true
            }));
            setChallengeQuestions(mappedQ);
          }
          toast({ title: 'Pregunta eliminada', description: 'La pregunta ha sido eliminada correctamente.' });
        } catch (err) {
          console.error('failed to delete challenge question', err);
          toast({ title: 'Error', description: 'No se pudo eliminar la pregunta.' });
        }
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
        {!selectedOnboardingLevel ? (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Seleccionar Nivel (Onboarding)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {levels.map(level => <Card key={level} className="cursor-pointer hover:shadow-md transition-shadow" onClick={async () => { setSelectedOnboardingLevel(level); setQueryParam('onboarding', level); await refreshOnboardingByLevel(level); }}>
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold text-2xl mb-2">{level}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(onboardingCountsByLevel[level] || 0)} preguntas
                    </p>
                  </CardContent>
                </Card>)}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">Quiz de Onboarding {selectedOnboardingLevel}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Gestionar preguntas de onboarding para el nivel {selectedOnboardingLevel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { setSelectedOnboardingLevel(null); setOnboardingQuestions([]); setQueryParam('onboarding', null); }}>
                    Volver a onboarding
                  </Button>
                  <Button onClick={() => { setEditingOnboardingQuestion(null); setIsOnboardingModalOpen(true); }} className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Pregunta
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Banco de Preguntas de Onboarding {selectedOnboardingLevel} ({onboardingQuestions.length})</CardTitle>
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
                      <TableCell className="max-w-md"><div className="truncate">{question.pregunta}</div></TableCell>
                      <TableCell><Badge variant="outline">Opción {question.respuestaCorrecta}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleOnboardingQuestion(question.id)} className={question.incluirEnTest ? "text-success" : "text-muted-foreground"}>
                          {question.incluirEnTest ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingOnboardingQuestion(question); setIsOnboardingModalOpen(true); }}><Edit className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteOnboardingQuestion(question.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                    {onboardingQuestions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No hay preguntas para este nivel</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
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
                {levels.map(level => <Card key={level} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedLevel(level); setQueryParam('level', level); }}>
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold text-2xl mb-2">{level}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(levelCountsByLevel[level] || 0)} preguntas
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
                <Button variant="outline" onClick={() => { setSelectedLevel(null); setQueryParam('level', null); }}>
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
                        <Badge variant="outline">Opción {question.respuestaCorrecta}</Badge>
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
                  {filteredLessons.map(lesson => {
                    const assigns = assignmentsByLesson[lesson.id] || [];
                    const hasAssignments = assigns.length > 0;
                    return (
                      <Card
                        key={lesson.id}
                        className={`cursor-pointer transition-shadow ${
                          hasAssignments
                            ? "bg-primary/[0.02] hover:bg-primary/[0.04] hover:shadow-md"
                            : "hover:shadow-md"
                        }`}
                        onClick={() => { setSelectedLesson(lesson); setQueryParam('lesson', lesson.id); }}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg flex items-center gap-1.5">
                              {hasAssignments && <Lock className="w-3.5 h-3.5 text-primary/60 shrink-0" />}
                              {lesson.titulo}
                            </h3>
                            <Badge variant="outline">{lesson.nivel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {(lessonCountsByLesson[lesson.id] || 0)} preguntas
                            {hasAssignments && <span className="ml-2 italic">Privado</span>}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
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
                <Button variant="outline" onClick={() => { setSelectedLesson(null); setQueryParam('lesson', null); }}>
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
                  <Button onClick={() => setIsCreateChallengeModalOpen(true)} className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Desafío
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Puntos</TableHead>
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
                        <TableCell>
                          <div className="text-sm">{(challenge as any).points ?? 0} pts</div>
                        </TableCell>
                        <TableCell>
                          {challenge.lessonId ? (
                            <span className="flex items-center gap-1.5">
                              {(assignmentsByLesson[challenge.lessonId] || []).length > 0 && (
                                <Lock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                              )}
                              {challenge.lessonTitle || "Sin título"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
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
                              onClick={() => { setSelectedChallenge(challenge); setQueryParam('challenge', challenge.id); }}
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
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    Lección: {selectedChallenge.lessonTitle || "Sin título"}
                    {selectedChallenge.lessonId && (assignmentsByLesson[selectedChallenge.lessonId] || []).length > 0 && (
                      <>
                        <Lock className="w-3 h-3 text-primary/60" />
                        <span className="italic">Privado</span>
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" onClick={() => { setSelectedChallenge(null); setQueryParam('challenge', null); }}>
                  Volver a Desafíos
                </Button>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  Preguntas del Desafío ({selectedChallengeQuestions.length})
                </CardTitle>
                <Button onClick={() => setIsCreateChallengeQuestionModalOpen(true)} className="bg-primary hover:bg-primary-hover">
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

    <OnboardingQuizModal isOpen={isOnboardingModalOpen} onClose={() => setIsOnboardingModalOpen(false)} onSave={async (questionData) => {
      try {
        const payload: any = {
          kind: 'onboarding' as const,
          title: questionData.pregunta,
          level: selectedOnboardingLevel ?? undefined,
          content: {},
          active: true,
          options: [
            { text: questionData.opcion1, order: 0 },
            { text: questionData.opcion2, order: 1 },
            { text: questionData.opcion3, order: 2 },
            { text: questionData.opcion4, order: 3 }
          ],
          correct_option_index: questionData.respuestaCorrecta
        };
        if (editingOnboardingQuestion) {
          // update existing question + replace options
          const { question, options } = await quizzes.updateQuestionWithOptions(editingOnboardingQuestion.id, payload as any);
          if (selectedOnboardingLevel) await refreshOnboardingByLevel(selectedOnboardingLevel);
          else await refreshOnboarding();
          toast({ title: 'Pregunta actualizada', description: 'La pregunta de onboarding ha sido actualizada.' });
        } else {
          const { question, options } = await quizzes.createQuestionWithOptions(payload as any);
          const correctIdx = options && question.correct_option_id ? (options.findIndex((o: any) => o.id === question.correct_option_id) + 1) : 1;
          const mapped: OnboardingQuestion = {
            id: question.id,
            pregunta: question.title ?? question.title,
            opcion1: options?.[0]?.text ?? '',
            opcion2: options?.[1]?.text ?? '',
            opcion3: options?.[2]?.text ?? '',
            opcion4: options?.[3]?.text ?? '',
            respuestaCorrecta: correctIdx,
            incluirEnTest: question.include_in_test ?? false
          };
          // refresh from server to ensure counts and data are consistent
          if (selectedOnboardingLevel) await refreshOnboardingByLevel(selectedOnboardingLevel);
          else await refreshOnboarding();
          toast({ title: 'Pregunta creada', description: 'La nueva pregunta ha sido creada correctamente.' });
        }
      } catch (err) {
        console.error('failed to create onboarding question', err);
        toast({ title: 'Error', description: 'No se pudo crear la pregunta de onboarding' });
      }
      setIsOnboardingModalOpen(false);
    }} question={editingOnboardingQuestion} />

    <OnboardingQuizModal isOpen={isLevelModalOpen} onClose={() => setIsLevelModalOpen(false)} onSave={async (questionData) => {
      if (!selectedLevel) return;
      try {
        const payload = {
          kind: 'level' as const,
          title: questionData.pregunta,
          level: selectedLevel,
          content: {},
          active: true,
          options: [
            { text: questionData.opcion1, order: 0 },
            { text: questionData.opcion2, order: 1 },
            { text: questionData.opcion3, order: 2 },
            { text: questionData.opcion4, order: 3 }
          ]
          ,
          correct_option_index: questionData.respuestaCorrecta
        };
        if (editingLevelQuestion) {
          await quizzes.updateQuestionWithOptions(editingLevelQuestion.id, payload as any);
          await refreshLevelQuestions(selectedLevel);
          await loadLevelCounts();
          toast({ title: 'Pregunta actualizada', description: 'La pregunta de nivel ha sido actualizada.' });
        } else {
          const { question, options } = await quizzes.createQuestionWithOptions(payload as any);
          const correctIdx = options && question.correct_option_id ? (options.findIndex((o: any) => o.id === question.correct_option_id) + 1) : 1;
          const mapped: LevelQuestion = {
            id: question.id,
            nivel: selectedLevel,
            pregunta: question.title ?? question.title,
            opcion1: options?.[0]?.text ?? '',
            opcion2: options?.[1]?.text ?? '',
            opcion3: options?.[2]?.text ?? '',
            opcion4: options?.[3]?.text ?? '',
            respuestaCorrecta: correctIdx,
            incluirEnTest: question.include_in_test ?? false
          };
          await refreshLevelQuestions(selectedLevel);
          toast({ title: 'Pregunta creada', description: 'La nueva pregunta ha sido creada correctamente.' });
        }
      } catch (err) {
        console.error('failed to create level question', err);
        toast({ title: 'Error', description: 'No se pudo crear la pregunta de nivel' });
      }
      setIsLevelModalOpen(false);
    }} question={editingLevelQuestion} />

    <LessonQuizModal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} onSave={async (questionData) => {
      try {
        const payload = {
          kind: 'lesson' as const,
          title: questionData.pregunta,
          lesson_id: questionData.lessonId,
          content: {},
          active: questionData.activa,
          points: (questionData as any).points ?? 0,
          options: questionData.opciones.map((o, i) => ({ text: o, order: i }))
          ,
          correct_option_index: questionData.respuestaCorrecta
        };
        if (editingLessonQuestion) {
          await quizzes.updateQuestionWithOptions(editingLessonQuestion.id, payload as any);
          await refreshLessonQuestions(editingLessonQuestion.lessonId);
          await loadLessonCounts();
          toast({ title: 'Pregunta actualizada', description: 'La pregunta de lección ha sido actualizada.' });
        } else {
          const { question, options } = await quizzes.createQuestionWithOptions(payload as any);
          const correctIdx = options && question.correct_option_id ? (options.findIndex((o: any) => o.id === question.correct_option_id) + 1) : 1;
          const mapped: LessonQuestion = {
            id: question.id,
            lessonId: question.lesson_id ?? questionData.lessonId,
            lessonTitle: questionData.lessonTitle,
            tipo: question.kind === 'challenge' ? 'desafio-semanal' : 'quizz-leccion',
            pregunta: question.title ?? question.title,
            opciones: (options || []).map((o: any) => o.text),
            respuestaCorrecta: correctIdx,
            activa: question.active ?? questionData.activa
          };
          await refreshLessonQuestions(mapped.lessonId);
          await loadLessonCounts();
          toast({ title: 'Pregunta creada', description: 'La nueva pregunta ha sido creada correctamente.' });
        }
      } catch (err) {
        console.error('failed to create lesson question', err);
        toast({ title: 'Error', description: 'No se pudo crear la pregunta de lección' });
      }
      setIsLessonModalOpen(false);
    }} question={editingLessonQuestion} lessons={lessons} defaultLessonId={selectedLesson?.id} defaultLessonTitle={selectedLesson?.titulo} />
    <CreateChallengeQuestionModal
      isOpen={isCreateChallengeQuestionModalOpen}
      onClose={() => setIsCreateChallengeQuestionModalOpen(false)}
      challenges={challenges}
      defaultChallengeId={selectedChallenge?.id}
      onSave={async (data) => {
        if (!selectedChallenge) return;
        try {
          // Upload media if present
          let image_url: string | null = data.imagen ?? null;
          let audio_url: string | null = data.audio ?? null;
          if (data.imageFile) {
            const dest = `challenges/${selectedChallenge.id}/images/${Date.now()}_${data.imageFile.name}`;
            const up = await quizzes.uploadMedia(data.imageFile, dest);
            image_url = up.publicURL ?? (`/storage/${up.path}`);
          }
          if (data.audioFile) {
            const dest = `challenges/${selectedChallenge.id}/audio/${Date.now()}_${data.audioFile.name}`;
            const up = await quizzes.uploadMedia(data.audioFile, dest);
            audio_url = up.publicURL ?? (`/storage/${up.path}`);
          }

          const payload = {
            kind: 'challenge' as const,
            title: data.pregunta,
            challenge_id: (data as any).challengeId ?? selectedChallenge.id,
            content: {},
            image_url,
            audio_url,
            active: data.activa,
            options: data.opciones.map((o: string, i: number) => ({ text: o, order: i }))
            ,
            correct_option_index: data.respuestaCorrecta
          };

          const { question, options } = await quizzes.createQuestionWithOptions(payload as any);
          const correctIdx = options && question.correct_option_id ? (options.findIndex((o: any) => o.id === question.correct_option_id) + 1) : 1;

          const mapped: ChallengeQuestion = {
            id: question.id,
            challengeId: selectedChallenge.id,
            pregunta: question.title ?? question.title,
            imagen: question.image_url ?? image_url ?? undefined,
            audio: question.audio_url ?? audio_url ?? undefined,
            opciones: (options || []).map((o: any) => o.text),
            respuestaCorrecta: correctIdx,
            activa: question.active ?? true
          };
          // refresh challenge questions from server
          if (selectedChallenge) {
            const { questions } = await quizzes.getChallengeWithQuestions(selectedChallenge.id);
            const mappedQ: ChallengeQuestion[] = (questions || []).map((q: any) => ({
              id: q.id,
              challengeId: selectedChallenge.id,
              pregunta: q.title ?? q.title,
              imagen: q.image_url ?? null,
              audio: q.audio_url ?? null,
              opciones: (q.question_options || []).map((o: any) => o.text),
              respuestaCorrecta: q.correct_option_id ? ((q.question_options || []).findIndex((o: any) => o.id === q.correct_option_id) + 1) : 1,
              activa: q.active ?? true
            }));
            setChallengeQuestions(mappedQ);
          }
          toast({ title: "Pregunta creada", description: "La nueva pregunta de desafío ha sido creada." });
          setIsCreateChallengeQuestionModalOpen(false);
        } catch (err: any) {
          console.error(err);
          toast({ title: 'Error', description: 'No se pudo crear la pregunta.' });
        }
      }}
    />
    <CreateChallengeModal
      isOpen={isCreateChallengeModalOpen}
      onClose={() => setIsCreateChallengeModalOpen(false)}
      lessons={lessons}
      onSave={async (data) => {
        try {
          const payload = {
            title: data.titulo,
            level: data.nivel,
            lesson_id: data.lessonId || null,
            active: data.activo ?? true,
            points: (data as any).points ?? 0
          };
          const created = await quizzes.createChallenge(payload as any);
          await refreshChallenges();
          toast({ title: "Desafío creado", description: "El nuevo desafío ha sido creado correctamente." });
          setIsCreateChallengeModalOpen(false);
        } catch (err: any) {
          console.error(err);
          toast({ title: 'Error', description: 'No se pudo crear el desafío' });
        }
      }}
    />
  </div>;
}