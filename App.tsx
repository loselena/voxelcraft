
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldManager } from './engine/WorldManager';
import Chunk from './components/Chunk';
import Player from './components/Player';
import Crosshair from './components/Crosshair';
import Hotbar from './components/Hotbar';
import Drops, { DropEntity } from './components/Drops';
import Inventory, { Recipe, RECIPES_LIST } from './components/Inventory';
import ItemEditor from './components/ItemEditor';
import Particles, { ParticleData } from './components/Particles';
import Clouds from './components/Clouds';
import Stars from './components/Stars';
import { CHUNK_SIZE, RENDER_DISTANCE, BlockType, ToolType, INVENTORY_SIZE, ItemStack, DEFAULT_BLUEPRINTS, DEFAULT_TRANSFORMS, Pixel, ToolTransform, DAY_DURATION, BlockFace, BLOCK_TEXTURES, TOOL_TEXTURES } from './constants';
import { TextureManager } from './engine/TextureManager';

const lerpColor = (c1: string, c2: string, t: number) => {
  const color1 = new THREE.Color(c1);
  const color2 = new THREE.Color(c2);
  return `#${color1.lerp(color2, t).getHexString()}`;
};

const DayNightController: React.FC<{ 
  onTimeUpdate: (t: number) => void,
  onSunHeightUpdate: (h: number) => void,
  playerPos: THREE.Vector3 
}> = ({ onTimeUpdate, onSunHeightUpdate, playerPos }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);
  const atmosphereGlowRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0.3 * DAY_DURATION); 

  useFrame((state, delta) => {
    timeRef.current = (timeRef.current + delta) % DAY_DURATION;
    const t = timeRef.current / DAY_DURATION;
    onTimeUpdate(t);

    const angle = (t * Math.PI * 2) - Math.PI / 2;
    const h = Math.sin(angle);
    onSunHeightUpdate(h);

    const sunPos = new THREE.Vector3(Math.cos(angle) * 600, h * 600, 0);
    const moonPos = new THREE.Vector3(-sunPos.x, -sunPos.y, 0);

    if (lightRef.current) {
      lightRef.current.position.copy(playerPos).add(sunPos.clone().normalize().multiplyScalar(100));
      lightRef.current.target.position.copy(playerPos);
      lightRef.current.target.updateMatrixWorld();
      lightRef.current.intensity = Math.max(0, Math.min(1.8, h * 3 + 0.3));
      
      if (h < 0.1) lightRef.current.color.set('#ff5522');
      else if (h < 0.3) lightRef.current.color.lerpColors(new THREE.Color('#ffaa66'), new THREE.Color('#ffffff'), (h - 0.1) * 5);
      else lightRef.current.color.set('#ffffff');
    }

    if (moonLightRef.current) {
      const moonH = Math.sin(angle + Math.PI);
      moonLightRef.current.position.copy(playerPos).add(moonPos.clone().normalize().multiplyScalar(100));
      moonLightRef.current.target.position.copy(playerPos);
      moonLightRef.current.target.updateMatrixWorld();
      moonLightRef.current.intensity = Math.max(0, moonH * 0.35);
    }

    if (sunRef.current) {
      sunRef.current.position.copy(playerPos).add(sunPos);
      sunRef.current.lookAt(playerPos);
      const sunColor = h < 0.05 ? '#ff3300' : (h < 0.2 ? lerpColor('#ff6622', '#ffffff', (h - 0.05) * 6.6) : '#ffffff');
      const sunMat = (sunRef.current.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      sunMat.color.set(sunColor);
    }

    if (atmosphereGlowRef.current) {
      atmosphereGlowRef.current.position.copy(playerPos).add(sunPos.clone().normalize().multiplyScalar(550));
      atmosphereGlowRef.current.lookAt(playerPos);
      const glowOpacity = Math.max(0, Math.min(0.6, (0.2 - Math.abs(h)) * 3));
      const mat = atmosphereGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = glowOpacity;
      mat.color.set(h > 0 ? '#ff7733' : '#ff4411');
    }

    if (moonRef.current) {
      moonRef.current.position.copy(playerPos).add(moonPos);
      moonRef.current.lookAt(playerPos);
    }
  });

  const glowMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 200, 100, 0.4)');
    grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <>
      <directionalLight ref={lightRef} />
      <directionalLight ref={moonLightRef} color="#b0c4de" />
      
      <group ref={sunRef}>
        <mesh>
          <planeGeometry args={[45, 45]} />
          <meshBasicMaterial color="#ffffff" fog={false} />
        </mesh>
      </group>

      <mesh ref={atmosphereGlowRef}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial 
          transparent 
          opacity={0} 
          fog={false} 
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={glowMap}
        />
      </mesh>

      <group ref={moonRef}>
        <mesh>
          <planeGeometry args={[35, 35]} />
          <meshBasicMaterial color="#d1d1e0" fog={false} />
        </mesh>
      </group>
    </>
  );
};

const WorldTicker: React.FC<{ worldManager: WorldManager, activeChunks: string[], setWorldVersion: React.Dispatch<React.SetStateAction<number>> }> = ({ worldManager, activeChunks, setWorldVersion }) => {
  useFrame((state) => { if (worldManager.tickFluids(activeChunks, state.clock.elapsedTime)) setWorldVersion(v => v + 1); });
  return null;
};

