import { Check, Copy, Loader2, PlugZap, ShieldCheck, Webhook } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveN8nConfig, useN8nConfig, validateWebhookUrl, webhookHost, type N8nConfig } from "@/lib/n8n/config";
import { samplePayload } from "@/lib/n8n/payload";
import { cn } from "@/lib/utils";

const RESPONSE_STREAM = [
  { step: 1, status: "running", message: "เริ่มตรวจสอบข้อมูล" },
  { step: 1, status: "success" },
  { step: 2, status: "success", message: "ยอดสุทธิ ฿963.00" },
  { step: 3, status: "error", message: "ระบบออกเลขเอกสารไม่ตอบสนอง" },
]
  .map((l) => JSON.stringify(l))
  .join("\n");

const RESPONSE_SINGLE = JSON.stringify(
  {
    status: "success",
    message: "สร้างใบเสนอราคา QT-0001 แล้ว",
    steps: [
      { step: 1, status: "success" },
      { step: 2, status: "success" },
      { step: 3, status: "success", message: "เลขที่ QT-0001" },
      { step: 4, status: "success" },
      { step: 5, status: "success" },
    ],
  },
  null,
  2,
);

const RESPONSE_ERROR = JSON.stringify({ status: "error", step: 3, message: "ระบบออกเลขเอกสารไม่ตอบสนอง" }, null, 2);

type TestState = { kind: "idle" } | { kind: "testing" } | { kind: "ok"; text: string } | { kind: "fail"; text: string };

