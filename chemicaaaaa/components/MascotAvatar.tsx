import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei/core/Float.js';
import { Cylinder, Sphere } from '@react-three/drei/core/shapes.js';
import * as THREE from 'three';
import { TrackingData } from '../types';

export type MascotMood = 'idle' | 'thinking' | 'success' | 'alert';

interface MascotModelProps {
  trackingData: React.MutableRefObject<TrackingData>;
  mood: MascotMood;
}

// Compact lab assistant bot used in the guide and dashboard panels.
const MascotModel: React.FC<MascotModelProps> = ({ trackingData, mood }) => {
  const headGroupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const eyeGroupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const antennaLightRef = useRef<THREE.Mesh>(null);
  const baseRingRef = useRef<THREE.Mesh>(null);
  const visorRimRef = useRef<THREE.Mesh>(null);
  const chestLightRef = useRef<THREE.Mesh>(null);
  const accentColor = mood === 'alert' ? '#ffbf4d' : mood === 'success' ? '#61ffb8' : '#38f3ff';
  const softAccentColor = mood === 'alert' ? '#ffdc8a' : mood === 'success' ? '#b8ffd8' : '#c8fbff';
  const antennaColor = mood === 'alert' ? '#ffc247' : mood === 'success' ? '#62ffbd' : '#4dffff';
  const antennaEmissive = mood === 'alert' ? '#ff9f1c' : mood === 'success' ? '#20e58d' : '#22d3ee';

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const data = trackingData.current;
    const leftPresent = !!(data.left.isPresent || data.left.isDetected);
    const rightPresent = !!(data.right.isPresent || data.right.isDetected);
    let targetX = 0.82 + Math.sin(elapsed * 0.45) * 0.025;
    let targetY = 0.78 + Math.cos(elapsed * 0.35) * 0.02;

    if (leftPresent && rightPresent) {
      targetX = (data.left.position.x + data.right.position.x) / 2;
      targetY = (data.left.position.y + data.right.position.y) / 2;
    } else if (leftPresent) {
      targetX = data.left.position.x;
      targetY = data.left.position.y;
    } else if (rightPresent) {
      targetX = data.right.position.x;
      targetY = data.right.position.y;
    }

    if (headGroupRef.current) {
      const AVATAR_SCREEN_X = 0.9;
      const AVATAR_SCREEN_Y = 0.9;
      const worldX = (targetX - AVATAR_SCREEN_X) * 6;
      const worldY = -(targetY - AVATAR_SCREEN_Y) * 6;
      const worldZ = 3;
      const targetVec = new THREE.Vector3(worldX, worldY, worldZ);

      const currentRotation = headGroupRef.current.rotation.clone();
      headGroupRef.current.lookAt(targetVec);
      const targetRotation = headGroupRef.current.rotation.clone();

      targetRotation.x = Math.max(-0.14, Math.min(0.42, targetRotation.x));
      targetRotation.y = Math.max(-0.38, Math.min(0.38, targetRotation.y));
      headGroupRef.current.rotation.copy(currentRotation);
      headGroupRef.current.rotation.x += (targetRotation.x - headGroupRef.current.rotation.x) * 0.1;
      headGroupRef.current.rotation.y += (targetRotation.y - headGroupRef.current.rotation.y) * 0.1;
      headGroupRef.current.rotation.z += (targetRotation.z - headGroupRef.current.rotation.z) * 0.1;
    }

    if (bodyGroupRef.current) {
      bodyGroupRef.current.position.y = Math.sin(elapsed * 1.25) * 0.035;
      bodyGroupRef.current.rotation.z = Math.sin(elapsed * 0.95) * 0.025;
    }

    if (eyeGroupRef.current) {
      eyeGroupRef.current.position.x +=
        (THREE.MathUtils.clamp((targetX - 0.82) * 0.42, -0.07, 0.07) - eyeGroupRef.current.position.x) * 0.12;
      eyeGroupRef.current.position.y +=
        (THREE.MathUtils.clamp((0.78 - targetY) * 0.34, -0.05, 0.05) - eyeGroupRef.current.position.y) * 0.12;
    }

    const blink = Math.sin(elapsed * 2.2) > 0.985 ? 0.18 : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y += (blink - leftEyeRef.current.scale.y) * 0.35;
    if (rightEyeRef.current) rightEyeRef.current.scale.y += (blink - rightEyeRef.current.scale.y) * 0.35;

    if (antennaLightRef.current) {
      const pulse = 1 + Math.sin(elapsed * 3.4) * 0.15;
      antennaLightRef.current.scale.setScalar(pulse);
    }

    if (baseRingRef.current) {
      const ringPulse = 1 + Math.sin(elapsed * (mood === 'success' ? 3 : 2.1)) * 0.035;
      baseRingRef.current.rotation.z = elapsed * 0.45;
      baseRingRef.current.scale.set(ringPulse, ringPulse, 1);
    }

    if (visorRimRef.current) {
      const rimPulse = 1 + Math.sin(elapsed * 3) * 0.025;
      visorRimRef.current.scale.set(rimPulse, rimPulse, 0.44);
    }

    if (chestLightRef.current) {
      chestLightRef.current.scale.y = 1 + Math.sin(elapsed * (mood === 'alert' ? 4.2 : 2.6)) * 0.08;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.08} floatIntensity={0.32}>
      <group scale={1.16} position={[0, -0.12, 0]}>
        <Cylinder args={[0.72, 0.88, 0.06, 48]} position={[0, -1.54, -0.1]} scale={[1, 1, 0.36]}>
          <meshBasicMaterial color="#031417" transparent opacity={0.34} />
        </Cylinder>
        <mesh ref={baseRingRef} position={[0, -1.36, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.012, 8, 80]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.66} toneMapped={false} />
        </mesh>
        <mesh position={[0, -1.36, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.006, 8, 64]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.38} toneMapped={false} />
        </mesh>

        <group ref={bodyGroupRef}>
          <Cylinder args={[0.45, 0.68, 0.74, 48]} position={[0, -1.02, 0]} scale={[1, 1, 0.6]}>
            <meshStandardMaterial
              color="#ffffff"
              roughness={0.2}
              metalness={0.08}
              emissive="#dffcff"
              emissiveIntensity={0.08}
            />
          </Cylinder>

          <Sphere args={[0.48, 32, 20]} position={[0, -0.72, 0]} scale={[1, 0.42, 0.6]}>
            <meshStandardMaterial
              color="#ffffff"
              roughness={0.18}
              metalness={0.06}
              emissive="#dffcff"
              emissiveIntensity={0.08}
            />
          </Sphere>

          <mesh ref={chestLightRef} position={[0, -0.98, 0.35]}>
            <boxGeometry args={[0.13, 0.48, 0.04]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <mesh position={[0, -1.21, 0.35]}>
            <boxGeometry args={[0.28, 0.04, 0.04]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.6} toneMapped={false} />
          </mesh>
          <mesh position={[-0.14, -0.78, 0.35]} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[0.04, 0.26, 0.035]} />
            <meshBasicMaterial color={softAccentColor} transparent opacity={0.72} toneMapped={false} />
          </mesh>
          <mesh position={[0.14, -0.78, 0.35]} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[0.04, 0.26, 0.035]} />
            <meshBasicMaterial color={softAccentColor} transparent opacity={0.72} toneMapped={false} />
          </mesh>

          <Sphere args={[0.12, 18, 16]} position={[-0.58, -1.08, 0.06]}>
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.06} emissive="#dffcff" emissiveIntensity={0.06} />
          </Sphere>
          <Sphere args={[0.12, 18, 16]} position={[0.58, -1.08, 0.06]}>
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.06} emissive="#dffcff" emissiveIntensity={0.06} />
          </Sphere>
        </group>

        <group ref={headGroupRef} position={[0, 0.12, 0]}>
          <Sphere args={[0.8, 56, 36]} scale={[0.96, 1.02, 0.84]}>
            <meshStandardMaterial
              color="#ffffff"
              roughness={0.16}
              metalness={0.08}
              emissive="#dffcff"
              emissiveIntensity={0.08}
            />
          </Sphere>

          <Sphere args={[0.82, 56, 36]} position={[0.06, -0.04, -0.05]} scale={[0.96, 1.02, 0.84]}>
            <meshBasicMaterial color="#8fb8bf" transparent opacity={0.07} />
          </Sphere>
          <Sphere args={[0.16, 24, 16]} position={[-0.72, 0.08, 0.08]} scale={[0.45, 0.9, 0.55]}>
            <meshStandardMaterial color="#ffffff" roughness={0.16} metalness={0.08} emissive="#dffcff" emissiveIntensity={0.06} />
          </Sphere>
          <Sphere args={[0.16, 24, 16]} position={[0.72, 0.08, 0.08]} scale={[0.45, 0.9, 0.55]}>
            <meshStandardMaterial color="#ffffff" roughness={0.16} metalness={0.08} emissive="#dffcff" emissiveIntensity={0.06} />
          </Sphere>

          <group position={[0, 0.08, 0.66]}>
            <mesh ref={visorRimRef} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.44]}>
              <capsuleGeometry args={[0.205, 0.62, 12, 32]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.54} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.025]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.42]}>
              <capsuleGeometry args={[0.18, 0.56, 12, 28]} />
              <meshStandardMaterial color="#050b0d" roughness={0.14} metalness={0.72} />
            </mesh>
            <mesh position={[0, -0.16, 0.12]}>
              <boxGeometry args={[0.34, 0.025, 0.025]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          </group>

          <group ref={eyeGroupRef} position={[0, 0.08, 0.84]}>
            {mood === 'success' ? (
              <>
                <mesh ref={leftEyeRef} position={[-0.2, 0.03, 0]} rotation={[0, 0, Math.PI]}>
                  <torusGeometry args={[0.065, 0.014, 8, 24, Math.PI]} />
                  <meshBasicMaterial color={accentColor} toneMapped={false} />
                </mesh>
                <mesh ref={rightEyeRef} position={[0.2, 0.03, 0]} rotation={[0, 0, Math.PI]}>
                  <torusGeometry args={[0.065, 0.014, 8, 24, Math.PI]} />
                  <meshBasicMaterial color={accentColor} toneMapped={false} />
                </mesh>
              </>
            ) : mood === 'thinking' ? (
              <>
                {[-0.18, 0, 0.18].map((x, index) => (
                  <mesh key={x} ref={index === 0 ? leftEyeRef : index === 2 ? rightEyeRef : undefined} position={[x, 0.02, 0]}>
                    <sphereGeometry args={[0.045 + index * 0.004, 18, 12]} />
                    <meshBasicMaterial color={accentColor} toneMapped={false} />
                  </mesh>
                ))}
              </>
            ) : (
              <>
                <mesh ref={leftEyeRef} position={[-0.2, 0.02, 0]}>
                  <sphereGeometry args={[0.08, 22, 16]} />
                  <meshBasicMaterial color={accentColor} toneMapped={false} />
                </mesh>
                <mesh ref={rightEyeRef} position={[0.2, 0.02, 0]}>
                  <sphereGeometry args={[0.08, 22, 16]} />
                  <meshBasicMaterial color={accentColor} toneMapped={false} />
                </mesh>
                <mesh position={[-0.18, 0.055, 0.055]}>
                  <sphereGeometry args={[0.024, 12, 8]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.9} toneMapped={false} />
                </mesh>
                <mesh position={[0.22, 0.055, 0.055]}>
                  <sphereGeometry args={[0.024, 12, 8]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.9} toneMapped={false} />
                </mesh>
              </>
            )}
          </group>
          <mesh position={[-0.34, -0.17, 0.74]}>
            <sphereGeometry args={[0.028, 12, 8]} />
            <meshBasicMaterial color={softAccentColor} transparent opacity={0.56} toneMapped={false} />
          </mesh>
          <mesh position={[0.34, -0.17, 0.74]}>
            <sphereGeometry args={[0.028, 12, 8]} />
            <meshBasicMaterial color={softAccentColor} transparent opacity={0.4} toneMapped={false} />
          </mesh>

          <Cylinder args={[0.032, 0.04, 0.32, 16]} position={[0, 0.9, 0]} rotation={[0.04, 0, 0.12]}>
            <meshStandardMaterial color="#f7fcff" metalness={0.32} roughness={0.18} />
          </Cylinder>
          <Sphere ref={antennaLightRef} args={[0.105, 24, 18]} position={[0.04, 1.08, 0.03]}>
            <meshStandardMaterial
              color={antennaColor}
              emissive={antennaEmissive}
              emissiveIntensity={2.4}
              toneMapped={false}
            />
          </Sphere>
          <mesh position={[0.04, 1.08, 0.03]}>
            <sphereGeometry args={[0.22, 24, 18]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.12} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </Float>
  );
};

interface MascotAvatarProps {
  trackingData: React.MutableRefObject<TrackingData>;
  mood?: MascotMood;
}

const MascotAvatar: React.FC<MascotAvatarProps> = ({ trackingData, mood = 'idle' }) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0.05, 4.2], fov: 42 }}
        dpr={[1.5, 2.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.92} />
        <pointLight position={[3, 4, 5]} intensity={1.35} color="#ffffff" />
        <pointLight position={[-3, -1, 2]} intensity={0.75} color="#22d3ee" />
        <pointLight position={[0, 1, 3]} intensity={0.7} color="#ffffff" />
        <MascotModel trackingData={trackingData} mood={mood} />
      </Canvas>
    </div>
  );
};

export default MascotAvatar;
