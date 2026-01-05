
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockType, BLOCK_TEXTURES, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, ATLAS_SIZE } from '../constants';
import { TextureManager } from '../engine/TextureManager';

export interface DropEntity {
  id: string;
  type: BlockType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

interface DropsProps {
  drops: DropEntity[];
}

const Drops: React.FC<DropsProps> = ({ drops }) => {
  const texture = TextureManager.getInstance().textureAtlas;

  return (
    <group>
      {drops.map((drop) => (
        <DropItem key={drop.id} drop={drop} texture={texture} />
      ))}
    </group>
  );
};

const DropItem: React.FC<{ drop: DropEntity, texture: THREE.Texture }> = ({ drop, texture }) => {
  const groupRef = useRef<THREE.Group>(null);
  const fireRef = useRef<THREE.Group>(null);
  const lastUpdate = useRef(0);
  const texMgr = TextureManager.getInstance();

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

  const fireColors = useMemo(() => ({
    base: '#e64a19', 
    mid: '#ff9800',  
    hot: '#ffeb3b',  
    peak: '#ffffff', 
    ember: '#d32f2f' 
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    
    groupRef.current.position.copy(drop.position);
    groupRef.current.position.y += Math.sin(time * 3) * 0.05;
    groupRef.current.rotation.y += 0.05;

    if (drop.type === BlockType.TORCH && fireRef.current && time - lastUpdate.current > 0.08) {
      lastUpdate.current = time;
      
      const tiltX = Math.sin(time * 2.5) * 0.04;
      const tiltZ = Math.cos(time * 3.2) * 0.04;

      fireRef.current.children.forEach((child, idx) => {
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
          let colorStr = fireColors.base;
          if (v.layer < 2) colorStr = Math.random() > 0.3 ? fireColors.base : fireColors.ember;
          else if (v.layer < 4) colorStr = fireColors.mid;
          else if (v.layer < 6) colorStr = fireColors.hot;
          else colorStr = fireColors.peak;
          
          const mat = (child as THREE.Mesh).material;
          if (mat instanceof THREE.MeshBasicMaterial) {
            mat.color.set(colorStr);
          }
          
          child.position.set(
            v.pos.x + tiltX * (v.layer * 0.6),
            v.pos.y,
            v.pos.z + tiltZ * (v.layer * 0.6)
          );
        }
      });
    }
  });

  const boxGeometry = useMemo(() => {
    if (drop.type === BlockType.TORCH) return null;
    
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const uvAttr = geo.attributes.uv;
    
    const textures = BLOCK_TEXTURES[drop.type] || { top: 0, side: 0, bottom: 0 };
    const faceMap = [
      textures.side, textures.side,
      textures.top, textures.bottom,
      textures.side, textures.side
    ];

    const pixelOffset = 0.1 / ATLAS_SIZE;

    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const texIndex = faceMap[faceIdx];
      const col = texIndex % ATLAS_COLS;
      const row = Math.floor(texIndex / ATLAS_COLS);
      const u0 = (col * FULL_TILE + PADDING) / ATLAS_SIZE + pixelOffset;
      const u1 = (col * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE - pixelOffset;
      const v0 = 1 - (row * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE + pixelOffset;
      const v1 = 1 - (row * FULL_TILE + PADDING) / ATLAS_SIZE - pixelOffset;

      const startIdx = faceIdx * 4;
      uvAttr.setXY(startIdx, u0, v1);
      uvAttr.setXY(startIdx + 1, u1, v1);
      uvAttr.setXY(startIdx + 2, u0, v0);
      uvAttr.setXY(startIdx + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;
    return geo;
  }, [drop.type]);

  if (drop.type === BlockType.TORCH) {
    const s = 0.6; 
    const vSize = 0.06;
    return (
      <group ref={groupRef}>
        <group scale={s} position={new THREE.Vector3(0, -0.1, 0)}>
          <group position={new THREE.Vector3(0, 0.1, 0)}>
            <mesh position={new THREE.Vector3(0, 0, 0)} material={texMgr.torchWoodMaterial}>
              <boxGeometry args={[0.12, 0.4, 0.12]} />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0.2, 0)} material={texMgr.torchBaseMaterial}>
              <boxGeometry args={[0.14, 0.08, 0.14]} />
            </mesh>
          </group>
          <group ref={fireRef}>
            {fireVoxels.map((v) => (
              <mesh key={v.id} position={v.pos}>
                <boxGeometry args={[vSize, vSize, vSize]} />
                <meshBasicMaterial color={fireColors.base} transparent opacity={0.85} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    );
  }

  return (
    <mesh ref={groupRef as any} geometry={boxGeometry!} castShadow>
      <meshLambertMaterial 
        map={texture} 
        transparent={false}
        alphaTest={0.5}
      />
    </mesh>
  );
};

export default Drops;
