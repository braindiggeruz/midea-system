import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  CircleAlert,
  Clock3,
  Flame,
  Loader2,
  Megaphone,
  Radar,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

const stageOptions = [
  "lead_created",
  "quiz_completed",
  "manager_contacted",
  "proposal_sent",
  "sale_closed",
  "repeat_sale",
  "reactivated",
  "lost",
] as const;

const segmentOptions = ["alba", "welkin", "combo", "consult"] as const;
const temperatureOptions = ["hot", "warm", "cold", "won", "lost"] as const;
const automationStatusOptions = ["draft", "active", "paused", "archived"] as const;
const taskPriorityOptions = ["low", "medium", "high", "critical"] as const;

const sectionMeta = {
  "/": {
    eyebrow: "Command Center",
    title: "Midea Digital Contour Admin",
    description:
      "Единый operational cockpit для лидов, менеджеров, Telegram-касаний и сценариев follow-up.",
  },
  "/leads": {
    eyebrow: "Leads Pipeline",
    title: "Pipeline, tasks and deal acceleration",
    description:
      "Фильтрация воронки, работа с карточкой лида, ручные касания и реферальные сценарии.",
  },
  "/automations": {
    eyebrow: "Automation Grid",
    title: "Automation health and delivery discipline",
    description:
      "Контроль статусов automation rules, покрытия Telegram и readiness для owner-команды.",
  },
  "/broadcasts": {
    eyebrow: "Broadcast Studio",
    title: "Telegram campaigns and draft orchestration",
    description:
      "Подготовка рассылок по сегментам и планирование контентных касаний в едином контуре.",
  },
  "/telegram": {
    eyebrow: "Telegram Bridge",
    title: "Bot operations and identity linking",
    description:
      "Проверка профиля бота, тестовые сообщения и привязка Telegram identity к CRM-лидам.",
  },
} as const;

const stageStyles: Record<string, string> = {
  lead_created: "bg-cyan-500/12 text-cyan-200 ring-cyan-400/30",
  quiz_completed: "bg-blue-500/12 text-blue-200 ring-blue-400/30",
  manager_contacted: "bg-violet-500/12 text-violet-200 ring-violet-400/30",
  proposal_sent: "bg-fuchsia-500/12 text-fuchsia-200 ring-fuchsia-400/30",
  sale_closed: "bg-emerald-500/12 text-emerald-200 ring-emerald-400/30",
  repeat_sale: "bg-lime-500/12 text-lime-200 ring-lime-400/30",
  reactivated: "bg-amber-500/12 text-amber-200 ring-amber-400/30",
  lost: "bg-rose-500/12 text-rose-200 ring-rose-400/30",
};

const temperatureStyles: Record<string, string> = {
  hot: "bg-rose-500/12 text-rose-200 ring-rose-400/30",
  warm: "bg-amber-500/12 text-amber-200 ring-amber-400/30",
  cold: "bg-slate-500/12 text-slate-200 ring-slate-400/30",
  won: "bg-emerald-500/12 text-emerald-200 ring-emerald-400/30",
  lost: "bg-zinc-500/12 text-zinc-200 ring-zinc-400/30",
};

const stageChartColors: Record<string, string> = {
  lead_created: "#45f7ff",
  quiz_completed: "#1ea7ff",
  manager_contacted: "#7c5cff",
  proposal_sent: "#d84dff",
  sale_closed: "#3ce6a6",
  repeat_sale: "#91f500",
  reactivated: "#ffca4a",
  lost: "#ff5b7a",
};

