import type { Metrics } from "../types";

const featureNames: Record<string, string> = {
  N: "Nitrogen (N)",
  P: "Phosphorus (P)",
  K: "Potassium (K)",
  temperature: "Temperature",
  humidity: "Humidity",
  ph: "pH",
  rainfall: "Rainfall",
};

export default function TrainingDataExploration({ data }: { data: NonNullable<Metrics["training_eda"]> }) {
  const crops = Object.entries(data.class_counts);
  const counts = crops.map(([, count]) => count);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const min = counts.length > 0 ? Math.min(...counts) : 0;
  const max = Math.max(0, ...counts);
  const features = Object.keys(data.correlations);
  const pairs = features.flatMap((row, index) => features.slice(index + 1).map((column) => ({
    row, column, value: data.correlations[row][column],
  }))).filter(({ value }) => Number.isFinite(value)).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const strongest = pairs[0];

  return (
    <section className="card model-insight" aria-labelledby="training-data-heading">
      <h2 id="training-data-heading">Training Data Exploration</h2>
      <p className="insight-intro">Explore crop balance and relationships between model inputs using the training samples.</p>
      <div className="insight-section">
        <h3>Samples by crop</h3>
        {crops.length > 0 ? (
          <>
            <p className="insight-takeaway"><strong>{total.toLocaleString()} training samples across {crops.length} crops.</strong>{" "}
              {min === max ? "Every crop has " + max + " samples." : "Crop counts range from " + min + " to " + max + " samples."}
            </p>
            <ul className="insight-crop-bars">
              {crops.map(([crop, count]) => (
                <li key={crop}>
                  <span>{crop}</span>
                  <span className="insight-bar-track" aria-hidden="true"><i style={{ width: (max > 0 ? count / max * 100 : 0) + "%" }} /></span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="hint">Crop counts are unavailable.</p>}
      </div>

      {features.length > 0 && (
        <div className="insight-section">
          <h3 id="correlation-heading">Pearson Correlations</h3>
          {strongest && (
            <p className="insight-takeaway"><strong>Strongest pair: {featureNames[strongest.row] ?? strongest.row} and {featureNames[strongest.column] ?? strongest.column}</strong>{" "}
              (r = {strongest.value.toFixed(3)}).
            </p>
          )}
          <div className="insight-legend insight-correlation-legend" role="group" aria-label="Correlation scale">
            <span><i className="insight-negative" aria-hidden="true" />−1 Negative</span>
            <span><i aria-hidden="true" />0 No linear relationship</span>
            <span><i className="insight-positive" aria-hidden="true" />+1 Positive</span>
          </div>
          <div className="confusion-scroll insight-correlations" tabIndex={0} role="region" aria-labelledby="correlation-heading">
            <table aria-labelledby="correlation-heading">
              <thead><tr><th scope="col">Input</th>{features.map((f) => <th scope="col" key={f}>{featureNames[f] ?? f}</th>)}</tr></thead>
              <tbody>{features.map((row) => (
                <tr key={row}>
                  <th scope="row">{featureNames[row] ?? row}</th>
                  {features.map((column) => {
                    const value = data.correlations[row][column];
                    const isStrongest = strongest && (row === strongest.row && column === strongest.column || row === strongest.column && column === strongest.row);
                    const color = value < 0 ? "194, 65, 12" : "18, 77, 54";
                    return (
                      <td key={column} className={isStrongest ? "insight-strongest" : undefined}
                        style={Number.isFinite(value) && row !== column ? { backgroundColor: "rgba(" + color + ", " + Math.abs(value) * 0.3 + ")" } : undefined}>
                        {row === column ? <span title="Same input">—</span> : Number.isFinite(value) ? value.toFixed(3) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="hint insight-footer">Pearson correlation describes a linear relationship between inputs.</p>
        </div>
      )}
    </section>
  );
}
