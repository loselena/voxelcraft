
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BlockType, ToolType, ItemStack, BLOCK_TEXTURES, TOOL_TEXTURES, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, ATLAS_SIZE } from '../constants';
import { TextureManager } from '../engine/TextureManager';

interface Ingredient {
  type: BlockType | ToolType;
  count: number;
  name: string;
}

export interface Recipe {
  id: string;
  name: string;
  result: BlockType | ToolType;
  resultCount: number;
  mode: 'any' | 'workbench';
  ingredients: Ingredient[];
  layout: (BlockType | ToolType | null)[]; 
}

// Layouts are 1D arrays: 
// For 2x2 (mode: 'any'): [0,1, 2,3]
// For 3x3 (mode: 'workbench'): [0,1,2, 3,4,5, 6,7,8]
export const RECIPES_LIST: Recipe[] = [
  { 
    id: 'planks', name: 'Дубовые доски', result: BlockType.PLANKS, resultCount: 4, mode: 'any', 
    ingredients: [{ type: BlockType.WOOD, count: 1, name: 'Дубовое бревно' }],
    layout: [BlockType.WOOD, null, null, null] 
  },
  { 
    id: 'sticks', name: 'Палки', result: BlockType.STICK, resultCount: 4, mode: 'any', 
    ingredients: [{ type: BlockType.PLANKS, count: 2, name: 'Доски' }],
    layout: [BlockType.PLANKS, null, BlockType.PLANKS, null] // Vertical stack in 2x2
  },
  { 
    id: 'workbench', name: 'Верстак', result: BlockType.CRAFTING_TABLE, resultCount: 1, mode: 'any', 
    ingredients: [{ type: BlockType.PLANKS, count: 4, name: 'Доски' }],
    layout: [BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS]
  },
  { 
    id: 'pickaxe', name: 'Каменная кирка', result: ToolType.PICKAXE, resultCount: 1, mode: 'workbench', 
    ingredients: [{ type: BlockType.STONE, count: 3, name: 'Булыжник' }, { type: BlockType.STICK, count: 2, name: 'Палки' }],
    layout: [
      BlockType.STONE, BlockType.STONE, BlockType.STONE, 
      null, BlockType.STICK, null, 
      null, BlockType.STICK, null
    ]
  },
  { 
    id: 'axe', name: 'Каменный топор', result: ToolType.AXE, resultCount: 1, mode: 'workbench', 
    ingredients: [{ type: BlockType.STONE, count: 3, name: 'Булыжник' }, { type: BlockType.STICK, count: 2, name: 'Палки' }],
    layout: [
      BlockType.STONE, BlockType.STONE, null, 
      BlockType.STONE, BlockType.STICK, null, 
      null, BlockType.STICK, null
    ]
  },
  { 
    id: 'shovel', name: 'Каменная лопата', result: ToolType.SHOVEL, resultCount: 1, mode: 'workbench', 
    ingredients: [{ type: BlockType.STONE, count: 1, name: 'Булыжник' }, { type: BlockType.STICK, count: 2, name: 'Палки' }],
    layout: [
      null, BlockType.STONE, null, 
      null, BlockType.STICK, null, 
      null, BlockType.STICK, null
    ]
  },
  { 
    id: 'torch', name: 'Факел', result: BlockType.TORCH, resultCount: 4, mode: 'any', 
    ingredients: [{ type: BlockType.COAL_ORE, count: 1, name: 'Уголь' }, { type: BlockType.STICK, count: 1, name: 'Палка' }],
    layout: [BlockType.COAL_ORE, null, BlockType.STICK, null] // Vertical stack in 2x2
  },
];

interface InventoryProps {
  isOpen: boolean;
  inventory: (ItemStack | null)[];
  craftingGrid: (ItemStack | null)[];
  craftingOutput: ItemStack | null;
  heldItem: ItemStack | null;
  craftingMode: 'any' | 'workbench';
  onSlotClick: (index: number, isRightClick: boolean) => void;
  onCraftingClick: (index: number, isRightClick: boolean) => void;
  onOutputClick: () => void;
  onClose: () => void;
  onRecipeSelect?: (recipe: Recipe) => boolean;
  worldVersion?: number;
}