export function N8nSettingsDialog({ trigger }: { trigger?: ReactNode }) {
  const saved = useN8nConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<N8nConfig>(saved);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm(saved);
      setError(null);
      setTest({ kind: "idle" });
    }
  };

  const set = (patch: Partial<N8nConfig>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
    setTest({ kind: "idle" });
  };

  const save = () => {
    const err = validateWebhookUrl(form.url);
    if (err) return setError(err);
    saveN8nConfig(form);
    toast.success("บันทึกการตั้งค่า n8n แล้ว", { description: `งานต่อไปจะถูกส่งไปที่ ${webhookHost(form.url)}` });
    setOpen(false);
  };

  const clear = () => {
    saveN8nConfig({ url: "", authHeader: "", authValue: "" });
    setForm({ url: "", authHeader: "", authValue: "" });
    toast("ล้างการตั้งค่าแล้ว", { description: "กลับไปใช้โหมดจำลอง" });
  };

  const runTest = async () => {
    const err = validateWebhookUrl(form.url);
    if (err) return setError(err);
    setTest({ kind: "testing" });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (form.authHeader.trim() && form.authValue) headers[form.authHeader.trim()] = form.authValue;
    try {
      const res = await fetch(form.url.trim(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "ping",
          source: "guided-task-runner",
          message: "ทดสอบการเชื่อมต่อจาก Task Runner",
          sentAt: new Date().toISOString(),
        }),
      });
      const body = (await res.text()).slice(0, 160);
      if (res.ok) setTest({ kind: "ok", text: `เชื่อมต่อสำเร็จ · HTTP ${res.status}${body ? ` · ${body}` : ""}` });
      else
        setTest({
          kind: "fail",
          text:
            res.status === 404
              ? "HTTP 404 · ไม่พบ Webhook (ตรวจสอบว่า workflow ถูก Publish/Active และใช้ Production URL)"
              : res.status === 401 || res.status === 403
                ? `HTTP ${res.status} · สิทธิ์ไม่ถูกต้อง ตรวจสอบ Header Auth`
                : `HTTP ${res.status}${body ? ` · ${body}` : ""}`,
        });
    } catch {
      setTest({
        kind: "fail",
        text: "เชื่อมต่อไม่ได้ · ตรวจสอบ URL และตั้ง Allowed Origins (CORS) = * ใน Webhook node ของ n8n",
      });
    }
  };

  const connected = Boolean(saved.url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label="ตั้งค่า n8n Webhook">
            <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground/40")} />
            <Webhook />
            <span className="hidden md:inline">{connected ? "n8n" : "เชื่อม n8n"}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="size-5" /> เชื่อมต่อ n8n Webhook
          </DialogTitle>
          <DialogDescription>
            เมื่อยืนยันงาน แอปจะส่งข้อมูลคำสั่งภาษาไทยเป็น JSON ไปที่ Webhook นี้ แล้วแสดงสถานะแต่ละขั้นที่ n8n ตอบกลับ
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            connected ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground/50")} />
          {connected ? `ใช้งานอยู่ · ${webhookHost(saved.url)}` : "ยังไม่ได้ตั้งค่า · ตอนนี้บอททำงานแบบจำลอง"}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="n8n-url">Webhook URL (Production)</Label>
            <Input
              id="n8n-url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://your-n8n.example.com/webhook/task-runner"
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              aria-invalid={Boolean(error)}
              className="font-mono text-sm"
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">คัดลอกจาก Webhook node → Production URL · วิธี POST</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="n8n-h">Header Auth · ชื่อ (ไม่บังคับ)</Label>
              <Input
                id="n8n-h"
                autoComplete="off"
                placeholder="X-Api-Key"
                value={form.authHeader}
                onChange={(e) => set({ authHeader: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n8n-v">Header Auth · ค่า</Label>
              <Input
                id="n8n-v"
                type="password"
                autoComplete="off"
                placeholder="••••••"
                value={form.authValue}
                onChange={(e) => set({ authValue: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void runTest()} disabled={test.kind === "testing"}>
              {test.kind === "testing" ? <Loader2 className="animate-spin" /> : <PlugZap />} ทดสอบการเชื่อมต่อ
            </Button>
            {test.kind === "ok" && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5 shrink-0" />
                <span className="truncate">{test.text}</span>
              </span>
            )}
          </div>
          {test.kind === "fail" && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {test.text}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            ข้อมูลงานถูกส่งตรงจากเบราว์เซอร์ไปยัง n8n ของคุณ ไม่ผ่านหรือถูกเก็บบนเซิร์ฟเวอร์ของแอปนี้ การตั้งค่านี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น
          </p>
        </div>

        <Tabs defaultValue="payload" className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="payload">ข้อมูลที่ส่งไป</TabsTrigger>
            <TabsTrigger value="response">การตอบกลับ</TabsTrigger>
            <TabsTrigger value="setup">วิธีตั้งค่า</TabsTrigger>
          </TabsList>
          <TabsContent value="payload" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              ตัวอย่าง (ใบเสนอราคา) · ใช้ <code className="font-mono">command</code> และ{" "}
              <code className="font-mono">summary</code> เป็นข้อความภาษาไทยได้ทันที ทดสอบจะส่ง{" "}
              <code className="font-mono">{'"event": "ping"'}</code>
            </p>
            <CodeBlock code={JSON.stringify(samplePayload(), null, 2)} />
          </TabsContent>
          <TabsContent value="response" className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <b className="font-medium text-foreground">แบบเรียลไทม์:</b> ตั้ง Webhook → Respond = Streaming แล้วส่ง JSON
              ทีละบรรทัด (step นับจาก 1) ป้ายสีแดงจะขึ้นทันทีเมื่อได้ <code className="font-mono">status: "error"</code>
            </p>
            <CodeBlock code={RESPONSE_STREAM} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <b className="font-medium text-foreground">แบบตอบครั้งเดียว:</b> ใช้ Respond to Webhook ส่งผลรวมทุกขั้นตอน
            </p>
            <CodeBlock code={RESPONSE_SINGLE} />
            <p className="text-xs text-muted-foreground">แจ้งขัดข้อง (หรือตอบ HTTP 4xx/5xx):</p>
            <CodeBlock code={RESPONSE_ERROR} />
          </TabsContent>
          <TabsContent value="setup">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>สร้าง workflow ใหม่ใน n8n แล้วเพิ่ม <b className="font-medium">Webhook</b> node · HTTP Method = POST</li>
              <li>
                ใน Options เพิ่ม <b className="font-medium">Allowed Origins (CORS)</b> = <code className="font-mono">*</code>{" "}
                หรือโดเมนของแอปนี้
              </li>
              <li>ถ้าต้องการป้องกัน ตั้ง Authentication = Header Auth แล้วใส่ชื่อ/ค่าเดียวกันด้านบน</li>
              <li>
                แยกงานด้วย <code className="font-mono">taskType</code> (quotation / customer / document) ด้วย Switch node
              </li>
              <li>ตอบกลับสถานะตามแท็บ "การตอบกลับ" · ถ้าไม่ตอบรายขั้น ระบบถือว่าสำเร็จเมื่อ n8n รับคำสั่ง</li>
              <li>กด Publish/Active แล้วคัดลอก Production URL มาวางด้านบน</li>
            </ol>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:justify-between">
          {connected ? (
            <Button type="button" variant="ghost" onClick={clear}>
              ล้างการตั้งค่า
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="signal" onClick={save}>
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-auto rounded-lg bg-log p-3 pr-12 font-mono text-[0.72rem] leading-5 text-log-foreground">
        {code}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="คัดลอก"
        className="absolute right-1.5 top-1.5"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
