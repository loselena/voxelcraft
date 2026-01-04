
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128; 
export const RENDER_DISTANCE = 4;

export const ATLAS_COLS = 8;
export const ATLAS_SIZE = 256; 
export const TILE_SIZE = 16;
export const PADDING = 1;
export const FULL_TILE = 18;

export const INVENTORY_SIZE = 36;
export const ECOSYSTEM_TICK_RATE = 0.5;

// Added DAY_DURATION to fix the missing export error in App.tsx
export const DAY_DURATION = 1200;

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  WATER = 6,
  SAND = 7,
  BIRCH_WOOD = 8,
  BIRCH_LEAVES = 9,
  SPRUCE_WOOD = 10,
  SPRUCE_LEAVES = 11,
  BEDROCK = 12,
  COAL_ORE = 13,
  IRON_ORE = 14,
  GOLD_ORE = 15,
  DIAMOND_ORE = 16,
  REDSTONE_ORE = 17,
  LAPIS_ORE = 18,
  COPPER_ORE = 19,
  PLANKS = 20,
  CRAFTING_TABLE = 21,
  STICK = 22,
  TORCH = 23,
  MOSS = 24,
  BUSH_TINY = 25,
  BUSH_DENSE = 26,
  BUSH_FLOWERING = 27
}

export enum ToolType {
  NONE = 'NONE',
  SHOVEL = 'SHOVEL',
  PICKAXE = 'PICKAXE',
  AXE = 'AXE',
  PLAYER_HAND = 'PLAYER_HAND'
}

export const TOOL_TEXTURES: Record<string, number> = {
  [ToolType.PICKAXE]: 70,
  [ToolType.AXE]: 71,
  [ToolType.SHOVEL]: 72,
};

export interface Pixel {
  x: number;
  y: number;
  color: string;
}

export interface ToolTransform {
  rx: number; ry: number; rz: number;
  px: number; py: number; pz: number;
  s: number;
}

export interface ToolStats {
  weight: number;
  reach: number;
  durability: number;
  power: number;
}

export const DEFAULT_TRANSFORMS: Record<string, ToolTransform> = {
  [ToolType.PICKAXE]: { rx: 0, ry: 0, rz: 0, px: 0, py: 0.65, pz: -0.05, s: 1 },
  [ToolType.AXE]: { rx: 0, ry: 0, rz: 0, px: 0, py: 0.65, pz: -0.05, s: 1 },
  [ToolType.SHOVEL]: { rx: 0, ry: 0, rz: 0, px: 0, py: 0.65, pz: -0.05, s: 1 },
  [ToolType.PLAYER_HAND]: {"rx":0,"ry":0,"rz":0,"px":-0.12,"py":0.3,"pz":0,"s":1},
};

