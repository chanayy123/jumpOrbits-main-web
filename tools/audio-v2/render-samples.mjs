/**
 * 音效系统 v2 · Node 离线渲染试听样本（无依赖）
 *   node tools/audio-v2/render-samples.mjs [输出目录，默认 ./samples]
 *
 * 复用运行时同一套配方（recipes.js）与快照（palettes.js），
 * 用纯 JS 近似运行时混音链：母线增益 → 低通 → FDN 混响 → 压缩 → tanh 软削波（天花板 -1 dBFS）。
 * 注意：这是“离线近似”，与浏览器 / 微信 WebAudio 的实际输出会有细微差别（压缩器、滤波器实现不同）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOUND_DEFS, SFX_SR, AMB_SR, synthSound, synthAmbience, comboWalkSemis, degreeToSemis } from '../../platforms/web/js/core/audio-v2/recipes.js';
import { PALETTES, resolveSnapshot, MUSIC_LAYERS } from '../../platforms/web/js/core/audio-v2/palettes.js';
import { filter, fdnReverb, dbToGain, gainToDb, peak, rms, encodeWav, makeRng } from '../../platforms/web/js/core/audio-v2/dsp.js';

const OUT_SR = 44100;
const outDir = resolve(process.argv[2] || 'samples');
mkdirSync(outDir, { recursive: true });

/** 线性插值重采样 + 变速（playbackRate） */
function place(dst, src, srcSr, t, gain, rate = 1) {
    const step = (srcSr * rate) / OUT_SR;
    const o = Math.round(t * OUT_SR);
    for (let i = 0, p = 0; p < src.length - 1 && o + i < dst.length; i++, p += step) {
        const k = Math.floor(p), f = p - k;
        if (o + i >= 0) dst[o + i] += (src[k] * (1 - f) + src[k + 1] * f) * gain;
    }
}

class Scene {
    constructor(themeId, daypart, seconds) {
        this.s = resolveSnapshot(themeId, daypart);
        this.pal = PALETTES[themeId];
        this.n = Math.round(seconds * OUT_SR);
        this.bus = { sfx: new Float32Array(this.n), ui: new Float32Array(this.n), amb: new Float32Array(this.n), music: new Float32Array(this.n) };
        this.cache = new Map();
        this.rng = makeRng(7);
        this.variant = {};
        this.last = {};
    }
    buf(name, v) {
        const k = name + v;
        if (!this.cache.has(k)) this.cache.set(k, synthSound(name, v, this.pal));
        return this.cache.get(k);
    }
    play(name, t, { semis = 0, gain = 1 } = {}) {
        const def = SOUND_DEFS[name];
        if (def.minInterval && this.last[name] !== undefined && t - this.last[name] < def.minInterval) return;
        this.last[name] = t;
        let v = ((this.variant[name] ?? -1) + 1) % def.variants;
        if (def.variants > 2 && this.rng() < 0.3) v = (v + 1) % def.variants;
        this.variant[name] = v;
        const jit = def.pitched || def.bus === 'music' ? (this.rng() * 2 - 1) * 0.006 : (this.rng() * 2 - 1) * 0.035;
        place(this.bus[def.bus], this.buf(name, v), SFX_SR, t, gain * (1 - this.rng() * 0.08), Math.pow(2, semis / 12) * (1 + jit));
    }
    ambience(gain = 1) {
        const a = synthAmbience(this.s.amb, AMB_SR);
        for (let t = 0; t < this.n / OUT_SR; t += a.length / AMB_SR) place(this.bus.amb, a, AMB_SR, t, gain);
    }
    /** 与 AudioDirector._playBeat 相同的编曲规则 */
    music(t0, t1, comboAt) {
        const s = this.s, stepDur = 60 / s.tempo / 2;
        for (let step = 0, t = t0; t < t1; step++, t += stepDur) {
            const combo = comboAt(t), bar = Math.floor(step / 8), pos = step % 8;
            const deg = [0, 3, 4, 2][bar % 4];
            const chord = [0, 2, 4].map((k) => degreeToSemis(s.scale, deg + k));
            const on = (id) => combo >= MUSIC_LAYERS.find((L) => L.id === id).minCombo;
            if (pos === 0) chord.forEach((semi, i) => this.play('pad', t + i * 0.01, { semis: semi, gain: 0.5 }));
            if (on('pulse') && (pos === 0 || pos === 4)) this.play('bass', t, { semis: pos === 0 ? chord[0] : chord[2] - (chord[2] > 7 ? 12 : 0), gain: 0.8 });
            if (on('arp')) { const k = [0, 1, 2, 1, 2, 3, 2, 1][pos]; this.play('arp', t, { semis: 12 + degreeToSemis(s.scale, deg + k * 2 - (k > 2 ? 2 : 0)), gain: 0.45 }); }
            if (on('sparkle') && pos % 2 === 1 && this.rng() < 0.22 * s.sparkle) this.play('bell', t, { semis: degreeToSemis(s.scale, deg + Math.floor(this.rng() * 5)), gain: 0.5 * s.sparkle });
        }
    }
    mixdown({ music = true } = {}) {
        const s = this.s, n = this.n;
        filter(this.bus.sfx, 'lp', s.sfxLP, 0.5, OUT_SR);
        const g = { sfx: dbToGain(s.sfxDb), ui: dbToGain(s.sfxDb - 4), amb: dbToGain(s.ambDb), music: music ? dbToGain(s.musicDb) : 0 };
        const send = new Float32Array(n), dry = new Float32Array(n);
        const sends = { sfx: 0.5, music: 0.7, amb: 0.15, ui: 0 };
        for (const b of Object.keys(this.bus)) {
            const B = this.bus[b];
            for (let i = 0; i < n; i++) { const x = B[i] * g[b]; dry[i] += x; send[i] += x * sends[b]; }
        }
        const wet = fdnReverb(send, OUT_SR, s.reverb, 0);
        const m = dbToGain(-4.5), w = s.reverb.wet;
        for (let i = 0; i < n; i++) dry[i] = (dry[i] + wet[i] * w) * m;
        filter(dry, 'lp', s.masterLP, 0.5, OUT_SR);
        return masterChain(dry);
    }
}

