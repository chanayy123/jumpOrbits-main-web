/**
 * 音效系统 v2 · 接入现有 WebGame（只在 ?audio=v2 时被动态 import）
 *
 * 做法：不改动原有音频类，只在实例上“包一层”，把原来的事件路由到 AudioDirector：
 *   jump → onJump（含连击音高行走 / 气流 / 里程碑 / 音乐分层）
 *   trackSystem.onPlayerLand → onLand
 *   clear / specialTrack / score / collision / fail / buttonClick / pause
 *   playBackgroundMusic / pause / resume → 自适应音乐开关（不再播放 bg.mp3）
 *   主题切换 → setTheme；本地时钟 → 昼夜快照
 * 关闭 v2（不带参数）时，这个文件根本不会被加载。
 */
import { AudioDirector } from './audio-director.js';
import logger from '../utils/logger.js';

function readSettings() {
    try { return JSON.parse(localStorage.getItem('jumpOrbits_audioSettings') || '{}'); } catch (e) { return {}; }
}

export function installAudioV2(game) {
    const params = new URLSearchParams(location.search);
    const s = readSettings();
    const director = new AudioDirector({
        theme: game.themeManager.getCurrentThemeId(),
        daypart: params.get('daypart') || null,
        musicVolume: s.musicVolume ?? 1,
        sfxVolume: s.soundVolume ?? 0.6
    });
    game.audioV2 = director;
    window.__audioV2 = director;
    window.__audioStats = () => director.getStats();

    // 1) 首次手势解锁（iOS / 微信都要求用户手势后才能出声）
    const unlock = () => director.unlock();
    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((ev) =>
        window.addEventListener(ev, unlock, { capture: true, passive: true }));

    // 2) 事件路由
    const am = game.audioManager, au = game.audio;
    let lastFailAt = 0;
    const route = (id) => {
        switch (id) {
            case 'jump': wrapLand(); director.onJump(); return true;
            case 'clear': director.onClear(); return true;
            case 'specialTrack': director.onSpecial(); return true;
            case 'score': director.play('combo', { gain: 0.5 }); return true;
            case 'collision': lastFailAt = Date.now(); director.onFail(); return true;
            case 'fail': if (Date.now() - lastFailAt > 1000) director.onFail(); return true;
            case 'buttonClick': case 'pause': director.onUi(); return true;
            default: return false;
        }
    };
    const amPlay = am.playSound.bind(am);
    am.playSound = (id, o) => { if (!route(id)) amPlay(id, o); };
    am.handlePlayerClick = () => {};               // 旧“点击弹旋律”由 v2 的音高行走取代
    const auPlay = au.playSound.bind(au);
    au.playSound = (id) => { if (!route(id)) return auPlay(id); };
    au.playSlideSound = () => {};                  // 由 v2 的 air 层取代

    au.playBackgroundMusic = () => { director.unlock(); director.resetCombo(); director.startMusic(); };
    au.pauseBackgroundMusic = () => director.stopMusic();
    au.resumeBackgroundMusic = () => director.startMusic();
    const amStop = am.stopAll.bind(am);
    am.stopAll = () => { director.stopMusic(0.05); return amStop(); };

    // 音量 / 静音跟随原设置面板
    const setSV = au.setSoundVolume.bind(au);
    au.setSoundVolume = (v) => { director.setVolumes({ sfx: v }); return setSV(v); };
    const setMV = au.setBackgroundMusicVolume.bind(au);
    au.setBackgroundMusicVolume = (v) => { director.setVolumes({ music: v }); return setMV(v); };
    if (am.setMusicVolume) {
        const amMV = am.setMusicVolume.bind(am);
        am.setMusicVolume = (v) => { director.setVolumes({ music: v }); return amMV(v); };
    }
    const tm = au.toggleMute.bind(au);
    au.toggleMute = () => { const r = tm(); director.setMuted(au.muted); return r; };

    // 3) 落地（trackSystem 可能被重建，所以每次跳跃时检查一次）
    function wrapLand() {
        const ts = game.trackSystem;
        if (!ts || ts.__audioV2) return;
        const orig = ts.onPlayerLand.bind(ts);
        ts.onPlayerLand = (...a) => { director.onLand(); return orig(...a); };
        ts.__audioV2 = true;
    }
    wrapLand();

    // 4) 重开一局清连击
    const rs = game.resetState.bind(game);
    game.resetState = (...a) => { director.resetCombo(); return rs(...a); };

    // 5) 主题 / 昼夜 / 前后台
    game.themeManager.onThemeChange((id) => director.setTheme(id));
    setInterval(() => director.tickClock(), 60000);
    document.addEventListener('visibilitychange', () => (document.hidden ? director.pause() : director.resume()));

    logger.info('[audio-v2] 已启用：', director.themeId, director.daypart);
    return director;
}