export const DEFAULT_BLUEPRINTS: Record<string, Pixel[]> = {
  [ToolType.PLAYER_HAND]: [{"x":6,"y":0,"color":"#5decf5"},{"x":7,"y":0,"color":"#5decf5"},{"x":8,"y":0,"color":"#5decf5"},{"x":9,"y":0,"color":"#5decf5"},{"x":6,"y":1,"color":"#5decf5"},{"x":7,"y":1,"color":"#5decf5"},{"x":8,"y":1,"color":"#5decf5"},{"x":9,"y":1,"color":"#5decf5"},{"x":6,"y":2,"color":"#5decf5"},{"x":7,"y":2,"color":"#5decf5"},{"x":8,"y":2,"color":"#5decf5"},{"x":9,"y":2,"color":"#5decf5"},{"x":6,"y":3,"color":"#5decf5"},{"x":7,"y":3,"color":"#5decf5"},{"x":8,"y":3,"color":"#5decf5"},{"x":9,"y":3,"color":"#5decf5"},{"x":6,"y":4,"color":"#5decf5"},{"x":7,"y":4,"color":"#5decf5"},{"x":8,"y":4,"color":"#5decf5"},{"x":9,"y":4,"color":"#5decf5"},{"x":6,"y":5,"color":"#5decf5"},{"x":7,"y":5,"color":"#5decf5"},{"x":8,"y":5,"color":"#5decf5"},{"x":9,"y":5,"color":"#5decf5"},{"x":6,"y":6,"color":"#5decf5"},{"x":7,"y":6,"color":"#5decf5"},{"x":8,"y":6,"color":"#5decf5"},{"x":9,"y":6,"color":"#5decf5"},{"x":6,"y":7,"color":"#5decf5"},{"x":7,"y":7,"color":"#5decf5"},{"x":8,"y":7,"color":"#5decf5"},{"x":9,"y":7,"color":"#5decf5"},{"x":6,"y":8,"color":"#5decf5"},{"x":7,"y":8,"color":"#5decf5"},{"x":8,"y":8,"color":"#5decf5"},{"x":9,"y":8,"color":"#5decf5"},{"x":6,"y":9,"color":"#5decf5"},{"x":7,"y":9,"color":"#5decf5"},{"x":8,"y":9,"color":"#5decf5"},{"x":9,"y":9,"color":"#5decf5"},{"x":6,"y":10,"color":"#ffdbac"},{"x":7,"y":10,"color":"#ffdbac"},{"x":8,"y":10,"color":"#ffdbac"},{"x":9,"y":10,"color":"#ffdbac"},{"x":6,"y":11,"color":"#ffdbac"},{"x":7,"y":11,"color":"#ffdbac"},{"x":8,"y":11,"color":"#ffdbac"},{"x":9,"y":11,"color":"#ffdbac"},{"x":6,"y":12,"color":"#ffdbac"},{"x":7,"y":12,"color":"#ffdbac"},{"x":8,"y":12,"color":"#ffdbac"},{"x":9,"y":12,"color":"#ffdbac"},{"x":6,"y":13,"color":"#ffdbac"},{"x":7,"y":13,"color":"#ffdbac"},{"x":8,"y":13,"color":"#ffdbac"},{"x":9,"y":13,"color":"#ffdbac"},{"x":6,"y":14,"color":"#ffdbac"},{"x":7,"y":14,"color":"#ffdbac"},{"x":8,"y":14,"color":"#ffdbac"},{"x":9,"y":14,"color":"#ffdbac"},{"x":6,"y":15,"color":"#ffdbac"},{"x":7,"y":15,"color":"#ffdbac"},{"x":8,"y":15,"color":"#ffdbac"},{"x":9,"y":15,"color":"#ffdbac"}],
  [ToolType.PICKAXE]: [{"x":0,"y":10,"color":"#e0e0e0"},{"x":0,"y":11,"color":"#e0e0e0"},{"x":0,"y":12,"color":"#e0e0e0"},{"x":1,"y":12,"color":"#e0e0e0"},{"x":2,"y":12,"color":"#e0e0e0"},{"x":3,"y":12,"color":"#e0e0e0"},{"x":3,"y":13,"color":"#e0e0e0"},{"x":3,"y":14,"color":"#e0e0e0"},{"x":3,"y":15,"color":"#e0e0e0"},{"x":0,"y":9,"color":"#333333"},{"x":2,"y":13,"color":"#e0e0e0"},{"x":4,"y":15,"color":"#e0e0e0"},{"x":5,"y":15,"color":"#e0e0e0"},{"x":6,"y":15,"color":"#e0e0e0"},{"x":4,"y":11,"color":"#4e342e"},{"x":5,"y":10,"color":"#4e342e"},{"x":6,"y":9,"color":"#4e342e"},{"x":7,"y":8,"color":"#4e342e"},{"x":8,"y":7,"color":"#4e342e"},{"x":9,"y":6,"color":"#4e342e"},{"x":10,"y":5,"color":"#4e342e"},{"x":11,"y":4,"color":"#4e342e"},{"x":12,"y":3,"color":"#4e342e"},{"x":13,"y":2,"color":"#4e342e"},{"x":0,"y":8,"color":"#333333"},{"x":7,"y":15,"color":"#333333"},{"x":8,"y":15,"color":"#333333"},{"x":1,"y":9,"color":"#333333"},{"x":1,"y":10,"color":"#333333"},{"x":1,"y":11,"color":"#333333"},{"x":4,"y":14,"color":"#333333"},{"x":5,"y":14,"color":"#333333"},{"x":6,"y":14,"color":"#333333"},{"x":14,"y":1,"color":"#4e342e"},{"x":15,"y":0,"color":"#5decf5"}],
  [ToolType.AXE]: [
    {x:0,y:0,color:"#4e342e"},{x:1,y:1,color:"#4e342e"},{x:2,y:2,color:"#4e342e"},{x:3,y:3,color:"#4e342e"},
    {x:4,y:4,color:"#4e342e"},{x:5,y:5,color:"#4e342e"},{x:6,y:6,color:"#4e342e"},{x:7,y:7,color:"#4e342e"},
    {x:8,y:8,color:"#4e342e"},{x:9,y:9,color:"#4e342e"},{x:10,y:10,color:"#4e342e"},
    {x:9,y:11,color:"#e0e0e0"},{x:10,y:11,color:"#e0e0e0"},{x:11,y:11,color:"#e0e0e0"},
    {x:8,y:12,color:"#e0e0e0"},{x:9,y:12,color:"#e0e0e0"},{x:10,y:12,color:"#e0e0e0"},{x:11,y:12,color:"#e0e0e0"},
    {x:8,y:13,color:"#e0e0e0"},{x:9,y:13,color:"#e0e0e0"},{x:10,y:13,color:"#e0e0e0"},
    {x:11,y:10,color:"#808080"},{x:11,y:9,color:"#808080"}
  ],
  [ToolType.SHOVEL]: [
    {x:0,y:0,color:"#4e342e"},{x:1,y:1,color:"#4e342e"},{x:2,y:2,color:"#4e342e"},{x:3,y:3,color:"#4e342e"},
    {x:4,y:4,color:"#4e342e"},{x:5,y:5,color:"#4e342e"},{x:6,y:6,color:"#4e342e"},{x:7,y:7,color:"#4e342e"},
    {x:8,y:8,color:"#4e342e"},{x:9,y:9,color:"#4e342e"},{x:10,y:10,color:"#4e342e"},
    {x:11,y:11,color:"#e0e0e0"},{x:12,y:12,color:"#e0e0e0"},{x:13,y:13,color:"#e0e0e0"},
    {x:10,y:12,color:"#e0e0e0"},{x:11,y:13,color:"#e0e0e0"},{x:12,y:11,color:"#e0e0e0"},{x:13,y:12,color:"#e0e0e0"}
  ]
};