const segmentChartColors: Record<string, string> = {
  alba: "#45f7ff",
  welkin: "#3ce6a6",
  combo: "#d84dff",
  consult: "#ffca4a",
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatCurrency(value: number | string | null | undefined) {
  const normalized = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(normalized as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(normalized));
}

function formatDateTime(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatShortDate(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function statusPill(value: string, type: "stage" | "temperature" = "stage") {
  const styles = type === "stage" ? stageStyles : temperatureStyles;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 backdrop-blur ${styles[value] ?? "bg-muted text-muted-foreground ring-border"}`}
    >
      {formatLabel(value)}
    </span>
  );
}

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-card/75 p-5 shadow-[0_24px_80px_-28px_rgba(18,247,255,0.35)] backdrop-blur-xl md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-card-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-background/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">{icon}</span>
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function HomeContent() {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [segment, setSegment] = useState<string>("all");
  const [temperature, setTemperature] = useState<string>("all");
  const [assignedManagerId, setAssignedManagerId] = useState<string>("all");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("lead_created");
  const [statusReason, setStatusReason] = useState("");
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<string>("medium");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [leadPingText, setLeadPingText] = useState(
    "Здравствуйте! Спасибо за интерес к Midea. Мы подготовили для вас персональное follow-up предложение."
  );
  const [testChatId, setTestChatId] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Контрольное сообщение из Midea Digital Contour Admin. Telegram bridge активен."
  );
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastSegment, setBroadcastSegment] = useState<string>("all");
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState("");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState("");
  const [broadcastScheduledAt, setBroadcastScheduledAt] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralRewardLabel, setReferralRewardLabel] = useState("Filter bonus");
  const [referralRewardValue, setReferralRewardValue] = useState("25");
  const [spendSource, setSpendSource] = useState("telegram_ads");
  const [spendCampaign, setSpendCampaign] = useState("spring_retargeting");
  const [spendCreative, setSpendCreative] = useState("filters_bundle");
  const [spendUsd, setSpendUsd] = useState("0");
  const [spendNotes, setSpendNotes] = useState("Safe-mode manual spend entry");

  const currentSection =
    location === "/leads" || location === "/automations" || location === "/broadcasts" || location === "/telegram"
      ? location
      : "/";
  const activeMeta = sectionMeta[currentSection];

  const leadFilters = useMemo(
    () => ({
      query: query.trim() || undefined,
      stage: stage as any,
      segment: segment as any,
      temperature: temperature as any,
      assignedManagerId: assignedManagerId === "all" ? undefined : Number(assignedManagerId),
    }),
    [assignedManagerId, query, segment, stage, temperature]
  );

  const authQuery = trpc.auth.me.useQuery();
  const isAdmin = authQuery.data?.role === "admin";
  const overviewQuery = trpc.dashboard.overview.useQuery();
  const managersQuery = trpc.dashboard.managers.useQuery();
  const pipelineQuery = trpc.dashboard.pipeline.useQuery();
  const funnelQuery = trpc.dashboard.funnel.useQuery();
  const acquisitionQuery = trpc.dashboard.acquisition.useQuery();
  const spendEntriesQuery = trpc.dashboard.spendEntries.useQuery(undefined, { enabled: isAdmin });
  const automationsHealthQuery = trpc.dashboard.automationsHealth.useQuery();
  const leadsQuery = trpc.leads.list.useQuery(leadFilters);
  const automationsQuery = trpc.automations.list.useQuery();
  const broadcastsQuery = trpc.broadcasts.list.useQuery();
  const telegramProfileQuery = trpc.telegram.profile.useQuery();
  const leadDetailQuery = trpc.leads.detail.useQuery(
    { leadId: selectedLeadId ?? 1 },
    { enabled: Boolean(selectedLeadId) }
  );

  useEffect(() => {
    if (!leadsQuery.data?.length) {
      setSelectedLeadId(null);
      return;
    }

    const stillExists = leadsQuery.data.some((lead) => lead.id === selectedLeadId);
    if (!selectedLeadId || !stillExists) {
      setSelectedLeadId(leadsQuery.data[0].id);
    }
  }, [leadsQuery.data, selectedLeadId]);

  useEffect(() => {
    if (leadDetailQuery.data?.lead?.stage) {
      setSelectedStage(leadDetailQuery.data.lead.stage);
      setTelegramUsername(leadDetailQuery.data.lead.telegramUsername ?? "");
      setTelegramUserId(
        leadDetailQuery.data.lead.telegramUserId
          ? String(leadDetailQuery.data.lead.telegramUserId)
          : ""
      );
      if (!referralCode) {
        const slug = (leadDetailQuery.data.lead.fullName ?? "lead")
          .split(" ")
          .slice(0, 2)
          .map((part) => part.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
          .join("-")
          .slice(0, 16);
        setReferralCode(`${slug || "MIDEA"}-${leadDetailQuery.data.lead.id}`);
      }
    }
  }, [leadDetailQuery.data?.lead, referralCode]);

  const stageDistribution = (overviewQuery.data?.stageDistribution ?? []).map((row) => ({
    ...row,
    fill: stageChartColors[row.stage] ?? "#45f7ff",
  }));
  const segmentDistribution = (overviewQuery.data?.segmentDistribution ?? []).map((row) => ({
    ...row,
    fill: segmentChartColors[row.segment] ?? "#45f7ff",
  }));

  const pipelineBoard = useMemo(() => {
    const rows = pipelineQuery.data ?? [];
    return stageOptions.map((stageKey) => ({
      stage: stageKey,
      leads: rows.filter((row) => row.stage === stageKey),
      totalRevenue: rows
        .filter((row) => row.stage === stageKey)
        .reduce((sum, row) => sum + (row.expectedRevenueUsd ?? 0), 0),
    }));
  }, [pipelineQuery.data]);

  const funnelRows = funnelQuery.data ?? [];
  const acquisitionRows = acquisitionQuery.data ?? [];
  const topAcquisitionRows = acquisitionRows.slice(0, 4);
  const spendEntries = spendEntriesQuery.data ?? [];
  const finalFunnelStage = funnelRows[funnelRows.length - 1];

  const refreshAll = async () => {
    await Promise.all([
      utils.dashboard.overview.invalidate(),
      utils.dashboard.managers.invalidate(),
      utils.dashboard.pipeline.invalidate(),
      utils.dashboard.funnel.invalidate(),
      utils.dashboard.acquisition.invalidate(),
      utils.dashboard.spendEntries.invalidate(),
      utils.dashboard.automationsHealth.invalidate(),
      utils.leads.list.invalidate(),
      utils.broadcasts.list.invalidate(),
      utils.automations.list.invalidate(),
      utils.telegram.profile.invalidate(),
      utils.leads.detail.invalidate(),
    ]);
    toast.success("Dashboard data refreshed");
  };

  const updateStageMutation = trpc.leads.updateStage.useMutation();
  const addNoteMutation = trpc.leads.addNote.useMutation();
  const createTaskMutation = trpc.leads.createTask.useMutation();
  const linkTelegramMutation = trpc.leads.linkTelegramIdentity.useMutation();
  const sendLeadPingMutation = trpc.telegram.sendLeadPing.useMutation();
  const sendTestMessageMutation = trpc.telegram.sendTestMessage.useMutation();
  const createBroadcastMutation = trpc.broadcasts.createDraft.useMutation();
  const dispatchBroadcastMutation = trpc.broadcasts.dispatchNow.useMutation();
  const automationStatusMutation = trpc.automations.setStatus.useMutation();
  const executeAutomationMutation = trpc.automations.executeNow.useMutation();
  const createReferralMutation = trpc.referrals.create.useMutation();
  const saveSpendEntryMutation = trpc.dashboard.saveSpendEntry.useMutation();

  const busy =
    updateStageMutation.isPending ||
    addNoteMutation.isPending ||
    createTaskMutation.isPending ||
    linkTelegramMutation.isPending ||
    sendLeadPingMutation.isPending ||
    sendTestMessageMutation.isPending ||
    createBroadcastMutation.isPending ||
    dispatchBroadcastMutation.isPending ||
    automationStatusMutation.isPending ||
    executeAutomationMutation.isPending ||
    createReferralMutation.isPending ||
    saveSpendEntryMutation.isPending;

  const leadDetail = leadDetailQuery.data;
  const selectedLead = leadDetail?.lead;
  const kpis = overviewQuery.data?.kpis;
  const automationsHealth = automationsHealthQuery.data;

  const topLoading =
    authQuery.isLoading ||
    overviewQuery.isLoading ||
    leadsQuery.isLoading ||
    managersQuery.isLoading ||
    pipelineQuery.isLoading ||
    funnelQuery.isLoading ||
    acquisitionQuery.isLoading ||
    (isAdmin && spendEntriesQuery.isLoading) ||
    automationsQuery.isLoading ||
    broadcastsQuery.isLoading ||
    telegramProfileQuery.isLoading;

  const handleSaveSpendEntry = async () => {
    if (!isAdmin) return;
    if (!spendSource.trim() || !spendCampaign.trim() || !spendCreative.trim()) {
      toast.error("Source, campaign and creative are required");
      return;
    }

    try {
      await saveSpendEntryMutation.mutateAsync({
        source: spendSource.trim(),
        campaign: spendCampaign.trim(),
        creative: spendCreative.trim(),
        spendUsd: Number(spendUsd) || 0,
        notes: spendNotes.trim() || null,
      });
      await Promise.all([
        utils.dashboard.spendEntries.invalidate(),
        utils.dashboard.acquisition.invalidate(),
      ]);
      toast.success("Safe-mode spend saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save spend entry");
    }
  };

  const handleStageSubmit = async () => {
    if (!selectedLeadId) return;
    try {
      await updateStageMutation.mutateAsync({
        leadId: selectedLeadId,
        stage: selectedStage as (typeof stageOptions)[number],
        statusReason: statusReason.trim() || null,
      });
      await Promise.all([
        utils.leads.list.invalidate(),
        utils.leads.detail.invalidate({ leadId: selectedLeadId }),
        utils.dashboard.overview.invalidate(),
        utils.dashboard.pipeline.invalidate(),
      ]);
      toast.success("Lead stage updated");
      setStatusReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stage");
    }
  };

  const handleAddNote = async () => {
    if (!selectedLeadId || note.trim().length < 3) return;
    try {
      await addNoteMutation.mutateAsync({
        leadId: selectedLeadId,
        note: note.trim(),
      });
      await utils.leads.detail.invalidate({ leadId: selectedLeadId });
      toast.success("Manager note added");
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    }
  };

  const handleCreateTask = async () => {
    if (!selectedLeadId || taskTitle.trim().length < 3) return;
    try {
      await createTaskMutation.mutateAsync({
        leadId: selectedLeadId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        assignedToUserId:
          selectedLead?.assignedManagerId ??
          (assignedManagerId !== "all" ? Number(assignedManagerId) : null),
        dueAt: taskDueAt ? new Date(taskDueAt) : null,
        priority: taskPriority as (typeof taskPriorityOptions)[number],
      });
      await utils.leads.detail.invalidate({ leadId: selectedLeadId });
      toast.success("Lead task created");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueAt("");
      setTaskPriority("medium");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    }
  };

  const handleLinkTelegram = async () => {
    if (!selectedLeadId) return;
    try {
      await linkTelegramMutation.mutateAsync({
        leadId: selectedLeadId,
        telegramUserId: telegramUserId.trim() ? Number(telegramUserId) : null,
        telegramUsername: telegramUsername.trim() || null,
      });
      await Promise.all([
        utils.leads.detail.invalidate({ leadId: selectedLeadId }),
        utils.leads.list.invalidate(),
        utils.dashboard.overview.invalidate(),
      ]);
      toast.success("Telegram identity linked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link Telegram identity");
    }
  };

  const handleLeadPing = async () => {
    if (!selectedLeadId || !leadPingText.trim()) return;
    try {
      await sendLeadPingMutation.mutateAsync({
        leadId: selectedLeadId,
        text: leadPingText.trim(),
      });
      await Promise.all([
        utils.leads.detail.invalidate({ leadId: selectedLeadId }),
        utils.dashboard.overview.invalidate(),
      ]);
      toast.success("Telegram message sent to lead");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send Telegram ping");
    }
  };

  const handleSendTestMessage = async () => {
    if (!testChatId.trim() || !testMessage.trim()) return;
    try {
      await sendTestMessageMutation.mutateAsync({
        chatId: testChatId.trim(),
        text: testMessage.trim(),
      });
      toast.success("Telegram test message sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test message");
    }
  };

  const handleCreateBroadcast = async () => {
    if (broadcastTitle.trim().length < 3 || broadcastBody.trim().length < 10) return;
    try {
      await createBroadcastMutation.mutateAsync({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        segment: broadcastSegment === "all" ? null : (broadcastSegment as (typeof segmentOptions)[number]),
        ctaLabel: broadcastCtaLabel.trim() || null,
        ctaUrl: broadcastCtaUrl.trim() || null,
        scheduledAt: broadcastScheduledAt ? new Date(broadcastScheduledAt) : null,
      });
      await utils.broadcasts.list.invalidate();
      toast.success("Broadcast draft created");
      setBroadcastTitle("");
      setBroadcastBody("");
      setBroadcastSegment("all");
      setBroadcastCtaLabel("");
      setBroadcastCtaUrl("");
      setBroadcastScheduledAt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create broadcast");
    }
  };

  const handleAutomationStatus = async (
    ruleId: number,
    status: (typeof automationStatusOptions)[number]
  ) => {
    try {
      await automationStatusMutation.mutateAsync({ ruleId, status });
      await Promise.all([
        utils.automations.list.invalidate(),
        utils.dashboard.overview.invalidate(),
        utils.dashboard.automationsHealth.invalidate(),
      ]);
      toast.success(`Automation moved to ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update automation status");
    }
  };

  const handleExecuteAutomation = async (ruleId?: number) => {
    try {
      const result = await executeAutomationMutation.mutateAsync(
        ruleId ? { ruleId } : undefined
      );
      await Promise.all([
        utils.automations.list.invalidate(),
        utils.dashboard.overview.invalidate(),
        utils.dashboard.automationsHealth.invalidate(),
        utils.leads.detail.invalidate(),
      ]);
      toast.success(
        `Automation run complete: ${result.sentCount} sent, ${result.failedCount} failed`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to execute automation");
    }
  };

  const handleCreateReferral = async () => {
    if (!selectedLeadId || referralCode.trim().length < 4) return;
    try {
      await createReferralMutation.mutateAsync({
        leadId: selectedLeadId,
        code: referralCode.trim().toUpperCase(),
        rewardLabel: referralRewardLabel.trim() || undefined,
        rewardValueUsd: referralRewardValue.trim() || undefined,
      });
      await utils.leads.detail.invalidate({ leadId: selectedLeadId });
      toast.success("Referral invite created");
      setReferralCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create referral invite");
    }
  };

  const handleDispatchBroadcast = async (broadcastId: number) => {
    try {
      const result = await dispatchBroadcastMutation.mutateAsync({ broadcastId });
      await Promise.all([
        utils.broadcasts.list.invalidate(),
        utils.dashboard.overview.invalidate(),
      ]);
      toast.success(
        `Broadcast dispatched: ${result.sentCount}/${result.totalTargets} delivered`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to dispatch broadcast");
    }
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(69,247,255,0.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(216,77,255,0.18),transparent_32%),linear-gradient(140deg,rgba(10,18,40,0.98),rgba(18,8,35,0.92))] p-6 shadow-[0_35px_120px_-50px_rgba(18,247,255,0.75)] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:26px_26px] opacity-35" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-primary">
              {activeMeta.eyebrow}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {activeMeta.title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                {activeMeta.description}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[430px]">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Telegram readiness</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {overviewQuery.data?.deliveryReadiness.hasTelegramToken ? "Online" : "Token missing"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Reachable leads: {overviewQuery.data?.deliveryReadiness.leadsWithTelegramId ?? 0}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Automation events</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {automationsHealth?.total ?? 0}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Sent {automationsHealth?.sent ?? 0} · queued {automationsHealth?.queued ?? 0} · failed {automationsHealth?.failed ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          {Object.entries(sectionMeta).map(([path, meta]) => (
            <button
              key={path}
              type="button"
              onClick={() => setLocation(path)}
              className={`rounded-full border px-4 py-2 text-sm transition-all ${currentSection === path ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_35px_rgba(18,247,255,0.18)]" : "border-white/10 bg-white/5 text-slate-300 hover:border-primary/25 hover:text-white"}`}
            >
              {meta.eyebrow}
            </button>
          ))}
          <Button
            variant="outline"
            className="ml-auto border-primary/30 bg-background/20 text-primary hover:bg-primary/10"
            onClick={refreshAll}
            disabled={busy}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh data
          </Button>
        </div>
      </header>

      {topLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-white/10 bg-card/70 backdrop-blur-xl">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading operational dashboard…
          </div>
        </div>
      ) : null}

      {!topLoading && (currentSection === "/" || currentSection === "/automations" || currentSection === "/telegram") ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total leads"
            value={String(kpis?.totalLeads ?? 0)}
            subtitle="Tracked in the contour"
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="Hot opportunities"
            value={String(kpis?.hotLeads ?? 0)}
            subtitle="Need fast follow-up"
            icon={<Flame className="h-4 w-4" />}
          />
          <MetricCard
            title="Projected revenue"
            value={formatCurrency(kpis?.projectedRevenueUsd)}
            subtitle="Pipeline forecast"
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            title="Automation coverage"
            value={`${kpis?.automationCoverage ?? 0}%`}
            subtitle="Rules currently active"
            icon={<Radar className="h-4 w-4" />}
          />
        </div>
      ) : null}

      {!topLoading && currentSection === "/" ? (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <SectionCard
              title="Pipeline pulse"
              description="Распределение лидов по стадиям и сегментам воронки в текущем operational цикле."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-background/55 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Stage distribution</p>
                    <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Realtime</span>
                  </div>
                  <ChartContainer
                    className="h-[260px] w-full"
                    config={{ total: { label: "Leads", color: "#45f7ff" } }}
                  >
                    <BarChart data={stageDistribution}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="stage" tickFormatter={formatLabel} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                      <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                        {stageDistribution.map((entry) => (
                          <Cell key={entry.stage} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-background/55 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Segment mix</p>
                    <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Audience</span>
                  </div>
                  <ChartContainer
                    className="h-[260px] w-full"
                    config={{ total: { label: "Leads", color: "#d84dff" } }}
                  >
                    <PieChart>
                      <Pie
                        data={segmentDistribution}
                        dataKey="total"
                        nameKey="segment"
                        innerRadius={62}
                        outerRadius={94}
                        paddingAngle={4}
                      >
                        {segmentDistribution.map((entry) => (
                          <Cell key={entry.segment} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent nameKey="segment" labelFormatter={(value) => formatLabel(String(value))} />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {segmentDistribution.map((entry) => (
                      <div key={entry.segment} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        {formatLabel(entry.segment)} · {entry.total}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Revenue lanes"
              description="Mini-kanban по стадиям, чтобы owner видел где скапливается объём и где нужен ручной follow-up."
            >
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {pipelineBoard.map((lane) => (
                  <div key={lane.stage} className="rounded-[1.35rem] border border-white/10 bg-background/55 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatLabel(lane.stage)}</p>
                        <p className="text-xs text-muted-foreground">{lane.leads.length} leads</p>
                      </div>
                      {statusPill(lane.stage)}
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">{formatCurrency(lane.totalRevenue)}</p>
                    <div className="mt-4 space-y-2">
                      {lane.leads.slice(0, 3).map((lead) => (
                        <button
                          type="button"
                          key={lead.id}
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setLocation("/leads");
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-card/70 px-3 py-2 text-left transition hover:border-primary/30"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{lead.fullName}</p>
                            <p className="text-xs text-muted-foreground">Manager #{lead.assignedManagerId ?? "unassigned"}</p>
                          </div>
                          {statusPill(lead.temperature, "temperature")}
                        </button>
                      ))}
                      {lane.leads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-muted-foreground">
                          No leads in this lane yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Funnel and acquisition intelligence"
              description="Сводка по полной воронке ad_click → sale_closed и top UTM/source cohorts прямо на главном экране owner-команды."
            >
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  {funnelRows.map((row) => (
                    <div
                      key={row.stage}
                      className="rounded-[1.35rem] border border-white/10 bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{row.order}. {formatLabel(row.stage)}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.total} contacts · {row.conversionFromStartPct}% from start
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">{row.conversionFromPreviousPct}%</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">step conversion</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Projected revenue</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.projectedRevenueUsd)}</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Average score</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{row.averageScore}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.35rem] border border-primary/20 bg-primary/10 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary/80">End-state snapshot</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{finalFunnelStage?.total ?? 0} closed sales</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Финальный этап держит {finalFunnelStage?.conversionFromStartPct ?? 0}% от стартового входящего потока.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {topAcquisitionRows.map((row) => (
                      <div
                        key={`${row.source}-${row.campaign}-${row.creative}`}
                        className="rounded-[1.35rem] border border-white/10 bg-background/55 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{row.source} / {row.campaign}</p>
                            <p className="text-xs text-muted-foreground">Creative: {row.creative}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>{row.leadCount} leads</p>
                            <p>{row.saleClosedCount} closed</p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quiz</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{row.conversionToQuizPct}%</p>
                          </div>
                          <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Qualified</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{row.conversionToQualifiedPct}%</p>
                          </div>
                          <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Spend</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.spendUsd)}</p>
                          </div>
                          <div className="rounded-xl border border-white/8 bg-card/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">CPL</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.cplUsd)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {row.segments.slice(0, 3).map((segmentRow) => (
                            <span
                              key={`${row.source}-${row.campaign}-${segmentRow.segment}`}
                              className="inline-flex items-center rounded-full border border-white/10 bg-card/70 px-3 py-1 text-[11px] text-muted-foreground"
                            >
                              {formatLabel(segmentRow.segment)} · {segmentRow.total}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {topAcquisitionRows.length === 0 ? (
                      <div className="rounded-[1.35rem] border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
                        Acquisition analytics will appear here once the first attributed cohorts arrive.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </SectionCard>

            {isAdmin ? (
              <SectionCard
                title="Safe-mode spend control"
                description="Ручной ввод затрат по source / campaign / creative для расчёта CPL без внешней ad-интеграции."
              >
                <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-muted-foreground">
                      <span>Source</span>
                      <input
                        value={spendSource}
                        onChange={(event) => setSpendSource(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                        placeholder="telegram_ads"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-muted-foreground">
                      <span>Campaign</span>
                      <input
                        value={spendCampaign}
                        onChange={(event) => setSpendCampaign(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                        placeholder="spring_retargeting"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-muted-foreground">
                      <span>Creative</span>
                      <input
                        value={spendCreative}
                        onChange={(event) => setSpendCreative(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                        placeholder="filters_bundle"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-muted-foreground">
                      <span>Spend USD</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={spendUsd}
                        onChange={(event) => setSpendUsd(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-muted-foreground sm:col-span-2">
                      <span>Notes</span>
                      <textarea
                        value={spendNotes}
                        onChange={(event) => setSpendNotes(event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                        placeholder="Manual correction or campaign note"
                      />
                    </label>
                    <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-[1.25rem] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
                      <p>Этот режим не зависит от внешнего кабинета и безопасен для старта: CPL пересчитывается сразу после сохранения.</p>
                      <Button onClick={handleSaveSpendEntry} disabled={busy || saveSpendEntryMutation.isPending} className="rounded-full px-5">
                        {saveSpendEntryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save spend
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {spendEntries.map((entry) => (
                      <div
                        key={`${entry.source}-${entry.campaign}-${entry.creative}`}
                        className="rounded-[1.25rem] border border-white/10 bg-background/55 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{entry.source} / {entry.campaign}</p>
                            <p className="text-xs text-muted-foreground">Creative: {entry.creative}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">{formatCurrency(entry.spendUsd)}</p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">manual spend</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Updated: {formatDateTime(entry.updatedAt ?? entry.createdAt)}</span>
                          {entry.notes ? <span className="rounded-full border border-white/10 px-2 py-1">{entry.notes}</span> : null}
                        </div>
                      </div>
                    ))}
                    {spendEntries.length === 0 ? (
                      <div className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
                        Сохраните первую spend-запись, и CPL автоматически появится в acquisition cards.
                      </div>
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            ) : null}
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Follow-up queue"
              description="Ближайшие касания, которые нельзя потерять в owner и manager workstream."
            >
              <div className="space-y-3">
                {(overviewQuery.data?.followUpQueue ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.leadId}
                    onClick={() => {
                      setSelectedLeadId(item.leadId);
                      setLocation("/leads");
                    }}
                    className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-background/55 px-4 py-3 text-left transition hover:border-primary/30"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{item.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Next touch {formatDateTime(item.nextFollowUpAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {statusPill(item.stage)}
                      {statusPill(item.temperature, "temperature")}
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Delivery readiness"
              description="Быстрая сводка по Telegram и operational health перед рассылками и ручными касаниями."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bot token</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {overviewQuery.data?.deliveryReadiness.hasTelegramToken ? "Connected" : "Missing"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent Telegram messages</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {overviewQuery.data?.deliveryReadiness.recentMessages ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bot identity</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    @{telegramProfileQuery.data?.username ?? "mideasystembot"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {telegramProfileQuery.data?.first_name ?? "Midea System Bot"}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Recent lead movements"
              description="Последние изменения для быстрого перехода в карточку лида."
            >
              <div className="space-y-3">
                {(overviewQuery.data?.recentLeads ?? []).slice(0, 6).map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setLocation("/leads");
                    }}
                    className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-background/55 px-4 py-3 text-left transition hover:border-primary/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.city ?? "Unknown city"} · {lead.productInterest ?? "No product yet"}
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      {statusPill(lead.stage)}
                      <p className="text-xs text-muted-foreground">{formatCurrency(lead.expectedRevenueUsd)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {!topLoading && currentSection === "/leads" ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <SectionCard
              title="Lead intelligence matrix"
              description="Фильтры и shortlist для owner/manager сценариев. Выберите лид, чтобы открыть правую detail-панель."
            >
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, phone or Telegram"
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-primary/40"
                />
                <select
                  value={stage}
                  onChange={(event) => setStage(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="all">All stages</option>
                  {stageOptions.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <select
                  value={segment}
                  onChange={(event) => setSegment(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="all">All segments</option>
                  {segmentOptions.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <select
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="all">All temperatures</option>
                  {temperatureOptions.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <select
                  value={assignedManagerId}
                  onChange={(event) => setAssignedManagerId(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="all">All managers</option>
                  {(managersQuery.data ?? []).map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name ?? `Manager #${manager.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-hidden rounded-[1.35rem] border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-background/80 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Lead</th>
                        <th className="px-4 py-3">Segment</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Temperature</th>
                        <th className="px-4 py-3">Revenue</th>
                        <th className="px-4 py-3">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-background/35">
                      {(leadsQuery.data ?? []).map((lead) => (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLeadId(lead.id)}
                          className={`cursor-pointer transition hover:bg-primary/6 ${selectedLeadId === lead.id ? "bg-primary/10" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">{lead.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                {lead.phone || lead.telegramUsername || "No contact yet"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatLabel(lead.segment)}</td>
                          <td className="px-4 py-3">{statusPill(lead.stage)}</td>
                          <td className="px-4 py-3">{statusPill(lead.temperature, "temperature")}</td>
                          <td className="px-4 py-3 text-foreground">{formatCurrency(lead.expectedRevenueUsd)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(lead.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title={selectedLead ? selectedLead.fullName : "Lead detail"}
              description={
                selectedLead
                  ? `${selectedLead.city ?? "Unknown city"} · ${selectedLead.productInterest ?? "No product selected"}`
                  : "Выберите лид слева, чтобы открыть карточку с задачами, заметками и Telegram actions."
              }
            >
              {!selectedLead ? (
                <div className="rounded-[1.3rem] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                  Lead card will appear here after selection.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current stage</p>
                      <div className="mt-3">{statusPill(selectedLead.stage)}</div>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Temperature</p>
                      <div className="mt-3">{statusPill(selectedLead.temperature, "temperature")}</div>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Projected value</p>
                      <p className="mt-3 text-lg font-semibold text-foreground">{formatCurrency(selectedLead.expectedRevenueUsd)}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next follow-up</p>
                      <p className="mt-3 text-sm text-foreground">{formatDateTime(selectedLead.nextFollowUpAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                    <p className="text-sm font-medium text-foreground">Stage control</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <select
                        value={selectedStage}
                        onChange={(event) => setSelectedStage(event.target.value)}
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                      >
                        {stageOptions.map((item) => (
                          <option key={item} value={item}>
                            {formatLabel(item)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={statusReason}
                        onChange={(event) => setStatusReason(event.target.value)}
                        placeholder="Reason or manager note"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                      <Button onClick={handleStageSubmit} disabled={updateStageMutation.isPending}>
                        Update stage
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                    <p className="text-sm font-medium text-foreground">Telegram identity and ping</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        value={telegramUsername}
                        onChange={(event) => setTelegramUsername(event.target.value)}
                        placeholder="telegram username"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                      <input
                        value={telegramUserId}
                        onChange={(event) => setTelegramUserId(event.target.value)}
                        placeholder="telegram numeric user id"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={handleLinkTelegram} disabled={linkTelegramMutation.isPending}>
                        Link identity
                      </Button>
                      <Button onClick={handleLeadPing} disabled={sendLeadPingMutation.isPending}>
                        <Send className="mr-2 h-4 w-4" />
                        Send lead ping
                      </Button>
                    </div>
                    <textarea
                      value={leadPingText}
                      onChange={(event) => setLeadPingText(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-sm font-medium text-foreground">Manager note</p>
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={5}
                        placeholder="Capture objections, room dimensions, pricing context or handoff notes."
                        className="mt-3 w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                      <Button className="mt-3" onClick={handleAddNote} disabled={addNoteMutation.isPending}>
                        Save note
                      </Button>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                      <p className="text-sm font-medium text-foreground">Create task</p>
                      <div className="mt-3 space-y-3">
                        <input
                          value={taskTitle}
                          onChange={(event) => setTaskTitle(event.target.value)}
                          placeholder="Task title"
                          className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                        />
                        <textarea
                          value={taskDescription}
                          onChange={(event) => setTaskDescription(event.target.value)}
                          rows={3}
                          placeholder="Describe the follow-up action"
                          className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            value={taskPriority}
                            onChange={(event) => setTaskPriority(event.target.value)}
                            className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                          >
                            {taskPriorityOptions.map((item) => (
                              <option key={item} value={item}>
                                {formatLabel(item)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={taskDueAt}
                            onChange={(event) => setTaskDueAt(event.target.value)}
                            className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                          />
                        </div>
                        <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
                          Create task
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                    <p className="text-sm font-medium text-foreground">Referral invite</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <input
                        value={referralCode}
                        onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                        placeholder="Referral code"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                      <input
                        value={referralRewardLabel}
                        onChange={(event) => setReferralRewardLabel(event.target.value)}
                        placeholder="Reward label"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                      <input
                        value={referralRewardValue}
                        onChange={(event) => setReferralRewardValue(event.target.value)}
                        placeholder="Reward USD"
                        className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </div>
                    <Button className="mt-3" variant="outline" onClick={handleCreateReferral} disabled={createReferralMutation.isPending}>
                      Create referral invite
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>

            {selectedLead ? (
              <SectionCard
                title="Lead activity ribbon"
                description="Краткая история заметок, сообщений, задач и referral-кодов по выбранному лиду."
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
                    <div className="space-y-2">
                      {(leadDetail?.notes ?? []).slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-background/55 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{item.authorName ?? `User #${item.authorUserId}`}</p>
                            <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Tasks</p>
                    <div className="space-y-2">
                      {(leadDetail?.tasks ?? []).slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-background/55 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            {statusPill(item.priority, "temperature")}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {formatDateTime(item.dueAt)} · status {formatLabel(item.status)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Communications</p>
                    <div className="space-y-2">
                      {(leadDetail?.communications ?? []).slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-background/55 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{item.subject || formatLabel(item.channel)}</p>
                            <span className="text-xs text-muted-foreground">{formatDateTime(item.sentAt || item.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Referrals</p>
                    <div className="space-y-2">
                      {(leadDetail?.referrals ?? []).slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-background/55 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{item.code}</p>
                            {statusPill(item.status)}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.rewardLabel || "Reward"} · {formatCurrency(item.rewardValueUsd)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {!topLoading && currentSection === "/automations" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <SectionCard
              title="Automation health snapshot"
              description="Queue vs sent vs failed: базовая телеметрия сценариев и их delivery-контур."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Queued"
                  value={String(automationsHealth?.queued ?? 0)}
                  subtitle="Waiting in line"
                  icon={<Clock3 className="h-4 w-4" />}
                />
                <MetricCard
                  title="Sent"
                  value={String(automationsHealth?.sent ?? 0)}
                  subtitle="Delivered actions"
                  icon={<Send className="h-4 w-4" />}
                />
                <MetricCard
                  title="Failed"
                  value={String(automationsHealth?.failed ?? 0)}
                  subtitle="Need review"
                  icon={<CircleAlert className="h-4 w-4" />}
                />
                <MetricCard
                  title="Reachable"
                  value={String(overviewQuery.data?.deliveryReadiness.leadsWithTelegramId ?? 0)}
                  subtitle="Telegram-linked leads"
                  icon={<Bot className="h-4 w-4" />}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Delivery checklist"
              description="Короткий owner-чек перед запуском campaign и automation waves."
            >
              <div className="space-y-3">
                {[
                  {
                    label: "TELEGRAM_BOT_TOKEN присутствует в окружении",
                    value: overviewQuery.data?.deliveryReadiness.hasTelegramToken,
                  },
                  {
                    label: "Есть лиды с Telegram identity",
                    value: (overviewQuery.data?.deliveryReadiness.leadsWithTelegramId ?? 0) > 0,
                  },
                  {
                    label: "Воронка содержит активные горячие лиды",
                    value: (kpis?.hotLeads ?? 0) > 0,
                  },
                  {
                    label: "Есть хотя бы один active automation rule",
                    value: (automationsQuery.data ?? []).some((rule) => rule.status === "active"),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-background/55 px-4 py-3">
                    <p className="text-sm text-foreground">{item.label}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.value ? "bg-emerald-500/12 text-emerald-200" : "bg-rose-500/12 text-rose-200"}`}>
                      {item.value ? "Ready" : "Attention"}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Automation rules"
            description="Переключение статусов, ручной запуск и быстрый просмотр trigger logic для owner-команды."
            actions={
              <Button
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                onClick={() => handleExecuteAutomation()}
                disabled={executeAutomationMutation.isPending}
              >
                {executeAutomationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Run all active rules
              </Button>
            }
          >
            <div className="space-y-4">
              {(automationsQuery.data ?? []).map((rule) => (
                <div key={rule.id} className="rounded-[1.35rem] border border-white/10 bg-background/55 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{rule.name}</p>
                        {statusPill(rule.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-white/10 bg-card/70 px-3 py-1">
                          Trigger: {formatLabel(rule.triggerStage)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-card/70 px-3 py-1">
                          Delay: {rule.delayMinutes} min
                        </span>
                        <span className="rounded-full border border-white/10 bg-card/70 px-3 py-1">
                          Channel: {formatLabel(rule.targetChannel)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-card/70 px-3 py-1">
                          Template: {rule.templateKey}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-[340px] lg:justify-end">
                      <Button
                        variant="outline"
                        className="rounded-full border-primary/30 bg-background/45 text-primary hover:bg-primary/10"
                        onClick={() => handleExecuteAutomation(rule.id)}
                        disabled={executeAutomationMutation.isPending}
                      >
                        Run now
                      </Button>
                      {automationStatusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleAutomationStatus(rule.id, status)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${rule.status === status ? "border-primary/35 bg-primary/12 text-primary" : "border-white/10 bg-background/45 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                        >
                          {formatLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!topLoading && currentSection === "/broadcasts" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="Create broadcast draft"
            description="Сегментированная Telegram-рассылка с CTA и optional schedule прямо из админ-панели."
          >
            <div className="space-y-3">
              <input
                value={broadcastTitle}
                onChange={(event) => setBroadcastTitle(event.target.value)}
                placeholder="Campaign title"
                className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
              />
              <textarea
                value={broadcastBody}
                onChange={(event) => setBroadcastBody(event.target.value)}
                rows={6}
                placeholder="Write the Telegram broadcast copy"
                className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
              />
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  value={broadcastSegment}
                  onChange={(event) => setBroadcastSegment(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="all">All segments</option>
                  {segmentOptions.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
                <input
                  value={broadcastCtaLabel}
                  onChange={(event) => setBroadcastCtaLabel(event.target.value)}
                  placeholder="CTA label"
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
                <input
                  value={broadcastCtaUrl}
                  onChange={(event) => setBroadcastCtaUrl(event.target.value)}
                  placeholder="https://cta.url"
                  className="h-11 rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
              </div>
              <input
                type="datetime-local"
                value={broadcastScheduledAt}
                onChange={(event) => setBroadcastScheduledAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none focus:border-primary/40"
              />
              <Button onClick={handleCreateBroadcast} disabled={createBroadcastMutation.isPending}>
                <Megaphone className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Broadcast queue"
            description="Последние драфты и scheduled campaigns по Telegram сегментам с ручным safe-mode запуском."
          >
            <div className="space-y-4">
              {(broadcastsQuery.data ?? []).map((item) => (
                <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-background/55 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        {statusPill(item.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground md:text-right">
                      <p>Segment: {formatLabel(item.segment ?? "all")}</p>
                      <p>Scheduled: {formatDateTime(item.scheduledAt)}</p>
                      <p>CTA: {item.ctaLabel || "—"}</p>
                      <Button
                        variant="outline"
                        className="border-primary/30 bg-background/45 text-primary hover:bg-primary/10"
                        onClick={() => handleDispatchBroadcast(item.id)}
                        disabled={dispatchBroadcastMutation.isPending || item.status === "sent"}
                      >
                        Dispatch now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!topLoading && currentSection === "/telegram" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <SectionCard
              title="Bot profile"
              description="Служебная карточка подключённого Telegram-бота и operational показатели канала."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Username</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">@{telegramProfileQuery.data?.username ?? "mideasystembot"}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Display name</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{telegramProfileQuery.data?.first_name ?? "Midea System Bot"}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-background/55 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reach and traffic</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Telegram-linked leads: {overviewQuery.data?.deliveryReadiness.leadsWithTelegramId ?? 0} · Recent messages: {overviewQuery.data?.deliveryReadiness.recentMessages ?? 0}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Send test message"
              description="Проверка живого Bot API канала перед owner alerts и campaign send-outs."
            >
              <div className="space-y-3">
                <input
                  value={testChatId}
                  onChange={(event) => setTestChatId(event.target.value)}
                  placeholder="Target chat ID or username"
                  className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
                <textarea
                  value={testMessage}
                  onChange={(event) => setTestMessage(event.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
                <Button onClick={handleSendTestMessage} disabled={sendTestMessageMutation.isPending}>
                  <Bot className="mr-2 h-4 w-4" />
                  Send Telegram test
                </Button>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Leads with Telegram context"
            description="Кандидаты для быстрого пинга, owner follow-up и ручной привязки identity."
            actions={
              <Button variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => setLocation("/leads")}>
                Open lead workbench
              </Button>
            }
          >
            <div className="space-y-3">
              {(leadsQuery.data ?? []).slice(0, 8).map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(lead.id);
                    setLocation("/leads");
                  }}
                  className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-background/55 px-4 py-3 text-left transition hover:border-primary/30"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{lead.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.telegramUsername ? `@${lead.telegramUsername}` : "Identity not linked yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusPill(lead.stage)}
                    {statusPill(lead.temperature, "temperature")}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <DashboardLayout>
      <HomeContent />
    </DashboardLayout>
  );
}
