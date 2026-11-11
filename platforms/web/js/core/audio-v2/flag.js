/**
 * 音效系统 v2 开关（默认关闭，行为与原来完全一致）
 * 打开方式：URL 加 ?audio=v2，或 localStorage.setItem('jumpOrbits_audioV2', '1')
 * 可选：&daypart=dawn|day|dusk|night 强制昼夜（不加则跟随本地时钟）
 */
export function isAudioV2Enabled() {
    try {
        if (typeof location !== 'undefined') {
            const p = new URLSearchParams(location.search);
            if (p.get('audio') === 'v2') return true;
            if (p.get('audio') === 'v1') return false;
        }
        return typeof localStorage !== 'undefined' && localStorage.getItem('jumpOrbits_audioV2') === '1';
    } catch (e) {
        return false;
    }
}
