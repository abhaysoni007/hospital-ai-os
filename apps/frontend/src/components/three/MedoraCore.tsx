'use client';

import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ── Sub-component: Wireframe Icosahedron ──────────────────────────────────────
function IcosahedronCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useFrame(({ clock, pointer }) => {
    if (!meshRef.current) return;

    // Smooth mouse tracking
    mouseRef.current.x += (pointer.x * 0.3 - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (pointer.y * 0.2 - mouseRef.current.y) * 0.05;

    // Very slow cinematic breathing rotation
    meshRef.current.rotation.y = clock.elapsedTime * 0.04 + mouseRef.current.x * 0.15;
    meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.03) * 0.08 + mouseRef.current.y * 0.1;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1.8, 1]} />
      <meshBasicMaterial
        color="#3d7a5c"
        wireframe
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

// ── Sub-component: Inner Dodecahedron ─────────────────────────────────────────
function InnerGeometry() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = -clock.elapsedTime * 0.06 + pointer.x * 0.08;
    meshRef.current.rotation.x = clock.elapsedTime * 0.025 + pointer.y * 0.06;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <dodecahedronGeometry args={[1.1, 0]} />
      <meshBasicMaterial
        color="#6aaa85"
        wireframe
        transparent
        opacity={0.15}
      />
    </mesh>
  );
}

// ── Sub-component: Glass Planes ───────────────────────────────────────────────
function GlassPlane({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.04 + Math.sin(clock.elapsedTime * 0.5 + position[0]) * 0.02;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[2.4, 2.4]} />
      <meshBasicMaterial
        color="#1d4a35"
        transparent
        opacity={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Sub-component: Particle Field ─────────────────────────────────────────────
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 600;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const radius = 2.4 + Math.random() * 1.8;
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = clock.elapsedTime * 0.008;
    pointsRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.01) * 0.05;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        color="#6aaa85"
        size={0.012}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </Points>
  );
}

// ── Sub-component: Data Lines ─────────────────────────────────────────────────
function DataLines() {
  const linesRef = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const result = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const start = new THREE.Vector3(
        Math.cos(angle) * 1.9,
        Math.sin(angle * 0.5) * 0.4,
        Math.sin(angle) * 1.9
      );
      const end = new THREE.Vector3(
        Math.cos(angle + 0.8) * 2.8,
        Math.sin(angle * 0.7) * 0.8,
        Math.sin(angle + 0.8) * 2.8
      );
      result.push({ start, end, i });
    }
    return result;
  }, []);

  const lineObjects = useMemo(() => {
    return lines.map(({ start, end }) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const material = new THREE.LineBasicMaterial({
        color: '#3d7a5c',
        transparent: true,
        opacity: 0.3,
      });
      return new THREE.Line(geometry, material);
    });
  }, [lines]);

  useFrame(({ clock }) => {
    if (!linesRef.current) return;
    linesRef.current.rotation.y = clock.elapsedTime * 0.015;
  });

  return (
    <group ref={linesRef}>
      {lineObjects.map((lineObj, i) => (
        <primitive key={i} object={lineObj} />
      ))}
    </group>
  );
}

// ── Main Camera Controller ────────────────────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  const targetRef = useRef({ x: 0, y: 0 });

  useFrame(({ pointer }) => {
    targetRef.current.x += (pointer.x * 0.5 - targetRef.current.x) * 0.03;
    targetRef.current.y += (pointer.y * 0.3 - targetRef.current.y) * 0.03;

    camera.position.x = targetRef.current.x;
    camera.position.y = targetRef.current.y;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── Exported Component ────────────────────────────────────────────────────────
interface MedoraCoreProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function MedoraCore({ className = '', style }: MedoraCoreProps) {
  return (
    <div className={className} style={style}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 55 }}
        dpr={[1, 1.5]} // limit DPR for performance
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <CameraController />
          <ParticleField />
          <GlassPlane position={[0, 0, 0]} rotation={[0, 0, 0]} />
          <GlassPlane position={[0, 0, 0]} rotation={[Math.PI / 3, 0, 0]} />
          <GlassPlane position={[0, 0, 0]} rotation={[0, Math.PI / 3, 0]} />
          <DataLines />
          <InnerGeometry />
          <IcosahedronCore />
        </Suspense>
      </Canvas>
    </div>
  );
}