const Inventory: React.FC<InventoryProps> = ({ 
  isOpen, inventory, craftingGrid, craftingOutput, heldItem, 
  craftingMode, onSlotClick, onCraftingClick, onOutputClick, onClose, onRecipeSelect,
  worldVersion = 0
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  const [hoveredRecipe, setHoveredRecipe] = useState<Recipe | null>(null);
  const [pinnedRecipe, setPinnedRecipe] = useState<Recipe | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (!isOpen) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      let targetW = craftingMode === 'workbench' ? 420 : 380;
      if (showRecipeBook) targetW += 175;
      if (showRecipeBook && pinnedRecipe) targetW += 195;
      
      const targetH = 480;
      const scaleW = Math.min(1.1, (vw * 0.96) / targetW);
      const scaleH = Math.min(1.1, (vh * 0.96) / targetH);
      setScale(Math.min(scaleW, scaleH));
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, showRecipeBook, pinnedRecipe, craftingMode]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    if (isOpen) {
      window.addEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = 'auto';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = 'auto';
    };
  }, [isOpen]);

  const handleRecipeClick = (r: Recipe, isRightClick: boolean) => {
    if (isRightClick) {
      setPinnedRecipe(pinnedRecipe?.id === r.id ? null : r);
    } else if (onRecipeSelect) {
      const success = onRecipeSelect(r);
      if (!success) {
        setAlertMessage("Недостаточно ресурсов!");
        setTimeout(() => setAlertMessage(null), 2000);
      }
    }
  };

  if (!isOpen) return null;

  const mainInventory = inventory.slice(0, 27);
  const hotbar = inventory.slice(27, 36);
  const filteredRecipes = RECIPES_LIST.filter(r => craftingMode === 'workbench' || r.mode === 'any');

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-hidden touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        className="flex items-center justify-center gap-1 transition-all duration-300 origin-center"
        style={{ transform: `scale(${scale})`, cursor: 'none' }}
      >
        
        {showRecipeBook && pinnedRecipe && (
          <div className="bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555] p-4 shadow-2xl w-[190px] flex flex-col shrink-0 h-[420px] relative animate-in fade-in slide-in-from-right-4">
            <button onClick={() => setPinnedRecipe(null)} className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white text-[10px] flex items-center justify-center border border-black hover:bg-red-500 z-10" style={{ cursor: 'none' }}>✕</button>
            <div className="text-[#404040] text-[10px] font-black mb-4 uppercase tracking-tighter border-b border-[#8B8B8B] pb-1">Инструкция</div>
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[#404040] text-[8px] font-bold self-start uppercase">Схема:</span>
                <div className={`grid gap-0.5 p-1 bg-[#8B8B8B] border-2 border-[#373737] ${pinnedRecipe.layout.length > 4 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {pinnedRecipe.layout.map((type, idx) => (
                    <div key={idx} className="w-8 h-8 bg-[#8B8B8B] border border-[#555] flex items-center justify-center">
                      {type !== null && <ItemIcon item={{ type: type as any, count: 1 }} size="small" version={worldVersion} />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
                <span className="text-[#404040] text-[8px] font-bold uppercase">Нужно:</span>
                {pinnedRecipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[#404040] text-[9px] bg-black/5 px-2 py-1.5 rounded mb-1 border-b border-black/5">
                    <span className="truncate pr-1">{ing.name}</span>
                    <span className="font-bold text-green-700 shrink-0">x{ing.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showRecipeBook && (
          <div className="bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555] p-3 shadow-2xl w-[170px] shrink-0 h-[420px] flex flex-col animate-in fade-in slide-in-from-right-2">
            <div className="text-[#404040] text-[10px] font-black mb-3 uppercase tracking-tighter border-b border-[#8B8B8B] pb-1">Рецепты</div>
            <div className="grid grid-cols-3 gap-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
              {filteredRecipes.map((r) => (
                <div 
                  key={r.id}
                  onMouseEnter={() => setHoveredRecipe(r)}
                  onMouseLeave={() => setHoveredRecipe(null)}
                  onMouseDown={(e) => { e.preventDefault(); handleRecipeClick(r, e.button === 2); }}
                  className={`w-10 h-10 border-t-2 border-l-2 border-b-2 border-r-2 flex items-center justify-center transition-colors ${pinnedRecipe?.id === r.id ? 'bg-[#55FF55]/20 border-green-500 shadow-[inset_0_0_10px_rgba(34,197,94,0.3)]' : 'bg-[#8B8B8B] border-[#373737] border-b-white border-r-white hover:bg-[#A0A0A0]'}`}
                  style={{ cursor: 'none' }}
                >
                  <ItemIcon item={{ type: r.result, count: 1 }} version={worldVersion} />
                </div>
              ))}
            </div>
            <div className="text-[7px] text-zinc-500 mt-2 text-center uppercase font-bold opacity-60 pt-1">ПКМ: Схема</div>
          </div>
        )}

        <div className={`bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555] p-5 shadow-2xl relative flex flex-col h-[420px] shrink-0 ${craftingMode === 'workbench' ? 'w-[420px]' : 'w-[380px]'}`} style={{ cursor: 'none' }}>
          {alertMessage && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[300] bg-black/90 border-2 border-red-600 px-6 py-3 rounded-lg shadow-2xl animate-pulse">
               <span className="text-red-500 font-bold text-sm uppercase tracking-tighter whitespace-nowrap">{alertMessage}</span>
            </div>
          )}
          <button onClick={() => setShowRecipeBook(!showRecipeBook)} className={`absolute -left-10 top-12 w-10 h-10 rounded-l-md border-2 border-black flex items-center justify-center transition-all z-10 ${showRecipeBook ? 'bg-green-500' : 'bg-[#C6C6C6] hover:bg-[#D6D6D6]'}`} style={{ cursor: 'none' }}>
            <span className="text-xl">{showRecipeBook ? '📖' : '📗'}</span>
          </button>
          <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white flex items-center justify-center font-bold border-2 border-black hover:bg-red-500 transition-colors" style={{ cursor: 'none' }}>✕</button>
          
          <div className="flex justify-between mb-6 items-start gap-4">
             <div className="w-24 md:w-32 h-32 md:h-40 bg-[#8B8B8B] border-2 border-[#373737] flex flex-col items-center justify-center text-white font-bold text-[10px] uppercase text-center p-2 shrink-0">
               {craftingMode === 'workbench' ? <><span className="text-4xl mb-2">🪑</span><span>Верстак</span></> : <><span className="text-4xl mb-2">👤</span><span>Крафт</span></>}
             </div>
             <div className="flex flex-col items-center flex-1">
               <span className="text-[#404040] text-[10px] font-black mb-3 uppercase self-start ml-4">Создание</span>
               <div className="flex items-center gap-2 md:gap-4">
                  <div className={`grid gap-1 ${craftingMode === 'workbench' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {(craftingMode === 'workbench' ? craftingGrid : craftingGrid.slice(0, 4)).map((slot, i) => (
                      <InventorySlot key={`craft-${i}`} item={slot} onClick={(isRight) => onCraftingClick(i, isRight)} version={worldVersion} />
                    ))}
                  </div>
                  <div className="text-2xl md:text-3xl text-[#555] font-bold">➜</div>
                  <div onClick={onOutputClick} className="w-14 h-14 bg-[#8B8B8B] border-t-2 border-l-2 border-[#373737] border-b-2 border-r-2 border-white flex items-center justify-center hover:bg-[#A0A0A0] transition-colors" style={{ cursor: 'none' }}>
                    {craftingOutput && <ItemIcon item={craftingOutput} size="large" version={worldVersion} />}
                  </div>
               </div>
             </div>
          </div>
          <div className="grid grid-cols-9 gap-1 mt-auto mb-4">
            {mainInventory.map((slot, i) => (
              <InventorySlot key={`inv-${i}`} item={slot} onClick={(isRight) => onSlotClick(i, isRight)} version={worldVersion} />
            ))}
          </div>
          <div className="grid grid-cols-9 gap-1">
            {hotbar.map((slot, i) => (
              <InventorySlot key={`hot-${i}`} item={slot} onClick={(isRight) => onSlotClick(i + 27, isRight)} version={worldVersion} />
            ))}
          </div>
        </div>
      </div>

      {hoveredRecipe && (
        <div className="fixed z-[250] pointer-events-none hidden md:flex flex-col min-w-[160px]" style={{ left: mousePos.x + 15, top: mousePos.y - 15, transform: 'translate(0, -100%)' }}>
          <div className="bg-[#100010] border-2 border-[#2d005d] px-3 py-2 shadow-2xl">
             <span className="text-[#FFFFFF] text-[12px] font-bold block mb-1">{hoveredRecipe.name}</span>
             <div className="border-t border-white/10 mt-1 pt-1">
               <span className="text-[#AAAAAA] text-[9px] uppercase font-black block mb-1">Ингредиенты:</span>
               {hoveredRecipe.ingredients.map((ing, idx) => (
                 <div key={idx} className="flex justify-between items-center gap-4">
                   <span className="text-[#FFFFFF] text-[10px]">{ing.name}</span>
                   <span className="text-[#55FF55] text-[10px] font-bold">x{ing.count}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      <div className="fixed pointer-events-none z-[300] flex items-center justify-center" style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' }}>
        <div className="w-10 h-10 border-2 border-white mix-blend-difference absolute box-border shadow-xl" />
        {heldItem && <div className="scale-125"><ItemIcon item={heldItem} size="large" version={worldVersion} /></div>}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #8B8B8B; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
      `}</style>
    </div>
  );
};

interface SlotProps {
  item: ItemStack | null;
  onClick: (isRight: boolean) => void;
  version?: number;
}

const InventorySlot: React.FC<SlotProps> = ({ item, onClick, version = 0 }) => (
  <div onMouseDown={(e) => { e.preventDefault(); onClick(e.button === 2); }} className="w-9 h-9 md:w-10 md:h-10 bg-[#8B8B8B] border-t-2 border-l-2 border-[#373737] border-b-2 border-r-2 border-white flex items-center justify-center hover:bg-[#A0A0A0] transition-colors" style={{ cursor: 'none' }}>
    {item && <ItemIcon item={item} version={version} />}
  </div>
);

export const ItemIcon: React.FC<{ item: ItemStack, size?: 'small' | 'large', version?: number }> = ({ item, size = 'small', version = 0 }) => {
  const iconSize = size === 'large' ? 'w-8 h-8' : 'w-7 h-7';
  const atlas = TextureManager.getInstance().textureAtlas.image as HTMLCanvasElement;
  
  // dependency on version forces recreation of data URL when atlas content changes
  const atlasUrl = useMemo(() => atlas.toDataURL(), [atlas, version]);

  let texIndex: number | undefined;

  if (Object.values(ToolType).includes(item.type as any)) {
    texIndex = TOOL_TEXTURES[item.type as string];
    if (texIndex === undefined) {
      return (
        <div className="relative select-none pointer-events-none">
          <div className={`${iconSize} flex items-center justify-center`}>
             <span className={size === 'large' ? 'text-2xl' : 'text-xl'}>{getToolEmoji(item.type as ToolType)}</span>
          </div>
          {item.count > 1 && <span className="absolute bottom-0 right-0 translate-x-1 translate-y-1 text-white text-[10px] font-bold drop-shadow-[1px_1px_0px_rgba(0,0,0,0.8)]">{item.count}</span>}
        </div>
      );
    }
  } else {
    texIndex = BLOCK_TEXTURES[item.type as BlockType]?.side || 0;
  }

  const col = texIndex % ATLAS_COLS;
  const row = Math.floor(texIndex / ATLAS_COLS);
  const x = col * FULL_TILE + PADDING;
  const y = row * FULL_TILE + PADDING;

  return (
    <div className="relative select-none pointer-events-none">
      <div className={`${iconSize}`} style={{ backgroundImage: `url(${atlasUrl})`, backgroundPosition: `-${x * (size === 'large' ? 32/16 : 28/16)}px -${y * (size === 'large' ? 32/16 : 28/16)}px`, backgroundSize: `${(ATLAS_SIZE * (size === 'large' ? 32/16 : 28/16))}px`, imageRendering: 'pixelated' }} />
      {item.count > 1 && <span className="absolute bottom-0 right-0 translate-x-1 translate-y-1 text-white text-[10px] font-bold drop-shadow-[1px_1px_0px_rgba(0,0,0,0.8)]">{item.count}</span>}
    </div>
  );
};

function getToolEmoji(type: ToolType): string {
  switch (type) {
    case ToolType.SHOVEL: return '🥄';
    case ToolType.PICKAXE: return '⛏️';
    case ToolType.AXE: return '🪓';
    default: return '';
  }
}

export default Inventory;
