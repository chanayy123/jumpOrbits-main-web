/**
 * 音效系统 v2 · 原创音色配方
 *
 * 每个配方都是纯函数：gen(sr, rng, variant, ctx) → Float32Array（单声道）
 * ctx = { timbre, root(midi), scale, chord } 来自当前主题快照。
 * 音色、参数均为本项目原创（只借鉴了“分层 + 种子 + 变体”这一方法）。
 */
import {
    makeRng, hashStr, midiToHz, alloc, filter, noise, pinkNoise, envelope, fadeEdges,
    partials, fmPluck, filterG, eachG, thump, mixAt, scale, normalize, softClip, makeLoop, TAU
} from './dsp.js';

export const SFX_SR = 24000;   // 一次性音效采样率（够用且省内存）
export const AMB_SR = 22050;   // 环境循环采样率

/* ---------------- 乐器：按主题音色生成一个音 ---------------- */

const TIMBRES = {
    // 玻璃 / 钟琴：非谐波分音，长尾
    glass: (sr, f, rng, v, len = 1.1) => {
        const b = partials(sr, len, f, [[1, 0.85, 1], [2.756, 0.32, 0.32 + v * 0.03], [5.404, 0.14, 0.16], [8.93, 0.05, 0.07]], 0.0015, rng);
        mixAt(b, envelope(filter(noise(sr, 0.01, rng), 'hp', 6500, 0.7, sr), sr, 0.0003, 0.0018), 0, 0.15, sr);
        return b;
    },
    // 拇指琴：基音 + 高位“金属舌”分音
    kalimba: (sr, f, rng, v, len = 0.8) => {
        const b = partials(sr, len, f, [[1, 0.55, 1], [2.0, 0.18, 0.10], [5.95 + v * 0.05, 0.07, 0.22]], 0.001, rng);
        mixAt(b, envelope(filter(noise(sr, 0.008, rng), 'bp', 3200, 1.2, sr), sr, 0.0002, 0.0012), 0, 0.22, sr);
        return b;
    },
    // 双算子 FM 拨弦：亮起暗收，带一点电子味
    fm: (sr, f, rng, v, len = 0.7) => {
        const b = fmPluck(sr, len, f, 2.0 + v * 0.01, 2.6, 0.38, 0.05);
        const sub = partials(sr, len, f * 0.5, [[1, 0.25, 0.25]], 0.002);
        mixAt(b, sub, 0, 1, sr);
        return filter(b, 'lp', 5200, 0.8, sr);
    },
    // 木琴 / 木块：短促、温暖
    wood: (sr, f, rng, v, len = 0.45) => {
        const b = partials(sr, len, f, [[1, 0.16, 1], [2.572, 0.055, 0.45], [4.12 + v * 0.03, 0.025, 0.22]], 0.0008, rng);
        mixAt(b, envelope(filter(noise(sr, 0.01, rng), 'bp', 1800, 1.5, sr), sr, 0.0002, 0.002), 0, 0.3, sr);
        return b;
    },
    // 毛毡钢琴感：谐波、慢一点的起音、低通
    felt: (sr, f, rng, v, len = 1.0) => {
        const b = partials(sr, len, f, [[1, 0.8, 1], [2, 0.42, 0.32], [3, 0.25, 0.12], [4, 0.16, 0.05]], 0.005, rng);
        mixAt(b, partials(sr, len, f * 1.0035, [[1, 0.7, 0.35]], 0.006, rng), 0, 1, sr);
        return filter(b, 'lp', 3200 + v * 200, 0.7, sr);
    }
};

export function playNote(sr, timbre, midi, rng, v = 0, len) {
    const fn = TIMBRES[timbre] || TIMBRES.glass;
    const b = fn(sr, midiToHz(midi), rng, v, len);
    return fadeEdges(b, sr, 0.0005, 0.02);
}

/** 音阶度数 → 半音（可跨八度，可为负） */
export function degreeToSemis(scale, deg) {
    const L = scale.length;
    const oct = Math.floor(deg / L);
    return scale[((deg % L) + L) % L] + 12 * oct;
}

