/**
 * 音效系统 v2 · 真实 WebAudio 图冒烟测试（可选，需要 node-web-audio-api，不写进 package.json）
 *   npm i --no-save node-web-audio-api && node tools/audio-v2/smoke-webaudio.mjs
 * 跑 11 秒：星空/夜 → 第 30 跳切森林 → 第 45 跳切白天 → 清除 → 失败 → 第 6 秒起 1 秒 40 跳压力测试。
 * 输出：解锁耗时、声部池统计、主输出峰值（AnalyserNode 轮询，近似值）。
 */
let AudioContext;
try { ({ AudioContext } = await import('node-web-audio-api')); } catch (e) {
    console.log('未安装 node-web-audio-api：npm i --no-save node-web-audio-api'); process.exit(0);
}
const { AudioDirector } = await import('../../platforms/web/js/core/audio-v2/audio-director.js');
const ctx = new AudioContext({ sinkId: { type: 'none' }, latencyHint: 'playback' });
const d = new AudioDirector({ context: ctx, theme: 'starsky', daypart: 'night' });
const t0 = performance.now(); d.unlock(); const unlockMs = performance.now() - t0;
const an = d.attachAnalyser(), an2 = ctx.createAnalyser(); an2.fftSize = 2048; d.comp.connect(an2);
const buf = new Float32Array(2048); let pk = 0, pk2 = 0; const peaks = {};
const poll = setInterval(() => {
    an.getFloatTimeDomainData(buf); for (const x of buf) pk = Math.max(pk, Math.abs(x));
    an2.getFloatTimeDomainData(buf); for (const x of buf) pk2 = Math.max(pk2, Math.abs(x));
}, 20);
const db = (x) => +(20 * Math.log10(Math.max(1e-9, x))).toFixed(2);
d.startMusic();
let i = 0;
const jumper = setInterval(() => {
    d.onJump(); setTimeout(() => d.onLand(), 300); i++;
    if (i === 30) d.setTheme('forest'); if (i === 45) d.setDaypart('day'); if (i === 50) d.onClear(); if (i === 55) d.onFail();
}, 160);
setTimeout(() => { peaks.normal = { out: db(pk), preClip: db(pk2) }; pk = pk2 = 0; for (let k = 0; k < 40; k++) setTimeout(() => { d.onJump(); d.onLand(); }, k * 25); }, 6000);
setTimeout(() => {
    clearInterval(jumper); clearInterval(poll);
    peaks.stressAndAfter = { out: db(pk), preClip: db(pk2) };
    console.log(JSON.stringify({ unlockMs: +unlockMs.toFixed(1), peaks, stats: d.getStats() }, null, 1));
    d.destroy(); process.exit(0);
}, 11000);
