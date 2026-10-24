import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Pencil, Rocket, ShieldCheck, Webhook } from "lucide-react";
import { useState } from "react";

import { N8nSettingsDialog } from "@/components/app/N8nSettingsDialog";
import { StepRail } from "@/components/app/StepRail";
import { TaskGate } from "@/components/app/TaskGate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useN8nConfig, webhookHost } from "@/lib/n8n/config";
import { dismissRun } from "@/lib/run-store";
import { updateTask, type Task } from "@/lib/session-store";
import {
  TASKS,
  calcQuotation,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  validateStep,
  type FieldDef,
  type TaskData,
} from "@/lib/tasks/definitions";

export const Route = createFileRoute("/review/$taskId")({
  head: () => ({
    meta: [
      { title: "ตรวจทานและยืนยัน — Guided Task Runner" },
      { name: "description", content: "ตรวจทานข้อมูลทั้งหมดก่อนส่งให้บอทหลังบ้านทำงานจริง" },
      { property: "og:title", content: "ตรวจทานและยืนยัน — Guided Task Runner" },
      { property: "og:description", content: "สรุปข้อมูลก่อนส่งงานจริง" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { taskId } = Route.useParams();
  return <TaskGate taskId={taskId}>{(task) => <Review task={task} />}</TaskGate>;
}

function displayValue(field: FieldDef, data: TaskData): string {
  if (field.type === "switch") return readBool(data, field.name) ? "ใช่" : "ไม่";
  const raw = readString(data, field.name).trim();
  if (!raw) return "—";
  if (field.type === "select") return field.options?.find((o) => o.value === raw)?.label ?? raw;
  if (field.type === "date") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("th-TH", { dateStyle: "long" });
  }
  if (field.name === "amount") return formatBaht(readNumber(data, field.name));
  return raw;
}

function Review({ task }: { task: Task }) {
  const navigate = useNavigate();
  const def = TASKS[task.type];
  const [confirmed, setConfirmed] = useState(false);
  const n8n = useN8nConfig();
  const last = task.lastRun;
  const invalidStep = def.steps.findIndex((s) => Object.keys(validateStep(s, task.data)).length > 0);

  const edit = (i: number) => {
    updateTask(task.id, { stepIndex: i });
    void navigate({ to: "/wizard/$taskId", params: { taskId: task.id } });
  };

  const submit = () => {
    if (invalidStep >= 0) return edit(invalidStep);
    dismissRun(task.id);
    updateTask(task.id, { status: "ready", lastRun: undefined });
    void navigate({ to: "/execute/$taskId", params: { taskId: task.id } });
  };

  const items = readItems(task.data);
  const totals = calcQuotation(items, readNumber(task.data, "discount"), readBool(task.data, "vat"));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => edit(def.steps.length - 1)}>
        <ArrowLeft /> กลับไปแก้ไข
      </Button>

      <div className="mt-4">
        <p className="eyebrow">Review & Confirm</p>
        <h1 className="text-2xl font-semibold tracking-tight">ตรวจทาน{def.verb}ก่อนส่ง</h1>
        <p className="mt-1 text-sm text-muted-foreground">ตรวจสอบความถูกต้อง แก้ไขได้ทุกส่วนก่อนส่งให้บอททำงานจริง</p>
      </div>

      {last && (
        <div
          role="alert"
          className={
            last.status === "failed"
              ? "mt-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
              : "mt-6 flex items-start gap-3 rounded-2xl border border-warning/50 bg-warning-soft p-4"
          }
        >
          <AlertTriangle
            className={last.status === "failed" ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-warning"}
          />
          <div className="min-w-0 text-sm">
            {last.status === "failed" ? (
              <>
                <p className="font-semibold text-destructive">
                  ครั้งก่อนขัดข้องที่ขั้นตอน {(last.failedStep ?? 0) + 1}/{def.pipeline.length}: {last.failedLabel}
                </p>
                {last.message && <p className="mt-0.5 break-words text-foreground/80">{last.message}</p>}
              </>
            ) : (
              <p className="font-semibold">การส่งงานครั้งก่อนถูกขัดจังหวะ (เช่น รีเฟรชหน้า) ไม่ทราบผลจาก n8n</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">ตรวจสอบข้อมูล แล้วกดยืนยันเพื่อส่งใหม่อีกครั้ง</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <StepRail steps={def.steps} current={def.steps.length} reachable={def.steps.length} onSelect={edit} />
        </aside>

        <section className="min-w-0 space-y-4">
          {def.steps.map((step, i) => (
            <div key={step.id} className="surface animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="text-sm font-semibold">{step.title}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => edit(i)}>
                  <Pencil /> แก้ไข
                </Button>
              </div>

              {step.fields.some((f) => f.type === "items") ? (
                <div className="px-5 py-4 sm:px-6">
                  <ul className="divide-y divide-border">
                    {items.map((it, idx) => (
                      <li key={idx} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{it.name || "—"}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {it.qty} × {formatBaht(it.price)}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums">{formatBaht(it.qty * it.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 sm:px-6">
                  {step.fields.map((f) => (
                    <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium">
                        {displayValue(f, task.data)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}

          {task.type === "quotation" && (
            <div className="surface px-5 py-4 sm:px-6">
              <dl className="space-y-2 text-sm">
                <Row label="ยอดรวม" value={formatBaht(totals.subtotal)} />
                <Row label={`ส่วนลด ${readNumber(task.data, "discount") || 0}%`} value={`−${formatBaht(totals.discount)}`} />
                <Row label="หลังหักส่วนลด" value={formatBaht(totals.afterDiscount)} />
                <Row label="VAT 7%" value={formatBaht(totals.vat)} />
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                <span className="font-semibold">ยอดสุทธิ</span>
                <span className="font-mono text-2xl font-semibold tabular-nums">{formatBaht(totals.total)}</span>
              </div>
            </div>
          )}

          <div className="surface space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Checkbox id="confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
              <Label htmlFor="confirm" className="text-sm font-normal leading-relaxed">
                ฉันตรวจสอบแล้วว่าข้อมูลถูกต้อง และยืนยันให้บอทหลังบ้านดำเนินการ
              </Label>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
              เมื่องานเสร็จ ข้อมูลในงานนี้จะถูกลบจากเบราว์เซอร์ทันที เหลือเพียงสรุปที่ไม่ระบุตัวบุคคลในประวัติ
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <Webhook className="size-3.5 shrink-0" />
                <span className="truncate">
                  {n8n.url ? `จะส่งไปที่ n8n · ${webhookHost(n8n.url)}` : "ยังไม่ได้เชื่อม n8n · บอทจะทำงานแบบจำลอง"}
                </span>
              </span>
              <N8nSettingsDialog
                trigger={
                  <button type="button" className="font-medium underline-offset-2 hover:underline">
                    {n8n.url ? "เปลี่ยน" : "ตั้งค่า"}
                  </button>
                }
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild variant="outline" size="lg">
                <Link to="/">บันทึกไว้ทำต่อภายหลัง</Link>
              </Button>
              <Button variant="signal" size="lg" disabled={!confirmed} onClick={submit}>
                <Rocket /> {last ? "ยืนยันและส่งใหม่" : "ยืนยันและส่งให้บอททำงาน"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
