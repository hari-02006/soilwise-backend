import type { Analysis, Health, Metrics, NpkUnit, Stats, UploadResult } from "../types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(url, init); }
  catch { throw new ApiError(0, "Cannot reach the SoilWise backend. Start it with: uvicorn app.main:app --reload"); }
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const b = await r.json();
      msg = typeof b.detail === "string" ? b.detail
        : Array.isArray(b.detail) ? b.detail.map((d: { loc: string[]; msg: string }) => `${d.loc.slice(1).join(".")}: ${d.msg}`).join("; ") : msg;
    } catch { /* non-JSON error body */ }
    throw new ApiError(r.status, msg);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export interface AnalyzePayload {
  N?: number | null; P?: number | null; K?: number | null; ph?: number | null;
  temperature?: number | null; humidity?: number | null; rainfall?: number | null;
  npk_unit: NpkUnit; location?: string; farming_context?: string;
  input_source: "manual" | "report"; report_metadata?: object | null; save: boolean;
}

export const api = {
  health: () => req<Health>("/api/health"),
  metrics: () => req<Metrics>("/api/model/metrics"),
  analyze: (p: AnalyzePayload) =>
    req<Analysis>("/api/soil/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }),
  upload: (file: File) => { const f = new FormData(); f.append("file", file); return req<UploadResult>("/api/soil/upload-report", { method: "POST", body: f }); },
  list: () => req<(Analysis & { analysis_id: string })[]>("/api/analyses"),
  get: (id: string) => req<Analysis>(`/api/analyses/${id}`),
  remove: (id: string) => req<void>(`/api/analyses/${id}`, { method: "DELETE" }),
  stats: () => req<Stats>("/api/dashboard/statistics"),
  reportUrl: (id: string) => `/api/analyses/${id}/report`,
};
