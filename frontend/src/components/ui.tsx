import { AlertTriangle, Info, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export const Alert = ({ kind, children }: { kind: "err" | "warn" | "info"; children: ReactNode }) => (
  <div className={`alert ${kind}`} role={kind === "err" ? "alert" : "status"}>
    {kind === "err" ? <XCircle size={18} /> : kind === "warn" ? <AlertTriangle size={18} /> : <Info size={18} />}
    <div>{children}</div>
  </div>
);
export const Loading = ({ text = "Loading" }: { text?: string }) => (
  <div className="row" role="status"><Loader2 className="spin" size={18} />{text}</div>
);
export const Badge = ({ kind, children }: { kind?: string; children: ReactNode }) => <span className={`badge ${kind ?? ""}`}>{children}</span>;
export const PageHead = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="head"><h1>{title}</h1>{children && <p>{children}</p>}</div>
);