/**
 * 连击音高行走：前几跳一路上行，之后在 1.5 个八度内来回（乒乓），避免越来越尖。
 * 返回相对主音的半音数。
 */
export function comboWalkSemis(scale, combo) {
    const span = Math.round(scale.length * 1.5);    // 可走的度数
    const period = span * 2 - 2;
    const k = combo % period;
    const deg = k < span ? k : period - k;
    return degreeToSemis(scale, deg);
}

/* ---------------- 一次性音效定义 ----------------
 * bus: sfx(近场，进混响少量) / ui(干声) / music(音乐)
 * max: 同名同时发声上限；pri: 抢占优先级（大者优先）
 * minInterval: 同名最小触发间隔（秒），防“机枪声”
 * variants: 预烘焙变体数，播放时轮换
 * pitched: 是否按连击音高行走（以 playbackRate 实现，主音烘焙一次）
 */
export const SOUND_DEFS = {
    jump: {
        bus: 'sfx', max: 4, pri: 3, minInterval: 0.06, variants: 4, pitched: true, boot: true,
        gen: (sr, rng, v, c) => {
            const b = playNote(sr, c.timbre, c.root + 12, rng, v);
            return normalize(b, -3);
        }
    },
    air: { // 跳跃时的轻微气流声（ASMR 感），密集时会被自动压低
        bus: 'sfx', max: 2, pri: 1, minInterval: 0.08, variants: 3, boot: true,
        gen: (sr, rng, v) => {
            const len = 0.11 + v * 0.01;
            const b = noise(sr, len, rng);
            filter(b, 'bp', (p) => 900 + 2600 * p, 1.4, sr);
            for (let i = 0; i < b.length; i++) { const p = i / b.length; b[i] *= Math.sin(Math.PI * p) ** 1.5; }
            return normalize(b, -12);
        }
    },
    land: {
        bus: 'sfx', max: 3, pri: 2, minInterval: 0.05, variants: 4, boot: true,
        gen: (sr, rng, v, c) => {
            const k = [1, 0.94, 1.06, 0.98][v & 3];
            const b = alloc(sr, 0.16);
            mixAt(b, thump(sr, 0.14, 150 * k, 72 * k, 0.012, 0.045), 0, 0.9, sr);
            const tick = envelope(filter(noise(sr, 0.02, rng), c.timbre === 'wood' ? 'bp' : 'hp', 2600 * k, 0.9, sr), sr, 0.0002, 0.0022);
            mixAt(b, tick, 0, 0.35, sr);
            return normalize(fadeEdges(b, sr), -4);
        }
    },
    combo: { // 每 5 连击的里程碑：主音 + 五度 + 八度，间隔 55ms
        bus: 'sfx', max: 2, pri: 4, minInterval: 0.25, variants: 2, boot: false,
        gen: (sr, rng, v, c) => {
            const b = alloc(sr, 1.3);
            const top = c.root + 24;
            [0, 7, 12].forEach((s, i) => mixAt(b, playNote(sr, c.timbre, top + s - (v ? 12 : 0), rng, i), i * 0.055, 0.6 - i * 0.12, sr));
            return normalize(b, -3);
        }
    },
    clear: { // 特殊轨道清除障碍：五音上行琶音 + 高频闪烁尾
        bus: 'sfx', max: 1, pri: 5, minInterval: 0.3, variants: 1, boot: false,
        gen: (sr, rng, v, c) => {
            const b = alloc(sr, 1.6);
            for (let i = 0; i < 5; i++) {
                mixAt(b, playNote(sr, c.timbre, c.root + 12 + degreeToSemis(c.scale, i * 2), rng, i & 3), i * 0.045, 0.55, sr);
            }
            const shimmer = envelope(filter(noise(sr, 1.2, rng), 'hp', 7000, 0.7, sr), sr, 0.15, 0.35);
            mixAt(b, shimmer, 0.1, 0.08, sr);
            return normalize(b, -3);
        }
    },
    special: { // 进入特殊轨道（无可清除）：柔和和弦膨胀
        bus: 'sfx', max: 1, pri: 4, minInterval: 0.3, variants: 1, boot: false,
        gen: (sr, rng, v, c) => {
            const b = alloc(sr, 1.4);
            c.chord.slice(0, 4).forEach((s, i) => mixAt(b, playNote(sr, c.timbre, c.root + s, rng, i, 1.3), i * 0.012, 0.4, sr));
            for (let i = 0; i < b.length; i++) b[i] *= Math.min(1, i / (0.08 * sr));
            return normalize(b, -4);
        }
    },
    fail: { // 失败：柔和的下行两音 + 低通“叹气”，不刺耳
        bus: 'sfx', max: 1, pri: 6, minInterval: 0.5, variants: 1, boot: false,
        gen: (sr, rng, v, c) => {
            const b = alloc(sr, 1.4);
            mixAt(b, playNote(sr, c.timbre, c.root + degreeToSemis(c.scale, 2), rng, 0), 0, 0.5, sr);
            mixAt(b, playNote(sr, c.timbre, c.root - 12 + degreeToSemis(c.scale, 0), rng, 1, 1.2), 0.16, 0.6, sr);
            const sigh = noise(sr, 0.7, rng);
            filter(sigh, 'lp', (p) => 1800 - 1400 * p, 0.7, sr);
            envelope(sigh, sr, 0.08, 0.25);
            mixAt(b, sigh, 0.05, 0.25, sr);
            mixAt(b, thump(sr, 0.4, 110, 45, 0.08, 0.15), 0.0, 0.35, sr);
            return normalize(b, -3);
        }
    },
    ui: {
        bus: 'ui', max: 2, pri: 2, minInterval: 0.04, variants: 2, boot: true,
        gen: (sr, rng, v) => normalize(fadeEdges(partials(sr, 0.05, 1500 + v * 180, [[1, 0.012, 1], [2.4, 0.006, 0.4]], 0.0004), sr), -8)
    },
    // —— 音乐层用的单音（以主音烘焙，演奏时用 playbackRate 移调）——
    pad: {
        bus: 'music', max: 6, pri: 1, minInterval: 0, variants: 1, boot: false,
        gen: (sr, rng, v, c) => {
            const len = 3.2, f = midiToHz(c.root - 12);
            const b = partials(sr, len, f, [[1, 60, 1], [1.004, 60, 0.6], [1.997, 60, 0.3], [3, 60, 0.08]], 0.001, rng);
            filter(b, 'lp', 1600, 0.6, sr);
            for (let i = 0; i < b.length; i++) {
                const t = i / sr;
                b[i] *= Math.min(1, t / 0.6) * Math.exp(-Math.max(0, t - 0.6) / 1.4);
            }
            return normalize(fadeEdges(b, sr, 0.01, 0.3), -6);
        }
    },
    bass: {
        bus: 'music', max: 2, pri: 2, minInterval: 0, variants: 1, boot: false,
        gen: (sr, rng, v, c) => {
            const b = partials(sr, 0.7, midiToHz(c.root - 24), [[1, 0.28, 1], [2, 0.12, 0.25]], 0.006);
            return normalize(fadeEdges(b, sr, 0.004, 0.05), -6);
        }
    },
    arp: {
        bus: 'music', max: 4, pri: 1, minInterval: 0, variants: 2, boot: false,
        gen: (sr, rng, v, c) => normalize(playNote(sr, c.timbre, c.root, rng, v, 0.6), -8)
    },
    bell: {
        bus: 'music', max: 2, pri: 1, minInterval: 0, variants: 2, boot: false,
        gen: (sr, rng, v, c) => normalize(playNote(sr, 'glass', c.root + 24, rng, v, 1.4), -10)
    }
};

