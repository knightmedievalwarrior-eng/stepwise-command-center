/**
 * n8n webhook settings, kept in this browser only (localStorage).
 * Holds connection settings, never task or customer data.
 */
import { useSyncExternalStore } from "react";

export interface N8nConfig {
  url: string;
  /** Optional header for n8n "Header Auth" on the Webhook node. */
  authHeader: string;
  authValue: string;
}

export const N8N_CONFIG_KEY = "gtr.n8n.v1";
const EMPTY: N8nConfig = { url: "", authHeader: "", authValue: "" };

let cache: N8nConfig | null = null;
const listeners = new Set<() => void>();

function read(): N8nConfig {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = JSON.parse(window.localStorage.getItem(N8N_CONFIG_KEY) ?? "null") as Partial<N8nConfig> | null;
    cache = {
      url: typeof raw?.url === "string" ? raw.url : "",
      authHeader: typeof raw?.authHeader === "string" ? raw.authHeader : "",
      authValue: typeof raw?.authValue === "string" ? raw.authValue : "",
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function getN8nConfig(): N8nConfig {
  return read();
}

export function saveN8nConfig(next: N8nConfig) {
  cache = { url: next.url.trim(), authHeader: next.authHeader.trim(), authValue: next.authValue };
  if (typeof window !== "undefined") {
    if (!cache.url) window.localStorage.removeItem(N8N_CONFIG_KEY);
    else window.localStorage.setItem(N8N_CONFIG_KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

export function useN8nConfig(): N8nConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

/** Returns a Thai error message, or null when the URL can be used from the browser. */
export function validateWebhookUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "กรุณาใส่ Webhook URL";
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "รูปแบบ URL ไม่ถูกต้อง";
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol === "https:") return null;
  if (u.protocol === "http:" && local) return null;
  if (u.protocol === "http:") return "ต้องเป็น https:// (เบราว์เซอร์บล็อก http จากหน้าเว็บที่ปลอดภัย)";
  return "ต้องขึ้นต้นด้วย https://";
}

export function webhookHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Test helper. */
export function __resetN8nConfigForTests() {
  cache = null;
}
