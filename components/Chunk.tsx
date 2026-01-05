
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshData, SubMeshData, TorchData } from '../engine/WorldManager';
import { TextureManager } from '../engine/TextureManager';

interface ChunkProps {
  meshData: MeshData | null;
}

const ChunkGeometry: React.FC<{ subMesh: SubMeshData }> = ({ subMesh }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(subMesh.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(subMesh.uvs, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(subMesh.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(subMesh.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(subMesh.indices, 1));
    return geo;
  }, [subMesh]);

  return <primitive object={geometry} attach="geometry" />;
};

const PlacedTorch: React.FC<{ torch: TorchData }> = ({ torch }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const fireGroupRef = useRef<THREE.Group>(null);
  const lastUpdate = useRef(0);
  const texMgr = TextureManager.getInstance();

  const colors = useMemo(() => ({
    base: '#e64a19', 
    mid: '#ff9800',  
    hot: '#ffeb3b',  
    peak: '#ffffff', 
    ember: '#d32f2f' 
  }), []);

  const fireVoxels = useMemo(() => {
    const voxels = [];
    const size = 0.06;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        for (let y = 0; y < 8; y++) {
          voxels.push({
            id: `${x}-${y}-${z}`,
            pos: new THREE.Vector3(x * size, y * size + 0.35, z * size),
            layer: y
          });
        }
      }
    }
    return voxels;
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (time - lastUpdate.current > 0.08) {
      lastUpdate.current = time;
      if (fireGroupRef.current) {
        const children = fireGroupRef.current.children;
        const tiltX = Math.sin(time * 2.5) * 0.04;
        const tiltZ = Math.cos(time * 3.2) * 0.04;
        children.forEach((child: any, idx) => {
          const v = fireVoxels[idx];
          if (!v) return;
          const distFromCenter = Math.sqrt(v.pos.x**2 + v.pos.z**2);
          let prob = 0.3;
          if (v.layer < 2) prob = 0.85 - distFromCenter * 4;
          else if (v.layer < 4) prob = 0.65 - distFromCenter * 4;
          else if (v.layer < 6) prob = 0.4 - distFromCenter * 2;
          else prob = 0.15;
          const isActive = Math.random() < prob;
          child.visible = isActive;
          if (isActive) {
            let colorStr = colors.base;
            if (v.layer < 2) colorStr = Math.random() > 0.3 ? colors.base : colors.ember;
            else if (v.layer < 4) colorStr = colors.mid;
            else if (v.layer < 6) colorStr = colors.hot;
            else colorStr = colors.peak;
            child.material.color.set(colorStr);
            child.position.set(
              v.pos.x + tiltX * (v.layer * 0.6),
              v.pos.y,
              v.pos.z + tiltZ * (v.layer * 0.6)
            );
          }
        });
      }
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.0 + Math.sin(time * 12) * 0.1 + Math.random() * 0.1;
    }
  });

  const vSize = 0.06;

  return (
    <group position={torch.position} rotation={torch.rotation}>
      <group position={new THREE.Vector3(0, 0.1, 0)}>
        <mesh position={new THREE.Vector3(0, 0, 0)} material={texMgr.torchWoodMaterial}>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
        </mesh>
        <mesh position={new THREE.Vector3(0, 0.2, 0)} material={texMgr.torchBaseMaterial}>
          <boxGeometry args={[0.14, 0.08, 0.14]} />
        </mesh>
      </group>
      <group ref={fireGroupRef}>
        {fireVoxels.map((v) => (
          <mesh key={v.id} position={v.pos}>
            <boxGeometry args={[vSize, vSize, vSize]} />
            <meshBasicMaterial color={colors.base} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      <pointLight ref={lightRef} position={new THREE.Vector3(0, 0.5, 0)} color="#ff9d00" distance={12} intensity={1.2} decay={2} />
    </group>
  );
};

const Chunk: React.FC<ChunkProps> = ({ meshData }) => {
  const texMgr = TextureManager.getInstance();
  if (!meshData) return null;

  return (
    <group>
      {meshData.opaque && (
        <mesh material={texMgr.opaqueMaterial}>
          <ChunkGeometry subMesh={meshData.opaque} />
        </mesh>
      )}

      {meshData.transparent && (
        <mesh material={texMgr.transparentMaterial}>
          <ChunkGeometry subMesh={meshData.transparent} />
        </mesh>
      )}

      {meshData.water && (
        <mesh material={texMgr.waterMaterial} renderOrder={1}>
          <ChunkGeometry subMesh={meshData.water} />
        </mesh>
      )}

      {meshData.torches.map((torch, idx) => (
        <PlacedTorch key={`${torch.position.x}-${torch.position.y}-${torch.position.z}`} torch={torch} />
      ))}
    </group>
  );
};

export default React.memo(Chunk);
