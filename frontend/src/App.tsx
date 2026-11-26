import { BarChart3, Clock, FlaskConical, LayoutDashboard, Leaf } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsync } from "./hooks/useAsync";
import Analyze from "./pages/Analyze";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Models from "./pages/Models";
import { api } from "./services/api";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analyze", label: "New Soil Analysis", icon: FlaskConical },
  { id: "history", label: "Analysis History", icon: Clock },
  { id: "models", label: "Model Intelligence", icon: BarChart3 },
];

function parse() {
  const [p, id] = location.hash.replace("#/", "").split("/");
  return { page: NAV.some((n) => n.id === p) ? p : "dashboard", id };
}

export default function App() {
  const [route, setRoute] = useState(parse());
  const health = useAsync(api.health);

  useEffect(() => {
    const h = () => setRoute(parse());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const go = (p: string, id?: string) => {
    location.hash = `#/${p}${id ? "/" + id : ""}`;
  };

  const h = health.data;

  return (
    <div className="shell">
      <nav className="side" aria-label="Main Navigation">
        <div className="brand">
          <div className="brand-icon">
            <Leaf size={22} />
          </div>
          <div className="brand-text">
            SoilWise
            <small>AI Soil Health &amp; Crop Intelligence</small>
          </div>
        </div>

        {NAV.map(({ id, label, icon: I }) => (
          <button
            key={id}
            className="nav"
            aria-current={route.page === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <I size={19} />
            <span>{label}</span>
          </button>
        ))}

        <div className="status">
          <span>
            <i className={`dot ${h?.model.loaded ? "ok" : ""}`} />
            <strong>AI Engine:</strong> {h?.model.loaded ? h.model.name : "Unavailable"}
          </span>
          <span>
            <i className={`dot ${h?.database ? "ok" : ""}`} />
            <strong>Database:</strong> {h?.database ? "MongoDB Connected" : "Local / Offline"}
          </span>
          {!h && !health.loading && (
            <span style={{ color: "#fca5a5" }}>Backend API offline</span>
          )}
        </div>
      </nav>

      <main>
        {route.page === "dashboard" && <Dashboard go={go} />}
        {route.page === "analyze" && <Analyze />}
        {route.page === "history" && <History key={route.id ?? "list"} openId={route.id} />}
        {route.page === "models" && <Models />}
      </main>
    </div>
  );
}
