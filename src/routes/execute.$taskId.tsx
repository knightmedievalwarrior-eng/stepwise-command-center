import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Pause, Play, Square, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MissingTask } from "@/components/app/TaskGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startRun, type LogLine, type RunControl } from "@/lib/runner";
import { finishTask, useHydrated, useTask, type Task } from "@/lib/session-store";
import { TASKS } from "@/lib/tasks/definitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/execute/$taskId")({
  head: () => ({
    meta: [
      { title: "Real-Time Execution — บอทกำลังทำงาน" },
      { name: "description", content: "ติดตามสถานะบอทหลังบ้านแบบเรียลไทม์ พร้อม Progress และ Log ทีละขั้น" },
      { property: "og:title", content: "Real-Time Execution — บอทกำลังทำงาน" },
      { property: "og:description", content: "Progress bar และ Log การทำงานทีละขั้น" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutePage,
});

function ExecutePage() {
  const { taskId } = Route.useParams();
  const hydrated = useHydrated();
  const live = useTask(taskId);
  // Freeze the task: its data is destroyed the moment the run finishes.
  const [snap, setSnap] = useState<Task | null>(null);
  useEffect(() => {
    if (live && !snap) setSnap(live);
  }, [live, snap]);

  if (!hydrated || (live && !snap)) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  const task = snap ?? live;
  if (!task) return <MissingTask />;
  if (task.status !== "ready") return <Navigate to="/review/$taskId" params={{ taskId }} replace />;
  return <Execution task={task} />;
}

type Phase = "running" | "paused" | "done";

function Execution({ task }: { task: Task }) {
  const navigate = useNavigate();
  const def = TASKS[task.type];
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [entryId, setEntryId] = useState<string | null>(null);
  const control = useRef<RunControl | null>(null);
  const startedAt = useRef(Date.now());
  const logBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    startedAt.current = Date.now();
    control.current = startRun(task.type, task.data, {
      onLog: (l) => setLogs((prev) => [...prev, l]),
      onStep: setCurrent,
      onProgress: setProgress,
      onDone: () => {
        setPhase("done");
        setCurrent(def.pipeline.length);
        const entry = finishTask(task.id, "success", startedAt.current, def.pipeline.length);
        if (entry) setEntryId(entry.id);
      },
    });
    return () => control.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    if (!entryId) return;
    const t = setTimeout(() => void navigate({ to: "/done/$entryId", params: { entryId } }), 1400);
    return () => clearTimeout(t);
  }, [entryId, navigate]);

  useEffect(() => {
    const el = logBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const togglePause = () => {
    if (phase === "running") {
      control.current?.pause();
      setPhase("paused");
    } else if (phase === "paused") {
      control.current?.resume();
      setPhase("running");
    }
  };

  const cancel = () => {
    control.current?.cancel();
    finishTask(task.id, "cancelled", startedAt.current, current);
    void navigate({ to: "/review/$taskId", params: { taskId: task.id } });
  };

  const statusText =
    phase === "done" ? "เสร็จสมบูรณ์" : phase === "paused" ? "หยุดชั่วคราว" : def.pipeline[current] ?? "กำลังเตรียม…";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                phase === "running" && "animate-pulse-dot bg-signal",
                phase === "paused" && "bg-warning",
                phase === "done" && "bg-success",
              )}
            />
            Real-Time Execution
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">บอทกำลัง{def.title}</h1>
        </div>
        {phase !== "done" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={togglePause}>
              {phase === "paused" ? (
                <>
                  <Play /> ทำต่อ
                </>
              ) : (
                <>
                  <Pause /> หยุดชั่วคราว
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={cancel}>
              <Square /> ยกเลิก
            </Button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="surface mt-8 p-5 sm:p-7">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {statusText}
          </p>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
            {progress}
            <span className="text-xl text-muted-foreground">%</span>
          </p>
        </div>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              phase === "done" ? "bg-success" : "progress-stripes bg-signal",
              phase === "running" && "animate-stripes",
            )}
            style={{ width: `${Math.max(progress, 2)}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Step checklist */}
        <ol className="surface space-y-1 p-3">
          {def.pipeline.map((label, i) => {
            const done = i < current || phase === "done";
            const active = i === current && phase !== "done";
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active && "bg-signal-soft",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem]",
                    done && "border-success bg-success text-success-foreground",
                    active && "border-signal text-signal",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : active && phase === "running" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn(!done && !active && "text-muted-foreground", active && "font-medium")}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Log */}
        <div className="surface flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Terminal className="size-3.5" /> execution.log
            </span>
            <span className="font-mono text-[0.65rem] text-muted-foreground">{logs.length} lines</span>
          </div>
          <div
            ref={logBox}
            className="h-[340px] overflow-y-auto bg-log px-4 py-3 font-mono text-[0.78rem] leading-6 text-log-foreground"
            aria-live="polite"
          >
            {logs.map((l) => (
              <div key={l.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(l.at).toLocaleTimeString("th-TH", { hour12: false })}
                </span>
                <span
                  className={cn(
                    "min-w-0 whitespace-pre-wrap break-words",
                    l.level === "success" && "text-success",
                    l.level === "warn" && "text-warning",
                    l.level === "system" && "text-signal",
                  )}
                >
                  {l.message}
                </span>
              </div>
            ))}
            {phase === "running" && <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60 align-middle" />}
          </div>
          <p className="border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
            โหมดจำลอง · พร้อมเชื่อมต่อ n8n webhook ในอนาคต
          </p>
        </div>
      </div>
    </div>
  );
}
