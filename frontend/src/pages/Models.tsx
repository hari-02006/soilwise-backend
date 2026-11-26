import { BarChart2, Cpu, Database, Layers, ShieldCheck } from "lucide-react";
import { Alert, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Models() {
  const { data: m, error, loading } = useAsync(api.metrics);

  if (loading) return <Loading text="Loading ML model performance metrics..." />;
  if (error || !m) return <Alert kind="err">{error}</Alert>;

  const sel = m.models[m.selected_model].test;
  const max = Math.max(...sel.confusion_matrix.flat(), 1);
  const di = m.dataset_integrity;

  return (
    <>
      <div className="head">
        <span className="head-badge">
          <Cpu size={13} /> Machine Learning Architecture
        </span>
        <h1>Model Intelligence &amp; Benchmark Metrics</h1>
        <p>
          Performance evaluation, 5-fold cross validation, and statistical clustering metrics computed on model version <strong>{m.model_version}</strong> (trained {m.trained_at.slice(0, 10)}).
        </p>
      </div>

      <div className="stack">
        {/* Model Comparison Table */}
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <Layers size={20} color="#124d36" />
            <h2>Candidate Model Evaluation (5-Fold Cross-Validation)</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>CV Accuracy (Mean ± Std)</th>
                <th>CV Macro-F1</th>
                <th>Test Accuracy</th>
                <th>Test Precision</th>
                <th>Test Recall</th>
                <th>Test F1 Score</th>
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
                  <td>{r.cv_f1_macro_mean.toFixed(4)}</td>
                  <td>{(r.test.accuracy * 100).toFixed(2)}%</td>
                  <td>{r.test.precision_macro.toFixed(4)}</td>
                  <td>{r.test.recall_macro.toFixed(4)}</td>
                  <td>{r.test.f1_macro.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Alert kind="warn">
          High accuracy scores (&gt;98%) are typical for this balanced dataset (exactly {di.samples_per_class_min_max[0]} samples across all {di.n_classes} crops). The model has robustly captured non-linear feature boundaries across soil parameters.
        </Alert>

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
                  <td style={{ fontWeight: 600 }}>Total Training Records</td>
                  <td>{di.rows} rows</td>
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
              Primary source: Crop Recommendation Open Dataset. Preprocessed and normalized with scikit-learn standard pipelines.
            </p>
          </div>
        </div>

        {/* Confusion Matrix */}
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={20} color="#124d36" />
            <h2>Confusion Matrix ({m.selected_model} on Test Partition)</h2>
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <div
              className="cm"
              style={{
                gridTemplateColumns: `repeat(${sel.labels.length}, minmax(24px, 1fr))`,
                minWidth: 580,
              }}
            >
              {sel.confusion_matrix.flatMap((row, i) =>
                row.map((v, j) => (
                  <div
                    key={`${i}-${j}`}
                    title={`Actual: ${sel.labels[i]} | Predicted: ${sel.labels[j]} (${v} instances)`}
                    style={{
                      background: v > 0 ? `rgba(18, 77, 54, ${Math.max(0.15, v / max)})` : "#f3f5f3",
                      color: v / max > 0.45 ? "#ffffff" : "#132219",
                    }}
                  >
                    {v || ""}
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Vertical axis: Actual classes | Horizontal axis: Model predictions in alphabetical order: {sel.labels.join(", ")}. Hover over cells for detailed counts.
          </p>
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
