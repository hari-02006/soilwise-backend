import { ArrowLeft, Download, GitCompare, History as HistoryIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import ResultView from "../components/ResultView";
import { Alert, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { Analysis } from "../types";

export default function History({ openId }: { openId?: string }) {
  const list = useAsync(api.list);
  const [sel, setSel] = useState<string[]>([]);
  const [detail, setDetail] = useState<Analysis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (openId) {
      api.get(openId).then(setDetail).catch((e: Error) => setErr(e.message));
    }
  }, [openId]);

  const open = (id: string) => {
    setErr(null);
    api.get(id).then(setDetail).catch((e: Error) => setErr(e.message));
  };

  async function del(id: string) {
    if (!window.confirm("Permanently delete this analysis record from database?")) return;
    try {
      await api.remove(id);
      setSel((s) => s.filter((x) => x !== id));
      setDetail(null);
      list.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));

  if (detail) {
    return (
      <>
        <div className="row" style={{ marginBottom: 18, justifyContent: "space-between" }}>
          <button className="btn ghost" onClick={() => setDetail(null)}>
            <ArrowLeft size={16} /> Back to History List
          </button>
          {detail.analysis_id && (
            <button className="btn danger" onClick={() => del(detail.analysis_id!)}>
              <Trash2 size={16} /> Delete Record
            </button>
          )}
        </div>
        <ResultView a={detail} />
      </>
    );
  }

  const items = list.data ?? [];
  const pair = items.filter((i) => sel.includes(i.analysis_id));

  return (
    <>
      <div className="head">
        <span className="head-badge">
          <HistoryIcon size={13} /> Historical Archive
        </span>
        <h1>Analysis History &amp; Field Comparisons</h1>
        <p>
          View past soil analyses, export official PDF lab reports, or select any two tests to generate a side-by-side comparison.
        </p>
      </div>

      {list.loading && <Loading text="Fetching historical database records..." />}
      {list.error && <Alert kind="err">{list.error}</Alert>}
      {err && <Alert kind="err">{err}</Alert>}

      {list.data && items.length === 0 && (
        <Alert kind="info">No saved analyses found in MongoDB yet. Run a new analysis to see it archived here.</Alert>
      )}

      {items.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Compare</th>
                <th>Recorded Date</th>
                <th>Location / Plot</th>
                <th>Top Crop Match</th>
                <th>AI Model</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.analysis_id}>
                  <td>
                    <input
                      type="checkbox"
                      style={{ width: "auto", cursor: "pointer" }}
                      aria-label="Select for comparison"
                      checked={sel.includes(i.analysis_id)}
                      onChange={() => toggle(i.analysis_id)}
                    />
                  </td>
                  <td>{String(i.created_at).slice(0, 16).replace("T", " ")}</td>
                  <td>{i.location ?? "General Field"}</td>
                  <td style={{ textTransform: "capitalize", fontWeight: 700, color: "#124d36" }}>
                    {i.crop_recommendations?.top_crops[0].crop ?? "N/A"}
                  </td>
                  <td>{i.model_version ?? "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                      <button className="btn ghost" onClick={() => open(i.analysis_id)} style={{ padding: "4px 10px" }}>
                        View
                      </button>
                      <a
                        className="btn ghost"
                        href={api.reportUrl(i.analysis_id)}
                        aria-label="Download PDF"
                        title="Download PDF"
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: "4px 8px" }}
                      >
                        <Download size={15} />
                      </a>
                      <button
                        className="btn danger"
                        aria-label="Delete analysis"
                        title="Delete"
                        onClick={() => del(i.analysis_id)}
                        style={{ padding: "4px 8px" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pair.length === 2 && (
        <div className="card" style={{ marginTop: 24, border: "2px solid #10b981" }}>
          <div className="row" style={{ gap: 8, marginBottom: 14 }}>
            <GitCompare size={20} color="#124d36" />
            <h2>Side-by-Side Soil &amp; Recommendation Comparison</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Soil Parameter</th>
                {pair.map((p) => (
                  <th key={p.analysis_id} style={{ color: "#124d36" }}>
                    {String(p.created_at).slice(0, 10)} — {p.location ?? "Plot"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["N", "P", "K", "ph", "temperature", "humidity", "rainfall"].map((k) => (
                <tr key={k}>
                  <td style={{ fontWeight: 600 }}>{k.toUpperCase()}</td>
                  {pair.map((p) => (
                    <td key={p.analysis_id}>{p.soil_parameters[k] ?? "-"}</td>
                  ))}
                </tr>
              ))}
              {[0, 1, 2].map((r) => (
                <tr key={r} style={{ background: "#f8faf8" }}>
                  <td style={{ fontWeight: 700 }}>Rank #{r + 1} Crop</td>
                  {pair.map((p) => {
                    const c = p.crop_recommendations?.top_crops[r];
                    return (
                      <td key={p.analysis_id} style={{ textTransform: "capitalize", fontWeight: 700, color: "#124d36" }}>
                        {c ? `${c.crop} (${(c.probability * 100).toFixed(0)}%)` : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
