
import { CHUNK_SIZE, CHUNK_HEIGHT, BlockType, FACE_CONFIG, BLOCK_TEXTURES, ATLAS_COLS, ATLAS_SIZE, FULL_TILE, PADDING, TILE_SIZE } from '../constants';
import { SimplexNoise } from './Noise';
import * as THREE from 'three';

export interface SubMeshData {
  positions: Float32Array;
  uvs: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface TorchData {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export interface MeshData {
  opaque: SubMeshData | null;
  transparent: SubMeshData | null;
  water: SubMeshData | null;
  torches: TorchData[];
}

enum BiomeType {
  OCEAN, BEACH, PLAINS, FOREST, JUNGLE, DESERT, MOUNTAINS, SWAMP, TAIGA, TUNDRA
}

export class WorldManager {
  public chunks: Map<string, Uint8Array> = new Map();
  private meshCache: Map<string, MeshData> = new Map();
  
  private continentalNoise = new SimplexNoise(444);
  private temperatureNoise = new SimplexNoise(666);
  private moistureNoise = new SimplexNoise(777);
  private detailNoise = new SimplexNoise(888);
  private caveNoise = new SimplexNoise(999);
  private treeNoise = new SimplexNoise(111);

  private modifiedChunks: Set<string> = new Set();
  private seaLevel = 60;
  private lastFluidTick = 0;
  private fluidTickInterval = 0.2; // 5 раз в секунду

  constructor() {
    this.loadFromLocalStorage();
  }

  public getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0 || by >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return BlockType.AIR;
    
    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[lx + by * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT];
  }

  public setBlock(x: number, y: number, z: number, type: BlockType) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0 || by >= CHUNK_HEIGHT) return;
    if (this.getBlock(bx, by, bz) === BlockType.BEDROCK) return;

