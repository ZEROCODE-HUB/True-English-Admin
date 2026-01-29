import { useEffect, useState, useRef, lazy, Suspense } from "react";
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

const ConversationManagement = () => {
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [loading, setLoading] = useState(true);
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
  const { toast } = useToast();

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
    // Load topics and conversation logs from Supabase
    const load = async () => {
      setLoading(true);
      try {
        await loadTopics();
      } catch (err) {
        console.error('Error cargando datos de conversaciones IA', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los datos de conversaciones desde la base.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  // Carga topics con su vocabulario
  const loadTopics = async () => {
    const { data, error } = await supabase
      .from('ai_topics')
      .select(`id, title, emoji, level, prompt, description, status, points, ai_topic_vocab(id, word, definition, part_of_speech)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

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

    // map points if available (DB uses `points` column)
    mapped.forEach((m, idx) => {
      const raw = (data || [])[idx] || {};
      (m as any).points = (raw.points ?? raw.puntos ?? 0) as number;
    });

    setTopics(mapped);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'topics' | 'logs');
    if (value === 'logs') {
      // load logs lazily when user opens the Logs tab
      loadLogs().catch(err => {
        console.error('Error cargando logs', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los logs de conversaciones.' });
      });
    }
  };

  // Carga conversaciones (logs) con profile, topic, mensajes y puntuaciones
  const loadLogs = async () => {
    // 1) obtener conversaciones recientes
    const { data: convs, error: convsError } = await supabase
      .from('ai_conversations')
      // include a small projection of ai_messages so we can filter conversations
      // that already have at least one message (i.e. started conversations)
      .select('id, topic_id, profile_id, level, started_at, ai_messages(id)')
      .order('started_at', { ascending: false })
      .limit(100);

    if (convsError) throw convsError;

    // keep only conversations that have at least one message (i.e. started)
    let convList: any[] = convs || [];
    convList = convList.filter((c: any) => c.ai_messages && c.ai_messages.length > 0);

    const profileIds = Array.from(new Set(convList.map((c: any) => c.profile_id).filter(Boolean)));
    const topicIds = Array.from(new Set(convList.map((c: any) => c.topic_id).filter(Boolean)));
    const convIds = convList.map((c: any) => c.id);

    // 2) fetch related profiles, topics and scores in parallel
    // NOTE: we intentionally DO NOT fetch messages here to avoid creating
    // a row per message in the conversations list. Full messages are
    // loaded when the user opens a conversation (fetchConversationDetail).
    const [profilesRes, topicsRes, scoresRes] = await Promise.all([
      supabase.from('profiles').select('id, name, last_name, email').in('id', profileIds),
      supabase.from('ai_topics').select('id, title').in('id', topicIds),
      supabase.from('ai_conversation_scores').select('id, ai_conversation_id, grammar, fluency, orthography, total, feedback, created_at').in('ai_conversation_id', convIds)
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (topicsRes.error) throw topicsRes.error;
    if (scoresRes.error) throw scoresRes.error;

    const profiles = profilesRes.data || [];
    const topicsMap = (topicsRes.data || []).reduce((acc: any, t: any) => ({ ...acc, [t.id]: t }), {});
    const scores = scoresRes.data || [];

    const logsMapped: ConversationLog[] = convList.map((c: any) => {
      const profile = profiles.find((p: any) => p.id === c.profile_id) || { name: '', last_name: '', email: '' };
      const topic = topicsMap[c.topic_id] || { title: 'Tema eliminado' };
      const convScores = scores.filter((s: any) => s.ai_conversation_id === c.id);
      // pick latest score if exists (most recent created_at)
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
      // Don't include full messages in the list view; transcript will be
      // fetched on demand when opening the conversation detail modal.
      const convMessages: any[] = [];

      const usuario = profile.name ? `${profile.name} ${profile.last_name || ''}`.trim() : profile.email || 'Usuario';

      const puntuaciones = {
        gramatica: latestScore?.grammar ?? 0,
        fluidez: latestScore?.fluency ?? 0,
        ortografia: latestScore?.orthography ?? 0
      };

      const puntuacionFinal = latestScore?.total ?? Math.round(((Number(puntuaciones.gramatica) + Number(puntuaciones.fluidez) + Number(puntuaciones.ortografia)) / 3) || 0);

      const transcript = (convMessages || []).map((m: any) => ({
        role: m.sender_type === 'ai' ? 'assistant' : 'user',
        content: m.content,
        timestamp: new Date(m.created_at)
      }));

      return {
        id: c.id,
        usuario,
        tema: topic.title,
        nivel: c.level,
        fecha: new Date(c.started_at),
        puntuaciones,
        puntuacionFinal,
        transcript,
        feedbackFinal: latestScore?.feedback ?? ''
      };
    });

    setLogs(logsMapped);
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
          role: m.sender_type === 'ai' ? 'assistant' : 'user',
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
            const toInsert = editingTopic.vocabulario.map(v => ({ topic_id: editingTopic.id, word: v.word, definition: v.definition, part_of_speech: v.partOfSpeech }));
            const { error: err2 } = await supabase.from('ai_topic_vocab').insert(toInsert);
            if (err2) throw err2;
          }

          toast({ title: "Tema actualizado", description: "El tema ha sido actualizado correctamente." });
        } else {
          // create topic
          const { data: created, error } = await supabase.from('ai_topics').insert({ title: editingTopic.titulo, prompt: editingTopic.promptSistema, description: editingTopic.descripcion || null, level: editingTopic.nivel, metadata: {}, status: editingTopic.activo ? 'active' : 'draft', emoji: editingTopic.emoji || null, points: (editingTopic as any).points ?? 0 }).select().single();
          if (error) throw error;

          if (editingTopic.vocabulario.length > 0) {
            const toInsert = editingTopic.vocabulario.map(v => ({ topic_id: created.id, word: v.word, definition: v.definition, part_of_speech: v.partOfSpeech }));
            const { error: err2 } = await supabase.from('ai_topic_vocab').insert(toInsert);
            if (err2) throw err2;
          }

          toast({ title: "Tema creado", description: "El tema ha sido creado correctamente." });
        }

        // refresh topics list
        await loadTopics();
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
            await loadTopics();
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
        await loadTopics();
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

      <Tabs defaultValue="topics" onValueChange={handleTabChange} className="space-y-4">
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
              <Card key={topic.id} className={topic.activo ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{topic.emoji || '💬'}</div>
                      <div>
                        <CardTitle className="text-lg">{topic.titulo}</CardTitle>
                        <div className="mt-1">
                          <Badge variant="secondary">{topic.nivel}</Badge>
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
                await loadLogs();
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