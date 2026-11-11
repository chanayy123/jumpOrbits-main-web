/**
 * 音效系统 v2 · AudioDirector（运行时，WebAudio）
 *
 * 结构：
 *   sfx ──► sfxLP ──┐
 *   ui  ────────────┤
 *   amb ────────────┼─► masterLP ─► compressor ─► softClip(天花板 -1 dBFS) ─► trim ─► destination
 *   music ─(layers)─┤
 *   send(sfx/music/amb) ─► preDelay ─► FDN 混响 ─► wet ─┘
 *
 * 能力：母线 + 声部池（每音色上限 / 优先级 / 4ms 淡出抢占 / 最小间隔）、
 *       变体轮换 + 音高随机、连击音高行走、主题 × 昼夜快照平滑过渡、
 *       环境底双槽交叉淡化、连击驱动的 5 层自适应音乐、6ms 时间片烘焙、统计数据。
 *
 * 只用到微信小游戏 WebAudioContext 官方列出的节点：
 *   createGain / createBiquadFilter / createDelay / createDynamicsCompressor /
 *   createWaveShaper / createBuffer / createBufferSource（/ createAnalyser 仅试听页）。
 *   不使用 ConvolverNode（微信 API 列表中没有）。
 */
import { PALETTES, resolveSnapshot, daypartFromHour, MUSIC_LAYERS } from './palettes.js';
import { SOUND_DEFS, SFX_SR, AMB_SR, synthSound, ambienceJob, comboWalkSemis, degreeToSemis } from './recipes.js';
import { FDN_DELAYS, FDN_SELF, FDN_CROSS, FDN_OUT_SIGNS, fdnGain, dbToGain, makeRng } from './dsp.js';

const BUS_CAPS = { sfx: 12, ui: 4, music: 10 };
const CEILING = dbToGain(-1);            // 软削波天花板：-1 dBFS
const STEAL_FADE = 0.004;                // 抢占淡出 4ms
const SLICE_MS = 6;                      // 时间片预算
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createAudioContext() {
    // 微信小游戏：wx.createWebAudioContext（基础库 ≥ 2.19.0）
    if (typeof wx !== 'undefined' && wx && typeof wx.createWebAudioContext === 'function') {
        return wx.createWebAudioContext();
    }
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    return AC ? new AC() : null;
}

export class AudioDirector {
    constructor(opts = {}) {
        this.ctx = opts.context || null;
        this.themeId = PALETTES[opts.theme] ? opts.theme : 'starsky';
        this.daypartOverride = opts.daypart || null;
        this.daypart = this.daypartOverride || daypartFromHour(new Date().getHours());
        this.snap = resolveSnapshot(this.themeId, this.daypart);
        this.volumes = { music: opts.musicVolume ?? 1, sfx: opts.sfxVolume ?? 1 };
        this.muted = false;
        this.ready = false;

        this.buffers = new Map();     // key → AudioBuffer[]（变体）
        this.voices = [];             // 活跃声部
        this.lastPlay = new Map();    // name → ctx 时间
        this.variantIdx = new Map();
        this.rng = makeRng(opts.seed || 20261111);

        this.combo = 0;
        this.recentJumps = [];        // 用于密度压低
        this.musicOn = false;
        this.layerTargets = {};

        this.jobs = [];
        this.stats = { played: 0, dropped: 0, stolen: 0, minIntervalSkips: 0, onDemandBakes: 0, bootBakeMs: 0, slicedBakeMs: 0, maxSliceMs: 0 };
    }

    /* ---------------- 启动 ---------------- */

