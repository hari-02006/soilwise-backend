import { CloudSun, FileUp, Loader2, MapPin, PenLine, RotateCcw, Sparkles, Sprout, TestTube2 } from "lucide-react";
import { useState } from "react";
import ResultView from "../components/ResultView";
import { Alert, PageHead } from "../components/ui";
import { api, type AnalyzePayload } from "../services/api";
import type { Analysis, NpkUnit, UploadResult } from "../types";

type K = "N" | "P" | "K" | "ph" | "temperature" | "humidity" | "rainfall";

interface FieldDef {
  k: K;
  label: string;
  hint: string;
  unit: string;
  min: number;
  max: number;
  step: string;
  category: "soil" | "weather";
}

const FIELDS: FieldDef[] = [
  { k: "N", label: "Nitrogen (N)", hint: "0 to 300", unit: "kg/ha / score", min: 0, max: 300, step: "any", category: "soil" },
  { k: "P", label: "Phosphorus (P)", hint: "0 to 300", unit: "kg/ha / score", min: 0, max: 300, step: "any", category: "soil" },
  { k: "K", label: "Potassium (K)", hint: "0 to 400", unit: "kg/ha / score", min: 0, max: 400, step: "any", category: "soil" },
  { k: "ph", label: "Soil pH", hint: "3 to 10", unit: "pH scale", min: 3, max: 10, step: "0.1", category: "soil" },
  { k: "temperature", label: "Temperature", hint: "0 to 50", unit: "°C", min: 0, max: 50, step: "any", category: "weather" },
  { k: "humidity", label: "Relative Humidity", hint: "0 to 100", unit: "%", min: 0, max: 100, step: "any", category: "weather" },
  { k: "rainfall", label: "Annual Rainfall", hint: "0 to 500", unit: "mm", min: 0, max: 500, step: "any", category: "weather" },
];

const PRESETS = [
  {
    name: "Maharashtra Black Cotton Soil",
    tag: "Vidarbha / Marathwada",
    data: { N: "90", P: "42", K: "43", ph: "6.8", temperature: "25.2", humidity: "80.5", rainfall: "235", location: "Nagpur, Maharashtra", context: "Regur black soil, Kharif season" }
  },
  {
    name: "Konkan Coastal Laterite",
    tag: "Coastal Maharashtra",
    data: { N: "78", P: "52", K: "38", ph: "5.8", temperature: "26.5", humidity: "82.0", rainfall: "220", location: "Ratnagiri, Maharashtra", context: "Acidic red laterite, heavy rain zone" }
  },
  {
    name: "Nashik Alluvial Loam",
    tag: "Western Maharashtra",
    data: { N: "105", P: "55", K: "50", ph: "7.1", temperature: "24.0", humidity: "65.0", rainfall: "115", location: "Nashik, Maharashtra", context: "Fertile alluvial basin, irrigated crops" }
  },
  {
    name: "Semi-Arid Deccan Plateau",
    tag: "Solapur / Ahmednagar",
    data: { N: "38", P: "68", K: "22", ph: "7.7", temperature: "29.5", humidity: "52.0", rainfall: "75", location: "Solapur, Maharashtra", context: "Low-rainfall dryland zone, pulse/millet focus" }
  }
];

const EMPTY = { N: "", P: "", K: "", ph: "", temperature: "", humidity: "", rainfall: "", location: "", context: "" };

