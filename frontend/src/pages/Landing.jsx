import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LiveDot from "@/components/clearpath/LiveDot";
import SplineLogo from "@/components/clearpath/SplineLogo";
import MeshBackground from "@/components/clearpath/MeshBackground";

export default function Landing() {
    const [phase, setPhase] = useState("intro"); // intro -> logo -> landing
    const videoRef = useRef(null);

    useEffect(() => {
        const t1 = setTimeout(() => setPhase((p) => (p === "intro" ? "logo" : p)), 5500);
        const t2 = setTimeout(() => setPhase((p) => (p === "logo" || p === "intro" ? "landing" : p)), 7800);
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
                    overflow: "hidden",
                }}
                data-testid="intro-video-layer"
            >
                {/* Blurred backdrop copy fills the frame so we never see black bars */}
                <video
                    src="/assets/intro.mp4"
                    autoPlay
                    muted
                    playsInline
                    loop
                    preload="auto"
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "blur(36px) saturate(140%) brightness(0.6)",
                        transform: "scale(1.15)",
                        zIndex: 0,
                    }}
                />
                {/* Crisp foreground at native aspect ratio + sharpening filters */}
                <video
                    ref={videoRef}
                    src="/assets/intro.mp4"
                    autoPlay
                    muted
                    playsInline
                    preload="auto"
                    onEnded={onVideoEnd}
                    onError={onVideoEnd}
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        filter:
                            "contrast(1.18) saturate(1.22) brightness(1.05) drop-shadow(0 0 60px rgba(249,115,22,0.25))",
                        imageRendering: "high-quality",
                        WebkitTransform: "translateZ(0)",
                        transform: "translateZ(0)",
                    }}
                />
                {/* subtle vignette */}
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        pointerEvents: "none",
                        background:
                            "radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 40,
                        left: 0,
                        right: 0,
                        textAlign: "center",
                        zIndex: 3,
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
                    visibility: phase === "logo" ? "visible" : "hidden",
                    pointerEvents: phase === "logo" ? "auto" : "none",
                    transition: "opacity 1.1s ease, visibility 0s linear 1.1s",
                }}
                data-testid="logo-layer"
            >
                <div style={{ textAlign: "center" }}>
                    <div
                        className="display flow-gradient"
                        style={{
                            fontSize: 84,
                            fontWeight: 700,
                            letterSpacing: "0.16em",
                            animation: "logo-pulse 2.4s ease-in-out infinite, flowShift 6s linear infinite",
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

/* ===== Kinetic word that reveals char-by-char ===== */
function Kinetic({ text, delay = 0, color, gradient }) {
    return (
        <span style={{ display: "inline-block" }}>
            {text.split("").map((ch, i) => (
                <span
                    key={i}
                    className={`kinetic-char ${gradient ? "gradient" : ""}`}
                    style={{ animationDelay: `${delay + i * 0.04}s`, color: gradient ? undefined : color }}
                >
                    {ch === " " ? "\u00A0" : ch}
                </span>
            ))}
        </span>
    );
}

function useInView(ref, rootMargin = "-80px") {
    const [seen, setSeen] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setSeen(true);
                    obs.disconnect();
                }
            },
            { rootMargin },
        );
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, [ref, rootMargin]);
    return seen;
}

function Reveal({ children, delay = 0 }) {
    const ref = useRef(null);
    const seen = useInView(ref);
    return (
        <div ref={ref} className={`reveal ${seen ? "in" : ""}`} style={{ transitionDelay: `${delay}s` }}>
            {children}
        </div>
    );
}

function Magnet({ children, strength = 16, style, ...rest }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onMove = (e) => {
            const r = el.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
        };
        const onLeave = () => (el.style.transform = "translate(0,0)");
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        return () => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseleave", onLeave);
        };
    }, [strength]);
    return (
        <span ref={ref} className="magnet" style={style} {...rest}>
            {children}
        </span>
    );
}