export type BlockFace = 'top' | 'side' | 'bottom';

export interface ItemStack {
  type: BlockType | ToolType;
  count: number;
}

export const BLOCK_COLORS: Record<number, string> = {
  [BlockType.AIR]: '#000000',
  [BlockType.GRASS]: '#55a02e',
  [BlockType.DIRT]: '#79553a',
  [BlockType.STONE]: '#808080',
  [BlockType.WOOD]: '#6a4a3a',
  [BlockType.BIRCH_WOOD]: '#d7d1c1',
  [BlockType.SPRUCE_WOOD]: '#4a3222',
  [BlockType.LEAVES]: '#2d5a27',
  [BlockType.BIRCH_LEAVES]: '#6ba04a',
  [BlockType.SPRUCE_LEAVES]: '#1c3d20',
  [BlockType.WATER]: '#1e90ff',
  [BlockType.SAND]: '#d9c28e',
  [BlockType.BEDROCK]: '#222222',
  [BlockType.COAL_ORE]: '#333333',
  [BlockType.IRON_ORE]: '#d8af93',
  [BlockType.GOLD_ORE]: '#fce166',
  [BlockType.DIAMOND_ORE]: '#5decf5',
  [BlockType.REDSTONE_ORE]: '#ff0000',
  [BlockType.LAPIS_ORE]: '#102ad1',
  [BlockType.COPPER_ORE]: '#e77c56',
  [BlockType.PLANKS]: '#a1887f',
  [BlockType.CRAFTING_TABLE]: '#795548',
  [BlockType.STICK]: '#4e342e',
  [BlockType.TORCH]: '#ffa500',
  [BlockType.MOSS]: '#4b6329',
  [BlockType.BUSH_TINY]: '#55a02e',
  [BlockType.BUSH_DENSE]: '#2d5a27',
  [BlockType.BUSH_FLOWERING]: '#6ba04a',
};

export const BLOCK_HARDNESS: Record<number, number> = {
  [BlockType.AIR]: 0,
  [BlockType.GRASS]: 0.6,
  [BlockType.DIRT]: 0.5,
  [BlockType.STONE]: 1.5,
  [BlockType.WOOD]: 2.0,
  [BlockType.BIRCH_WOOD]: 2.0,
  [BlockType.SPRUCE_WOOD]: 2.0,
  [BlockType.LEAVES]: 0.2,
  [BlockType.BIRCH_LEAVES]: 0.2,
  [BlockType.SPRUCE_LEAVES]: 0.2,
  [BlockType.WATER]: -1,
  [BlockType.SAND]: 0.5,
  [BlockType.BEDROCK]: -1,
  [BlockType.COAL_ORE]: 3.0,
  [BlockType.IRON_ORE]: 3.0,
  [BlockType.GOLD_ORE]: 3.0,
  [BlockType.DIAMOND_ORE]: 3.0,
  [BlockType.REDSTONE_ORE]: 3.0,
  [BlockType.LAPIS_ORE]: 3.0,
  [BlockType.COPPER_ORE]: 3.0,
  [BlockType.PLANKS]: 2.0,
  [BlockType.CRAFTING_TABLE]: 2.5,
  [BlockType.STICK]: 0,
  [BlockType.TORCH]: 0,
  [BlockType.MOSS]: 0.1,
  [BlockType.BUSH_TINY]: 0.1,
  [BlockType.BUSH_DENSE]: 0.2,
  [BlockType.BUSH_FLOWERING]: 0.2,
};

