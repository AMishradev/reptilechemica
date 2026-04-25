
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import ParticleSphere from './ParticleSphere';
import AtomLabel from './AtomLabel';
import { ElementData, TrackingData } from '../types';
import { ELEMENTS } from '../constants';
import * as THREE from 'three';

interface SceneProps {
  leftElement: ElementData;
  rightElement: ElementData;
  combinedElement: ElementData | null;
  trackingData: React.MutableRefObject<TrackingData>;
  pinnedHand: 'left' | 'right' | null;
  pinnedPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  interactionCooldownUntilRef: React.MutableRefObject<number>;
  onOverlapMerge?: () => void;
  onOverlapChange?: (isOverlapping: boolean) => void;
}

const OVERLAP_THRESHOLD = 2.9; // 3D units — enough for a slight intersection of the outer 1.5 radius rings
const OVERLAP_HOLD = 0.1;      // seconds of sustained overlap before merge fires
const MERGE_LOCK_TIMEOUT = 0.35; // seconds to wait for App state to confirm a merge before releasing the lock
const SCENE_ORIGIN = new THREE.Vector3(0, 0, 0);

const getComponentData = (symbol: string) => {
  return ELEMENTS.find(component => component.symbol === symbol) ?? {
    symbol,
    name: symbol,
    color: '#ffffff',
    atomicNumber: 0,
    description: '',
  };
};

const ComponentNode: React.FC<{
  component: ElementData;
  position: [number, number, number];
  opacity: number;
  pulseOffset?: number;
  mergeLockRef?: React.MutableRefObject<number>;
}> = ({ component, position, opacity, pulseOffset = 0, mergeLockRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const sphereMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime + pulseOffset;
    const mergeLock = mergeLockRef?.current ?? 0;
    if (groupRef.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.04 * (1 - mergeLock * 0.7);
      groupRef.current.scale.setScalar(pulse);
    }
    if (sphereRef.current) {
      const targetScale = 1 + mergeLock * 0.2;
      sphereRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
    }
    if (sphereMaterialRef.current) {
      sphereMaterialRef.current.opacity = THREE.MathUtils.lerp(
        sphereMaterialRef.current.opacity,
        opacity * (1 - mergeLock * 0.08),
        0.14
      );
      sphereMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        sphereMaterialRef.current.emissiveIntensity,
        0.45 + mergeLock * 0.65,
        0.14
      );
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.015 * (1 - mergeLock * 0.75);
      ringRef.current.rotation.y += 0.01 * (1 - mergeLock * 0.75);
      const targetScale = 1 - mergeLock * 0.24;
      ringRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
    }
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = THREE.MathUtils.lerp(
        ringMaterialRef.current.opacity,
        opacity * (0.75 - mergeLock * 0.5),
        0.14
      );
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial
          ref={sphereMaterialRef}
          color={component.color}
          emissive={component.color}
          emissiveIntensity={0.45}
          roughness={0.25}
          metalness={0.15}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.62, 0.018, 12, 80]} />
        <meshBasicMaterial ref={ringMaterialRef} color={component.color} transparent opacity={opacity * 0.75} />
      </mesh>
      <Html position={[0, -0.78, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center font-mono text-center">
          <div
            className="text-sm font-bold tracking-widest"
            style={{
              color: '#ffffff',
              textShadow: `0 0 10px ${component.color}`,
              opacity,
            }}
          >
            {component.symbol}
          </div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-100/70 whitespace-nowrap">
            {component.name}
          </div>
        </div>
      </Html>
    </group>
  );
};

const RouteTrafficPacket: React.FC<{
  offset: number;
  opacity: number;
}> = ({ offset, opacity }) => {
  const packetRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!packetRef.current) return;
    const cycle = (state.clock.elapsedTime * 0.42 + offset) % 1;
    const x = THREE.MathUtils.lerp(-1.55, 1.55, cycle);
    const y = Math.sin(cycle * Math.PI) * 0.18;
    packetRef.current.position.set(x, y, 0.05);
    packetRef.current.scale.setScalar(0.75 + Math.sin(cycle * Math.PI) * 0.35);
  });

  return (
    <mesh ref={packetRef}>
      <sphereGeometry args={[0.09, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
    </mesh>
  );
};

const RouteComponent: React.FC<{
  scaleRef: React.MutableRefObject<number>;
  opacityTarget: number;
  mergeLockRef?: React.MutableRefObject<number>;
}> = ({ scaleRef, opacityTarget, mergeLockRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const api = getComponentData('API');
  const lb = getComponentData('LB');

  useFrame(() => {
    if (!groupRef.current) return;
    const mergeLock = mergeLockRef?.current ?? 0;
    const targetScale = 1 + scaleRef.current * 0.45 - mergeLock * 0.05;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y += 0.002 * (1 - mergeLock * 0.8);
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 3.1, 24]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={opacityTarget * 0.7} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 3.35, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacityTarget * 0.4} />
      </mesh>

      <RouteTrafficPacket offset={0} opacity={opacityTarget} />
      <RouteTrafficPacket offset={0.28} opacity={opacityTarget * 0.85} />
      <RouteTrafficPacket offset={0.56} opacity={opacityTarget * 0.7} />

      <ComponentNode component={api} position={[-1.8, 0, 0]} opacity={opacityTarget} pulseOffset={0} mergeLockRef={mergeLockRef} />
      <ComponentNode component={lb} position={[1.8, 0, 0]} opacity={opacityTarget} pulseOffset={0.8} mergeLockRef={mergeLockRef} />

      <Html position={[0, 1.05, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Orbitron'] text-sm font-bold tracking-[0.35em] text-cyan-100"
          style={{
            opacity: opacityTarget,
            textShadow: '0 0 14px rgba(45, 212, 191, 0.9)',
          }}
        >
          ROUTE
        </div>
      </Html>
    </group>
  );
};

const EdgePulse: React.FC<{
  offset: number;
  opacity: number;
}> = ({ offset, opacity }) => {
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!pulseRef.current) return;
    const cycle = (state.clock.elapsedTime * 0.36 + offset) % 1;
    pulseRef.current.position.set(0, THREE.MathUtils.lerp(-1.35, 1.35, cycle), 0.06);
    pulseRef.current.scale.setScalar(0.65 + Math.sin(cycle * Math.PI) * 0.45);
  });

  return (
    <mesh ref={pulseRef}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
    </mesh>
  );
};

