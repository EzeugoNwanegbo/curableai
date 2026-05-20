import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Send,
  Sparkles,
  ShieldAlert,
  BookmarkCheck,
  Loader2,
  Brain,
  Pill,
  UserRound,
  FileText,
  X,
  Stethoscope,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  ChevronDown,
  History,
  Plus,
} from "lucide-react";
import {
  createDoctorReviewReport,
  getPatientChatState,
  sendDoctorReviewReport,
  sendMessage,
} from "@/api/chat";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Follow-up · Curable" },
      {
        name: "description",
        content:
          "Patient AI assistant with persistent medical memory and optional doctor validation.",
      },
    ],
  }),
  component: ChatPage,
});

interface Message {
  id: string;
  role: "patient" | "ai" | "doctor";
  text: string;
  time: string;
  risk?: string;
  citations?: string[];
  actions?: string[];
  doctorReview?: DoctorReviewUpdate;
  reasoning?: ReasoningSnapshot | null;
  conversationId?: string;
  createdAt?: string;
}

interface ReasoningCondition {
  name: string;
  score: number;
  matchLabel: string;
  support?: string[];
  weakens?: string[];
}

interface ReasoningTimelineItem {
  event: string;
  whenText?: string;
  estimatedDate?: string;
  certainty?: "user_reported" | "inferred" | "unknown";
  source?: string;
}

interface ReasoningStewardship {
  nextAction: string;
  reason?: string;
  shouldOfferDoctorValidation?: boolean;
  shouldWarnUrgentCare?: boolean;
  shouldStopQuestioning?: boolean;
}

interface ReasoningUsedContext {
  profile?: string[];
  medications?: string[];
  memory?: string[];
  conversation?: string[];
}

interface ReasoningSnapshot {
  readiness: "collecting" | "ready";
  stage?: "collecting" | "reasoning_ready";
  concernSummary: string;
  timeline?: ReasoningTimelineItem[];
  nextQuestion?: string;
  uncertaintyGaps?: string[];
  conditions: ReasoningCondition[];
  stewardship?: ReasoningStewardship;
  usedContext?: ReasoningUsedContext;
  sourceMessageAt?: string | null;
}

interface Memory {
  id?: string;
  label: string;
  layer: number;
  since: string;
  details?: string;
}

interface DoctorReport {
  summary: string;
  risk: string;
  doctorQuestion: string;
  patientContext?: string[];
  medicationContext?: string[];
  memoryContext?: string[];
  recentConversation?: string[];
  reasoningSnapshot?: ReasoningSnapshot | null;
  aiSafetyNote?: string;
}

interface DoctorReviewUpdate {
  outcome: "validated" | "consultation_started";
  title: string;
  doctorName: string;
  doctorNote?: string;
  actionLabel?: string;
}

interface DoctorConnection {
  doctorName: string;
  doctorEmail?: string;
  clinicName?: string;
}

function mapDbMessage(m: any): Message {
  const metadata = m.metadata || {};
  const isDoctorReview = metadata.type === "doctor_review_card";

  return {
    id: m.id,
    role: isDoctorReview
      ? "doctor"
      : m.role === "patient"
        ? "patient"
        : m.role === "doctor"
          ? "doctor"
          : "ai",
    text: m.content,
    time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: m.created_at,
    conversationId: metadata?.conversationId || "legacy",
    risk: metadata?.escalation?.risk,
    reasoning: metadata.reasoning || null,
    actions: metadata?.signals?.length
      ? [`${metadata.signals.length} memory fact${metadata.signals.length === 1 ? "" : "s"} saved`]
      : undefined,
    doctorReview: isDoctorReview
      ? {
          outcome: metadata.outcome,
          title: metadata.title || "Doctor reviewed this report",
          doctorName: metadata.doctorName || "Doctor",
          doctorNote: metadata.doctorNote || m.content,
          actionLabel: metadata.actionLabel,
        }
      : undefined,
  };
}

