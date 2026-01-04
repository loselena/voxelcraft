
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE_LIB from 'three';
import { WorldManager } from '../engine/WorldManager';
import { BlockType, BLOCK_HARDNESS, BLOCK_COLORS, ToolType, BLOCK_TOOL_MAP, CRACK_START_INDEX, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, ATLAS_SIZE, ItemStack, ToolTransform, Pixel } from '../constants';
import { DropEntity } from './Drops';
import HandTool from './HandTool';
import { TextureManager } from '../engine/TextureManager';

const THREE_INSTANCE = THREE_LIB;

interface PlayerProps {
  onMove: (pos: THREE_LIB.Vector3) => void;
  onUnlock: () => void;
  worldManager: WorldManager;
  inventory: (ItemStack | null)[];
  setInventory: React.Dispatch<React.SetStateAction<(ItemStack | null)[]>>;
  selectedSlot: number;
  setSelectedSlot: (s: number) => void;
  onBlockBreak: (pos: THREE_LIB.Vector3, type: BlockType) => void;
  onBlockPlace: () => void;
  onCollect: (id: string, type: BlockType) => void;
  onBlockHit: (pos: THREE_LIB.Vector3, type: BlockType, count: number) => void;
  onOpenWorkbench: () => void;
  drops: DropEntity[];
  isPaused: boolean;
  customBlueprints?: Record<string, Pixel[]>;
  customTransforms?: Record<string, ToolTransform>;
}