const EdgeComponent: React.FC<{
  scaleRef: React.MutableRefObject<number>;
  opacityTarget: number;
  mergeLockRef?: React.MutableRefObject<number>;
}> = ({ scaleRef, opacityTarget, mergeLockRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const client = getComponentData('CLIENT');
  const dns = getComponentData('DNS');

  useFrame((state) => {
    if (!groupRef.current) return;
    const mergeLock = mergeLockRef?.current ?? 0;
    const targetScale = 1 + scaleRef.current * 0.45 - mergeLock * 0.05;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18 * (1 - mergeLock * 0.85);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[1.15, 0.012, 12, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={opacityTarget * 0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.012, 12, 96]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={opacityTarget * 0.28} />
      </mesh>

      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 2.7, 24]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={opacityTarget * 0.65} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.011, 0.011, 2.95, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacityTarget * 0.35} />
      </mesh>

      <EdgePulse offset={0} opacity={opacityTarget} />
      <EdgePulse offset={0.33} opacity={opacityTarget * 0.82} />
      <EdgePulse offset={0.66} opacity={opacityTarget * 0.65} />

      <ComponentNode component={client} position={[0, -1.65, 0]} opacity={opacityTarget} pulseOffset={0.1} mergeLockRef={mergeLockRef} />
      <ComponentNode component={dns} position={[0, 1.65, 0]} opacity={opacityTarget} pulseOffset={0.9} mergeLockRef={mergeLockRef} />

      <Html position={[1.35, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Orbitron'] text-sm font-bold tracking-[0.35em] text-cyan-100"
          style={{
            opacity: opacityTarget,
            textShadow: '0 0 14px rgba(56, 189, 248, 0.9)',
            writingMode: 'vertical-rl',
          }}
        >
          EDGE
        </div>
      </Html>
    </group>
  );
};

const ConnectionBeam: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  opacity: number;
  radius?: number;
}> = ({ start, end, color, opacity, radius = 0.025 }) => {
  const { midpoint, length, quaternion } = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const direction = endVec.clone().sub(startVec);
    const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );

    return { midpoint, length: direction.length(), quaternion };
  }, [start, end]);

  return (
    <group position={midpoint} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 20]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[radius * 0.35, radius * 0.35, length * 1.04, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.45} />
      </mesh>
    </group>
  );
};

const WebAppPacket: React.FC<{
  offset: number;
  opacity: number;
  path: Array<[number, number, number]>;
}> = ({ offset, opacity, path }) => {
  const packetRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!packetRef.current) return;
    const cycle = (state.clock.elapsedTime * 0.22 + offset) % 1;
    const scaled = cycle * (path.length - 1);
    const segment = Math.min(path.length - 2, Math.floor(scaled));
    const localT = scaled - segment;
    const start = new THREE.Vector3(...path[segment]);
    const end = new THREE.Vector3(...path[segment + 1]);
    const pos = start.lerp(end, localT);
    pos.z += 0.08;
    pos.y += Math.sin(localT * Math.PI) * 0.1;
    packetRef.current.position.copy(pos);
    packetRef.current.scale.setScalar(0.75 + Math.sin(cycle * Math.PI * 2) * 0.18);
  });

  return (
    <mesh ref={packetRef}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
    </mesh>
  );
};

