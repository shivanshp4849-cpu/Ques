import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Panel from "@/components/clearpath/Panel";
import Badge, { severityVariant } from "@/components/clearpath/Badge";
import LiveDot from "@/components/clearpath/LiveDot";
import AnimatedNumber from "@/components/clearpath/AnimatedNumber";
import AnimatedBar from "@/components/clearpath/AnimatedBar";
import AgentStepRow from "@/components/clearpath/AgentStepRow";
import Skeleton from "@/components/clearpath/Skeleton";
import {
    useSimulateState,
    SimulateAssetPalette,
    SimulateBudgetBar,
    SimulateCityHealth,
    SimulatePlacedAssets,
    SimulateRadarSweep,
    tealIncidentIds,
} from "@/components/clearpath/SimulateTab";
import { API, ASSET_BASE, getJSON, wsURL } from "@/lib/api";
import { callPlanStream } from "@/lib/parsePlanStream";

const CENTER = [12.9716, 77.5946];
const CAUSES = ["accident", "tree_fall", "water_logging", "vehicle_breakdown", "others"];

const sevColor = (s) => {
    const v = severityVariant(s);
    if (v === "high") return "#ef4444";
    if (v === "medium") return "#f59e0b";
    if (v === "low") return "#10b981";
    return "#06b6d4";
};

function MapClickCatcher({ onClick }) {
    useMapEvents({ click: (e) => onClick(e.latlng) });
    return null;
}

