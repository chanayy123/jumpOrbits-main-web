/**
 * 音效系统 v2 · DSP 原语（纯函数，零依赖，浏览器 / 微信小游戏 / Node 通用）
 *
 * 设计参考了 Saltline 的“分层配方 + 种子随机”思路，但代码与音色参数均为本项目原创编写。
 * 所有函数只操作 Float32Array，不依赖 WebAudio，因此可以：
 *   - 运行时合成（启动时分片烘焙成 AudioBuffer）
 *   - 构建期 / Node 离线渲染成 WAV（tools/audio-v2/render-samples.mjs）
 */

export const TAU = Math.PI * 2;

/** 种子随机数（xorshift32 变体），同一种子永远得到同一串数 */
export function makeRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const next = () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
    next.range = (a, b) => a + (b - a) * next();
    next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
    next.fork = (salt) => makeRng((s ^ hashStr(String(salt))) >>> 0);
    return next;
}

/** 字符串哈希（FNV-1a 32 位） */
export function hashStr(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-9, g));

export function alloc(sr, seconds) {
    return new Float32Array(Math.max(1, Math.round(sr * seconds)));
}

/** 双二阶滤波系数（RBJ cookbook） */
function biquadCoefs(type, freq, q, sr) {
    const f = Math.max(10, Math.min(freq, sr * 0.45));
    const w = TAU * f / sr, cw = Math.cos(w), sw = Math.sin(w), a = sw / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // bp（恒定峰值增益）
    const a0 = 1 + a;
    return [b0 / a0, b1 / a0, b2 / a0, (-2 * cw) / a0, (1 - a) / a0];
}

/** 原地滤波；freq 可以是数字，也可以是 (进度0..1)=>Hz 的函数（每 32 个采样更新一次系数） */
export function filter(buf, type, freq, q, sr) {
    let z1 = 0, z2 = 0, c = null;
    const n = buf.length, dyn = typeof freq === 'function';
    if (!dyn) c = biquadCoefs(type, freq, q, sr);
    for (let i = 0; i < n; i++) {
        if (dyn && (i & 31) === 0) c = biquadCoefs(type, freq(i / n), q, sr);
        const x = buf[i];
        const y = c[0] * x + z1;
        z1 = c[1] * x - c[3] * y + z2;
        z2 = c[2] * x - c[4] * y;
        buf[i] = y;
    }
    return buf;
}

/** 生成器版滤波：每 chunk 个采样让出一次，供时间片调度 */
export function* filterG(buf, type, freq, q, sr, chunk = 8192) {
    let z1 = 0, z2 = 0, c = null;
    const n = buf.length, dyn = typeof freq === 'function';
    if (!dyn) c = biquadCoefs(type, freq, q, sr);
    for (let i = 0; i < n; i++) {
        if (dyn && (i & 31) === 0) c = biquadCoefs(type, freq(i / n), q, sr);
        const x = buf[i];
        const y = c[0] * x + z1;
        z1 = c[1] * x - c[3] * y + z2;
        z2 = c[2] * x - c[4] * y;
        buf[i] = y;
        if ((i % chunk) === chunk - 1) yield;
    }
    return buf;
}

/** 生成器版逐采样循环 */
export function* eachG(n, fn, chunk = 8192) {
    for (let i = 0; i < n; i++) { fn(i); if ((i % chunk) === chunk - 1) yield; }
}

/** 白噪声 */
export function noise(sr, seconds, rng) {
    const b = alloc(sr, seconds);
    for (let i = 0; i < b.length; i++) b[i] = rng() * 2 - 1;
    return b;
}

/** 粉噪声（Paul Kellet 简化版），用于环境底噪，比白噪声柔和 */
export function pinkNoise(sr, seconds, rng) {
    const b = alloc(sr, seconds);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < b.length; i++) {
        const w = rng() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        b[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return b;
}

/** 包络：attack 线性起音 + 指数衰减 */
export function envelope(buf, sr, attack, decay) {
    const na = Math.max(1, Math.round(attack * sr));
    for (let i = 0; i < buf.length; i++) {
        const t = i / sr;
        const a = i < na ? i / na : 1;
        buf[i] *= a * Math.exp(-t / decay);
    }
    return buf;
}

/** 首尾短淡入淡出，避免咔哒声 */
export function fadeEdges(buf, sr, fin = 0.002, fout = 0.01) {
    const a = Math.min(buf.length >> 1, Math.round(fin * sr));
    const b = Math.min(buf.length >> 1, Math.round(fout * sr));
    for (let i = 0; i < a; i++) buf[i] *= i / a;
    for (let i = 0; i < b; i++) { const k = i / b; buf[buf.length - 1 - i] *= k * k; }
    return buf;
}

/** 一组带各自衰减的正弦分音（模态合成）。partials: [[倍频, 衰减秒, 振幅], ...]
 *  用复数旋转递推正弦、乘法递推指数衰减，比逐采样 sin/exp 快约 5 倍。 */
export function partials(sr, seconds, f0, list, attack = 0.002, rng = null) {
    const b = alloc(sr, seconds);
    const na = Math.max(1, Math.round(attack * sr));
    for (const [ratio, decay, amp] of list) {
        const f = f0 * ratio;
        if (f > sr * 0.45) continue;
        const ph0 = rng ? rng() * TAU : 0, w = TAU * f / sr;
        const c = Math.cos(w), s = Math.sin(w), dk = Math.exp(-1 / (sr * decay));
        let re = Math.cos(ph0), im = Math.sin(ph0), env = amp;
        for (let i = 0; i < b.length; i++) {
            b[i] += im * env * (i < na ? i / na : 1);
            const r2 = re * c - im * s; im = re * s + im * c; re = r2;
            env *= dk;
            if (env < 1e-5) break;
        }
    }
    return b;
}

/** 双算子 FM 拨弦（赛博主题用）：调制指数随时间衰减，声音由亮到暗 */
export function fmPluck(sr, seconds, f0, ratio, index, decay, idxDecay) {
    const b = alloc(sr, seconds);
    let pc = 0, pm = 0;
    const wc = TAU * f0 / sr, wm = TAU * f0 * ratio / sr;
    for (let i = 0; i < b.length; i++) {
        const t = i / sr;
        const I = index * Math.exp(-t / idxDecay);
        pm += wm; pc += wc;
        b[i] = Math.sin(pc + I * Math.sin(pm)) * Math.min(1, i / (0.002 * sr)) * Math.exp(-t / decay);
    }
    return b;
}

/** 正弦滑音冲击（落地“咚”） */
export function thump(sr, seconds, f0, f1, glide, decay) {
    const b = alloc(sr, seconds);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
        const t = i / sr;
        ph += TAU * (f1 + (f0 - f1) * Math.exp(-t / glide)) / sr;
        b[i] = Math.sin(ph) * Math.exp(-t / decay) * (1 - Math.exp(-t / 0.0008));
    }
    return b;
}