function LandingContent({ visible }) {
    const heroRef = useRef(null);
    // hero parallax tilt
    useEffect(() => {
        const el = heroRef.current;
        if (!el) return;
        const onMove = (e) => {
            const r = el.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            el.style.setProperty("--mx", `${dx * 30}px`);
            el.style.setProperty("--my", `${dy * 30}px`);
        };
        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, []);

    return (
        <div
            style={{
                opacity: visible ? 1 : 0,
                transition: "opacity 0.8s ease 0.2s",
                minHeight: "100vh",
                position: "relative",
            }}
        >
            <MeshBackground height="120vh" />

            {/* NAV */}
            <header
                style={{
                    padding: "18px 32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backdropFilter: "blur(24px)",
                    background: "rgba(3,7,18,0.55)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background:
                                "conic-gradient(from 220deg, #f97316, #fbbf24, #06b6d4, #f97316)",
                            boxShadow: "0 0 16px rgba(249,115,22,0.6)",
                            position: "relative",
                        }}
                    >
                        <span
                            style={{
                                position: "absolute",
                                inset: 4,
                                background: "var(--bg)",
                                borderRadius: 4,
                            }}
                        />
                    </span>
                    <span
                        className="display"
                        style={{
                            color: "var(--text)",
                            letterSpacing: "0.22em",
                            fontWeight: 700,
                            fontSize: 14,
                        }}
                    >
                        CLEAR<span style={{ color: "var(--orange)" }}>PATH</span> OS
                    </span>
                </div>
                <nav style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    {[
                        ["GOD MODE", "/god-mode"],
                        ["SENTINEL", "/sentinel"],
                        ["INTELLIGENCE", "/intelligence"],
                        ["DEBRIEF", "/debrief"],
                    ].map(([t, to]) => (
                        <Link
                            key={to}
                            to={to}
                            className="display"
                            style={{
                                fontSize: 11,
                                color: "var(--text-dim)",
                                letterSpacing: "0.16em",
                                textDecoration: "none",
                            }}
                            data-testid={`nav-cta-${to.slice(1)}`}
                        >
                            {t}
                        </Link>
                    ))}
                    <span
                        className="mono"
                        style={{ color: "var(--text-mute)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, paddingLeft: 14, borderLeft: "1px solid var(--border)" }}
                    >
                        <LiveDot variant="green" /> BENGALURU
                    </span>
                </nav>
            </header>

            {/* HERO */}
            <section
                ref={heroRef}
                style={{
                    position: "relative",
                    minHeight: "92vh",
                    padding: "72px 32px 40px",
                    maxWidth: 1380,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "1.25fr 1fr",
                    gap: 60,
                    alignItems: "center",
                    zIndex: 2,
                }}
            >
                <div>
                    <Reveal>
                        <div
                            className="mono"
                            style={{
                                color: "var(--cyan)",
                                fontSize: 12,
                                letterSpacing: "0.3em",
                                marginBottom: 24,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <LiveDot variant="green" />
                            BENGALURU TRAFFIC POLICE · COMMAND PLATFORM
                        </div>
                    </Reveal>

                    <h1
                        className="display"
                        style={{
                            fontSize: "clamp(56px, 8vw, 112px)",
                            lineHeight: 0.95,
                            margin: 0,
                            fontWeight: 700,
                            letterSpacing: "-0.005em",
                        }}
                    >
                        <Kinetic text="INCIDENT." delay={0.05} />
                        <br />
                        <Kinetic text="ROUTE." delay={0.4} gradient />
                        <br />
                        <Kinetic text="RESPOND." delay={0.7} />
                    </h1>

                    <Reveal delay={0.3}>
                        <p
                            style={{
                                color: "var(--text-dim)",
                                fontSize: 17,
                                maxWidth: 580,
                                marginTop: 32,
                                lineHeight: 1.6,
                            }}
                        >
                            A predictive command-center for road closures, dispatch, and
                            citizen-sourced verification. Multi-agent triage, spatial diversion,
                            and logistics optimization — <em style={{ color: "var(--orange)", fontStyle: "normal" }}>streamed</em>{" "}
                            in real time.
                        </p>
                    </Reveal>

                    <Reveal delay={0.45}>
                        <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
                            <Magnet>
                                <Link to="/god-mode" className="btn" data-testid="cta-godmode" style={{ fontSize: 12, padding: "12px 22px" }}>
                                    ⊕ ENTER GOD MODE →
                                </Link>
                            </Magnet>
                            <Magnet>
                                <Link to="/intelligence" className="btn ghost" data-testid="cta-intel" style={{ fontSize: 12, padding: "12px 22px" }}>
                                    VIEW INTELLIGENCE
                                </Link>
                            </Magnet>
                        </div>
                    </Reveal>

                    <Reveal delay={0.6}>
                        <div style={{ display: "flex", gap: 44, marginTop: 64, flexWrap: "wrap" }}>
                            {[
                                { k: "150", l: "INCIDENTS TRACKED" },
                                { k: "54", l: "STATIONS LIVE" },
                                { k: "5", l: "AGENT PIPELINE" },
                                { k: "<3s", l: "DISPATCH P50" },
                            ].map((s) => (
                                <div key={s.l}>
                                    <div
                                        className="mono flow-gradient"
                                        style={{ fontSize: 34, lineHeight: 1 }}
                                    >
                                        {s.k}
                                    </div>
                                    <div
                                        className="display"
                                        style={{
                                            fontSize: 10,
                                            color: "var(--text-mute)",
                                            letterSpacing: "0.18em",
                                            marginTop: 6,
                                        }}
                                    >
                                        {s.l}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>

                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 540,
                        transform: "translate(var(--mx, 0), var(--my, 0))",
                        transition: "transform 0.6s cubic-bezier(0.16,1,0.3,1)",
                    }}
                >
                    <SplineLogo size={460} />
                </div>
            </section>

            {/* MARQUEE */}
            <section style={{ position: "relative", zIndex: 2, padding: "12px 0", borderBlock: "1px solid var(--border)", background: "rgba(3,7,18,0.5)", backdropFilter: "blur(12px)" }}>
                <div className="marquee">
                    <div className="marquee-track display" style={{ fontSize: 22, color: "var(--text-dim)", letterSpacing: "0.18em" }}>
                        {Array.from({ length: 2 }).flatMap((_, copy) => [
                            ["TRIAGE", "var(--orange)"],
                            ["·", "var(--text-mute)"],
                            ["SPATIAL", "var(--cyan)"],
                            ["·", "var(--text-mute)"],
                            ["LOGISTICS", "var(--green)"],
                            ["·", "var(--text-mute)"],
                            ["SUPERVISOR", "var(--amber)"],
                            ["·", "var(--text-mute)"],
                            ["CRISIS COMMS", "var(--red)"],
                            ["·", "var(--text-mute)"],
                            ["AUTONOMOUS DISPATCH", "var(--orange)"],
                            ["·", "var(--text-mute)"],
                        ]).map(([w, c], i) => (
                            <span key={i} style={{ color: c }}>{w}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* MODULES */}
            <section style={{ position: "relative", zIndex: 2, padding: "88px 32px", maxWidth: 1380, margin: "0 auto" }}>
                <Reveal>
                    <div className="display" style={{ fontSize: 11, color: "var(--cyan)", letterSpacing: "0.3em", marginBottom: 16 }}>
                        ◢ FOUR MODULES · ONE COMMAND DECK
                    </div>
                </Reveal>
                <Reveal delay={0.1}>
                    <h2 className="display" style={{ fontSize: 48, margin: 0, lineHeight: 1, maxWidth: 760 }}>
                        Built for the <span className="flow-gradient">three seconds</span> after the call comes in.
                    </h2>
                </Reveal>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 56 }}>
                    {[
                        {
                            t: "GOD MODE",
                            sub: "/god-mode",
                            d: "Full-map dispatch · 150 incidents · streaming agent activity · stress test loop.",
                            to: "/god-mode",
                            c: "var(--orange)",
                            tag: "01",
                        },
                        {
                            t: "SENTINEL GRID",
                            sub: "/sentinel",
                            d: "Citizen reports → swarm verification → autonomous dispatch when threshold crosses.",
                            to: "/sentinel",
                            c: "var(--cyan)",
                            tag: "02",
                        },
                        {
                            t: "INTELLIGENCE",
                            sub: "/intelligence",
                            d: "Closure metrics, confusion matrix, hourly heatmap, corridor risk top-10.",
                            to: "/intelligence",
                            c: "var(--green)",
                            tag: "03",
                        },
                        {
                            t: "DEBRIEF",
                            sub: "/debrief",
                            d: "Every mistake the model made — drift gauge, anomalies, retraining flags.",
                            to: "/debrief",
                            c: "var(--amber)",
                            tag: "04",
                        },
                    ].map((card, i) => (
                        <Reveal key={card.t} delay={i * 0.08}>
                            <Link
                                to={card.to}
                                className="panel module-card"
                                style={{
                                    padding: 22,
                                    textDecoration: "none",
                                    color: "inherit",
                                    display: "block",
                                    height: "100%",
                                    position: "relative",
                                    transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s",
                                    overflow: "hidden",
                                }}
                                data-testid={`landing-card-${card.to.slice(1)}`}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-6px)";
                                    e.currentTarget.style.boxShadow = `0 24px 60px ${card.c}33, 0 0 0 1px ${card.c}55 inset`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "none";
                                    e.currentTarget.style.boxShadow = "";
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        right: 16,
                                        top: 12,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11,
                                        color: card.c,
                                        opacity: 0.5,
                                    }}
                                >
                                    {card.tag}
                                </div>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 4,
                                        background: `linear-gradient(135deg, ${card.c}, transparent)`,
                                        border: `1px solid ${card.c}`,
                                        marginBottom: 14,
                                        boxShadow: `0 0 18px ${card.c}66`,
                                    }}
                                />
                                <div className="display" style={{ fontSize: 16, color: card.c, letterSpacing: "0.18em", marginBottom: 4 }}>
                                    {card.t}
                                </div>
                                <div className="mono" style={{ fontSize: 10, color: "var(--text-mute)", marginBottom: 14 }}>
                                    {card.sub}
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>{card.d}</div>
                                <div
                                    className="display"
                                    style={{
                                        marginTop: 24,
                                        fontSize: 11,
                                        color: card.c,
                                        letterSpacing: "0.18em",
                                    }}
                                >
                                    OPEN MODULE →
                                </div>
                            </Link>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* PIPELINE BAND */}
            <section style={{ position: "relative", zIndex: 2, padding: "60px 32px 88px", maxWidth: 1380, margin: "0 auto" }}>
                <Reveal>
                    <div className="display" style={{ fontSize: 11, color: "var(--cyan)", letterSpacing: "0.3em", marginBottom: 16 }}>
                        ◢ THE FIVE-AGENT PIPELINE
                    </div>
                </Reveal>
                <Reveal delay={0.1}>
                    <h2 className="display" style={{ fontSize: 38, margin: 0, lineHeight: 1.05, maxWidth: 760 }}>
                        Streamed via <span className="flow-gradient">Server-Sent Events</span>, frame-by-frame.
                    </h2>
                </Reveal>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 48 }}>
                    {[
                        ["TRIAGE", "var(--orange)", "severity, closure prob, duration"],
                        ["SPATIAL", "var(--cyan)", "baseline + diversion + buffer"],
                        ["LOGISTICS", "var(--green)", "officers + barricades, MILP solve"],
                        ["SUPERVISOR", "var(--amber)", "escalation, retry, expansion"],
                        ["DIRECTIVE", "var(--red)", "tweet · sms · dispatch audio"],
                    ].map(([n, c, d], i) => (
                        <Reveal key={n} delay={i * 0.06}>
                            <div className="panel" style={{ padding: 18, height: "100%", borderTop: `2px solid ${c}` }}>
                                <div className="mono" style={{ fontSize: 11, color: c }}>0{i + 1}</div>
                                <div className="display" style={{ fontSize: 14, color: c, marginTop: 8, letterSpacing: "0.16em" }}>{n}</div>
                                <div className="mono" style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 8, lineHeight: 1.5 }}>
                                    {d}
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* FINAL CTA */}
            <section
                style={{
                    position: "relative",
                    zIndex: 2,
                    padding: "100px 32px",
                    textAlign: "center",
                    borderTop: "1px solid var(--border)",
                    background: "linear-gradient(180deg, transparent, rgba(249,115,22,0.06))",
                }}
            >
                <Reveal>
                    <div className="display flow-gradient" style={{ fontSize: "clamp(40px, 6vw, 76px)", lineHeight: 1, fontWeight: 700, letterSpacing: "0.04em" }}>
                        SHIP THE NEXT THREE SECONDS.
                    </div>
                </Reveal>
                <Reveal delay={0.15}>
                    <p style={{ color: "var(--text-dim)", fontSize: 16, marginTop: 22, maxWidth: 540, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
                        Press <kbd style={{ color: "var(--orange)", border: "1px solid var(--orange)", padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>⌘K</kbd> from any page to jump.
                    </p>
                </Reveal>
                <Reveal delay={0.25}>
                    <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 28 }}>
                        <Magnet>
                            <Link to="/god-mode" className="btn" style={{ fontSize: 12, padding: "14px 26px" }} data-testid="cta-final">
                                ⊕ ENTER GOD MODE →
                            </Link>
                        </Magnet>
                    </div>
                </Reveal>
            </section>

            <footer
                style={{
                    position: "relative",
                    zIndex: 2,
                    padding: "24px 32px",
                    borderTop: "1px solid var(--border)",
                    color: "var(--text-mute)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <span>CLEARPATH OS · v0.1 · HACKATHON BUILD</span>
                <span>BUILT FOR BENGALURU TRAFFIC POLICE</span>
            </footer>
        </div>
    );
}