/** 压缩（阈值 -18dB，6:1，起音 3ms，释放 150ms，+6dB 补偿，近似 WebAudio 的自动补偿）→ tanh 天花板 -1 dBFS */
function masterChain(x) {
    const at = Math.exp(-1 / (0.003 * OUT_SR)), rt = Math.exp(-1 / (0.15 * OUT_SR));
    const thr = -18, ratio = 6, makeup = dbToGain(6), ceil = dbToGain(-1), k = ceil / Math.tanh(1);
    let env = 0, prePeak = 0;
    for (let i = 0; i < x.length; i++) {
        const a = Math.abs(x[i]);
        env = a > env ? at * env + (1 - at) * a : rt * env + (1 - rt) * a;
        const lvl = gainToDb(env);
        const gr = lvl > thr ? (lvl - thr) * (1 - 1 / ratio) : 0;
        let y = x[i] * dbToGain(-gr) * makeup;
        prePeak = Math.max(prePeak, Math.abs(y));
        y = Math.max(-1, Math.min(1, y));
        x[i] = Math.tanh(y) * k;
    }
    x.prePeak = prePeak;
    return x;
}

/** 一局：自动跳，连击从 startCombo 开始，返回连击曲线 */
function playRun(sc, { start = 0.6, end, startCombo = 0, gap = [0.38, 0.6], clearEvery = 10 }) {
    let combo = startCombo;
    const marks = [];
    const rng = makeRng(42);
    for (let t = start; t < end - 0.5; t += gap[0] + rng() * (gap[1] - gap[0])) {
        combo++;
        marks.push([t, combo]);
        sc.play('jump', t, { semis: comboWalkSemis(sc.s.scale, combo - 1) });
        sc.play('air', t, { gain: 0.7 });
        sc.play('land', t + 0.3, { gain: 0.8 });
        if (combo % 5 === 0) sc.play('combo', t + 0.02);
        if (clearEvery && combo % clearEvery === 0) sc.play('clear', t + 0.32);
    }
    return (t) => { let c = startCombo; for (const [mt, mc] of marks) if (mt <= t) c = mc; return c; };
}

const results = [];
function save(file, data, note) {
    const p = peak(data);
    writeFileSync(resolve(outDir, file), Buffer.from(encodeWav(data, OUT_SR)));
    results.push({ file, seconds: +(data.length / OUT_SR).toFixed(2), peakDbfs: +gainToDb(p).toFixed(2), preClipPeakDbfs: data.prePeak ? +gainToDb(data.prePeak).toFixed(2) : null, rmsDbfs: +gainToDb(rms(data)).toFixed(1), note });
}

