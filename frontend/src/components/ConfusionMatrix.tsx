import { ShieldCheck } from "lucide-react";
import { useState } from "react";

interface Props {
  model: string;
  labels: string[];
  counts: number[][];
}

const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 });

export default function ConfusionMatrix({ model, labels, counts }: Props) {
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const rowTotals = counts.map((row) => row.reduce((total, count) => total + count, 0));
  const sampleCount = rowTotals.reduce((total, count) => total + count, 0);
  const errors = counts.flatMap((row, actual) =>
    row.flatMap((count, predicted) => actual !== predicted && count > 0 ? [{ actual, predicted, count }] : []),
  ).sort((a, b) => b.count - a.count);
  const errorCount = errors.reduce((total, error) => total + error.count, 0);
  const actualWithErrors = new Set(errors.map(({ actual }) => actual));
  const errorColumns = new Set([...actualWithErrors, ...errors.map(({ predicted }) => predicted)]);
  const isFullMatrix = showFullMatrix || errors.length === 0;
  const indices = labels.map((_, index) => index);
  const rows = isFullMatrix ? indices : indices.filter((index) => actualWithErrors.has(index));
  const columns = isFullMatrix ? indices : indices.filter((index) => errorColumns.has(index));

  return (
    <section className="card confusion-matrix" aria-labelledby="confusion-matrix-heading">
      <div className="row confusion-matrix-heading">
        <ShieldCheck size={20} aria-hidden="true" />
        <h2 id="confusion-matrix-heading">Confusion Matrix ({model})</h2>
      </div>
      {sampleCount === 0 ? (
        <p>No held-out predictions are available.</p>
      ) : (
        <>
          <p className="confusion-summary">
            <strong>{errorCount} of {sampleCount} held-out predictions were wrong</strong> ({percent.format(errorCount / sampleCount)}).
          </p>
          {errors.length > 0 && (
            <div className="confusion-errors">
              <h3 id="confusion-errors-heading">Where the model got it wrong</h3>
              <div className="confusion-scroll">
                <table aria-labelledby="confusion-errors-heading">
                  <thead>
                    <tr>
                      <th scope="col">Actual crop</th>
                      <th scope="col">Predicted as</th>
                      <th scope="col">Errors / actual samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map(({ actual, predicted, count }) => (
                      <tr key={actual + "-" + predicted}>
                        <td className="confusion-crop">{labels[actual]}</td>
                        <td className="confusion-crop confusion-error-label">{labels[predicted]}</td>
                        <td>{count} of {rowTotals[actual]} ({percent.format(count / rowTotals[actual])})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="confusion-controls">
            <div className="confusion-legend" aria-label="Cell colours">
              <span><i className="confusion-correct" aria-hidden="true" /> Correct</span>
              <span><i className="confusion-error" aria-hidden="true" /> Misclassified</span>
            </div>
            {errors.length > 0 && (
              <button type="button" className="btn ghost" aria-controls="confusion-heatmap"
                onClick={() => setShowFullMatrix(!showFullMatrix)}>
                {isFullMatrix ? "Focus on mistakes" : "Show all " + labels.length + " crops"}
              </button>
            )}
          </div>
          <div className="confusion-scroll confusion-heatmap" id="confusion-heatmap" tabIndex={0}
            role="region" aria-label={isFullMatrix ? "Full confusion matrix" : "Confusion matrix focused on mistakes"}>
            <table>
              <caption>{isFullMatrix ? "All actual crops" : "Actual crops with errors"} · columns show predicted crop</caption>
              <thead>
                <tr>
                  <th scope="col">Actual crop ↓</th>
                  {columns.map((index) => <th scope="col" key={labels[index]} className="confusion-crop">{labels[index]}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((actual) => (
                  <tr key={labels[actual]}>
                    <th scope="row" className="confusion-crop">{labels[actual]}</th>
                    {columns.map((predicted) => {
                      const count = counts[actual][predicted];
                      const color = count === 0 ? "confusion-zero" : actual === predicted ? "confusion-correct" : "confusion-error";
                      return <td key={labels[predicted]} className={color}>{count}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
