import { Award, BarChart3, Database, FileSpreadsheet, PlusCircle, Sprout, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Dashboard({ go }: { go: (p: string, id?: string) => void }) {
  const stats = useAsync(api.stats);
  const metrics = useAsync(api.metrics);

  return (
    <>
      <div className="head">
        <span className="head-badge">
          <TrendingUp size={13} /> Live System Overview
        </span>
        <h1>Agricultural Intelligence Dashboard</h1>
        <p>
          Real-time metrics aggregated across all historical soil screenings stored in MongoDB Atlas,
          coupled with current machine learning model performance benchmarks.
        </p>
      </div>

      <div className="grid g3">
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span>Saved Soil Analyses</span>
            <Database size={22} color="#124d36" />
          </div>
          <b>{stats.data?.total_analyses ?? "-"}</b>
          <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 700 }}>
            {stats.data ? "Live Records in Atlas" : "Awaiting Data"}
          </span>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span>Model Test Accuracy</span>
            <Award size={22} color="#d97706" />
          </div>
          <b>
            {metrics.data
              ? `${(metrics.data.models[metrics.data.selected_model].test.accuracy * 100).toFixed(1)}%`
              : "-"}
          </b>
          <span style={{ fontSize: "0.8rem", color: "#526359" }}>
            {metrics.data?.selected_model} (5-fold CV Verified)
          </span>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span>Knowledge Base Records</span>
            <FileSpreadsheet size={22} color="#0284c7" />
          </div>
          <b>{metrics.data?.dataset_integrity.rows ?? "-"}</b>
          <span style={{ fontSize: "0.8rem", color: "#526359" }}>
            Across {metrics.data?.dataset_integrity.n_classes} Distinct Crop Classes
          </span>
        </div>
      </div>

      {stats.error && (
        <div style={{ marginTop: 20 }}>
          <Alert kind="info">Database records currently unavailable: {stats.error}</Alert>
        </div>
      )}

      {stats.loading && (
        <div style={{ marginTop: 20 }}>
          <Loading text="Loading dashboard metrics..." />
        </div>
      )}

      {stats.data && (
        <div className="grid g2" style={{ marginTop: 20 }}>
          {/* Top Crops Chart */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <Sprout size={20} color="#124d36" />
              <h2>Most Frequently Recommended Crops</h2>
            </div>
            {stats.data.top_recommended_crops.length === 0 ? (
              <p className="hint">
                No analyses recorded yet.{" "}
                <button className="btn ghost" onClick={() => go("analyze")}>
                  Run First Analysis
                </button>
              </p>
            ) : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.data.top_recommended_crops}>
                    <CartesianGrid vertical={false} stroke="#e2e8e2" />
                    <XAxis dataKey="crop" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#124d36" radius={[6, 6, 0, 0]} name="Times Recommended #1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* pH Class Distribution */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <BarChart3 size={20} color="#d97706" />
              <h2>Soil pH Class Distribution</h2>
            </div>
            {Object.keys(stats.data.ph_class_distribution).length === 0 ? (
              <p className="hint">No pH distribution data accumulated yet.</p>
            ) : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={Object.entries(stats.data.ph_class_distribution).map(([name, n]) => ({ name, n }))}>
                    <CartesianGrid vertical={false} stroke="#e2e8e2" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="n" fill="#d97706" radius={[6, 6, 0, 0]} name="Sample Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent Analyses Table */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <h2>Recent Soil Analyses</h2>
              <button className="btn ghost" onClick={() => go("analyze")} style={{ padding: "6px 14px" }}>
                <PlusCircle size={16} /> New Analysis
              </button>
            </div>
            {stats.data.recent.length === 0 ? (
              <p className="hint">No analyses recorded yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Location</th>
                    <th>Primary Recommended Crop</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.recent.map((r) => (
                    <tr key={r.analysis_id}>
                      <td>{r.created_at.slice(0, 16).replace("T", " ")}</td>
                      <td>{r.location ?? "Not specified"}</td>
                      <td style={{ textTransform: "capitalize", fontWeight: 700, color: "#124d36" }}>
                        {r.top_crop ?? "Not predicted"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn ghost" onClick={() => go("history", r.analysis_id)} style={{ padding: "5px 12px" }}>
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