/** 合成一次性音效（同步） */
export function synthSound(name, variant, ctx, sr = SFX_SR) {
    const def = SOUND_DEFS[name];
    if (!def) throw new Error('unknown sound ' + name);
    const rng = makeRng(hashStr(name + '|' + ctx.timbre) + variant * 7919);
    return def.gen(sr, rng, variant, ctx);
}

/* ---------------- 环境底（无缝循环，生成器函数便于分片烘焙） ---------------- */

const AMB_LEN = 8.5; // 合成 8.5 秒，交叉淡化后得到 8 秒循环

function lfo(i, sr, hz, ph = 0) { return 0.5 + 0.5 * Math.sin(TAU * hz * i / sr + ph); }

function birdChirp(sr, rng) {
    const len = rng.range(0.06, 0.14), b = alloc(sr, len);
    const f0 = rng.range(2600, 3800), f1 = f0 * rng.range(1.2, 1.6);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
        const p = i / b.length;
        ph += TAU * (f0 + (f1 - f0) * Math.sin(Math.PI * p)) / sr;
        b[i] = Math.sin(ph) * Math.sin(Math.PI * p) ** 2;
    }
    return b;
}

function cricket(sr, rng) {
    const b = alloc(sr, 0.16), f = rng.range(4300, 4900);
    for (let i = 0; i < b.length; i++) {
        const t = i / sr, pulse = (t * 32) % 1; // 32Hz 脉冲串，约 4 下
        b[i] = Math.sin(TAU * f * t) * (pulse < 0.45 ? Math.sin(Math.PI * pulse / 0.45) : 0) * (t < 0.13 ? 1 : 0);
    }
    return b;
}

