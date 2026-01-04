import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarsProps {
  intensity: number; // 0..1
}

const StarShader = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  },
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    attribute float phase;
    attribute float magnitude;
    varying vec3 vColor;
    varying float vPhase;
    varying float vMag;
    uniform float uTime;

    void main() {
      vColor = color;
      vPhase = phase;
      vMag = magnitude;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Легкое мерцание: только для ярких звезд, низкая частота
      float twinkle = 1.0;
      if (vMag > 0.8) { 
         twinkle = 0.9 + 0.1 * sin(uTime * 1.2 + vPhase);
      }
      
      // Уменьшенный размер точек
      gl_PointSize = size * twinkle * (800.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vMag;
    uniform float uOpacity;

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if (dist > 0.5) discard;
      
      // Мягкие края
      float alpha = smoothstep(0.5, 0.1, dist) * uOpacity;
      
      if (vMag < 0.3) alpha *= 0.5;

      gl_FragColor = vec4(vColor, alpha);
    }
  `
};

const Stars: React.FC<StarsProps> = ({ intensity }) => {
  const count = 5000;
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const [positions, colors, sizes, phases, magnitudes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);
    const mag = new Float32Array(count);

    const starColors = [
      new THREE.Color('#f0f5ff'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#fffdf5'),
      new THREE.Color('#fff4e0'),
    ];

    for (let i = 0; i < count; i++) {
      const r = 950;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const cRand = Math.random();
      let color = starColors[1];
      if (cRand < 0.1) color = starColors[0];
      else if (cRand < 0.9) color = starColors[1];
      else color = starColors[2];

      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;

      const magnitude = Math.pow(Math.random(), 5);
      mag[i] = magnitude;
      sz[i] = 0.8 + magnitude * 1.5;
      ph[i] = Math.random() * 100;
    }
    return [pos, col, sz, ph, mag];
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));
    return geo;
  }, [positions, colors, sizes, phases, magnitudes]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uOpacity.value = intensity;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.001;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={StarShader.vertexShader}
        fragmentShader={StarShader.fragmentShader}
        uniforms={StarShader.uniforms}
      />
    </points>
  );
};

export default Stars;
