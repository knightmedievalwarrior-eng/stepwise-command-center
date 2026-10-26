import { FileText, ReceiptText, UserPlus, type LucideIcon } from "lucide-react";

import { tx, type Lang, type Text } from "../i18n";

export type TaskType = "quotation" | "customer" | "document";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "switch"
  | "items";

export interface FieldOption {
  value: string;
  label: Text;
}

export interface FieldDef {
  name: string;
  label: Text;
  type: FieldType;
  required?: boolean;
  placeholder?: Text | string;
  hint?: Text;
  options?: FieldOption[];
  /** Occupies half the row on wide screens. */
  half?: boolean;
}

export interface StepDef {
  id: string;
  title: Text;
  description: Text;
  fields: FieldDef[];
}

export interface QuoteItem {
  name: string;
  qty: number;
  price: number;
}

export type TaskData = Record<string, unknown>;

export interface TaskDef {
  type: TaskType;
  title: Text;
  verb: Text;
  description: Text;
  icon: LucideIcon;
  refPrefix: string;
  steps: StepDef[];
  defaults: () => TaskData;
  /** Bot pipeline shown on the execution screen. The Thai text is also sent to n8n. */
  pipeline: Text[];
  /** Non-personal label kept in the usage history after the data is destroyed. */
  historyLabel: (data: TaskData) => Text;
}

export const VAT_RATE = 0.07;

export function readString(data: TaskData, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function readNumber(data: TaskData, key: string): number {
  const v = data[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function readBool(data: TaskData, key: string): boolean {
  return data[key] === true;
}

export function readItems(data: TaskData): QuoteItem[] {
  const v = data["items"];
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      name: typeof r["name"] === "string" ? (r["name"] as string) : "",
      qty: Number(r["qty"]) || 0,
      price: Number(r["price"]) || 0,
    };
  });
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcQuotation(
  items: QuoteItem[],
  discountPercent: number,
  includeVat: boolean,
): QuoteTotals {
  const subtotal = round2(items.reduce((s, it) => s + Math.max(0, it.qty) * Math.max(0, it.price), 0));
  const pct = Math.min(100, Math.max(0, discountPercent));
  const discount = round2((subtotal * pct) / 100);
  const afterDiscount = round2(subtotal - discount);
  const vat = includeVat ? round2(afterDiscount * VAT_RATE) : 0;
  return { subtotal, discount, afterDiscount, vat, total: round2(afterDiscount + vat) };
}

export const formatBaht = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DOC_TYPES: FieldOption[] = [
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "receipt", label: "ใบเสร็จรับเงิน" },
  { value: "tax-invoice", label: "ใบกำกับภาษี" },
  { value: "po", label: "ใบสั่งซื้อ" },
  { value: "other", label: "อื่นๆ" },
];

export const docTypeLabel = (v: string) => DOC_TYPES.find((d) => d.value === v)?.label ?? v;

