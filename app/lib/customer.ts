const STORAGE_KEY = "gilly:customer";

export interface CustomerInfo {
  name: string;
}

// sessionStorage (not localStorage) — this is a per-visit gate, not a
// persistent login, so a new tab/session asks again.
export function loadCustomerInfo(): CustomerInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerInfo>;
    if (!parsed.name) return null;
    return { name: parsed.name };
  } catch {
    return null;
  }
}

export function saveCustomerInfo(info: CustomerInfo): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}
