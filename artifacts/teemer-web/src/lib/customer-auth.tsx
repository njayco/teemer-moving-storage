import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface CustomerUser {
  customerId: number;
  email: string;
  username: string;
  fullName: string;
  phone?: string | null;
}

interface CustomerAuthContextType {
  customer: CustomerUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCustomer: (c: CustomerUser | null) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/customer-auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer ?? null);
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/customer-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
        return { success: true };
      }
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      return { success: false, error: err.error || "Login failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/customer-auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setCustomer(null);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, refresh, login, logout, setCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}

export const customerApi = {
  base: API_BASE,
  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    return res;
  },
  async json<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetch(path, init);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  },
};
