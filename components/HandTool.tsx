
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Hud } from '@react-three/drei';
import * as THREE from 'three';
import { ToolType, BlockType, DEFAULT_BLUEPRINTS, Pixel, ToolTransform, DEFAULT_TRANSFORMS, BLOCK_TEXTURES, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, ATLAS_SIZE } from '../constants';
import { TextureManager } from '../engine/TextureManager';

interface HandToolProps {
  type: ToolType | BlockType;
  isMining: boolean;
  customPixels?: Pixel[];
  handPixels?: Pixel[]; 
  customTransform?: ToolTransform;
  handTransform?: ToolTransform;
}

const HandTool = ({ 
  type, isMining, customPixels, handPixels, 
  customTransform,
  handTransform
}: HandToolProps) => {
  const pivotRef = useRef<THREE.Group>(null);
  const toolGroupRef = useRef<THREE.Group>(null);
  const armGroupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const tForm = useMemo(() => customTransform || DEFAULT_TRANSFORMS[typeof type === 'string' ? type : ToolType.PICKAXE] || DEFAULT_TRANSFORMS[ToolType.PICKAXE], [customTransform, type]);
  const aForm = useMemo(() => handTransform || DEFAULT_TRANSFORMS[ToolType.PLAYER_HAND], [handTransform]);

  useFrame((state, delta) => {
    if (!pivotRef.current) return;

    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    
    const basePivotPos = new THREE.Vector3(0.55, -0.65, -0.75);
    const basePivotRot = new THREE.Euler(-0.8, Math.PI + 0.35, 0.2);

    if (isMining) {
      const swingSpeed = 14; 
      const phase = (time * swingSpeed) % Math.PI;
      const swingProgress = Math.sin(phase); 
      
      pivotRef.current.position.set(
        basePivotPos.x - swingProgress * 0.25, 
        basePivotPos.y - swingProgress * 0.15, 
        basePivotPos.z + swingProgress * 0.35 
      );

      pivotRef.current.rotation.set(
        basePivotRot.x - swingProgress * 1.8,
        basePivotRot.y + swingProgress * 0.6,
        basePivotRot.z - swingProgress * 0.4
      );
    } else {
      const bobY = Math.sin(time * 3) * 0.008;
      const bobX = Math.cos(time * 1.5) * 0.008;

      pivotRef.current.position.lerp(new THREE.Vector3(basePivotPos.x + bobX, basePivotPos.y + bobY, basePivotPos.z), dt * 10);
      
      const targetQuat = new THREE.Quaternion().setFromEuler(basePivotRot);
      pivotRef.current.quaternion.slerp(targetQuat, dt * 10);
    }

    if (toolGroupRef.current) {
        toolGroupRef.current.position.set(tForm.px, tForm.py, tForm.pz);
        toolGroupRef.current.rotation.set(tForm.rx, tForm.ry, tForm.rz);
        toolGroupRef.current.scale.set(tForm.s, tForm.s, tForm.s);
    }

    if (armGroupRef.current) {
        armGroupRef.current.position.set(aForm.px, aForm.py, aForm.pz);
        armGroupRef.current.rotation.set(aForm.rx, aForm.ry, aForm.rz);
        armGroupRef.current.scale.set(aForm.s, aForm.s, aForm.s);
    }

    if (lightRef.current) {
      lightRef.current.intensity = 0.7 + Math.sin(time * 4) * 0.1;
      lightRef.current.color.set(type === BlockType.TORCH ? "#ff9d00" : "#ffffff");
    }
  });

  const isHoldingAnything = type !== BlockType.AIR && type !== undefined;

  return (
    <Hud>
      <PerspectiveCamera makeDefault fov={50} position={[0, 0, 0]} />
      
      <ambientLight intensity={0.9} />
      <pointLight ref={lightRef} position={[1, 1, 0]} distance={10} intensity={0.8} color="#ffffff" />
      
      <group ref={pivotRef}>
        {!isHoldingAnything ? (
          <group ref={armGroupRef}>
            <ToolModel type={ToolType.PLAYER_HAND} customPixels={handPixels} isArm={true} />
          </group>
        ) : (
          <group ref={toolGroupRef}>
            <ToolModel type={type} customPixels={customPixels} />
          </group>
        )}
      </group>
    </Hud>
  );
};

