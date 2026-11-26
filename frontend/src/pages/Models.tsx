import { BarChart2, Cpu, Database, Layers } from "lucide-react";
import ConfusionMatrix from "../components/ConfusionMatrix";
import HeldOutEvaluation from "../components/HeldOutEvaluation";
import TrainingDataExploration from "../components/TrainingDataExploration";
import { Alert, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Models() {
  const { data: m, error, loading } = useAsync(api.metrics);

  if (loading) return <Loading text="Loading ML model performance metrics..." />;
  if (error || !m) return <Alert kind="err">{error}</Alert>;

  const sel = m.models[m.selected_model]?.test;
  if (!sel) return <Alert kind="err">Selected model evaluation is unavailable.</Alert>;
  const di = m.dataset_integrity;
  const validation = m.validation ? m.validation.repeats + " × " + m.validation.folds + " folds" : "5 folds";
  const eda = m.training_eda;

  return (
    <>
      <div className="head">
        <span className="head-badge">
          <Cpu size={13} /> Machine Learning Architecture
        </span>
        <h1>Model Intelligence &amp; Benchmark Metrics</h1>
        <p>
          Validation and clustering results for <strong>{m.model_version}</strong> (trained {m.trained_at.slice(0, 10)}).
        </p>
      </div>

      <div className="stack">
        {/* Model Comparison Table */}
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <Layers size={20} color="#124d36" />
            <h2>Candidate Comparison ({validation})</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>CV Accuracy (Mean ± Std)</th>
                <th>CV Macro-F1</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.models).map(([n, r]) => (
                <tr
                  key={n}
                  style={
                    n === m.selected_model
                      ? { fontWeight: 700, background: "#ecfdf5", borderLeft: "4px solid #10b981" }
                      : undefined
                  }
                >
                  <td>
                    {n}
                    {n === m.selected_model && (
                      <span className="badge optimal" style={{ marginLeft: 8 }}>
                        Selected Best
                      </span>
                    )}
                  </td>
                  <td>
                    {(r.cv_accuracy_mean * 100).toFixed(2)}% ± {(r.cv_accuracy_std * 100).toFixed(2)}%
                  </td>
                  <td>
                    {r.cv_f1_macro_mean.toFixed(4)}
                    {r.cv_f1_macro_std !== undefined && " ± " + r.cv_f1_macro_std.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <HeldOutEvaluation model={m.selected_model} result={sel} />

        <ConfusionMatrix model={m.selected_model} labels={sel.labels} counts={sel.confusion_matrix} />

        {m.tuning && (
          <div className="card">
            <h2>Nested Grid Search</h2>
            <p>{m.tuning.outer_folds} outer folds, {m.tuning.inner_folds} inner folds. Outer macro-F1 {m.tuning.outer_cv.cv_f1_macro_mean.toFixed(4)} ± {m.tuning.outer_cv.cv_f1_macro_std?.toFixed(4)}.</p>
            <ul>
              {Object.entries(m.tuning.best_parameters).map(([key, value]) => (
                <li key={key}>{key.replace("model__", "").replace(/_/g, " ")} = {value ?? "unlimited"}</li>
              ))}
            </ul>
          </div>
        )}
        {m.ablation && (
          <div className="card">
            <h2>Feature Ablation (Training CV)</h2>
            <table>
              <thead><tr><th>Inputs</th><th>Macro-F1</th><th>Change</th></tr></thead>
              <tbody>{Object.entries(m.ablation).map(([feature, row]) => (
                <tr key={feature}>
                  <td>{feature === "all_features" ? "All features" : "Without " + feature}</td>
                  <td>{row.cv_f1_macro_mean.toFixed(4)} ± {row.cv_f1_macro_std?.toFixed(4)}</td>
                  <td>{row.delta_macro_f1.toFixed(4)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {eda && <TrainingDataExploration data={eda} />}

        <div className="grid g2">
          {/* Feature Importance */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <BarChart2 size={20} color="#124d36" />
              <h2>Feature Importance Ranking ({m.selected_model})</h2>
            </div>
            {Object.entries(m.feature_importance)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div className="crop" key={k}>
                  <span style={{ width: 105, fontWeight: 600 }}>{k}</span>
                  <div className="bar">
                    <i
                      style={{
                        width: `${(v * 100) / Math.max(...Object.values(m.feature_importance))}%`,
                      }}
                    />
                  </div>
                  <b style={{ minWidth: 50, textAlign: "right" }}>{v.toFixed(3)}</b>
                </div>
              ))}
          </div>

          {/* Dataset Integrity */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <Database size={20} color="#0284c7" />
              <h2>Dataset Integrity Verification</h2>
            </div>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Dataset Records</td>
                  <td>{di.rows} rows{m.split && " (" + m.split.training_rows + " training, " + m.split.test_rows + " test)"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Missing / Null Values</td>
                  <td>{di.missing_values} (Clean)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Duplicate Records</td>
                  <td>{di.duplicate_rows} (De-duplicated)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Crops / Target Classes</td>
                  <td>{di.n_classes} balanced classes</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Interquartile Range Outliers</td>
                  <td>
                    {Object.entries(di.iqr_outlier_counts)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ") || "None"}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 10 }}>
              Source: Crop Recommendation Dataset. Integrity checks summarize the input CSV.
            </p>
          </div>
        </div>

        {/* K-Means Clusters */}
        <div className="card">
          <h2>K-Means Agro-Clustering (k = {m.kmeans.chosen_k}, Silhouette Optimized)</h2>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Cluster ID</th>
                  <th>Mean N</th>
                  <th>Mean P</th>
                  <th>Mean K</th>
                  <th>Temp (°C)</th>
                  <th>Humidity (%)</th>
                  <th>pH</th>
                  <th>Rainfall (mm)</th>
                  <th>Prevalent Crops in Cluster</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.kmeans.cluster_profiles).map(([c, p]) => (
                  <tr key={c}>
                    <td style={{ fontWeight: 700 }}>Cluster #{c}</td>
                    <td>{p.N}</td>
                    <td>{p.P}</td>
                    <td>{p.K}</td>
                    <td>{p.temperature}°C</td>
                    <td>{p.humidity}%</td>
                    <td>{p.ph}</td>
                    <td>{p.rainfall}mm</td>
                    <td style={{ fontWeight: 600, color: "#124d36", textTransform: "capitalize" }}>
                      {Object.keys(m.kmeans.top_crops_per_cluster[c]).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Optimal cluster count selected via silhouette score evaluation: {Object.entries(m.kmeans.silhouette_by_k).map(([k, v]) => `${k}=${v}`).join(", ")}.
          </p>
        </div>
      </div>
    </>
  );
}
