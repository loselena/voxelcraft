
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ToolType, BlockType, Pixel, ToolTransform, DEFAULT_TRANSFORMS, BlockFace, BLOCK_TEXTURES, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, ATLAS_SIZE, TOOL_TEXTURES } from '../constants';
import { TextureManager } from '../engine/TextureManager';

interface ItemEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (type: ToolType | BlockType, pixels: Pixel[], transform?: ToolTransform, face?: BlockFace, variant?: number) => void;
  allBlueprints?: Record<string, Pixel[]>;
  allBlockBlueprints?: Record<string, Pixel[]>; // key: "BlockType_Face" or "BlockType_Face_Variant"
  allTransforms?: Record<string, ToolTransform>;
}

const PRESET_PALETTE = [
  { name: 'Рукоять', color: '#4e342e' },
  { name: 'Дерево', color: '#6a4a3a' },
  { name: 'Камень', color: '#808080' },
  { name: 'Железо', color: '#e0e0e0' },
  { name: 'Золото', color: '#fce166' },
  { name: 'Алмаз', color: '#5decf5' },
  { name: 'Кожа', color: '#ffdbac' },
  { name: 'Тень', color: '#333333' },
];

type GridMode = 'square' | 'diamond';
type EditMode = 'tool' | 'block';
type EditorTool = 'pencil' | 'eraser' | 'pipette';

