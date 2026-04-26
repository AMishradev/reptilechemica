
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { PerspectiveCamera } from '@react-three/drei/core/PerspectiveCamera.js';
import { Html } from '@react-three/drei/web/Html.js';
import ParticleSphere from './ParticleSphere';
import AtomLabel from './AtomLabel';
import { ElementData, TrackingData, SpotifyBuildState } from '../types';
import { COMBINATIONS, ELEMENTS } from '../constants';
import * as THREE from 'three';

interface SceneProps {
  leftElement: ElementData;
  rightElement: ElementData;
  combinedElement: ElementData | null;
  trackingData: React.MutableRefObject<TrackingData>;
  spotifyBuild?: SpotifyBuildState | null;
}

const getComponentData = (symbol: string) => {
  return ELEMENTS.find(component => component.symbol === symbol)
    ?? COMBINATIONS.find(combination => combination.result.symbol === symbol)?.result
    ?? {
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
}> = ({ component, position, opacity, pulseOffset = 0 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime + pulseOffset;
    if (groupRef.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.04;
      groupRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.015;
      ringRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial
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
        <meshBasicMaterial color={component.color} transparent opacity={opacity * 0.75} />
      </mesh>
      <Html position={[0, -0.78, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center font-mono text-center">
          <div
            className="text-sm font-semibold tracking-normal"
            style={{
              color: '#ffffff',
              textShadow: `0 0 10px ${component.color}`,
              opacity,
            }}
          >
            {component.symbol}
          </div>
          <div className="text-[8px] tracking-normal text-cyan-100/70 whitespace-nowrap">
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
}> = ({ scaleRef, opacityTarget }) => {
  const groupRef = useRef<THREE.Group>(null);
  const api = getComponentData('API');
  const lb = getComponentData('LB');

  useFrame(() => {
    if (!groupRef.current) return;
    const targetScale = 1 + scaleRef.current * 0.45;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y += 0.002;
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

      <ComponentNode component={api} position={[-1.8, 0, 0]} opacity={opacityTarget} pulseOffset={0} />
      <ComponentNode component={lb} position={[1.8, 0, 0]} opacity={opacityTarget} pulseOffset={0.8} />

      <Html position={[0, 1.05, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Space_Grotesk'] text-sm font-semibold tracking-normal text-cyan-100"
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
}> = ({ scaleRef, opacityTarget }) => {
  const groupRef = useRef<THREE.Group>(null);
  const client = getComponentData('CLIENT');
  const dns = getComponentData('DNS');

  useFrame((state) => {
    if (!groupRef.current) return;
    const targetScale = 1 + scaleRef.current * 0.45;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18;
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

      <ComponentNode component={client} position={[0, -1.65, 0]} opacity={opacityTarget} pulseOffset={0.1} />
      <ComponentNode component={dns} position={[0, 1.65, 0]} opacity={opacityTarget} pulseOffset={0.9} />

      <Html position={[1.35, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Space_Grotesk'] text-sm font-semibold tracking-normal text-cyan-100"
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
}> = ({ scaleRef, opacityTarget }) => {
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
    const targetScale = 0.95 + scaleRef.current * 0.35;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.28) * 0.12;
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

      <ComponentNode component={client} position={clientPos} opacity={opacityTarget} pulseOffset={0} />
      <ComponentNode component={dns} position={dnsPos} opacity={opacityTarget} pulseOffset={0.45} />
      <ComponentNode component={api} position={apiPos} opacity={opacityTarget} pulseOffset={0.9} />
      <ComponentNode component={lb} position={lbPos} opacity={opacityTarget} pulseOffset={1.35} />

      <Html position={[-2.95, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="font-mono text-[9px] tracking-normal text-cyan-100/70" style={{ opacity: opacityTarget }}>
          Edge Entry
        </div>
      </Html>
      <Html position={[1.42, 1.25, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="font-mono text-[9px] tracking-normal text-emerald-100/70" style={{ opacity: opacityTarget }}>
          Routed Backend
        </div>
      </Html>
      <Html position={[0, -1.75, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Space_Grotesk'] text-base font-semibold tracking-normal text-white"
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

type DiagramPosition = [number, number, number];
type DiagramRotation = [number, number, number];

interface DiagramNodeConfig {
  symbol: string;
  position: DiagramPosition;
  pulseOffset?: number;
}

interface DiagramBeamConfig {
  start: DiagramPosition;
  end: DiagramPosition;
  color: string;
  opacity?: number;
  radius?: number;
}

interface DiagramFlowConfig {
  path: DiagramPosition[];
  offset: number;
  color?: string;
  opacity?: number;
  speed?: number;
  kind?: 'sphere' | 'octa' | 'box';
  size?: number;
}

interface DiagramBoxConfig {
  position: DiagramPosition;
  size: DiagramPosition;
  color: string;
  opacity: number;
  rotation?: DiagramRotation;
}

interface DiagramRingConfig {
  position: DiagramPosition;
  radius: number;
  color: string;
  opacity: number;
  rotation?: DiagramRotation;
  spin?: DiagramPosition;
}

interface DiagramTextConfig {
  text: string;
  position: DiagramPosition;
  color?: string;
  vertical?: boolean;
}

interface VisualPreset {
  title: string;
  color: string;
  scale?: number;
  tilt?: number;
  nodes: DiagramNodeConfig[];
  beams?: DiagramBeamConfig[];
  flows?: DiagramFlowConfig[];
  boxes?: DiagramBoxConfig[];
  rings?: DiagramRingConfig[];
  labels?: DiagramTextConfig[];
}

const pos = (x: number, y: number, z = 0): DiagramPosition => [x, y, z];

const DiagramRing: React.FC<{ ring: DiagramRingConfig; opacityTarget: number }> = ({ ring, opacityTarget }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ringRef.current || !ring.spin) return;
    ringRef.current.rotation.x += ring.spin[0];
    ringRef.current.rotation.y += ring.spin[1];
    ringRef.current.rotation.z += ring.spin[2];
  });

  return (
    <mesh ref={ringRef} position={ring.position} rotation={ring.rotation ?? [0, 0, 0]}>
      <torusGeometry args={[ring.radius, 0.015, 12, 96]} />
      <meshBasicMaterial color={ring.color} transparent opacity={ring.opacity * opacityTarget} />
    </mesh>
  );
};

const FlowPacket: React.FC<DiagramFlowConfig & { opacityTarget: number }> = ({
  path,
  offset,
  color = '#ffffff',
  opacity = 1,
  speed = 0.32,
  kind = 'sphere',
  size = 0.08,
  opacityTarget,
}) => {
  const packetRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!packetRef.current || path.length < 2) return;
    const cycle = (state.clock.elapsedTime * speed + offset) % 1;
    const scaled = cycle * (path.length - 1);
    const segment = Math.min(path.length - 2, Math.floor(scaled));
    const localT = scaled - segment;
    const start = new THREE.Vector3(...path[segment]);
    const end = new THREE.Vector3(...path[segment + 1]);
    const packetPosition = start.lerp(end, localT);
    packetPosition.z += 0.09;
    packetPosition.y += Math.sin(localT * Math.PI) * 0.08;
    packetRef.current.position.copy(packetPosition);
    packetRef.current.scale.setScalar(0.75 + Math.sin(cycle * Math.PI * 2) * 0.18);
  });

  return (
    <mesh ref={packetRef}>
      {kind === 'octa' ? (
        <octahedronGeometry args={[size, 0]} />
      ) : kind === 'box' ? (
        <boxGeometry args={[size * 1.4, size * 1.4, size * 1.4]} />
      ) : (
        <sphereGeometry args={[size, 16, 16]} />
      )}
      <meshBasicMaterial color={color} transparent opacity={opacity * opacityTarget} />
    </mesh>
  );
};

const DiagramLabel: React.FC<{ label: DiagramTextConfig; opacityTarget: number }> = ({ label, opacityTarget }) => (
  <Html position={label.position} center style={{ pointerEvents: 'none' }}>
    <div
      className="font-mono text-[9px] tracking-normal text-center whitespace-nowrap"
      style={{
        color: label.color ?? '#cffafe',
        opacity: opacityTarget,
        textShadow: `0 0 12px ${label.color ?? 'rgba(103, 232, 249, 0.8)'}`,
        writingMode: label.vertical ? 'vertical-rl' : 'horizontal-tb',
      }}
    >
      {label.text}
    </div>
  </Html>
);

const PresetDiagram: React.FC<{
  preset: VisualPreset;
  scaleRef: React.MutableRefObject<number>;
  opacityTarget: number;
}> = ({ preset, scaleRef, opacityTarget }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const baseScale = preset.scale ?? 0.95;
    const targetScale = baseScale + scaleRef.current * 0.28;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * (preset.tilt ?? 0.1);
  });

  return (
    <group ref={groupRef}>
      {preset.boxes?.map((box, index) => (
        <mesh key={`box-${index}`} position={box.position} rotation={box.rotation ?? [0, 0, 0]}>
          <boxGeometry args={box.size} />
          <meshBasicMaterial color={box.color} transparent opacity={box.opacity * opacityTarget} />
        </mesh>
      ))}

      {preset.rings?.map((ring, index) => (
        <DiagramRing key={`ring-${index}`} ring={ring} opacityTarget={opacityTarget} />
      ))}

      {preset.beams?.map((beam, index) => (
        <ConnectionBeam
          key={`beam-${index}`}
          start={beam.start}
          end={beam.end}
          color={beam.color}
          opacity={(beam.opacity ?? 0.65) * opacityTarget}
          radius={beam.radius ?? 0.022}
        />
      ))}

      {preset.flows?.map((flow, index) => (
        <FlowPacket key={`flow-${index}`} {...flow} opacityTarget={opacityTarget} />
      ))}

      {preset.nodes.map((node, index) => (
        <ComponentNode
          key={`${node.symbol}-${index}`}
          component={getComponentData(node.symbol)}
          position={node.position}
          opacity={opacityTarget}
          pulseOffset={node.pulseOffset ?? index * 0.35}
        />
      ))}

      {preset.labels?.map((label, index) => (
        <DiagramLabel key={`label-${index}`} label={label} opacityTarget={opacityTarget} />
      ))}

      <Html position={[0, 1.95, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="font-['Space_Grotesk'] text-base font-semibold tracking-normal text-white text-center whitespace-nowrap"
          style={{
            opacity: opacityTarget,
            textShadow: `0 0 16px ${preset.color}`,
          }}
        >
          {preset.title}
        </div>
      </Html>
    </group>
  );
};

const VISUAL_PRESETS: Record<string, VisualPreset> = {
  MEDIA: {
    title: 'MEDIA',
    color: '#c084fc',
    nodes: [
      { symbol: 'OBJ', position: pos(-1.65, -0.35), pulseOffset: 0 },
      { symbol: 'CDN', position: pos(0.6, 0.35), pulseOffset: 0.5 },
      { symbol: 'MEDIA', position: pos(1.95, -0.45), pulseOffset: 1 },
    ],
    beams: [
      { start: pos(-1.65, -0.35), end: pos(0.6, 0.35), color: '#c084fc', opacity: 0.55 },
      { start: pos(0.6, 0.35), end: pos(1.95, -0.45), color: '#22d3ee', opacity: 0.6 },
    ],
    flows: [
      { path: [pos(-1.65, -0.35), pos(0.6, 0.35), pos(1.95, -0.45)], offset: 0, color: '#f0abfc', speed: 0.28, kind: 'box' },
      { path: [pos(-1.65, -0.35), pos(0.6, 0.35), pos(1.95, -0.45)], offset: 0.42, color: '#67e8f9', speed: 0.28, kind: 'box' },
    ],
    boxes: [
      { position: pos(2.35, 0.35, -0.04), size: pos(0.42, 0.28, 0.04), color: '#67e8f9', opacity: 0.28 },
      { position: pos(2.55, -0.1, -0.04), size: pos(0.38, 0.38, 0.04), color: '#c084fc', opacity: 0.25 },
      { position: pos(2.18, -0.9, -0.04), size: pos(0.5, 0.32, 0.04), color: '#f0abfc', opacity: 0.22 },
    ],
    labels: [{ text: 'object assets to edge cache', position: pos(0, -1.35), color: '#e9d5ff' }],
  },
  POOL: {
    title: 'POOL',
    color: '#34d399',
    nodes: [
      { symbol: 'LB', position: pos(-1.9, 0), pulseOffset: 0 },
      { symbol: 'APP', position: pos(0.8, 1), pulseOffset: 0.35 },
      { symbol: 'APP', position: pos(1.85, 0), pulseOffset: 0.7 },
      { symbol: 'APP', position: pos(0.8, -1), pulseOffset: 1.05 },
    ],
    beams: [
      { start: pos(-1.9, 0), end: pos(0.8, 1), color: '#34d399', opacity: 0.52 },
      { start: pos(-1.9, 0), end: pos(1.85, 0), color: '#34d399', opacity: 0.65 },
      { start: pos(-1.9, 0), end: pos(0.8, -1), color: '#34d399', opacity: 0.52 },
    ],
    flows: [
      { path: [pos(-1.9, 0), pos(0.8, 1)], offset: 0, color: '#bbf7d0', speed: 0.34 },
      { path: [pos(-1.9, 0), pos(1.85, 0)], offset: 0.3, color: '#ffffff', speed: 0.34 },
      { path: [pos(-1.9, 0), pos(0.8, -1)], offset: 0.6, color: '#bbf7d0', speed: 0.34 },
    ],
    rings: [{ position: pos(1.1, 0), radius: 1.35, color: '#34d399', opacity: 0.22, spin: pos(0, 0, 0.006) }],
    labels: [{ text: 'balanced replicas', position: pos(0, -1.55), color: '#bbf7d0' }],
  },
  SVC: {
    title: 'SVC',
    color: '#f472b6',
    nodes: [
      { symbol: 'API', position: pos(-1.55, 0), pulseOffset: 0 },
      { symbol: 'APP', position: pos(1.35, 0), pulseOffset: 0.55 },
    ],
    beams: [{ start: pos(-1.55, 0), end: pos(1.35, 0), color: '#f472b6', opacity: 0.72 }],
    flows: [
      { path: [pos(-1.55, 0), pos(1.35, 0)], offset: 0, color: '#fbcfe8', speed: 0.36 },
      { path: [pos(1.35, -0.18), pos(-1.55, -0.18)], offset: 0.5, color: '#ffffff', speed: 0.22, size: 0.055 },
    ],
    boxes: [{ position: pos(0, 0, -0.06), size: pos(3.65, 1.45, 0.04), color: '#831843', opacity: 0.16 }],
    labels: [{ text: 'service boundary', position: pos(0, -1.1), color: '#fbcfe8' }],
  },
  CRUD: {
    title: 'CRUD',
    color: '#f97316',
    nodes: [
      { symbol: 'APP', position: pos(-1.5, 0), pulseOffset: 0 },
      { symbol: 'DB', position: pos(1.45, 0), pulseOffset: 0.65 },
    ],
    beams: [
      { start: pos(-1.5, 0.16), end: pos(1.45, 0.16), color: '#fb923c', opacity: 0.64 },
      { start: pos(1.45, -0.16), end: pos(-1.5, -0.16), color: '#fde68a', opacity: 0.46 },
    ],
    flows: [
      { path: [pos(-1.5, 0.16), pos(1.45, 0.16)], offset: 0, color: '#fb923c', speed: 0.28 },
      { path: [pos(1.45, -0.16), pos(-1.5, -0.16)], offset: 0.45, color: '#fde68a', speed: 0.22, size: 0.055 },
    ],
    rings: [{ position: pos(1.45, 0), radius: 0.92, color: '#fb923c', opacity: 0.22, rotation: pos(Math.PI / 2, 0, 0), spin: pos(0, 0.006, 0) }],
    labels: [
      { text: 'write', position: pos(0, 0.48), color: '#fed7aa' },
      { text: 'read', position: pos(0, -0.55), color: '#fef3c7' },
    ],
  },
  FAST: {
    title: 'FAST',
    color: '#4ade80',
    nodes: [
      { symbol: 'APP', position: pos(-1.35, 0), pulseOffset: 0 },
      { symbol: 'CACHE', position: pos(1.25, 0), pulseOffset: 0.45 },
    ],
    beams: [
      { start: pos(-1.35, 0), end: pos(1.25, 0), color: '#4ade80', opacity: 0.78 },
      { start: pos(1.25, -0.26), end: pos(-1.35, -0.26), color: '#bbf7d0', opacity: 0.38 },
    ],
    flows: [
      { path: [pos(-1.35, 0), pos(1.25, 0), pos(-1.35, -0.26)], offset: 0, color: '#bbf7d0', speed: 0.52, size: 0.07 },
      { path: [pos(-1.35, 0), pos(1.25, 0), pos(-1.35, -0.26)], offset: 0.25, color: '#ffffff', speed: 0.52, size: 0.055 },
      { path: [pos(-1.35, 0), pos(1.25, 0), pos(-1.35, -0.26)], offset: 0.5, color: '#86efac', speed: 0.52, size: 0.055 },
    ],
    rings: [
      { position: pos(1.25, 0), radius: 0.88, color: '#4ade80', opacity: 0.34, spin: pos(0, 0.005, 0.008) },
      { position: pos(1.25, 0), radius: 1.12, color: '#bbf7d0', opacity: 0.18, rotation: pos(Math.PI / 2, 0, 0), spin: pos(0.006, 0, 0) },
    ],
    labels: [{ text: 'hot path', position: pos(0, -1.15), color: '#bbf7d0' }],
  },
  ASYNC: {
    title: 'ASYNC',
    color: '#60a5fa',
    nodes: [
      { symbol: 'APP', position: pos(-1.65, 0.72), pulseOffset: 0 },
      { symbol: 'QUEUE', position: pos(0.35, 0), pulseOffset: 0.4 },
      { symbol: 'ASYNC', position: pos(1.75, -0.75), pulseOffset: 0.85 },
    ],
    beams: [
      { start: pos(-1.65, 0.72), end: pos(0.35, 0), color: '#60a5fa', opacity: 0.58 },
      { start: pos(0.35, 0), end: pos(1.75, -0.75), color: '#93c5fd', opacity: 0.38, radius: 0.016 },
    ],
    flows: [
      { path: [pos(-1.65, 0.72), pos(0.35, 0)], offset: 0, color: '#bfdbfe', speed: 0.24, kind: 'box' },
      { path: [pos(0.35, 0), pos(1.75, -0.75)], offset: 0.55, color: '#60a5fa', speed: 0.16, kind: 'box' },
    ],
    boxes: [
      { position: pos(0.35, 0.42, -0.04), size: pos(0.95, 0.12, 0.05), color: '#60a5fa', opacity: 0.26 },
      { position: pos(0.35, 0.15, -0.04), size: pos(0.95, 0.12, 0.05), color: '#60a5fa', opacity: 0.22 },
      { position: pos(0.35, -0.12, -0.04), size: pos(0.95, 0.12, 0.05), color: '#60a5fa', opacity: 0.18 },
    ],
    labels: [{ text: 'decoupled work', position: pos(0, -1.45), color: '#bfdbfe' }],
  },
  READ: {
    title: 'READ',
    color: '#a3e635',
    nodes: [
      { symbol: 'DB', position: pos(-1.45, -0.35), pulseOffset: 0 },
      { symbol: 'CACHE', position: pos(1.15, 0.38), pulseOffset: 0.5 },
      { symbol: 'READ', position: pos(2.15, -0.65), pulseOffset: 0.9 },
    ],
    beams: [
      { start: pos(-1.45, -0.35), end: pos(1.15, 0.38), color: '#a3e635', opacity: 0.48 },
      { start: pos(1.15, 0.38), end: pos(2.15, -0.65), color: '#bef264', opacity: 0.68 },
    ],
    flows: [
      { path: [pos(-1.45, -0.35), pos(1.15, 0.38)], offset: 0.2, color: '#d9f99d', speed: 0.14, size: 0.055 },
      { path: [pos(1.15, 0.38), pos(2.15, -0.65)], offset: 0, color: '#ffffff', speed: 0.42 },
      { path: [pos(1.15, 0.38), pos(2.15, -0.65)], offset: 0.35, color: '#bef264', speed: 0.42 },
    ],
    rings: [{ position: pos(1.15, 0.38), radius: 0.95, color: '#a3e635', opacity: 0.26, spin: pos(0, 0, 0.008) }],
    labels: [{ text: 'cache first reads', position: pos(0, -1.35), color: '#d9f99d' }],
  },
  JOBDB: {
    title: 'JOBDB',
    color: '#818cf8',
    nodes: [
      { symbol: 'QUEUE', position: pos(-1.45, 0), pulseOffset: 0 },
      { symbol: 'DB', position: pos(1.45, 0), pulseOffset: 0.6 },
    ],
    beams: [{ start: pos(-1.45, 0), end: pos(1.45, 0), color: '#818cf8', opacity: 0.64 }],
    flows: [
      { path: [pos(-1.45, 0), pos(1.45, 0)], offset: 0, color: '#c7d2fe', speed: 0.23, kind: 'box' },
      { path: [pos(-1.45, 0), pos(1.45, 0)], offset: 0.2, color: '#ffffff', speed: 0.23, kind: 'box', size: 0.06 },
      { path: [pos(-1.45, 0), pos(1.45, 0)], offset: 0.4, color: '#a5b4fc', speed: 0.23, kind: 'box', size: 0.06 },
    ],
    boxes: [
      { position: pos(-1.45, 0.55, -0.04), size: pos(1.1, 0.12, 0.05), color: '#818cf8', opacity: 0.24 },
      { position: pos(-1.45, 0.32, -0.04), size: pos(1.1, 0.12, 0.05), color: '#818cf8', opacity: 0.2 },
      { position: pos(-1.45, -0.55, -0.04), size: pos(1.1, 0.12, 0.05), color: '#818cf8', opacity: 0.18 },
    ],
    labels: [{ text: 'durable job state', position: pos(0, -1.25), color: '#c7d2fe' }],
  },
  BFF: {
    title: 'BFF',
    color: '#06b6d4',
    nodes: [
      { symbol: 'CDN', position: pos(-1.85, 0.85), pulseOffset: 0 },
      { symbol: 'API', position: pos(-1.85, -0.85), pulseOffset: 0.45 },
      { symbol: 'BFF', position: pos(0.35, 0), pulseOffset: 0.9 },
      { symbol: 'CLIENT', position: pos(2.15, 0), pulseOffset: 1.2 },
    ],
    beams: [
      { start: pos(-1.85, 0.85), end: pos(0.35, 0), color: '#22d3ee', opacity: 0.58 },
      { start: pos(-1.85, -0.85), end: pos(0.35, 0), color: '#f472b6', opacity: 0.58 },
      { start: pos(0.35, 0), end: pos(2.15, 0), color: '#06b6d4', opacity: 0.68 },
    ],
    flows: [
      { path: [pos(-1.85, 0.85), pos(0.35, 0), pos(2.15, 0)], offset: 0, color: '#67e8f9', speed: 0.3 },
      { path: [pos(-1.85, -0.85), pos(0.35, 0), pos(2.15, 0)], offset: 0.45, color: '#fbcfe8', speed: 0.26 },
    ],
    boxes: [{ position: pos(0.35, 0, -0.05), size: pos(1.35, 1.35, 0.05), color: '#083344', opacity: 0.22 }],
    labels: [{ text: 'asset + api facade', position: pos(0, -1.45), color: '#a5f3fc' }],
  },
  STATIC: {
    title: 'STATIC',
    color: '#67e8f9',
    nodes: [
      { symbol: 'CLIENT', position: pos(-1.75, 0), pulseOffset: 0 },
      { symbol: 'CDN', position: pos(0.25, 0.35), pulseOffset: 0.5 },
      { symbol: 'STATIC', position: pos(1.8, -0.45), pulseOffset: 0.9 },
    ],
    beams: [
      { start: pos(-1.75, 0), end: pos(0.25, 0.35), color: '#38bdf8', opacity: 0.56 },
      { start: pos(0.25, 0.35), end: pos(1.8, -0.45), color: '#67e8f9', opacity: 0.68 },
    ],
    flows: [
      { path: [pos(-1.75, 0), pos(0.25, 0.35), pos(1.8, -0.45)], offset: 0, color: '#ffffff', speed: 0.34, kind: 'box' },
      { path: [pos(0.25, 0.35), pos(1.8, -0.45)], offset: 0.42, color: '#67e8f9', speed: 0.38, kind: 'box' },
    ],
    boxes: [
      { position: pos(2.25, 0.28, -0.04), size: pos(0.42, 0.3, 0.04), color: '#e0f2fe', opacity: 0.28 },
      { position: pos(2.45, -0.18, -0.04), size: pos(0.34, 0.42, 0.04), color: '#67e8f9', opacity: 0.22 },
    ],
    labels: [{ text: 'static assets at edge', position: pos(0, -1.35), color: '#cffafe' }],
  },
  APIAPP: {
    title: 'APIAPP',
    color: '#fb7185',
    scale: 0.9,
    nodes: [
      { symbol: 'API', position: pos(-2.05, 0.6), pulseOffset: 0 },
      { symbol: 'APP', position: pos(0, 0), pulseOffset: 0.45 },
      { symbol: 'DB', position: pos(2.05, -0.6), pulseOffset: 0.9 },
    ],
    beams: [
      { start: pos(-2.05, 0.6), end: pos(0, 0), color: '#fb7185', opacity: 0.64 },
      { start: pos(0, 0), end: pos(2.05, -0.6), color: '#fb923c', opacity: 0.6 },
      { start: pos(2.05, -0.78), end: pos(0, -0.18), color: '#fed7aa', opacity: 0.34, radius: 0.014 },
    ],
    flows: [
      { path: [pos(-2.05, 0.6), pos(0, 0), pos(2.05, -0.6)], offset: 0, color: '#fecdd3', speed: 0.25 },
      { path: [pos(2.05, -0.78), pos(0, -0.18), pos(-2.05, 0.42)], offset: 0.52, color: '#ffffff', speed: 0.2, size: 0.055 },
    ],
    boxes: [{ position: pos(0, 0, -0.08), size: pos(4.75, 1.75, 0.05), color: '#4c0519', opacity: 0.15 }],
    labels: [{ text: 'api surface + durable service', position: pos(0, -1.45), color: '#fecdd3' }],
  },
  SCALE: {
    title: 'SCALE',
    color: '#22c55e',
    scale: 0.9,
    nodes: [
      { symbol: 'APP', position: pos(-0.45, 0), pulseOffset: 0 },
      { symbol: 'CACHE', position: pos(1.55, 0.9), pulseOffset: 0.45 },
      { symbol: 'QUEUE', position: pos(1.55, -0.9), pulseOffset: 0.9 },
      { symbol: 'SCALE', position: pos(-2.1, 0), pulseOffset: 1.25 },
    ],
    beams: [
      { start: pos(-2.1, 0), end: pos(-0.45, 0), color: '#22c55e', opacity: 0.62 },
      { start: pos(-0.45, 0), end: pos(1.55, 0.9), color: '#4ade80', opacity: 0.62 },
      { start: pos(-0.45, 0), end: pos(1.55, -0.9), color: '#60a5fa', opacity: 0.55 },
    ],
    flows: [
      { path: [pos(-2.1, 0), pos(-0.45, 0), pos(1.55, 0.9), pos(-0.45, 0)], offset: 0, color: '#bbf7d0', speed: 0.42 },
      { path: [pos(-0.45, 0), pos(1.55, -0.9)], offset: 0.35, color: '#bfdbfe', speed: 0.2, kind: 'box' },
      { path: [pos(-0.45, 0), pos(1.55, -0.9)], offset: 0.62, color: '#60a5fa', speed: 0.2, kind: 'box', size: 0.06 },
    ],
    rings: [
      { position: pos(1.55, 0.9), radius: 0.82, color: '#4ade80', opacity: 0.28, spin: pos(0, 0, 0.01) },
      { position: pos(-0.45, 0), radius: 1.5, color: '#22c55e', opacity: 0.14, rotation: pos(0, Math.PI / 2, 0), spin: pos(0, 0.004, 0) },
    ],
    labels: [{ text: 'fast reads + async load', position: pos(0, -1.65), color: '#bbf7d0' }],
  },
  CONTENT: {
    title: 'CONTENT',
    color: '#a78bfa',
    scale: 0.88,
    nodes: [
      { symbol: 'CLIENT', position: pos(-2.25, 0.55), pulseOffset: 0 },
      { symbol: 'CDN', position: pos(-0.45, 0.45), pulseOffset: 0.35 },
      { symbol: 'OBJ', position: pos(-0.45, -1), pulseOffset: 0.7 },
      { symbol: 'CONTENT', position: pos(1.75, -0.05), pulseOffset: 1.05 },
    ],
    beams: [
      { start: pos(-2.25, 0.55), end: pos(-0.45, 0.45), color: '#67e8f9', opacity: 0.62 },
      { start: pos(-0.45, -1), end: pos(-0.45, 0.45), color: '#c084fc', opacity: 0.48 },
      { start: pos(-0.45, 0.45), end: pos(1.75, -0.05), color: '#a78bfa', opacity: 0.64 },
    ],
    flows: [
      { path: [pos(-0.45, -1), pos(-0.45, 0.45), pos(1.75, -0.05)], offset: 0, color: '#e9d5ff', speed: 0.22, kind: 'box' },
      { path: [pos(-2.25, 0.55), pos(-0.45, 0.45), pos(1.75, -0.05)], offset: 0.42, color: '#67e8f9', speed: 0.3, kind: 'box' },
    ],
    boxes: [
      { position: pos(2.25, 0.65, -0.04), size: pos(0.5, 0.34, 0.04), color: '#e9d5ff', opacity: 0.24 },
      { position: pos(2.5, 0.05, -0.04), size: pos(0.34, 0.44, 0.04), color: '#67e8f9', opacity: 0.22 },
      { position: pos(2.1, -0.7, -0.04), size: pos(0.58, 0.3, 0.04), color: '#c084fc', opacity: 0.2 },
    ],
    labels: [{ text: 'frontend + media delivery', position: pos(0, -1.65), color: '#e9d5ff' }],
  },
  DATA: {
    title: 'DATA',
    color: '#f59e0b',
    scale: 0.9,
    nodes: [
      { symbol: 'APP', position: pos(-1.95, 0), pulseOffset: 0 },
      { symbol: 'DB', position: pos(0.45, -0.35), pulseOffset: 0.45 },
      { symbol: 'CACHE', position: pos(1.95, 0.72), pulseOffset: 0.9 },
    ],
    beams: [
      { start: pos(-1.95, 0), end: pos(0.45, -0.35), color: '#fb923c', opacity: 0.62 },
      { start: pos(0.45, -0.35), end: pos(1.95, 0.72), color: '#a3e635', opacity: 0.52 },
      { start: pos(1.95, 0.72), end: pos(-1.95, 0.18), color: '#fde68a', opacity: 0.34, radius: 0.014 },
    ],
    flows: [
      { path: [pos(-1.95, 0), pos(0.45, -0.35)], offset: 0, color: '#fed7aa', speed: 0.25 },
      { path: [pos(0.45, -0.35), pos(1.95, 0.72), pos(-1.95, 0.18)], offset: 0.45, color: '#d9f99d', speed: 0.22 },
    ],
    rings: [
      { position: pos(0.45, -0.35), radius: 0.88, color: '#fb923c', opacity: 0.18, rotation: pos(Math.PI / 2, 0, 0), spin: pos(0, 0.005, 0) },
      { position: pos(1.95, 0.72), radius: 0.82, color: '#a3e635', opacity: 0.22, spin: pos(0, 0, 0.009) },
    ],
    labels: [{ text: 'writes + optimized reads', position: pos(0, -1.55), color: '#fde68a' }],
  },
  WORKER: {
    title: 'WORKER',
    color: '#818cf8',
    scale: 0.9,
    nodes: [
      { symbol: 'QUEUE', position: pos(-1.95, 0.55), pulseOffset: 0 },
      { symbol: 'WORKER', position: pos(0, 0), pulseOffset: 0.45 },
      { symbol: 'DB', position: pos(1.95, -0.55), pulseOffset: 0.9 },
    ],
    beams: [
      { start: pos(-1.95, 0.55), end: pos(0, 0), color: '#818cf8', opacity: 0.66 },
      { start: pos(0, 0), end: pos(1.95, -0.55), color: '#a5b4fc', opacity: 0.58 },
      { start: pos(1.95, -0.8), end: pos(-1.95, 0.3), color: '#c7d2fe', opacity: 0.2, radius: 0.012 },
    ],
    flows: [
      { path: [pos(-1.95, 0.55), pos(0, 0), pos(1.95, -0.55)], offset: 0, color: '#ffffff', speed: 0.24, kind: 'box' },
      { path: [pos(-1.95, 0.55), pos(0, 0), pos(1.95, -0.55)], offset: 0.28, color: '#c7d2fe', speed: 0.24, kind: 'box', size: 0.06 },
      { path: [pos(1.95, -0.8), pos(0, -0.45), pos(-1.95, 0.3)], offset: 0.62, color: '#818cf8', speed: 0.12, size: 0.05 },
    ],
    boxes: [{ position: pos(0, 0, -0.05), size: pos(1.15, 1.15, 0.05), color: '#312e81', opacity: 0.2 }],
    labels: [{ text: 'retryable background work', position: pos(0, -1.55), color: '#c7d2fe' }],
  },
};

const SPOTIFY_NODE_POSITIONS: Record<string, DiagramPosition> = {
  CLIENT: pos(-3.15, 0.95),
  DNS: pos(-3.15, 1.95),
  CDN: pos(-1.65, 1.35),
  OBJ: pos(-0.05, 1.95),
  API: pos(-1.55, -0.15),
  LB: pos(-0.1, -0.15),
  APP: pos(1.35, -0.15),
  DB: pos(2.95, -1.15),
  CACHE: pos(2.95, 0.95),
  QUEUE: pos(1.35, -1.65),
};

const SPOTIFY_BLUEPRINT_NODE_SYMBOLS = ['CLIENT', 'DNS', 'CDN', 'OBJ', 'API', 'LB', 'APP', 'DB', 'CACHE', 'QUEUE'];

const SPOTIFY_SEGMENTS: Array<{
  symbol: string;
  nodes: string[];
  beams: DiagramBeamConfig[];
  flows?: DiagramFlowConfig[];
}> = [
  {
    symbol: 'EDGE',
    nodes: ['CLIENT', 'DNS'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.CLIENT, end: SPOTIFY_NODE_POSITIONS.DNS, color: '#38bdf8', opacity: 0.52 }],
  },
  {
    symbol: 'STATIC',
    nodes: ['CLIENT', 'CDN'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.CLIENT, end: SPOTIFY_NODE_POSITIONS.CDN, color: '#67e8f9', opacity: 0.62 }],
  },
  {
    symbol: 'MEDIA',
    nodes: ['CDN', 'OBJ'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.OBJ, end: SPOTIFY_NODE_POSITIONS.CDN, color: '#c084fc', opacity: 0.58 }],
  },
  {
    symbol: 'CONTENT',
    nodes: ['CLIENT', 'CDN', 'OBJ'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.CDN, end: SPOTIFY_NODE_POSITIONS.CLIENT, color: '#a78bfa', opacity: 0.36, radius: 0.014 }],
  },
  {
    symbol: 'ROUTE',
    nodes: ['API', 'LB'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.API, end: SPOTIFY_NODE_POSITIONS.LB, color: '#2dd4bf', opacity: 0.7 }],
  },
  {
    symbol: 'SVC',
    nodes: ['API', 'APP'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.LB, end: SPOTIFY_NODE_POSITIONS.APP, color: '#f472b6', opacity: 0.66 }],
  },
  {
    symbol: 'CRUD',
    nodes: ['APP', 'DB'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.DB, color: '#fb923c', opacity: 0.62 }],
  },
  {
    symbol: 'FAST',
    nodes: ['APP', 'CACHE'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.CACHE, color: '#4ade80', opacity: 0.62 }],
  },
  {
    symbol: 'ASYNC',
    nodes: ['APP', 'QUEUE'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.QUEUE, color: '#60a5fa', opacity: 0.58 }],
  },
  {
    symbol: 'SCALE',
    nodes: ['APP', 'CACHE', 'QUEUE'],
    beams: [
      { start: SPOTIFY_NODE_POSITIONS.CACHE, end: SPOTIFY_NODE_POSITIONS.APP, color: '#bbf7d0', opacity: 0.34, radius: 0.012 },
      { start: SPOTIFY_NODE_POSITIONS.QUEUE, end: SPOTIFY_NODE_POSITIONS.APP, color: '#bfdbfe', opacity: 0.28, radius: 0.012 },
    ],
  },
  {
    symbol: 'READ',
    nodes: ['DB', 'CACHE'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.DB, end: SPOTIFY_NODE_POSITIONS.CACHE, color: '#a3e635', opacity: 0.28, radius: 0.012 }],
  },
  {
    symbol: 'JOBDB',
    nodes: ['QUEUE', 'DB'],
    beams: [{ start: SPOTIFY_NODE_POSITIONS.QUEUE, end: SPOTIFY_NODE_POSITIONS.DB, color: '#818cf8', opacity: 0.28, radius: 0.012 }],
  },
];

const SPOTIFY_BLUEPRINT_BEAMS: DiagramBeamConfig[] = [
  { start: SPOTIFY_NODE_POSITIONS.CLIENT, end: SPOTIFY_NODE_POSITIONS.DNS, color: '#38bdf8' },
  { start: SPOTIFY_NODE_POSITIONS.CLIENT, end: SPOTIFY_NODE_POSITIONS.CDN, color: '#67e8f9' },
  { start: SPOTIFY_NODE_POSITIONS.OBJ, end: SPOTIFY_NODE_POSITIONS.CDN, color: '#c084fc' },
  { start: SPOTIFY_NODE_POSITIONS.API, end: SPOTIFY_NODE_POSITIONS.LB, color: '#2dd4bf' },
  { start: SPOTIFY_NODE_POSITIONS.LB, end: SPOTIFY_NODE_POSITIONS.APP, color: '#f472b6' },
  { start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.DB, color: '#fb923c' },
  { start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.CACHE, color: '#4ade80' },
  { start: SPOTIFY_NODE_POSITIONS.APP, end: SPOTIFY_NODE_POSITIONS.QUEUE, color: '#60a5fa' },
];

const SpotifySystemVisual: React.FC<{
  build: SpotifyBuildState;
  opacityTarget: number;
}> = ({ build, opacityTarget }) => {
  const groupRef = useRef<THREE.Group>(null);
  const builtSet = useMemo(() => new Set(build.builtSymbols), [build.builtSymbols]);
  const activeSegments = SPOTIFY_SEGMENTS.filter(segment => builtSet.has(segment.symbol));
  const activeNodeSet = new Set(activeSegments.flatMap(segment => segment.nodes));
  const isEmpty = build.builtSymbols.length === 0;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.06;
    const targetScale = 0.84 + Math.min(build.builtSymbols.length, 8) * 0.012;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
  });

  return (
    <group ref={groupRef} position={[0, 0.02, -0.6]}>
      <mesh position={[0, 0.1, -0.16]}>
        <boxGeometry args={[7.35, 4.7, 0.035]} />
        <meshBasicMaterial color="#03151f" transparent opacity={0.24 * opacityTarget} />
      </mesh>
      <mesh position={[-1.65, 1.42, -0.13]}>
        <boxGeometry args={[3.65, 1.55, 0.035]} />
        <meshBasicMaterial color="#0e7490" transparent opacity={0.12 * opacityTarget} />
      </mesh>
      <mesh position={[0.15, -0.28, -0.13]}>
        <boxGeometry args={[3.3, 1.4, 0.035]} />
        <meshBasicMaterial color="#312e81" transparent opacity={0.1 * opacityTarget} />
      </mesh>
      <mesh position={[2.45, -0.1, -0.13]}>
        <boxGeometry args={[1.75, 3.05, 0.035]} />
        <meshBasicMaterial color="#14532d" transparent opacity={0.08 * opacityTarget} />
      </mesh>

      {builtSet.has('SCALE') && (
        <>
          <DiagramRing ring={{ position: SPOTIFY_NODE_POSITIONS.APP, radius: 1.75, color: '#22c55e', opacity: 0.18, rotation: pos(0, Math.PI / 2, 0), spin: pos(0, 0.004, 0) }} opacityTarget={opacityTarget} />
          <DiagramRing ring={{ position: SPOTIFY_NODE_POSITIONS.CACHE, radius: 0.84, color: '#4ade80', opacity: 0.24, spin: pos(0, 0, 0.008) }} opacityTarget={opacityTarget} />
        </>
      )}

      {SPOTIFY_BLUEPRINT_BEAMS.map((beam, index) => (
        <ConnectionBeam
          key={`spotify-blueprint-beam-${index}`}
          start={beam.start}
          end={beam.end}
          color={beam.color}
          opacity={0.11 * opacityTarget}
          radius={0.011}
        />
      ))}

      {activeSegments.flatMap(segment => segment.beams).map((beam, index) => (
        <ConnectionBeam
          key={`spotify-beam-${index}`}
          start={beam.start}
          end={beam.end}
          color={beam.color}
          opacity={(beam.opacity ?? 0.58) * opacityTarget}
          radius={beam.radius ?? 0.018}
        />
      ))}

      {activeSegments.map((segment, index) => (
        <FlowPacket
          key={`spotify-flow-${segment.symbol}`}
          path={segment.beams[0] ? [segment.beams[0].start, segment.beams[0].end] : []}
          offset={(index * 0.21) % 1}
          color={segment.beams[0]?.color ?? '#ffffff'}
          speed={0.22 + (index % 3) * 0.04}
          kind={segment.symbol === 'ASYNC' || segment.symbol === 'MEDIA' ? 'box' : 'sphere'}
          size={0.06}
          opacityTarget={opacityTarget}
        />
      ))}

      {SPOTIFY_BLUEPRINT_NODE_SYMBOLS.map((symbol, index) => (
        <ComponentNode
          key={`spotify-node-${symbol}`}
          component={getComponentData(symbol)}
          position={SPOTIFY_NODE_POSITIONS[symbol]}
          opacity={(activeNodeSet.has(symbol) ? 1 : 0.28) * opacityTarget}
          pulseOffset={index * 0.25}
        />
      ))}

      <DiagramLabel
        label={{
          text: isEmpty ? 'Blueprint waiting for assembled paths' : `${build.builtSymbols.length} pieces assembled`,
          position: pos(0, -2.55),
          color: isEmpty ? '#93c5fd' : '#bbf7d0',
        }}
        opacityTarget={opacityTarget}
      />

    </group>
  );
};

const SystemVisual: React.FC<{
  symbol: string;
  scaleRef: React.MutableRefObject<number>;
  opacityTarget: number;
}> = ({ symbol, scaleRef, opacityTarget }) => {
  const preset = VISUAL_PRESETS[symbol];
  if (!preset) return null;
  return <PresetDiagram preset={preset} scaleRef={scaleRef} opacityTarget={opacityTarget} />;
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

// --- SCENE CONTENT ---
const SceneContent: React.FC<SceneProps> = ({ leftElement, rightElement, combinedElement, trackingData, spotifyBuild }) => {
  const leftGroupRef = useRef<THREE.Group>(null);
  const rightGroupRef = useRef<THREE.Group>(null);
  const combinedGroupRef = useRef<THREE.Group>(null);
  
  const leftPinchRef = useRef(0.0);
  const rightPinchRef = useRef(0.0);
  const combinedPinchRef = useRef(0.8);

  const [opacities, setOpacities] = useState({ left: 1, right: 1, combined: 0 });
  const [showBurst, setShowBurst] = useState(false);

  const lastLeftPos = useRef({ x: 0, y: 0 });
  const lastRightPos = useRef({ x: 0, y: 0 });
  const leftRotationSpeed = useRef(0.005);
  const rightRotationSpeed = useRef(0.005);

  useEffect(() => {
    if (combinedElement) {
        setOpacities({ left: 0, right: 0, combined: 1 });
        // Only show simple burst if not a huge explosion
        if (combinedElement.symbol !== 'BOOM') {
            setShowBurst(true);
            const t = setTimeout(() => setShowBurst(false), 1000);
            return () => clearTimeout(t);
        }
    } else {
        setOpacities({ left: 1, right: 1, combined: 0 });
        setShowBurst(false);
    }
  }, [combinedElement]);

  useFrame((state) => {
    const data = trackingData.current;
    leftPinchRef.current = combinedElement ? 0 : data.left.pinchDistance;
    rightPinchRef.current = combinedElement ? 0 : data.right.pinchDistance;
    const mapX = (x: number) => (x - 0.5) * 18; 
    const mapY = (y: number) => -(y - 0.5) * 10;

    if (leftGroupRef.current) {
        let targetPos = new THREE.Vector3(0,0,0);
        if (combinedElement) targetPos.set(0, 0, 0);
        else targetPos.set(mapX(data.left.position.x), mapY(data.left.position.y), 0);
        leftGroupRef.current.position.lerp(targetPos, 0.12);
        const dx = data.left.position.x - lastLeftPos.current.x;
        if (!combinedElement) {
           leftRotationSpeed.current = THREE.MathUtils.lerp(leftRotationSpeed.current, 0.005 + (dx * 1.5), 0.1);
        }
        leftGroupRef.current.rotation.y += leftRotationSpeed.current;
        leftGroupRef.current.rotation.z += 0.002;
        lastLeftPos.current = { x: data.left.position.x, y: data.left.position.y };
    }

    if (rightGroupRef.current) {
        let targetPos = new THREE.Vector3(0,0,0);
        if (combinedElement) targetPos.set(0, 0, 0);
        else targetPos.set(mapX(data.right.position.x), mapY(data.right.position.y), 0);
        rightGroupRef.current.position.lerp(targetPos, 0.12);
        const dx = data.right.position.x - lastRightPos.current.x;
        if (!combinedElement) {
            rightRotationSpeed.current = THREE.MathUtils.lerp(rightRotationSpeed.current, -0.005 + (dx * 1.5), 0.1);
        }
        rightGroupRef.current.rotation.y += rightRotationSpeed.current;
        rightGroupRef.current.rotation.z -= 0.002;
        lastRightPos.current = { x: data.right.position.x, y: data.right.position.y };
    }
  });

  const renderElement = (element: ElementData, scaleRef: React.MutableRefObject<number>, opacity: number, isActive: boolean) => {
    if (element.symbol === 'WEBAPP') {
        return <WebAppComponent scaleRef={scaleRef} opacityTarget={opacity} />;
    }

    if (element.symbol === 'EDGE') {
        return <EdgeComponent scaleRef={scaleRef} opacityTarget={opacity} />;
    }

    if (element.symbol === 'ROUTE') {
        return <RouteComponent scaleRef={scaleRef} opacityTarget={opacity} />;
    }

    if (VISUAL_PRESETS[element.symbol]) {
        return <SystemVisual symbol={element.symbol} scaleRef={scaleRef} opacityTarget={opacity} />;
    }

    return (
        <ParticleSphere 
            element={element} 
            scaleRef={scaleRef}
            opacityTarget={opacity}
            isActive={isActive}
        />
    );
  };

  const renderCombined = () => {
    if (!combinedElement) return null;
    
    if (combinedElement.symbol === 'BOOM') return <BigExplosion />;

    if (combinedElement.symbol === 'WEBAPP') {
        return <WebAppComponent scaleRef={combinedPinchRef} opacityTarget={opacities.combined} />;
    }

    if (combinedElement.symbol === 'EDGE') {
        return <EdgeComponent scaleRef={combinedPinchRef} opacityTarget={opacities.combined} />;
    }

    if (combinedElement.symbol === 'ROUTE') {
        return <RouteComponent scaleRef={combinedPinchRef} opacityTarget={opacities.combined} />;
    }

    if (VISUAL_PRESETS[combinedElement.symbol]) {
        return <SystemVisual symbol={combinedElement.symbol} scaleRef={combinedPinchRef} opacityTarget={opacities.combined} />;
    }

    return (
        <ParticleSphere 
            element={combinedElement} 
            scaleRef={combinedPinchRef}
            opacityTarget={opacities.combined}
            isActive={true}
        />
    );
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 0, 10]} intensity={1.5} color="#ffffff" />
	      <pointLight position={[10, 10, 10]} intensity={1.5} />
	      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00ffff" />

	      {spotifyBuild?.active && (
	        <SpotifySystemVisual
	          build={spotifyBuild}
	          opacityTarget={combinedElement ? 0.28 : 0.92}
	        />
	      )}

	      {showBurst && <CollisionBurst color={combinedElement ? combinedElement.color : '#ffffff'} />}

      <group ref={leftGroupRef}>
         {renderElement(leftElement, leftPinchRef, opacities.left, !combinedElement)}
         {!combinedElement && <AtomLabel element={leftElement} position={[0, -1.2, 0]} />}
      </group>

      <group ref={rightGroupRef}>
         {renderElement(rightElement, rightPinchRef, opacities.right, !combinedElement)}
         {!combinedElement && <AtomLabel element={rightElement} position={[0, -1.2, 0]} />}
      </group>

      <group ref={combinedGroupRef}>
        {renderCombined()}
        {combinedElement && combinedElement.symbol !== 'BOOM' && <AtomLabel element={combinedElement} position={[0, -2.5, 0]} />}
      </group>
    </>
  );
};

const Scene: React.FC<SceneProps> = (props) => {
  return (
    <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={55} />
      <SceneContent {...props} />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
    </Canvas>
  );
};

export default Scene;
