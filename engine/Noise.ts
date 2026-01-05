
export class SimplexNoise {
  private p: number[] = new Array(256);
  private perm: number[] = new Array(512);
  private grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  constructor(seed: number = 12345) {
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(Math.abs(Math.sin(s++)) * 10000) % (i + 1);
      [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  private dot3(g: number[], x: number, y: number, z: number): number {
    return g[0] * x + g[1] * y + g[2] * z;
  }

  public noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const g0 = this.grad3[this.perm[ii + this.perm[jj]] % 12];
    const g1 = this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12];
    const g2 = this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12];
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    let n0 = t0 < 0 ? 0 : Math.pow(t0, 4) * this.dot(g0, x0, y0);
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    let n1 = t1 < 0 ? 0 : Math.pow(t1, 4) * this.dot(g1, x1, y1);
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    let n2 = t2 < 0 ? 0 : Math.pow(t2, 4) * this.dot(g2, x2, y2);
    return 70.0 * (n0 + n1 + n2);
  }

  public noise3D(x: number, y: number, z: number): number {
    const F3 = 1.0 / 3.0;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const G3 = 1.0 / 6.0;
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3; const y1 = y0 - j1 + G3; const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3; const y2 = y0 - j2 + 2.0 * G3; const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3; const y3 = y0 - 1.0 + 3.0 * G3; const z3 = z0 - 1.0 + 3.0 * G3;
    const ii = i & 255; const jj = j & 255; const kk = k & 255;
    const g0 = this.grad3[this.perm[ii + this.perm[jj + this.perm[kk]]] % 12];
    const g1 = this.grad3[this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12];
    const g2 = this.grad3[this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] % 12];
    const g3 = this.grad3[this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12];
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    let n0 = t0 < 0 ? 0 : Math.pow(t0, 4) * this.dot3(g0, x0, y0, z0);
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    let n1 = t1 < 0 ? 0 : Math.pow(t1, 4) * this.dot3(g1, x1, y1, z1);
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    let n2 = t2 < 0 ? 0 : Math.pow(t2, 4) * this.dot3(g2, x2, y2, z2);
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    let n3 = t3 < 0 ? 0 : Math.pow(t3, 4) * this.dot3(g3, x3, y3, z3);
    return 32.0 * (n0 + n1 + n2 + n3);
  }

  public fBm2D(x: number, y: number, octaves: number, persistence: number, scale: number): number {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}
