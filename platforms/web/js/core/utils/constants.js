// 游戏常量定义

// 音频系统常量
export const AUDIO_CONSTANTS = {
    // 本地存储键
    STORAGE_KEY: 'jumpOrbits_musicSystemUnlockState',
    // 测试模式存储键
    TESTING_MODE_KEY: 'jumpOrbits_audioTestingMode',

    // 渐变切换设置
    FADE_TRANSITION: {
        DURATION: 1000,    // 渐变持续时间（毫秒）
        STEPS: 20,         // 渐变步数
        INTERVAL: 50       // 每步时间间隔（毫秒）
    },

    // 默认音符频率（支持带八度表示）
    NOTE_FREQUENCIES: {
        // 基本音符（默认为第4八度）
        'C': 261.63, // do (C4)
        'D': 293.66, // re (D4)
        'E': 329.63, // mi (E4)
        'F': 349.23, // fa (F4)
        'G': 392.00, // sol (G4)
        'A': 440.00, // la (A4)
        'B': 493.88, // si (B4)
        'C2': 523.25, // 高音do (C5)

        // 带八度表示的音符（第3八度）
        'C3': 130.81,
        'D3': 146.83,
        'E3': 164.81,
        'F3': 174.61,
        'G3': 196.00,
        'A3': 220.00,
        'B3': 246.94,

        // 带八度表示的音符（第4八度 - 中音区）
        'C4': 261.63,
        'D4': 293.66,
        'E4': 329.63,
        'F4': 349.23,
        'G4': 392.00,
        'A4': 440.00,
        'B4': 493.88,

        // 带八度表示的音符（第5八度）
        'C5': 523.25,
        'D5': 587.33,
        'E5': 659.26,
        'F5': 698.46,
        'G5': 783.99,
        'A5': 880.00,
        'B5': 987.77,

        // 休止符
        '0': 0
    },

    // 变奏类型
    VARIATION_TYPES: {
        KEY_SHIFT: 'keyShift',          // 调性变换（升降调）
        TEMPO_CHANGE: 'tempoChange',    // 速度变化
        TIMBRE_CHANGE: 'timbreChange',  // 音色变化
        OCTAVE_SHIFT: 'octaveShift',    // 八度变换
    },

    // 播放策略模式
    PLAYBACK_MODES: {
        LOOP_CURRENT: 'loopCurrent',    // 循环当前简谱
        AUTO_NEXT: 'autoNext',          // 自动切换下一首
        SMART_MIX: 'smartMix',          // 智能混合模式
        CATEGORY_SEQUENCE: 'categorySequence' // 按照分类顺序播放
    },

    // 默认波形（音色）选项
    WAVEFORM_OPTIONS: ['sine', 'square', 'triangle', 'sawtooth']
}; 