import React, { useRef, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei/core/Stars.js";
import * as THREE from "three";

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

// Main Landing Page Component
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleGetStarted = () => {
    navigate("/play");
  };

  const handleClose = () => {
    navigate("/play");
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 z-0">
        <StarryBackground />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Central Card */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-12 py-12">
          <div
            className={`relative w-full max-w-md transition-all duration-1000 ${
              isLoaded
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {/* Invite Card */}
            <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700/50 shadow-2xl">
              {/* Textured overlay effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-30"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
                    repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)
                  `,
                }}
              ></div>

              {/* System Design Preview */}
              <div className="relative mb-8 flex h-48 items-center justify-center">
                <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-cyan-300/10 via-cyan-200/60 to-emerald-300/10"></div>
                <div className="absolute left-12 top-10 h-20 w-px bg-cyan-200/20"></div>
                <div className="absolute right-12 bottom-10 h-20 w-px bg-emerald-200/20"></div>
                <div className="relative grid w-full grid-cols-3 items-center gap-4">
                  {[
                    { label: "CLIENT", tone: "border-cyan-300/45 bg-cyan-300/10 text-cyan-100" },
                    { label: "API", tone: "border-violet-300/45 bg-violet-300/10 text-violet-100" },
                    { label: "DB", tone: "border-emerald-300/45 bg-emerald-300/10 text-emerald-100" },
                  ].map((node) => (
                    <div
                      key={node.label}
                      className={`mx-auto flex h-20 w-20 items-center justify-center rounded-xl border ${node.tone} font-['IBM_Plex_Mono'] text-sm font-semibold shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-md`}
                    >
                      {node.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand */}
              <div className="relative z-10 mb-6 text-center">
                <h1 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-semibold text-white">
                  Reptile Chemica
                </h1>
                <p className="mt-3 text-sm md:text-base text-gray-400">
                  Hand-tracked system design interview prep.
                </p>
              </div>

              {/* System Prompt */}
              <div className="relative z-10 mb-4">
                <div className="inline-block px-6 py-3 bg-gray-800/80 rounded-full border border-gray-600/50">
                  <span className="font-['IBM_Plex_Mono'] text-white text-lg md:text-xl">
                    :: CLIENT + API + DB
                  </span>
                </div>
              </div>

              {/* Inviter Info */}
              <div className="relative z-10">
                <p className="text-sm text-gray-400 font-['Inter']">
                  Built in Reptile Chemica
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full px-6 md:px-12 pb-6">
          <div className="space-y-6">
            {/* Top Footer Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Left */}
              <div className="flex items-center gap-3 justify-start md:justify-start">
                <span className="text-2xl md:text-3xl font-['Space_Grotesk'] font-semibold">
                  1x
                </span>
                <span className="text-sm md:text-base font-['Inter'] text-gray-300">
                  Component to combine
                </span>
              </div>

              {/* Center - CTA Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 bg-transparent border-2 border-white/20 hover:border-white/40 rounded-lg font-['Space_Grotesk'] text-lg md:text-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
                  style={{
                    fontFamily: "Space Grotesk, Inter, sans-serif",
                  }}
                >
                  Start Interview Prep →
                </button>
              </div>

              {/* Right */}
              <div className="text-right text-sm font-['Inter'] text-gray-400 max-w-sm md:ml-auto">
                <p>Practice with system components</p>
                <p>and compose interview-ready architecture patterns.</p>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="w-full bg-gray-900/60 backdrop-blur-md border-t border-gray-700/50 px-6 md:px-12 py-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-1 w-6 h-6">
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-white rounded-sm"
                      ></div>
                    ))}
                  </div>
                  <span className="font-['Space_Grotesk'] font-semibold text-lg">
                    Reptile Chemica
                  </span>
                </div>

                {/* Right: Attribution */}
                <div className="flex items-center gap-2 text-sm font-['Inter'] text-gray-400">
                  <span>curated by</span>
                  <div className="flex items-center gap-1">
                    <span className="font-['Space_Grotesk'] font-semibold text-white">
                      R
                    </span>
                    <span className="text-white">Reptile Chemica</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