export const BLOCK_TOOL_MAP: Record<number, ToolType> = {
  [BlockType.AIR]: ToolType.NONE,
  [BlockType.GRASS]: ToolType.SHOVEL,
  [BlockType.DIRT]: ToolType.SHOVEL,
  [BlockType.SAND]: ToolType.SHOVEL,
  [BlockType.STONE]: ToolType.PICKAXE,
  [BlockType.WOOD]: ToolType.AXE,
  [BlockType.BIRCH_WOOD]: ToolType.AXE,
  [BlockType.SPRUCE_WOOD]: ToolType.AXE,
  [BlockType.LEAVES]: ToolType.NONE,
  [BlockType.BIRCH_LEAVES]: ToolType.NONE,
  [BlockType.SPRUCE_LEAVES]: ToolType.NONE,
  [BlockType.WATER]: ToolType.NONE,
  [BlockType.BEDROCK]: ToolType.NONE,
  [BlockType.COAL_ORE]: ToolType.PICKAXE,
  [BlockType.IRON_ORE]: ToolType.PICKAXE,
  [BlockType.GOLD_ORE]: ToolType.PICKAXE,
  [BlockType.DIAMOND_ORE]: ToolType.PICKAXE,
  [BlockType.REDSTONE_ORE]: ToolType.PICKAXE,
  [BlockType.LAPIS_ORE]: ToolType.PICKAXE,
  [BlockType.COPPER_ORE]: ToolType.PICKAXE,
  [BlockType.PLANKS]: ToolType.AXE,
  [BlockType.CRAFTING_TABLE]: ToolType.AXE,
  [BlockType.TORCH]: ToolType.NONE,
  [BlockType.MOSS]: ToolType.NONE,
  [BlockType.BUSH_TINY]: ToolType.NONE,
  [BlockType.BUSH_DENSE]: ToolType.NONE,
  [BlockType.BUSH_FLOWERING]: ToolType.NONE,
};

export const BLOCK_TEXTURES: Record<number, { top: number, side: number, bottom: number }> = {
  [BlockType.AIR]: { top: 0, side: 0, bottom: 0 },
  [BlockType.GRASS]: { top: 0, side: 8, bottom: 16 }, 
  [BlockType.DIRT]: { top: 16, side: 16, bottom: 16 }, 
  [BlockType.STONE]: { top: 24, side: 24, bottom: 24 }, 
  [BlockType.WOOD]: { top: 32, side: 33, bottom: 32 },
  [BlockType.LEAVES]: { top: 34, side: 34, bottom: 34 },
  [BlockType.WATER]: { top: 35, side: 35, bottom: 35 },
  [BlockType.SAND]: { top: 36, side: 36, bottom: 36 },
  [BlockType.BIRCH_WOOD]: { top: 37, side: 38, bottom: 37 },
  [BlockType.BIRCH_LEAVES]: { top: 42, side: 42, bottom: 42 },
  [BlockType.SPRUCE_WOOD]: { top: 43, side: 44, bottom: 43 },
  [BlockType.SPRUCE_LEAVES]: { top: 48, side: 48, bottom: 48 },
  [BlockType.BEDROCK]: { top: 50, side: 50, bottom: 50 },
  [BlockType.COAL_ORE]: { top: 54, side: 54, bottom: 54 },
  [BlockType.IRON_ORE]: { top: 55, side: 55, bottom: 55 },
  [BlockType.GOLD_ORE]: { top: 56, side: 56, bottom: 56 },
  [BlockType.DIAMOND_ORE]: { top: 57, side: 57, bottom: 57 },
  [BlockType.REDSTONE_ORE]: { top: 58, side: 58, bottom: 58 },
  [BlockType.LAPIS_ORE]: { top: 59, side: 59, bottom: 59 },
  [BlockType.COPPER_ORE]: { top: 60, side: 60, bottom: 60 },
  [BlockType.PLANKS]: { top: 61, side: 61, bottom: 61 },
  [BlockType.CRAFTING_TABLE]: { top: 62, side: 63, bottom: 61 },
  [BlockType.STICK]: { top: 64, side: 64, bottom: 64 }, 
  [BlockType.TORCH]: { top: 65, side: 65, bottom: 65 }, 
  [BlockType.MOSS]: { top: 66, side: 66, bottom: 66 }, 
  [BlockType.BUSH_TINY]: { top: 67, side: 67, bottom: 67 },
  [BlockType.BUSH_DENSE]: { top: 68, side: 68, bottom: 68 },
  [BlockType.BUSH_FLOWERING]: { top: 69, side: 69, bottom: 69 },
};

export const CRACK_START_INDEX = 80; 

export const FACE_CONFIG = [
  { dir: [0, 1, 0], name: 'top', corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], name: 'bottom', corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { dir: [0, 0, 1], name: 'side', corners: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]] }, 
  { dir: [0, 0, -1], name: 'side', corners: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]] }, 
  { dir: [-1, 0, 0], name: 'side', corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]] }, 
  { dir: [1, 0, 0], name: 'side', corners: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]] }, 
];
