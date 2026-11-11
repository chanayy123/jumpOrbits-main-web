/**
 * 音效系统 v2 试听台：切主题 / 昼夜、单独触发音效、模拟一局、看声部池与电平
 * URL 参数：?theme=forest&daypart=night
 */
import { AudioDirector } from './core/audio-v2/audio-director.js';
import { PALETTES, DAYPARTS, DAYPART_NAMES, MUSIC_LAYERS } from './core/audio-v2/palettes.js';

const q = new URLSearchParams(location.search);
const d = new AudioDirector({ theme: q.get('theme') || 'starsky', daypart: q.get('daypart') || null });
window.__audioV2 = d;
window.__audioStats = () => d.getStats();

const $ = (id) => document.getElementById(id);
const unlock = () => { if (d.unlock()) d.attachAnalyser(); };
document.addEventListener('pointerdown', unlock, { capture: true });

function buttons(container, items, current, onPick) {
    const el = $(container);
    el.innerHTML = '';
    for (const [id, label] of items) {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = id === current() ? 'on' : '';
        b.onclick = () => { onPick(id); buttons(container, items, current, onPick); };
        el.appendChild(b);
    }
}
buttons('themes', Object.entries(PALETTES).map(([id, p]) => [id, p.name]), () => d.themeId, (id) => d.setTheme(id));
buttons('dayparts', [['', '跟随时钟'], ...DAYPARTS.map((x) => [x, DAYPART_NAMES[x]])],
    () => d.daypartOverride || '', (id) => d.setDaypart(id || null));

$('jumpBtn').onclick = () => { d.onJump(); setTimeout(() => d.onLand(), 300); };
document.querySelectorAll('[data-sfx]').forEach((b) => {
    b.onclick = () => ({ land: () => d.onLand(), clear: () => d.onClear(), special: () => d.onSpecial(), fail: () => d.onFail(), ui: () => d.onUi() })[b.dataset.sfx]();
});
$('music').onclick = () => (d.musicOn ? d.stopMusic() : d.startMusic());
$('reset').onclick = () => d.resetCombo();

let bot = null;
$('bot').onclick = () => {
    if (bot) { clearTimeout(bot); bot = null; return; }
    if (!d.musicOn) d.startMusic();
    const step = () => {
        d.onJump();
        setTimeout(() => d.onLand(), 300);
        if (d.combo % 10 === 0) setTimeout(() => d.onClear(), 320);
        if (d.combo > 8 && Math.random() < 0.025) d.onFail();
        bot = setTimeout(step, 380 + Math.random() * 420);
    };
    step();
};
$('spam').onclick = () => { for (let i = 0; i < 40; i++) setTimeout(() => { d.onJump(); d.onLand(); }, i * 25); };

let peakHold = 0;
const tbuf = new Float32Array(2048);
function frame() {
    if (d.ready) {
        const s = d.getStats();
        if (d.analyser) {
            d.analyser.getFloatTimeDomainData(tbuf);
            let p = 0; for (const x of tbuf) p = Math.max(p, Math.abs(x));
            peakHold = Math.max(peakHold * 0.995, p);
            s.peakDbfs = +(20 * Math.log10(Math.max(1e-6, peakHold))).toFixed(2);
            $('meter').firstElementChild.style.width = Math.min(100, p * 100) + '%';
        }
        $('stats').textContent = JSON.stringify(s, null, 1);
        $('layers').innerHTML = MUSIC_LAYERS.map((L) => `<span class="${s.layers.includes(L.id) && (d.musicOn || L.id === 'bed') ? 'on' : ''}">${L.label} ≥${L.minCombo}</span>`).join('');
    }
    requestAnimationFrame(frame);
}
frame();
