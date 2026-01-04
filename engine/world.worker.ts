
/* WORLD WORKER - High-performance Voxel Meshing with AO */

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;
const ATLAS_COLS = 8;
const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const PADDING = 1;
const FULL_TILE = 18;

const FACE_CONFIG = [
  { dir: [0, 1, 0], name: 'top', corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], name: 'bottom', corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { dir: [0, 0, 1], name: 'side', corners: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]] }, 
  { dir: [0, 0, -1], name: 'side', corners: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]] }, 
  { dir: [-1, 0, 0], name: 'side', corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]] }, 
  { dir: [1, 0, 0], name: 'side', corners: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]] }, 
];

const BLOCK_TEXTURES: Record<number, any> = {
  1: { top: 0, side: 8, bottom: 16 }, // Grass
  2: { top: 16, side: 16, bottom: 16 }, // Dirt
  3: { top: 24, side: 24, bottom: 24 }, // Stone
  4: { top: 32, side: 33, bottom: 32 }, // Wood
  6: { top: 35, side: 35, bottom: 35 }, // Water
  12: { top: 50, side: 50, bottom: 50 }, // Bedrock
};

class SimplexNoise {
  p: Uint8Array;
  perm: Uint8Array;
  grad3: number[][];

  constructor(seed = 12345) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(Math.abs(Math.sin(s++)) * 10000) % (i + 1);
      [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }

  noise2D(xin: number, yin: number) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255, jj = j & 255;
    const g0 = this.grad3[this.perm[ii + this.perm[jj]] % 12];
    const g1 = this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12];
    const g2 = this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12];
    const n0 = Math.max(0, 0.5 - x0*x0 - y0*y0)**4 * (g0[0]*x0 + g0[1]*y0);
    const n1 = Math.max(0, 0.5 - x1*x1 - y1*y1)**4 * (g1[0]*x1 + g1[1]*y1);
    const n2 = Math.max(0, 0.5 - x2*x2 - y2*y2)**4 * (g2[0]*x2 + g2[1]*y2);
    return 70.0 * (n0 + n1 + n2);
  }
}

const nCont = new SimplexNoise(444);

self.onmessage = (e: MessageEvent) => {
  const { cx, cz, type } = e.data;
  if (type === 'generate') {
    const chunk = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    
    // 1. Generation
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const h = Math.floor(64 + nCont.noise2D(wx * 0.01, wz * 0.01) * 20);
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let b = 0;
          if (y === 0) b = 12;
          else if (y < h - 4) b = 3;
          else if (y < h) b = 2;
          else if (y === h) b = 1;
          chunk[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] = b;
        }
      }
    }

    // 2. Meshing
    const pos: number[] = [], uv: number[] = [], norm: number[] = [], ind: number[] = [], colArr: number[] = [];
    let count = 0;

    const getBlock = (lx: number, ly: number, lz: number) => {
      if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return 0;
      return chunk[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT];
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = getBlock(x, y, z);
          if (block === 0) continue;

          for (const face of FACE_CONFIG) {
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const neighbor = getBlock(nx, ny, nz);
            if (neighbor !== 0 && neighbor !== 6) continue;

            const textures = BLOCK_TEXTURES[block] || BLOCK_TEXTURES[1];
            const texIdx = textures[face.name] || textures.side;
            const tx = texIdx % ATLAS_COLS, ty = Math.floor(texIdx / ATLAS_COLS);
            const u0 = (tx * FULL_TILE + PADDING) / ATLAS_SIZE;
            const u1 = (tx * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE;
            const v0 = 1 - (ty * FULL_TILE + PADDING + TILE_SIZE) / ATLAS_SIZE;
            const v1 = 1 - (ty * FULL_TILE + PADDING) / ATLAS_SIZE;
            const uvMap = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];

            for (let i = 0; i < 4; i++) {
              pos.push(cx * CHUNK_SIZE + x + face.corners[i][0], y + face.corners[i][1], cz * CHUNK_SIZE + z + face.corners[i][2]);
              norm.push(...face.dir);
              uv.push(...uvMap[i]);
              colArr.push(1, 1, 1);
            }
            ind.push(count, count + 1, count + 2, count, count + 2, count + 3);
            count += 4;
          }
        }
      }
    }

    const meshData = {
      positions: new Float32Array(pos),
      uvs: new Float32Array(uv),
      normals: new Float32Array(norm),
      colors: new Float32Array(colArr),
      indices: new Uint32Array(ind)
    };

    const transfers = [chunk.buffer, meshData.positions.buffer, meshData.uvs.buffer, meshData.normals.buffer, meshData.colors.buffer, meshData.indices.buffer];
    (self as any).postMessage({ type: 'generated', cx, cz, chunk, meshData }, transfers);
  }
};