const Player: React.FC<PlayerProps> = ({ 
  onMove, onUnlock, worldManager, inventory, setInventory, 
  selectedSlot, setSelectedSlot, onBlockBreak, onBlockPlace, onCollect, onBlockHit, onOpenWorkbench, drops, isPaused,
  customBlueprints = {},
  customTransforms = {}
}) => {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE_INSTANCE.Vector3(0, 0, 0));
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false, action: false });
  const isGrounded = useRef(false);
  const isInWater = useRef(false);
  const [isMining, setIsMining] = useState(false);
  const breakingBlock = useRef<{ pos: THREE_LIB.Vector3, type: BlockType, startTime: number, lastCrackStage: number } | null>(null);
  const selectionRef = useRef<THREE_LIB.LineSegments>(null);
  const crackRef = useRef<THREE_LIB.Mesh>(null);
  const worldLightRef = useRef<THREE_LIB.PointLight>(null);

  const PLAYER_RADIUS = 0.3;
  const PLAYER_HEIGHT = 1.62;

  const currentHandItem = inventory[27 + selectedSlot];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', '')) - 1;
        if (num >= 0 && num < 9) setSelectedSlot(num);
      }
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        case 'Space': moveState.current.jump = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
        case 'Space': moveState.current.jump = false; break;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isPaused) return;
      if (e.button === 0) {
        moveState.current.action = true;
        setIsMining(true);
      }
      if (e.button === 2) {
        const direction = camera.getWorldDirection(new THREE_INSTANCE.Vector3());
        for (let d = 0; d < 5.5; d += 0.05) {
          const target = camera.position.clone().add(direction.clone().multiplyScalar(d));
          const bx = Math.floor(target.x);
          const by = Math.floor(target.y);
          const bz = Math.floor(target.z);
          const block = worldManager.getBlock(bx, by, bz);
          
          if (block !== BlockType.AIR && block !== BlockType.WATER) {
            if (block === BlockType.CRAFTING_TABLE) {
              onOpenWorkbench();
              return;
            }

            const prev = camera.position.clone().add(direction.clone().multiplyScalar(d - 0.15));
            const pbx = Math.floor(prev.x);
            const pby = Math.floor(prev.y);
            const pbz = Math.floor(prev.z);

            const playerMinX = camera.position.x - PLAYER_RADIUS;
            const playerMaxX = camera.position.x + PLAYER_RADIUS;
            const playerMinY = camera.position.y - PLAYER_HEIGHT;
            const playerMaxY = camera.position.y + 0.1;
            const playerMinZ = camera.position.z - PLAYER_RADIUS;
            const playerMaxZ = camera.position.z + PLAYER_RADIUS;

            const overlapX = playerMinX < pbx + 1 && playerMaxX > pbx;
            const overlapY = playerMinY < pby + 1 && playerMaxY > pby;
            const overlapZ = playerMinZ < pbz + 1 && playerMaxZ > pbz;

            if (overlapX && overlapY && overlapZ) {
              break; 
            }

            if (currentHandItem && typeof currentHandItem.type === 'number' && currentHandItem.count > 0) {
              worldManager.setBlock(pbx, pby, pbz, currentHandItem.type);
              setInventory(prevInv => {
                const newInv = [...prevInv];
                const slotIdx = 27 + selectedSlot;
                if (newInv[slotIdx]) {
                  newInv[slotIdx] = { ...newInv[slotIdx]!, count: newInv[slotIdx]!.count - 1 };
                  if (newInv[slotIdx]!.count <= 0) newInv[slotIdx] = null;
                }
                return newInv;
              });
              onBlockPlace();
            }
            break;
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        moveState.current.action = false;
        setIsMining(false);
        breakingBlock.current = null;
        if (crackRef.current) crackRef.current.visible = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [camera, worldManager, selectedSlot, inventory, onBlockPlace, isPaused, currentHandItem, onOpenWorkbench]);

  const isSolid = (x: number, y: number, z: number) => {
    const block = worldManager.getBlock(x, y, z);
    return block !== BlockType.AIR && block !== BlockType.WATER;
  };

  useFrame((state, delta) => {
    if (isPaused) {
        moveState.current.forward = false;
        moveState.current.backward = false;
        moveState.current.left = false;
        moveState.current.right = false;
        moveState.current.action = false;
        setIsMining(false);
    }
    const dt = Math.min(delta, 0.05);
    const JUMP_FORCE = 8.5;
    
    isInWater.current = worldManager.getBlock(camera.position.x, camera.position.y - 0.8, camera.position.z) === BlockType.WATER;

    drops.forEach(drop => {
      if (camera.position.distanceTo(drop.position) < 1.8) onCollect(drop.id, drop.type);
    });

    const direction = camera.getWorldDirection(new THREE_INSTANCE.Vector3());
    let hitPos: THREE_LIB.Vector3 | null = null;
    let hitPoint: THREE_LIB.Vector3 | null = null;
    for (let d = 0; d < 5.8; d += 0.05) {
      const target = camera.position.clone().add(direction.clone().multiplyScalar(d));
      const bx = Math.floor(target.x);
      const by = Math.floor(target.y);
      const bz = Math.floor(target.z);
      if (worldManager.getBlock(bx, by, bz) !== BlockType.AIR && worldManager.getBlock(bx, by, bz) !== BlockType.WATER) {
        hitPos = new THREE_INSTANCE.Vector3(bx, by, bz);
        hitPoint = target.clone().sub(direction.clone().multiplyScalar(0.05));
        break;
      }
    }

    if (selectionRef.current) {
      if (hitPos && !isPaused) {
        selectionRef.current.position.set(hitPos.x + 0.5, hitPos.y + 0.5, hitPos.z + 0.5);
        selectionRef.current.visible = true;
      } else {
        selectionRef.current.visible = false;
      }
    }

    if (moveState.current.action && hitPos && !isPaused) {
      const blockType = worldManager.getBlock(hitPos.x, hitPos.y, hitPos.z);
      const hardness = BLOCK_HARDNESS[blockType] || 1.0;
      if (hardness >= 0) {
        const selectedType = currentHandItem?.type || ToolType.NONE;
        const correctTool = BLOCK_TOOL_MAP[blockType];
        let efficiency = selectedType === correctTool ? 4.0 : 1.0;
        if (isInWater.current && !isGrounded.current) efficiency *= 0.2;

        if (breakingBlock.current && breakingBlock.current.pos.equals(hitPos)) {
          const elapsed = (state.clock.elapsedTime - breakingBlock.current.startTime) * efficiency;
          const progress = Math.min(elapsed / hardness, 1.0);
          const stage = Math.min(Math.floor(progress * 10), 9);

          if (stage > breakingBlock.current.lastCrackStage) {
            onBlockHit(hitPoint || hitPos.clone().add(new THREE_INSTANCE.Vector3(0.5,0.5,0.5)), blockType, 4);
            breakingBlock.current.lastCrackStage = stage;
          }

          if (crackRef.current) {
            crackRef.current.visible = progress > 0.01;
            crackRef.current.position.set(hitPos.x + 0.5, hitPos.y + 0.5, hitPos.z + 0.5);
            
            const blockBaseColorHex = BLOCK_COLORS[blockType] || '#808080';
            const crackColor = new THREE_INSTANCE.Color(blockBaseColorHex).multiplyScalar(0.2);
            (crackRef.current.material as THREE_LIB.MeshBasicMaterial).color.copy(crackColor);

            const texIndex = CRACK_START_INDEX + stage;
            const col = texIndex % ATLAS_COLS;
            const row = Math.floor(texIndex / ATLAS_COLS);
            const u0 = (col * FULL_TILE + PADDING) / ATLAS_SIZE;
            const u1 = (col * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE;
            const v0 = 1 - (row * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE;
            const v1 = 1 - (row * FULL_TILE + PADDING) / ATLAS_SIZE;
            const uvAttr = crackRef.current.geometry.attributes.uv;
            for (let i = 0; i < uvAttr.count; i += 4) {
              uvAttr.setXY(i, u0, v1); uvAttr.setXY(i+1, u1, v1); uvAttr.setXY(i+2, u0, v0); uvAttr.setXY(i+3, u1, v0);
            }
            uvAttr.needsUpdate = true;
          }
          if (progress >= 1.0) {
            worldManager.setBlock(hitPos.x, hitPos.y, hitPos.z, BlockType.AIR);
            onBlockBreak(hitPos, blockType);
            breakingBlock.current = null;
          }
        } else {
          onBlockHit(hitPoint || hitPos.clone().add(new THREE_INSTANCE.Vector3(0.5,0.5,0.5)), blockType, 6);
          breakingBlock.current = { pos: hitPos.clone(), type: blockType, startTime: state.clock.elapsedTime, lastCrackStage: 0 };
        }
      }
    } else {
      breakingBlock.current = null;
      if (crackRef.current) crackRef.current.visible = false;
    }

    const forwardVec = new THREE_INSTANCE.Vector3();
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0; forwardVec.normalize();
    const rightVec = new THREE_INSTANCE.Vector3().crossVectors(forwardVec, camera.up).normalize();
    const inputDir = new THREE_INSTANCE.Vector3(0, 0, 0);
    if (moveState.current.forward) inputDir.add(forwardVec);
    if (moveState.current.backward) inputDir.sub(forwardVec);
    if (moveState.current.right) inputDir.add(rightVec);
    if (moveState.current.left) inputDir.sub(rightVec);
    inputDir.normalize();

    const moveMult = isInWater.current ? 0.5 : 1.0;
    if (inputDir.length() > 0) {
      velocity.current.x += inputDir.x * 60 * dt * moveMult;
      velocity.current.z += inputDir.z * 60 * dt * moveMult;
    }

    velocity.current.x -= velocity.current.x * (isGrounded.current ? 10 : 2) * dt;
    velocity.current.z -= velocity.current.z * (isGrounded.current ? 10 : 2) * dt;
    velocity.current.y -= 26.0 * dt * (isInWater.current ? 0.15 : 1.0);
    
    if (moveState.current.jump) {
      if (isGrounded.current) velocity.current.y = JUMP_FORCE;
      else if (isInWater.current) velocity.current.y = Math.min(velocity.current.y + 4.0 * dt * 10, 4.0);
    }
    if (isInWater.current) velocity.current.y -= velocity.current.y * 3 * dt;

    const nextY = camera.position.y + velocity.current.y * dt;
    const checkPos = (y: number) => {
        const HEAD_MARGIN = 0.15;
        if (velocity.current.y > 0) {
            const topY = y + HEAD_MARGIN;
            const hitCeiling = isSolid(camera.position.x - 0.2, topY, camera.position.z - 0.2) ||
                               isSolid(camera.position.x + 0.2, topY, camera.position.z + 0.2) ||
                               isSolid(camera.position.x - 0.2, topY, camera.position.z + 0.2) ||
                               isSolid(camera.position.x + 0.2, topY, camera.position.z - 0.2);
            if (hitCeiling) {
                velocity.current.y = 0;
                camera.position.y = Math.floor(topY) - HEAD_MARGIN - 0.01;
            } else {
                camera.position.y = y;
            }
        } else {
            const floorY = Math.floor(y - PLAYER_HEIGHT) + 1;
            const onFloor = isSolid(camera.position.x - 0.2, y - PLAYER_HEIGHT, camera.position.z - 0.2) ||
                            isSolid(camera.position.x + 0.2, y - PLAYER_HEIGHT, camera.position.z + 0.2) ||
                            isSolid(camera.position.x - 0.2, y - PLAYER_HEIGHT, camera.position.z + 0.2) ||
                            isSolid(camera.position.x + 0.2, y - PLAYER_HEIGHT, camera.position.z - 0.2);
                            
            if (onFloor && velocity.current.y <= 0) {
                camera.position.y = floorY + PLAYER_HEIGHT;
                velocity.current.y = 0;
                isGrounded.current = true;
            } else {
                camera.position.y = y;
                isGrounded.current = false;
            }
        }
    };
    checkPos(nextY);

    const checkMove = (axis: 'x' | 'z', amount: number) => {
      const offset = amount > 0 ? PLAYER_RADIUS : -PLAYER_RADIUS;
      const targetPos = camera.position[axis] + offset + amount;
      const isBlocked = (checkAxis: 'x' | 'z', checkVal: number) => {
        const x = checkAxis === 'x' ? checkVal : camera.position.x;
        const z = checkAxis === 'z' ? checkVal : camera.position.z;
        return isSolid(x, camera.position.y - 1.5, z) || 
               isSolid(x, camera.position.y - 0.8, z) || 
               isSolid(x, camera.position.y - 0.1, z);
      };
      if (!isBlocked(axis, targetPos)) camera.position[axis] += amount;
      else velocity.current[axis] = 0;
    };
    checkMove('x', velocity.current.x * dt);
    checkMove('z', velocity.current.z * dt);
    onMove(camera.position);

    if (worldLightRef.current) {
      worldLightRef.current.position.copy(camera.position);
      if (currentHandItem?.type === BlockType.TORCH) {
        const time = state.clock.elapsedTime;
        worldLightRef.current.intensity = 1.2 + Math.sin(time * 12) * 0.1 + Math.random() * 0.1;
      } else {
        worldLightRef.current.intensity = 0;
      }
    }
  });

  const activeToolType = currentHandItem?.type || ToolType.PLAYER_HAND;

  return (
    <>
      <PointerLockControls 
        onUnlock={onUnlock} 
        makeDefault 
        selector={isPaused ? "#pause-dummy-element" : "canvas"} 
      />
      <pointLight 
        ref={worldLightRef as any} 
        color="#ff9d00" 
        distance={14} 
        decay={2} 
        intensity={0}
      />
      <HandTool 
        type={currentHandItem?.type || BlockType.AIR} 
        isMining={isMining} 
        customPixels={customBlueprints[activeToolType as string]}
        handPixels={customBlueprints[ToolType.PLAYER_HAND]}
        customTransform={customTransforms[activeToolType as string]}
        handTransform={customTransforms[ToolType.PLAYER_HAND]}
      />
      <lineSegments ref={selectionRef} renderOrder={1000}>
        <edgesGeometry args={[new THREE_INSTANCE.BoxGeometry(1.01, 1.01, 1.01)]} />
        <lineBasicMaterial color="white" transparent opacity={0.6} />
      </lineSegments>
      <mesh ref={crackRef} visible={false} renderOrder={1001}>
        <boxGeometry args={[1.005, 1.005, 1.005]} />
        <meshBasicMaterial map={TextureManager.getInstance().textureAtlas} transparent alphaTest={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </>
  );
};

export default Player;