export const AMBIENCES = {
    *space(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield* filterG(b, 'lp', 380, 0.7, sr); scale(b, 0.6); yield;
        for (const [f, a, hz] of [[73.4, 0.10, 0.07], [110, 0.07, 0.05], [146.8, 0.05, 0.09], [220, 0.025, 0.11]]) {
            yield* eachG(b.length, (i) => { b[i] += Math.sin(TAU * f * i / sr) * a * lfo(i, sr, hz); });
            yield;
        }
        return b;
    },
    *spaceNight(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield* filterG(b, 'lp', 240, 0.7, sr); scale(b, 0.7); yield;
        yield* eachG(b.length, (i) => { b[i] += Math.sin(TAU * 55 * i / sr) * 0.08 * lfo(i, sr, 0.06); });
        yield;
        for (let k = 0; k < 7; k++) { // 星星闪烁
            mixAt(b, playNote(sr, 'glass', 86 + rng.pick([0, 2, 4, 7, 9, 12]), rng, k & 3, 1.2), rng.range(0.2, AMB_LEN - 1.4), 0.035, sr);
        }
        yield;
        return b;
    },
    *breeze(sr, rng) {
        const b = noise(sr, AMB_LEN, rng); yield;
        yield* filterG(b, 'bp', (p) => 700 + 900 * (0.5 + 0.5 * Math.sin(TAU * p * 2)), 0.6, sr); yield;
        yield* eachG(b.length, (i) => { b[i] *= 0.25 + 0.75 * lfo(i, sr, 0.23, 1.3); });
        return scale(b, 0.5);
    },
    *breezeNight(sr, rng) {
        const b = noise(sr, AMB_LEN, rng); yield;
        yield* filterG(b, 'bp', (p) => 320 + 380 * (0.5 + 0.5 * Math.sin(TAU * p)), 0.6, sr); yield;
        yield* eachG(b.length, (i) => { b[i] *= 0.3 + 0.7 * lfo(i, sr, 0.118); });
        return scale(b, 0.45);
    },
    *city(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield* filterG(b, 'lp', 700, 0.7, sr); scale(b, 0.7); yield;
        yield* eachG(b.length, (i) => { b[i] += (Math.sin(TAU * 60 * i / sr) * 0.05 + Math.sin(TAU * 120 * i / sr) * 0.03) * (0.8 + 0.2 * lfo(i, sr, 0.35)); });
        yield;
        for (let k = 0; k < 3; k++) mixAt(b, fmPluck(sr, 0.25, rng.pick([1318, 1568, 1760]), 3, 1.2, 0.08, 0.03), rng.range(0.5, AMB_LEN - 0.6), 0.04, sr);
        return b;
    },
    *cityRain(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield* filterG(b, 'lp', 500, 0.7, sr); scale(b, 0.6); yield;
        const hiss = noise(sr, AMB_LEN, rng); yield* filterG(hiss, 'hp', 2500, 0.7, sr); yield* filterG(hiss, 'lp', 9000, 0.7, sr);
        mixAt(b, hiss, 0, 0.18, sr); yield;
        for (let k = 0; k < 90; k++) { // 雨滴
            const d = envelope(yield* filterG(noise(sr, 0.015, rng), 'bp', rng.range(2000, 6000), 2, sr), sr, 0.0002, 0.002);
            mixAt(b, d, rng.range(0, AMB_LEN - 0.02), rng.range(0.05, 0.18), sr);
        }
        yield;
        yield* eachG(b.length, (i) => { b[i] += Math.sin(TAU * 60 * i / sr) * 0.035; });
        return b;
    },
    *forestDay(sr, rng) {
        const b = yield* AMBIENCES.breeze(sr, rng);
        scale(b, 0.7);
        for (let k = 0; k < 9; k++) {
            const t = rng.range(0.2, AMB_LEN - 1);
            const n = 1 + Math.floor(rng() * 3);
            for (let j = 0; j < n; j++) mixAt(b, birdChirp(sr, rng), t + j * 0.12, 0.12, sr);
        }
        yield;
        return b;
    },
    *forestNight(sr, rng) {
        const b = yield* AMBIENCES.breezeNight(sr, rng);
        scale(b, 0.6);
        for (let t = 0.1; t < AMB_LEN - 0.3; t += rng.range(0.42, 0.62)) mixAt(b, cricket(sr, rng), t, 0.07, sr);
        yield;
        for (let t = 0.3; t < AMB_LEN - 0.3; t += rng.range(0.9, 1.4)) mixAt(b, cricket(sr, rng), t, 0.035, sr);
        return b;
    },
    *shore(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield;
        // 两次浪/8 秒：低通随浪起落
        yield* filterG(b, 'lp', (p) => 400 + 1800 * Math.pow(Math.sin(Math.PI * ((p * AMB_LEN / 4.25) % 1)), 2), 0.7, sr); yield;
        yield* eachG(b.length, (i) => {
            const ph = ((i / sr) / 4.25) % 1;
            b[i] *= 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * ph), 1.6);
        });
        for (let k = 0; k < 3; k++) mixAt(b, birdChirp(sr, rng), rng.range(0.5, AMB_LEN - 1), 0.06, sr);
        return scale(b, 0.9);
    },
    *shoreNight(sr, rng) {
        const b = pinkNoise(sr, AMB_LEN, rng); yield;
        yield* filterG(b, 'lp', (p) => 250 + 700 * Math.pow(Math.sin(Math.PI * ((p * AMB_LEN / 4.25) % 1)), 2), 0.7, sr); yield;
        yield* eachG(b.length, (i) => {
            const ph = ((i / sr) / 4.25) % 1;
            b[i] *= 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * ph), 1.6);
        });
        return scale(b, 0.9);
    }
};

/** 生成器版环境底：每次 next() 只做一部分工作，供 6ms 时间片调度 */
export function* ambienceJob(name, sr = AMB_SR) {
    const gen = AMBIENCES[name] || AMBIENCES.space;
    const rng = makeRng(hashStr('amb|' + name));
    const raw = yield* gen(sr, rng);
    yield;
    const loop = makeLoop(raw, sr, 0.5);
    return normalize(softClip(loop, 1.2), -6);
}

/** 同步版（Node 离线渲染 / 测试用） */
export function synthAmbience(name, sr = AMB_SR) {
    const it = ambienceJob(name, sr);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
}