export const TASKS: Record<TaskType, TaskDef> = {
  quotation: {
    type: "quotation",
    title: "ออกใบเสนอราคา",
    verb: "ใบเสนอราคา",
    description: "สร้างใบเสนอราคาพร้อมคำนวณส่วนลดและ VAT อัตโนมัติ",
    icon: ReceiptText,
    refPrefix: "QT",
    defaults: () => ({
      items: [{ name: "", qty: 1, price: 0 }],
      discount: 0,
      vat: true,
      validDays: 30,
    }),
    steps: [
      {
        id: "customer",
        title: "ข้อมูลลูกค้า",
        description: "ระบุผู้รับใบเสนอราคา",
        fields: [
          { name: "customerName", label: "ชื่อลูกค้า / บริษัท", type: "text", required: true, placeholder: "เช่น บริษัท สยามเทค จำกัด" },
          { name: "contactName", label: "ผู้ติดต่อ", type: "text", half: true, placeholder: "คุณสมชาย" },
          { name: "email", label: "อีเมล", type: "email", half: true, placeholder: "name@company.com" },
          { name: "phone", label: "เบอร์โทร", type: "tel", half: true, placeholder: "08x-xxx-xxxx" },
          { name: "taxId", label: "เลขผู้เสียภาษี", type: "text", half: true, placeholder: "13 หลัก" },
        ],
      },
      {
        id: "items",
        title: "รายการสินค้า / บริการ",
        description: "เพิ่มรายการ จำนวน และราคาต่อหน่วย",
        fields: [{ name: "items", label: "รายการ", type: "items", required: true }],
      },
      {
        id: "terms",
        title: "เงื่อนไข",
        description: "ส่วนลด ภาษี และอายุใบเสนอราคา",
        fields: [
          { name: "discount", label: "ส่วนลด (%)", type: "number", half: true, placeholder: "0" },
          { name: "validDays", label: "ยืนราคา (วัน)", type: "number", half: true, required: true, placeholder: "30" },
          { name: "vat", label: "คิดภาษีมูลค่าเพิ่ม 7%", type: "switch" },
          { name: "note", label: "หมายเหตุ", type: "textarea", placeholder: "เงื่อนไขการชำระเงิน การส่งมอบ ฯลฯ" },
        ],
      },
    ],
    pipeline: [
      "ตรวจสอบความถูกต้องของข้อมูล",
      "คำนวณยอดรวม ส่วนลด และภาษี",
      "ออกเลขที่เอกสาร",
      "จัดทำไฟล์ใบเสนอราคา (PDF)",
      "ส่งเข้าระบบอัตโนมัติ",
    ],
    historyLabel: (data) => {
      const items = readItems(data);
      const t = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
      return `${items.length} รายการ · ${formatBaht(t.total)}`;
    },
  },
  customer: {
    type: "customer",
    title: "ลงข้อมูลลูกค้า",
    verb: "ข้อมูลลูกค้า",
    description: "บันทึกลูกค้าใหม่เข้าระบบ CRM ทีละขั้นตอน",
    icon: UserPlus,
    refPrefix: "CU",
    defaults: () => ({ customerType: "company" }),
    steps: [
      {
        id: "basic",
        title: "ข้อมูลพื้นฐาน",
        description: "ประเภทและชื่อลูกค้า",
        fields: [
          {
            name: "customerType",
            label: "ประเภทลูกค้า",
            type: "select",
            required: true,
            options: [
              { value: "company", label: "นิติบุคคล" },
              { value: "person", label: "บุคคลธรรมดา" },
            ],
          },
          { name: "name", label: "ชื่อลูกค้า", type: "text", required: true, placeholder: "ชื่อ-นามสกุล หรือชื่อบริษัท" },
          { name: "taxId", label: "เลขผู้เสียภาษี / บัตรประชาชน", type: "text", placeholder: "13 หลัก" },
        ],
      },
      {
        id: "contact",
        title: "ช่องทางติดต่อ",
        description: "เบอร์โทรและอีเมล",
        fields: [
          { name: "phone", label: "เบอร์โทร", type: "tel", required: true, half: true, placeholder: "08x-xxx-xxxx" },
          { name: "email", label: "อีเมล", type: "email", half: true, placeholder: "name@company.com" },
          { name: "line", label: "LINE ID", type: "text", half: true, placeholder: "@line" },
        ],
      },
      {
        id: "address",
        title: "ที่อยู่",
        description: "สำหรับออกเอกสารและจัดส่ง",
        fields: [
          { name: "address", label: "ที่อยู่", type: "textarea", placeholder: "เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ" },
          { name: "province", label: "จังหวัด", type: "text", half: true, placeholder: "กรุงเทพมหานคร" },
          { name: "postcode", label: "รหัสไปรษณีย์", type: "text", half: true, placeholder: "10110" },
        ],
      },
    ],
    pipeline: [
      "ตรวจสอบรูปแบบข้อมูลติดต่อ",
      "ค้นหาข้อมูลซ้ำในระบบ",
      "สร้างรหัสลูกค้า",
      "บันทึกเข้าระบบ CRM",
    ],
    historyLabel: (data) =>
      readString(data, "customerType") === "person" ? "ลูกค้าบุคคลธรรมดา" : "ลูกค้านิติบุคคล",
  },
  document: {
    type: "document",
    title: "คีย์เอกสาร",
    verb: "เอกสาร",
    description: "คีย์ข้อมูลเอกสารบัญชี/จัดซื้อเข้าระบบ",
    icon: FileText,
    refPrefix: "DC",
    defaults: () => ({ docType: "invoice" }),
    steps: [
      {
        id: "header",
        title: "หัวเอกสาร",
        description: "ประเภท เลขที่ และวันที่",
        fields: [
          { name: "docType", label: "ประเภทเอกสาร", type: "select", required: true, options: DOC_TYPES },
          { name: "docNo", label: "เลขที่เอกสาร", type: "text", required: true, half: true, placeholder: "INV-2026-001" },
          { name: "docDate", label: "วันที่เอกสาร", type: "date", required: true, half: true },
        ],
      },
      {
        id: "detail",
        title: "รายละเอียด",
        description: "คู่ค้าและจำนวนเงิน",
        fields: [
          { name: "party", label: "คู่ค้า / ผู้ออกเอกสาร", type: "text", required: true, placeholder: "ชื่อบริษัทคู่ค้า" },
          { name: "amount", label: "จำนวนเงิน (บาท)", type: "number", required: true, half: true, placeholder: "0.00" },
          {
            name: "category",
            label: "หมวดหมู่",
            type: "select",
            half: true,
            options: [
              { value: "expense", label: "ค่าใช้จ่าย" },
              { value: "income", label: "รายได้" },
              { value: "asset", label: "สินทรัพย์" },
            ],
          },
        ],
      },
      {
        id: "note",
        title: "หมายเหตุ",
        description: "ข้อมูลเพิ่มเติมสำหรับผู้ตรวจ",
        fields: [{ name: "note", label: "หมายเหตุ", type: "textarea", placeholder: "เช่น รอเซ็นอนุมัติ" }],
      },
    ],
    pipeline: [
      "อ่านและตรวจสอบหัวเอกสาร",
      "จับคู่คู่ค้ากับฐานข้อมูล",
      "ลงบัญชีตามหมวดหมู่",
      "แนบเอกสารเข้าระบบจัดเก็บ",
    ],
    historyLabel: (data) =>
      `${docTypeLabel(readString(data, "docType"))} · ${formatBaht(readNumber(data, "amount"))}`,
  },
};

export const TASK_LIST: TaskDef[] = [TASKS.quotation, TASKS.customer, TASKS.document];

export const isTaskType = (v: string): v is TaskType => v in TASKS;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step: StepDef, data: TaskData): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of step.fields) {
    if (f.type === "items") {
      const items = readItems(data);
      const valid = items.filter((i) => i.name.trim() && i.qty > 0);
      if (f.required && valid.length === 0) errors[f.name] = "เพิ่มอย่างน้อย 1 รายการ พร้อมชื่อและจำนวน";
      else if (items.some((i) => !i.name.trim() || i.qty <= 0)) errors[f.name] = "กรอกชื่อและจำนวนให้ครบทุกรายการ";
      continue;
    }
    if (f.type === "switch") continue;
    const value = readString(data, f.name).trim();
    if (f.required && !value) {
      errors[f.name] = "จำเป็นต้องกรอก";
      continue;
    }
    if (value && f.type === "email" && !EMAIL_RE.test(value)) errors[f.name] = "รูปแบบอีเมลไม่ถูกต้อง";
    if (value && f.type === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0))
      errors[f.name] = "ต้องเป็นตัวเลขไม่ติดลบ";
  }
  return errors;
}