const ToolModel = ({ type, customPixels, isArm }: { type: ToolType | BlockType, customPixels?: Pixel[], isArm?: boolean }) => {
  const s = isArm ? 0.07 : 0.06;
  const texMgr = TextureManager.getInstance();
  
  const fireRef = useRef<THREE.Group>(null);
  const lastUpdate = useRef(0);

  const fireVoxels = useMemo(() => {
    const voxels = [];
    const size = 0.06;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        for (let y = 0; y < 8; y++) {
          voxels.push({
            id: `${x}-${y}-${z}`,
            pos: [x * size, y * size + 0.35, z * size],
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
    const time = state.clock.elapsedTime;
    if (type === BlockType.TORCH && fireRef.current && time - lastUpdate.current > 0.08) {
      lastUpdate.current = time;
      
      const tiltX = Math.sin(time * 2.5) * 0.04;
      const tiltZ = Math.cos(time * 3.2) * 0.04;

      fireRef.current.children.forEach((child, idx) => {
        const v = fireVoxels[idx];
        if (!v) return;
        
        const distFromCenter = Math.sqrt(v.pos[0]**2 + v.pos[2]**2);
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
          
          child.position.x = v.pos[0] + tiltX * (v.layer * 0.6);
          child.position.z = v.pos[2] + tiltZ * (v.layer * 0.6);
        }
      });
    }
  });

  const blueprint = useMemo(() => {
    if (customPixels && customPixels.length > 0) return customPixels;
    if (typeof type === 'string' && DEFAULT_BLUEPRINTS[type]) return DEFAULT_BLUEPRINTS[type];
    return null;
  }, [type, customPixels]);

  const blockGeometry = useMemo(() => {
    if (typeof type !== 'number' || type === BlockType.AIR || type === BlockType.TORCH) return null;

    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const uvAttr = geo.attributes.uv;
    
    const textures = BLOCK_TEXTURES[type] || { top: 0, side: 0, bottom: 0 };
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
  }, [type]);

  const metrics = useMemo(() => {
    if (!blueprint || blueprint.length === 0) return { center: new THREE.Vector3(8, 8, 0), width: 4 };
    let minX = 16, maxX = 0, minY = 16, maxY = 0;
    blueprint.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { center: new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0), width: maxX - minX + 1 };
  }, [blueprint]);

  if (type === BlockType.TORCH) {
    const torchVisualScale = 30;

    return (
      <group scale={[s * torchVisualScale, s * torchVisualScale, s * torchVisualScale]}>
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0, 0]} material={texMgr.torchWoodMaterial}>
            <boxGeometry args={[0.12, 0.4, 0.12]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} material={texMgr.torchBaseMaterial}>
            <boxGeometry args={[0.14, 0.08, 0.14]} />
          </mesh>
        </group>
        <group ref={fireRef}>
          {fireVoxels.map((v) => (
            <mesh key={v.id} position={v.pos}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshBasicMaterial color={fireColors.base} transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  if (blueprint) {
    return (
      <group scale={[s, s, s]}>
        {blueprint.map((p, i) => (
          <mesh key={`${p.x}-${p.y}-${i}`} position={[0, p.y - metrics.center.y, p.x - metrics.center.x]}>
            <boxGeometry args={[isArm ? metrics.width : 0.8, 1.0, 1.0]} />
            <meshLambertMaterial color={p.color} />
          </mesh>
        ))}
      </group>
    );
  }

  if (blockGeometry) {
    return (
      <mesh geometry={blockGeometry} material={texMgr.opaqueMaterial} />
    );
  }

  return null;
};

export default HandTool;
