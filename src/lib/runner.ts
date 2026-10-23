/**
 * Execution engine for the bot pipeline.
 *
 * Today this simulates each step locally in the browser. To connect n8n
 * later, replace `startRun` with a call to an n8n webhook and stream its
 * step events (SSE / polling) into the same `RunHandlers` callbacks.
 */
import {
  TASKS,
  calcQuotation,
  docTypeLabel,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  type TaskData,
  type TaskType,
} from "./tasks/definitions";

export type LogLevel = "info" | "success" | "warn" | "system";

export interface LogLine {
  id: number;
  at: number;
  level: LogLevel;
  message: string;
}

export interface RunHandlers {
  onLog: (line: LogLine) => void;
  onStep: (index: number) => void;
  onProgress: (percent: number) => void;
  onDone: () => void;
}

export interface RunControl {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

function detailsFor(type: TaskType, step: number, data: TaskData): string[] {
  if (type === "quotation") {
    const items = readItems(data);
    const t = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
    return [
      [`พบ ${items.length} รายการ ข้อมูลครบถ้วน`],
      [`ยอดก่อนส่วนลด ${formatBaht(t.subtotal)}`, `VAT ${formatBaht(t.vat)} · ยอดสุทธิ ${formatBaht(t.total)}`],
      ["จองเลขที่เอกสารสำเร็จ"],
      [`ยืนราคา ${readNumber(data, "validDays") || 30} วัน`, "เรนเดอร์เทมเพลตเสร็จสิ้น"],
      ["webhook ตอบกลับ 200 OK (จำลอง)"],
    ][step] ?? [];
  }
  if (type === "customer") {
    return [
      [readString(data, "email") ? "เบอร์โทรและอีเมลถูกต้อง" : "เบอร์โทรถูกต้อง · ไม่มีอีเมล"],
      ["ไม่พบข้อมูลซ้ำ"],
      ["สร้างรหัสลูกค้าใหม่"],
      ["บันทึกสำเร็จ (จำลอง)"],
    ][step] ?? [];
  }
  return [
    [`${docTypeLabel(readString(data, "docType"))} เลขที่ถูกต้อง`],
    ["จับคู่คู่ค้าสำเร็จ"],
    [`ลงบัญชี ${formatBaht(readNumber(data, "amount"))}`],
    ["จัดเก็บสำเร็จ (จำลอง)"],
  ][step] ?? [];
}

export function startRun(type: TaskType, data: TaskData, h: RunHandlers, speed = 1): RunControl {
  const pipeline = TASKS[type].pipeline;
  let seq = 0;
  let paused = false;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const log = (level: LogLevel, message: string) => h.onLog({ id: ++seq, at: Date.now(), level, message });

  // Flatten the pipeline into timed events.
  type Ev = { delay: number; run: () => void };
  const events: Ev[] = [];
  const total = pipeline.length;
  events.push({ delay: 200, run: () => log("system", `เชื่อมต่อบอทหลังบ้าน · ${total} ขั้นตอน`) });
  pipeline.forEach((label, i) => {
    events.push({
      delay: 350,
      run: () => {
        h.onStep(i);
        log("info", `[${i + 1}/${total}] ${label}…`);
      },
    });
    for (const d of detailsFor(type, i, data)) {
      events.push({ delay: 550 + Math.random() * 450, run: () => log("info", `  ↳ ${d}`) });
    }
    events.push({
      delay: 400,
      run: () => {
        log("success", `✓ ${label}`);
        h.onProgress(Math.round(((i + 1) / total) * 100));
      },
    });
  });
  events.push({
    delay: 300,
    run: () => {
      log("system", "ภารกิจเสร็จสมบูรณ์ · ลบข้อมูลชั่วคราวออกจากเบราว์เซอร์");
      h.onDone();
    },
  });

  let cursor = 0;
  const tick = () => {
    if (cancelled || paused) return;
    const ev = events[cursor];
    if (!ev) return;
    timer = setTimeout(() => {
      if (cancelled || paused) return;
      ev.run();
      cursor += 1;
      tick();
    }, ev.delay / speed);
  };
  h.onProgress(0);
  tick();

  return {
    pause: () => {
      if (paused || cancelled) return;
      paused = true;
      if (timer) clearTimeout(timer);
      log("warn", "หยุดชั่วคราวโดยผู้ใช้");
    },
    resume: () => {
      if (!paused || cancelled) return;
      paused = false;
      log("system", "ทำงานต่อ");
      tick();
    },
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}