const App: React.FC = () => {
  const worldManager = useMemo(() => new WorldManager(), []);
  const [activeChunks, setActiveChunks] = useState<string[]>([]);
  const [playerChunk, setPlayerChunk] = useState({ x: 0, z: 0 });
  const [playerPos, setPlayerPos] = useState(new THREE.Vector3(32, 85, 32)); 
  const [isStarted, setIsStarted] = useState(false);
  const [worldVersion, setWorldVersion] = useState(0);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [craftingMode, setCraftingMode] = useState<'any' | 'workbench'>('any');
  
  const [time, setTime] = useState(0.3); 
  const [sunHeight, setSunHeight] = useState(0.5);

  const atmosphere = useMemo(() => {
    const h = sunHeight;
    let skyColor = '#000005';
    let fogColor = '#000005';
    let ambientIntensity = 0.15; 
    let starsIntensity = 0;

    if (h > 0.2) { 
      skyColor = '#1e90ff';
      fogColor = '#80bfff';
      ambientIntensity = 0.95; 
      starsIntensity = 0;
    } else if (h > 0) {
      const factor = h / 0.2;
      skyColor = lerpColor('#0a1020', '#1e90ff', factor);
      fogColor = lerpColor('#02020a', '#80bfff', factor);
      ambientIntensity = 0.35 + factor * 0.6; 
      starsIntensity = Math.max(0, 1 - factor * 2);
    } else if (h > -0.2) {
      const factor = (h + 0.2) / 0.2;
      skyColor = lerpColor('#000002', '#0a1020', factor);
      fogColor = '#000005';
      ambientIntensity = 0.2 + factor * 0.15;
      starsIntensity = Math.max(0, 1 - factor * 0.5);
    } else {
      skyColor = '#000002';
      fogColor = '#000002';
      ambientIntensity = 0.25; 
      starsIntensity = 1;
    }

    return { skyColor, fogColor, ambientIntensity, starsIntensity };
  }, [sunHeight]);

  const [customBlueprints, setCustomBlueprints] = useState<Record<string, Pixel[]>>(() => {
    const saved = localStorage.getItem('voxelcraft_blueprints');
    if (saved) { try { return { ...DEFAULT_BLUEPRINTS, ...JSON.parse(saved) }; } catch (e) { return DEFAULT_BLUEPRINTS; } }
    return DEFAULT_BLUEPRINTS;
  });

  const [allBlockBlueprints, setAllBlockBlueprints] = useState<Record<string, Pixel[]>>(() => {
    const hardcoded: Record<string, Pixel[]> = {
      "20_top_0": [{"x":0,"y":15,"color":"#745e39"},{"x":1,"y":15,"color":"#bd9862"},{"x":2,"y":15,"color":"#b5905b"},{"x":3,"y":15,"color":"#bd9862"},{"x":4,"y":15,"color":"#745d38"},{"x":5,"y":15,"color":"#bd9862"},{"x":6,"y":15,"color":"#9f844d"},{"x":7,"y":15,"color":"#bd9862"},{"x":8,"y":15,"color":"#745e39"},{"x":9,"y":15,"color":"#bb9962"},{"x":10,"y":15,"color":"#9f844e"},{"x":11,"y":15,"color":"#ba9a61"},{"x":12,"y":15,"color":"#725e39"},{"x":13,"y":15,"color":"#bd9862"},{"x":14,"y":15,"color":"#bd9862"},{"x":15,"y":15,"color":"#bd9862"},{"x":0,"y":14,"color":"#745e39"},{"x":1,"y":14,"color":"#bd9862"},{"x":2,"y":14,"color":"#a1844c"},{"x":3,"y":14,"color":"#bd9862"},{"x":4,"y":14,"color":"#695435"},{"x":5,"y":14,"color":"#b5905b"},{"x":6,"y":14,"color":"#9f844d"},{"x":7,"y":14,"color":"#bd9862"},{"x":8,"y":14,"color":"#745e39"},{"x":9,"y":14,"color":"#bb9962"},{"x":10,"y":14,"color":"#9f844e"},{"x":11,"y":14,"color":"#9f844e"},{"x":12,"y":14,"color":"#725e39"},{"x":13,"y":14,"color":"#bd9862"},{"x":14,"y":14,"color":"#bd9862"},{"x":15,"y":14,"color":"#9f844f"},{"x":0,"y":13,"color":"#745e39"},{"x":1,"y":13,"color":"#9e854d"},{"x":2,"y":13,"color":"#755c3e"},{"x":3,"y":13,"color":"#bd9862"},{"x":4,"y":13,"color":"#755d39"},{"x":5,"y":13,"color":"#b5905b"},{"x":6,"y":13,"color":"#9f844d"},{"x":7,"y":13,"color":"#bd9862"},{"x":8,"y":13,"color":"#6b5434"},{"x":9,"y":13,"color":"#bb9962"},{"x":10,"y":13,"color":"#725e39"},{"x":11,"y":13,"color":"#9f844e"},{"x":12,"y":13,"color":"#725e39"},{"x":13,"y":13,"color":"#9f844f"},{"x":14,"y":13,"color":"#b5905b"},{"x":15,"y":13,"color":"#9f844f"},{"x":0,"y":12,"color":"#7c623f"},{"x":1,"y":12,"color":"#9e854d"},{"x":2,"y":12,"color":"#bd9862"},{"x":3,"y":12,"color":"#bd9862"},{"x":4,"y":12,"color":"#755d39"},{"x":5,"y":12,"color":"#b5905b"},{"x":6,"y":12,"color":"#9f844d"},{"x":7,"y":12,"color":"#bd9862"},{"x":8,"y":12,"color":"#6b5434"},{"x":9,"y":12,"color":"#b5905b"},{"x":10,"y":12,"color":"#b5905b"},{"x":11,"y":12,"color":"#9f844e"},{"x":12,"y":12,"color":"#745e39"},{"x":13,"y":12,"color":"#9f844f"},{"x":14,"y":12,"color":"#745e39"},{"x":15,"y":12,"color":"#9f844f"},{"x":0,"y":11,"color":"#6b5434"},{"x":1,"y":11,"color":"#9e854d"},{"x":2,"y":11,"color":"#bd9862"},{"x":3,"y":11,"color":"#bd9862"},{"x":4,"y":11,"color":"#6a5435"},{"x":5,"y":11,"color":"#bd9864"},{"x":6,"y":11,"color":"#9f844d"},{"x":7,"y":11,"color":"#bd9862"},{"x":8,"y":11,"color":"#6b5434"},{"x":9,"y":11,"color":"#bb9962"},{"x":10,"y":11,"color":"#b5905b"},{"x":11,"y":11,"color":"#9f844e"},{"x":12,"y":11,"color":"#745e39"},{"x":13,"y":11,"color":"#9f844f"},{"x":14,"y":11,"color":"#b5905b"},{"x":15,"y":11,"color":"#9f844f"},{"x":0,"y":10,"color":"#6b5434"},{"x":1,"y":10,"color":"#bd9862"},{"x":2,"y":10,"color":"#bd9862"},{"x":3,"y":10,"color":"#9f844f"},{"x":4,"y":10,"color":"#6a5435"},{"x":5,"y":10,"color":"#bd9864"},{"x":6,"y":10,"color":"#b2915b"},{"x":7,"y":10,"color":"#755d38"},{"x":8,"y":10,"color":"#6b5434"},{"x":9,"y":10,"color":"#bb9962"},{"x":10,"y":10,"color":"#b5905b"},{"x":11,"y":10,"color":"#ba9964"},{"x":12,"y":10,"color":"#745e39"},{"x":13,"y":10,"color":"#9f844f"},{"x":14,"y":10,"color":"#b5905b"},{"x":15,"y":10,"color":"#bd9862"},{"x":0,"y":9,"color":"#7c6440"},{"x":1,"y":9,"color":"#bd9c65"},{"x":2,"y":9,"color":"#bd9c65"},{"x":3,"y":9,"color":"#bd9c65"},{"x":4,"y":9,"color":"#6a5435"},{"x":5,"y":9,"color":"#9e854e"},{"x":6,"y":9,"color":"#b2915b"},{"x":7,"y":9,"color":"#9f844f"},{"x":8,"y":9,"color":"#6b5434"},{"x":9,"y":9,"color":"#bd9863"},{"x":10,"y":9,"color":"#bd9863"},{"x":11,"y":9,"color":"#bd9863"},{"x":12,"y":9,"color":"#745e39"},{"x":13,"y":9,"color":"#b5905b"},{"x":14,"y":9,"color":"#9f844f"},{"x":15,"y":9,"color":"#bd9862"},{"x":0,"y":8,"color":"#725e39"},{"x":1,"y":8,"color":"#9f844f"},{"x":2,"y":8,"color":"#9f844f"},{"x":3,"y":8,"color":"#9f844f"},{"x":4,"y":8,"color":"#755d39"},{"x":5,"y":8,"color":"#9e854e"},{"x":6,"y":8,"color":"#b5905b"},{"x":7,"y":8,"color":"#bd9862"},{"x":8,"y":8,"color":"#745e39"},{"x":9,"y":8,"color":"#a0844f"},{"x":10,"y":8,"color":"#a0844f"},{"x":11,"y":8,"color":"#a0844f"},{"x":12,"y":8,"color":"#745e39"},{"x":13,"y":8,"color":"#b5905b"},{"x":14,"y":8,"color":"#9f844f"},{"x":15,"y":8,"color":"#b5905b"},{"x":0,"y":7,"color":"#745e37"},{"x":1,"y":7,"color":"#bd9862"},{"x":2,"y":7,"color":"#bd9862"},{"x":3,"y":7,"color":"#9f844f"},{"x":4,"y":7,"color":"#755d39"},{"x":5,"y":7,"color":"#9e854e"},{"x":6,"y":7,"color":"#9e854e"},{"x":7,"y":7,"color":"#bd9862"},{"x":8,"y":7,"color":"#745e39"},{"x":9,"y":7,"color":"#a0844f"},{"x":10,"y":7,"color":"#b3915b"},{"x":11,"y":7,"color":"#bd9862"},{"x":12,"y":7,"color":"#745e39"},{"x":13,"y":7,"color":"#735e39"},{"x":14,"y":7,"color":"#9f844f"},{"x":15,"y":7,"color":"#9f844f"},{"x":0,"y":6,"color":"#745e37"},{"x":1,"y":6,"color":"#bd9862"},{"x":2,"y":6,"color":"#b4915b"},{"x":3,"y":6,"color":"#755d39"},{"x":4,"y":6,"color":"#755d39"},{"x":5,"y":6,"color":"#9e854d"},{"x":6,"y":6,"color":"#9e854e"},{"x":7,"y":6,"color":"#b5905c"},{"x":8,"y":6,"color":"#745e39"},{"x":9,"y":6,"color":"#a0844f"},{"x":10,"y":6,"color":"#b3915b"},{"x":11,"y":6,"color":"#9d854c"},{"x":12,"y":6,"color":"#745e39"},{"x":13,"y":6,"color":"#bb9962"},{"x":14,"y":6,"color":"#9f844f"},{"x":15,"y":6,"color":"#bd9862"},{"x":0,"y":5,"color":"#725e39"},{"x":1,"y":5,"color":"#9f844f"},{"x":2,"y":5,"color":"#b4915b"},{"x":3,"y":5,"color":"#9f844f"},{"x":4,"y":5,"color":"#755d39"},{"x":5,"y":5,"color":"#b68f5c"},{"x":6,"y":5,"color":"#9e854d"},{"x":7,"y":5,"color":"#b5905c"},{"x":8,"y":5,"color":"#6b5434"},{"x":9,"y":5,"color":"#745d3b"},{"x":10,"y":5,"color":"#b3915b"},{"x":11,"y":5,"color":"#9d854c"},{"x":12,"y":5,"color":"#6b5335"},{"x":13,"y":5,"color":"#bb9962"},{"x":14,"y":5,"color":"#9f844f"},{"x":15,"y":5,"color":"#bd9862"},{"x":0,"y":4,"color":"#695532"},{"x":1,"y":4,"color":"#b39159"},{"x":2,"y":4,"color":"#a1844c"},{"x":3,"y":4,"color":"#9f844f"},{"x":4,"y":4,"color":"#755d39"},{"x":5,"y":4,"color":"#b68f5c"},{"x":6,"y":4,"color":"#bd9862"},{"x":7,"y":4,"color":"#bd9862"},{"x":8,"y":4,"color":"#6b5434"},{"x":9,"y":4,"color":"#bc9962"},{"x":10,"y":4,"color":"#b3915b"},{"x":11,"y":4,"color":"#6b5335"},{"x":12,"y":4,"color":"#6b5335"},{"x":13,"y":4,"color":"#b4905c"},{"x":14,"y":4,"color":"#b4905c"},{"x":15,"y":4,"color":"#bd9862"},{"x":0,"y":3,"color":"#695532"},{"x":1,"y":3,"color":"#bd9862"},{"x":2,"y":3,"color":"#a1844c"},{"x":3,"y":3,"color":"#b5905b"},{"x":4,"y":3,"color":"#745e39"},{"x":5,"y":3,"color":"#b68f5c"},{"x":6,"y":3,"color":"#bd9862"},{"x":7,"y":3,"color":"#bd9862"},{"x":8,"y":3,"color":"#6b5434"},{"x":9,"y":3,"color":"#bc9962"},{"x":10,"y":3,"color":"#9f844f"},{"x":11,"y":3,"color":"#b4905e"},{"x":12,"y":3,"color":"#6b5335"},{"x":13,"y":3,"color":"#bc9864"},{"x":14,"y":3,"color":"#9f844f"},{"x":15,"y":3,"color":"#bd9862"},{"x":0,"y":2,"color":"#6b5433"},{"x":1,"y":2,"color":"#bd9862"},{"x":2,"y":2,"color":"#a1844c"},{"x":3,"y":2,"color":"#bd9862"},{"x":4,"y":2,"color":"#685632"},{"x":5,"y":2,"color":"#b68f5c"},{"x":6,"y":2,"color":"#9e854e"},{"x":7,"y":2,"color":"#bd9862"},{"x":8,"y":2,"color":"#6b5434"},{"x":9,"y":2,"color":"#bc9962"},{"x":10,"y":2,"color":"#9f844f"},{"x":11,"y":2,"color":"#b4905e"},{"x":12,"y":2,"color":"#6b5335"},{"x":13,"y":2,"color":"#bc9864"},{"x":14,"y":2,"color":"#b4905b"},{"x":15,"y":2,"color":"#bd9862"},{"x":0,"y":1,"color":"#6b5433"},{"x":1,"y":1,"color":"#bd9862"},{"x":2,"y":1,"color":"#9f844f"},{"x":3,"y":1,"color":"#a1864e"},{"x":4,"y":1,"color":"#a1864e"},{"x":5,"y":1,"color":"#bd9862"},{"x":6,"y":1,"color":"#bd9862"},{"x":7,"y":1,"color":"#9f844f"},{"x":8,"y":1,"color":"#b99a64"},{"x":9,"y":1,"color":"#b99a64"},{"x":10,"y":1,"color":"#9f844f"},{"x":11,"y":1,"color":"#b5905b"},{"x":12,"y":1,"color":"#685632"},{"x":13,"y":1,"color":"#bd9862"},{"x":14,"y":1,"color":"#bd9862"},{"x":15,"y":1,"color":"#bd9862"},{"x":0,"y":0,"color":"#745e39"},{"x":1,"y":0,"color":"#bd9862"},{"x":2,"y":0,"color":"#b4905b"},{"x":3,"y":0,"color":"#bd9862"},{"x":4,"y":0,"color":"#725e38"},{"x":5,"y":0,"color":"#9e854e"},{"x":6,"y":0,"color":"#9e854e"},{"x":7,"y":0,"color":"#9e854e"},{"x":8,"y":0,"color":"#745e39"},{"x":9,"y":0,"color":"#bc9962"},{"x":10,"y":0,"color":"#9f844f"},{"x":11,"y":0,"color":"#bc9961"},{"x":12,"y":0,"color":"#745e39"},{"x":13,"y":0,"color":"#9f844f"},{"x":14,"y":0,"color":"#9f844f"},{"x":15,"y":0,"color":"#9f844f"}],
      "20_bottom_0": [{"x":0,"y":15,"color":"#bd9862"},{"x":1,"y":15,"color":"#9f844f"},{"x":2,"y":15,"color":"#9f844f"},{"x":3,"y":15,"color":"#9f844f"},{"x":4,"y":15,"color":"#9f844f"},{"x":5,"y":15,"color":"#bd9862"},{"x":6,"y":15,"color":"#bd9862"},{"x":7,"y":15,"color":"#b5905b"},{"x":8,"y":15,"color":"#9f844f"},{"x":9,"y":15,"color":"#bd9862"},{"x":10,"y":15,"color":"#bd9862"},{"x":11,"y":15,"color":"#bd9862"},{"x":12,"y":15,"color":"#bd9862"},{"x":13,"y":15,"color":"#bd9862"},{"x":14,"y":15,"color":"#bd9862"},{"x":15,"y":15,"color":"#9f844f"},{"x":0,"y":14,"color":"#bd9862"},{"x":1,"y":14,"color":"#bd9862"},{"x":2,"y":14,"color":"#b5905b"},{"x":3,"y":14,"color":"#735e39"},{"x":4,"y":14,"color":"#bd9862"},{"x":5,"y":14,"color":"#bd9862"},{"x":6,"y":14,"color":"#9f844f"},{"x":7,"y":14,"color":"#9f844f"},{"x":8,"y":14,"color":"#9f844f"},{"x":9,"y":14,"color":"#9f844f"},{"x":10,"y":14,"color":"#9f844f"},{"x":11,"y":14,"color":"#b2915b"},{"x":12,"y":14,"color":"#a08350"},{"x":13,"y":14,"color":"#b68f5b"},{"x":14,"y":14,"color":"#bd9862"},{"x":15,"y":14,"color":"#9f844f"},{"x":0,"y":13,"color":"#bd9862"},{"x":1,"y":13,"color":"#bd9862"},{"x":2,"y":13,"color":"#9f844e"},{"x":3,"y":13,"color":"#9f844e"},{"x":4,"y":13,"color":"#9f844e"},{"x":5,"y":13,"color":"#9f844e"},{"x":6,"y":13,"color":"#b5905c"},{"x":7,"y":13,"color":"#b5905c"},{"x":8,"y":13,"color":"#745e39"},{"x":9,"y":13,"color":"#be9764"},{"x":10,"y":13,"color":"#be9764"},{"x":11,"y":13,"color":"#b2915b"},{"x":12,"y":13,"color":"#be9764"},{"x":13,"y":13,"color":"#be9764"},{"x":14,"y":13,"color":"#bd9862"},{"x":15,"y":13,"color":"#9f844f"},{"x":0,"y":12,"color":"#6b5434"},{"x":1,"y":12,"color":"#735e39"},{"x":2,"y":12,"color":"#735e39"},{"x":3,"y":12,"color":"#735e39"},{"x":4,"y":12,"color":"#735e39"},{"x":5,"y":12,"color":"#745e39"},{"x":6,"y":12,"color":"#745e39"},{"x":7,"y":12,"color":"#745e39"},{"x":8,"y":12,"color":"#745e39"},{"x":9,"y":12,"color":"#745e39"},{"x":10,"y":12,"color":"#6b5434"},{"x":11,"y":12,"color":"#6b5434"},{"x":12,"y":12,"color":"#6b5434"},{"x":13,"y":12,"color":"#6b5434"},{"x":14,"y":12,"color":"#745e39"},{"x":15,"y":12,"color":"#745e39"},{"x":0,"y":11,"color":"#b5905c"},{"x":1,"y":11,"color":"#9f844f"},{"x":2,"y":11,"color":"#9f844f"},{"x":3,"y":11,"color":"#9f844f"},{"x":4,"y":11,"color":"#9f844f"},{"x":5,"y":11,"color":"#bd9861"},{"x":6,"y":11,"color":"#bd9861"},{"x":7,"y":11,"color":"#9f844f"},{"x":8,"y":11,"color":"#b5905b"},{"x":9,"y":11,"color":"#9f844f"},{"x":10,"y":11,"color":"#9f844f"},{"x":11,"y":11,"color":"#6b5434"},{"x":12,"y":11,"color":"#b4905b"},{"x":13,"y":11,"color":"#b4905b"},{"x":14,"y":11,"color":"#b4905b"},{"x":15,"y":11,"color":"#b4905b"},{"x":0,"y":10,"color":"#9f844f"},{"x":1,"y":10,"color":"#9f844f"},{"x":2,"y":10,"color":"#725f37"},{"x":3,"y":10,"color":"#b5905b"},{"x":4,"y":10,"color":"#b28f57"},{"x":5,"y":10,"color":"#b5905b"},{"x":6,"y":10,"color":"#b5905b"},{"x":7,"y":10,"color":"#9f844f"},{"x":8,"y":10,"color":"#b5905b"},{"x":9,"y":10,"color":"#b5905b"},{"x":10,"y":10,"color":"#b5905b"},{"x":11,"y":10,"color":"#b5905b"},{"x":12,"y":10,"color":"#9f844f"},{"x":13,"y":10,"color":"#9f844f"},{"x":14,"y":10,"color":"#9f844f"},{"x":15,"y":10,"color":"#9f844f"},{"x":0,"y":9,"color":"#bc9962"},{"x":1,"y":9,"color":"#bc9962"},{"x":2,"y":9,"color":"#bc9962"},{"x":3,"y":9,"color":"#b5905b"},{"x":4,"y":9,"color":"#bd9861"},{"x":5,"y":9,"color":"#bd9861"},{"x":6,"y":9,"color":"#bd9861"},{"x":7,"y":9,"color":"#9f844f"},{"x":8,"y":9,"color":"#9f844f"},{"x":9,"y":9,"color":"#9f844f"},{"x":10,"y":9,"color":"#745d3b"},{"x":11,"y":9,"color":"#9f844d"},{"x":12,"y":9,"color":"#be9762"},{"x":13,"y":9,"color":"#be9762"},{"x":14,"y":9,"color":"#be9762"},{"x":15,"y":9,"color":"#be9762"},{"x":0,"y":8,"color":"#745e39"},{"x":1,"y":8,"color":"#745e39"},{"x":2,"y":8,"color":"#6b5434"},{"x":3,"y":8,"color":"#6b5434"},{"x":4,"y":8,"color":"#6b5434"},{"x":5,"y":8,"color":"#6b5434"},{"x":6,"y":8,"color":"#6b5434"},{"x":7,"y":8,"color":"#6b5434"},{"x":8,"y":8,"color":"#745d3a"},{"x":9,"y":8,"color":"#745d3a"},{"x":10,"y":8,"color":"#745d3b"},{"x":11,"y":8,"color":"#745d3b"},{"x":12,"y":8,"color":"#745d3b"},{"x":13,"y":8,"color":"#745d3b"},{"x":14,"y":8,"color":"#745e39"},{"x":15,"y":8,"color":"#745e39"},{"x":0,"y":7,"color":"#bd9864"},{"x":1,"y":7,"color":"#bd9864"},{"x":2,"y":7,"color":"#bd9861"},{"x":3,"y":7,"color":"#bd9861"},{"x":4,"y":7,"color":"#bd9861"},{"x":5,"y":7,"color":"#6b5434"},{"x":6,"y":7,"color":"#9f844f"},{"x":7,"y":7,"color":"#bd9863"},{"x":8,"y":7,"color":"#bd9863"},{"x":9,"y":7,"color":"#b59059"},{"x":10,"y":7,"color":"#b59059"},{"x":11,"y":7,"color":"#b59059"},{"x":12,"y":7,"color":"#bd9862"},{"x":13,"y":7,"color":"#bb9460"},{"x":14,"y":7,"color":"#bb9460"},{"x":15,"y":7,"color":"#9f844f"},{"x":0,"y":6,"color":"#a38a54"},{"x":1,"y":6,"color":"#a38a54"},{"x":2,"y":6,"color":"#a38a54"},{"x":3,"y":6,"color":"#a38a54"},{"x":4,"y":6,"color":"#a38a54"},{"x":5,"y":6,"color":"#bb9860"},{"x":6,"y":6,"color":"#b2915b"},{"x":7,"y":6,"color":"#b2915b"},{"x":8,"y":6,"color":"#9f844f"},{"x":9,"y":6,"color":"#9f844f"},{"x":10,"y":6,"color":"#9f844f"},{"x":11,"y":6,"color":"#735d3b"},{"x":12,"y":6,"color":"#bd9862"},{"x":13,"y":6,"color":"#9f844f"},{"x":14,"y":6,"color":"#9f844f"},{"x":15,"y":6,"color":"#9f844f"},{"x":0,"y":5,"color":"#bd9863"},{"x":1,"y":5,"color":"#b5905b"},{"x":2,"y":5,"color":"#b5905b"},{"x":3,"y":5,"color":"#bd9862"},{"x":4,"y":5,"color":"#bd9862"},{"x":5,"y":5,"color":"#bd9862"},{"x":6,"y":5,"color":"#bd9862"},{"x":7,"y":5,"color":"#9f844f"},{"x":8,"y":5,"color":"#b99a64"},{"x":9,"y":5,"color":"#b2915b"},{"x":10,"y":5,"color":"#b2915b"},{"x":11,"y":5,"color":"#b2915b"},{"x":12,"y":5,"color":"#9f844c"},{"x":13,"y":5,"color":"#9f844c"},{"x":14,"y":5,"color":"#9f844c"},{"x":15,"y":5,"color":"#b5925c"},{"x":0,"y":4,"color":"#765c37"},{"x":1,"y":4,"color":"#695534"},{"x":2,"y":4,"color":"#755d38"},{"x":3,"y":4,"color":"#755d38"},{"x":4,"y":4,"color":"#695434"},{"x":5,"y":4,"color":"#695434"},{"x":6,"y":4,"color":"#695434"},{"x":7,"y":4,"color":"#745d3a"},{"x":8,"y":4,"color":"#745d3a"},{"x":9,"y":4,"color":"#745d3a"},{"x":10,"y":4,"color":"#745d3a"},{"x":11,"y":4,"color":"#745d3a"},{"x":12,"y":4,"color":"#695435"},{"x":13,"y":4,"color":"#695435"},{"x":14,"y":4,"color":"#695435"},{"x":15,"y":4,"color":"#755d38"},{"x":0,"y":3,"color":"#bd9862"},{"x":1,"y":3,"color":"#bd9862"},{"x":2,"y":3,"color":"#bd9862"},{"x":3,"y":3,"color":"#bd9862"},{"x":4,"y":3,"color":"#bd9862"},{"x":5,"y":3,"color":"#9f844f"},{"x":6,"y":3,"color":"#bd9862"},{"x":7,"y":3,"color":"#9f844f"},{"x":8,"y":3,"color":"#9f8450"},{"x":9,"y":3,"color":"#745d3a"},{"x":10,"y":3,"color":"#9f844f"},{"x":11,"y":3,"color":"#9f844f"},{"x":12,"y":3,"color":"#9f844f"},{"x":13,"y":3,"color":"#b99a62"},{"x":14,"y":3,"color":"#b99a62"},{"x":15,"y":3,"color":"#b99a62"},{"x":0,"y":2,"color":"#bd9862"},{"x":1,"y":2,"color":"#9f844f"},{"x":2,"y":2,"color":"#725f37"},{"x":3,"y":2,"color":"#bd9862"},{"x":4,"y":2,"color":"#bd9862"},{"x":5,"y":2,"color":"#bd9862"},{"x":6,"y":2,"color":"#bd9862"},{"x":7,"y":2,"color":"#9f844f"},{"x":8,"y":2,"color":"#b99a64"},{"x":9,"y":2,"color":"#b2915b"},{"x":10,"y":2,"color":"#b2915b"},{"x":11,"y":2,"color":"#b2915b"},{"x":12,"y":2,"color":"#9f844c"},{"x":13,"y":2,"color":"#9f844c"},{"x":14,"y":2,"color":"#9f844c"},{"x":15,"y":2,"color":"#b5925c"},{"x":0,"y":1,"color":"#bd9862"},{"x":1,"y":1,"color":"#bd9862"},{"x":2,"y":1,"color":"#9f844f"},{"x":3,"y":1,"color":"#a1864e"},{"x":4,"y":1,"color":"#a1864e"},{"x":5,"y":1,"color":"#bd9862"},{"x":6,"y":1,"color":"#bd9862"},{"x":7,"y":1,"color":"#9f844f"},{"x":8,"y":1,"color":"#b99a64"},{"x":9,"y":1,"color":"#b99a64"},{"x":10,"y":1,"color":"#9f844f"},{"x":11,"y":1,"color":"#b5905b"},{"x":12,"y":1,"color":"#685632"},{"x":13,"y":1,"color":"#bd9862"},{"x":14,"y":1,"color":"#bd9862"},{"x":15,"y":1,"color":"#bd9862"},{"x":0,"y":0,"color":"#745e39"},{"x":1,"y":0,"color":"#bd9862"},{"x":2,"y":0,"color":"#b4905b"},{"x":3,"y":0,"color":"#bd9862"},{"x":4,"y":0,"color":"#725e38"},{"x":5,"y":0,"color":"#9e854e"},{"x":6,"y":0,"color":"#9e854e"},{"x":7,"y":0,"color":"#9e854e"},{"x":8,"y":0,"color":"#745e39"},{"x":9,"y":0,"color":"#bc9962"},{"x":10,"y":0,"color":"#9f844f"},{"x":11,"y":0,"color":"#bc9961"},{"x":12,"y":0,"color":"#745e39"},{"x":13,"y":0,"color":"#9f844f"},{"x":14,"y":0,"color":"#9f844f"},{"x":15,"y":0,"color":"#9f844f"}],
    };
    const saved = localStorage.getItem('voxelcraft_block_blueprints');
    if (saved) { 
      try { 
        return { ...hardcoded, ...JSON.parse(saved) }; 
      } catch (e) { 
        return hardcoded; 
      } 
    }
    return hardcoded;
  });

  const [customTransforms, setCustomTransforms] = useState<Record<string, ToolTransform>>(() => {
    const saved = localStorage.getItem('voxelcraft_transforms');
    if (saved) { try { return { ...DEFAULT_TRANSFORMS, ...JSON.parse(saved) }; } catch (e) { return DEFAULT_TRANSFORMS; } }
    return DEFAULT_TRANSFORMS;
  });

  useEffect(() => {
    const texMgr = TextureManager.getInstance();
    const customAtlasData: Record<number, Record<string, string>> = {};
    
    Object.entries(allBlockBlueprints).forEach(([key, pixels]) => {
      const parts = key.split('_');
      const type = Number(parts[0]) as BlockType;
      const face = parts[1] as BlockFace;
      const variant = parts.length > 2 ? Number(parts[2]) : 0;
      
      const texIndices = BLOCK_TEXTURES[type];
      if (texIndices) {
        const baseIndex = texIndices[face];
        const finalIndex = baseIndex + variant;
        
        const pixelMap: Record<string, string> = {};
        (pixels as Pixel[]).forEach(p => pixelMap[`${p.x},${p.y}`] = p.color);
        customAtlasData[finalIndex] = pixelMap;
      }
    });

    (Object.entries(customBlueprints) as [string, Pixel[]][]).forEach(([type, pixels]) => {
      const idx = TOOL_TEXTURES[type];
      if (idx !== undefined) {
        const pixelMap: Record<string, string> = {};
        pixels.forEach(p => pixelMap[`${p.x},${p.y}`] = p.color);
        customAtlasData[idx] = pixelMap;
      }
    });
    
    texMgr.setCustomTextures(customAtlasData);
    setWorldVersion(v => v + 1);
  }, [allBlockBlueprints, customBlueprints]);
  
  const [inventory, setInventory] = useState<(ItemStack | null)[]>(() => {
    const inv = new Array(INVENTORY_SIZE).fill(null);
    inv[27] = { type: ToolType.PICKAXE, count: 1 };
    inv[28] = { type: ToolType.AXE, count: 1 }; 
    inv[30] = { type: BlockType.WOOD, count: 64 };
    inv[31] = { type: BlockType.DIRT, count: 64 };
    inv[32] = { type: BlockType.STONE, count: 64 };
    inv[33] = { type: BlockType.COAL_ORE, count: 64 }; 
    return inv;
  });

  const [craftingGrid, setCraftingGrid] = useState<(ItemStack | null)[]>(new Array(4).fill(null));
  const [workbenchGrid, setWorkbenchGrid] = useState<(ItemStack | null)[]>(new Array(9).fill(null));
  const [craftingOutput, setCraftingOutput] = useState<ItemStack | null>(null);
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0); 
  const [drops, setDrops] = useState<DropEntity[]>([]);
  const [pendingParticles, setPendingParticles] = useState<ParticleData[]>([]);

  const handleSaveBlueprint = useCallback((type: ToolType | BlockType, pixels: Pixel[], transform?: ToolTransform, face?: BlockFace, variant?: number) => {
    if (typeof type === 'string' || face === undefined) {
      setCustomBlueprints(prev => {
        const next = { ...prev, [type]: pixels };
        localStorage.setItem('voxelcraft_blueprints', JSON.stringify(next));
        return next;
      });
      if (transform) {
        setCustomTransforms(prev => {
          const next = { ...prev, [type]: transform };
          localStorage.setItem('voxelcraft_transforms', JSON.stringify(next));
          return next;
        });
      }
    } else {
      setAllBlockBlueprints(prev => {
        const varSuffix = variant !== undefined ? `_${variant}` : '_0';
        const next = { ...prev, [`${type}_${face}${varSuffix}`]: pixels };
        localStorage.setItem('voxelcraft_block_blueprints', JSON.stringify(next));
        return next;
      });
      worldManager.invalidateAllMeshes();
      setWorldVersion(v => v + 1);
    }
  }, [worldManager]);

  const spawnParticles = useCallback((pos: THREE.Vector3, type: BlockType, count: number, velocityMult: number = 1) => {
    const newOnes: ParticleData[] = [];
    for (let i = 0; i < count; i++) {
      newOnes.push({
        id: Math.random().toString(36).substring(2, 9),
        x: pos.x, y: pos.y, z: pos.z,
        vx: (Math.random() - 0.5) * 6 * velocityMult, vy: (Math.random() * 6 + 2) * velocityMult, vz: (Math.random() - 0.5) * 6 * velocityMult,
        type, life: 0.8 + Math.random() * 0.4, scale: 0.1 + Math.random() * 0.1
      });
    }
    setPendingParticles(prev => [...prev, ...newOnes]);
  }, []);

  const checkRecipe = useCallback((grid: (ItemStack | null)[]) => {
    const size = Math.sqrt(grid.length);
    let minX = size, maxX = -1, minY = size, maxY = -1;
    let hasItems = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y * size + x]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          hasItems = true;
        }
      }
    }
    if (!hasItems) return null;
    const gridW = maxX - minX + 1;
    const gridH = maxY - minY + 1;
    const gridItems: (BlockType | ToolType | null)[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        gridItems.push(grid[y * size + x]?.type || null);
      }
    }
    for (const recipe of RECIPES_LIST) {
      if (recipe.mode === 'workbench' && craftingMode !== 'workbench') continue;
      const rSize = Math.sqrt(recipe.layout.length);
      let rMinX = rSize, rMaxX = -1, rMinY = rSize, rMaxY = -1;
      let rHasItems = false;
      for (let y = 0; y < rSize; y++) {
        for (let x = 0; x < rSize; x++) {
          if (recipe.layout[y * rSize + x] !== null) {
            rMinX = Math.min(rMinX, x); rMaxX = Math.max(rMaxX, x);
            rMinY = Math.min(rMinY, y); rMaxY = Math.max(rMaxY, y);
            rHasItems = true;
          }
        }
      }
      if (!rHasItems) continue;
      const rW = rMaxX - rMinX + 1;
      const rH = rMaxY - rMinY + 1;
      if (gridW === rW && gridH === rH) {
        let match = true;
        for (let y = 0; y < rH; y++) {
          for (let x = 0; x < rW; x++) {
            const gType = gridItems[y * rW + x];
            const rType = recipe.layout[(rMinY + y) * rSize + (rMinX + x)];
            if (gType !== rType) { match = false; break; }
          }
          if (!match) break;
        }
        if (match) return { type: recipe.result, count: recipe.resultCount };
      }
    }
    return null;
  }, [craftingMode]);

  useEffect(() => { 
    const currentGrid = craftingMode === 'any' ? craftingGrid : workbenchGrid;
    setCraftingOutput(checkRecipe(currentGrid)); 
  }, [craftingGrid, workbenchGrid, craftingMode, checkRecipe]);

  const handleRecipeSelect = useCallback((recipe: Recipe): boolean => {
      const totalAvailable: Record<string, number> = {};
      inventory.forEach(item => {
          if (item) totalAvailable[item.type] = (totalAvailable[item.type] || 0) + item.count;
      });
      for (const ing of recipe.ingredients) {
          if ((totalAvailable[ing.type] || 0) < ing.count) return false;
      }
      const gridSetter = craftingMode === 'any' ? setCraftingGrid : setWorkbenchGrid;
      gridSetter(recipe.layout.map(type => type ? { type, count: 1 } : null) as any);
      setInventory(prev => {
        const next = [...prev];
        recipe.ingredients.forEach(ing => {
          let needed = ing.count;
          for (let i = 0; i < next.length && needed > 0; i++) {
            if (next[i]?.type === ing.type) {
              const take = Math.min(next[i]!.count, needed);
              next[i] = next[i]!.count > take ? { ...next[i]!, count: next[i]!.count - take } : null;
              needed -= take;
            }
          }
        });
        return next;
      });
      return true;
  }, [craftingMode, inventory]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (e.altKey && e.code === 'KeyP') { setIsEditorOpen(prev => !prev); if (!isStarted) setIsStarted(true); }
      if (e.code === 'KeyE' && isStarted && !isEditorOpen) { if (isInventoryOpen) { setIsInventoryOpen(false); setCraftingMode('any'); } else setIsInventoryOpen(true); }
      if (e.code === 'Escape' && !isInputFocused) { if (isEditorOpen) setIsEditorOpen(false); else if (isInventoryOpen) { setIsInventoryOpen(false); setCraftingMode('any'); } }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isStarted, isInventoryOpen, isEditorOpen]);

  const handleSlotClick = useCallback((index: number, isRightClick: boolean) => {
    setInventory(prevInv => {
      const newInv = [...prevInv];
      const slotItem = newInv[index];
      if (!isRightClick) {
        if (!heldItem) { 
          if (slotItem) { setHeldItem(slotItem); newInv[index] = null; } 
        } else {
          if (!slotItem) { newInv[index] = heldItem; setHeldItem(null); }
          else if (slotItem.type === heldItem.type && typeof slotItem.type === 'number') {
            const canAdd = 64 - slotItem.count; 
            const toAdd = Math.min(canAdd, heldItem.count);
            newInv[index] = { ...slotItem, count: slotItem.count + toAdd };
            const remaining = heldItem.count - toAdd; 
            setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null);
          } else { newInv[index] = heldItem; setHeldItem(slotItem); }
        }
      } else {
        if (!heldItem) { 
          if (slotItem) { 
            const take = Math.ceil(slotItem.count / 2); 
            setHeldItem({ ...slotItem, count: take }); 
            const remaining = slotItem.count - take; 
            newInv[index] = remaining > 0 ? { ...slotItem, count: remaining } : null; 
          } 
        } else {
          if (!slotItem) { 
            newInv[index] = { ...heldItem, count: 1 }; 
            const remaining = heldItem.count - 1; 
            setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null); 
          } else if (slotItem.type === heldItem.type && typeof slotItem.type === 'number' && slotItem.count < 64) { 
            newInv[index] = { ...slotItem, count: slotItem.count + 1 }; 
            const remaining = heldItem.count - 1; 
            setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null); 
          } else { newInv[index] = heldItem; setHeldItem(slotItem); }
        }
      }
      return newInv;
    });
  }, [heldItem]);

  const handleCraftingClick = useCallback((index: number, isRightClick: boolean) => {
    const gridSetter = craftingMode === 'any' ? setCraftingGrid : setWorkbenchGrid;
    gridSetter(prev => {
      const newGrid = [...prev];
      const slotItem = newGrid[index];
      if (!isRightClick) {
        if (!heldItem) { if (slotItem) { setHeldItem(slotItem); newGrid[index] = null; } }
        else {
          if (!slotItem) { newGrid[index] = heldItem; setHeldItem(null); }
          else if (slotItem.type === heldItem.type) {
            const canAdd = 64 - slotItem.count;
            const toAdd = Math.min(canAdd, heldItem.count);
            newGrid[index] = { ...slotItem, count: slotItem.count + toAdd };
            const rem = heldItem.count - toAdd;
            setHeldItem(rem > 0 ? { ...heldItem, count: rem } : null);
          } else { newGrid[index] = heldItem; setHeldItem(slotItem); }
        }
      } else {
        if (!heldItem) {
          if (slotItem) {
            const take = Math.ceil(slotItem.count / 2);
            setHeldItem({ ...slotItem, count: take });
            const rem = slotItem.count - take;
            newGrid[index] = rem > 0 ? { ...slotItem, count: rem } : null;
          }
        } else {
          if (!slotItem) {
            newGrid[index] = { ...heldItem, count: 1 };
            const rem = heldItem.count - 1; 
            setHeldItem(rem > 0 ? { ...heldItem, count: rem } : null);
          } else if (slotItem.type === heldItem.type && slotItem.count < 64) {
            newGrid[index] = { ...slotItem, count: slotItem.count + 1 };
            const rem = heldItem.count - 1;
            setHeldItem(rem > 0 ? { ...heldItem, count: rem } : null);
          } else { newGrid[index] = heldItem; setHeldItem(slotItem); }
        }
      }
      return newGrid;
    });
  }, [heldItem, craftingMode]);

  const handleOutputClick = useCallback(() => {
    if (!craftingOutput) return;
    if (heldItem) {
      if (heldItem.type !== craftingOutput.type || (heldItem.count + craftingOutput.count > 64)) return;
      setHeldItem({ ...heldItem, count: heldItem.count + craftingOutput.count });
    } else { setHeldItem({ ...craftingOutput }); }
    const gridSetter = craftingMode === 'any' ? setCraftingGrid : setWorkbenchGrid;
    gridSetter(prev => prev.map(slot => {
      if (!slot) return null;
      const nextCount = slot.count - 1;
      return nextCount > 0 ? { ...slot, count: nextCount } : null;
    }));
  }, [craftingOutput, heldItem, craftingMode]);

  const handleBlockBreak = useCallback((pos: THREE.Vector3, type: BlockType) => {
    setWorldVersion(v => v + 1); const center = pos.clone().add(new THREE.Vector3(0.5, 0.5, 0.5));
    setDrops(prev => [...prev, { id: Math.random().toString(36).substring(7), type, position: center.clone(), velocity: new THREE.Vector3((Math.random() - 0.5), Math.random() * 2 + 1, (Math.random() - 0.5)) }]);
    spawnParticles(center, type, 25, 1.8);
  }, [spawnParticles]);

  const handleCollect = useCallback((id: string, type: BlockType) => {
    setDrops(prev => prev.filter(d => d.id !== id));
    setInventory(prev => {
      const newInv = [...prev]; 
      const existingIdx = newInv.findIndex(slot => slot?.type === type && slot.count < 64);
      if (existingIdx !== -1) { 
        newInv[existingIdx] = { ...newInv[existingIdx]!, count: newInv[existingIdx]!.count + 1 }; 
        return newInv; 
      }
      const emptyIdx = newInv.findIndex(slot => slot === null); 
      if (emptyIdx !== -1) newInv[emptyIdx] = { type, count: 1 }; 
      return newInv;
    });
  }, []);

  // Fix: Removed duplicate nested loop over 'x' and added 'z' loop correctly.
  const updateVisibleChunks = useCallback((pos: THREE.Vector3) => {
    const cx = Math.floor(pos.x / CHUNK_SIZE); 
    const cz = Math.floor(pos.z / CHUNK_SIZE); 
    setPlayerPos(pos.clone());
    if (cx === playerChunk.x && cz === playerChunk.z && activeChunks.length > 0) return;
    setPlayerChunk({ x: cx, z: cz });
    const newVisible: string[] = [];
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const key = worldManager.getChunkKey(cx + x, cz + z); 
        if (!worldManager.chunks.has(key)) worldManager.generateChunk(cx + x, cz + z);
        newVisible.push(key);
      }
    }
    setActiveChunks(newVisible);
  }, [playerChunk.x, playerChunk.z, activeChunks.length, worldManager]);

  // Fix: Corrected typo 'DEFAULT_BLUEBYPRINTS' to 'DEFAULT_BLUEPRINTS' and removed redundancy.
  const handleResetWorld = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); 
    worldManager.clearWorld(); 
    setCustomBlueprints(DEFAULT_BLUEPRINTS);
    setAllBlockBlueprints({});
    setCustomTransforms(DEFAULT_TRANSFORMS);
    setActiveChunks([]); 
    setWorldVersion(v => v + 1);
  }, [worldManager]);

  const handleStartGame = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsStarted(true);
  }, []);

  return (
    <div className="w-full h-screen" style={{ backgroundColor: atmosphere.skyColor }}>
      <Canvas camera={{ fov: 75, position: [32, 85, 32], near: 0.1, far: 2000 }}>
        <fogExp2 attach="fog" args={[atmosphere.fogColor, 0.008]} />
        <color attach="background" args={[atmosphere.skyColor]} />
        <DayNightController onTimeUpdate={setTime} onSunHeightUpdate={setSunHeight} playerPos={playerPos} />
        <Stars intensity={atmosphere.starsIntensity} />
        <Clouds playerPos={playerPos} sunHeight={sunHeight} atmosphere={atmosphere} />
        <hemisphereLight args={[atmosphere.skyColor, '#000000', atmosphere.ambientIntensity]} />
        <ambientLight intensity={atmosphere.ambientIntensity * 0.45} />
        {activeChunks.map((key) => { const [cx, cz] = key.split(',').map(Number); return <Chunk key={key} meshData={worldManager.getOrBuildMesh(cx, cz)} />; })}
        <WorldTicker worldManager={worldManager} activeChunks={activeChunks} setWorldVersion={setWorldVersion} />
        <Drops drops={drops} />
        <Particles newParticles={pendingParticles} onProcessed={() => setPendingParticles([])} />
        {isStarted && (
          <Player 
            onMove={updateVisibleChunks} 
            onUnlock={() => { if (!isInventoryOpen && !isEditorOpen) setIsStarted(false); }} 
            worldManager={worldManager} 
            inventory={inventory} 
            setInventory={setInventory} 
            selectedSlot={selectedSlot} 
            setSelectedSlot={setSelectedSlot} 
            onBlockBreak={handleBlockBreak} 
            onBlockPlace={() => setWorldVersion(v => v + 1)} 
            onCollect={handleCollect} 
            drops={drops} 
            isPaused={isInventoryOpen || isEditorOpen} 
            onBlockHit={spawnParticles} 
            onOpenWorkbench={() => { setCraftingMode('workbench'); setIsInventoryOpen(true); }}
            customBlueprints={customBlueprints} 
            customTransforms={customTransforms} 
          />
        )}
      </Canvas>
      {isStarted && (
        <>
          {!isInventoryOpen && !isEditorOpen && <Crosshair />}
          <Hotbar inventory={inventory} selectedSlot={selectedSlot} worldVersion={worldVersion} />
          <Inventory 
            isOpen={isInventoryOpen} 
            inventory={inventory} 
            craftingGrid={craftingMode === 'any' ? craftingGrid : workbenchGrid} 
            craftingOutput={craftingOutput} 
            heldItem={heldItem} 
            craftingMode={craftingMode}
            onSlotClick={handleSlotClick} 
            onCraftingClick={handleCraftingClick} 
            onOutputClick={handleOutputClick} 
            onClose={() => { setIsInventoryOpen(false); setCraftingMode('any'); }} 
            onRecipeSelect={handleRecipeSelect}
            worldVersion={worldVersion}
          />
          <ItemEditor 
            isOpen={isEditorOpen} 
            onClose={() => setIsEditorOpen(false)} 
            onSave={handleSaveBlueprint} 
            allBlueprints={customBlueprints} 
            allBlockBlueprints={allBlockBlueprints}
            allTransforms={customTransforms} 
          />
        </>
      )}
      {!isStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer" onPointerDown={handleStartGame}>
          <div className="p-12 bg-zinc-900 border-4 border-zinc-700 rounded-3xl text-center shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
            <h1 className="text-6xl font-black text-white mb-6 uppercase italic tracking-tighter">VoxelCraft</h1>
            <div className="text-zinc-400 mb-8 space-y-1 font-mono text-sm">
               <p>W,A,S,D - Движение | SPACE - Прыжок</p>
               <p>E - Инвентарь</p>
               <p><b>Удерживать ЛКМ</b> - Добыча | ПКМ - Поставить блок / Верстак</p>
               <p className="text-green-500 mt-2">ALT+P - Редактор дизайна</p>
            </div>
            <div className="flex flex-col gap-4">
              <div 
                className="px-12 py-5 bg-green-600 text-white font-bold rounded-xl text-2xl hover:bg-green-500 transition-all uppercase cursor-pointer"
                onPointerDown={handleStartGame}
              >Войти в мир</div>
              <button onClick={handleResetWorld} className="text-zinc-500 hover:text-red-500 transition-colors uppercase text-xs font-bold">Сброс мира (Удалить всё)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