const WebAppComponent: React.FC<{
  scaleRef: React.MutableRefObject<number>;
  opacityTarget: number;
  mergeLockRef?: React.MutableRefObject<number>;
}> = ({ scaleRef, opacityTarget, mergeLockRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const client = getComponentData('CLIENT');
  const dns = getComponentData('DNS');
  const api = getComponentData('API');
  const lb = getComponentData('LB');

  const clientPos: [number, number, number] = [-2.25, -0.9, 0];
  const dnsPos: [number, number, number] = [-2.25, 0.9, 0];
  const apiPos: [number, number, number] = [0.45, 0.45, 0];
  const lbPos: [number, number, number] = [2.35, 0.45, 0];
  const path = [clientPos, dnsPos, apiPos, lbPos];

  useFrame((state) => {
    if (!groupRef.current) return;
    const mergeLock = mergeLockRef?.current ?? 0;
    const targetScale = 0.95 + scaleRef.current * 0.35 - mergeLock * 0.04;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.28) * 0.12 * (1 - mergeLock * 0.8);
  });

  return (
    <group ref={groupRef}>
      <ConnectionBeam start={clientPos} end={dnsPos} color="#38bdf8" opacity={opacityTarget * 0.6} />
      <ConnectionBeam start={dnsPos} end={apiPos} color="#7dd3fc" opacity={opacityTarget * 0.55} />
      <ConnectionBeam start={apiPos} end={lbPos} color="#2dd4bf" opacity={opacityTarget * 0.65} />

      <mesh position={[-0.95, 0, -0.05]}>
        <boxGeometry args={[3.35, 2.45, 0.03]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={opacityTarget * 0.12} />
      </mesh>
      <mesh position={[1.42, 0.45, -0.05]}>
        <boxGeometry args={[2.55, 1.25, 0.03]} />
        <meshBasicMaterial color="#022c22" transparent opacity={opacityTarget * 0.1} />
      </mesh>

      <WebAppPacket offset={0} opacity={opacityTarget} path={path} />
      <WebAppPacket offset={0.25} opacity={opacityTarget * 0.82} path={path} />
      <WebAppPacket offset={0.5} opacity={opacityTarget * 0.68} path={path} />
      <WebAppPacket offset={0.75} opacity={opacityTarget * 0.52} path={path} />

      <ComponentNode component={client} position={clientPos} opacity={opacityTarget} pulseOffset={0} mergeLockRef={mergeLockRef} />
      <ComponentNode component={dns} position={dnsPos} opacity={opacityTarget} pulseOffset={0.45} mergeLockRef={mergeLockRef} />
      <ComponentNode component={api} position={apiPos} opacity={opacityTarget} pulseOffset={0.9} mergeLockRef={mergeLockRef} />
      <ComponentNode component={lb} position={lbPos} opacity={opacityTarget} pulseOffset={1.35} mergeLockRef={mergeLockRef} />

      <Html position={[-2.95, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-100/70" style={{ opacity: opacityTarget }}>
          Edge Entry
        </div>
      </Html>
      <Html position={[1.42, 1.25, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-100/70" style={{ opacity: opacityTarget }}>
          Routed Backend
        </div>
      </Html>
      <Html position={[0, -1.75, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Orbitron'] text-base font-bold tracking-[0.4em] text-white"
          style={{
            opacity: opacityTarget,
            textShadow: '0 0 16px rgba(56, 189, 248, 0.95)',
          }}
        >
          WEBAPP
        </div>
      </Html>
    </group>
  );
};

// --- BIG EXPLOSION SHADER (Mushroom Cloud) ---
const bigExplosionVertexShader = `
uniform float uTime;
attribute float aSize;
attribute vec3 aVelocity;
attribute float aGroup; // 0=Cap, 1=Stem, 2=Shockwave
varying float vAlpha;
varying vec3 vColor;

void main() {
  vec3 p = position;
  float t = uTime * 2.0; // Speed multiplier
  
  if (aGroup < 0.5) { 
      // --- CAP (Mushroom Head) ---
      // Rises fast, then slows. Expands outwards.
      float rise = t * 3.5;
      float expansion = t * 2.5;
      
      // Basic movement
      p += aVelocity * expansion;
      p.y += rise;
      
      // Drag/Curl effect to flatten bottom of cap
      // If particle is far from center, drag it down slightly relative to top
      float dist = length(p.xz);
      p.y -= dist * 0.3 * smoothstep(0.0, 2.0, t);
      
  } else if (aGroup < 1.5) {
      // --- STEM (Column) ---
      // Rises with less expansion
      float rise = t * 3.0;
      float expansion = t * 0.5; // Narrow expansion
      
      p.x += aVelocity.x * expansion;
      p.z += aVelocity.z * expansion;
      p.y += rise * (0.5 + aVelocity.y * 0.5); // Variation in rise speed
      
  } else {
      // --- SHOCKWAVE (Ground Ring) ---
      float expansion = t * 8.0;
      p.x += aVelocity.x * expansion;
      p.z += aVelocity.z * expansion;
      p.y = 0.0; // Keep on ground
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Size calculation
  float size = aSize * (400.0 / -mvPosition.z);
  // Grow then shrink
  size *= smoothstep(0.0, 0.2, uTime) * (1.0 - smoothstep(1.5, 4.0, uTime));
  gl_PointSize = size;
  
  // Alpha fade out
  vAlpha = 1.0 - smoothstep(1.5, 3.5, uTime);
  
  // Color Evolution: Bright White -> Fire Gold -> Dark Red Smoke
  vec3 colCore = vec3(1.0, 1.0, 0.8); // Blinding white/yellow
  vec3 colFire = vec3(1.0, 0.5, 0.0); // Orange/Gold
  vec3 colSmoke = vec3(0.1, 0.05, 0.05); // Dark reddish black
  
  float progress = uTime; // 0 to 3s approx
  
  if (progress < 0.3) {
      vColor = mix(colCore, colFire, progress / 0.3);
  } else if (progress < 1.5) {
      vColor = mix(colFire, colSmoke, (progress - 0.3) / 1.2);
  } else {
      vColor = colSmoke;
  }
}
`;

const bigExplosionFragmentShader = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord.xy - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  
  // Soft particle edge
  float alpha = vAlpha * (1.0 - smoothstep(0.3, 0.5, d));
  
  gl_FragColor = vec4(vColor, alpha);
}
`;

const BigExplosion: React.FC = () => {
    const ref = useRef<THREE.Points>(null);
    const count = 3000;
    
    const { positions, velocities, sizes, groups } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        const sz = new Float32Array(count);
        const grp = new Float32Array(count);
        
        for(let i=0; i<count; i++) {
            // Reset position
            pos[i*3] = 0; pos[i*3+1] = -2; pos[i*3+2] = 0;
            
            const r = Math.random();
            let groupId = 0; // Cap
            
            if (r > 0.85) groupId = 2; // Shockwave (15%)
            else if (r > 0.6) groupId = 1; // Stem (25%)
            else groupId = 0; // Cap (60%)
            
            grp[i] = groupId;
            sz[i] = Math.random() * 1.5 + 0.5;

            // Velocity setup based on group
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            if (groupId === 0) { // Cap - Sphere-ish
                 const speed = Math.random() * 0.8 + 0.2;
                 vel[i*3] = Math.sin(phi) * Math.cos(theta) * speed;
                 vel[i*3+1] = Math.abs(Math.cos(phi)) * speed; // Mostly Up
                 vel[i*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
            } else if (groupId === 1) { // Stem - Cylinder
                 const speed = Math.random() * 0.5 + 0.1;
                 const rad = Math.random() * 0.2; // Narrow
                 vel[i*3] = Math.cos(theta) * rad;
                 vel[i*3+1] = Math.random() * 1.0 + 0.5; // Strong Up
                 vel[i*3+2] = Math.sin(theta) * rad;
            } else { // Shockwave - Disc
                 const speed = Math.random() * 1.0 + 0.5;
                 vel[i*3] = Math.cos(theta) * speed;
                 vel[i*3+1] = 0;
                 vel[i*3+2] = Math.sin(theta) * speed;
            }
        }
        return { positions: pos, velocities: vel, sizes: sz, groups: grp };
    }, []);

    useFrame((state, delta) => {
        if(ref.current) {
            const mat = ref.current.material as THREE.ShaderMaterial;
            mat.uniforms.uTime.value += delta;
        }
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-aVelocity" count={count} array={velocities} itemSize={3} />
                <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
                <bufferAttribute attach="attributes-aGroup" count={count} array={groups} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial 
                vertexShader={bigExplosionVertexShader} 
                fragmentShader={bigExplosionFragmentShader} 
                uniforms={{ uTime: { value: 0 } }}
                transparent 
                depthWrite={false} 
                blending={THREE.AdditiveBlending} 
            />
        </points>
    );
};

// --- BURST SHADERS ---
const burstVertexShader = `
uniform float uTime;
attribute float aSpeed;
attribute vec3 aDirection;
varying float vAlpha;
void main() {
    vec3 pos = position + aDirection * (uTime * 12.0 * aSpeed); 
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float size = (15.0 / -mvPosition.z) * max(0.0, (1.0 - uTime * 0.8)); 
    gl_PointSize = size;
    vAlpha = 1.0 - smoothstep(0.0, 1.0, uTime); 
}
`;
const burstFragmentShader = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = 1.0 - (d * 2.0);
    glow = pow(glow, 3.0);
    gl_FragColor = vec4(uColor, vAlpha * glow);
}
`;
const CollisionBurst: React.FC<{ color: string }> = ({ color }) => {
    const ref = useRef<THREE.Points>(null);
    const count = 400;
    const { positions, directions, speeds } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const dir = new Float32Array(count * 3);
        const spd = new Float32Array(count);
        for(let i=0; i<count; i++) {
            pos[i*3] = 0; pos[i*3+1] = 0; pos[i*3+2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            dir[i*3] = Math.sin(phi) * Math.cos(theta);
            dir[i*3+1] = Math.sin(phi) * Math.sin(theta);
            dir[i*3+2] = Math.cos(phi);
            spd[i] = Math.random() * 0.5 + 0.5;
        }
        return { positions: pos, directions: dir, speeds: spd };
    }, []);
    useFrame((state, delta) => {
        if(ref.current) {
            (ref.current.material as THREE.ShaderMaterial).uniforms.uTime.value += delta * 1.5;
        }
    });
    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-aDirection" count={count} array={directions} itemSize={3} />
                <bufferAttribute attach="attributes-aSpeed" count={count} array={speeds} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial vertexShader={burstVertexShader} fragmentShader={burstFragmentShader} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{ uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }} />
        </points>
    )
}

// --- PIN INDICATOR ---
const PinIndicator: React.FC = () => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.06;
    ringRef.current.scale.setScalar(pulse);
  });

  return (
    <>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.92, 0.03, 12, 72]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.95} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.08, 0.012, 8, 72]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
      </mesh>
      <Html position={[0, 1.45, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="font-['Orbitron'] text-[9px] font-bold tracking-[0.3em] text-cyan-300"
          style={{ textShadow: '0 0 8px rgba(0,255,255,0.9)' }}>
          LOCKED
        </div>
      </Html>
    </>
  );
};

