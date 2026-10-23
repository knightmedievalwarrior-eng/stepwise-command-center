import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  calcQuotation,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  type FieldDef,
  type QuoteItem,
  type TaskData,
} from "@/lib/tasks/definitions";

interface Props {
  field: FieldDef;
  data: TaskData;
  error: string | undefined;
  onChange: (name: string, value: unknown) => void;
}

export function FieldInput({ field, data, error, onChange }: Props) {
  const id = `f-${field.name}`;
  const wide = !field.half || field.type === "textarea" || field.type === "items";

  if (field.type === "items") {
    return (
      <div className="sm:col-span-2">
        <ItemsEditor data={data} onChange={(items) => onChange("items", items)} />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "switch") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3 sm:col-span-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </Label>
        <Switch id={id} checked={readBool(data, field.name)} onCheckedChange={(v) => onChange(field.name, v)} />
      </div>
    );
  }

  const value = readString(data, field.name);
  const invalid = Boolean(error);

  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-0.5 text-signal">*</span>}
      </Label>
      {field.type === "select" ? (
        <Select value={value} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger id={id} aria-invalid={invalid} className="h-11 bg-card">
            <SelectValue placeholder="เลือก…" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          placeholder={field.placeholder}
          aria-invalid={invalid}
          rows={3}
          className="bg-card"
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "text" : field.type}
          inputMode={field.type === "number" ? "decimal" : field.type === "tel" ? "tel" : undefined}
          value={value}
          placeholder={field.placeholder}
          aria-invalid={invalid}
          className="h-11 bg-card"
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : field.hint ? (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      ) : null}
    </div>
  );
}

function ItemsEditor({ data, onChange }: { data: TaskData; onChange: (items: QuoteItem[]) => void }) {
  const items = readItems(data);
  const totals = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
  const update = (i: number, patch: Partial<QuoteItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_80px_120px_110px_32px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
        <span>รายการ</span>
        <span>จำนวน</span>
        <span>ราคา/หน่วย</span>
        <span className="text-right">รวม</span>
        <span />
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-3 sm:grid-cols-[1fr_80px_120px_110px_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
        >
          <Input
            aria-label={`ชื่อรายการที่ ${i + 1}`}
            value={it.name}
            placeholder="ชื่อสินค้า / บริการ"
            className="col-span-2 h-10 bg-card sm:col-span-1"
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <Input
            aria-label="จำนวน"
            inputMode="numeric"
            value={it.qty ? String(it.qty) : ""}
            placeholder="1"
            className="h-10 bg-card"
            onChange={(e) => update(i, { qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
          />
          <Input
            aria-label="ราคาต่อหน่วย"
            inputMode="decimal"
            value={it.price ? String(it.price) : ""}
            placeholder="0.00"
            className="h-10 bg-card"
            onChange={(e) => update(i, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
          />
          <span className="self-center text-right font-mono text-sm tabular-nums">
            {formatBaht(it.qty * it.price)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="ลบรายการ"
            disabled={items.length <= 1}
            className="justify-self-end"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { name: "", qty: 1, price: 0 }])}
      >
        <Plus /> เพิ่มรายการ
      </Button>
      <div className="flex items-center justify-between border-t border-dashed border-border pt-3 text-sm">
        <span className="text-muted-foreground">ยอดรวมก่อนส่วนลด</span>
        <span className="font-mono font-medium tabular-nums">{formatBaht(totals.subtotal)}</span>
      </div>
    </div>
  );
}
