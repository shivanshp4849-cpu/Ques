import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import Panel from "@/components/clearpath/Panel";
import Badge from "@/components/clearpath/Badge";
import LiveDot from "@/components/clearpath/LiveDot";
import AgentStepRow from "@/components/clearpath/AgentStepRow";
import { API } from "@/lib/api";
import { callPlanStream } from "@/lib/parsePlanStream";

const CENTER = [12.9716, 77.5946];

// TODO: real Gemini call. Currently keyword-match stub.
function classifyCause(text) {
    const t = (text || "").toLowerCase();
    if (/tree|fallen|branch/.test(t)) return "tree_fall";
    if (/water|flood|logging/.test(t)) return "water_logging";
    if (/accident|crash|collision/.test(t)) return "accident";
    return "others";
}

const STAGES = ["RECEIVED", "AI ANALYZING", "SWARM VERIFYING", "UNITS DISPATCHED"];

function jitter(v, d = 0.01) {
    return v + (Math.random() - 0.5) * d;
}

// Great-circle distance in meters (small range OK)
function distM(a, b) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

export default function Sentinel() {
    const [text, setText] = useState("");
    const [stage, setStage] = useState(-1);
    const [reports, setReports] = useState([]);
    const [understood, setUnderstood] = useState(null);
    const [swarm, setSwarm] = useState(null);
    const [steps, setSteps] = useState({});
    const [autonomous, setAutonomous] = useState(false);
    const inputRef = useRef(null);
    const [imageName, setImageName] = useState("");
    const [revealForm, setRevealForm] = useState(false);

    const submit = async () => {
        if (!text.trim()) return;
        const cause = classifyCause(text);
        const lat = jitter(CENTER[0], 0.04);
        const lng = jitter(CENTER[1], 0.04);
        setUnderstood({ cause, lat, lng });
        setStage(0);
        for (let i = 1; i < STAGES.length; i++) {
            await new Promise((r) => setTimeout(r, 650));
            setStage(i);
        }
        const report = {
            id: `R${Date.now()}`,
            ts: new Date(),
            lat,
            lng,
            cause,
            text,
        };
        setReports((rs) => [report, ...rs].slice(0, 60));
        setText("");
        setImageName("");
        setTimeout(() => setStage(-1), 1500);
    };

    // Swarm scan every 10s
    useEffect(() => {
        const id = setInterval(() => {
            const now = Date.now();
            const recent = reports.filter((r) => now - r.ts.getTime() < 5 * 60 * 1000);
            // find cluster of 3+ within 500m
            for (let i = 0; i < recent.length; i++) {
                const near = recent.filter((r) => distM([recent[i].lat, recent[i].lng], [r.lat, r.lng]) < 500);
                if (near.length >= 3 && !swarm) {
                    const cx = near.reduce((a, r) => a + r.lat, 0) / near.length;
                    const cy = near.reduce((a, r) => a + r.lng, 0) / near.length;
                    triggerSwarm({ lat: cx, lng: cy, cause: near[0].cause, count: near.length });
                    return;
                }
            }
        }, 10000);
        return () => clearInterval(id);
    }, [reports, swarm]);

    const triggerSwarm = useCallback(async ({ lat, lng, cause, count }) => {
        setSwarm({ lat, lng, cause, count, ts: new Date() });
        setSteps({});
        try {
            await callPlanStream(
                API,
                {
                    lat,
                    lng,
                    cause,
                    priority: "high",
                    event_cause: cause,
                    event_type: cause,
                    corridor: "ORR North 1",
                },
                (evt) => {
                    setSteps((s) => ({ ...s, [evt.step]: evt }));
                    if (evt.step === "complete") setTimeout(() => setAutonomous(true), 400);
                },
            );
        } catch (e) {
            setSteps((s) => ({ ...s, error: { message: e.message } }));
        }
    }, []);

    const seedSwarmDemo = () => {
        // Helper for hackathon demo: drop 3 reports in same area
        const lat = jitter(CENTER[0], 0.02);
        const lng = jitter(CENTER[1], 0.02);
        const fresh = Array.from({ length: 3 }).map((_, i) => ({
            id: `R${Date.now()}_${i}`,
            ts: new Date(),
            lat: lat + (Math.random() - 0.5) * 0.001,
            lng: lng + (Math.random() - 0.5) * 0.001,
            cause: "tree_fall",
            text: "Demo report — fallen tree blocking lane",
        }));
        setReports((r) => [...fresh, ...r].slice(0, 60));
    };

    return (
        <div style={{ minHeight: "calc(100vh - 49px)", padding: 16, display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }} data-testid="sentinel-page">
            {/* LEFT — phone */}
            <div>
                <Panel
                    title="CITIZEN REPORTING DEVICE"
                    right={
                        <button className="btn ghost" style={{ fontSize: 9 }} onClick={seedSwarmDemo} data-testid="seed-demo">
                            ▶ SEED SWARM DEMO
                        </button>
                    }
                    testId="phone-panel"
                >
                    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 22 }}>
                        <div
                            style={{
                                width: 280,
                                height: 540,
                                borderRadius: 36,
                                border: "8px solid #1f2937",
                                background: "#020306",
                                position: "relative",
                                overflow: "hidden",
                                boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(148,163,184,0.1)",
                            }}
                            data-testid="phone-frame"
                        >
                            <div style={{ height: 24, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 60, height: 6, borderRadius: 3, background: "#000" }} />
                            </div>
                            <div style={{ padding: 14, height: "calc(100% - 24px)", display: "flex", flexDirection: "column" }}>
                                <div className="display" style={{ fontSize: 11, color: "var(--orange)", marginBottom: 8 }}>
                                    📡 SENTINEL
                                </div>
                                <div style={{ height: 160, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                                    <MapContainer center={CENTER} zoom={12} style={{ width: "100%", height: "100%" }} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} attributionControl={false}>
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
                                    </MapContainer>
                                </div>
                                {!revealForm ? (
                                    <button
                                        onClick={() => setRevealForm(true)}
                                        className="btn red"
                                        style={{ marginTop: 14, padding: "14px 0", justifyContent: "center", animation: "btn-pulse 1.6s ease-in-out infinite" }}
                                        data-testid="report-btn"
                                    >
                                        ● REPORT INCIDENT
                                    </button>
                                ) : (
                                    <div className="fade-in" style={{ marginTop: 12, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                                        <textarea
                                            ref={inputRef}
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            placeholder="What did you see?"
                                            rows={4}
                                            style={{ resize: "none", fontSize: 11 }}
                                            data-testid="report-text"
                                        />
                                        <label className="btn ghost" style={{ fontSize: 9, justifyContent: "center", cursor: "pointer" }}>
                                            📷 {imageName || "ATTACH IMAGE"}
                                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setImageName(e.target.files?.[0]?.name || "")} />
                                        </label>
                                        <button onClick={submit} className="btn red" style={{ fontSize: 11, padding: 10, justifyContent: "center" }} data-testid="submit-report">
                                            ⊕ SUBMIT
                                        </button>
                                    </div>
                                )}
                                {stage >= 0 && (
                                    <div className="fade-in" style={{ marginTop: 10 }}>
                                        {STAGES.map((s, i) => (
                                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", opacity: i <= stage ? 1 : 0.3 }}>
                                                <span
                                                    style={{
                                                        width: 14,
                                                        height: 14,
                                                        borderRadius: 50,
                                                        background: i < stage ? "var(--green)" : i === stage ? "var(--orange)" : "rgba(148,163,184,0.2)",
                                                        boxShadow: i === stage ? "0 0 8px var(--orange)" : "none",
                                                    }}
                                                />
                                                <span className="display" style={{ fontSize: 9, color: i <= stage ? "var(--text)" : "var(--text-mute)" }}>
                                                    {s}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {understood && stage >= 1 && (
                                    <div className="fade-in mono" style={{ fontSize: 10, color: "var(--cyan)", marginTop: 8, padding: 6, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 3 }}>
                                        We understood: <b>{understood.cause}</b> at{" "}
                                        {understood.lat.toFixed(3)},{understood.lng.toFixed(3)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="display" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                                HOW IT WORKS
                            </div>
                            <ol style={{ paddingLeft: 18, color: "var(--text-dim)", fontSize: 13, lineHeight: 1.7 }}>
                                <li>Citizen reports incident via phone (NLP stub → real Gemini next).</li>
                                <li>Report dropped on grid, time-stamped, jittered to ~city scale.</li>
                                <li>
                                    Swarm scans every <span className="mono" style={{ color: "var(--orange)" }}>10s</span>
                                    : ≥3 reports within ~500m in last 5 min ⇒ threshold crossed.
                                </li>
                                <li>
                                    Threshold trigger fires <span className="mono" style={{ color: "var(--cyan)" }}>/api/plan/stream</span>{" "}
                                    at the cluster centroid. No human in loop.
                                </li>
                            </ol>
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 14 }}>
                                REPORTS QUEUED: <b style={{ color: "var(--text)" }}>{reports.length}</b>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

            {/* RIGHT — sentinel grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Panel title="SENTINEL GRID" right={<LiveDot variant="amber" />} testId="grid-panel" style={{ height: 320 }}>
                    <div style={{ height: 260 }}>
                        <MapContainer center={CENTER} zoom={11} style={{ width: "100%", height: "100%", borderRadius: 4 }} preferCanvas>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
                            {reports.map((r) => (
                                <CircleMarker
                                    key={r.id}
                                    center={[r.lat, r.lng]}
                                    radius={6}
                                    pathOptions={{ color: "#fbbf24", fillColor: "#fbbf24", fillOpacity: 0.6, weight: 2 }}
                                />
                            ))}
                            {swarm && (
                                <CircleMarker
                                    center={[swarm.lat, swarm.lng]}
                                    radius={14}
                                    pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.3, weight: 3 }}
                                />
                            )}
                        </MapContainer>
                    </div>
                </Panel>

                {swarm && (
                    <Panel title="SWARM" right={<Badge variant="high">THRESHOLD CROSSED</Badge>} testId="swarm-panel">
                        <div className="mono fade-in" style={{ fontSize: 11, color: "var(--orange)", marginBottom: 8 }}>
                            ⚠ {swarm.count} REPORTS · {swarm.cause} · {swarm.lat.toFixed(4)},{swarm.lng.toFixed(4)}
                        </div>
                        {["triage", "spatial", "logistics", "supervisor", "directive", "complete"].map((s) => (
                            <AgentStepRow
                                key={s}
                                step={s}
                                status={steps[s] ? "done" : "pending"}
                                message={steps[s]?.message || "queued"}
                            />
                        ))}
                        {autonomous && (
                            <div className="slide-up display" style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,0.12)", border: "1px solid var(--red)", borderRadius: 3, color: "var(--red)", textAlign: "center", fontSize: 11, textShadow: "0 0 8px var(--red)" }}>
                                AUTONOMOUS DISPATCH TRIGGERED — NO HUMAN IN LOOP
                            </div>
                        )}
                    </Panel>
                )}

                <Panel title={`REPORTS · ${reports.length}`} testId="reports-list">
                    <div style={{ maxHeight: 260, overflow: "auto" }}>
                        {reports.length === 0 && (
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-mute)", padding: 8 }}>
                                NO REPORTS YET
                            </div>
                        )}
                        {reports.map((r, i) => (
                            <div key={r.id} className="slide-up" style={{ animationDelay: `${i * 0.04}s`, padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                    <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                                        {r.id}
                                    </span>
                                    <Badge variant="orange">{r.cause}</Badge>
                                </div>
                                <div className="mono" style={{ fontSize: 10, color: "var(--text-mute)" }}>
                                    {r.ts.toLocaleTimeString("en-IN", { hour12: false })} · {r.lat.toFixed(3)},{r.lng.toFixed(3)}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text)", marginTop: 2 }}>{r.text}</div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>

            <style>{`@keyframes btn-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }`}</style>
        </div>
    );
}
