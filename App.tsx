
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
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <>
      <directionalLight ref={lightRef} />
      <directionalLight ref={moonLightRef} color="#b0c4de" />
      <group ref={sunRef}><mesh><planeGeometry args={[45, 45]} /><meshBasicMaterial color="#ffffff" fog={false} /></mesh></group>
      <mesh ref={atmosphereGlowRef}><planeGeometry args={[400, 400]} /><meshBasicMaterial transparent opacity={0} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} map={glowMap}/></mesh>
      <group ref={moonRef}><mesh><planeGeometry args={[35, 35]} /><meshBasicMaterial color="#d1d1e0" fog={false} /></mesh></group>
    </>
  );
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

  useEffect(() => {
    worldManager.setOnChunkLoaded(() => setWorldVersion(v => v + 1));
  }, [worldManager]);

  const atmosphere = useMemo(() => {
    const h = sunHeight;
    let skyColor = '#000005', fogColor = '#000005', ambientIntensity = 0.15, starsIntensity = 0;
    if (h > 0.2) { skyColor = '#1e90ff'; fogColor = '#80bfff'; ambientIntensity = 0.95; starsIntensity = 0; }
    else if (h > 0) { const f = h / 0.2; skyColor = lerpColor('#0a1020', '#1e90ff', f); fogColor = lerpColor('#02020a', '#80bfff', f); ambientIntensity = 0.35 + f * 0.6; starsIntensity = Math.max(0, 1 - f * 2); }
    else if (h > -0.2) { const f = (h + 0.2) / 0.2; skyColor = lerpColor('#000002', '#0a1020', f); fogColor = '#000005'; ambientIntensity = 0.2 + f * 0.15; starsIntensity = Math.max(0, 1 - f * 0.5); }
    else { skyColor = '#000002'; fogColor = '#000002'; ambientIntensity = 0.25; starsIntensity = 1; }
    return { skyColor, fogColor, ambientIntensity, starsIntensity };
  }, [sunHeight]);

  const [customBlueprints, setCustomBlueprints] = useState<Record<string, Pixel[]>>(() => {
    const saved = localStorage.getItem('voxelcraft_blueprints');
    return saved ? { ...DEFAULT_BLUEPRINTS, ...JSON.parse(saved) } : DEFAULT_BLUEPRINTS;
  });

  const [allBlockBlueprints, setAllBlockBlueprints] = useState<Record<string, Pixel[]>>({});
  const [customTransforms, setCustomTransforms] = useState<Record<string, ToolTransform>>(DEFAULT_TRANSFORMS);

  const [inventory, setInventory] = useState<(ItemStack | null)[]>(() => {
    const inv = new Array(INVENTORY_SIZE).fill(null);
    inv[27] = { type: ToolType.PICKAXE, count: 1 };
    inv[28] = { type: ToolType.AXE, count: 1 }; 
    inv[30] = { type: BlockType.WOOD, count: 64 };
    return inv;
  });

  const [craftingGrid, setCraftingGrid] = useState<(ItemStack | null)[]>(new Array(4).fill(null));
  const [workbenchGrid, setWorkbenchGrid] = useState<(ItemStack | null)[]>(new Array(9).fill(null));
  const [craftingOutput, setCraftingOutput] = useState<ItemStack | null>(null);
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0); 
  const [drops, setDrops] = useState<DropEntity[]>([]);
  const [pendingParticles, setPendingParticles] = useState<ParticleData[]>([]);

  const handleBlockBreak = useCallback((pos: THREE.Vector3, type: BlockType) => {
    setWorldVersion(v => v + 1);
    setDrops(prev => [...prev, { id: Math.random().toString(36).substring(7), type, position: pos.clone().addScalar(0.5), velocity: new THREE.Vector3((Math.random()-0.5), 2, (Math.random()-0.5)) }]);
  }, []);

  const handleCollect = useCallback((id: string, type: BlockType) => {
    setDrops(prev => prev.filter(d => d.id !== id));
    setInventory(prev => {
      const next = [...prev];
      const idx = next.findIndex(s => s?.type === type && s.count < 64) || next.findIndex(s => s === null);
      if (idx !== -1) next[idx] = next[idx] ? { ...next[idx]!, count: next[idx]!.count + 1 } : { type, count: 1 };
      return next;
    });
  }, []);

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
        worldManager.requestChunk(cx + x, cz + z);
        newVisible.push(key);
      }
    }
    setActiveChunks(newVisible);
  }, [playerChunk, activeChunks, worldManager]);

  return (
    <div className="w-full h-screen" style={{ backgroundColor: atmosphere.skyColor }}>
      <Canvas camera={{ fov: 75, position: [32, 85, 32], near: 0.1, far: 1000 }}>
        <fogExp2 attach="fog" args={[atmosphere.fogColor, 0.008]} />
        <DayNightController onTimeUpdate={setTime} onSunHeightUpdate={setSunHeight} playerPos={playerPos} />
        <Stars intensity={atmosphere.starsIntensity} />
        <Clouds playerPos={playerPos} sunHeight={sunHeight} atmosphere={atmosphere} />
        <hemisphereLight args={[atmosphere.skyColor, '#000000', atmosphere.ambientIntensity]} />
        {activeChunks.map(key => {
          const [cx, cz] = key.split(',').map(Number);
          return <Chunk key={key + worldVersion} meshData={worldManager.getOrBuildMesh(cx, cz)} />;
        })}
        <Drops drops={drops} />
        <Particles newParticles={pendingParticles} onProcessed={() => setPendingParticles([])} />
        {isStarted && (
          <Player 
            onMove={updateVisibleChunks} onUnlock={() => setIsStarted(false)} worldManager={worldManager} 
            inventory={inventory} setInventory={setInventory} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} 
            onBlockBreak={handleBlockBreak} onBlockPlace={() => setWorldVersion(v => v + 1)} onCollect={handleCollect} 
            drops={drops} isPaused={isInventoryOpen || isEditorOpen} onBlockHit={() => {}} 
            onOpenWorkbench={() => { setCraftingMode('workbench'); setIsInventoryOpen(true); }}
            customBlueprints={customBlueprints} customTransforms={customTransforms} 
          />
        )}
      </Canvas>
      {isStarted ? (
        <>
          <Crosshair />
          <Hotbar inventory={inventory} selectedSlot={selectedSlot} worldVersion={worldVersion} />
          <Inventory 
            isOpen={isInventoryOpen} inventory={inventory} craftingGrid={craftingMode === 'any' ? craftingGrid : workbenchGrid} 
            craftingOutput={craftingOutput} heldItem={heldItem} craftingMode={craftingMode} onSlotClick={() => {}} onCraftingClick={() => {}} 
            onOutputClick={() => {}} onClose={() => setIsInventoryOpen(false)} onRecipeSelect={() => false} worldVersion={worldVersion}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setIsStarted(true)}>
          <div className="p-12 bg-zinc-900 border-4 border-zinc-700 rounded-3xl text-center shadow-2xl">
            <h1 className="text-6xl font-black text-white mb-6 uppercase italic tracking-tighter">VoxelCraft</h1>
            <button className="px-12 py-5 bg-green-600 text-white font-bold rounded-xl text-2xl hover:bg-green-500 transition-all uppercase">Войти в мир</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
