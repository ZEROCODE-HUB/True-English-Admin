import { useEffect, useState, useRef, lazy, Suspense, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Plus, Edit, Trash2, Eye, Filter, GripVertical, ArrowUpDown, Search } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import supabase from "@/lib/supabase";
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
  emoji?: string | null;
  points?: number;
  descripcion?: string | null;
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

// We'll load topics and logs from Supabase instead of using hardcoded mock data.

interface SortableTopicRowProps {
  topic: ConversationTopic;
}

const SortableTopicRow = ({ topic }: SortableTopicRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: topic.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-full min-w-0 items-center gap-3 p-3 border rounded-lg bg-card overflow-hidden"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="text-xl shrink-0">{topic.emoji || '💬'}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{topic.titulo}</p>
        {topic.descripcion && (
          <p className="text-xs text-muted-foreground truncate">{topic.descripcion}</p>
        )}
      </div>
      <Badge variant="secondary" className="shrink-0">{topic.nivel}</Badge>
      {!topic.activo && <Badge variant="outline" className="text-xs shrink-0">Inactivo</Badge>}
    </div>
  );
};

const ConversationManagement = () => {
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'topics' | 'logs'>('topics');
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [selectedLog, setSelectedLog] = useState<ConversationLog | null>(null);
  const [selectedConversationMessages, setSelectedConversationMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([]);
  const [selectedConversationScores, setSelectedConversationScores] = useState<any[]>([]);
  const [selectedConversationMeta, setSelectedConversationMeta] = useState<any | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ConversationTopic | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // load emoji picker lazily to avoid loading heavy assets when not needed
  const EmojiPicker = lazy(() => import('emoji-picker-react'));
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [userFilter, setUserFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderedTopics, setReorderedTopics] = useState<ConversationTopic[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { toast } = useToast();

  const [topicSearch, setTopicSearch] = useState("");
  const [topicLevelFilter, setTopicLevelFilter] = useState("all");
  const [topicSortBy, setTopicSortBy] = useState("sort_order");
  const [topicPage, setTopicPage] = useState(1);
  const [topicCount, setTopicCount] = useState(0);
  const [logSortBy, setLogSortBy] = useState("newest");
  const [logPage, setLogPage] = useState(1);
  const [logCount, setLogCount] = useState(0);

  const TOPICS_PER_PAGE = 9;
  const LOGS_PER_PAGE = 10;

  const debouncedTopicSearch = useDebounce(topicSearch, 300);
  const debouncedUserFilter = useDebounce(userFilter, 300);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const partsOfSpeech = ["noun", "verb", "adjective", "adverb", "preposition", "conjunction"];

  // Helper to normalize numeric score values coming from Postgres (numeric -> string)
  // Handles values in 0..1 (fractions) or 0..100 (percent) and returns integer percent or null.
  const normalizeScoreValue = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    if (Math.abs(n) <= 1) return Math.round(n * 100);
    return Math.round(n);
  };

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setTopicsLoading(true);
      try {
        await fetchTopics(controller.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Error cargando datos de conversaciones IA', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los datos de conversaciones desde la base.' });
      } finally {
        setTopicsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [debouncedTopicSearch, topicLevelFilter, topicSortBy, topicPage]);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    const controller = new AbortController();
    const load = async () => {
      setLogsLoading(true);
      try {
        await fetchLogs(controller.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Error cargando logs', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los logs de conversaciones.' });
      } finally {
        setLogsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [debouncedUserFilter, levelFilter, dateFilter, logSortBy, logPage, activeTab]);

  const mapTopicsData = (data: any[]) => {
    const mapped: ConversationTopic[] = (data || []).map((t: any) => ({
      id: t.id,
      titulo: t.title,
      promptSistema: t.prompt,
      descripcion: t.description || '',
      nivel: t.level,
      vocabulario: (t.ai_topic_vocab || []).map((v: any) => ({ id: v.id, word: v.word, definition: v.definition, partOfSpeech: v.part_of_speech })),
      activo: t.status === 'active',
      emoji: t.emoji || ''
    }));
    mapped.forEach((m, idx) => {
      const raw = ((data || [])[idx] || {}) as any;
      (m as any).points = (raw.points ?? raw.puntos ?? 0) as number;
      (m as any).sort_order = (raw.sort_order ?? 0) as number;
    });
    return mapped;
  };

  const fetchTopics = async (signal?: AbortSignal) => {
    let query = supabase
      .from('ai_topics')
      .select(`id, title, emoji, level, prompt, description, status, points, sort_order, ai_topic_vocab(id, word, definition, part_of_speech)`, { count: 'exact' });

    if (debouncedTopicSearch) {
      query = query.or(`title.ilike.%${debouncedTopicSearch}%,description.ilike.%${debouncedTopicSearch}%`);
    }
    if (topicLevelFilter !== 'all') {
      query = query.eq('level', topicLevelFilter);
    }

    switch (topicSortBy) {
      case 'newest': query = query.order('created_at', { ascending: false }); break;
      case 'oldest': query = query.order('created_at', { ascending: true }); break;
      case 'az': query = query.order('title', { ascending: true }); break;
      case 'za': query = query.order('title', { ascending: false }); break;
      default: query = query.order('sort_order', { ascending: true });
    }

    const from = (topicPage - 1) * TOPICS_PER_PAGE;
    const to = from + TOPICS_PER_PAGE - 1;
    query = query.range(from, to);

    if (signal) query = query.abortSignal(signal);

    const { data, error, count } = await query;
    if (error) throw error;

    setTopics(mapTopicsData(data || []));
    setTopicCount(count || 0);
  };

  const handleEnterReorderMode = () => {
    setReorderedTopics([...topics]);
    setReorderMode(true);
  };

  const handleCancelReorder = () => {
    setReorderMode(false);
    setReorderedTopics([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderedTopics((prev) => {
        const oldIndex = prev.findIndex(t => t.id === active.id);
        const newIndex = prev.findIndex(t => t.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    const previousOrder = [...topics];
    setIsSavingOrder(true);
    try {
      await Promise.all(
        reorderedTopics.map((t, i) =>
          supabase.from('ai_topics').update({ sort_order: i + 1 }).eq('id', t.id)
        )
      );
      await fetchTopics();
      setReorderMode(false);
      setReorderedTopics([]);
      toast({ title: 'Orden guardado', description: 'El orden de los temas fue actualizado.' });
    } catch (err) {
      console.error(err);
      setReorderedTopics(previousOrder);
      toast({ title: 'Error al guardar', description: 'No se pudo guardar el nuevo orden. Se revirtió al orden anterior.' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'topics' | 'logs');
  };

  const fetchLogs = async (signal?: AbortSignal) => {
    let baseQuery = supabase
      .from('ai_conversations')
      .select('id, topic_id, profile_id, level, started_at', { count: 'exact' });

    if (levelFilter !== 'all') {
      baseQuery = baseQuery.eq('level', levelFilter);
    }

    if (dateFilter) {
      const dayStr = format(dateFilter, 'yyyy-MM-dd');
      baseQuery = baseQuery.gte('started_at', `${dayStr}T00:00:00`).lt('started_at', `${dayStr}T23:59:59`);
    }

    if (logSortBy === 'newest' || logSortBy === 'highest' || logSortBy === 'lowest') {
      baseQuery = baseQuery.order('started_at', { ascending: false });
    } else {
      baseQuery = baseQuery.order('started_at', { ascending: true });
    }

    const from = (logPage - 1) * LOGS_PER_PAGE;
    const to = from + LOGS_PER_PAGE - 1;
    baseQuery = baseQuery.range(from, to);
    if (signal) baseQuery = baseQuery.abortSignal(signal);

    const { data: convs, error: convsError, count } = await baseQuery;
    if (convsError) throw convsError;

    let convList: any[] = convs || [];

    const profileIds = Array.from(new Set(convList.map((c: any) => c.profile_id).filter(Boolean)));
    const topicIds = Array.from(new Set(convList.map((c: any) => c.topic_id).filter(Boolean)));
    const convIds = convList.map((c: any) => c.id);

    let profilesQuery = supabase.from('profiles').select('id, name, last_name, email');
    if (debouncedUserFilter) {
      profilesQuery = profilesQuery.or(`name.ilike.%${debouncedUserFilter}%,last_name.ilike.%${debouncedUserFilter}%,email.ilike.%${debouncedUserFilter}%`);
    }
    if (profileIds.length > 0) {
      profilesQuery = profilesQuery.in('id', profileIds);
    } else if (debouncedUserFilter) {
      profilesQuery = profilesQuery.limit(0);
    }

    const [profilesRes, topicsRes, scoresRes] = await Promise.all([
      profilesQuery,
      topicIds.length > 0
        ? supabase.from('ai_topics').select('id, title').in('id', topicIds)
        : Promise.resolve({ data: [], error: null }),
      convIds.length > 0
        ? supabase.from('ai_conversation_scores').select('id, ai_conversation_id, grammar, fluency, orthography, total, feedback, created_at').in('ai_conversation_id', convIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (topicsRes.error) throw topicsRes.error;
    if (scoresRes.error) throw scoresRes.error;

    const profiles = profilesRes.data || [];
    const profileIdSet = new Set(profiles.map((p: any) => p.id));

    if (debouncedUserFilter) {
      convList = convList.filter((c: any) => profileIdSet.has(c.profile_id));
    }

    const topicsMap = (topicsRes.data || []).reduce((acc: any, t: any) => ({ ...acc, [t.id]: t }), {});
    const scores = scoresRes.data || [];

    const logsMapped: ConversationLog[] = convList.map((c: any) => {
      const profile = profiles.find((p: any) => p.id === c.profile_id) || { name: '', last_name: '', email: '' };
      const topic = topicsMap[c.topic_id] || { title: 'Tema eliminado' };
      const convScores = scores.filter((s: any) => s.ai_conversation_id === c.id);
      const latestRaw = convScores.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const latestScore = latestRaw
        ? {
          ...latestRaw,
          grammar: latestRaw.grammar !== null && latestRaw.grammar !== undefined ? Number(latestRaw.grammar) : null,
          fluency: latestRaw.fluency !== null && latestRaw.fluency !== undefined ? Number(latestRaw.fluency) : null,
          orthography: latestRaw.orthography !== null && latestRaw.orthography !== undefined ? Number(latestRaw.orthography) : null,
          total: latestRaw.total !== null && latestRaw.total !== undefined ? Number(latestRaw.total) : null,
        }
        : null;

      const usuario = profile.name ? `${profile.name} ${profile.last_name || ''}`.trim() : profile.email || 'Usuario';

      const puntuaciones = {
        gramatica: latestScore?.grammar ?? 0,
        fluidez: latestScore?.fluency ?? 0,
        ortografia: latestScore?.orthography ?? 0
      };

      const puntuacionFinal = latestScore?.total ?? Math.round(((Number(puntuaciones.gramatica) + Number(puntuaciones.fluidez) + Number(puntuaciones.ortografia)) / 3) || 0);

      return {
        id: c.id,
        usuario,
        tema: topic.title,
        nivel: c.level,
        fecha: new Date(c.started_at),
        puntuaciones,
        puntuacionFinal,
        transcript: [],
        feedbackFinal: latestScore?.feedback ?? ''
      };
    });

    let sortedLogs = logsMapped;
    if (logSortBy === 'highest') {
      sortedLogs = [...logsMapped].sort((a, b) => b.puntuacionFinal - a.puntuacionFinal);
    } else if (logSortBy === 'lowest') {
      sortedLogs = [...logsMapped].sort((a, b) => a.puntuacionFinal - b.puntuacionFinal);
    }

    setLogs(sortedLogs);
    setLogCount(count || 0);
  };

  const fetchConversationDetail = async (convId: string) => {
    // Load full conversation messages and all scores directly to guarantee the
    // complete transcript is displayed (RPCs or migrations could limit results).
    try {
      const [{ data: msgs, error: msgsErr }, { data: scores, error: scoresErr }] = await Promise.all([
        supabase
          .from('ai_messages')
          .select('id, sender_profile_id, sender_type, content, content_json, created_at')
          .eq('ai_conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(10000),
        supabase
          .from('ai_conversation_scores')
          .select('id, evaluator_profile_id, grammar, fluency, orthography, total, feedback, created_at')
          .eq('ai_conversation_id', convId)
          .order('created_at', { ascending: false })
      ]);

      if (msgsErr) throw msgsErr;
      if (scoresErr) throw scoresErr;

      const mappedMsgs = (msgs || []).map((m: any) => {
        // Prefer plain text `content`, otherwise try to extract a sensible
        // string from `content_json` (shape may vary). As a last resort,
        // stringify the JSON so the user sees something.
        let text = m.content;
        if ((!text || text === '') && m.content_json) {
          // Common shapes: { text: '...' } or { body: '...' }
          if (typeof m.content_json === 'string') {
            try { text = JSON.parse(m.content_json).text || JSON.parse(m.content_json).body || JSON.parse(m.content_json); } catch (e) { text = m.content_json; }
          } else if (typeof m.content_json === 'object') {
            text = m.content_json.text || m.content_json.body || JSON.stringify(m.content_json);
          }
        }

        return {
          role: (m.sender_type === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: text ?? '',
          timestamp: m.created_at
        };
      });

      setSelectedConversationMessages(mappedMsgs);
      // parse numeric fields returned as strings (Postgres numeric -> string)
      const parsedScores = (scores || []).map((s: any) => ({
        ...s,
        grammar: s.grammar !== null && s.grammar !== undefined ? Number(s.grammar) : null,
        fluency: s.fluency !== null && s.fluency !== undefined ? Number(s.fluency) : null,
        orthography: s.orthography !== null && s.orthography !== undefined ? Number(s.orthography) : null,
        total: s.total !== null && s.total !== undefined ? Number(s.total) : null,
      }));
      setSelectedConversationScores(parsedScores);

      // fetch conversation metadata (puntos, periodos, status)
      try {
        const { data: convMeta, error: convMetaErr } = await supabase.from('ai_conversations').select('id, puntos, current_period_start, current_period_end, status').eq('id', convId).single();
        if (!convMetaErr) setSelectedConversationMeta(convMeta as any);
      } catch (e) {
        setSelectedConversationMeta(null);
      }

      // Try to scroll transcript to bottom so latest messages are visible
      setTimeout(() => {
        try {
          if (transcriptRef.current) transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
        } catch (e) { /* ignore */ }
      }, 150);
    } catch (err) {
      console.error('Error fetching conversation detail', err);
      setSelectedConversationMessages([]);
      setSelectedConversationScores([]);
      setSelectedConversationMeta(null);
    }
  };

  const handleCreateTopic = () => {
    setEditingTopic({
      id: "",
      titulo: "",
      promptSistema: "",
      descripcion: "",
      nivel: "A1",
      vocabulario: [],
      activo: true,
      emoji: ''
      , points: 0
    });
    setIsTopicModalOpen(true);
  };

  const handleEditTopic = (topic: ConversationTopic) => {
    setEditingTopic({ ...topic });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = () => {
    (async () => {
      if (!editingTopic) return;

      try {
        if (editingTopic.id) {
          // update topic
          const { error } = await supabase
            .from('ai_topics')
            .update({ title: editingTopic.titulo, prompt: editingTopic.promptSistema, description: editingTopic.descripcion || null, level: editingTopic.nivel, metadata: {}, status: editingTopic.activo ? 'active' : 'draft', emoji: editingTopic.emoji || null, points: (editingTopic as any).points ?? 0 })
            .eq('id', editingTopic.id);

          if (error) throw error;

          // replace vocab: delete existing and insert new
          await supabase.from('ai_topic_vocab').delete().eq('topic_id', editingTopic.id);
          if (editingTopic.vocabulario.length > 0) {
            const toInsert = editingTopic.vocabulario.map((v, i) => ({ topic_id: editingTopic.id, word: v.word, definition: v.definition, part_of_speech: v.partOfSpeech, order: i }));
            const { error: err2 } = await supabase.from('ai_topic_vocab').insert(toInsert);
            if (err2) throw err2;
          }

          toast({ title: "Tema actualizado", description: "El tema ha sido actualizado correctamente." });
        } else {
          // create topic — sort_order al final de la lista actual
          const maxSortOrder = topics.reduce((max, t) => Math.max(max, (t as any).sort_order ?? 0), 0);
          const { data: created, error } = await supabase.from('ai_topics').insert({ title: editingTopic.titulo, prompt: editingTopic.promptSistema, description: editingTopic.descripcion || null, level: editingTopic.nivel, metadata: {}, status: editingTopic.activo ? 'active' : 'draft', emoji: editingTopic.emoji || null, points: (editingTopic as any).points ?? 0, sort_order: maxSortOrder + 1 }).select().single();
          if (error) throw error;

          if (editingTopic.vocabulario.length > 0) {
            const toInsert = editingTopic.vocabulario.map((v, i) => ({ topic_id: created.id, word: v.word, definition: v.definition, part_of_speech: v.partOfSpeech, order: i }));
            const { error: err2 } = await supabase.from('ai_topic_vocab').insert(toInsert);
            if (err2) throw err2;
          }

          toast({ title: "Tema creado", description: "El tema ha sido creado correctamente." });
        }

        // refresh topics list
        await fetchTopics();
        setIsTopicModalOpen(false);
        setEditingTopic(null);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo guardar el tema. Reintente.' });
      }
    })();
  };

  const handleDeleteTopic = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        (async () => {
          try {
            const { error } = await supabase.from('ai_topics').delete().eq('id', id);
            if (error) throw error;
            // cascade will remove vocab via FK
            await fetchTopics();
            toast({ title: "Tema eliminado", description: "El tema ha sido eliminado correctamente." });
          } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'No se pudo eliminar el tema.' });
          }
        })();
      },
    });
  };

  const handleEmojiClick = (emojiData: any, _event: any) => {
    const emojiChar = emojiData?.emoji || emojiData?.native || '';
    setEditingTopic(prev => prev ? { ...prev, emoji: emojiChar } : null);
    setShowEmojiPicker(false);
  };

  const handleToggleTopicStatus = (id: string) => {
    (async () => {
      try {
        const t = topics.find(x => x.id === id);
        if (!t) return;
        const newStatus = t.activo ? 'draft' : 'active';
        const { error } = await supabase.from('ai_topics').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        await fetchTopics();
        toast({ title: 'Estado actualizado', description: `Tema ${newStatus === 'active' ? 'activado' : 'desactivado'}.` });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo actualizar el estado del tema.' });
      }
    })();
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

  const totalTopicPages = Math.max(1, Math.ceil(topicCount / TOPICS_PER_PAGE));
  const totalLogPages = Math.max(1, Math.ceil(logCount / LOGS_PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Conversaciones con IA</h1>
      </div>

      <Tabs defaultValue="topics" onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="topics">Temas de Conversación</TabsTrigger>
          <TabsTrigger value="logs">Logs de Conversaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Temas de Conversación</h2>
            <div className="flex gap-2">
              {!reorderMode ? (
                <>
                  {topics.length > 1 && (
                    <Button variant="outline" onClick={handleEnterReorderMode}>
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Reordenar
                    </Button>
                  )}
                  <Button onClick={handleCreateTopic}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Tema
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancelReorder} disabled={isSavingOrder}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
                    {isSavingOrder ? 'Guardando...' : 'Guardar orden'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {reorderMode ? (
            <div className="space-y-2 w-full overflow-x-hidden">
              <p className="text-sm text-muted-foreground">Arrastra los temas para cambiar su orden. Haz clic en "Guardar orden" cuando termines.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={reorderedTopics.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 w-full">
                    {reorderedTopics.map((topic) => (
                      <SortableTopicRow key={topic.id} topic={topic} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por título o descripción..."
                          value={topicSearch}
                          onChange={(e) => { setTopicSearch(e.target.value); setTopicPage(1); }}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Nivel</Label>
                      <Select value={topicLevelFilter} onValueChange={(v) => { setTopicLevelFilter(v); setTopicPage(1); }}>
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
                      <Label>Ordenar por</Label>
                      <Select value={topicSortBy} onValueChange={(v) => { setTopicSortBy(v); setTopicPage(1); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sort_order">Orden personalizado</SelectItem>
                          <SelectItem value="newest">Más recientes</SelectItem>
                          <SelectItem value="oldest">Más antiguos</SelectItem>
                          <SelectItem value="az">Alfabético A-Z</SelectItem>
                          <SelectItem value="za">Alfabético Z-A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-sm text-muted-foreground">
                {topicCount} tema{topicCount !== 1 ? 's' : ''} encontrado{topicCount !== 1 ? 's' : ''}
              </div>

              <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 transition-opacity ${topicsLoading && topics.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                {topicsLoading && topics.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`skel-${i}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded" />
                            <div>
                              <Skeleton className="h-5 w-40 mb-2" />
                              <Skeleton className="h-4 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-10 rounded-full" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4 mb-4" />
                        <div className="flex gap-1 mb-4">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                  : topics.map((topic) => (
                    <Card key={topic.id} className={topic.activo ? '' : 'opacity-60'}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{topic.emoji || '💬'}</div>
                            <div>
                              <CardTitle className="text-lg">{topic.titulo}</CardTitle>
                              <div className="mt-1 flex items-center gap-1">
                                <Badge variant="secondary">{topic.nivel}</Badge>
                                {((topic as any).points ?? 0) > 0 && (
                                  <Badge variant="outline">{(topic as any).points} pts</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={topic.activo}
                            onCheckedChange={() => handleToggleTopicStatus(topic.id)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {topic.descripcion || topic.promptSistema}
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
                  ))
                }
              </div>

              {topicCount === 0 && !topicsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron temas con los filtros seleccionados.
                </div>
              )}

              {totalTopicPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setTopicPage(p => Math.max(1, p - 1))}
                        className={topicPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalTopicPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalTopicPages || Math.abs(page - topicPage) <= 1)
                      .reduce<(number | 'ellipsis')[]>((acc, page, i, arr) => {
                        if (i > 0 && page - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              isActive={topicPage === item}
                              onClick={() => setTopicPage(item)}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setTopicPage(p => Math.min(totalTopicPages, p + 1))}
                        className={topicPage >= totalTopicPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
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
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <Label htmlFor="user-filter">Usuario</Label>
                  <Input
                    id="user-filter"
                    placeholder="Buscar por usuario..."
                    value={userFilter}
                    onChange={(e) => { setUserFilter(e.target.value); setLogPage(1); }}
                  />
                </div>
                <div>
                  <Label htmlFor="level-filter">Nivel</Label>
                  <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setLogPage(1); }}>
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
                        onSelect={(d) => { setDateFilter(d); setLogPage(1); }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Ordenar por</Label>
                  <Select value={logSortBy} onValueChange={(v) => { setLogSortBy(v); setLogPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Más recientes</SelectItem>
                      <SelectItem value="oldest">Más antiguos</SelectItem>
                      <SelectItem value="highest">Mayor puntuación</SelectItem>
                      <SelectItem value="lowest">Menor puntuación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => {
                    setUserFilter("");
                    setLevelFilter("all");
                    setDateFilter(undefined);
                    setLogSortBy("newest");
                    setLogPage(1);
                  }}>
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            {logCount} resultado{logCount !== 1 ? 's' : ''}
          </div>

          <Card className={`transition-opacity ${logsLoading && logs.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
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
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.usuario}</TableCell>
                      <TableCell>{log.tema}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.nivel}</Badge>
                      </TableCell>
                      <TableCell>{format(log.fecha, "PPP", { locale: es })}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div>
                            <Badge variant={log.puntuacionFinal >= 80 ? "default" : log.puntuacionFinal >= 60 ? "secondary" : "destructive"}>
                              {log.puntuacionFinal}%
                            </Badge>
                          </div>
                          {/* show a compact breakdown (G: grammar, F: fluency, O: orthography) */}
                          <div className="text-xs text-muted-foreground mt-1">
                            G: {log.puntuaciones.gramatica ?? '-'} · F: {log.puntuaciones.fluidez ?? '-'} · O: {log.puntuaciones.ortografia ?? '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setIsLogModalOpen(true);
                            // fetch full messages and scores for this conversation
                            fetchConversationDetail(log.id);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logsLoading && logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="space-y-2 py-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-5 w-12" />
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-5 w-14" />
                              <Skeleton className="h-8 w-8" />
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!logsLoading && logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron conversaciones con los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalLogPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    className={logPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalLogPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalLogPages || Math.abs(page - logPage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, page, i, arr) => {
                    if (i > 0 && page - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={logPage === item}
                          onClick={() => setLogPage(item)}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                    className={logPage >= totalLogPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
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
              <Label htmlFor="descripcion">Descripción (mostrada en listado)</Label>
              <Textarea
                id="descripcion"
                rows={3}
                value={editingTopic?.descripcion || ""}
                onChange={(e) => setEditingTopic(prev => prev ? { ...prev, descripcion: e.target.value } : null)}
                placeholder="Breve descripción que se mostrará en el listado"
              />
            </div>
            <div>
              <Label>Emoji</Label>
              <div className="flex items-center gap-2">
                <div className="text-2xl">{editingTopic?.emoji || '💬'}</div>
                <Input
                  id="emoji"
                  value={editingTopic?.emoji || ""}
                  onChange={(e) => setEditingTopic(prev => prev ? { ...prev, emoji: e.target.value } : null)}
                  placeholder="Ejemplo: 🍽️"
                />
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      {showEmojiPicker ? 'Cerrar' : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 -translate-x-20">
                    <div className="p-2">
                      <Suspense fallback={<div className="p-3">Cargando selector...</div>}>
                        {/* @ts-ignore */}
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </Suspense>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
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
              <Label htmlFor="topic-points">Puntos Ganados</Label>
              <Input id="topic-points" type="number" min={0} step={1} value={String((editingTopic as any)?.points ?? 0)} onChange={(e) => setEditingTopic(prev => prev ? { ...prev, points: Math.max(0, parseInt(e.target.value || '0') || 0) } : null)} />
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
      <Dialog open={isLogModalOpen} onOpenChange={(open) => {
        setIsLogModalOpen(open);
        if (!open) {
          setSelectedConversationMessages([]);
          setSelectedConversationScores([]);
          setSelectedLog(null);
        }
      }}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalle de Conversación</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Make the main content area scrollable inside the modal so the dialog
                  chrome stays fixed and content doesn't overflow the viewport. */}
              <div className="overflow-y-auto max-h-[72vh] px-6 py-4">
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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Puntos</Label>
                    <Input type="number" min={0} value={String(selectedConversationMeta?.puntos ?? 0)} onChange={(e) => setSelectedConversationMeta(prev => ({ ...(prev || {}), puntos: Math.max(0, parseInt(e.target.value || '0') || 0) }))} />
                  </div>
                  <div>
                    <Label>Periodo Actual</Label>
                    <p className="text-sm">{selectedConversationMeta?.current_period_start ? `${new Date(selectedConversationMeta.current_period_start).toLocaleDateString()} - ${selectedConversationMeta?.current_period_end ? new Date(selectedConversationMeta.current_period_end).toLocaleDateString() : ''}` : '—'}</p>
                  </div>
                </div>

                <div>
                  <Label>Puntuaciones Detalladas</Label>
                  <div className="mt-2">
                    {selectedConversationScores && selectedConversationScores.length > 0 ? (
                      <div className="space-y-3">
                        {selectedConversationScores.map((s: any) => (
                          <div key={s.id} className="p-3 border rounded-md">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-sm text-muted-foreground">{s.created_at ? format(new Date(s.created_at), 'PPP p', { locale: es }) : ''}</div>
                              <div className="text-sm">Evaluador: {s.evaluator_profile_id || 'Auto'}</div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <Label className="text-sm text-muted-foreground">Gramática</Label>
                                <Badge variant={s.grammar >= 80 ? 'default' : s.grammar >= 60 ? 'secondary' : 'destructive'}>{s.grammar ?? '-'}</Badge>
                              </div>
                              <div>
                                <Label className="text-sm text-muted-foreground">Fluidez</Label>
                                <Badge variant={s.fluency >= 80 ? 'default' : s.fluency >= 60 ? 'secondary' : 'destructive'}>{s.fluency ?? '-'}</Badge>
                              </div>
                              <div>
                                <Label className="text-sm text-muted-foreground">Ortografía</Label>
                                <Badge variant={s.orthography >= 80 ? 'default' : s.orthography >= 60 ? 'secondary' : 'destructive'}>{s.orthography ?? '-'}</Badge>
                              </div>
                              <div>
                                <Label className="text-sm text-muted-foreground">Total</Label>
                                <Badge variant={s.total >= 80 ? 'default' : s.total >= 60 ? 'secondary' : 'destructive'}>{s.total ?? '-'}</Badge>
                              </div>
                            </div>
                            {s.feedback && <div className="mt-2 text-sm text-muted-foreground">Feedback: {s.feedback}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No hay evaluaciones para esta conversación.</div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Transcripción de la Conversación</Label>
                  <div className="mt-2">
                    <div className="text-sm text-muted-foreground mb-2">Mensajes: {(selectedConversationMessages && selectedConversationMessages.length) || (selectedLog?.transcript?.length) || 0}</div>
                    <div ref={transcriptRef} className="space-y-2 max-h-[60vh] overflow-y-auto border rounded-md p-4">
                      {(selectedConversationMessages && selectedConversationMessages.length > 0 ? selectedConversationMessages : selectedLog?.transcript || []).map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg p-3 ${message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                            }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {format(new Date(message.timestamp), "HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Feedback Final</Label>
                  <div className="mt-2 p-4 bg-muted rounded-md">
                    <p className="text-sm">{selectedLog.feedbackFinal}</p>
                  </div>
                </div>
                {/* close the inner scrollable container */}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              // refresh detail
              if (selectedLog) fetchConversationDetail(selectedLog.id);
            }}>Refrescar</Button>
            <Button onClick={async () => {
              if (!selectedLog || !selectedConversationMeta) return;
              try {
                const { error } = await supabase.from('ai_conversations').update({ puntos: selectedConversationMeta.puntos ?? 0 }).eq('id', selectedLog.id);
                if (error) throw error;
                toast({ title: 'Guardado', description: 'Puntos actualizados correctamente.' });
                // refresh logs list and detail
                await fetchLogs();
                await fetchConversationDetail(selectedLog.id);
              } catch (err) {
                console.error('Error updating puntos', err);
                toast({ title: 'Error', description: 'No se pudo actualizar puntos.' });
              }
            }}>Guardar cambios</Button>
          </div>
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