const t0 = performance.now();

// 01 跳跃：连击音高行走（星空，夜），16 跳，无音乐
{
    const sc = new Scene('starsky', 'night', 8);
    playRun(sc, { end: 8, gap: [0.4, 0.45], clearEvery: 0 });
    save('01_jump_combo_walk_starsky_night.wav', sc.mixdown({ music: false }), '连击音高行走 + 变体轮换 + 气流 + 落地，每 5 连击里程碑');
}
// 02 五种主题音色的跳跃（每主题 4 跳）
{
    const sc = new Scene('starsky', 'day', 10.5);
    let t = 0.3;
    for (const th of Object.keys(PALETTES)) {
        const pal = PALETTES[th];
        for (let i = 0; i < 4; i++, t += 0.42) {
            place(sc.bus.sfx, synthSound('jump', i, pal), SFX_SR, t, 1, Math.pow(2, comboWalkSemis(pal.scale, i) / 12));
            place(sc.bus.sfx, synthSound('land', i, pal), SFX_SR, t + 0.3, 0.8, 1);
        }
        t += 0.4;
    }
    save('02_jump_timbres_5_themes.wav', sc.mixdown({ music: false }), '星空(玻璃)→轻盈(拇指琴)→赛博(FM)→森林(木琴)→日出(毛毡钢琴)');
}
// 03 事件音效：combo / clear / special / fail / ui（森林 白天）
{
    const sc = new Scene('forest', 'day', 7);
    sc.play('ui', 0.3); sc.play('ui', 0.6);
    sc.play('combo', 1.0); sc.play('special', 2.2); sc.play('clear', 3.6); sc.play('fail', 5.2);
    save('03_event_sfx_forest_day.wav', sc.mixdown({ music: false }), 'UI×2 → 连击里程碑 → 特殊轨道 → 清除 → 失败');
}
// 04 压力测试：1 秒 40 次跳跃（验证上限 / 最小间隔 / 不爆音）
{
    const sc = new Scene('cyberpunk', 'day', 3);
    for (let i = 0; i < 40; i++) { const t = 0.3 + i * 0.025; sc.play('jump', t, { semis: comboWalkSemis(sc.s.scale, i) }); sc.play('air', t); sc.play('land', t); }
    save('04_stress_40_jumps_per_sec.wav', sc.mixdown({ music: false }), '最小间隔 60ms 生效后实际约 16 次/秒，峰值仍 ≤ -1 dBFS');
}
// 05–10 场景：环境底 + 自适应音乐 + 一局
const scenes = [
    ['05_scene_starsky_night.wav', 'starsky', 'night', 14, 0],
    ['06_scene_light_day.wav', 'light', 'day', 12, 4],
    ['07_scene_cyberpunk_night.wav', 'cyberpunk', 'night', 14, 8],
    ['08_scene_forest_day.wav', 'forest', 'day', 12, 4],
    ['09_scene_forest_night.wav', 'forest', 'night', 12, 4],
    ['10_scene_sunrise_dawn.wav', 'sunrise', 'dawn', 14, 10]
];
for (const [file, th, dp, sec, startCombo] of scenes) {
    const sc = new Scene(th, dp, sec);
    sc.ambience();
    const comboAt = playRun(sc, { start: 1.5, end: sec, startCombo, gap: [0.36, 0.5] });
    sc.music(0.2, sec - 0.5, comboAt);
    save(file, sc.mixdown(), `${PALETTES[th].name}·${dp}：环境底「${sc.s.amb}」+ 音乐分层随连击（起始连击 ${startCombo}）`);
}

const ms = performance.now() - t0;
writeFileSync(resolve(outDir, 'samples.json'), JSON.stringify({ renderedMs: Math.round(ms), sampleRate: OUT_SR, files: results }, null, 2));
console.table(results.map(({ file, seconds, peakDbfs, preClipPeakDbfs, rmsDbfs }) => ({ file, seconds, peakDbfs, preClipPeakDbfs, rmsDbfs })));
console.log('渲染耗时', Math.round(ms), 'ms →', outDir);