const ItemEditor: React.FC<ItemEditorProps> = ({ 
  isOpen, onClose, onSave, 
  allBlueprints = {}, 
  allBlockBlueprints = {},
  allTransforms = {} 
}) => {
  const [editMode, setEditMode] = useState<EditMode>('tool');
  const [pixels, setPixels] = useState<Record<string, string>>({});
  const [gridMode, setGridMode] = useState<GridMode>('diamond');
  const [editorTool, setEditorTool] = useState<EditorTool>('pencil');
  const [selectedColor, setSelectedColor] = useState(PRESET_PALETTE[0].color);
  const [customColor, setCustomColor] = useState('#ffffff');
  const [colorHistory, setColorHistory] = useState<string[]>([]);
  
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.PICKAXE);
  const [selectedBlock, setSelectedBlock] = useState<BlockType>(BlockType.GRASS);
  const [selectedFace, setSelectedFace] = useState<BlockFace>('side');
  const [selectedVariant, setSelectedVariant] = useState(0);

  const [sessionEdits, setSessionEdits] = useState<Record<string, Record<string, string>>>({});
  
  const isMouseDownRef = useRef(false);
  const [showCodeView, setShowCodeView] = useState(false);
  
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showReferenceWidget, setShowReferenceWidget] = useState(false);
  const [referenceZoom, setReferenceZoom] = useState(1);
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetPos, setWidgetPos] = useState({ x: 96, y: 24 });
  const lastSyncPosRef = useRef({ x: 96, y: 24 });
  const isDraggingWidgetRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(0);
  const [rz, setRz] = useState(0);
  const [px, setPx] = useState(0);
  const [py, setPy] = useState(0);
  const [pz, setPz] = useState(0);
  const [scale, setScale] = useState(1);
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  const codeTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null);

  const currentSessionKey = useMemo(() => {
    if (editMode === 'tool') return `tool_${selectedTool}`;
    return `${selectedBlock}_${selectedFace}_${selectedVariant}`;
  }, [editMode, selectedTool, selectedBlock, selectedFace, selectedVariant]);

  // Функция для извлечения пикселей из текущего атласа
  const extractPixelsFromAtlas = useCallback((index: number): Record<string, string> => {
    const atlas = TextureManager.getInstance().textureAtlas.image as HTMLCanvasElement;
    if (!atlas) return {};
    // Fix: Using correct cast for getContext to resolve potential 'Expected 0 arguments' or missing property errors
    const ctx = atlas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return {};

    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    const startX = col * FULL_TILE + PADDING;
    const startY = row * FULL_TILE + PADDING;

    const data = ctx.getImageData(startX, startY, TILE_SIZE, TILE_SIZE).data;
    const extracted: Record<string, string> = {};

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const i = (y * TILE_SIZE + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a > 20) {
          const color = new THREE.Color(`rgb(${r},${g},${b})`);
          extracted[`${x},${15 - y}`] = `#${color.getHexString()}`;
        }
      }
    }
    return extracted;
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (sessionEdits[currentSessionKey]) {
        setPixels(sessionEdits[currentSessionKey]);
      } else {
        const initialPixels: Record<string, string> = {};
        
        if (editMode === 'tool') {
          const blueprint = allBlueprints[selectedTool] || [];
          if (blueprint.length > 0) {
            blueprint.forEach(p => initialPixels[`${p.x},${p.y}`] = p.color);
          } else {
            const texIdx = TOOL_TEXTURES[selectedTool];
            if (texIdx !== undefined) Object.assign(initialPixels, extractPixelsFromAtlas(texIdx));
          }
          const def = DEFAULT_TRANSFORMS[selectedTool] || { rx:0, ry:0, rz:0, px:0, py:0, pz:0, s:1 };
          const transform = allTransforms[selectedTool] || def;
          setRx(transform.rx); setRy(transform.ry); setRz(transform.rz);
          setPx(transform.px); setPy(transform.py); setPz(transform.pz);
          setScale(transform.s);
          setGridMode(selectedTool === ToolType.PLAYER_HAND ? 'square' : 'diamond');
        } else {
          const keyWithVariant = `${selectedBlock}_${selectedFace}_${selectedVariant}`;
          const keyOld = `${selectedBlock}_${selectedFace}`;
          const blueprint = allBlockBlueprints[keyWithVariant] || allBlockBlueprints[keyOld] || [];
          
          if (blueprint.length > 0) {
            blueprint.forEach(p => initialPixels[`${p.x},${p.y}`] = p.color);
          } else {
            const texIndices = BLOCK_TEXTURES[selectedBlock];
            if (texIndices) {
              const baseIdx = texIndices[selectedFace];
              Object.assign(initialPixels, extractPixelsFromAtlas(baseIdx + selectedVariant));
            }
          }
          setGridMode('square');
        }
        setPixels(initialPixels);
      }
      setShowCodeView(false);
      setEditorTool('pencil');
    }
  }, [isOpen, editMode, selectedTool, selectedBlock, selectedFace, selectedVariant, allBlueprints, allBlockBlueprints, allTransforms, currentSessionKey, extractPixelsFromAtlas]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!isOpen || showCodeView) return;
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyP') setEditorTool('pencil');
      if (e.code === 'KeyE') setEditorTool('eraser');
      if (e.code === 'KeyI') setEditorTool('pipette');
      if (e.altKey && e.code === 'KeyR') setShowReferenceWidget(prev => !prev);
    };
    
    const handleGlobalUp = () => {
      isMouseDownRef.current = false;
      if (isDraggingWidgetRef.current) setWidgetPos(lastSyncPosRef.current);
      isDraggingWidgetRef.current = false;
    };

    const handleGlobalMove = (e: MouseEvent) => {
      if (isDraggingWidgetRef.current && widgetRef.current) {
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        widgetRef.current.style.left = `${newX}px`;
        widgetRef.current.style.top = `${newY}px`;
        lastSyncPosRef.current = { x: newX, y: newY };
      }
    };

    window.addEventListener('keydown', handleKeys);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
    };
  }, [isOpen, showCodeView]);

  const addToHistory = useCallback((color: string) => {
    if (color === 'transparent') return;
    setColorHistory(prev => {
      if (prev.includes(color)) return [color, ...prev.filter(c => c !== color)].slice(0, 10);
      return [color, ...prev].slice(0, 10);
    });
  }, []);

  const handlePixelAction = useCallback((x: number, y: number) => {
    const key = `${x},${y}`;
    if (editorTool === 'pipette') {
      const colorAt = pixels[key];
      if (colorAt) {
        setSelectedColor(colorAt);
        setCustomColor(colorAt);
        setEditorTool('pencil');
      }
      return;
    }
    const toolColor = editorTool === 'eraser' ? 'transparent' : selectedColor;
    if (toolColor !== 'transparent') addToHistory(toolColor);
    
    setPixels(prev => {
      const next = { ...prev };
      if (toolColor === 'transparent') {
        if (!next[key]) return prev;
        delete next[key];
      } else {
        if (next[key] === toolColor) return prev;
        next[key] = toolColor;
      }
      setSessionEdits(session => ({ ...session, [currentSessionKey]: next }));
      return next;
    });
  }, [editorTool, selectedColor, pixels, addToHistory, currentSessionKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReferenceImage(ev.target?.result as string);
        setShowReferenceWidget(true);
        setReferenceZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReferenceClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editorTool !== 'pipette') return;
    const canvas = referenceCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (ctx) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + Array.from(data.slice(0, 3)).map(b => b.toString(16).padStart(2, '0')).join('');
      setSelectedColor(hex);
      setCustomColor(hex);
      addToHistory(hex);
      setEditorTool('pencil');
    }
  };

  const handleReferenceWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setReferenceZoom(prev => Math.min(Math.max(0.1, prev * delta), 10));
  };

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    isDraggingWidgetRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - lastSyncPosRef.current.x,
      y: e.clientY - lastSyncPosRef.current.y
    };
  };

  useEffect(() => {
    if (referenceImage && referenceCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = referenceCanvasRef.current;
        if (!canvas) return;
        // Fix: Splitting width and height assignments to ensure cleaner line structure and avoiding potential 'Expected 0 arguments' misidentifications
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        ctx?.drawImage(img, 0, 0);
      };
      img.src = referenceImage;
    }
  }, [referenceImage, showReferenceWidget]);

  const pixelArray = useMemo((): Pixel[] => {
    return Object.entries(pixels).map(([key, color]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, color: color as string };
    });
  }, [pixels]);

  const currentTransform = useMemo((): ToolTransform => ({
    rx, ry, rz, px, py, pz, s: scale
  }), [rx, ry, rz, px, py, pz, scale]);

  const convertToPixels = (pixelMap: Record<string, string>): Pixel[] => {
    return Object.entries(pixelMap).map(([k, c]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, color: c as string };
    });
  };

  const generatedCode = useMemo(() => {
    const blueprintJson = JSON.stringify(pixelArray);
    const subject = editMode === 'tool' ? `инструмента: ${selectedTool}` : `блока: ${selectedBlock} (${selectedFace}, Var: ${selectedVariant})`;
    return `### ИНСТРУКЦИЯ ПО ОБНОВЛЕНИЮ ДИЗАЙНА ###\n\nПривет! Я создал новый дизайн для ${subject}.\n\n1. В App.tsx добавь:\n${editMode === 'tool' ? `Tool: ${selectedTool}` : `Key: "${selectedBlock}_${selectedFace}_${selectedVariant}"`}\nPixels:\n${blueprintJson}`;
  }, [selectedTool, selectedBlock, selectedFace, selectedVariant, pixelArray, editMode]);

  const handleApply = () => {
    if (editMode === 'tool') {
      onSave(selectedTool, pixelArray, currentTransform);
    } else {
      const sessionKeys = Object.keys(sessionEdits);
      if (sessionKeys.length === 0) {
        onSave(selectedBlock, pixelArray, undefined, selectedFace, selectedVariant);
      } else {
        sessionKeys.forEach(key => {
          const parts = key.split('_');
          if (parts.length === 3) {
            const pixs = convertToPixels(sessionEdits[key]);
            onSave(Number(parts[0]), pixs, undefined, parts[1] as BlockFace, Number(parts[2]));
          }
        });
      }
    }
    setSessionEdits({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 select-none">
      <div className="bg-[#121212] border-2 border-zinc-800 rounded-[40px] shadow-2xl w-full max-w-7xl h-full max-h-[95vh] overflow-hidden flex flex-col relative transition-all">
        
        {showCodeView && (
          <div className="absolute inset-0 z-[750] bg-black/90 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
             <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-3xl p-6 flex flex-col gap-4 shadow-[0_0_100px_rgba(34,197,94,0.15)]">
                <div className="flex justify-between items-center">
                   <h3 className="text-white font-black uppercase text-sm tracking-widest">Готовый промпт для AI</h3>
                   <button onClick={() => setShowCodeView(false)} className="w-8 h-8 bg-zinc-800 text-zinc-500 hover:text-white rounded-full flex items-center justify-center">✕</button>
                </div>
                <textarea ref={codeTextAreaRef} readOnly value={generatedCode} className="w-full h-[450px] bg-black text-green-500 font-mono text-[11px] p-6 rounded-2xl border border-zinc-800 outline-none resize-none custom-scrollbar" />
                <div className="flex gap-3">
                  <button onClick={() => { if (codeTextAreaRef.current) { codeTextAreaRef.current.select(); navigator.clipboard.writeText(generatedCode); alert('СКОПИРОВАНО'); } }} className="flex-1 py-5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-500 uppercase text-xs">Копировать</button>
                  <button onClick={() => setShowCodeView(false)} className="px-10 py-5 bg-zinc-800 text-zinc-400 font-black rounded-2xl hover:bg-zinc-700 uppercase text-xs">Закрыть</button>
                </div>
             </div>
          </div>
        )}

        <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0 bg-[#121212] z-10">
          <div className="flex items-center gap-6">
             <h2 className="text-white font-black text-xl md:text-2xl tracking-tighter uppercase italic">Voxel<span className="text-green-500">Artist</span></h2>
             <div className="flex bg-black p-1 rounded-xl border border-zinc-800">
                <button onClick={() => setEditMode('tool')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${editMode === 'tool' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>ИНСТРУМЕНТЫ</button>
                <button onClick={() => setEditMode('block')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${editMode === 'block' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>БЛОКИ</button>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => referenceImage ? setShowReferenceWidget(!showReferenceWidget) : fileInputRef.current?.click()} className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showReferenceWidget ? 'bg-green-600 border-white text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}><span>🖼️</span> {showReferenceWidget ? 'Скрыть образец' : 'Открыть образец'}</button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

            {editMode === 'tool' ? (
              <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value as ToolType)} className="bg-zinc-900 text-white border border-zinc-700 px-4 py-2 rounded-xl text-[10px] font-black outline-none">
                {Object.values(ToolType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <div className="flex gap-2 items-center">
                <select value={selectedBlock} onChange={(e) => setSelectedBlock(Number(e.target.value))} className="bg-zinc-900 text-white border border-zinc-700 px-4 py-2 rounded-xl text-[10px] font-black outline-none">
                  {Object.keys(BlockType).filter(k => isNaN(Number(k)) && k !== 'AIR').map(k => <option key={k} value={BlockType[k as keyof typeof BlockType]}>{k}</option>)}
                </select>
                <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  {(['top', 'side', 'bottom'] as BlockFace[]).map(f => (
                    <button key={f} onClick={() => setSelectedFace(f)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${selectedFace === f ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>{f}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => { setSessionEdits({}); onClose(); }} className="w-10 h-10 flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white rounded-xl">✕</button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/40 overflow-hidden border-r border-zinc-800/50 relative">
            
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
              <ToolButton active={editorTool === 'pencil'} icon="✏️" onClick={() => setEditorTool('pencil')} label="P" />
              <ToolButton active={editorTool === 'eraser'} icon="🧹" onClick={() => setEditorTool('eraser')} label="E" />
              <ToolButton active={editorTool === 'pipette'} icon="🧪" onClick={() => setEditorTool('pipette')} label="I" />
            </div>

            {editMode === 'block' && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
                <div className="text-[8px] font-black text-zinc-600 uppercase text-center tracking-widest mb-1">Варианты</div>
                {[0, 1, 2, 3].map(v => (
                  <button 
                    key={v} 
                    onClick={() => setSelectedVariant(v)}
                    className={`w-14 h-14 rounded-2xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center relative group ${selectedVariant === v ? 'border-green-500 bg-zinc-800 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                  >
                    <div className="w-8 h-8 opacity-40 group-hover:opacity-100 transition-opacity" style={{ 
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                      background: '#000', borderRadius: '2px'
                    }}>
                      {(() => {
                        const key = `${selectedBlock}_${selectedFace}_${v}`;
                        const sessPix = sessionEdits[key];
                        if (sessPix) return convertToPixels(sessPix).slice(0, 16).map((p, idx) => <div key={idx} style={{ background: p.color, width: '100%', height: '100%' }} />);
                        const vPixels = allBlockBlueprints[key] || allBlockBlueprints[`${selectedBlock}_${selectedFace}`] || [];
                        return vPixels.slice(0, 16).map((p, idx) => <div key={idx} style={{ background: p.color, width: '100%', height: '100%' }} />);
                      })()}
                    </div>
                    <span className={`text-[8px] font-black mt-1 ${selectedVariant === v ? 'text-green-500' : 'text-zinc-600'}`}>VAR {v + 1}</span>
                    {selectedVariant === v && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                  </button>
                ))}
              </div>
            )}

            {showReferenceWidget && referenceImage && (
              <div ref={widgetRef} className="fixed z-30 w-64 bg-[#1a1a1a] border-2 border-zinc-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300" style={{ left: widgetPos.x, top: widgetPos.y, willChange: 'left, top' }} onWheel={handleReferenceWheel}>
                 <div className="p-2.5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 cursor-move" onMouseDown={handleWidgetMouseDown}>
                    <div className="flex flex-col"><span className="text-[8px] text-white font-black uppercase tracking-widest px-1">Образец</span></div>
                    <button onMouseDown={e => e.stopPropagation()} onClick={() => setShowReferenceWidget(false)} className="w-5 h-5 flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[10px]">✕</button>
                 </div>
                 <div className="h-64 p-2 bg-black flex items-center justify-center overflow-hidden"><div className="relative w-full h-full flex items-center justify-center overflow-auto custom-scrollbar-mini"><canvas ref={referenceCanvasRef} onClick={handleReferenceClick} className={`shadow-lg border border-zinc-800 bg-black transition-transform origin-center ${editorTool === 'pipette' ? 'cursor-crosshair ring-2 ring-green-500' : 'cursor-default'}`} style={{ transform: `scale(${referenceZoom})`, imageRendering: referenceZoom > 1 ? 'pixelated' : 'auto' }} /></div></div>
              </div>
            )}

            <div className="relative w-full h-full flex items-center justify-center">
              <div className="relative overflow-hidden transition-all duration-500 shadow-2xl" style={{ width: 'min(50vh, 100%)', aspectRatio: '1/1', transform: (gridMode === 'diamond' && editMode === 'tool') ? 'rotate(45deg) scale(0.85)' : 'rotate(0deg) scale(1)', display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gridTemplateRows: 'repeat(16, 1fr)', backgroundColor: '#050505', border: '8px solid #222', borderRadius: '4px', cursor: editorTool === 'pipette' ? 'crosshair' : 'default' }} onDragStart={(e) => e.preventDefault()} onMouseDown={(e) => { if (e.button === 0) isMouseDownRef.current = true; }}>
                {Array.from({ length: 16 }).map((_, y) => Array.from({ length: 16 }).map((_, x) => {
                    const pixelY = 15 - y; const color = pixels[`${x},${pixelY}`];
                    return (
                      <div key={`${x}-${pixelY}`} onMouseDown={(e) => { if (e.button === 0) handlePixelAction(x, pixelY); }} onMouseEnter={() => { if (isMouseDownRef.current) handlePixelAction(x, pixelY); }} className="w-full h-full border-[0.1px] border-white/5 hover:bg-white/10" style={{ backgroundColor: color || 'transparent' }} />
                    );
                }))}
              </div>
            </div>

            <div className="w-full max-w-3xl mt-6 flex flex-col gap-4 shrink-0 bg-zinc-900/60 p-5 rounded-[32px] border border-white/5 backdrop-blur-md">
              <div className="flex flex-wrap gap-2 items-center justify-center">
                  {PRESET_PALETTE.map(p => (
                    <button key={p.name} onClick={() => { setSelectedColor(p.color); setEditorTool('pencil'); }} className={`p-1 w-9 aspect-square rounded-xl border-2 transition-all ${selectedColor === p.color ? 'border-green-500 scale-110 shadow-lg' : 'border-zinc-800'}`}><div className="w-full h-full rounded-lg" style={{ backgroundColor: p.color }} /></button>
                  ))}
                  <div className="w-px h-8 bg-zinc-800 mx-2" />
                  <div className={`flex items-center gap-2 p-1 pl-3 bg-zinc-800 rounded-xl border-2 transition-all ${selectedColor === customColor ? 'border-green-500' : 'border-zinc-700'}`}>
                    <input type="text" value={customColor} onChange={(e) => { const v = e.target.value; setCustomColor(v); if (/^#[0-9A-F]{6}$/i.test(v)) setSelectedColor(v); }} onFocus={() => setEditorTool('pencil')} className="bg-transparent text-white font-mono text-[9px] w-12 outline-none uppercase" placeholder="#FFF" />
                    <button onClick={() => colorInputRef.current?.click()} className="w-7 h-7 rounded-lg border border-white/10 overflow-hidden relative shadow-inner" style={{ backgroundColor: customColor }}><input ref={colorInputRef} type="color" value={customColor} onChange={(e) => { const v = e.target.value; setCustomColor(v); setSelectedColor(v); }} className="absolute inset-0 opacity-0 cursor-pointer" /></button>
                  </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[480px] bg-[#0c0c0c] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-8 bg-zinc-900/10 border-b border-zinc-800/50">
                <div className="aspect-square w-full max-w-[320px] mx-auto bg-zinc-800 rounded-[40px] border-2 border-zinc-700 relative overflow-hidden shadow-2xl">
                  <Canvas camera={{ position: [1.5, 1.5, 1.5], fov: 45 }}><color attach="background" args={['#111111']} /><ambientLight intensity={1.5} /><pointLight position={[10, 10, 10]} intensity={2} /><OrbitControls enablePan={false} autoRotate={isAutoRotate} autoRotateSpeed={4} enableDamping={true} dampingFactor={0.05} />
                    {editMode === 'tool' ? <PreviewModel pixels={pixelArray} gridMode={gridMode} rx={rx} ry={ry} rz={rz} isArm={selectedTool === ToolType.PLAYER_HAND} scale={scale} /> : <BlockPreviewModel activeFacePixels={pixelArray} activeFace={selectedFace} blockType={selectedBlock} allBlockBlueprints={allBlockBlueprints} currentVariant={selectedVariant} sessionEdits={sessionEdits} />}
                  </Canvas>
                  <button onClick={() => setIsAutoRotate(!isAutoRotate)} className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-[8px] font-black uppercase z-20 ${isAutoRotate ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>{isAutoRotate ? 'Rotation: ON' : 'Rotation: OFF'}</button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 bg-[#0c0c0c] flex flex-col gap-3 shrink-0">
              <button onClick={() => handleApply()} className="w-full py-4 bg-green-600 text-white font-black uppercase text-xs rounded-2xl hover:bg-green-500 shadow-lg shadow-green-900/20">ПРИМЕНИТЬ</button>
              <div className="flex gap-2">
                <button onClick={() => setShowCodeView(true)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 font-black uppercase text-[10px] rounded-xl hover:bg-zinc-700">КОД (PROMPT)</button>
                <button onClick={() => { setSessionEdits({}); onClose(); }} className="px-6 py-3 bg-red-900/20 text-red-400 font-bold uppercase text-[10px] rounded-xl hover:bg-red-900/30">ОТМЕНА</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean, icon: string, onClick: () => void, label: string }> = ({ active, icon, onClick, label }) => (
  <button onClick={onClick} className={`w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all relative group ${active ? 'bg-green-600 border-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-110' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}><span className="text-xl">{icon}</span><span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 rounded-md ${active ? 'bg-white text-green-600' : 'bg-zinc-800 text-zinc-500'} group-hover:scale-110 transition-transform`}>{label}</span></button>
);

const PreviewModel: React.FC<{ pixels: any[], gridMode: GridMode, rx: number, ry: number, rz: number, isArm: boolean, scale: number }> = ({ pixels, gridMode, rx, ry, rz, isArm, scale }) => {
  const rotationGroupRef = React.useRef<THREE.Group>(null);
  const metrics = useMemo(() => {
    if (pixels.length === 0) return { center: new THREE.Vector3(7.5, 7.5, 0), width: 1 };
    let minX = 16, maxX = 0, minY = 16, maxY = 0;
    pixels.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    return { center: new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0), width: maxX - minX + 1 };
  }, [pixels]);
  useEffect(() => { if (rotationGroupRef.current) { rotationGroupRef.current.rotation.x = rx; rotationGroupRef.current.rotation.y = ry; rotationGroupRef.current.rotation.z = rz; } }, [rx, ry, rz]);
  return (<group ref={rotationGroupRef} scale={[0.06 * scale, 0.06 * scale, 0.06 * scale]}><group rotation={[0, 0, gridMode === 'diamond' ? -Math.PI / 4 : 0]}>{pixels.map((p, i) => (<mesh key={i} position={[p.x - metrics.center.x, p.y - metrics.center.y, 0]}><boxGeometry args={[isArm ? metrics.width : 1, 1, 1]} /><meshLambertMaterial color={p.color} /></mesh>))}</group></group>);
};

const BlockPreviewModel: React.FC<{ 
  activeFacePixels: Pixel[], 
  activeFace: BlockFace, 
  blockType: BlockType, 
  allBlockBlueprints: Record<string, Pixel[]>, 
  currentVariant: number,
  sessionEdits: Record<string, Record<string, string>>
}> = ({ activeFacePixels, activeFace, blockType, allBlockBlueprints, currentVariant, sessionEdits }) => {
  const pixelMeshes = useMemo(() => {
    const list: React.ReactNode[] = [];
    const offset = 0.5008; const pSize = 1 / 16;
    const getFaceProps = (f: BlockFace, sideIdx: number = 0) => {
      let posBase: [number, number, number] = [0, 0, 0]; let rot: [number, number, number] = [0, 0, 0];
      if (f === 'top') { posBase = [0, offset, 0]; rot = [-Math.PI / 2, 0, 0]; }
      else if (f === 'bottom') { posBase = [0, -offset, 0]; rot = [Math.PI / 2, 0, 0]; }
      else {
        if (sideIdx === 0) { posBase = [0, 0, offset]; rot = [0, 0, 0]; }
        else if (sideIdx === 1) { posBase = [offset, 0, 0]; rot = [0, Math.PI / 2, 0]; }
        else if (sideIdx === 2) { posBase = [0, 0, -offset]; rot = [0, Math.PI, 0]; }
        else if (sideIdx === 3) { posBase = [-offset, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
      }
      return { posBase, rot };
    };
    const renderPixels = (pixelsToRender: Pixel[], f: BlockFace, sIdx: number = 0) => {
      const { posBase, rot } = getFaceProps(f, sIdx);
      return pixelsToRender.map((p, i) => {
        const lx = (p.x + 0.5) / 16 - 0.5; const ly = (p.y + 0.5) / 16 - 0.5;
        const localPos = new THREE.Vector3(lx, ly, 0); localPos.applyEuler(new THREE.Euler(...rot)); localPos.add(new THREE.Vector3(...posBase));
        return (<mesh key={`${f}-${sIdx}-${i}`} position={[localPos.x, localPos.y, localPos.z]} rotation={rot}><planeGeometry args={[pSize, pSize]} /><meshBasicMaterial color={p.color} side={THREE.FrontSide} /></mesh>);
      });
    };
    const faces: BlockFace[] = ['top', 'side', 'bottom'];
    faces.forEach(f => {
      const isCurrentFace = f === activeFace;
      const variantKey = `${blockType}_${f}_${currentVariant}`;
      const sessPixMap = sessionEdits[variantKey];
      
      let faceData: Pixel[];
      if (isCurrentFace) {
        faceData = activeFacePixels;
      } else if (sessPixMap) {
        faceData = Object.entries(sessPixMap).map(([k, c]) => {
          const [px, py] = k.split(',').map(Number);
          return { x: px, y: py, color: c as string };
        });
      } else {
        faceData = allBlockBlueprints[variantKey] || allBlockBlueprints[`${blockType}_${f}_0`] || allBlockBlueprints[`${blockType}_${f}`] || [];
      }

      if (f === 'side') { for (let i = 0; i < 4; i++) { list.push(...renderPixels(faceData, 'side', i)); } }
      else { list.push(...renderPixels(faceData, f)); }
    });
    return list;
  }, [activeFacePixels, activeFace, blockType, allBlockBlueprints, currentVariant, sessionEdits]);
  return (<group scale={[1, 1, 1]}><mesh><boxGeometry args={[1, 1, 1]} /><meshLambertMaterial color="#222" /></mesh>{pixelMeshes}</group>);
};

export default ItemEditor;