    /** 必须在用户手势中调用（浏览器 / iOS 自动播放策略） */
    unlock() {
        if (!this.ctx) this.ctx = createAudioContext();
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {});
        if (this.ready) return true;
        this._buildGraph();
        const t0 = now();
        for (const [name, def] of Object.entries(SOUND_DEFS)) if (def.boot) this._bakeSound(name);
        this.stats.bootBakeMs = +(now() - t0).toFixed(2);
        this.ready = true;
        this._applySnapshot(0.01);
        this._queueThemeBakes();
        return true;
    }

    _buildGraph() {
        const c = this.ctx;
        const g = (v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
        const f = (type, freq, q = 0.707) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; return n; };

        this.trim = g(1);
        this.shaper = c.createWaveShaper();
        this.shaper.curve = makeSoftClipCurve(2048, 1.0, CEILING);
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -18; this.comp.knee.value = 6; this.comp.ratio.value = 6;
        this.comp.attack.value = 0.003; this.comp.release.value = 0.15;
        this.masterLP = f('lowpass', 18000, 0.5);
        this.master = g(dbToGain(-4.5)); // 4.5dB 余量，尽量让峰值落在压缩器而不是削波器上
        this.master.connect(this.masterLP); this.masterLP.connect(this.comp); this.comp.connect(this.shaper);
        this.shaper.connect(this.trim); this.trim.connect(c.destination);

        this.bus = { sfx: g(), ui: g(), amb: g(), music: g() };
        this.sfxLP = f('lowpass', 14000, 0.5);
        this.bus.sfx.connect(this.sfxLP); this.sfxLP.connect(this.master);
        this.bus.ui.connect(this.master); this.bus.amb.connect(this.master); this.bus.music.connect(this.master);

        // 混响：发送 → 预延迟 → FDN → 湿声
        this.revIn = g(1);
        this.preDelay = c.createDelay(0.2);
        this.revWet = g(0.25);
        this.revIn.connect(this.preDelay);
        this.fdn = FDN_DELAYS.map((d) => {
            const delay = c.createDelay(0.1); delay.delayTime.value = d;
            const lp = f('lowpass', 6000, 0.5);
            const self = g(0), cross = g(0), out = g(FDN_OUT_SIGNS[0] * 0.35);
            delay.connect(lp); lp.connect(self); self.connect(delay); lp.connect(out); out.connect(this.revWet);
            return { d, delay, lp, self, cross, out };
        });
        this.fdn.forEach((L, k) => {
            const inG = g(0.5); this.preDelay.connect(inG); inG.connect(L.delay);
            L.out.gain.value = FDN_OUT_SIGNS[k] * 0.35;
            L.lp.connect(L.cross); L.cross.connect(this.fdn[(k + 1) & 3].delay);
        });
        this.revWet.connect(this.master);
        this.send = { sfx: g(0.5), music: g(0.7), amb: g(0.15) };
        this.bus.sfx.connect(this.send.sfx); this.send.sfx.connect(this.revIn);
        this.bus.music.connect(this.send.music); this.send.music.connect(this.revIn);
        this.bus.amb.connect(this.send.amb); this.send.amb.connect(this.revIn);

        // 音乐分层
        this.layerGain = {};
        for (const L of MUSIC_LAYERS) {
            if (L.id === 'bed') continue;
            this.layerGain[L.id] = g(0);
            this.layerGain[L.id].connect(this.bus.music);
        }
        // 环境底双槽（交叉淡化）
        this.ambSlots = [g(0), g(0)].map((gain) => { gain.connect(this.bus.amb); return { gain, src: null, name: null }; });
        this.ambActive = 0;
    }

    /* ---------------- 快照（主题 × 昼夜） ---------------- */

    setTheme(themeId, fade = 1.5) {
        if (!PALETTES[themeId] || themeId === this.themeId) return;
        this.themeId = themeId;
        this._refreshSnapshot(fade);
    }

    setDaypart(dp, fade = 2.5) {
        this.daypartOverride = dp || null;
        this.daypart = dp || daypartFromHour(new Date().getHours());
        this._refreshSnapshot(fade);
    }

    /** 每分钟调用一次即可：跟随本地时钟自动切换昼夜（没手动覆盖时） */
    tickClock() {
        if (this.daypartOverride) return;
        const dp = daypartFromHour(new Date().getHours());
        if (dp !== this.daypart) this.setDaypart(null, 8);
    }

    _refreshSnapshot(fade) {
        const prev = this.snap;
        this.snap = resolveSnapshot(this.themeId, this.daypart);
        if (!this.ready) return;
        if (prev.themeId !== this.snap.themeId) this._queueThemeBakes();
        this._applySnapshot(fade);
    }

    _applySnapshot(fade) {
        const s = this.snap, t = this.ctx.currentTime, tc = Math.max(0.005, fade / 3);
        const set = (param, v) => { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tc); };
        set(this.masterLP.frequency, s.masterLP);
        set(this.sfxLP.frequency, s.sfxLP);
        set(this.revWet.gain, s.reverb.wet);
        set(this.preDelay.delayTime, s.reverb.preDelay);
        for (const L of this.fdn) {
            const gl = fdnGain(L.d, s.reverb.decay);
            set(L.self.gain, gl * FDN_SELF); set(L.cross.gain, gl * FDN_CROSS); set(L.lp.frequency, s.reverb.damp);
        }
        this._applyVolumes(fade);
        this._ensureAmbience(s.amb, fade);
    }

    _applyVolumes(fade = 0.2) {
        if (!this.ready) return;
        const s = this.snap, t = this.ctx.currentTime, tc = Math.max(0.005, fade / 3);
        const m = this.muted ? 0 : 1;
        const set = (param, v) => { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tc); };
        set(this.bus.sfx.gain, m * this.volumes.sfx * dbToGain(s.sfxDb));
        set(this.bus.ui.gain, m * this.volumes.sfx * dbToGain(s.sfxDb - 4));
        set(this.bus.music.gain, m * this.volumes.music * dbToGain(s.musicDb) * (this.musicOn ? 1 : 0));
        set(this.bus.amb.gain, m * this.volumes.music * dbToGain(s.ambDb) * (this.musicOn ? 1 : 0.6));
    }

    setVolumes({ music, sfx } = {}) {
        if (music !== undefined) this.volumes.music = music;
        if (sfx !== undefined) this.volumes.sfx = sfx;
        this._applyVolumes();
    }

    setMuted(m) { this.muted = !!m; this._applyVolumes(0.05); }

    /* ---------------- 烘焙 ---------------- */

    _key(name) {
        const def = SOUND_DEFS[name];
        return def.bus === 'ui' || name === 'air' ? name : name + '|' + this.themeId;
    }

    _bakeSound(name) {
        const def = SOUND_DEFS[name], key = this._key(name);
        const list = this.buffers.get(key) || [];
        for (let v = list.length; v < def.variants; v++) list.push(this._bakeVariant(name, v));
        this.buffers.set(key, list);
        return list;
    }

    _bakeVariant(name, v) {
        return this._toBuffer(synthSound(name, v, PALETTES[this.themeId]), SFX_SR);
    }

    _toBuffer(data, sr) {
        const b = this.ctx.createBuffer(1, data.length, sr);
        if (b.copyToChannel) b.copyToChannel(data, 0); else b.getChannelData(0).set(data);
        return b;
    }

    _queueThemeBakes() {
        // 每个“音色 × 变体”是一个独立任务，单任务通常 < 6ms，才能真正切片
        const themeAtQueue = this.themeId;
        const jobs = [];
        for (const [name, def] of Object.entries(SOUND_DEFS)) {
            const key = this._key(name);
            for (let v = 0; v < def.variants; v++) {
                jobs.push({ boot: def.boot, run: () => {
                    if (this.themeId !== themeAtQueue) return;
                    const list = this.buffers.get(key) || [];
                    if (list.length === v) { list.push(this._bakeVariant(name, v)); this.buffers.set(key, list); }
                } });
            }
        }
        jobs.sort((a, b) => (b.boot ? 1 : 0) - (a.boot ? 1 : 0)); // 跳跃 / 落地优先
        this.jobs.push(...jobs);
        this._evictOtherThemes();
        this._pumpJobs();
    }

    /** 只保留当前主题的缓冲，旧主题的在 3 秒后释放（正在播放的声部仍持有引用，不会断音） */
    _evictOtherThemes() {
        const keep = this.themeId;
        setTimeout(() => {
            if (this.themeId !== keep) return;
            for (const key of [...this.buffers.keys()]) {
                const th = key.split('|')[1];
                if (key.startsWith('amb|')) {
                    if (!this.ambSlots.some((s) => 'amb|' + s.name === key) && this.snap.amb !== key.slice(4)) this.buffers.delete(key);
                } else if (th && th !== keep) this.buffers.delete(key);
            }
        }, 3000);
    }

    /** 6ms 时间片调度：每片最多跑 6ms，然后让出主线程 12ms */
    _pumpJobs() {
        if (this._pumping) return;
        this._pumping = true;
        const step = () => {
            const t0 = now();
            while (this.jobs.length && now() - t0 < SLICE_MS) {
                const job = this.jobs[0];
                if (job.iter) {
                    const r = job.iter.next();
                    if (r.done) { this.jobs.shift(); job.done && job.done(r.value); }
                } else { this.jobs.shift(); job.run(); }
                if (now() - t0 > SLICE_MS / 2) break; // 已用过半预算就让出，避免再开一个重任务把这片撑爆
            }
            const dt = now() - t0;
            this.stats.slicedBakeMs += dt;
            this.stats.maxSliceMs = Math.max(this.stats.maxSliceMs, +dt.toFixed(2));
            if (this.jobs.length) setTimeout(step, 12); else this._pumping = false;
        };
        setTimeout(step, 0);
    }

    _ensureAmbience(name, fade) {
        const cur = this.ambSlots[this.ambActive];
        if (cur.name === name) return;
        const key = 'amb|' + name;
        const start = (buf) => {
            if (this.snap.amb !== name) return; // 已被更新的快照取代
            const t = this.ctx.currentTime;
            const old = this.ambSlots[this.ambActive];
            const next = this.ambSlots[this.ambActive ^ 1];
            if (next.src) { try { next.src.stop(); } catch (e) { /* noop */ } }
            const src = this.ctx.createBufferSource();
            src.buffer = buf; src.loop = true; src.connect(next.gain);
            src.start(t, this.rng() * buf.duration);
            next.src = src; next.name = name;
            next.gain.gain.cancelScheduledValues(t); next.gain.gain.setTargetAtTime(1, t, Math.max(0.05, fade / 3));
            old.gain.gain.cancelScheduledValues(t); old.gain.gain.setTargetAtTime(0, t, Math.max(0.05, fade / 3));
            this.ambActive ^= 1;
        };
        if (this.buffers.has(key)) { start(this.buffers.get(key)[0]); return; }
        this.jobs.push({ iter: ambienceJob(name, AMB_SR), done: (data) => {
            const buf = this._toBuffer(data, AMB_SR);
            this.buffers.set(key, [buf]);
            start(buf);
        } });
        this._pumpJobs();
    }

    /* ---------------- 播放（声部池） ---------------- */

    /**
     * @param {string} name   SOUND_DEFS 中的名字
     * @param {object} o      { semis 移调半音, gain 线性增益, when ctx 时间, layer 音乐层 id, jitter 是否随机 }
     */
    play(name, o = {}) {
        if (!this.ready || this.muted) return null;
        const def = SOUND_DEFS[name];
        if (!def) return null;
        const c = this.ctx, t = o.when ?? c.currentTime;

        // 1) 最小间隔
        const last = this.lastPlay.get(name);
        if (def.minInterval && last !== undefined && t - last < def.minInterval) { this.stats.minIntervalSkips++; return null; }

        // 2) 取缓冲（未烘焙则当场同步合成，计数）
        let list = this.buffers.get(this._key(name));
        if (!list || !list.length) { this.stats.onDemandBakes++; list = [this._bakeVariant(name, 0)]; this.buffers.set(this._key(name), list); }

        // 3) 同名上限 & 母线上限 → 抢占
        this._reap(t);
        const same = this.voices.filter((v) => v.name === name);
        if (same.length >= def.max) this._steal(same[0], t);
        const onBus = this.voices.filter((v) => v.bus === def.bus);
        if (onBus.length >= BUS_CAPS[def.bus]) {
            const victim = onBus.slice().sort((a, b) => a.pri - b.pri || a.t0 - b.t0)[0];
            if (victim.pri > def.pri) { this.stats.dropped++; return null; }
            this._steal(victim, t);
        }

        // 4) 变体轮换（30% 概率跳一个，避免规律感）
        let vi = ((this.variantIdx.get(name) ?? -1) + 1) % list.length;
        if (list.length > 2 && this.rng() < 0.3) vi = (vi + 1) % list.length;
        this.variantIdx.set(name, vi);

        // 5) 音高：音乐性音效只做 ±10 音分的细微随机，非音高音效 ±3.5%
        const jitter = o.jitter === false ? 0 : (def.pitched || def.bus === 'music' ? (this.rng() * 2 - 1) * 0.006 : (this.rng() * 2 - 1) * 0.035);
        const rate = Math.pow(2, (o.semis || 0) / 12) * (1 + jitter);
        const vol = (o.gain ?? 1) * (1 - this.rng() * (def.bus === 'music' ? 0.15 : 0.08));

        const src = c.createBufferSource();
        src.buffer = list[vi];
        src.playbackRate.value = rate;
        const g = c.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(o.layer ? this.layerGain[o.layer] : this.bus[def.bus]);
        src.start(t);
        const voice = { name, bus: def.bus, pri: def.pri, t0: t, end: t + list[vi].duration / rate, src, g };
        src.onended = () => { const i = this.voices.indexOf(voice); if (i >= 0) this.voices.splice(i, 1); try { g.disconnect(); } catch (e) { /* noop */ } };
        this.voices.push(voice);
        this.lastPlay.set(name, t);
        this.stats.played++;
        return voice;
    }

    _reap(t) { this.voices = this.voices.filter((v) => v.end > t); }

    _steal(v, t) {
        const i = this.voices.indexOf(v);
        if (i >= 0) this.voices.splice(i, 1);
        try {
            v.g.gain.cancelScheduledValues(t);
            v.g.gain.setValueAtTime(v.g.gain.value, t);
            v.g.gain.linearRampToValueAtTime(0, t + STEAL_FADE);
            v.src.stop(t + STEAL_FADE + 0.002);
        } catch (e) { /* noop */ }
        this.stats.stolen++;
    }

    /* ---------------- 游戏事件 ---------------- */

    onJump() {
        if (!this.ready) return;
        const t = this.ctx.currentTime;
        this.combo++;
        const semis = comboWalkSemis(this.snap.scale, this.combo - 1);
        this.play('jump', { semis });

        // 密度压低：2 秒内跳得越多，气流层越轻（最多 -6dB），防听觉疲劳
        this.recentJumps = this.recentJumps.filter((x) => t - x < 2);
        this.recentJumps.push(t);
        const density = Math.min(1, (this.recentJumps.length - 1) / 6);
        this.play('air', { gain: dbToGain(-6 * density) });

        if (this.combo > 0 && this.combo % 5 === 0) this.play('combo', { semis: 0 });
        this._updateLayers();
    }

    onLand() { this.play('land', { gain: 0.8 }); }
    onClear() { this.play('clear'); }
    onSpecial() { this.play('special'); }
    onUi() { this.play('ui'); }

    onFail() {
        this.combo = 0;
        this.recentJumps = [];
        this.play('fail');
        this._updateLayers(1.2);
        // 失败时音乐短暂压低并变暗，2 秒内恢复
        if (this.ready) {
            const t = this.ctx.currentTime;
            this.masterLP.frequency.cancelScheduledValues(t);
            this.masterLP.frequency.setTargetAtTime(Math.min(1500, this.snap.masterLP), t, 0.05);
            this.masterLP.frequency.setTargetAtTime(this.snap.masterLP, t + 0.6, 0.6);
        }
    }

    resetCombo() { this.combo = 0; this.recentJumps = []; this._updateLayers(); }

    /* ---------------- 自适应音乐 ---------------- */

    startMusic() {
        if (!this.ready) return;
        this.musicOn = true;
        this._applyVolumes(1.0);
        this._updateLayers(0.5);
        if (!this._sched) {
            this.beat = 0;
            this.nextBeat = this.ctx.currentTime + 0.1;
            this._sched = setInterval(() => this._schedule(), 25);
        }
    }

    stopMusic(fade = 0.8) {
        this.musicOn = false;
        if (this.ready) this._applyVolumes(fade);
        if (this._sched) { clearInterval(this._sched); this._sched = null; }
    }

    pause() { if (this.ctx && this.ctx.suspend) this.ctx.suspend().catch(() => {}); }
    resume() { if (this.ctx && this.ctx.resume) this.ctx.resume().catch(() => {}); }

    _updateLayers(fade = 2.0) {
        if (!this.ready) return;
        const t = this.ctx.currentTime;
        for (const L of MUSIC_LAYERS) {
            if (!this.layerGain[L.id]) continue;
            const on = this.combo >= L.minCombo ? 1 : 0;
            const target = on * (L.id === 'sparkle' ? this.snap.sparkle : 1);
            this.layerTargets[L.id] = target;
            const p = this.layerGain[L.id].gain;
            p.cancelScheduledValues(t);
            p.setTargetAtTime(target, t, fade / 3);
        }
    }

    activeLayers() {
        return MUSIC_LAYERS.filter((L) => L.id === 'bed' || (this.layerTargets[L.id] || 0) > 0).map((L) => L.id);
    }

    _schedule() {
        if (!this.musicOn || !this.ready) return;
        const ahead = this.ctx.currentTime + 0.15;
        while (this.nextBeat < ahead) {
            this._playBeat(this.beat, this.nextBeat);
            this.nextBeat += 60 / this.snap.tempo / 2; // 八分音符步进
            this.beat++;
        }
    }

    _playBeat(step, when) {
        const s = this.snap, bar = Math.floor(step / 8), pos = step % 8;
        const prog = [0, 3, 4, 2]; // 级数进行（音阶度数），4 小节循环
        const deg = prog[bar % prog.length];
        const chord = [0, 2, 4].map((k) => degreeToSemis(s.scale, deg + k));
        const L = this.layerTargets;
        if (pos === 0) chord.forEach((semi, i) => this.play('pad', { semis: semi, when: when + i * 0.01, layer: 'pad', gain: 0.5, jitter: false }));
        if ((L.pulse || 0) > 0 && (pos === 0 || pos === 4)) this.play('bass', { semis: pos === 0 ? chord[0] : chord[2] - 12 * (chord[2] > 7 ? 1 : 0), when, layer: 'pulse', gain: 0.8 });
        if ((L.arp || 0) > 0) {
            const pattern = [0, 1, 2, 1, 2, 3, 2, 1];
            const k = pattern[pos];
            this.play('arp', { semis: 12 + degreeToSemis(s.scale, deg + k * 2 - (k > 2 ? 2 : 0)), when, layer: 'arp', gain: 0.45 });
        }
        if ((L.sparkle || 0) > 0 && pos % 2 === 1 && this.rng() < 0.22 * s.sparkle) {
            this.play('bell', { semis: degreeToSemis(s.scale, deg + Math.floor(this.rng() * 5)), when, layer: 'sparkle', gain: 0.5 });
        }
    }

    /* ---------------- 调试 ---------------- */

    getStats() {
        if (this.ready) this._reap(this.ctx.currentTime);
        const perBus = {};
        for (const v of this.voices) perBus[v.bus] = (perBus[v.bus] || 0) + 1;
        let bytes = 0;
        for (const list of this.buffers.values()) for (const b of list) bytes += b.length * 4;
        return {
            theme: this.themeId, daypart: this.daypart, combo: this.combo, tempo: this.snap.tempo,
            layers: this.activeLayers(), amb: this.snap.amb, voices: this.voices.length, perBus,
            bufferKB: Math.round(bytes / 1024), pendingJobs: this.jobs.length, ...this.stats,
            slicedBakeMs: +this.stats.slicedBakeMs.toFixed(1)
        };
    }

    /** 试听页的电平表：在主输出后挂一个 AnalyserNode */
    attachAnalyser() {
        if (!this.ready || this.analyser || !this.ctx.createAnalyser) return this.analyser;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.trim.connect(this.analyser);
        return this.analyser;
    }

    destroy() {
        this.stopMusic(0.05);
        for (const v of this.voices) { try { v.src.stop(); } catch (e) { /* noop */ } }
        for (const s of this.ambSlots || []) { try { s.src && s.src.stop(); } catch (e) { /* noop */ } }
        this.voices = []; this.jobs = [];
        if (this.ctx && this.ctx.close) this.ctx.close().catch(() => {});
    }
}

/** tanh 软削波曲线，输出绝对上限 = ceiling（-1 dBFS） */
export function makeSoftClipCurve(n, drive, ceiling) {
    const curve = new Float32Array(n), k = ceiling / Math.tanh(drive);
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * drive) * k;
    }
    return curve;
}