const MergeLockCore: React.FC<{
  leftColor: string;
  rightColor: string;
  strengthRef: React.MutableRefObject<number>;
}> = ({ leftColor, rightColor, strengthRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const shellMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const mixedColor = useMemo(
    () => new THREE.Color(leftColor).lerp(new THREE.Color(rightColor), 0.5),
    [leftColor, rightColor]
  );

  useFrame((state) => {
    const strength = strengthRef.current;
    if (groupRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6.5) * 0.05;
      const scale = THREE.MathUtils.lerp(0.84, 1.18, strength) * pulse;
      groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.16);
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += 0.01 * (0.2 + strength * 0.8);
    }
    if (shellRef.current) {
      shellRef.current.rotation.z += 0.012 * (0.2 + strength * 0.8);
      shellRef.current.rotation.x += 0.008 * (0.2 + strength * 0.8);
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.y -= 0.015 * (0.2 + strength * 0.8);
      innerRingRef.current.rotation.z += 0.008 * (0.2 + strength * 0.8);
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = THREE.MathUtils.lerp(coreMaterialRef.current.opacity, strength * 0.92, 0.16);
      coreMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(coreMaterialRef.current.emissiveIntensity, 0.25 + strength * 1.35, 0.16);
      coreMaterialRef.current.color.lerp(mixedColor, 0.16);
      coreMaterialRef.current.emissive.lerp(mixedColor, 0.16);
    }
    if (shellMaterialRef.current) {
      shellMaterialRef.current.opacity = THREE.MathUtils.lerp(shellMaterialRef.current.opacity, strength * 0.42, 0.16);
      shellMaterialRef.current.color.lerp(mixedColor, 0.16);
    }
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = THREE.MathUtils.lerp(ringMaterialRef.current.opacity, strength * 0.78, 0.16);
      ringMaterialRef.current.color.lerp(mixedColor, 0.16);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.46, 28, 28]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color={mixedColor}
          emissive={mixedColor}
          emissiveIntensity={0.25}
          roughness={0.18}
          metalness={0.12}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh ref={shellRef}>
        <torusGeometry args={[0.74, 0.024, 12, 96]} />
        <meshBasicMaterial ref={shellMaterialRef} color={mixedColor} transparent opacity={0} />
      </mesh>
      <mesh ref={innerRingRef}>
        <torusGeometry args={[0.58, 0.012, 8, 72]} />
        <meshBasicMaterial ref={ringMaterialRef} color="#ffffff" transparent opacity={0} />
      </mesh>
    </group>
  );
};

