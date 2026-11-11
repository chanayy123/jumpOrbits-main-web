/**
 * 音效系统 v2 · 主题声音调色板 + 昼夜修饰 + 混音快照解析（纯数据 + 纯函数）
 *
 * 一个“快照”(snapshot) = 主题基础参数 × 昼夜修饰。切主题或切昼夜时，
 * AudioDirector 只需把各母线参数平滑过渡到新快照即可。
 */

/** 五个现有主题（id 与 theme-manager.js 一致） */
export const PALETTES = {
    starsky: {
        name: '星空',
        root: 62,                       // D4
        scale: [0, 2, 4, 7, 9],         // 大调五声
        timbre: 'glass',                // 玻璃 / 钟琴
        tempo: 66,
        space: { name: '星空大厅', decay: 3.2, damp: 5200, preDelay: 0.03, wet: 0.30 },
        amb: { day: 'space', night: 'spaceNight' },
        sfxBright: 12000,
        chord: [0, 4, 7, 11]            // 大七和弦色彩，空灵
    },
    light: {
        name: '轻盈',
        root: 65,                       // F4
        scale: [0, 2, 4, 6, 7, 9, 11],  // 利底亚
        timbre: 'kalimba',
        tempo: 76,
        space: { name: '明亮小房间', decay: 1.1, damp: 9000, preDelay: 0.01, wet: 0.16 },
        amb: { day: 'breeze', night: 'breezeNight' },
        sfxBright: 15000,
        chord: [0, 4, 7, 14]
    },
    cyberpunk: {
        name: '赛博朋克',
        root: 57,                       // A3
        scale: [0, 3, 5, 7, 10],        // 小调五声
        timbre: 'fm',
        tempo: 84,
        space: { name: '金属板混响', decay: 1.8, damp: 7000, preDelay: 0.02, wet: 0.24 },
        amb: { day: 'city', night: 'cityRain' },
        sfxBright: 14000,
        chord: [0, 3, 7, 10]
    },
    forest: {
        name: '森林',
        root: 67,                       // G4
        scale: [0, 2, 4, 7, 9],
        timbre: 'wood',                 // 木琴 / 木块
        tempo: 70,
        space: { name: '林间开阔', decay: 1.4, damp: 4200, preDelay: 0.025, wet: 0.20 },
        amb: { day: 'forestDay', night: 'forestNight' },
        sfxBright: 9000,
        chord: [0, 4, 7, 9]
    },
    sunrise: {
        name: '日出',
        root: 60,                       // C4
        scale: [0, 2, 4, 7, 9, 11],
        timbre: 'felt',                 // 毛毡钢琴感
        tempo: 72,
        space: { name: '海边开阔', decay: 2.0, damp: 6000, preDelay: 0.035, wet: 0.22 },
        amb: { day: 'shore', night: 'shoreNight' },
        sfxBright: 11000,
        chord: [0, 4, 7, 9, 14]
    }
};

export const THEME_IDS = Object.keys(PALETTES);
export const DAYPARTS = ['dawn', 'day', 'dusk', 'night'];
export const DAYPART_NAMES = { dawn: '清晨', day: '白天', dusk: '黄昏', night: '夜晚' };

/**
 * 昼夜修饰：数值为“乘数”或“加数”，作用在主题基础参数上。
 * 设计意图：白天亮、近、节奏正常；夜晚暗（主低通下降）、远（混响更湿更长）、慢、稀疏。
 */
export const DAYPART_MODS = {
    dawn:  { lp: 10000, wetAdd: 0.04, decayMul: 1.1, tempoMul: 0.95, ambDb: 0,  musicDb: -2, sparkle: 0.6, ambKey: 'day' },
    day:   { lp: 18000, wetAdd: 0.00, decayMul: 1.0, tempoMul: 1.00, ambDb: -2, musicDb: 0,  sparkle: 1.0, ambKey: 'day' },
    dusk:  { lp: 8000,  wetAdd: 0.06, decayMul: 1.2, tempoMul: 0.92, ambDb: 0,  musicDb: -1, sparkle: 0.7, ambKey: 'night' },
    night: { lp: 5200,  wetAdd: 0.10, decayMul: 1.35, tempoMul: 0.85, ambDb: 1, musicDb: -3, sparkle: 0.4, ambKey: 'night' }
};

/** 由本地时间推断昼夜：5–8 清晨，8–17 白天，17–20 黄昏，其余夜晚 */
export function daypartFromHour(h) {
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'dusk';
    return 'night';
}

/** 解析出一个完整快照（AudioDirector 直接消费） */
export function resolveSnapshot(themeId, daypart) {
    const p = PALETTES[themeId] || PALETTES.starsky;
    const m = DAYPART_MODS[daypart] || DAYPART_MODS.day;
    return {
        themeId: PALETTES[themeId] ? themeId : 'starsky',
        daypart: DAYPART_MODS[daypart] ? daypart : 'day',
        root: p.root,
        scale: p.scale,
        chord: p.chord,
        timbre: p.timbre,
        tempo: Math.round(p.tempo * m.tempoMul),
        masterLP: Math.min(m.lp, 20000),
        sfxLP: Math.min(p.sfxBright, m.lp * 1.6),
        reverb: {
            decay: p.space.decay * m.decayMul,
            damp: Math.min(p.space.damp, m.lp),
            preDelay: p.space.preDelay,
            wet: Math.min(0.5, p.space.wet + m.wetAdd)
        },
        amb: p.amb[m.ambKey],
        ambDb: -14 + m.ambDb,
        musicDb: -10 + m.musicDb,
        sfxDb: -7,
        sparkle: m.sparkle
    };
}

/** 连击 → 音乐层数（自适应音乐） */
export const MUSIC_LAYERS = [
    { id: 'bed',     minCombo: 0,  label: '环境底' },
    { id: 'pad',     minCombo: 0,  label: '和声垫' },
    { id: 'pulse',   minCombo: 5,  label: '低音脉冲' },
    { id: 'arp',     minCombo: 12, label: '琶音' },
    { id: 'sparkle', minCombo: 25, label: '高光点缀' }
];
