import React, { useRef, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei/core/Stars.js";
import * as THREE from "three";
import { copyText, createRoomCode, getRoomPath, getShareUrl, normalizeRoomCode } from "./utils/multiplayer";

const HERO_TITLE = "Design systems in thin air.";
const HERO_TYPING_DURATION_MS = 3000;

// Particle Sphere for Background
const BackgroundParticleSphere: React.FC = () => {
  const meshRef = useRef<THREE.Points>(null);
  const coreCount = 1000;
  const shellCount = 1500;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 0.3 },
      uTurbulence: { value: 0.2 },
      uColor: { value: new THREE.Color("#00BFFF") },
      uOpacity: { value: 0.18 },
    }),
    []
  );

  const { positions, sizes, speeds, layers } = useMemo(() => {
    const total = coreCount + shellCount;
    const pos = new Float32Array(total * 3);
    const sz = new Float32Array(total);
    const sp = new Float32Array(total);
    const lay = new Float32Array(total);

    for (let i = 0; i < coreCount; i++) {
      const r = Math.pow(Math.random(), 3) * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = Math.random() * 1.5 + 0.5;
      sp[i] = Math.random() * 0.2;
      lay[i] = 0.0;
    }

    for (let i = coreCount; i < total; i++) {
      const r = 0.9 + Math.random() * 0.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = Math.random() * 0.8 + 0.2;
      sp[i] = Math.random() + 0.5;
      lay[i] = 1.0;
    }

    return { positions: pos, sizes: sz, speeds: sp, layers: lay };
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = time;
      const pulse = Math.sin(time * 0.5) * 0.1 + 0.3;
      material.uniforms.uScale.value = pulse;
      material.uniforms.uTurbulence.value = pulse * 0.5;
    }
  });

  const particleVertexShader = `
    uniform float uTime;
    uniform float uScale;
    uniform float uTurbulence;
    attribute float aSize;
    attribute float aSpeed;
    attribute float aLayer;
    varying float vAlpha;
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xzyw;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    void main() {
      vec3 pos = position;
      float t = uTime * 0.5 * aSpeed;
      if (aLayer > 0.5) {
        float c = cos(t);
        float s = sin(t);
        mat2 rot = mat2(c, -s, s, c);
        pos.xz = rot * pos.xz;
      }
      float noiseVal = snoise(pos * 2.5 + uTime * 0.8);
      pos += normal * noiseVal * (0.05 + uTurbulence * 0.15);
      float expansion = 1.0 + (uScale * 3.0);
      if (aLayer > 0.5) {
        pos *= expansion;
      } else {
        pos *= (1.0 + uScale * 0.5);
      }
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = (aSize * 50.0) / -mvPosition.z;
      vAlpha = 1.0;
    }
  `;

  const particleFragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      vec2 xy = gl_PointCoord.xy - vec2(0.5);
      float r = length(xy);
      if (r > 0.5) discard;
      float glow = 1.0 - smoothstep(0.1, 0.5, r);
      vec3 finalColor = mix(uColor, vec3(1.0), glow * 0.5);
      gl_FragColor = vec4(finalColor, glow * uOpacity);
    }
  `;

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSpeed"
          count={speeds.length}
          array={speeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aLayer"
          count={layers.length}
          array={layers}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
      />
    </points>
  );
};

// Background 3D Scene
const StarryBackground: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 0, 5]} intensity={0.32} color="#00BFFF" />
      <Stars
        radius={300}
        depth={60}
        count={5200}
        factor={5}
        saturation={0}
        fade
        speed={1}
      />
      <BackgroundParticleSphere />
    </Canvas>
  );
};

const architectureNodes = [
  { label: "CLIENT", name: "User entry", top: "14%", left: "5%", color: "#38BDF8" },
  { label: "CDN", name: "Edge cache", top: "35%", left: "22%", color: "#22D3EE" },
  { label: "API", name: "Gateway", top: "15%", left: "52%", color: "#F472B6" },
  { label: "APP", name: "Service", top: "46%", left: "62%", color: "#FACC15" },
  { label: "CACHE", name: "Fast reads", top: "70%", left: "34%", color: "#4ADE80" },
  { label: "DB", name: "Source of truth", top: "69%", left: "70%", color: "#FB923C" },
];

const architectureLinks = [
  { top: "26%", left: "16%", width: "16%", rotate: "24deg", color: "#38BDF8" },
  { top: "32%", left: "35%", width: "18%", rotate: "-17deg", color: "#22D3EE" },
  { top: "31%", left: "54%", width: "15%", rotate: "53deg", color: "#F472B6" },
  { top: "62%", left: "47%", width: "16%", rotate: "134deg", color: "#4ADE80" },
  { top: "61%", left: "62%", width: "15%", rotate: "35deg", color: "#FB923C" },
];

const SystemArchitecturePreview: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(103,232,249,0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(103,232,249,0.16) 1px, transparent 1px)
        `,
        backgroundSize: "72px 72px",
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
      }}
    />

    <div className="absolute right-[1%] top-[14%] h-[64vh] w-[min(50vw,690px)] max-w-[720px] opacity-70">
      {architectureLinks.map((link, index) => (
        <div
          key={`${link.left}-${index}`}
          className="landing-architecture-link absolute h-px origin-left"
          style={{
            top: link.top,
            left: link.left,
            width: link.width,
            transform: `rotate(${link.rotate})`,
            background: `linear-gradient(90deg, transparent, ${link.color}, transparent)`,
            boxShadow: `0 0 18px ${link.color}`,
          }}
        />
      ))}

      <div className="absolute left-[48%] top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid h-24 w-24 place-items-center border border-cyan-300/50 bg-black/35 backdrop-blur-sm shadow-[0_0_26px_rgba(34,211,238,0.22)]">
          <div className="absolute inset-2 border border-white/10" />
          <div className="text-center">
            <div className="font-['Space_Grotesk'] text-xl font-semibold text-white">
              3D
            </div>
            <div className="font-mono text-[10px] text-cyan-200/75">COMPOSE</div>
          </div>
        </div>
      </div>

      {architectureNodes.map((node) => (
        <div
          key={node.label}
          className="absolute w-[6.75rem] border border-white/10 bg-black/42 px-3 py-2 backdrop-blur-md shadow-[0_0_18px_rgba(0,0,0,0.28)]"
          style={{
            top: node.top,
            left: node.left,
            borderColor: `${node.color}66`,
          }}
        >
          <div
            className="font-['Space_Grotesk'] text-base font-semibold"
            style={{ color: node.color }}
          >
            {node.label}
          </div>
          <div className="font-mono text-[10px] leading-tight text-white/45">
            {node.name}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TypingHeroTitle: React.FC = () => {
  const [visibleLength, setVisibleLength] = useState(0);
  const [direction, setDirection] = useState<"typing" | "deleting">("typing");

  useEffect(() => {
    const stepMs = HERO_TYPING_DURATION_MS / HERO_TITLE.length;

    if (direction === "typing" && visibleLength === HERO_TITLE.length) {
      const timeout = window.setTimeout(() => setDirection("deleting"), 220);
      return () => window.clearTimeout(timeout);
    }

    if (direction === "deleting" && visibleLength === 0) {
      const timeout = window.setTimeout(() => setDirection("typing"), 180);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setVisibleLength((current) =>
        direction === "typing"
          ? Math.min(HERO_TITLE.length, current + 1)
          : Math.max(0, current - 1)
      );
    }, stepMs);

    return () => window.clearTimeout(timeout);
  }, [direction, visibleLength]);

  const visibleText = HERO_TITLE.slice(0, visibleLength);

  return (
    <h1
      aria-label={HERO_TITLE}
      className="relative font-['Space_Grotesk'] text-[3.25rem] font-semibold leading-[0.93] text-white/90 sm:text-[4.75rem] lg:text-[6.6rem]"
    >
      <span className="invisible block">{HERO_TITLE}</span>
      <span aria-hidden="true" className="absolute inset-0 block">
        {visibleText}
        <span className="ml-1 inline-block h-[0.82em] w-[0.07em] translate-y-[0.08em] bg-cyan-100/80 shadow-[0_0_10px_rgba(103,232,249,0.45)]" />
      </span>
    </h1>
  );
};

// Main Landing Page Component
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleGetStarted = () => {
    navigate("/play");
  };

  const handleCoBuild = () => {
    const roomId = createRoomCode();
    const roomUrl = getShareUrl(roomId);

    copyText(roomUrl).catch(() => {
      // The room URL is still placed in the address bar after navigation.
    });
    navigate(getRoomPath(roomId));
  };

  const handleJoinCoBuild = () => {
    const roomId = normalizeRoomCode(joinCode);
    if (!roomId) return;
    navigate(getRoomPath(roomId));
  };

  const handleClose = () => {
    navigate("/play");
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 z-0">
        <StarryBackground />
      </div>
      <SystemArchitecturePreview />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_58%_50%,rgba(34,211,238,0.09),transparent_25%),linear-gradient(90deg,rgba(0,0,0,0.97)_0%,rgba(0,0,0,0.8)_39%,rgba(0,0,0,0.44)_68%,rgba(0,0,0,0.24)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black to-transparent" />

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col px-5 md:px-8 lg:px-10">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 grid-cols-3 gap-1">
              {[...Array(9)].map((_, index) => (
                <div key={index} className="bg-cyan-200/85" />
              ))}
            </div>
            <div>
              <div className="font-['Space_Grotesk'] text-lg font-semibold">
                Reptile Systems
              </div>
              <div className="font-mono text-[10px] text-cyan-200/55">
                SYSTEMS DESIGN IN 3D
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-white/70 transition-colors hover:border-cyan-300/60 hover:bg-cyan-200/10 hover:text-cyan-100"
          >
            Skip Intro
          </button>
        </header>

        <main
          className={`relative flex flex-1 flex-col justify-center py-8 md:pb-14 md:pt-6 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="max-w-[46rem]">
            <div className="mb-5 inline-flex items-center gap-3 border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 font-mono text-xs text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <span className="h-2 w-2 bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.75)]" />
              CLIENT + API + CACHE + DB
            </div>

            <TypingHeroTitle />

            <p className="mt-6 max-w-xl text-base leading-7 text-cyan-50/68 md:text-lg">
              Snap infrastructure components into living 3D architecture diagrams
              and watch reliable systems assemble in real time.
            </p>

            <div className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
              <button
                onClick={handleGetStarted}
                className="h-14 bg-cyan-200 px-6 font-['Space_Grotesk'] text-base font-semibold text-black transition-colors hover:bg-white"
              >
                Launch Studio
              </button>
              <button
                onClick={handleCoBuild}
                className="h-14 border border-emerald-300/45 bg-emerald-300/10 px-6 font-['Space_Grotesk'] text-base font-semibold text-emerald-50 transition-colors hover:bg-emerald-300/20"
              >
                Co-Build
              </button>
              <div className="flex h-14 overflow-hidden border border-white/16 bg-black/45 backdrop-blur-md">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleJoinCoBuild();
                    }
                  }}
                  placeholder="ROOM CODE"
                  className="w-36 bg-transparent px-4 font-mono text-xs font-semibold uppercase text-cyan-50 placeholder:text-cyan-100/35 outline-none"
                  aria-label="Room code"
                />
                <button
                  onClick={handleJoinCoBuild}
                  className="border-l border-white/12 px-4 font-mono text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-200/10"
                >
                  Join
                </button>
              </div>
              <div className="flex h-14 items-center border border-white/12 bg-black/30 px-4 font-mono text-xs text-white/58">
                HAND TRACKING READY
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 pb-5">
          <div className="grid gap-px overflow-hidden border border-white/8 bg-white/5 md:grid-cols-3">
            {[
              ["01", "Pick components", "client, API, cache, queue, database"],
              ["02", "Snap to compose", "turn pairs into architecture patterns"],
              ["03", "Ship the diagram", "practice systems design visually"],
            ].map(([step, title, detail]) => (
              <div key={step} className="bg-black/48 px-5 py-3.5 backdrop-blur-md">
                <div className="font-mono text-[10px] font-semibold text-cyan-200/58">
                  STEP {step}
                </div>
                <div className="mt-1 font-['Space_Grotesk'] text-lg font-bold text-white">
                  {title}
                </div>
                <div className="mt-1 font-['Space_Grotesk'] text-sm font-medium leading-5 text-white/56">
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </footer>
      </div>

      <style>{`
        .landing-architecture-link::after {
          content: "";
          position: absolute;
          inset: -1px auto -1px 0;
          width: 24%;
          background: linear-gradient(90deg, transparent, white, transparent);
          animation: landing-flow 2.2s linear infinite;
        }

        @keyframes landing-flow {
          0% { transform: translateX(-120%); opacity: 0; }
          18% { opacity: 0.8; }
          100% { transform: translateX(420%); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
