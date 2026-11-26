import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModelResult } from "../types";

const rate = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 4 });

export default function HeldOutEvaluation({ model, result }: { model: string; result: NonNullable<ModelResult["test"]> }) {
  const [crop, setCrop] = useState("");
  const [zoom, setZoom] = useState(false);
  const { roc, confusion_matrix: counts } = result;
  const total = counts.flat().reduce((sum, count) => sum + count, 0);
  const correct = counts.reduce((sum, row, index) => sum + (row[index] ?? 0), 0);
  const scores = [
    { name: "Accuracy", value: (result.accuracy * 100).toFixed(2) + "%", description: total > 0 ? correct + " of " + total + " predictions correct" : "Share of correct predictions" },
    { name: "Macro precision", value: result.precision_macro.toFixed(4), description: "How often predicted crops were correct" },
    { name: "Macro recall", value: result.recall_macro.toFixed(4), description: "How often actual crops were found" },
    { name: "Macro F1", value: result.f1_macro.toFixed(4), description: "Balances precision and recall" },
  ];
  const cropCurve = roc?.per_class?.[crop];
  const curve = cropCurve ?? roc?.micro_average;
  const curveName = cropCurve ? crop + " vs. rest" : "Micro-average";
  const points = curve?.fpr.map((fpr, index) => ({ fpr, tpr: curve.tpr[index] }));
  const maxFpr = zoom ? 0.01 : 1;

  return (
    <section className="card model-insight" aria-labelledby="held-out-heading">
      <h2 id="held-out-heading">Held-out Evaluation ({model})</h2>
      <p className="insight-intro">The model was evaluated on samples kept aside from training. Macro scores give each crop equal weight.</p>
      <dl className="insight-stats">
        {scores.map(({ name, value, description }) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}<small>{description}</small></dd>
          </div>
        ))}
      </dl>

      {roc && curve && (
        <div className="insight-section">
          <div className="insight-toolbar">
            <div>
              <h3>One-vs-rest ROC</h3>
              <p className="hint">An AUC closer to 1 means better separation between a crop and the other crops.</p>
            </div>
            <label className="insight-select">
              <span>ROC curve</span>
              <select value={cropCurve ? crop : ""} onChange={(event) => setCrop(event.target.value)}>
                <option value="">Micro-average (all crops)</option>
                {Object.keys(roc.per_class ?? {}).map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            </label>
          </div>
          <p className="insight-auc"><strong>{curveName} AUC {curve.auc.toFixed(6)}</strong><span>Macro AUC {roc.macro_auc.toFixed(6)}</span></p>
          <div className="insight-toolbar insight-roc-key">
            <div className="insight-legend" role="group" aria-label="ROC legend">
              <span><i className="insight-roc-line" aria-hidden="true" />{curveName} ROC</span>
              <span><i className="insight-roc-baseline" aria-hidden="true" />Random baseline</span>
            </div>
            <button type="button" className="btn ghost" aria-controls="evaluation-roc" onClick={() => setZoom((value) => !value)}>
              {zoom ? "Show full ROC" : "Zoom to 0–1% false positives"}
            </button>
          </div>
          <div className="insight-chart" id="evaluation-roc" role="group" aria-label={"ROC curve for " + curveName}>
            <ResponsiveContainer width="100%" height={270}>
              <LineChart accessibilityLayer data={points} margin={{ top: 12, right: 20, bottom: 25, left: 16 }}>
                <CartesianGrid stroke="#e2e8e2" strokeDasharray="3 3" />
                <XAxis dataKey="fpr" type="number" allowDataOverflow domain={[0, maxFpr]}
                  ticks={zoom ? [0, 0.0025, 0.005, 0.0075, 0.01] : [0, 0.25, 0.5, 0.75, 1]}
                  tickFormatter={(value: number) => rate.format(value)} tick={{ fontSize: 11 }}
                  label={{ value: "False positive rate", position: "insideBottom", offset: -14 }} />
                <YAxis type="number" allowDataOverflow domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={52}
                  tickFormatter={(value: number) => rate.format(value)} tick={{ fontSize: 11 }}
                  label={{ value: "True positive rate", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }} />
                <Tooltip labelFormatter={(value: number) => "False positive rate " + rate.format(value)}
                  formatter={(value: number) => [rate.format(value), "True positive rate"]} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxFpr, y: maxFpr }]} stroke="#64786c" strokeDasharray="5 4" />
                <Line dataKey="tpr" stroke="#124d36" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <p className="hint insight-footer">These scores describe the curated benchmark. Field accuracy needs independent soil and climate data.</p>
    </section>
  );
}
