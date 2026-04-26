import React, { useRef, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei/core/Stars.js";
import * as THREE from "three";
import { copyText, createRoomCode, getRoomPath, getShareUrl, normalizeRoomCode } from "./utils/multiplayer";

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
      uOpacity: { value: 0.3 },
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
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#00BFFF" />
      <Stars
        radius={300}
        depth={60}
        count={8000}
        factor={7}
        saturation={0}
        fade
        speed={1}
      />
      <BackgroundParticleSphere />
    </Canvas>
  );
};

const architectureNodes = [
  { label: "CLIENT", name: "User entry", top: "15%", left: "8%", color: "#38BDF8" },
  { label: "CDN", name: "Edge cache", top: "34%", left: "24%", color: "#22D3EE" },
  { label: "API", name: "Gateway", top: "16%", left: "47%", color: "#F472B6" },
  { label: "APP", name: "Service", top: "45%", left: "58%", color: "#FACC15" },
  { label: "CACHE", name: "Fast reads", top: "69%", left: "38%", color: "#4ADE80" },
  { label: "DB", name: "Source of truth", top: "69%", left: "72%", color: "#FB923C" },
];

const architectureLinks = [
  { top: "26%", left: "17%", width: "16%", rotate: "25deg", color: "#38BDF8" },
  { top: "31%", left: "36%", width: "17%", rotate: "-17deg", color: "#22D3EE" },
  { top: "31%", left: "53%", width: "17%", rotate: "53deg", color: "#F472B6" },
  { top: "61%", left: "48%", width: "15%", rotate: "132deg", color: "#4ADE80" },
  { top: "61%", left: "62%", width: "17%", rotate: "37deg", color: "#FB923C" },
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

    <div className="absolute right-[-8%] top-[12%] h-[66vh] w-[min(76vw,840px)] max-w-[900px]">
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
        <div className="relative grid h-28 w-28 place-items-center border border-cyan-300/70 bg-black/45 backdrop-blur-sm shadow-[0_0_36px_rgba(34,211,238,0.32)]">
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
          className="absolute w-28 border border-white/12 bg-black/55 px-3 py-2 backdrop-blur-md shadow-[0_0_24px_rgba(0,0,0,0.35)]"
          style={{
            top: node.top,
            left: node.left,
            borderColor: `${node.color}66`,
          }}
        >
          <div
            className="font-['Space_Grotesk'] text-lg font-semibold"
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
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.72)_43%,rgba(0,0,0,0.22)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black to-transparent" />

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col px-5 md:px-10">
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
            className="border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-white/70 transition-colors hover:border-cyan-300/60 hover:text-cyan-100"
          >
            Skip Intro
          </button>
        </header>

        <main
          className={`relative flex flex-1 flex-col justify-center py-10 md:pb-16 md:pt-8 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 font-mono text-xs text-cyan-100">
              CLIENT + API + CACHE + DB
            </div>

            <h1 className="font-['Space_Grotesk'] text-[clamp(3rem,8vw,7.5rem)] font-semibold leading-[0.88] text-white">
              Design systems in thin air.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-50/72 md:text-xl">
              Snap infrastructure components into living 3D architecture diagrams
              and watch reliable systems assemble in real time.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={handleGetStarted}
                className="bg-cyan-200 px-6 py-4 font-['Space_Grotesk'] text-base font-semibold text-black transition-colors hover:bg-white"
              >
                Launch Studio
              </button>
              <button
                onClick={handleCoBuild}
                className="border border-cyan-200/45 bg-cyan-200/10 px-6 py-4 font-['Space_Grotesk'] text-base font-semibold text-cyan-50 transition-colors hover:bg-cyan-200/20"
              >
                Co-Build
              </button>
              <div className="flex overflow-hidden border border-white/12 bg-black/30">
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
                  className="w-36 bg-transparent px-4 py-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 placeholder:text-cyan-100/35 outline-none"
                  aria-label="Room code"
                />
                <button
                  onClick={handleJoinCoBuild}
                  className="border-l border-white/12 px-4 py-4 font-mono text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-200/10"
                >
                  Join
                </button>
              </div>
              <div className="border border-white/12 bg-black/30 px-4 py-3 font-mono text-xs text-white/58">
                HAND TRACKING READY
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 pb-5">
          <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
            {[
              ["01", "Pick components", "client, API, cache, queue, database"],
              ["02", "Snap to compose", "turn pairs into architecture patterns"],
              ["03", "Ship the diagram", "practice systems design visually"],
            ].map(([step, title, detail]) => (
              <div key={step} className="bg-black/70 px-4 py-4 backdrop-blur-md">
                <div className="font-mono text-[10px] text-cyan-200/50">
                  STEP {step}
                </div>
                <div className="mt-1 font-['Space_Grotesk'] text-base font-semibold text-white">
                  {title}
                </div>
                <div className="mt-1 font-mono text-[11px] leading-5 text-white/42">
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
