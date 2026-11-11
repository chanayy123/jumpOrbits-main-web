/**
 * 音效系统 v2 · 无依赖自检（相当于本项目的 lint + 单测）
 *   node tools/audio-v2/check.mjs
 * 检查：语法 / 所有主题全部音色可合成且无 NaN / 峰值 / 单任务合成耗时 / 环境底单步耗时 / 代码体积（gzip）
 */
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { SOUND_DEFS, synthSound, ambienceJob, AMBIENCES, comboWalkSemis } from '../../platforms/web/js/core/audio-v2/recipes.js';
import { PALETTES, DAYPARTS, resolveSnapshot } from '../../platforms/web/js/core/audio-v2/palettes.js';
import { peak, gainToDb } from '../../platforms/web/js/core/audio-v2/dsp.js';

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('✗', msg); } };

const dir = resolve('platforms/web/js/core/audio-v2');
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
for (const f of [...files.map((f) => resolve(dir, f)), resolve('platforms/web/js/audio-lab.js'), resolve('platforms/web/js/main.js'), resolve('platforms/web/js/core/game.js')]) {
    try { execFileSync(process.execPath, ['--check', f]); } catch (e) { ok(false, 'syntax ' + f); }
}

for (const k in SOUND_DEFS) synthSound(k, 0, PALETTES.starsky); // 预热 JIT
let worstJob = 0, worstName = '', bootMs = 0;
for (const th in PALETTES) {
    let tb = 0;
    for (const [k, d] of Object.entries(SOUND_DEFS)) for (let v = 0; v < d.variants; v++) {
        const t = performance.now(); const b = synthSound(k, v, PALETTES[th]); const dt = performance.now() - t;
        if (d.boot) tb += dt;
        if (dt > worstJob) { worstJob = dt; worstName = `${th}:${k}:${v}`; }
        const p = peak(b);
        ok(Number.isFinite(p) && p > 0, `${th}:${k}:${v} 非有限或静音`);
        ok(gainToDb(p) <= -0.99, `${th}:${k}:${v} 峰值 ${gainToDb(p).toFixed(2)} dBFS > -1`);
    }
    bootMs = Math.max(bootMs, tb);
    for (const dp of DAYPARTS) { const s = resolveSnapshot(th, dp); ok(AMBIENCES[s.amb], `缺少环境底 ${s.amb}`); }
}
let worstStep = 0;
for (const a in AMBIENCES) {
    const it = ambienceJob(a); let r;
    do { const t = performance.now(); r = it.next(); worstStep = Math.max(worstStep, performance.now() - t); } while (!r.done);
    ok(gainToDb(peak(r.value)) <= -0.99, `环境底 ${a} 峰值过高`);
}
// 连击音高行走不越界：始终在 [0, 24] 半音内
for (const th in PALETTES) for (let c = 0; c < 200; c++) { const s = comboWalkSemis(PALETTES[th].scale, c); ok(s >= 0 && s <= 24, `${th} 连击 ${c} 音高 ${s}`); }

const src = files.map((f) => readFileSync(resolve(dir, f))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0));
console.log(JSON.stringify({
    files: files.length,
    codeKB: +(src.length / 1024).toFixed(1),
    codeGzipKB: +(gzipSync(src).length / 1024).toFixed(1),
    bootSynthMs_worstTheme: +bootMs.toFixed(1),
    worstSingleJobMs: +worstJob.toFixed(1), worstJob: worstName,
    worstAmbienceStepMs: +worstStep.toFixed(1)
}, null, 1));
console.log(fail ? `✗ ${fail} 项未通过` : '✓ 全部通过');
process.exit(fail ? 1 : 0);