/** 在 dst 的 t 秒处混入 src */
export function mixAt(dst, src, t, gain, sr) {
    const o = Math.round(t * sr);
    const n = Math.min(src.length, dst.length - o);
    for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
    return dst;
}

export function scale(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }

export function peak(buf) {
    let m = 0;
    for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
    return m;
}

export function rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / Math.max(1, buf.length));
}

/** 归一化到指定峰值（dBFS） */
export function normalize(buf, peakDb = -1) {
    const p = peak(buf);
    return p > 0 ? scale(buf, dbToGain(peakDb) / p) : buf;
}

/** tanh 软削波；ceiling 为输出绝对上限 */
export function softClip(buf, drive = 1.5, ceiling = 1) {
    const k = ceiling / Math.tanh(drive);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) * k;
    return buf;
}

/** 首尾交叉淡化成无缝循环：把末尾 xf 秒叠回开头，然后截掉 */
export function makeLoop(buf, sr, xf = 0.5) {
    const n = Math.round(xf * sr);
    const out = buf.slice(0, buf.length - n);
    for (let i = 0; i < n; i++) {
        const k = i / n; // 等功率交叉
        out[i] = out[i] * Math.sin(k * Math.PI / 2) + buf[buf.length - n + i] * Math.cos(k * Math.PI / 2);
    }
    return out;
}

/** 16 位 PCM WAV 编码（单声道或多声道交错） */
export function encodeWav(channels, sr) {
    const ch = Array.isArray(channels) ? channels : [channels];
    const n = ch[0].length, nc = ch.length;
    const buf = new ArrayBuffer(44 + n * nc * 2);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * nc * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
        const s = Math.max(-1, Math.min(1, ch[c][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return buf;
}

/* ---------------- 混响：反馈延迟网络（FDN） ----------------
 * 微信小游戏的 WebAudioContext 没有 createConvolver（官方 API 列表核对，2026-11），
 * 所以运行时混响用 DelayNode + BiquadFilter + GainNode 搭 FDN。
 * 这里是同一拓扑的纯 JS 版本，供 Node 离线渲染试听，参数与运行时一致。
 */
export const FDN_DELAYS = [0.0297, 0.0371, 0.0411, 0.0437];
export const FDN_SELF = 0.6, FDN_CROSS = 0.4;
export const FDN_OUT_SIGNS = [1, -1, 1, -1];

/** 每条线的反馈总增益：在 decay 秒内衰减 60dB */
export function fdnGain(delay, decay) {
    return Math.pow(10, -3 * delay / Math.max(0.1, decay));
}

export function fdnReverb(input, sr, { decay = 2, damp = 6000, preDelay = 0.02 } = {}, tail = decay) {
    const n = input.length + Math.round(tail * sr);
    const out = new Float32Array(n);
    const lines = FDN_DELAYS.map((d) => {
        const len = Math.round(d * sr);
        return { buf: new Float32Array(len), idx: 0, len, g: fdnGain(d, decay), lp: 0 };
    });
    const a = Math.exp(-TAU * damp / sr); // 一阶低通系数（运行时用 BiquadFilter，听感接近）
    const pd = Math.round(preDelay * sr);
    for (let i = 0; i < n; i++) {
        const x = (i - pd >= 0 && i - pd < input.length) ? input[i - pd] : 0;
        const outs = lines.map((L) => L.buf[L.idx]);
        let y = 0;
        for (let k = 0; k < 4; k++) {
            const L = lines[k];
            L.lp = (1 - a) * outs[k] + a * L.lp;
            y += outs[k] * FDN_OUT_SIGNS[k];
        }
        for (let k = 0; k < 4; k++) {
            const L = lines[k], P = lines[(k + 3) & 3];
            L.buf[L.idx] = x * 0.5 + L.lp * L.g * FDN_SELF + P.lp * P.g * FDN_CROSS;
            L.idx = (L.idx + 1) % L.len;
        }
        out[i] = y * 0.35;
    }
    return out;
}
