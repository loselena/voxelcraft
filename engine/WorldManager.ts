import { CHUNK_SIZE, CHUNK_HEIGHT, BlockType } from '../constants';
import * as THREE from 'three';
// @ts-ignore
import WorldWorker from './world.worker?worker';

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

export class WorldManager {
  public chunks: Map<string, Uint8Array> = new Map();
  private meshCache: Map<string, MeshData> = new Map();
  private workers: Worker[] = [];
  private pendingRequests: Set<string> = new Set();
  private onChunkLoaded?: () => void;

  constructor() {
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new WorldWorker();
        worker.onmessage = (e) => this.handleWorkerMessage(e);
        this.workers.push(worker);
      } catch (err) {
        console.error('Failed to initialize Voxel Worker:', err);
      }
    }
  }

  public setOnChunkLoaded(cb: () => void) {
    this.onChunkLoaded = cb;
  }

  private handleWorkerMessage(e: MessageEvent) {
    const { type, cx, cz, chunk, meshData } = e.data;
    if (type === 'generated') {
      const key = this.getChunkKey(cx, cz);
      this.chunks.set(key, chunk);
      
      const opaque: SubMeshData = {
        positions: meshData.positions,
        uvs: meshData.uvs,
        normals: meshData.normals,
        colors: meshData.colors,
        indices: meshData.indices
      };

      this.meshCache.set(key, { 
        opaque, 
        transparent: null, 
        water: null, 
        torches: [] 
      });
      this.pendingRequests.delete(key);
      if (this.onChunkLoaded) this.onChunkLoaded();
    }
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
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (!chunk) return BlockType.AIR;
    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[lx + by * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT];
  }

  public requestChunk(cx: number, cz: number) {
    const key = this.getChunkKey(cx, cz);
    if (this.chunks.has(key) || this.pendingRequests.has(key)) return;
    this.pendingRequests.add(key);
    
    if (this.workers.length === 0) return;
    
    const workerIndex = Math.abs(cx + cz) % this.workers.length;
    this.workers[workerIndex].postMessage({ type: 'generate', cx, cz });
  }

  public getOrBuildMesh(cx: number, cz: number): MeshData | null {
    return this.meshCache.get(this.getChunkKey(cx, cz)) || null;
  }
  
  public setBlock(x: number, y: number, z: number, type: BlockType) {
     const bx = Math.floor(x);
     const by = Math.floor(y);
     const bz = Math.floor(z);
     if (by < 0 || by >= CHUNK_HEIGHT) return;
     const cx = Math.floor(bx / CHUNK_SIZE);
     const cz = Math.floor(bz / CHUNK_SIZE);
     const key = this.getChunkKey(cx, cz);
     const chunk = this.chunks.get(key);
     if (!chunk) return;
     const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
     const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
     chunk[lx + by * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT] = type;
     
     this.meshCache.delete(key);
     this.requestChunk(cx, cz);
  }
}
