// Tiny stack VM for make.fun tiny-stack-vm-01-run-20261122, written from the
// ISA in the kit (program/generator/subject/ISA.md). Node 22, stdlib only.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(p: Uint8Array, inp: Uint8Array): { out: number[]; code: number } {
  const S: number[] = [], C: number[] = [], M = new Int32Array(256), out: number[] = [];
  let pc = 0, ip = 0, steps = 0;
  const trap = (c: number) => ({ out, code: c });
  const take = (n: number): number[] | null => {
    if (S.length < n) return null;
    const v: number[] = [];
    for (let k = 0; k < n; k++) v.push(S.pop() as number);
    return v;
  };
  for (;;) {
    if (steps >= 1e6) return trap(10);
    if (pc < 0 || pc >= p.length) return trap(9);
    const op = p[pc];
    if (!(op === 0 || (op >= 1 && op <= 7) || (op >= 0x10 && op <= 0x22) || (op >= 0x30 && op <= 0x34) || op === 0x40 || op === 0x41 || (op >= 0x50 && op <= 0x53))) return trap(5);
    const ib = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + 1 + ib > p.length) return trap(9);
    const nx = pc + 1 + ib;
    pc = nx; steps++;
    switch (op) {
      case 0: return { out, code: 0 };
      case 1:
        if (S.length > 255) return trap(3);
        S.push((p[nx - 1] << 24) >> 24);
        break;
      case 2: {
        if (S.length > 255) return trap(3);
        const a = nx - 4;
        S.push(p[a] | (p[a + 1] << 8) | (p[a + 2] << 16) | (p[a + 3] << 24));
        break;
      }
      case 3:
        if (!take(1)) return trap(2);
        break;
      case 4:
        if (S.length < 1) return trap(2);
        if (S.length > 255) return trap(3);
        S.push(S[S.length - 1]);
        break;
      case 5: {
        const v = take(2);
        if (!v) return trap(2);
        S.push(v[0], v[1]);
        break;
      }
      case 6: {
        const v = take(2);
        if (!v) return trap(2);
        if (S.length > 255) return trap(3);
        S.push(v[1], v[0], v[1]);
        break;
      }
      case 7: {
        const v = take(3);
        if (!v) return trap(2);
        S.push(v[1], v[0], v[2]);
        break;
      }
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e: case 0x20:
      case 0x21: case 0x22: {
        const v = take(2);
        if (!v) return trap(2);
        const b = v[0], a = v[1];
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (!b) return trap(4); r = Math.trunc(a / b) | 0; }
        else if (op === 0x14) { if (!b) return trap(4); r = (a % b) | 0; }
        else if (op === 0x15) { if (!b) return trap(4); r = Math.trunc((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (!b) return trap(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        S.push(r);
        break;
      }
      case 0x17: {
        const v = take(1);
        if (!v) return trap(2);
        S.push((-v[0]) | 0);
        break;
      }
      case 0x1b: {
        const v = take(1);
        if (!v) return trap(2);
        S.push(~v[0]);
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const a = nx - 2, off = ((p[a] | (p[a + 1] << 8)) << 16) >> 16;
        if (op === 0x30) pc = nx + off;
        else {
          const v = take(1);
          if (!v) return trap(2);
          if ((op === 0x31) === (v[0] === 0)) pc = nx + off;
        }
        break;
      }
      case 0x33: {
        if (C.length >= 64) return trap(7);
        const a = nx - 2;
        C.push(nx);
        pc = p[a] | (p[a + 1] << 8);
        break;
      }
      case 0x34:
        if (!C.length) return trap(8);
        pc = C.pop() as number;
        break;
      case 0x40: {
        const v = take(1);
        if (!v) return trap(2);
        if (v[0] < 0 || v[0] > 255) return trap(6);
        S.push(M[v[0]]);
        break;
      }
      case 0x41: {
        const v = take(2);
        if (!v) return trap(2);
        if (v[0] < 0 || v[0] > 255) return trap(6);
        M[v[0]] = v[1];
        break;
      }
      case 0x50: {
        const v = take(1);
        if (!v) return trap(2);
        const t = String(v[0]);
        if (out.length + t.length > 65536) return trap(11);
        for (let k = 0; k < t.length; k++) out.push(t.charCodeAt(k));
        break;
      }
      case 0x51: {
        const v = take(1);
        if (!v) return trap(2);
        if (out.length + 1 > 65536) return trap(11);
        out.push(v[0] & 255);
        break;
      }
      case 0x52:
        if (S.length > 255) return trap(3);
        S.push(ip < inp.length ? inp[ip++] : -1);
        break;
      case 0x53: {
        const v = take(1);
        if (!v) return trap(2);
        return { out, code: v[0] & 255 };
      }
      default: return trap(5);
    }
  }
}
for (const id of readdirSync(I).sort()) {
  const a = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), Uint8Array.from(a.out));
  writeFileSync(join(O, id, 'exit.txt'), `${a.code}\n`);
}
