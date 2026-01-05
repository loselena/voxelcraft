
import * as THREE from 'three';
import { ATLAS_SIZE, ATLAS_COLS, FULL_TILE, PADDING, TILE_SIZE, CRACK_START_INDEX, BlockType, BLOCK_TEXTURES } from '../constants';

export class TextureManager {
  private static instance: TextureManager;
  public textureAtlas: THREE.CanvasTexture;
  private customBlockTextures: Record<number, Record<string, string>> = {}; // index -> { "x,y": color }
  
  public opaqueMaterial: THREE.MeshLambertMaterial;
  public transparentMaterial: THREE.MeshLambertMaterial;
  public waterMaterial: THREE.MeshLambertMaterial;
  public torchWoodMaterial: THREE.MeshLambertMaterial;
  public torchBaseMaterial: THREE.MeshLambertMaterial;

  private constructor() {
    this.textureAtlas = this.generateAtlas();
    
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: this.textureAtlas,
      transparent: false,
      alphaTest: 0.5,
      vertexColors: true,
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: this.textureAtlas,
      transparent: true,
      alphaTest: 0.5,
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.textureAtlas,
      transparent: true,
      opacity: 0.3, // Ещё более прозрачная вода
      vertexColors: false, 
      side: THREE.FrontSide, // Отрисовка только внешних поверхностей
      depthWrite: false,
      color: "#1e90ff", 
    });

    this.torchWoodMaterial = new THREE.MeshLambertMaterial({ color: "#4e342e" });
    this.torchBaseMaterial = new THREE.MeshLambertMaterial({ color: "#211510" });
  }

  public static getInstance(): TextureManager {
    if (!this.instance) this.instance = new TextureManager();
    return this.instance;
  }

  public setCustomTextures(textures: Record<number, Record<string, string>>) {
    this.customBlockTextures = textures;
    this.refreshAtlas();
  }

  public refreshAtlas() {
    const canvas = this.textureAtlas.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    this.updateAtlasContent(ctx);
    this.textureAtlas.needsUpdate = true;
  }

  private generateAtlas(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    this.updateAtlasContent(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    return texture;
  }

  private updateAtlasContent(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    const drawPaddedTile = (index: number, colorBase: string, noise: number = 20, type: string = 'normal') => {
      const col = index % ATLAS_COLS;
      const row = Math.floor(index / ATLAS_COLS);
      const startX = col * FULL_TILE + PADDING;
      const startY = row * FULL_TILE + PADDING;

      const pixels: string[][] = Array(TILE_SIZE).fill('').map(() => Array(TILE_SIZE).fill(''));
      const customData = this.customBlockTextures[index];

      const getVar = (c: string, v: number) => {
        const color = new THREE.Color(c);
        const o = (Math.random() - 0.5) * (v / 255);
        color.offsetHSL(0, 0, o);
        return `#${color.getHexString()}`;
      };

      const leafTypes = ['leaves', 'birch_leaves', 'spruce_leaves', 'bush_tiny', 'bush_dense', 'bush_flowering'];
      
      if (leafTypes.includes(type)) {
        let palette: string[] = [];
        let flowers: string[] = [];
        if (type === 'leaves') palette = ['#358b22', '#2d5a27', '#4aad37', '#1b3d1a']; 
        else if (type === 'birch_leaves') palette = ['#80a755', '#6ba04a', '#a5c882', '#4d6932'];
        else if (type === 'spruce_leaves') palette = ['#2d4e34', '#1c3d20', '#3e6a4a', '#102614'];
        else if (type === 'bush_tiny') palette = ['#7cb342', '#689f38', '#9ccc65', '#33691e'];
        else if (type === 'bush_dense') palette = ['#2e7d32', '#1b5e20', '#4caf50', '#0a3d0d'];
        else if (type === 'bush_flowering') {
          palette = ['#388e3c', '#2e7d32', '#66bb6a', '#1b5e20'];
          flowers = ['#f06292', '#ec407a', '#f48fb1'];
        }
        const pseudoRand = (x: number, y: number) => {
          const val = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          return val - Math.floor(val);
        };
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const pr = pseudoRand(x, y);
            if (pr < 0.3) { pixels[y][x] = 'transparent'; continue; }
            if (flowers.length > 0 && pr > 0.92) { pixels[y][x] = flowers[Math.floor(pseudoRand(y, x) * flowers.length)]; continue; }
            const noiseVal = pseudoRand(x + 10, y + 20);
            if (noiseVal > 0.85) pixels[y][x] = palette[2];
            else if (noiseVal > 0.4) pixels[y][x] = palette[0];
            else if (noiseVal > 0.15) pixels[y][x] = palette[1];
            else pixels[y][x] = palette[3];
          }
        }
      } else if (type === 'water') {
        const wc = '#1e90ff';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pixels[y][x] = wc;
      } else if (type === 'grass_top') {
        const g1 = '#55a02e', g2 = '#4a8d28', g3 = '#3d7a20';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const r = Math.random();
          pixels[y][x] = r > 0.8 ? g3 : (r > 0.4 ? g2 : g1);
        }
      } else if (type === 'sand') {
        const s1 = '#d9c28e', s2 = '#e5d1a4', s3 = '#cbb27a';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const r = Math.random();
          pixels[y][x] = r > 0.85 ? s2 : (r > 0.7 ? s3 : s1);
        }
      } else if (type === 'grass_side') {
        const d1 = '#79553a', d2 = '#6b4b33', d3 = '#5d412d';
        const g1 = '#55a02e', g2 = '#4a8d28';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          if (y < 4 || (y < 7 && Math.random() > (y - 3) / 4)) pixels[y][x] = Math.random() > 0.5 ? g1 : g2;
          else { const r = Math.random(); pixels[y][x] = r > 0.8 ? d3 : (r > 0.4 ? d2 : d1); }
        }
      } else if (type === 'dirt') {
        const d1 = '#79553a', d2 = '#6b4b33', d3 = '#5d412d';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const r = Math.random(); pixels[y][x] = r > 0.9 ? d3 : (r > 0.5 ? d2 : d1);
        }
      } else if (type === 'stone') {
        const s1 = '#808080', s2 = '#737373', s3 = '#666666';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const r = Math.random(); pixels[y][x] = r > 0.9 ? s3 : (r > 0.7 ? s2 : s1);
        }
      } else if (type === 'log_side' || type === 'birch_side' || type === 'spruce_side') {
        const bBase = type === 'birch_side' ? '#d7d1c1' : (type === 'spruce_side' ? '#35251b' : '#5d412d');
        const bDark = type === 'birch_side' ? '#2e2e2e' : (type === 'spruce_side' ? '#251a12' : '#4e342e');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const isStripe = (x === 0 || x === 15 || (type === 'birch_side' && Math.random() > 0.92));
          pixels[y][x] = isStripe ? bDark : bBase;
          if (Math.random() > 0.8) pixels[y][x] = getVar(pixels[y][x], 10);
        }
      } else if (type.startsWith('tool_')) {
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pixels[y][x] = 'transparent';
          const h = '#5d412d', hd = '#432e21', s = '#7a7a7a', sl = '#9a9a9a', sd = '#5e5e5e';
          if (type === 'tool_pickaxe') {
            for(let i=0; i<9; i++) pixels[12-i][3+i] = (i%3===0 ? hd : h);
            const head = [[2,5,sd],[3,4,sd],[4,3,s],[5,2,s],[6,2,s],[7,2,s],[8,2,s],[9,3,s],[10,4,sd],[11,5,sd],[3,5,s],[4,4,sl],[5,3,sl],[6,3,sl],[7,3,sl],[8,3,sl],[9,4,sl],[10,5,s]];
            head.forEach(([px, py, c]) => pixels[py as number][px as number] = c as string);
          } else if (type === 'tool_axe') {
            for(let i=0; i<10; i++) pixels[13-i][2+i] = (i%3===0 ? hd : h);
            const blade = [[8,2,s],[9,2,s],[10,2,s],[7,3,s],[8,3,sl],[9,3,sl],[10,3,sd],[7,4,s],[8,4,sl],[9,4,sl],[7,5,s],[8,5,s],[9,3,sl],[10,2,s]];
            blade.forEach(([px, py, c]) => pixels[py as number][px as number] = c as string);
          } else if (type === 'tool_shovel') {
            for(let i=0; i<11; i++) pixels[13-i][2+i] = (i%3===0 ? hd : h);
            const scoop = [[11,2,sd],[12,2,s],[13,2,sd],[11,3,s],[12,3,sl],[13,3,s],[12,4,sd],[11,4,s],[13,4,s]];
            scoop.forEach(([px, py, c]) => pixels[py as number][px as number] = c as string);
          }
      } else {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pixels[y][x] = getVar(colorBase, noise);
      }

      if (customData) {
        for (let px = 0; px < TILE_SIZE; px++) {
          for (let py = 0; py < TILE_SIZE; py++) {
            const color = customData[`${px},${15 - py}`];
            if (color && color !== 'transparent') pixels[py][px] = color;
          }
        }
      }

      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const pColor = pixels[y][x];
          if (pColor !== 'transparent' && pColor !== '') {
            ctx.fillStyle = pColor;
            ctx.fillRect(startX + x, startY + y, 1, 1);
          }
        }
      }
      
      for (let x = 0; x < TILE_SIZE; x++) {
        ctx.fillStyle = pixels[0][x] || 'transparent';
        ctx.fillRect(startX + x, startY - 1, 1, 1);
        ctx.fillStyle = pixels[15][x] || 'transparent';
        ctx.fillRect(startX + x, startY + 16, 1, 1);
      }
      for (let y = 0; y < TILE_SIZE; y++) {
        ctx.fillStyle = pixels[y][0] || 'transparent';
        ctx.fillRect(startX - 1, startY + y, 1, 1);
        ctx.fillStyle = pixels[y][15] || 'transparent';
        ctx.fillRect(startX + 16, startY + y, 1, 1);
      }
    };

    for (let i = 0; i < 4; i++) {
        drawPaddedTile(0 + i, '#55a02e', 0, 'grass_top');
        drawPaddedTile(8 + i, '#79553a', 0, 'grass_side'); 
        drawPaddedTile(16 + i, '#79553a', 0, 'dirt'); 
        drawPaddedTile(24 + i, '#808080', 0, 'stone'); 
        drawPaddedTile(38 + i, '#f5f5f5', 0, 'birch_side');  
        drawPaddedTile(44 + i, '#35251b', 0, 'spruce_side'); 
        drawPaddedTile(50 + i, '#222222', 0, 'bedrock'); 
    }
    
    drawPaddedTile(34, '', 0, 'leaves');
    drawPaddedTile(42, '', 0, 'birch_leaves');
    drawPaddedTile(48, '', 0, 'spruce_leaves');
    drawPaddedTile(67, '', 0, 'bush_tiny');
    drawPaddedTile(68, '', 0, 'bush_dense');
    drawPaddedTile(69, '', 0, 'bush_flowering');

    drawPaddedTile(32, '#6a4a3a', 0, 'log_top'); 
    drawPaddedTile(33, '#5d412d', 0, 'log_side'); 
    drawPaddedTile(35, '#1e90ff', 0, 'water');
    drawPaddedTile(36, '#d9c28e', 0, 'sand'); 
    drawPaddedTile(37, '#e7e0d3', 0, 'log_top'); 
    drawPaddedTile(43, '#4a3222', 0, 'log_top');
    
    ['coal','iron','gold','diamond','redstone','lapis','copper'].forEach((ore, idx) => {
        drawPaddedTile(54 + idx, '#808080', 0, ore + '_ore');
    });

    drawPaddedTile(61, '#a1887f', 0, 'planks');
    drawPaddedTile(62, '#a1887f', 0, 'crafting_table_top');
    drawPaddedTile(63, '#a1887f', 0, 'crafting_table_side');
    drawPaddedTile(64, '#4e342e', 0, 'stick');
    drawPaddedTile(65, '#ffa500', 0, 'torch');
    drawPaddedTile(66, '#4b6329', 0, 'moss');

    drawPaddedTile(70, '#808080', 0, 'tool_pickaxe');
    drawPaddedTile(71, '#808080', 0, 'tool_axe');
    drawPaddedTile(72, '#808080', 0, 'tool_shovel');
  }
}