export default function Analyze() {
  const [tab, setTab] = useState<"manual" | "report">("manual");
  const [f, setF] = useState(EMPTY);
  const [unit, setUnit] = useState<NpkUnit>("dataset_scale");
  const [est, setEst] = useState<Record<string, boolean>>({});
  const [up, setUp] = useState<UploadResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Analysis | null>(null);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const needConfirm = tab === "report" && up !== null;

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setF(preset.data);
    setErr(null);
  };

  const randomizeDemo = () => {
    setF({
      N: String(Math.floor(20 + Math.random() * 95)),
      P: String(Math.floor(20 + Math.random() * 75)),
      K: String(Math.floor(20 + Math.random() * 65)),
      ph: (5.5 + Math.random() * 2.3).toFixed(1),
      temperature: (20 + Math.random() * 12).toFixed(1),
      humidity: (50 + Math.random() * 38).toFixed(1),
      rainfall: String(Math.floor(60 + Math.random() * 180)),
      location: "Pune District, Maharashtra",
      context: "Rotational farming plot (Demo generated)"
    });
    setErr(null);
  };

  async function onFile(file: File | undefined) {
    setErr(null);
    setUp(null);
    setConfirmed(false);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setErr("File is larger than 5 MB.");
    setBusy(true);
    try {
      const r = await api.upload(file);
      setUp(r);
      setF((p) => {
        const n = { ...p };
        (["N", "P", "K", "ph"] as const).forEach((k) => {
          const v = r.extracted[k];
          if (v?.found && v.value != null) n[k] = String(v.value);
        });
        return n;
      });
      if (r.detected_npk_unit === "kg_per_ha") setUnit("kg_per_ha");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function validate(): string | null {
    for (const x of FIELDS) {
      if (f[x.k] === "") continue;
      const v = Number(f[x.k]);
      if (Number.isNaN(v) || v < x.min || v > x.max) {
        return `${x.label} must be a number between ${x.min} and ${x.max}.`;
      }
    }
    if (FIELDS.every((x) => f[x.k] === "")) return "Enter at least one soil parameter value.";
    if (needConfirm && !confirmed) return "Please confirm that you have checked the extracted values.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validate();
    if (v) return setErr(v);

    const num = (k: K) => (f[k] === "" ? null : Number(f[k]));
    const payload: AnalyzePayload = {
      N: num("N"),
      P: num("P"),
      K: num("K"),
      ph: num("ph"),
      temperature: num("temperature"),
      humidity: num("humidity"),
      rainfall: num("rainfall"),
      npk_unit: unit,
      location: f.location || undefined,
      farming_context: f.context || undefined,
      input_source: needConfirm ? "report" : "manual",
      save: true,
      report_metadata: up ? { method: up.method, user_confirmed: true, found: up.found_parameters } : null,
    };
    (payload as unknown as Record<string, unknown>).value_sources = Object.fromEntries(
      Object.entries(est).filter(([, v2]) => v2).map(([k]) => [k, "estimated"])
    );

    setBusy(true);
    try {
      setRes(await api.analyze(payload));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (res) {
    return (
      <>
        <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
          <PageHead title="Soil Analysis &amp; Crop Intelligence Report" />
          <button className="btn ghost" onClick={() => setRes(null)}>
            <RotateCcw size={16} /> Run Another Analysis
          </button>
        </div>
        <ResultView a={res} />
      </>
    );
  }

  return (
    <>
      <div className="head">
        <span className="head-badge">
          <Sparkles size={13} /> Multi-Model Agronomic AI
        </span>
        <h1>New Soil Analysis</h1>
        <p>
          Input your soil chemistry test results and climatic variables, or upload an official lab testing report.
          SoilWise will run screening heuristics, ML crop recommendation, SHAP explainability, and calculate fertilizer dosages.
        </p>
      </div>

      {/* Feature 1: Soil Presets & Quick Fill Bar */}
      <div className="preset-bar">
        <div className="preset-title">
          <Sprout size={16} /> Regional Presets:
        </div>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="preset-chip"
            onClick={() => loadPreset(p)}
            title={`Fill data for ${p.tag}`}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          className="preset-chip"
          style={{ background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
          onClick={randomizeDemo}
        >
          <Sparkles size={13} style={{ marginRight: 4 }} /> Random Sample
        </button>
        <button
          type="button"
          className="preset-chip"
          style={{ background: "#f1f5f2", color: "#526359" }}
          onClick={() => setF(EMPTY)}
        >
          <RotateCcw size={13} style={{ marginRight: 4 }} /> Clear
        </button>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "manual"}
          onClick={() => setTab("manual")}
        >
          <PenLine size={16} /> Enter Values Manually
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "report"}
          onClick={() => setTab("report")}
        >
          <FileUp size={16} /> Upload Soil Test Report (PDF / Image)
        </button>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        {tab === "report" && (
          <div className="card stack">
            <div className="drop">
              <input
                type="file"
                aria-label="Soil report file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <p className="hint" style={{ marginTop: 8 }}>
                Accepts PDF reports, JPG, JPEG, or PNG scans up to 5 MB. Parsed instantly in-memory via PyMuPDF / Tesseract OCR.
              </p>
            </div>
            {up && (
              <>
                <Alert kind="warn">{up.warning}</Alert>
                <p className="hint">
                  Processed via {up.method.replace("_", " ")}. Detected parameters: {up.found_parameters.join(", ")}.
                  {up.detected_npk_unit === "kg_per_ha" && " N/P/K units detected as kg/ha."}
                  {Object.entries(up.extracted).some(([, v]) => v.found && v.plausible === false) && " (Warning: Some values appear atypical; review carefully)."}
                </p>
                <label className="row" style={{ fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I have verified the extracted values against my physical lab report.
                </label>
              </>
            )}
          </div>
        )}

        {/* Group 1: Soil Nutrients */}
        <div className="card stack">
          <div className="row" style={{ gap: 8 }}>
            <TestTube2 size={19} color="#124d36" />
            <h2>Soil Chemistry &amp; Primary Nutrients (N, P, K, pH)</h2>
          </div>
          <div className="form">
            {FIELDS.filter((x) => x.category === "soil").map((x) => (
              <div key={x.k}>
                <label htmlFor={x.k}>
                  {x.label} <span className="hint">({x.hint})</span>
                </label>
                <input
                  id={x.k}
                  type="number"
                  inputMode="decimal"
                  step={x.step}
                  min={x.min}
                  max={x.max}
                  placeholder={`e.g. ${x.k === 'ph' ? '6.5' : '50'}`}
                  value={f[x.k]}
                  onChange={(e) => set(x.k, e.target.value)}
                />
                {f[x.k] !== "" && (
                  <label className="hint" style={{ marginTop: 4, display: "flex", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      style={{ width: "auto", marginRight: 6 }}
                      checked={!!est[x.k]}
                      onChange={(e) => setEst({ ...est, [x.k]: e.target.checked })}
                    />
                    Mark as estimate
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Group 2: Agro-Climatic Conditions */}
        <div className="card stack">
          <div className="row" style={{ gap: 8 }}>
            <CloudSun size={19} color="#d97706" />
            <h2>Agro-Climatic &amp; Weather Conditions</h2>
          </div>
          <div className="form">
            {FIELDS.filter((x) => x.category === "weather").map((x) => (
              <div key={x.k}>
                <label htmlFor={x.k}>
                  {x.label} <span className="hint">({x.hint} {x.unit})</span>
                </label>
                <input
                  id={x.k}
                  type="number"
                  inputMode="decimal"
                  step={x.step}
                  min={x.min}
                  max={x.max}
                  placeholder={`e.g. ${x.k === 'temperature' ? '25' : x.k === 'humidity' ? '70' : '150'}`}
                  value={f[x.k]}
                  onChange={(e) => set(x.k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Group 3: Context & Unit Calibration */}
        <div className="card stack">
          <div className="row" style={{ gap: 8 }}>
            <MapPin size={19} color="#124d36" />
            <h2>Field Calibration &amp; Geographic Location</h2>
          </div>
          <div className="form">
            <div>
              <label htmlFor="unit">N, P, K Unit Calibration</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as NpkUnit)}>
                <option value="dataset_scale">Dataset Native Scale (Best ML Alignment)</option>
                <option value="kg_per_ha">Standard Soil Lab Scale (kg/ha - ICAR Norms)</option>
              </select>
            </div>
            <div>
              <label htmlFor="loc">Field Location (District / Region)</label>
              <input
                id="loc"
                value={f.location}
                maxLength={120}
                placeholder="e.g. Pune, Maharashtra"
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ctx">Farming Context / Rotation</label>
              <input
                id="ctx"
                value={f.context}
                maxLength={300}
                placeholder="e.g. Rainfed, previous crop Soybean"
                onChange={(e) => set("context", e.target.value)}
              />
            </div>
          </div>
          {unit === "kg_per_ha" && (
            <Alert kind="warn">
              Lab values in kg/ha will receive ICAR-standard soil deficiency screenings, while ML crop classification will calibrate against the model feature distributions.
            </Alert>
          )}
        </div>

        {err && <Alert kind="err">{err}</Alert>}

        <div className="row">
          <button className="btn" type="submit" disabled={busy} style={{ minWidth: 200, padding: "12px 24px" }}>
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Generating Prediction...
              </>
            ) : (
              <>
                <Sprout size={18} /> Analyze Soil &amp; Recommend Crops
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
