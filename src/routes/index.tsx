import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Inbox,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";

import { CommandBox } from "@/components/app/CommandBox";
import { StepSegments } from "@/components/app/StepSegments";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { percent, statusLabel } from "@/lib/n8n/protocol";
import { useLiveRuns, type LiveRun } from "@/lib/run-store";
import {
  clearHistory,
  createTask,
  deleteTask,
  useAppState,
  useHydrated,
  type HistoryEntry,
  type Task,
} from "@/lib/session-store";
import { TASKS, TASK_LIST, readString, type TaskType } from "@/lib/tasks/definitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — Guided Task Runner" },
      {
        name: "description",
        content: "สั่งงานซ้ำๆ ด้วยคำสั่งเดียว: ออกใบเสนอราคา ลงข้อมูลลูกค้า คีย์เอกสาร พร้อมผู้ช่วย AI",
      },
      { property: "og:title", content: "Command Center — Guided Task Runner" },
      {
        property: "og:description",
        content: "ศูนย์สั่งงานอัตโนมัติพร้อมผู้ช่วย AI ข้อมูลอยู่ในเบราว์เซอร์ของคุณเท่านั้น",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommandCenter,
});

function greeting(hour: number) {
  if (hour < 5) return "ดึกแล้วนะ";
  if (hour < 12) return "สวัสดีตอนเช้า";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

function CommandCenter() {
  const hydrated = useHydrated();
  const now = new Date();
  const dateLabel = hydrated
    ? now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : " ";

  return (
    <div className="relative">
      <div className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-3xl animate-rise">
          <p className="eyebrow min-h-4">{dateLabel}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            {hydrated ? greeting(now.getHours()) : "สวัสดี"}{" "}
            <span className="text-muted-foreground">วันนี้ให้ช่วยงานอะไรดี?</span>
          </h1>
          <div className="mt-7">
            <CommandBox />
          </div>
        </section>

        <QuickActions />

        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          <PendingTasks />
          <BotHistory />
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();
  const start = (type: TaskType) => {
    const t = createTask(type);
    void navigate({ to: "/wizard/$taskId", params: { taskId: t.id } });
  };
  return (
    <section className="mt-14">
      <SectionTitle eyebrow="Quick Actions" title="เริ่มงานด่วน" />
      <div className="grid gap-3 sm:grid-cols-3">
        {TASK_LIST.map((def, i) => (
          <button
            key={def.type}
            type="button"
            onClick={() => start(def.type)}
            style={{ animationDelay: `${80 + i * 60}ms` }}
            className="surface group flex animate-rise flex-col items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-lift"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-signal group-hover:text-signal-foreground">
                <def.icon className="size-5" />
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-signal" />
            </div>
            <div>
              <h3 className="font-semibold">{def.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{def.description}</p>
            </div>
            <span className="font-mono text-[0.7rem] text-muted-foreground">{def.steps.length} ขั้นตอน</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function taskSubtitle(t: Task) {
  const d = t.data;
  return readString(d, "customerName") || readString(d, "name") || readString(d, "docNo") || "ยังไม่ได้ระบุ";
}

interface FailureInfo {
  index: number;
  label: string;
  message: string;
}

function failureOf(t: Task, run: LiveRun | undefined): FailureInfo | undefined {
  if (run?.phase === "error" && run.failure) return run.failure;
  if (t.lastRun?.status === "failed") {
    const index = t.lastRun.failedStep ?? 0;
    return { index, label: t.lastRun.failedLabel ?? TASKS[t.type].pipeline[index] ?? "", message: t.lastRun.message ?? "" };
  }
  return undefined;
}

const isLive = (r: LiveRun | undefined): r is LiveRun => !!r && (r.phase === "running" || r.phase === "paused");

function PendingTasks() {
  const hydrated = useHydrated();
  const { tasks } = useAppState();
  const runs = useLiveRuns();
  const runOf = new Map(runs.map((r) => [r.taskId, r]));
  const failedCount = tasks.filter((t) => failureOf(t, runOf.get(t.id))).length;

  return (
    <section className="lg:col-span-3">
      <SectionTitle
        eyebrow="Pending"
        title={`งานค้าง${hydrated && tasks.length ? ` (${tasks.length})` : ""}`}
        action={
          hydrated && failedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground">
              <AlertTriangle className="size-3" /> ขัดข้อง {failedCount} งาน
            </span>
          ) : null
        }
      />
      <div className="surface divide-y divide-border">
        {!hydrated ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState icon={Inbox} title="ไม่มีงานค้าง" body="งานที่เริ่มแล้วแต่ยังไม่ส่งจะแสดงที่นี่ และถูกลบอัตโนมัติเมื่อปิดแท็บ" />
        ) : (
          tasks.map((t) => <PendingRow key={t.id} task={t} run={runOf.get(t.id)} />)
        )}
      </div>
    </section>
  );
}

function PendingRow({ task: t, run }: { task: Task; run: LiveRun | undefined }) {
  const def = TASKS[t.type];
  const live = isLive(run) ? run : undefined;
  const failure = live ? undefined : failureOf(t, run);
  const interrupted = !live && !failure && t.lastRun?.status === "running";
  const total = def.steps.length;
  const done = t.status === "ready" ? total : t.stepIndex;
  const lastLog = live?.logs.at(-1)?.message.trim();

  return (
    <div
      data-testid="pending-row"
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors sm:px-5",
        live && "bg-signal-soft/40",
        failure && "bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary",
            live && "bg-signal text-signal-foreground",
            failure && "bg-destructive text-destructive-foreground",
          )}
        >
          {live && live.phase === "running" ? <Loader2 className="size-4 animate-spin" /> : <def.icon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium">{def.title}</p>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-signal px-2 py-0.5 text-[0.65rem] font-medium text-signal-foreground">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-signal-foreground" />
                {live.phase === "paused" ? "หยุดชั่วคราว" : "บอทกำลังทำงาน"}
              </span>
            ) : failure ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[0.65rem] font-medium text-destructive-foreground">
                <AlertTriangle className="size-3" /> ขัดข้อง
              </span>
            ) : interrupted ? (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.65rem] font-medium text-foreground">ถูกขัดจังหวะ</span>
            ) : t.status === "ready" ? (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">รอยืนยัน</span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{taskSubtitle(t)}</p>
          {!live && !failure && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-signal" style={{ width: `${(done / total) * 100}%` }} />
              </div>
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                {done}/{total}
              </span>
            </div>
          )}
        </div>
        {!live && (
          <Button variant="ghost" size="icon-sm" aria-label="ลบงาน" onClick={() => deleteTask(t.id)}>
            <Trash2 />
          </Button>
        )}
        <Button asChild size="sm" variant={failure ? "destructive" : "soft"}>
          {live ? (
            <Link to="/execute/$taskId" params={{ taskId: t.id }}>
              ดูสถานะ
            </Link>
          ) : failure || interrupted || t.status === "ready" ? (
            <Link to="/review/$taskId" params={{ taskId: t.id }}>
              {failure || interrupted ? "แก้ไข/ส่งใหม่" : "ตรวจทาน"}
            </Link>
          ) : (
            <Link to="/wizard/$taskId" params={{ taskId: t.id }}>
              ทำต่อ
            </Link>
          )}
        </Button>
      </div>

      {live && (
        <div className="space-y-1.5 pl-[3.25rem]" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-foreground">
              {live.phase === "paused"
                ? `หยุดชั่วคราว (${Math.min(live.progress.current + 1, live.progress.total)}/${live.progress.total})`
                : statusLabel(live.progress)}
            </span>
            <span className="font-mono text-[0.65rem] text-muted-foreground">{percent(live.progress)}%</span>
          </div>
          <StepSegments progress={live.progress} labels={def.pipeline} active />
          <p className="truncate text-xs text-muted-foreground">
            {def.pipeline[live.progress.current]}
            {lastLog ? <span className="font-mono text-[0.68rem]"> · {lastLog}</span> : null}
          </p>
        </div>
      )}

      {failure && (
        <div
          role="alert"
          className="ml-[3.25rem] flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-destructive">
              ขัดข้องที่ขั้นตอน {failure.index + 1}/{def.pipeline.length}: {failure.label}
            </p>
            {failure.message && <p className="mt-0.5 line-clamp-2 break-words text-foreground/80">{failure.message}</p>}
            {run?.phase === "error" && (
              <Link
                to="/execute/$taskId"
                params={{ taskId: t.id }}
                className="mt-1 inline-block font-medium text-destructive underline-offset-2 hover:underline"
              >
                ดู Log การทำงาน
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BotHistory() {
  const hydrated = useHydrated();
  const { history, tasks } = useAppState();
  const liveRuns = useLiveRuns().filter(isLive);

  return (
    <section className="lg:col-span-2">
      <SectionTitle
        eyebrow="Bot Log"
        title="ประวัติบอทหลังบ้าน"
        action={
          hydrated && history.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              ล้างประวัติ
            </Button>
          ) : null
        }
      />
      <div className="surface">
        {!hydrated ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : history.length === 0 && liveRuns.length === 0 ? (
          <EmptyState icon={Bot} title="ยังไม่มีประวัติ" body="เมื่อบอททำงานเสร็จ สรุปผล (ไม่มีข้อมูลส่วนบุคคล) จะถูกบันทึกไว้ที่นี่" />
        ) : (
          <ol className="max-h-[480px] overflow-y-auto p-2">
            {liveRuns.map((r) => {
              const task = tasks.find((t) => t.id === r.taskId);
              return <LiveHistoryRow key={`live-${r.taskId}`} run={r} label={task ? TASKS[r.type].historyLabel(task.data) : ""} />;
            })}
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function LiveHistoryRow({ run, label }: { run: LiveRun; label: string }) {
  const def = TASKS[run.type];
  const lastLog = run.logs.at(-1)?.message.trim();
  return (
    <li data-testid="live-history-row" className="animate-rise">
      <Link
        to="/execute/$taskId"
        params={{ taskId: run.taskId }}
        className="flex items-start gap-3 rounded-lg border border-signal/30 bg-signal-soft/50 p-3 transition-colors hover:border-signal"
      >
        <Loader2 className={cn("mt-0.5 size-4 shrink-0 text-signal", run.phase === "running" && "animate-spin")} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {def.verb}
            <span className="rounded-full bg-signal px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wide text-signal-foreground">
              live
            </span>
          </p>
          {label && <p className="truncate text-xs text-muted-foreground">{label}</p>}
          <p className="mt-1.5 text-xs font-medium" aria-live="polite">
            {run.phase === "paused" ? "หยุดชั่วคราว" : statusLabel(run.progress)}
          </p>
          <StepSegments progress={run.progress} labels={def.pipeline} active className="mt-1.5" />
          {lastLog && <p className="mt-1.5 truncate font-mono text-[0.65rem] text-muted-foreground">{lastLog}</p>}
        </div>
        <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
          {run.mode === "n8n" ? "n8n" : "จำลอง"}
        </span>
      </Link>
    </li>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const def = TASKS[entry.type];
  const ok = entry.status === "success";
  const failed = entry.status === "failed";
  const secs = Math.max(1, Math.round((entry.finishedAt - entry.startedAt) / 1000));
  const failedStep = entry.failedStep ?? 0;
  return (
    <li data-testid="history-row">
      <Link
        to="/done/$entryId"
        params={{ entryId: entry.id }}
        className={cn(
          "flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary",
          failed && "hover:bg-destructive/10",
        )}
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : failed ? (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            {def.verb} {ok ? "สำเร็จ" : failed ? "ไม่สำเร็จ" : "ถูกยกเลิก"}
            {failed && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[0.62rem] font-medium text-destructive-foreground">
                ขัดข้องขั้นตอน {failedStep + 1}/{def.pipeline.length}
              </span>
            )}
          </p>
          {failed ? (
            <p className="truncate text-xs text-destructive">{def.pipeline[failedStep]}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{entry.label}</p>
          )}
          <p className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
            <span>{entry.ref}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" />
              {secs}s
            </span>
            {entry.mode && <span>{entry.mode === "n8n" ? "n8n" : "จำลอง"}</span>}
          </p>
        </div>
        <span className="shrink-0 text-[0.7rem] text-muted-foreground">
          {formatDistanceToNow(entry.finishedAt, { addSuffix: true, locale: th })}
        </span>
      </Link>
    </li>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