    if (type === BlockType.AIR) {
      const neighbors = [
        [bx+1, by, bz], [bx-1, by, bz],
        [bx, by+1, bz], [bx, by-1, bz],
        [bx, by, bz+1], [bx, by, bz-1]
      ];
      const hasWaterAccess = neighbors.some(n => this.getBlock(n[0], n[1], n[2]) === BlockType.WATER);
      if (hasWaterAccess) {
        type = BlockType.WATER;
      }
    }

    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (chunk) {
      const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk[lx + by * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT] = type;
      this.modifiedChunks.add(key);
      this.saveToLocalStorage();
      this.invalidateMesh(cx, cz);
    }
  }

  public invalidateAllMeshes() {
    this.meshCache.clear();
  }

  private invalidateMesh(cx: number, cz: number) {
    const key = this.getChunkKey(cx, cz);
    this.meshCache.delete(key);
    this.meshCache.delete(this.getChunkKey(cx - 1, cz));
    this.meshCache.delete(this.getChunkKey(cx + 1, cz));
    this.meshCache.delete(this.getChunkKey(cx, cz - 1));
    this.meshCache.delete(this.getChunkKey(cx, cz + 1));
  }

  private getBiome(temp: number, moist: number, height: number): BiomeType {
    if (height < 0.25) return BiomeType.OCEAN;
    if (height < 0.3) return BiomeType.BEACH;
    if (height > 0.7) return BiomeType.MOUNTAINS;
    if (temp < -0.4) return BiomeType.TUNDRA;
    if (temp < -0.1) return BiomeType.TAIGA;
    if (moist > 0.5) return temp > 0.3 ? BiomeType.JUNGLE : BiomeType.SWAMP;
    if (moist < -0.4) return BiomeType.DESERT;
    return moist > 0 ? BiomeType.FOREST : BiomeType.PLAINS;
  }

  private getBiomeHeight(biome: BiomeType, wx: number, wz: number, baseH: number): number {
    switch (biome) {
      case BiomeType.MOUNTAINS:
        const peaks = Math.pow(Math.abs(this.detailNoise.fBm2D(wx, wz, 4, 0.5, 0.02)), 1.5);
        return 65 + baseH * 60 + peaks * 40;
      case BiomeType.PLAINS:
        return 64 + this.detailNoise.noise2D(wx * 0.01, wz * 0.01) * 4;
      case BiomeType.DESERT:
        const dunes = Math.abs(this.detailNoise.noise2D(wx * 0.02, wz * 0.005)) * 8;
        return 64 + dunes;
      case BiomeType.SWAMP:
        return 61 + this.detailNoise.noise2D(wx * 0.05, wz * 0.05) * 2;
      case BiomeType.OCEAN:
        return 40 + baseH * 20;
      default:
        return 64 + baseH * 15 + this.detailNoise.noise2D(wx * 0.02, wz * 0.02) * 5;
    }
  }

  public generateChunk(cx: number, cz: number): Uint8Array {
    const key = this.getChunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key)!;

    const chunk = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const biomeMap: BiomeType[][] = Array(CHUNK_SIZE).fill(0).map(() => Array(CHUNK_SIZE).fill(BiomeType.PLAINS));
    const heightMap: number[][] = Array(CHUNK_SIZE).fill(0).map(() => Array(CHUNK_SIZE).fill(0));

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const cont = this.continentalNoise.fBm2D(wx, wz, 3, 0.5, 0.005);
        const temp = this.temperatureNoise.noise2D(wx * 0.002, wz * 0.002) - (cont * 0.2);
        const moist = this.moistureNoise.noise2D(wx * 0.003, wz * 0.003) + (cont * 0.1);
        const biome = this.getBiome(temp, moist, (cont + 1) / 2);
        biomeMap[x][z] = biome;
        const h = Math.floor(this.getBiomeHeight(biome, wx, wz, (cont + 1) / 2));
        heightMap[x][z] = h;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockType.AIR;
          if (y === 0) block = BlockType.BEDROCK;
          else if (y < h - 4) {
             const caveValue = this.caveNoise.noise3D(wx * 0.04, y * 0.08, wz * 0.04);
             if (caveValue > 0.45) block = BlockType.AIR;
             else block = BlockType.STONE;
          }
          else if (y < h) block = BlockType.DIRT;
          else if (y === h) {
            if (h <= this.seaLevel) block = BlockType.SAND;
            else if (biome === BiomeType.DESERT) block = BlockType.SAND;
            else if (biome === BiomeType.SWAMP) block = BlockType.MOSS;
            else block = BlockType.GRASS;
          }
          
          if (block === BlockType.AIR && y > h && y <= this.seaLevel) {
            block = BlockType.WATER;
          }

          chunk[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] = block;
        }
      }
    }
    this.chunks.set(key, chunk);
    this.invalidateMesh(cx, cz);

    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      for (let z = 1; z < CHUNK_SIZE - 1; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const h = heightMap[x][z];
        const biome = biomeMap[x][z];
        
        if (h > this.seaLevel && this.getBlock(wx, h, wz) !== BlockType.AIR) {
          const tNoise = this.treeNoise.noise2D(wx * 0.2, wz * 0.2);
          let treeChance = 0.002;
          if (biome === BiomeType.FOREST) treeChance = 0.02;
          if (biome === BiomeType.JUNGLE) treeChance = 0.05;
          if (biome === BiomeType.TAIGA) treeChance = 0.015;

          if (Math.random() < treeChance) {
            if (biome === BiomeType.TAIGA) this.growSpruceTree(chunk, x, h + 1, z);
            else if (biome === BiomeType.JUNGLE) this.growOakTree(chunk, x, h + 1, z, 10);
            else if (tNoise > 0.5) this.growBirchTree(chunk, x, h + 1, z);
            else this.growOakTree(chunk, x, h + 1, z);
          } else if (Math.random() < 0.1 && biome !== BiomeType.DESERT) {
            const bushType = biome === BiomeType.SWAMP ? BlockType.BUSH_DENSE : (Math.random() > 0.8 ? BlockType.BUSH_FLOWERING : BlockType.BUSH_TINY);
            this.growBush(chunk, x, h + 1, z, bushType);
          }
        }
      }
    }
    return chunk;
  }

  private isTransparent(type: BlockType): boolean {
    return type === BlockType.AIR || type === BlockType.WATER || 
           type === BlockType.LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || 
           type === BlockType.TORCH || type === BlockType.BUSH_TINY || type === BlockType.BUSH_DENSE || type === BlockType.BUSH_FLOWERING;
  }

  private buildChunkMesh(cx: number, cz: number): MeshData | null {
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (!chunk) return null;
    
    const initMesh = () => ({ pos: [] as number[], uv: [] as number[], norm: [] as number[], col: [] as number[], ind: [] as number[], count: 0 });
    const opaque = initMesh();
    const transparent = initMesh();
    const water = initMesh();
    const torches: TorchData[] = [];

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT];
          if (block === BlockType.AIR) continue;
          if (block === BlockType.TORCH) {
            torches.push({ position: new THREE.Vector3(cx * CHUNK_SIZE + x + 0.5, y, cz * CHUNK_SIZE + z + 0.5), rotation: new THREE.Euler(0, 0, 0) });
            continue; 
          }
          
          const isWater = block === BlockType.WATER;
          const target = isWater ? water : (this.isTransparent(block) ? transparent : opaque);
          
          const wx = cx * CHUNK_SIZE + x;
          const wz = cz * CHUNK_SIZE + z;
          
          for (const face of FACE_CONFIG) {
            const nx = wx + face.dir[0], ny = y + face.dir[1], nz = wz + face.dir[2];
            const neighbor = this.getBlock(nx, ny, nz);

            if (isWater) {
              if (face.name === 'top') {
                // Рисуем горизонтальную гладь только если сверху ВОЗДУХ
                if (neighbor !== BlockType.AIR) continue;
              } else {
                // Боковые и нижние грани рисуем ТОЛЬКО против ТВЕРДЫХ блоков.
                // Если сосед — воздух или любой прозрачный блок, грань НЕ рисуем.
                if (this.isTransparent(neighbor)) continue;
              }
            } else {
              // Стандартный куллинг для твердых блоков
              if (!this.isTransparent(neighbor) || neighbor === block) continue;
            }

            let texIndex = BLOCK_TEXTURES[block][face.name as keyof typeof BLOCK_TEXTURES[BlockType.GRASS]];
            const col = texIndex % ATLAS_COLS, row = Math.floor(texIndex / ATLAS_COLS);
            
            const uvInset = isWater ? 7.5 : 0.05; 
            let u0 = (col * FULL_TILE + PADDING + uvInset) / ATLAS_SIZE;
            let u1 = (col * FULL_TILE + PADDING + TILE_SIZE - uvInset) / ATLAS_SIZE;
            const v0 = 1 - (row * FULL_TILE + PADDING + TILE_SIZE - uvInset) / ATLAS_SIZE;
            const v1 = 1 - (row * FULL_TILE + PADDING + uvInset) / ATLAS_SIZE;
            const uvMap = [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];

            for (let i = 0; i < 4; i++) {
              const corner = face.corners[i];
              target.pos.push(wx + corner[0], y + corner[1], wz + corner[2]);
              target.norm.push(...face.dir);
              target.uv.push(uvMap[i][0], uvMap[i][1]);
              target.col.push(1, 1, 1);
            }
            target.ind.push(target.count, target.count + 1, target.count + 2, target.count, target.count + 2, target.count + 3);
            target.count += 4;
          }
        }
      }
    }
    const buildSubMesh = (s: any): SubMeshData | null => {
      if (s.count === 0) return null;
      return { 
        positions: new Float32Array(s.pos), 
        uvs: new Float32Array(s.uv), 
        normals: new Float32Array(s.norm), 
        colors: new Float32Array(s.col), 
        indices: new Uint32Array(s.ind) 
      };
    };
    return { opaque: buildSubMesh(opaque), transparent: buildSubMesh(transparent), water: buildSubMesh(water), torches };
  }

  public getOrBuildMesh(cx: number, cz: number): MeshData | null {
    const key = this.getChunkKey(cx, cz);
    if (this.meshCache.has(key)) return this.meshCache.get(key)!;
    const mesh = this.buildChunkMesh(cx, cz);
    if (mesh) this.meshCache.set(key, mesh);
    return mesh;
  }

  private growBush(chunk: Uint8Array, lx: number, ly: number, lz: number, type: BlockType) {
    const branches = type === BlockType.BUSH_TINY ? 1 : (type === BlockType.BUSH_FLOWERING ? 3 : 5);
    const baseRadius = type === BlockType.BUSH_TINY ? 0.9 : (type === BlockType.BUSH_FLOWERING ? 1.3 : 1.7);
    for (let b = 0; b < branches; b++) {
      const bx = (Math.random() - 0.5) * branches * 0.5, bz = (Math.random() - 0.5) * branches * 0.5, by = Math.random() * (branches * 0.3);
      const radius = baseRadius * (0.6 + Math.random() * 0.6), rLimit = Math.ceil(radius);
      for (let x = -rLimit; x <= rLimit; x++) {
        for (let y = -rLimit; y <= rLimit; y++) {
          for (let z = -rLimit; z <= rLimit; z++) {
            const dx = x - bx, dy = y - by, dz = z - bz;
            if (dx * dx + (dy * 1.5) * (dy * 1.5) + dz * dz <= radius * radius && Math.random() > 0.65) {
              this.setBlockInChunk(chunk, Math.floor(lx + x), Math.floor(ly + y), Math.floor(lz + z), type);
            }
          }
        }
      }
    }
    this.setBlockInChunk(chunk, lx, ly, lz, type);
  }

  private setBlockInChunk(chunk: Uint8Array, lx: number, ly: number, lz: number, type: BlockType) {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
        const idx = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT;
        if (chunk[idx] === BlockType.AIR) chunk[idx] = type;
    }
  }

  private growOakTree(chunk: Uint8Array, lx: number, ly: number, lz: number, minH = 4) {
    const height = minH + Math.floor(Math.random() * 3);
    for (let i = 0; i < height; i++) this.setBlockInChunk(chunk, lx, ly + i, lz, BlockType.WOOD);
    for (let y = ly + height - 3; y <= ly + height + 1; y++) {
        const radius = y > ly + height ? 1 : 2;
        for (let ox = -radius; ox <= radius; ox++) {
            for (let oz = -radius; oz <= radius; oz++) {
                if (Math.abs(ox) === radius && Math.abs(oz) === radius && Math.random() > 0.5) continue;
                this.setBlockInChunk(chunk, lx + ox, y, lz + oz, BlockType.LEAVES);
            }
        }
    }
  }

  private growBirchTree(chunk: Uint8Array, lx: number, ly: number, lz: number) {
    const height = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < height; i++) this.setBlockInChunk(chunk, lx, ly + i, lz, BlockType.BIRCH_WOOD);
    for (let y = ly + height - 3; y <= ly + height + 1; y++) {
        const radius = y > ly + height ? 1 : 2;
        for (let ox = -radius; ox <= radius; ox++) {
            for (let oz = -radius; oz <= radius; oz++) {
                if (Math.abs(ox) === radius && Math.abs(oz) === radius && Math.random() > 0.4) continue;
                this.setBlockInChunk(chunk, lx + ox, y, lz + oz, BlockType.BIRCH_LEAVES);
            }
        }
    }
  }

  private growSpruceTree(chunk: Uint8Array, lx: number, ly: number, lz: number) {
    const height = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < height; i++) this.setBlockInChunk(chunk, lx, ly + i, lz, BlockType.SPRUCE_WOOD);
    let radius = 1;
    for (let y = ly + height; y >= ly + 2; y--) {
        if ((ly + height - y) % 2 === 0 && radius < 3) radius++;
        const currentRadius = y === ly + height ? 0 : (y === ly + height - 1 ? 1 : radius);
        for (let ox = -currentRadius; ox <= currentRadius; ox++) {
            for (let oz = -currentRadius; oz <= currentRadius; oz++) {
                if (currentRadius > 1 && Math.abs(ox) === currentRadius && Math.abs(oz) === currentRadius) continue;
                this.setBlockInChunk(chunk, lx + ox, y, lz + oz, BlockType.SPRUCE_LEAVES);
            }
        }
    }
  }

  public tickEcosystem(activeChunkKeys: string[], time: number): boolean { return false; }

  public tickFluids(activeChunkKeys: string[], time: number): boolean {
    if (time - this.lastFluidTick < this.fluidTickInterval) return false;
    this.lastFluidTick = time;

    let changed = false;
    // Используем временный массив для записи изменений, чтобы не влиять на текущую итерацию
    const updates: {x: number, y: number, z: number}[] = [];

    for (const key of activeChunkKeys) {
      const chunk = this.chunks.get(key);
      if (!chunk) continue;
      const [cx, cz] = key.split(',').map(Number);

      for (let y = 1; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const idx = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT;
            if (chunk[idx] === BlockType.WATER) {
              const wx = cx * CHUNK_SIZE + x;
              const wz = cz * CHUNK_SIZE + z;

              // 1. Пытаемся течь вниз
              if (this.getBlock(wx, y - 1, wz) === BlockType.AIR) {
                updates.push({ x: wx, y: y - 1, z: wz });
                continue; // Если течем вниз, в стороны пока не течем
              }

              // 2. Пытаемся течь в стороны
              const neighbors = [
                [wx + 1, y, wz], [wx - 1, y, wz],
                [wx, y, wz + 1], [wx, y, wz - 1]
              ];
              for (const [nx, ny, nz] of neighbors) {
                if (this.getBlock(nx, ny, nz) === BlockType.AIR) {
                  updates.push({ x: nx, y: ny, z: nz });
                }
              }
            }
          }
        }
      }
    }

    if (updates.length > 0) {
      for (const up of updates) {
        const cx = Math.floor(up.x / CHUNK_SIZE);
        const cz = Math.floor(up.z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        if (chunk) {
          const lx = ((up.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const lz = ((up.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const idx = lx + up.y * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT;
          if (chunk[idx] === BlockType.AIR) {
            chunk[idx] = BlockType.WATER;
            this.invalidateMesh(cx, cz);
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  private saveToLocalStorage() {
    try {
      const dataToSave: Record<string, string> = {};
      this.modifiedChunks.forEach(key => {
        const chunk = this.chunks.get(key);
        if (chunk) dataToSave[key] = btoa(String.fromCharCode(...chunk));
      });
      localStorage.setItem('voxelcraft_world_v1', JSON.stringify(dataToSave));
    } catch (e) {}
  }

  private loadFromLocalStorage() {
    const saved = localStorage.getItem('voxelcraft_world_v1');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.entries(data).forEach(([key, base64]) => {
          const binaryString = atob(base64 as string);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          this.chunks.set(key, bytes);
          this.modifiedChunks.add(key);
        });
      } catch (e) {}
    }
  }

  public clearWorld() {
    localStorage.removeItem('voxelcraft_world_v1');
    localStorage.removeItem('voxelcraft_blueprints');
    localStorage.removeItem('voxelcraft_block_blueprints');
    localStorage.removeItem('voxelcraft_transforms');
    this.chunks.clear();
    this.meshCache.clear();
    this.modifiedChunks.clear();
  }
}
