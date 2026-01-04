
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimplexNoise } from '../engine/Noise';

const GRID_SIZE_XZ = 128;
const GRID_SIZE_Y = 8; 
const BLOCK_SIZE = 8;
const CLOUD_HEIGHT = 192; // Moved significantly above CHUNK_HEIGHT (128) to stay in the background
const WIND_SPEED = 0.4;

interface CloudsProps {
  playerPos: THREE.Vector3;
  sunHeight: number;
  atmosphere: {
    ambientIntensity: number;
  };
}

const Clouds: React.FC<CloudsProps> = ({ playerPos, sunHeight, atmosphere }) => {
  const groupRef = useRef<THREE.Group>(null);
  const noise = useMemo(() => new SimplexNoise(8888), []);

  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    const grid: boolean[][][] = Array(GRID_SIZE_XZ).fill(0).map(() => 
      Array(GRID_SIZE_Y).fill(0).map(() => 
        Array(GRID_SIZE_XZ).fill(false)
      )
    );

    for (let x = 0; x < GRID_SIZE_XZ; x++) {
      for (let z = 0; z < GRID_SIZE_XZ; z++) {
        const n1 = noise.noise2D(x * 0.02, z * 0.02);
        const n2 = noise.noise2D(x * 0.1, z * 0.1) * 0.3;
        const combined = n1 + n2;

        if (combined > 0.45) {
          const intensity = (combined - 0.45) * 14;
          const h = Math.min(Math.floor(intensity), GRID_SIZE_Y);
          for (let y = 0; y < h; y++) grid[x][y][z] = true;
        }
      }
    }

    const addFace = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
      const x0 = x * BLOCK_SIZE, x1 = (x + 1) * BLOCK_SIZE;
      const y0 = y * BLOCK_SIZE, y1 = (y + 1) * BLOCK_SIZE;
      const z0 = z * BLOCK_SIZE, z1 = (z + 1) * BLOCK_SIZE;

      let corners: number[][] = [];
      if (nx === 1) corners = [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]];
      else if (nx === -1) corners = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]];
      else if (ny === 1) corners = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]];
      else if (ny === -1) corners = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
      else if (nz === 1) corners = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      else if (nz === -1) corners = [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]];

      let b = 1.0;
      if (ny === -1) b = 0.7; 
      else if (ny === 1) b = 1.0; 
      else b = 0.85; 

      corners.forEach(c => {
        vertices.push(...c);
        normals.push(nx, ny, nz);
        colors.push(b, b, b);
      });

      indices.push(indexOffset, indexOffset + 1, indexOffset + 2, indexOffset, indexOffset + 2, indexOffset + 3);
      indexOffset += 4;
    };

    for (let x = 0; x < GRID_SIZE_XZ; x++) {
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let z = 0; z < GRID_SIZE_XZ; z++) {
          if (!grid[x][y][z]) continue;
          if (x === 0 || !grid[x - 1][y][z]) addFace(x, y, z, -1, 0, 0);
          if (x === GRID_SIZE_XZ - 1 || !grid[x + 1][y][z]) addFace(x, y, z, 1, 0, 0);
          if (y === 0 || !grid[x][y - 1][z]) addFace(x, y, z, 0, -1, 0);
          if (y === GRID_SIZE_Y - 1 || !grid[x][y + 1][z]) addFace(x, y, z, 0, 1, 0);
          if (z === 0 || !grid[x][y][z - 1]) addFace(x, y, z, 0, 0, -1);
          if (z === GRID_SIZE_XZ - 1 || !grid[x][y][z + 1]) addFace(x, y, z, 0, 0, 1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }, [noise]);

  const windOffset = useRef(0);
  const patternSize = GRID_SIZE_XZ * BLOCK_SIZE;

  const cloudColor = useMemo(() => {
    const color = new THREE.Color();
    if (sunHeight > 0.1) {
      color.set('#ffffff');
    } else if (sunHeight > -0.1) {
      const t = (sunHeight + 0.1) / 0.2;
      color.lerpColors(new THREE.Color('#ffaa88'), new THREE.Color('#ffffff'), t);
    } else {
      color.set('#010103');
    }
    return color;
  }, [sunHeight]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    windOffset.current += delta * WIND_SPEED;

    const snapX = Math.floor(playerPos.x / patternSize) * patternSize;
    const snapZ = Math.floor(playerPos.z / patternSize) * patternSize;
    const driftX = (windOffset.current % patternSize);

    groupRef.current.children.forEach((mesh, idx) => {
      const ox = idx % 2 === 0 ? -1 : 0;
      const oz = idx < 2 ? -1 : 0;
      let posX = snapX + (ox * patternSize) + driftX;
      let posZ = snapZ + (oz * patternSize);
      
      if (posX < playerPos.x - patternSize) posX += patternSize * 2;
      if (posX > playerPos.x + patternSize) posX -= patternSize * 2;
      if (posZ < playerPos.z - patternSize) posZ += patternSize * 2;
      if (posZ > playerPos.z + patternSize) posZ -= patternSize * 2;

      mesh.position.set(posX, CLOUD_HEIGHT, posZ);
      const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.copy(cloudColor).multiplyScalar(0.1 + atmosphere.ambientIntensity * 0.9);
    });
  });

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} geometry={geometry} renderOrder={-5}>
          <meshBasicMaterial 
            vertexColors 
            transparent 
            opacity={0.8} 
            fog={false} 
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      ))}
    </group>
  );
};

export default Clouds;
