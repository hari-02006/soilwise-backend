import { BarChart2, Cpu, Database, Layers, ShieldCheck } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Models() {
  const { data: m, error, loading } = useAsync(api.metrics);

  if (loading) return <Loading text="Loading ML model performance metrics..." />;
  if (error || !m) return <Alert kind="err">{error}</Alert>;

  const sel = m.models[m.selected_model]?.test;
  if (!sel) return <Alert kind="err">Selected model evaluation is unavailable.</Alert>;
  const max = Math.max(...sel.confusion_matrix.flat(), 1);
  const di = m.dataset_integrity;
  const validation = m.validation ? m.validation.repeats + " × " + m.validation.folds + " folds" : "5 folds";
  const curve = sel.roc?.micro_average;
  const rocPoints = curve?.fpr.map((fpr, i) => ({ fpr, tpr: curve.tpr[i] }));
  const eda = m.training_eda;
  const features = Object.keys(eda?.correlations ?? {});

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

        <div className="card">
          <h2>Held-out Evaluation ({m.selected_model})</h2>
          <p>
            Accuracy {(sel.accuracy * 100).toFixed(2)}%, macro precision {sel.precision_macro.toFixed(4)},
            macro recall {sel.recall_macro.toFixed(4)}, macro-F1 {sel.f1_macro.toFixed(4)}.
          </p>
          {sel.roc && (
            <>
              <h3>One-vs-Rest ROC</h3>
              <p>Macro AUC {sel.roc.macro_auc.toFixed(5)}. The micro-average curve has AUC {sel.roc.micro_average.auc.toFixed(5)}.</p>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={rocPoints} margin={{ right: 20, bottom: 20, left: 10 }}>
                  <XAxis dataKey="fpr" type="number" domain={[0, 1]} label={{ value: "False positive rate", position: "bottom" }} />
                  <YAxis type="number" domain={[0, 1]} label={{ value: "True positive rate", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#999" strokeDasharray="4 4" />
                  <Line dataKey="tpr" stroke="#124d36" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
          <p className="hint">Scores describe the curated benchmark. Field validation requires independent soil and climate data.</p>
        </div>

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

        {eda && (
          <div className="card">
            <h2>Training Data Exploration</h2>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={Object.entries(eda.class_counts).map(([crop, count]) => ({ crop, count }))} margin={{ bottom: 45 }}>
                <XAxis dataKey="crop" interval={0} angle={-55} tick={{ fontSize: 10 }} textAnchor="end" />
                <YAxis label={{ value: "Samples", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Bar dataKey="count" fill="#124d36" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <h3>Pearson Correlations</h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Feature</th>{features.map((f) => <th key={f}>{f}</th>)}</tr></thead>
                <tbody>{features.map((row) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {features.map((column) => {
                      const value = eda.correlations[row][column];
                      return <td key={column} style={{
                        backgroundColor: value < 0 ? "rgba(194, 65, 12, " + Math.abs(value) / 3 + ")" : "rgba(18, 77, 54, " + value / 3 + ")",
                      }}>{value.toFixed(2)}</td>;
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

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