const stationIcon = (avail) =>
    L.divIcon({
        className: "station-marker",
        html: `<div style="
        width:14px;height:14px;transform:rotate(45deg);
        background:${avail < 6 ? "#f59e0b" : "#3b82f6"};
        border:1.5px solid ${avail < 6 ? "#fbbf24" : "#60a5fa"};
        box-shadow:0 0 ${avail < 6 ? "12px #f59e0b" : "8px #3b82f6"};
      "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });

const STEPS = ["triage", "spatial", "logistics", "supervisor", "directive", "complete"];

export default function GodMode() {
    const [tab, setTab] = useState("LIVE");
    const [incidents, setIncidents] = useState([]);
    const [stations, setStations] = useState([]);
    const [stationAvail, setStationAvail] = useState({}); // live map id->avail
    const [wsState, setWsState] = useState("connecting");
    const [popup, setPopup] = useState(null); // {lat,lng,cause,severity}
    const [planning, setPlanning] = useState(false);
    const [steps, setSteps] = useState({});
    const [planState, setPlanState] = useState({});
    const [flashStations, setFlashStations] = useState({});
    const [feed, setFeed] = useState([]);
    const [stress, setStress] = useState({ count: 3, bias: "MIXED", spread: "CITY" });
    const [stressLog, setStressLog] = useState([]);
    const wsRef = useRef(null);
    const backoffRef = useRef(0);

    // Initial fetches
    useEffect(() => {
        getJSON("/incidents").then((d) => {
            setIncidents(d);
            setFeed(d.slice(-10).reverse());
        }).catch(() => {});
        getJSON("/stations").then(setStations).catch(() => {});
    }, []);

    // WS heartbeat with reconnect
    useEffect(() => {
        let alive = true;
        const connect = () => {
            try {
                const ws = new WebSocket(wsURL("/ws/live"));
                wsRef.current = ws;
                ws.onopen = () => {
                    setWsState("live");
                    backoffRef.current = 0;
                };
                ws.onmessage = (m) => {
                    try {
                        const d = JSON.parse(m.data);
                        if (d.type === "heartbeat" && d.station_availability) {
                            setStationAvail(d.station_availability);
                        }
                    } catch (e) {
                        // tolerate
                    }
                };
                ws.onclose = () => {
                    if (!alive) return;
                    setWsState("reconnecting");
                    const delays = [3000, 6000, 9000];
                    const d = delays[Math.min(backoffRef.current, delays.length - 1)];
                    backoffRef.current += 1;
                    setTimeout(connect, d);
                };
                ws.onerror = () => ws.close();
            } catch (e) {
                setTimeout(connect, 3000);
            }
        };
        connect();
        return () => {
            alive = false;
            wsRef.current?.close();
        };
    }, []);

    const onMapClick = (latlng) => {
        if (planning) return;
        setPopup({ lat: latlng.lat, lng: latlng.lng, cause: "accident", severity: "HIGH" });
    };

    const dispatch = useCallback(
        async (overrides) => {
            const body = {
                lat: overrides.lat,
                lng: overrides.lng,
                cause: overrides.cause,
                priority: overrides.severity === "HIGH" ? "high" : "normal",
                event_cause: overrides.cause,
                event_type: overrides.cause,
                corridor: overrides.corridor || "ORR North 1",
            };
            setPlanning(true);
            setSteps({});
            setPlanState({});
            try {
                await callPlanStream(API, body, (evt) => {
                    setSteps((prev) => ({ ...prev, [evt.step]: evt }));
                    if (evt.state) setPlanState((s) => ({ ...s, ...evt.state, [evt.step]: evt.state }));
                    if (evt.step === "logistics" && evt.state?.assignments) {
                        const flash = {};
                        (evt.state.assignments || []).forEach((a) => {
                            flash[a.station_id || a.id] = true;
                        });
                        setFlashStations(flash);
                        setTimeout(() => setFlashStations({}), 2000);
                    }
                });
            } catch (e) {
                setSteps((p) => ({ ...p, error: { message: e.message } }));
            } finally {
                setPlanning(false);
            }
        },
        [],
    );

    const runStress = async () => {
        const { count } = stress;
        setStressLog([]);
        for (let i = 0; i < count; i++) {
            const lat = CENTER[0] + (Math.random() - 0.5) * 0.05;
            const lng = CENTER[1] + (Math.random() - 0.5) * 0.05;
            const cause = CAUSES[Math.floor(Math.random() * CAUSES.length)];
            const sev = stress.bias === "HIGH" ? "HIGH" : stress.bias === "LOW" ? "LOW" : "MEDIUM";
            setStressLog((l) => [`#${i + 1} ${cause} · ${sev} · ${lat.toFixed(3)},${lng.toFixed(3)}`, ...l].slice(0, 12));
            dispatch({ lat, lng, cause, severity: sev });
            await new Promise((r) => setTimeout(r, 300));
        }
    };

    const baseline = planState.spatial?.baseline_path;
    const diversion = planState.spatial?.diversion_path;
    const buffer = planState.spatial?.current_buffer_radius_m;
    const bufferCenter = baseline?.[0] || (popup ? [popup.lat, popup.lng] : null);
    const directive = planState.directive;
    const triage = planState.triage;
    const logistics = planState.logistics;

    const stationsMerged = useMemo(() => {
        return stations.map((s) => {
            const live = stationAvail[s.station_id];
            return { ...s, available: live != null ? live : s.available };
        });
    }, [stations, stationAvail]);

    // ===== Urban Architect simulate state =====
    const sim = useSimulateState();
    // Reset simulate state when leaving SIMULATE tab
    useEffect(() => {
        if (tab !== "SIMULATE") sim.reset();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
    const isSim = tab === "SIMULATE";
    const tealSet = useMemo(
        () => (isSim && sim.simulationResult ? tealIncidentIds(sim.placedAssets, incidents) : new Set()),
        [isSim, sim.simulationResult, sim.placedAssets, incidents],
    );

    // Override map click in SIMULATE mode → place asset
    const handleMapClick = (latlng) => {
        if (isSim) {
            sim.placeAsset(latlng.lat, latlng.lng);
            return;
        }
        onMapClick(latlng);
    };

    return (
        <div style={{ height: "calc(100vh - 49px)", position: "relative", background: "var(--bg)" }} data-testid="god-mode-page">
            {/* MAP */}
            <MapContainer center={CENTER} zoom={12} style={{ width: "100%", height: "100%" }} preferCanvas>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com">CARTO</a>'
                />
                <MapClickCatcher onClick={handleMapClick} />

                {incidents.map((i) => {
                    const sev = severityVariant(i.severity);
                    const teal = tealSet.has(i.id);
                    const dim = isSim;
                    return (
                        <CircleMarker
                            key={i.id}
                            center={[i.lat, i.lng]}
                            radius={teal ? 5 : 4 + (Number(i.closure_prob) || 0) * 8}
                            pathOptions={{
                                color: teal ? "#14b8a6" : sevColor(i.severity),
                                fillColor: teal ? "#14b8a6" : sevColor(i.severity),
                                fillOpacity: teal ? 0.75 : dim ? 0.12 : sev === "high" ? 0.65 : 0.35,
                                weight: teal ? 2 : dim ? 0.6 : sev === "high" ? 2 : 1,
                                opacity: dim && !teal ? 0.4 : 1,
                            }}
                            className={!isSim && sev === "high" ? "pulse-high" : ""}
                        />
                    );
                })}

                {stationsMerged.map((s) => (
                    <Marker
                        key={s.station_id}
                        position={[s.lat, s.lng]}
                        icon={stationIcon(s.available ?? 12)}
                    >
                        <Popup>
                            <div className="mono" style={{ fontSize: 11 }}>
                                <div className="display" style={{ fontSize: 12, color: "var(--cyan)" }}>
                                    STATION {s.station_id}
                                </div>
                                <div style={{ marginTop: 4 }}>
                                    Available: {s.available ?? 12}/{s.capacity ?? 12}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {baseline && Array.isArray(baseline) && baseline.length > 1 && (
                    <Polyline positions={baseline} pathOptions={{ color: "#ef4444", weight: 3, dashArray: "8 6", opacity: 0.85 }} />
                )}
                {diversion && Array.isArray(diversion) && diversion.length > 1 && (
                    <Polyline positions={diversion} pathOptions={{ color: "#10b981", weight: 4, opacity: 0.95 }} />
                )}
                {buffer && bufferCenter && (
                    <Circle
                        center={bufferCenter}
                        radius={buffer}
                        pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.06, weight: 1.5, dashArray: "4 4" }}
                        className="pulse-buffer"
                    />
                )}

                {popup && !isSim && (
                    <Popup position={[popup.lat, popup.lng]} eventHandlers={{ remove: () => setPopup(null) }}>
                        <div data-testid="dispatch-popup">
                            <div className="display" style={{ fontSize: 12, color: "var(--orange)", marginBottom: 8 }}>
                                NEW INCIDENT
                            </div>
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                                {popup.lat.toFixed(4)}, {popup.lng.toFixed(4)}
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                                {CAUSES.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setPopup({ ...popup, cause: c })}
                                        className={`btn ${popup.cause === c ? "" : "ghost"}`}
                                        style={{ fontSize: 9, padding: "4px 8px" }}
                                        data-testid={`cause-${c}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {["LOW", "MEDIUM", "HIGH"].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setPopup({ ...popup, severity: s })}
                                        className={`btn ${popup.severity === s ? "" : "ghost"}`}
                                        style={{ fontSize: 9, padding: "4px 8px" }}
                                        data-testid={`sev-${s}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    dispatch(popup);
                                    setPopup(null);
                                }}
                                className="btn red"
                                style={{ width: "100%", justifyContent: "center" }}
                                data-testid="dispatch-btn"
                            >
                                ⊕ DISPATCH
                            </button>
                        </div>
                    </Popup>
                )}

                {/* Urban Architect: placed assets + coverage circles */}
                {isSim && <SimulatePlacedAssets sim={sim} />}
            </MapContainer>

            {/* Radar sweep overlay over the map */}
            <SimulateRadarSweep radarKey={sim.radarKey} active={isSim && sim.isSimulating} />

            {/* HEADER OVERLAY */}
            <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 500, display: "flex", gap: 10 }}>
                <div className="panel" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <LiveDot variant="red" />
                        <span className="display" style={{ color: "var(--red)", fontSize: 11 }}>● REC</span>
                    </span>
                    <span className="display" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        ACTIVE: <AnimatedNumber value={incidents.length} className="" />
                    </span>
                    <span className="display" style={{ fontSize: 11, color: "var(--cyan)" }}>
                        WS: {wsState.toUpperCase()}
                    </span>
                </div>
                <div className="panel" style={{ padding: 4, display: "flex" }}>
                    {["LIVE", "SIMULATE", "STRESS"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`btn ${tab === t ? "" : "ghost"}`}
                            style={{ fontSize: 10, padding: "6px 12px", borderRadius: 2 }}
                            data-testid={`tab-${t}`}
                        >
                            {t === "STRESS" ? "STRESS TEST" : t === "LIVE" ? "LIVE MAP" : t}
                        </button>
                    ))}
                </div>
                {isSim && <SimulateBudgetBar sim={sim} />}
            </div>

            {/* LEFT: AGENT ACTIVITY (or ASSET PALETTE in Simulate) */}
            <div
                style={{
                    position: "absolute",
                    top: isSim ? 90 : 70,
                    left: 14,
                    width: 360,
                    zIndex: 500,
                    maxHeight: "calc(100vh - 110px)",
                    overflowY: "auto",
                }}
            >
                {isSim ? (
                    <SimulateAssetPalette sim={sim} incidents={incidents} />
                ) : (
                    <>
                <Panel title="AGENT ACTIVITY" right={planning ? <LiveDot /> : null} testId="agent-panel">
                    {STEPS.map((s) => {
                        const evt = steps[s];
                        return (
                            <AgentStepRow
                                key={s}
                                step={s}
                                status={evt ? (s === "complete" ? "done" : "done") : planning ? "pending" : "idle"}
                                message={evt?.message || (planning && !evt ? "queued" : "")}
                            />
                        );
                    })}
                    {!planning && !Object.keys(steps).length && (
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-mute)", textAlign: "center", padding: 18 }}>
                            CLICK MAP TO DISPATCH
                        </div>
                    )}
                </Panel>

                {tab === "STRESS" && (
                    <Panel title="STRESS TEST" className="mt-3" testId="stress-panel">
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                            COUNT: {stress.count}
                        </div>
                        <input
                            type="range"
                            min={1}
                            max={8}
                            value={stress.count}
                            onChange={(e) => setStress({ ...stress, count: Number(e.target.value) })}
                            style={{ width: "100%" }}
                            data-testid="stress-count"
                        />
                        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                            {["LOW", "MIXED", "HIGH"].map((b) => (
                                <button key={b} onClick={() => setStress({ ...stress, bias: b })} className={`btn ${stress.bias === b ? "" : "ghost"}`} style={{ fontSize: 9, padding: "4px 8px" }}>
                                    {b}
                                </button>
                            ))}
                        </div>
                        <button onClick={runStress} disabled={planning} className="btn red" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} data-testid="stress-run">
                            ▶ RUN STRESS LOOP
                        </button>
                        <div style={{ maxHeight: 120, overflow: "auto", marginTop: 10 }}>
                            {stressLog.map((l, i) => (
                                <div key={i} className="mono fade-in" style={{ fontSize: 10, color: "var(--text-mute)", padding: "2px 0" }}>
                                    {l}
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}
                    </>
                )}
            </div>

            {/* RIGHT: STATIONS + FEED (or CITY HEALTH in Simulate) */}
            <div
                style={{
                    position: "absolute",
                    top: isSim ? 90 : 70,
                    right: 14,
                    width: 340,
                    zIndex: 500,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    maxHeight: "calc(100vh - 110px)",
                    overflowY: "auto",
                }}
            >
                {isSim ? (
                    <SimulateCityHealth sim={sim} />
                ) : (
                <>
                <Panel title={`STATION STATUS · ${stationsMerged.length}`} testId="stations-panel">
                    <div style={{ maxHeight: 280, overflow: "auto", paddingRight: 4 }}>
                        {stationsMerged.length === 0 &&
                            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={18} style={{ marginBottom: 6 }} />)}
                        {stationsMerged.map((s, i) => {
                            const avail = s.available ?? 12;
                            const flash = flashStations[s.station_id];
                            return (
                                <div key={s.station_id} className="fade-in" style={{ animationDelay: `${i * 0.01}s`, padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                        <span className="mono" style={{ fontSize: 10, color: flash ? "var(--orange)" : "var(--text-dim)", textShadow: flash ? "0 0 8px var(--orange)" : "none" }}>
                                            {s.station_id}
                                        </span>
                                        <span className="mono" style={{ fontSize: 10, color: avail < 6 ? "var(--amber)" : "var(--text)" }}>
                                            {avail}/{s.capacity ?? 12}
                                        </span>
                                    </div>
                                    <AnimatedBar value={avail} max={s.capacity ?? 12} color={avail < 6 ? "amber" : "cyan"} height={3} delay={i * 8} />
                                </div>
                            );
                        })}
                    </div>
                </Panel>

                <Panel title="LIVE FEED" right={<LiveDot variant="green" />} testId="feed-panel">
                    <div style={{ maxHeight: 240, overflow: "auto" }}>
                        {feed.length === 0 && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={16} style={{ marginBottom: 6 }} />)}
                        {feed.map((f, i) => (
                            <div key={f.id} className="slide-up" style={{ animationDelay: `${i * 0.05}s`, padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                                        {f.id}
                                    </span>
                                    <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                                </div>
                                <div className="mono" style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                                    {f.event_cause} · {f.corridor}
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
                </>
                )}
            </div>

            {/* DIRECTIVE FLOATER */}
            {directive && !isSim && (
                <div className="slide-up" style={{ position: "absolute", left: 370, top: 70, width: 380, zIndex: 500 }}>
                    <Panel title="CRISIS COMMS DIRECTIVE" right={<Badge variant="orange">LIVE</Badge>} testId="directive-panel">
                        {directive.tweet && (
                            <DirectiveBlock label="TWEET" text={directive.tweet} />
                        )}
                        {directive.sms && (
                            <DirectiveBlock label="SMS" text={directive.sms} />
                        )}
                        {directive.dispatch_audio_url && (
                            <div style={{ marginTop: 8 }}>
                                <div className="display" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>AUDIO</div>
                                <audio controls src={`${ASSET_BASE}${directive.dispatch_audio_url}`} style={{ width: "100%" }} data-testid="dispatch-audio" />
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {/* PLAN OUTPUT */}
            {steps.complete && !isSim && (
                <div className="slide-up" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 20, width: 540, zIndex: 500 }}>
                    <Panel title="PLAN OUTPUT" right={<Badge variant={severityVariant(triage?.severity_tier)}>{triage?.severity_tier || "—"}</Badge>} testId="plan-output">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                            <div>
                                <div className="display" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>CLOSURE PROBABILITY</div>
                                <AnimatedBar value={(triage?.closure_prob || 0) * 100} max={100} color="red" valueLabel={`${Math.round((triage?.closure_prob || 0) * 100)}%`} />
                            </div>
                            <div>
                                <div className="display" style={{ fontSize: 10, color: "var(--text-dim)" }}>OFFICERS</div>
                                <div className="mono" style={{ fontSize: 24, color: "var(--orange)" }}>
                                    <AnimatedNumber value={logistics?.total_officers || 0} />
                                </div>
                            </div>
                            <div>
                                <div className="display" style={{ fontSize: 10, color: "var(--text-dim)" }}>BARRICADES</div>
                                <div className="mono" style={{ fontSize: 24, color: "var(--cyan)" }}>
                                    <AnimatedNumber value={logistics?.total_barricades || 0} />
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>
            )}

            <style>{`
        .pulse-high { animation: pulseHigh 1.8s ease-in-out infinite; }
        @keyframes pulseHigh { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.4; } }
        .pulse-buffer { animation: pulseBuf 2.4s ease-in-out infinite; }
        @keyframes pulseBuf { 0%,100% { fill-opacity: 0.05; } 50% { fill-opacity: 0.12; } }
      `}</style>
        </div>
    );
}

function DirectiveBlock({ label, text }) {
    const [copied, setCopied] = useState(false);
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span className="display" style={{ fontSize: 10, color: "var(--text-dim)" }}>{label}</span>
                <button
                    className="btn ghost"
                    style={{ fontSize: 9, padding: "2px 8px" }}
                    onClick={() => {
                        navigator.clipboard?.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                    }}
                    data-testid={`copy-${label.toLowerCase()}`}
                >
                    {copied ? "✓ COPIED" : "COPY"}
                </button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text)", padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 3, border: "1px solid var(--border)" }}>
                {text}
            </div>
        </div>
    );
}
