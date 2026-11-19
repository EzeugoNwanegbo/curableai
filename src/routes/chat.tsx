import { createPortal } from "react-dom";
import { useSideMenu } from "@/components/AppShell";
import { addPatientMedication } from "@/api/medications";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Send,
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
} from "lucide-react";
import {
  createDoctorReviewReport,
  getPatientChatState,
  sendDoctorReviewReport,
  sendMessage,
} from "@/api/chat";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { quickRepliesFor } from "@/lib/quick-replies";

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
  consultationId?: string;
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
          consultationId: metadata.consultationId,
        }
      : undefined,
  };
}

function ChatPage() {
  const sideMenu = useSideMenu();
  const { patientId, displayName } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("current");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [patient, setPatient] = useState<{ id: string; name: string; pinned?: string } | null>(
    null,
  );
  const [doctorConnection, setDoctorConnection] = useState<DoctorConnection | null>(null);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const [medicineSuggestion, setMedicineSuggestion] = useState("");
  const [savingMedicine, setSavingMedicine] = useState(false);
  const [medicineNotice, setMedicineNotice] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [reportConfirmed, setReportConfirmed] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedReasoningId, setExpandedReasoningId] = useState<string | null>(null);
  const initializedPatientRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatStateQuery = useQuery({
    queryKey: ["patient-chat-state", patientId],
    refetchInterval: isSending ? false : 10000,
    enabled: Boolean(patientId),
    queryFn: () => getPatientChatState({ data: { patientId: patientId! } }),
  });

  const messages = useMemo(
    () =>
      allMessages.filter(
        (message) => message.doctorReview || message.conversationId === activeConversationId,
      ),
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

  useEffect(() => {
    if (!patientId) return;
    if (chatStateQuery.error && !chatStateQuery.data) {
      setError(chatStateQuery.error.message || "An unexpected error occurred.");
      return;
    }
    if (!chatStateQuery.data) return;

    const state = chatStateQuery.data;
    const pDetails = state.patient;
    setPatient(
      pDetails
        ? {
            id: patientId,
            name: pDetails.full_name,
            pinned: pDetails.pinned_by_doctor,
          }
        : {
            id: patientId,
            name: displayName,
            pinned: "",
          },
    );

    if (state.messages) {
      const mappedMessages = state.messages.map(mapDbMessage);
      setAllMessages(mappedMessages);
      if (initializedPatientRef.current !== patientId) {
        setActiveConversationId(
          mappedMessages[mappedMessages.length - 1]?.conversationId || "current",
        );
        initializedPatientRef.current = patientId;
      }
    }

    setDoctorConnection(state.doctorConnection || null);
    setMemories(
      (state.memories || []).map((m) => ({
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
  }, [chatStateQuery.data, chatStateQuery.error, displayName, patientId]);

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
  }, [isSending, messages]);

  const handleNewChat = () => {
    if (sendingRef.current) return;
    setActiveConversationId(`chat_${Date.now()}`);
    setInput("");
    setExpandedReasoningId(null);
    setDoctorReport(null);
    setSendError(null);
  };

  async function saveSuggestedMedicine() {
    if (!patient || !medicineSuggestion.trim() || savingMedicine) return;
    setSavingMedicine(true);
    setMedicineNotice("");
    try {
      await addPatientMedication({
        data: { patientId: patient.id, name: medicineSuggestion.trim() },
      });
      setMedicineSuggestion("");
      setMedicineNotice("Added to Medication.");
      void queryClient.invalidateQueries({ queryKey: ["patient-medications", patient.id] });
    } catch {
      setMedicineNotice("Could not save the medicine. Try again.");
    } finally {
      setSavingMedicine(false);
    }
  }

  const sendText = async (text: string) => {
    if (!text.trim() || !patient || sendingRef.current) return;
    sendingRef.current = true;
    setSendError(null);
    const reportedMedicine = text
      .trim()
      .match(
        /^I (?:currently take|take|am taking|usually take) ([\p{L}][\p{L} '-]{1,59})(?: daily| every day)?[.!]?$/iu,
      )?.[1]
      ?.replace(/ (?:daily|every day)$/i, "");
    if (reportedMedicine && !savingMedicine) {
      setMedicineSuggestion(reportedMedicine);
      setMedicineNotice("");
    }

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "patient",
      text,
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
          message: text,
          conversationId: activeConversationId,
        },
      });

      const aiMessageId = aiResponse.id || Math.random().toString();
      const aiMessage = {
        id: aiMessageId,
        role: "ai" as const,
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
      };

      setAllMessages((prev) => [...prev, aiMessage]);

      // The reply succeeded. A background refresh must not invite a duplicate send.
      void queryClient.invalidateQueries({ queryKey: ["patient-chat-state", patient.id] });
    } catch {
      setInput(text);
      setSendError("We couldn’t finish that reply. Your text is here so you can try again.");
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendText(input);
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
      setReportConfirmed(false);
      setDoctorReport(report as DoctorReport);
    } catch (err: any) {
      setReportError(err.message || "Could not create doctor report.");
    } finally {
      setIsCreatingReport(false);
    }
  };

  const handleSendReport = async () => {
    if (!patient || !doctorReport || isSendingReport || !reportConfirmed) return;
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
          confirmed: true,
        },
      });
      setReportSent(true);
    } catch (err: any) {
      setReportError(err.message || "Could not send report to doctor.");
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

  const displayPatient = patient || {
    id: patientId || "",
    name: displayName || "Curable user",
    pinned: "",
  };
  const isChatPreparing = chatStateQuery.isLoading && !patient;
  const lastMessage = messages[messages.length - 1];
  const quickReplies =
    lastMessage?.role === "ai" && !isSending
      ? quickRepliesFor(lastMessage.reasoning?.nextQuestion)
      : [];

  return (
    <div className="curable-chat grid min-h-0 grid-cols-1">
      {sideMenu.target
        ? createPortal(
            <section className="mt-5 border-t border-border pt-4" aria-label="Chat history">
              <button
                type="button"
                onClick={() => setIsHistoryOpen((value) => !value)}
                aria-expanded={isHistoryOpen}
                aria-controls="chat-history-list"
                className="flex min-h-11 w-full items-center justify-between text-sm text-foreground"
              >
                History
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isHistoryOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isHistoryOpen ? (
                <div id="chat-history-list" className="space-y-1 pb-4">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      handleNewChat();
                      sideMenu.close();
                    }}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                  >
                    New chat
                  </button>
                  {chatHistory.length ? (
                    chatHistory.map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        disabled={isSending}
                        aria-current={chat.id === activeConversationId ? "true" : undefined}
                        onClick={() => {
                          setActiveConversationId(chat.id);
                          sideMenu.close();
                        }}
                        className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${chat.id === activeConversationId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        <span className="block truncate">{chat.title}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No chat history yet.</p>
                  )}
                </div>
              ) : null}
            </section>,
            sideMenu.target,
          )
        : null}

      {/* Conversation */}
      <div className="curable-chat-thread flex min-h-0 min-w-0 flex-col">
        <header className="curable-chat-header flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isSending}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              New chat
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {doctorConnection?.doctorName ? (
                <span className="sr-only">
                  {doctorConnection.doctorName} selected for optional review
                </span>
              ) : null}
              {doctorConnection?.doctorName ? (
                <button
                  type="button"
                  onClick={handleCreateReport}
                  disabled={isCreatingReport}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
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
          </div>
        </header>

        <div
          ref={scrollRef}
          className="curable-chat-messages flex-1 space-y-8 overflow-y-auto px-4 py-8 sm:px-8"
        >
          {isChatPreparing ? <ChatLoadingSkeleton /> : null}

          {!isChatPreparing && messages.length === 0 ? (
            <div className="curable-chat-empty">
              <h2>What’s bothering you today?</h2>
              <p>
                Hi, I’m Curable, your AI health assistant. I can help you put what you’re feeling
                into words and prepare a note for a doctor if you choose.
              </p>
              <div className="curable-chat-starters">
                {[
                  "I want to discuss a symptom",
                  "Help me understand a medicine",
                  "I have a question about a clinic result",
                ].map((text) => (
                  <button
                    key={text}
                    type="button"
                    disabled={!patient || isSending}
                    onClick={() => setInput(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "patient" ? "flex justify-end" : ""}>
              <div className={`${m.role === "patient" ? "max-w-[88%] sm:max-w-[78%]" : "w-full"}`}>
                {m.doctorReview ? (
                  <DoctorReviewCard update={m.doctorReview} time={m.time} />
                ) : (
                  <>
                    {m.role === "ai" && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        Curable <span aria-hidden="true">·</span> {m.time}
                      </div>
                    )}
                    <div
                      className={`curable-message rounded-xl px-4 py-4 text-base leading-relaxed ${
                        m.role === "patient"
                          ? "bg-secondary text-secondary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.actions.map((action) => (
                          <span key={action} className="text-xs text-muted-foreground">
                            {action}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}

          {isSending && <TypingIndicator />}

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
                <label className="block text-xs text-muted-foreground">
                  Check and edit your summary
                  <textarea
                    aria-label="Your doctor summary"
                    className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground"
                    rows={5}
                    value={doctorReport.summary}
                    disabled={reportSent}
                    onChange={(e) => {
                      setReportConfirmed(false);
                      setDoctorReport({ ...doctorReport, summary: e.target.value });
                    }}
                  />
                </label>
                <label className="mt-4 block text-xs text-muted-foreground">
                  What do you want help with?
                  <textarea
                    aria-label="What you want from the doctor"
                    className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground"
                    rows={2}
                    value={doctorReport.doctorQuestion}
                    disabled={reportSent}
                    onChange={(e) => {
                      setReportConfirmed(false);
                      setDoctorReport({ ...doctorReport, doctorQuestion: e.target.value });
                    }}
                  />
                </label>
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

              <label className="mt-5 flex items-start gap-3 text-xs leading-6 text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={reportConfirmed}
                  disabled={reportSent}
                  onChange={(e) => setReportConfirmed(e.target.checked)}
                />
                <span>
                  I have checked this summary and agree to share it and my available health history
                  with {doctorConnection?.doctorName || "my selected doctor"} for review.
                </span>
              </label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  This sends the report to {doctorConnection?.doctorName || "your selected doctor"}.
                  Doctor consultation will be a separate room.
                </p>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={
                    isSendingReport ||
                    reportSent ||
                    !reportConfirmed ||
                    !doctorReport.summary.trim() ||
                    !doctorReport.doctorQuestion.trim()
                  }
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
          className="curable-composer border-t border-border px-4 py-4 sm:px-8"
          onSubmit={handleSend}
        >
          {sendError ? (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {sendError}
            </p>
          ) : null}
          {(medicineSuggestion || medicineNotice) && (
            <div className="mb-3 rounded-lg border border-border bg-card p-3 text-sm">
              {medicineSuggestion && (
                <>
                  <label className="block">
                    Add this to your medication list?
                    <input
                      className="mt-2 w-full rounded border border-input bg-background p-2"
                      value={medicineSuggestion}
                      maxLength={100}
                      disabled={savingMedicine}
                      onChange={(event) => setMedicineSuggestion(event.currentTarget.value)}
                    />
                  </label>
                  <div className="mt-2 flex gap-4">
                    <button
                      type="button"
                      disabled={savingMedicine || !medicineSuggestion.trim()}
                      className="min-h-11 text-primary"
                      onClick={() => void saveSuggestedMedicine()}
                    >
                      Add medicine
                    </button>
                    <button
                      type="button"
                      disabled={savingMedicine}
                      className="min-h-11"
                      onClick={() => {
                        setMedicineSuggestion("");
                        setMedicineNotice("");
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              )}
              {medicineNotice && <p role="status">{medicineNotice}</p>}
            </div>
          )}
          {quickReplies.length ? (
            <div className="curable-quick-replies" aria-label="Suggested answers">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  disabled={isSending || !patient}
                  onClick={() => void sendText(reply)}
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-3 rounded-xl border border-input bg-card px-4 py-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void sendText(input);
                }
              }}
              rows={2}
              aria-label="Your message to Curable"
              placeholder="Tell Curable what’s on your mind"
              className="min-w-0 flex-1 resize-none bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              disabled={isSending || !patient}
            />
            <button
              type="submit"
              disabled={isSending || !patient || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span aria-hidden="true" className="font-bold">
                  C
                </span>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Common identifying details are filtered before AI requests. Avoid sharing identifying
            details.
          </p>
        </form>
      </div>
    </div>
  );
}

function barColor(index: number) {
  if (index === 0) return "bg-primary";
  if (index === 1) return "bg-accent";
  if (index === 2) return "bg-gold";
  return "bg-success";
}

function ChatLoadingSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading chat">
      <div className="w-full">
        <div className="mb-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-56 max-w-[78%] animate-pulse rounded-lg bg-primary/25" />
      </div>
      <div className="w-full">
        <div className="mb-1.5 h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-7/12 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="w-full">
      <div role="status" className="text-sm text-muted-foreground">
        Curable is preparing a reply…
      </div>
    </div>
  );
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
            Details
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
            search={{ id: update.consultationId }}
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
