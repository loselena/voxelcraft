
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from '../constants';

export interface ParticleData {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  type: BlockType;
  life: number; 
  scale: number;
}

interface ParticlesProps {
  newParticles: ParticleData[];
  onProcessed: () => void;
}

const Particles: React.FC<ParticlesProps> = ({ newParticles, onProcessed }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const activeParticles = useRef<ParticleData[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (newParticles.length > 0) {
      if (activeParticles.current.length < 1000) {
        activeParticles.current.push(...newParticles);
      }
      onProcessed(); 
    }
  }, [newParticles, onProcessed]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const particles = activeParticles.current;
    const gravity = 22 * delta;
    const friction = 1 - 0.6 * delta;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta * 1.5;

      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }

      p.vy -= gravity;
      p.vx *= friction;
      p.vz *= friction;
      
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.x * 2, p.y * 3, p.z * 4);
      
      const s = p.scale * Math.min(1.0, p.life * 4);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const hex = BLOCK_COLORS[p.type] || '#808080';
      color.set(hex);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.count = particles.length;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
};

export default Particles;