// --- SCENE CONTENT ---
const SceneContent: React.FC<SceneProps> = ({ leftElement, rightElement, combinedElement, trackingData, pinnedHand, pinnedPosRef, interactionCooldownUntilRef, onOverlapMerge, onOverlapChange }) => {
  const leftGroupRef = useRef<THREE.Group>(null);
  const rightGroupRef = useRef<THREE.Group>(null);
  const combinedGroupRef = useRef<THREE.Group>(null);
  const mergeCoreGroupRef = useRef<THREE.Group>(null);

  const leftPinchRef = useRef(0.0);
  const rightPinchRef = useRef(0.0);
  const combinedPinchRef = useRef(0.8);

  const [showBurst, setShowBurst] = useState(false);
  const [isSourceMergeLocked, setIsSourceMergeLocked] = useState(false);

  // Pre-smoothed hand positions — eliminates tracking jitter before 3D lerp
  const smoothedLeftPos = useRef(new THREE.Vector3(-4, 0, 0));
  const smoothedRightPos = useRef(new THREE.Vector3(4, 0, 0));

  // Combine animation state tracked in refs (no re-renders per frame)
  const combineProgressRef = useRef(0);
  const wasCombinedRef = useRef(false);
  const burstFiredRef = useRef(false);

  // Overlap-based auto-merge refs
  const overlapTimerRef = useRef(0);
  const mergeFiredRef = useRef(false);
  const overlapActiveRef = useRef(false);
  const mergeLockCenterRef = useRef<THREE.Vector3 | null>(null);
  const mergeLockTimeoutRef = useRef(0);
  const mergeLockVisualRef = useRef(false);
  const mergeVisualStrengthRef = useRef(0);
  const activePinnedHandRef = useRef<'left' | 'right' | null>(null);
  const pinnedWorldPosRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!combinedElement) {
      setShowBurst(false);
      setIsSourceMergeLocked(false);
      burstFiredRef.current = false;
      overlapTimerRef.current = 0;
      mergeFiredRef.current = false;
      overlapActiveRef.current = false;
      mergeLockCenterRef.current = null;
      mergeLockTimeoutRef.current = 0;
      mergeLockVisualRef.current = false;
      mergeVisualStrengthRef.current = 0;
    }
    // Burst timing is driven from useFrame to sync precisely with the collapse
  }, [combinedElement]);

  useFrame((_state, delta) => {
    const data = trackingData.current;
    const isCombined = combinedElement !== null;
    const isFullSystemDesign = (combinedElement?.level ?? 0) >= 3;
    const interactionsPaused = Date.now() < interactionCooldownUntilRef.current;

    // Detect new combine event and reset progress
    if (isCombined && !wasCombinedRef.current) {
      const leftPos = leftGroupRef.current?.position.clone();
      const rightPos = rightGroupRef.current?.position.clone();
      const combineCenter = isFullSystemDesign
        ? SCENE_ORIGIN.clone()
        : mergeLockCenterRef.current?.clone()
        ?? (leftPos && rightPos
          ? leftPos.lerp(rightPos, 0.5)
          : leftPos
            ?? rightPos
            ?? SCENE_ORIGIN.clone());

      mergeLockCenterRef.current = combineCenter.clone();
      combineProgressRef.current = 0;
      burstFiredRef.current = false;

      // Spawn the merged result exactly where the two source nodes met so it
      // does not flash at a stale/default position before settling.
      if (combinedGroupRef.current) {
        combinedGroupRef.current.position.copy(combineCenter);
        combinedGroupRef.current.scale.setScalar(0);
      }
    }
    wasCombinedRef.current = isCombined;

    // Advance combine animation progress (0 → 1 over ~450ms)
    if (isCombined) {
      combineProgressRef.current = Math.min(1, combineProgressRef.current + delta * 2.2);
    } else {
      combineProgressRef.current = 0;
    }
    const prog = combineProgressRef.current;

    // Fire collision burst once hands have fully met (~100ms into collapse)
    if (isCombined && prog > 0.22 && !burstFiredRef.current && combinedElement?.symbol !== 'BOOM') {
      burstFiredRef.current = true;
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1000);
    }

    const mapX = (x: number) => (x - 0.5) * 18;
    const mapY = (y: number) => -(y - 0.5) * 10;
    const unmapX = (x: number) => THREE.MathUtils.clamp(x / 18 + 0.5, 0, 1);
    const unmapY = (y: number) => THREE.MathUtils.clamp(-y / 10 + 0.5, 0, 1);

    // When a pin is created, freeze it at the element's current rendered position
    // rather than the raw tracked hand position. That prevents a post-lock drift
    // if the user immediately takes their hand off-screen.
    if (pinnedHand !== activePinnedHandRef.current) {
      activePinnedHandRef.current = pinnedHand;

      if (!pinnedHand) {
        pinnedWorldPosRef.current = null;
      } else {
        const pinnedGroup = pinnedHand === 'left' ? leftGroupRef.current : rightGroupRef.current;
        const fallbackPinnedPos = pinnedPosRef.current
          ? new THREE.Vector3(mapX(pinnedPosRef.current.x), mapY(pinnedPosRef.current.y), 0)
          : null;
        const lockedWorldPos = pinnedGroup?.position.clone() ?? fallbackPinnedPos;

        pinnedWorldPosRef.current = lockedWorldPos;

        if (lockedWorldPos) {
          pinnedPosRef.current = {
            x: unmapX(lockedWorldPos.x),
            y: unmapY(lockedWorldPos.y),
          };
        }
      }
    }

    // Compute free 3D targets; overlap-lock can later override these to a shared midpoint.
    const pinnedPos = pinnedPosRef.current;
    const pinnedWorldPos = pinnedWorldPosRef.current;
    const trackedLeft = new THREE.Vector3(mapX(data.left.position.x), mapY(data.left.position.y), 0);
    const trackedRight = new THREE.Vector3(mapX(data.right.position.x), mapY(data.right.position.y), 0);
    const freeLeft = pinnedHand === 'left' && pinnedPos
      ? (pinnedWorldPos?.clone() ?? new THREE.Vector3(mapX(pinnedPos.x), mapY(pinnedPos.y), 0))
      : trackedLeft;
    const freeRight = pinnedHand === 'right' && pinnedPos
      ? (pinnedWorldPos?.clone() ?? new THREE.Vector3(mapX(pinnedPos.x), mapY(pinnedPos.y), 0))
      : trackedRight;

    // Predict the next free positions so the overlap test matches the visible motion on screen.
    const predictedLeft = smoothedLeftPos.current.clone().lerp(freeLeft, 0.2);
    const predictedRight = smoothedRightPos.current.clone().lerp(freeRight, 0.2);

    // --- OVERLAP AUTO-MERGE + CENTER LOCK ---
    if (!isCombined && !interactionsPaused) {
      const currentLockCenter = mergeLockCenterRef.current;
      const isOverlapping = Boolean(currentLockCenter) || predictedLeft.distanceTo(predictedRight) < OVERLAP_THRESHOLD;

      // Notify App only when overlap state changes (not every frame)
      if (isOverlapping !== overlapActiveRef.current) {
        overlapActiveRef.current = isOverlapping;
        onOverlapChange?.(isOverlapping);
      }

      if (isOverlapping) {
        if (!currentLockCenter) {
          const visibleLeft = leftGroupRef.current?.position.clone() ?? predictedLeft;
          const visibleRight = rightGroupRef.current?.position.clone() ?? predictedRight;
          mergeLockCenterRef.current = visibleLeft.lerp(visibleRight, 0.5);
          mergeLockTimeoutRef.current = 0;
        }

        overlapTimerRef.current = Math.min(OVERLAP_HOLD, overlapTimerRef.current + delta);

        if (overlapTimerRef.current >= OVERLAP_HOLD && !mergeFiredRef.current) {
          mergeFiredRef.current = true;
          mergeLockTimeoutRef.current = 0;
          onOverlapMerge?.();
        }

        if (mergeFiredRef.current) {
          mergeLockTimeoutRef.current += delta;

          // Failed merges leave combinedElement as null, so release the visual lock but
          // keep mergeFiredRef set until the user separates the components again.
          if (mergeLockTimeoutRef.current >= MERGE_LOCK_TIMEOUT) {
            mergeLockCenterRef.current = null;
          }
        }
      } else {
        overlapTimerRef.current = 0;
        mergeFiredRef.current = false;
        mergeLockTimeoutRef.current = 0;
        mergeLockCenterRef.current = null;
      }
    } else if (interactionsPaused) {
      if (overlapActiveRef.current) {
        overlapActiveRef.current = false;
        onOverlapChange?.(false);
      }
      overlapTimerRef.current = 0;
      mergeFiredRef.current = false;
      mergeLockTimeoutRef.current = 0;
      mergeLockCenterRef.current = null;
    }

    const mergeCenter = mergeLockCenterRef.current;
    const isMergeLocked = Boolean(mergeCenter);
    const combinedDisplayCenter = isFullSystemDesign
      ? SCENE_ORIGIN
      : (mergeCenter ?? SCENE_ORIGIN);
    const mergeVisualTarget = isCombined
      ? 1 - THREE.MathUtils.smoothstep(prog, 0.35, 1.0)
      : (isMergeLocked ? 1 : 0);
    mergeVisualStrengthRef.current = THREE.MathUtils.lerp(
      mergeVisualStrengthRef.current,
      mergeVisualTarget,
      isCombined ? 0.16 : 0.14
    );
    if (isMergeLocked !== mergeLockVisualRef.current) {
      mergeLockVisualRef.current = isMergeLocked;
      setIsSourceMergeLocked(isMergeLocked);
    }
    leftPinchRef.current = isCombined || isMergeLocked ? 0 : data.left.pinchDistance;
    rightPinchRef.current = isCombined || isMergeLocked ? 0 : data.right.pinchDistance;
    const rawLeft = isCombined
      ? combinedDisplayCenter.clone()
      : (mergeCenter?.clone() ?? freeLeft);
    const rawRight = isCombined
      ? combinedDisplayCenter.clone()
      : (mergeCenter?.clone() ?? freeRight);
    const targetSmoothing = isCombined ? 0.15 : 0.2;
    const positionSmoothing = isCombined ? 0.18 : 0.18;

    if (mergeCenter) {
      // Once overlap lock engages, both sources share one authoritative center.
      // Copying directly avoids the "almost merged" jitter that comes from easing
      // two separate animated groups toward the same target.
      smoothedLeftPos.current.copy(mergeCenter);
      smoothedRightPos.current.copy(mergeCenter);
    } else {
      // First-pass smoothing on the target itself removes frame-to-frame tracking jitter.
      smoothedLeftPos.current.lerp(rawLeft, targetSmoothing);
      smoothedRightPos.current.lerp(rawRight, targetSmoothing);
    }

    if (leftGroupRef.current) {
      if (mergeCenter) {
        leftGroupRef.current.position.copy(mergeCenter);
      } else {
        leftGroupRef.current.position.lerp(smoothedLeftPos.current, positionSmoothing);
      }
      // Freeze source spin while lock is active so the center reads as one fused core.
      if (!mergeCenter && !isCombined) {
        leftGroupRef.current.rotation.y += 0.008;
        leftGroupRef.current.rotation.z += 0.002;
      }
      // Smooth scale-out during collapse; instant restore when reset
      leftGroupRef.current.scale.setScalar(
        isCombined ? 1 - THREE.MathUtils.smoothstep(prog, 0, 0.4) : 1
      );
    }

    if (rightGroupRef.current) {
      if (mergeCenter) {
        rightGroupRef.current.position.copy(mergeCenter);
      } else {
        rightGroupRef.current.position.lerp(smoothedRightPos.current, positionSmoothing);
      }
      if (!mergeCenter && !isCombined) {
        rightGroupRef.current.rotation.y -= 0.008;
        rightGroupRef.current.rotation.z -= 0.002;
      }
      rightGroupRef.current.scale.setScalar(
        isCombined ? 1 - THREE.MathUtils.smoothstep(prog, 0, 0.4) : 1
      );
    }

    if (mergeCoreGroupRef.current) {
      const mergeCoreVisible = mergeVisualStrengthRef.current > 0.02;
      mergeCoreGroupRef.current.visible = mergeCoreVisible;
      mergeCoreGroupRef.current.position.copy(combinedDisplayCenter);
      mergeCoreGroupRef.current.scale.setScalar(mergeCoreVisible ? 1 : 0.0001);
    }

    if (combinedGroupRef.current) {
      combinedGroupRef.current.position.lerp(combinedDisplayCenter, isCombined ? 0.24 : 0.12);
      // BOOM appears instantly; everything else scales in after hands collapse
      const combinedScale = !isCombined
        ? 0
        : combinedElement?.symbol === 'BOOM'
          ? 1
          : THREE.MathUtils.smoothstep(prog, 0.3, 1.0);
      combinedGroupRef.current.scale.setScalar(combinedScale);
    }
  });

  const renderElement = (element: ElementData, scaleRef: React.MutableRefObject<number>, opacity: number, isActive: boolean) => {
    if (element.symbol === 'WEBAPP') {
        return <WebAppComponent scaleRef={scaleRef} opacityTarget={opacity} mergeLockRef={mergeVisualStrengthRef} />;
    }

    if (element.symbol === 'EDGE') {
        return <EdgeComponent scaleRef={scaleRef} opacityTarget={opacity} mergeLockRef={mergeVisualStrengthRef} />;
    }

    if (element.symbol === 'ROUTE') {
        return <RouteComponent scaleRef={scaleRef} opacityTarget={opacity} mergeLockRef={mergeVisualStrengthRef} />;
    }

    return (
        <ParticleSphere 
            element={element} 
            scaleRef={scaleRef}
            opacityTarget={opacity}
            isActive={isActive}
            mergeLockRef={mergeVisualStrengthRef}
        />
    );
  };

  const renderCombined = () => {
    if (!combinedElement) return null;
    
    if (combinedElement.symbol === 'BOOM') return <BigExplosion />;

    if (combinedElement.symbol === 'WEBAPP') {
        return <WebAppComponent scaleRef={combinedPinchRef} opacityTarget={1} mergeLockRef={mergeVisualStrengthRef} />;
    }

    if (combinedElement.symbol === 'EDGE') {
        return <EdgeComponent scaleRef={combinedPinchRef} opacityTarget={1} mergeLockRef={mergeVisualStrengthRef} />;
    }

    if (combinedElement.symbol === 'ROUTE') {
        return <RouteComponent scaleRef={combinedPinchRef} opacityTarget={1} mergeLockRef={mergeVisualStrengthRef} />;
    }

    return (
        <ParticleSphere
            element={combinedElement}
            scaleRef={combinedPinchRef}
            opacityTarget={1}
            isActive={true}
            mergeLockRef={mergeVisualStrengthRef}
        />
    );
  };

  const sourceOpacity = isSourceMergeLocked && !combinedElement ? 0.82 : 1;
  const showSourceLabels = !combinedElement && !isSourceMergeLocked;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 0, 10]} intensity={1.5} color="#ffffff" />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00ffff" />
      
      {showBurst && <CollisionBurst color={combinedElement ? combinedElement.color : '#ffffff'} />}

      <group ref={mergeCoreGroupRef} visible={false}>
        <MergeLockCore
          leftColor={leftElement.color}
          rightColor={rightElement.color}
          strengthRef={mergeVisualStrengthRef}
        />
      </group>

      <group ref={leftGroupRef}>
         {renderElement(leftElement, leftPinchRef, sourceOpacity, !combinedElement)}
         {showSourceLabels && <AtomLabel element={leftElement} position={[0, -1.2, 0]} />}
         {showSourceLabels && pinnedHand === 'left' && <PinIndicator />}
      </group>

      <group ref={rightGroupRef}>
         {renderElement(rightElement, rightPinchRef, sourceOpacity, !combinedElement)}
         {showSourceLabels && <AtomLabel element={rightElement} position={[0, -1.2, 0]} />}
         {showSourceLabels && pinnedHand === 'right' && <PinIndicator />}
      </group>

      <group ref={combinedGroupRef}>
        {renderCombined()}
        {combinedElement && combinedElement.symbol !== 'BOOM' && <AtomLabel element={combinedElement} position={[0, -2.5, 0]} />}
      </group>
    </>
  );
};

const Scene: React.FC<SceneProps> = (props) => (
  <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
    <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={55} />
    <SceneContent {...props} />
    <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
  </Canvas>
);

export default Scene;
