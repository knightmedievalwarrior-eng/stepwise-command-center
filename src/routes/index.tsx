import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowRight, Bot, CheckCircle2, CircleSlash, Clock3, Inbox, Trash2 } from "lucide-react";

import { CommandBox } from "@/components/app/CommandBox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function PendingTasks() {
  const hydrated = useHydrated();
  const { tasks } = useAppState();

  return (
    <section className="lg:col-span-3">
      <SectionTitle
        eyebrow="Pending"
        title={`งานค้าง${hydrated && tasks.length ? ` (${tasks.length})` : ""}`}
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
          tasks.map((t) => {
            const def = TASKS[t.type];
            const total = def.steps.length;
            const done = t.status === "ready" ? total : t.stepIndex;
            return (
              <div key={t.id} className="flex items-center gap-4 p-4 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <def.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{def.title}</p>
                    {t.status === "ready" && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">
                        รอยืนยัน
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{taskSubtitle(t)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-signal" style={{ width: `${(done / total) * 100}%` }} />
                    </div>
                    <span className="font-mono text-[0.65rem] text-muted-foreground">
                      {done}/{total}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="ลบงาน" onClick={() => deleteTask(t.id)}>
                  <Trash2 />
                </Button>
                <Button asChild size="sm" variant="soft">
                  {t.status === "ready" ? (
                    <Link to="/review/$taskId" params={{ taskId: t.id }}>
                      ตรวจทาน
                    </Link>
                  ) : (
                    <Link to="/wizard/$taskId" params={{ taskId: t.id }}>
                      ทำต่อ
                    </Link>
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function BotHistory() {
  const hydrated = useHydrated();
  const { history } = useAppState();

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
        ) : history.length === 0 ? (
          <EmptyState icon={Bot} title="ยังไม่มีประวัติ" body="เมื่อบอททำงานเสร็จ สรุปผล (ไม่มีข้อมูลส่วนบุคคล) จะถูกบันทึกไว้ที่นี่" />
        ) : (
          <ol className="max-h-[420px] overflow-y-auto p-2">
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const def = TASKS[entry.type];
  const ok = entry.status === "success";
  const secs = Math.max(1, Math.round((entry.finishedAt - entry.startedAt) / 1000));
  return (
    <li>
      <Link
        to="/done/$entryId"
        params={{ entryId: entry.id }}
        className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {def.verb} {ok ? "สำเร็จ" : "ถูกยกเลิก"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{entry.label}</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
            <span>{entry.ref}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" />
              {secs}s
            </span>
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
