import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LiveDot from "@/components/clearpath/LiveDot";

export default function Landing() {
    const [phase, setPhase] = useState("intro"); // intro -> logo -> landing
    const videoRef = useRef(null);

    useEffect(() => {
        // Auto-progress phases even if video errors out
        const t1 = setTimeout(() => setPhase((p) => (p === "intro" ? "logo" : p)), 5500);
        const t2 = setTimeout(() => setPhase("landing"), 7800);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    const onVideoEnd = () => setPhase("logo");

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                position: "relative",
                overflow: "hidden",
            }}
            data-testid="landing-page"
        >
            {/* Intro video layer */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    background: "#000",
                    opacity: phase === "intro" ? 1 : 0,
                    pointerEvents: phase === "intro" ? "auto" : "none",
                    transition: "opacity 1.1s ease",
                }}
                data-testid="intro-video-layer"
            >
                <video
                    ref={videoRef}
                    src="/assets/intro.mp4"
                    autoPlay
                    muted
                    playsInline
                    onEnded={onVideoEnd}
                    onError={onVideoEnd}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 40,
                        left: 0,
                        right: 0,
                        textAlign: "center",
                    }}
                >
                    <button
                        onClick={() => setPhase("landing")}
                        className="btn ghost"
                        data-testid="skip-intro-btn"
                    >
                        SKIP →
                    </button>
                </div>
            </div>

            {/* Logo layer */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 90,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg)",
                    opacity: phase === "logo" ? 1 : 0,
                    pointerEvents: phase === "logo" ? "auto" : "none",
                    transition: "opacity 1.1s ease",
                }}
                data-testid="logo-layer"
            >
                <div style={{ textAlign: "center" }}>
                    <div
                        className="display"
                        style={{
                            fontSize: 64,
                            fontWeight: 700,
                            color: "var(--orange)",
                            letterSpacing: "0.16em",
                            textShadow: "0 0 36px rgba(249,115,22,0.6)",
                            animation: "logo-pulse 2.4s ease-in-out infinite",
                        }}
                    >
                        CLEARPATH
                    </div>
                    <div
                        className="mono"
                        style={{
                            fontSize: 16,
                            color: "var(--text-dim)",
                            marginTop: 12,
                            letterSpacing: "0.4em",
                        }}
                    >
                        OPERATING SYSTEM
                    </div>
                </div>
                <style>{`@keyframes logo-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}`}</style>
            </div>

            {/* Landing content */}
            <LandingContent visible={phase === "landing"} />
        </div>
    );
}

function LandingContent({ visible }) {
    return (
        <div
            style={{
                opacity: visible ? 1 : 0,
                transition: "opacity 0.8s ease 0.2s",
                minHeight: "100vh",
                position: "relative",
            }}
            className="scan-bg"
        >
            <header
                style={{
                    padding: "20px 32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--border)",
                    backdropFilter: "blur(20px)",
                    background: "rgba(3,7,18,0.5)",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }}
            >
                <div
                    className="display"
                    style={{
                        color: "var(--orange)",
                        letterSpacing: "0.22em",
                        fontWeight: 700,
                        textShadow: "0 0 16px rgba(249,115,22,0.4)",
                    }}
                >
                    CLEARPATH OS
                </div>
                <div
                    className="mono"
                    style={{ color: "var(--text-dim)", fontSize: 11, display: "flex", gap: 14 }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <LiveDot variant="green" /> BENGALURU · LIVE
                    </span>
                </div>
            </header>

            <section
                style={{
                    padding: "100px 32px 60px",
                    maxWidth: 1280,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 60,
                    alignItems: "center",
                }}
            >
                <div>
                    <div
                        className="mono"
                        style={{
                            color: "var(--cyan)",
                            fontSize: 12,
                            letterSpacing: "0.3em",
                            marginBottom: 24,
                        }}
                    >
                        ▸ BENGALURU TRAFFIC POLICE · COMMAND PLATFORM
                    </div>
                    <h1
                        className="display"
                        style={{
                            fontSize: 72,
                            lineHeight: 1.02,
                            margin: 0,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                        }}
                    >
                        INCIDENT.
                        <br />
                        <span style={{ color: "var(--orange)", textShadow: "0 0 32px rgba(249,115,22,0.5)" }}>
                            ROUTE.
                        </span>
                        <br />
                        RESPOND.
                    </h1>
                    <p
                        style={{
                            color: "var(--text-dim)",
                            fontSize: 16,
                            maxWidth: 560,
                            marginTop: 28,
                            lineHeight: 1.6,
                        }}
                    >
                        A predictive command-center for road closures, dispatch, and
                        citizen-sourced verification. Multi-agent triage, spatial diversion,
                        and logistics optimization — streamed in real time.
                    </p>
                    <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
                        <Link to="/god-mode" className="btn" data-testid="cta-godmode">
                            ⊕ ENTER GOD MODE
                        </Link>
                        <Link to="/intelligence" className="btn ghost" data-testid="cta-intel">
                            📊 VIEW INTELLIGENCE
                        </Link>
                    </div>

                    <div style={{ display: "flex", gap: 36, marginTop: 60 }}>
                        {[
                            { k: "150", l: "INCIDENTS TRACKED" },
                            { k: "54", l: "STATIONS LIVE" },
                            { k: "5", l: "AGENT PIPELINE" },
                            { k: "<3s", l: "DISPATCH P50" },
                        ].map((s) => (
                            <div key={s.l}>
                                <div
                                    className="mono"
                                    style={{ fontSize: 28, color: "var(--orange)" }}
                                >
                                    {s.k}
                                </div>
                                <div
                                    className="display"
                                    style={{
                                        fontSize: 10,
                                        color: "var(--text-mute)",
                                        letterSpacing: "0.16em",
                                        marginTop: 4,
                                    }}
                                >
                                    {s.l}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                    {[
                        {
                            t: "GOD MODE",
                            d: "Full-map dispatch with live incidents, station availability, and streaming agent activity.",
                            to: "/god-mode",
                            c: "var(--orange)",
                        },
                        {
                            t: "SENTINEL GRID",
                            d: "Citizen reports → swarm verification → autonomous dispatch when threshold is crossed.",
                            to: "/sentinel",
                            c: "var(--cyan)",
                        },
                        {
                            t: "INTELLIGENCE",
                            d: "Model metrics, confusion matrix, corridor risk, hourly heatmap.",
                            to: "/intelligence",
                            c: "var(--green)",
                        },
                        {
                            t: "DEBRIEF",
                            d: "Every mistake the model made. Drift gauge, anomalies, retraining flags.",
                            to: "/debrief",
                            c: "var(--amber)",
                        },
                    ].map((card, i) => (
                        <Link
                            key={card.t}
                            to={card.to}
                            className="panel slide-up"
                            style={{
                                padding: 18,
                                textDecoration: "none",
                                color: "inherit",
                                animationDelay: `${0.1 + i * 0.08}s`,
                                borderLeft: `2px solid ${card.c}`,
                            }}
                            data-testid={`landing-card-${card.to.slice(1)}`}
                        >
                            <div
                                className="display"
                                style={{ fontSize: 13, color: card.c, letterSpacing: "0.18em" }}
                            >
                                {card.t} →
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "var(--text-dim)",
                                    marginTop: 8,
                                    lineHeight: 1.5,
                                }}
                            >
                                {card.d}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <footer
                style={{
                    padding: "24px 32px",
                    borderTop: "1px solid var(--border)",
                    color: "var(--text-mute)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <span>v0.1 · HACKATHON BUILD</span>
                <span>PRESS ⌘K FROM ANY PAGE</span>
            </footer>
        </div>
    );
}