function ChatPage() {
  const { patientId, displayName } = useAuth();
  const [input, setInput] = useState("");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("current");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [patient, setPatient] = useState<{ id: string; name: string; pinned?: string } | null>(
    null,
  );
  const [doctorConnection, setDoctorConnection] = useState<DoctorConnection | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedReasoningId, setExpandedReasoningId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => allMessages.filter((message) => message.conversationId === activeConversationId),
    [activeConversationId, allMessages],
  );

  const chatHistory = useMemo(() => {
    const groups = new Map<string, Message[]>();
    for (const message of allMessages) {
      const conversationId = message.conversationId || "legacy";
      if (!groups.has(conversationId)) groups.set(conversationId, []);
      groups.get(conversationId)!.push(message);
    }

    return Array.from(groups.entries())
      .map(([id, items]) => {
        const firstPatientMessage = items.find((item) => item.role === "patient");
        const latest = items[items.length - 1];
        return {
          id,
          count: items.length,
          latestAt: latest?.createdAt || "",
          title:
            id === "legacy"
              ? "Previous chat"
              : firstPatientMessage?.text.slice(0, 42) || "New symptom check",
        };
      })
      .sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)));
  }, [allMessages]);

  const latestReasoningMessage = useMemo(
    () =>
      messages
        .slice()
        .reverse()
        .find((message) => message.reasoning?.conditions?.length),
    [messages],
  );

  // 1. Initialize Patient & Fetch Data
  useEffect(() => {
    async function init() {
      if (!patientId) return;
      try {
        console.log("Initializing chat...");
        console.log("Patient initialized:", patientId);

        const state = await getPatientChatState({ data: { patientId } });
        const pDetails = state.patient;

        if (pDetails) {
          setPatient({
            id: patientId,
            name: pDetails.full_name,
            pinned: pDetails.pinned_by_doctor,
          });
        } else {
          setPatient({
            id: patientId,
            name: displayName,
            pinned: "",
          });
        }

        if (state.messages) {
          const mappedMessages = state.messages.map(mapDbMessage);
          setAllMessages(mappedMessages);
          setActiveConversationId(
            mappedMessages[mappedMessages.length - 1]?.conversationId || "current",
          );
        }

        setDoctorConnection(state.doctorConnection || null);

        if (state.memories) {
          setMemories(
            state.memories.map((m) => ({
              id: m.id,
              label: m.label,
              layer: m.layer,
              details: m.details,
              since: new Date(m.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
            })),
          );
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError(err.message || "An unexpected error occurred.");
      }
    }
    init();
  }, [displayName, patientId]);

  useEffect(() => {
    if (!patient?.id) return;

    const channel = supabase
      .channel(`doctor_review_cards_${patient.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `patient_id=eq.${patient.id}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (row?.metadata?.type !== "doctor_review_card") return;

          setAllMessages((prev) => {
            if (prev.some((message) => message.id === row.id)) return prev;
            return [...prev, mapDbMessage(row)];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient?.id]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewChat = () => {
    setActiveConversationId(`chat_${Date.now()}`);
    setInput("");
    setExpandedReasoningId(null);
    setDoctorReport(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !patient || isSending) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "patient",
      text: input,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      conversationId: activeConversationId,
    };

    setAllMessages((prev) => [...prev, userMsg]);
    setExpandedReasoningId(null);
    setInput("");
    setIsSending(true);

    try {
      const aiResponse = await sendMessage({
        data: {
          patientId: patient.id,
          message: input,
          conversationId: activeConversationId,
        },
      });

      setAllMessages((prev) => [
        ...prev,
        {
          id: aiResponse.id || Math.random().toString(),
          role: "ai",
          text: aiResponse.content,
          time: aiResponse.time,
          createdAt: new Date().toISOString(),
          conversationId: activeConversationId,
          risk: aiResponse.risk,
          reasoning: aiResponse.reasoning as ReasoningSnapshot | null,
          actions: aiResponse.memoriesAdded?.length
            ? [
                `${aiResponse.memoriesAdded.length} memory fact${aiResponse.memoriesAdded.length === 1 ? "" : "s"} saved to profile`,
              ]
            : undefined,
        },
      ]);

      const freshState = await getPatientChatState({ data: { patientId: patient.id } });
      setDoctorConnection(freshState.doctorConnection || null);

      if (freshState.memories) {
        setMemories(
          freshState.memories.map((m) => ({
            id: m.id,
            label: m.label,
            layer: m.layer,
            details: m.details,
            since: new Date(m.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
          })),
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateReport = async () => {
    if (!patient || isCreatingReport) return;
    if (!doctorConnection?.doctorName) {
      setReportError("Add a validating doctor from Add Doctor before creating a doctor report.");
      return;
    }
    const reason = latestReasoningMessage?.reasoning?.concernSummary
      ? `Patient requested doctor validation of Curable's latest reasoning: ${latestReasoningMessage.reasoning.concernSummary}`
      : "Patient is requesting doctor review of the current AI conversation and recent health concern.";

    setIsCreatingReport(true);
    setReportSent(false);
    setReportError(null);
    try {
      const report = await createDoctorReviewReport({
        data: {
          patientId: patient.id,
          reason,
        },
      });
      setDoctorReport(report as DoctorReport);
    } catch (err: any) {
      setError(err.message || "Could not create doctor report.");
    } finally {
      setIsCreatingReport(false);
    }
  };

  const handleSendReport = async () => {
    if (!patient || !doctorReport || isSendingReport) return;
    if (!doctorConnection?.doctorName) {
      setReportError("Add a validating doctor from Add Doctor before sending this report.");
      return;
    }
    setIsSendingReport(true);
    setReportError(null);
    try {
      await sendDoctorReviewReport({
        data: {
          patientId: patient.id,
          doctor: doctorConnection,
          report: doctorReport,
        },
      });
      setReportSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send report to doctor.");
    } finally {
      setIsSendingReport(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-serif text-2xl text-foreground mb-2">Initialization Failed</h2>
        <p className="text-muted-foreground max-w-md mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-serif text-lg text-muted-foreground">Initializing Curable AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid min-h-screen grid-cols-1 ${
        isHistoryOpen ? "lg:grid-cols-[280px_1fr_360px]" : "lg:grid-cols-[72px_1fr_360px]"
      }`}
    >
      <aside className="hidden border-r border-border bg-card/60 p-3 lg:block">
        <div
          className={
            isHistoryOpen
              ? "flex items-center justify-between gap-3"
              : "flex flex-col items-center gap-3"
          }
        >
          <button
            type="button"
            onClick={() => setIsHistoryOpen((value) => !value)}
            className={`inline-flex items-center gap-2 text-sm font-semibold text-foreground ${
              isHistoryOpen
                ? ""
                : "h-10 w-10 justify-center rounded-md border border-border bg-background"
            }`}
            aria-label={isHistoryOpen ? "Collapse chat history" : "Expand chat history"}
          >
            <History className="h-4 w-4 text-primary" />
            {isHistoryOpen ? "Chat history" : null}
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-label="Start new chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {isHistoryOpen ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex w-full items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/15"
            >
              <Plus className="h-4 w-4 text-primary" />
              New symptom check
            </button>
            {chatHistory.length ? (
              chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setActiveConversationId(chat.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    chat.id === activeConversationId
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-background/60 hover:bg-muted"
                  }`}
                >
                  <div className="truncate text-sm font-medium text-foreground">{chat.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {chat.count} message{chat.count === 1 ? "" : "s"}
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No chat history yet.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2">
            {chatHistory.slice(0, 5).map((chat, index) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  setActiveConversationId(chat.id);
                  setIsHistoryOpen(true);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-md border text-xs font-semibold ${
                  chat.id === activeConversationId
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:bg-muted"
                }`}
                title={chat.title}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Conversation */}
      <div className="flex h-screen flex-col border-r border-border">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 lg:px-8 lg:py-5">
          <div className="hidden lg:block">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Page 01
            </div>
            <h1 className="mt-1 font-serif text-xl text-foreground">
              AI Follow-up · {patient.name}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsHistoryOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background lg:hidden"
            aria-label="Open chat history"
          >
            <History className="h-4 w-4 text-primary" />
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileContextOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary lg:hidden"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Possible cases
            </button>
            {doctorConnection?.doctorName ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />{" "}
                {doctorConnection.doctorName} supervising
              </span>
            ) : null}
            {doctorConnection?.doctorName ? (
              <button
                type="button"
                onClick={handleCreateReport}
                disabled={isCreatingReport}
                className="hidden items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 lg:inline-flex"
              >
                {isCreatingReport ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {isCreatingReport ? "Preparing report" : "Request doctor review"}
              </button>
            ) : null}
          </div>
        </header>

        {isHistoryOpen ? (
          <div className="border-b border-border bg-card/95 px-4 py-3 shadow-elegant lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Chat history</div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground"
                aria-label="Close chat history"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid max-h-56 gap-2 overflow-y-auto">
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground"
              >
                <Plus className="h-4 w-4 text-primary" />
                New chat
              </button>
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setActiveConversationId(chat.id)}
                  className={`rounded-md border px-3 py-2 text-left ${
                    chat.id === activeConversationId
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-background/60"
                  }`}
                >
                  <div className="truncate text-xs font-medium text-foreground">{chat.title}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {chat.count} message{chat.count === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isMobileContextOpen ? (
          <div className="max-h-[45vh] overflow-y-auto border-b border-border bg-surface px-4 py-4 lg:hidden">
            <LiveReasoningPanel
              reasoning={latestReasoningMessage?.reasoning || null}
              isThinking={isSending}
              onViewDetails={() => {
                if (latestReasoningMessage?.id) setExpandedReasoningId(latestReasoningMessage.id);
              }}
            />
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active context
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-foreground">
                  <UserRound className="h-3.5 w-3.5 text-primary" />
                  {patient.name}
                </div>
                <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-foreground">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  {memories.length} memory item{memories.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8"
        >
          {messages.map((m) => (
            <div key={m.id} className={m.role === "patient" ? "flex justify-end" : ""}>
              <div className={`${m.role === "patient" ? "max-w-[88%] sm:max-w-[78%]" : "w-full"}`}>
                {m.doctorReview ? (
                  <DoctorReviewCard update={m.doctorReview} time={m.time} />
                ) : (
                  <>
                    {m.role === "ai" && (
                      <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-gold" /> Curable AI · {m.time}
                      </div>
                    )}
                    <div
                      className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                        m.role === "patient"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-card-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.actions.map((action) => (
                          <span
                            key={action}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold-foreground"
                          >
                            <Brain className="h-3 w-3" /> {action}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {m.reasoning && expandedReasoningId === m.id ? (
                      <ReasoningDetailCard
                        reasoning={m.reasoning}
                        onClose={() => setExpandedReasoningId(null)}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse text-gold" /> AI is thinking...
            </div>
          )}

          {reportError ? (
            <div className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm leading-relaxed text-foreground">
              {reportError}
            </div>
          ) : null}

          {doctorReport ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-elegant">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3 w-3 text-primary" /> Doctor report preview
                  </div>
                  <h2 className="mt-1 font-serif text-lg text-foreground">
                    {doctorReport.doctorQuestion}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDoctorReport(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close report preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-md border border-border bg-surface p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Situation summary
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">{doctorReport.summary}</p>
              </div>

              {doctorReport.reasoningSnapshot ? (
                <ReportReasoningSnapshot reasoning={doctorReport.reasoningSnapshot} />
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ReportList title="Patient context" items={doctorReport.patientContext} />
                <ReportList title="Medications" items={doctorReport.medicationContext} />
                <ReportList title="Relevant memory" items={doctorReport.memoryContext} />
                <ReportList title="Recent conversation" items={doctorReport.recentConversation} />
              </div>

              {doctorReport.aiSafetyNote ? (
                <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm leading-relaxed text-foreground">
                  {doctorReport.aiSafetyNote}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  This sends the report to {doctorConnection?.doctorName || "your selected doctor"}.
                  Doctor consultation will be a separate room.
                </p>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={isSendingReport || reportSent}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {isSendingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {reportSent ? "Sent to doctor" : "Send to doctor"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="border-t border-border bg-card px-4 py-3 sm:px-6 lg:px-8 lg:py-4"
          onSubmit={handleSend}
        >
          <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a symptom, ask a question…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-accent disabled:opacity-50"
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
            Guided reasoning active · one question at a time · relevant details can become memory.
          </p>
        </form>
      </div>

      {/* Memory side panel */}
      <aside className="hidden h-screen overflow-y-auto bg-surface px-6 py-7 lg:block">
        <LiveReasoningPanel
          reasoning={latestReasoningMessage?.reasoning || null}
          isThinking={isSending}
          onViewDetails={() => {
            if (latestReasoningMessage?.id) setExpandedReasoningId(latestReasoningMessage.id);
          }}
        />

        <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Active context
        </div>
        <h2 className="mt-2 font-serif text-lg text-foreground">Memory in this conversation</h2>

        <div className="mt-5 grid gap-2 text-xs">
          <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-foreground">
            <UserRound className="h-3.5 w-3.5 text-primary" />
            Profile, allergies, conditions
          </div>
          <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-foreground">
            <Pill className="h-3.5 w-3.5 text-primary" />
            Current medications and adherence
          </div>
          <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Saved AI memory facts
          </div>
        </div>

        {patient.pinned && (
          <div className="mt-5 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gold-foreground/80">
              <BookmarkCheck className="h-3 w-3" /> Doctor-pinned
            </div>
            <p className="mt-1 leading-relaxed text-foreground">{patient.pinned}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((layer) => (
            <div key={layer}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">L{layer}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-foreground">
                  {layer === 1 ? "Structured" : layer === 2 ? "Behavioral" : "Episodic"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {memories
                  .filter((s) => s.layer === layer)
                  .map((s) => (
                    <li
                      key={s.id || s.label}
                      className="rounded border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground">{s.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {s.since}
                        </span>
                      </div>
                      {s.details ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                          {s.details}
                        </p>
                      ) : null}
                    </li>
                  ))}
                {memories.filter((s) => s.layer === layer).length === 0 ? (
                  <li className="rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    No saved facts yet.
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function barColor(index: number) {
  if (index === 0) return "bg-primary";
  if (index === 1) return "bg-accent";
  if (index === 2) return "bg-gold";
  return "bg-success";
}

function ReasoningBars({ conditions }: { conditions: ReasoningCondition[] }) {
  return (
    <div className="space-y-3">
      {conditions.map((condition, index) => (
        <div key={`${condition.name}-${index}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-foreground">{condition.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {condition.matchLabel}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor(index)}`}
              style={{ width: `${Math.max(8, Math.min(95, condition.score))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReasoningSkeleton() {
  return (
    <div className="space-y-3">
      {[72, 54, 36].map((width, index) => (
        <div key={width}>
          <div className="mb-1 flex items-center justify-between">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-2.5 w-20 rounded bg-muted" />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full animate-pulse rounded-full ${index === 0 ? "bg-primary/40" : index === 1 ? "bg-accent/40" : "bg-gold/40"}`}
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveReasoningPanel({
  reasoning,
  isThinking,
  onViewDetails,
}: {
  reasoning: ReasoningSnapshot | null;
  isThinking: boolean;
  onViewDetails: () => void;
}) {
  const hasReasoning = Boolean(reasoning?.conditions?.length);

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-elegant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Live reasoning
          </div>
          <h2 className="mt-1 font-serif text-lg text-foreground">Possible explanations</h2>
        </div>
        <span
          className={`mt-0.5 h-2 w-2 rounded-full ${isThinking ? "animate-pulse bg-gold" : hasReasoning ? "bg-success" : "bg-muted-foreground/40"}`}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {isThinking
          ? "Updating the symptom picture..."
          : hasReasoning
            ? reasoning?.readiness === "ready"
              ? "Pattern comparison is ready and will adjust as you answer."
              : "Curable is still collecting the next useful detail."
            : "Describe a symptom to begin the pattern comparison."}
      </p>

      <div className="mt-5">
        {hasReasoning ? (
          <ReasoningBars conditions={reasoning!.conditions} />
        ) : (
          <ReasoningSkeleton />
        )}
      </div>

      {reasoning?.concernSummary ? (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-foreground">
          {reasoning.concernSummary}
        </p>
      ) : null}

      {reasoning?.uncertaintyGaps?.length ? (
        <div className="mt-3 rounded-md border border-border bg-background px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Details still being narrowed
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {reasoning.uncertaintyGaps.slice(0, 3).join(" · ")}
          </p>
        </div>
      ) : null}

      {reasoning?.stewardship?.nextAction ? (
        <div className="mt-3 rounded-md border border-border bg-background px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Current mode
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {reasoning.stewardship.nextAction.split("_").join(" ")}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onViewDetails}
        disabled={!hasReasoning}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown className="h-3.5 w-3.5" /> View reasoning in chat
      </button>
    </section>
  );
}

function ReasoningDetailCard({
  reasoning,
  onClose,
}: {
  reasoning: ReasoningSnapshot;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-5 shadow-elegant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="h-3 w-3 text-primary" /> Reasoning detail
          </div>
          <h3 className="mt-1 font-serif text-lg text-foreground">What Curable is comparing</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close reasoning detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-md border border-border bg-surface p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Your concern
        </div>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{reasoning.concernSummary}</p>
      </div>

      {reasoning.timeline?.length ? (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Timeline
          </div>
          <ol className="grid gap-2 md:grid-cols-2">
            {reasoning.timeline.map((item, index) => (
              <li
                key={`${item.event}-${index}`}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="text-sm font-medium text-foreground">{item.event}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.whenText || "Time unclear"}
                  {item.estimatedDate ? ` - ${item.estimatedDate}` : ""}
                  {item.certainty ? ` - ${item.certainty.replace("_", " ")}` : ""}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Possible explanations
        </div>
        <ReasoningBars conditions={reasoning.conditions} />
      </div>

      {reasoning.uncertaintyGaps?.length ? (
        <div className="mt-5 rounded-md border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Uncertainty gaps
          </div>
          <ul className="mt-2 space-y-1.5">
            {reasoning.uncertaintyGaps.map((item) => (
              <li key={item} className="text-xs leading-relaxed text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {reasoning.conditions.map((condition, index) => (
          <div
            key={`${condition.name}-support-${index}`}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="text-sm font-medium text-foreground">{condition.name}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Why it is being considered
            </div>
            <ul className="mt-2 space-y-1.5">
              {(condition.support?.length
                ? condition.support
                : ["Curable needs more answers before explaining this clearly."]
              ).map((item) => (
                <li key={item} className="text-xs leading-relaxed text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              What weakens it
            </div>
            <ul className="mt-2 space-y-1.5">
              {(condition.weakens?.length
                ? condition.weakens
                : ["Curable has not found a clear weakening detail yet."]
              ).map((item) => (
                <li key={item} className="text-xs leading-relaxed text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Next step chosen
          </div>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {reasoning.nextQuestion || "No extra question chosen for this step."}
          </p>
          {reasoning.stewardship?.reason ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {reasoning.stewardship.reason}
            </p>
          ) : null}
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Context used
          </div>
          <ContextUsedList context={reasoning.usedContext} />
        </div>
      </div>
    </div>
  );
}

function ContextUsedList({ context }: { context?: ReasoningUsedContext }) {
  const items = [
    ...(context?.profile?.map((item) => `Profile: ${item}`) || []),
    ...(context?.medications?.map((item) => `Medication: ${item}`) || []),
    ...(context?.memory?.map((item) => `Memory: ${item}`) || []),
    ...(context?.conversation?.map((item) => `Chat: ${item}`) || []),
  ].slice(0, 6);

  if (!items.length) {
    return (
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        No specific saved context was needed yet.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-xs leading-relaxed text-muted-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

function DoctorReviewCard({ update, time }: { update: DoctorReviewUpdate; time: string }) {
  const needsConsultation = update.outcome === "consultation_started";

  return (
    <div
      className={`rounded-lg border p-5 shadow-elegant ${
        needsConsultation ? "border-accent/40 bg-accent/5" : "border-success/30 bg-success/10"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              needsConsultation
                ? "bg-accent text-primary-foreground"
                : "bg-success text-primary-foreground"
            }`}
          >
            {needsConsultation ? (
              <MessageSquare className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Stethoscope className="h-3 w-3" /> Doctor review · {time}
            </div>
            <h2 className="mt-1 font-serif text-lg text-foreground">{update.title}</h2>
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground">
          {update.doctorName}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground">{update.doctorNote}</p>

      {needsConsultation ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your report has been moved into a separate doctor-patient room.
          </p>
          <Link
            to="/consultation"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-accent"
          >
            <MessageSquare className="h-3.5 w-3.5" /> {update.actionLabel || "Enter consultation"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ReportReasoningSnapshot({ reasoning }: { reasoning: ReasoningSnapshot }) {
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5 text-primary" /> Frozen reasoning snapshot
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{reasoning.concernSummary}</p>

      {reasoning.conditions?.length ? (
        <div className="mt-4">
          <ReasoningBars conditions={reasoning.conditions} />
        </div>
      ) : null}

      {reasoning.timeline?.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {reasoning.timeline.slice(0, 4).map((item, index) => (
            <div
              key={`${item.event}-${index}`}
              className="rounded border border-border bg-surface px-3 py-2"
            >
              <div className="text-xs font-medium text-foreground">{item.event}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {item.whenText || "Time unclear"}
                {item.estimatedDate ? ` - ${item.estimatedDate}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportList({ title, items }: { title: string; items?: string[] }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {items?.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-xs leading-relaxed text-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No relevant details added.</p>
      )}
    </div>
  );
}
