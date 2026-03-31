/**
 * 音频系统 - 负责生成音符和播放简谱
 */
import { AUDIO_CONSTANTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

export class AudioSystem {
    constructor() {
        // 创建音频上下文
        this.audioContext = null;

        // 延迟初始化音频上下文（需要用户交互）
        this.isInitialized = false;

        // 定义音符频率（复用常量）
        this.notes = AUDIO_CONSTANTS.NOTE_FREQUENCIES;

        // 存储简谱
        this.melody = [];
        this.currentNoteIndex = 0;

        // 默认播放参数
        this.playbackParams = {
            tempo: 120,          // 默认速度(BPM)
            noteDuration: 0.5,   // 默认音符持续时间(秒)
            waveform: 'sine'     // 默认波形
        };

        // 添加事件处理函数集合
        this.eventHandlers = {
            onMelodyComplete: null
        };

        // 添加重置时间戳
        this.resetTime = Date.now();

        // 标记是否正在进行初始化
        this.initializationPromise = null;
    }

    /**
     * 初始化音频系统（需要用户交互后调用）
     * @returns {Promise} 初始化完成的Promise
     */
    init() {
        // 如果已经在初始化过程中，返回当前的初始化Promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // 如果已经初始化完成，直接返回resolved Promise
        if (this.isInitialized && this.audioContext && this.audioContext.state !== 'closed') {
            return Promise.resolve();
        }

        // 创建初始化Promise
        this.initializationPromise = new Promise((resolve, reject) => {
            try {
                // 检查是否支持AudioContext
                if (!(window.AudioContext || window.webkitAudioContext)) {
                    throw new Error('此浏览器不支持Web Audio API');
                }

                // 创建音频上下文（如果不存在或已关闭）
                if (!this.audioContext || this.audioContext.state === 'closed') {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                this.isInitialized = true;
                logger.info('音频系统已初始化');

                // 音频上下文挂起时，记录状态但不阻止初始化完成
                if (this.audioContext.state === 'suspended') {
                    logger.warn('AudioContext处于挂起状态，需要用户交互才能恢复');
                }

                resolve();
            } catch (e) {
                logger.error('初始化音频系统失败:', e);
                this.isInitialized = false;
                this.audioContext = null;
                reject(e);
            } finally {
                // 完成后清除初始化Promise引用
                this.initializationPromise = null;
            }
        });

        return this.initializationPromise;
    }

    /**
     * 加载简谱
     * @param {Array} noteArray - 简谱数组，如['C', 'D', 'E', 'C']
     * @param {Object} playbackParams - 播放参数
     */
    loadMelody(noteArray, playbackParams = {}) {
        this.melody = noteArray;
        this.currentNoteIndex = 0;

        // 更新播放参数
        this.playbackParams = { ...this.playbackParams, ...playbackParams };

        logger.debug('简谱已加载:', this.melody);
        logger.debug('播放参数:', this.playbackParams);
    }

    /**
     * 播放单个音符
     * @param {string} note - 音符名称，如'C'表示do
     * @param {Object} variation - 变奏参数
     * @returns {Promise} 音符开始播放的Promise
     */
    async playNote(note, variation = null) {
        // 确保音频系统已初始化
        if (!this.isInitialized) {
            try {
                await this.init();
            } catch (e) {
                logger.warn('无法初始化音频系统，音符播放失败');
                return Promise.reject(e);
            }
        }

        // 检查音符是否有效
        if (!this.notes[note]) {
            logger.warn('未知的音符:', note);
            return Promise.resolve(); // 返回resolved Promise以便链式调用
        }

        // 检查AudioContext状态，如果已关闭则不继续
        if (!this.audioContext || this.audioContext.state === 'closed') {
            logger.warn('AudioContext不可用或已关闭，无法播放音符');
            return Promise.resolve();
        }

        // 如果AudioContext处于挂起状态，尝试恢复
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                logger.warn('恢复AudioContext失败:', e);
                // 继续尝试播放，即使恢复失败
            }
        }

        return new Promise(resolve => {
            // 计算音符持续时间（考虑变奏的速度因子）
            let duration = this.playbackParams.noteDuration;
            if (variation && variation.tempoFactor) {
                duration = duration / variation.tempoFactor;
            }

            // 获取基础频率
            let frequency = this.notes[note];

            // 应用变奏到频率（如果有）
            if (variation) {
                // 应用调性和八度变化
                if (variation.keyShift !== 0 || variation.octaveShift !== 0) {
                    let semitoneShift = (variation.keyShift || 0) + (variation.octaveShift || 0) * 12;
                    frequency *= Math.pow(2, semitoneShift / 12);
                }
            }

            // 创建振荡器(Oscillator)
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            // 设置音符频率
            oscillator.frequency.value = frequency;

            // 设置波形（音色）
            oscillator.type = variation && variation.timbre ? variation.timbre : this.playbackParams.waveform;

            // 连接节点
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 应用音量因子（如果存在）
            let baseVolume = 0.5;
            if (variation && variation.volumeFactor !== undefined) {
                baseVolume = baseVolume * variation.volumeFactor;
            }

            // 应用包络（音量变化）
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now); // 从0开始
            gainNode.gain.linearRampToValueAtTime(baseVolume, now + 0.01); // 快速攀升
            gainNode.gain.linearRampToValueAtTime(0, now + duration); // 缓慢衰减

            // 设置音频完成事件
            oscillator.onended = () => {
                try {
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接时可能的错误
                }
                resolve();
            };

            // 启动和停止振荡器
            oscillator.start(now);
            oscillator.stop(now + duration);
        });
    }

    /**
     * 播放下一个音符
     * @param {Object} variation - 变奏参数
     */
    playNextNote(variation = null) {
        if (this.melody.length === 0) {
            logger.warn('没有加载简谱');
            return;
        }

        // 检查音频系统状态
        if (!this.isInitialized || !this.audioContext || this.audioContext.state === 'closed') {
            logger.warn('AudioContext不可用或未初始化，无法播放音符');
            return;
        }

        // 获取当前音符
        const currentNote = this.melody[this.currentNoteIndex];

        // 计算音符持续时间（考虑变奏的速度因子）
        let duration = this.playbackParams.noteDuration;
        if (variation && variation.tempoFactor) {
            duration = duration / variation.tempoFactor;
        }

        // 播放当前音符
        this.playNote(currentNote, variation).then(() => {
            // 移动到下一个音符
            this.currentNoteIndex = (this.currentNoteIndex + 1) % this.melody.length;

            // 检查是否播放完一遍简谱
            if (this.currentNoteIndex === 0 && this.eventHandlers.onMelodyComplete) {
                // 触发简谱完成事件
                this.eventHandlers.onMelodyComplete();
            }
        });
    }

    /**
     * 设置事件处理函数
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理函数
     */
    on(eventName, handler) {
        if (this.eventHandlers.hasOwnProperty(eventName)) {
            this.eventHandlers[eventName] = handler;
        }
    }

    /**
     * 更新播放参数
     * @param {Object} params - 播放参数
     */
    updatePlaybackParams(params) {
        this.playbackParams = { ...this.playbackParams, ...params };
        logger.debug('播放参数已更新:', this.playbackParams);
    }

    /**
     * 停止所有声音
     */
    stopAll() {
        if (this.audioContext && this.audioContext.state === 'running') {
            // 先从旧版本的API中获取当前所有激活的节点，然后断开它们
            try {
                this.audioContext.suspend();
            } catch (e) {
                logger.warn('停止音频失败:', e);
            }
        }
    }

    /**
     * 彻底清理和重置音频系统
     * 确保停止所有可能正在播放的声音
     */
    reset() {
        // 停止当前所有音频处理
        this.stopAll();

        // 重置当前音符索引
        this.currentNoteIndex = 0;

        // 保存可能需要的旋律信息
        const savedMelody = this.melody ? [...this.melody] : [];

        // 临时清空旋律数组，这样即使有setTimeout的回调在等待，也不会找到旋律去播放
        this.melody = [];

        // 创建一个全局变量，标记resetTime，任何在此时间之前设置的延时播放应该被丢弃
        // 这是一个基本的时间戳机制，用于识别重置之前的setTimeout回调
        this.resetTime = Date.now();

        // 在某些浏览器环境下，仅suspend可能不足以立即停止所有声音
        if (this.audioContext) {
            // 检查AudioContext状态，如果已关闭则不尝试操作
            if (this.audioContext.state === 'closed') {
                logger.debug('AudioContext已关闭，reset操作将跳过音频处理');
            } else {
                try {
                    // 如果上下文正在运行，先暂停它
                    if (this.audioContext.state === 'running') {
                        this.audioContext.suspend();
                    }

                    // 只有当AudioContext没有关闭时，才尝试创建节点
                    if (this.audioContext.state !== 'closed') {
                        // 创建静音节点来中断剩余的声音
                        const silenceNode = this.audioContext.createGain();
                        silenceNode.gain.value = 0;
                        silenceNode.connect(this.audioContext.destination);

                        // 创建一个短暂的振荡器，可以帮助清除音频队列中的声音
                        const oscillator = this.audioContext.createOscillator();
                        oscillator.frequency.value = 0; // 0Hz，实际上不会产生可听声音
                        oscillator.connect(silenceNode);

                        try {
                            oscillator.start();
                            oscillator.stop(this.audioContext.currentTime + 0.01); // 立即停止
                        } catch (e) {
                            // 忽略可能的错误
                        }

                        // 立即断开连接
                        setTimeout(() => {
                            try {
                                silenceNode.disconnect();
                            } catch (e) {
                                // 忽略可能的错误
                            }
                        }, 20);
                    }
                } catch (e) {
                    logger.warn('重置音频系统时出错:', e);
                }

                // 在一些极端情况下，尝试重新创建AudioContext
                // 注意：这是一个昂贵的操作，只在必要时使用
                if (this.audioContext.state !== 'closed' && this.audioContext.close) {
                    try {
                        // 先尝试关闭当前上下文
                        this.audioContext.close().then(() => {
                            // 重新创建新的上下文
                            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

                            // 重建上下文后立即恢复旋律
                            if (savedMelody.length > 0) {
                                this.melody = savedMelody;
                                logger.info('在新AudioContext中恢复旋律数组');
                            }
                        }).catch(err => {
                            logger.warn('关闭AudioContext失败:', err);
                        });
                    } catch (e) {
                        logger.warn('尝试关闭/重建AudioContext失败:', e);
                    }
                }
            }
        }

        // 恢复旋律数组，但保持索引为0
        // 减少延迟时间以确保响应更快
        if (savedMelody.length > 0) {
            // 直接恢复简谱，避免不必要的延迟
            this.melody = savedMelody;
            logger.info('立即恢复旋律数组:', this.melody);
        }

        // 打印日志
        logger.info('音频系统已重置，当前旋律:', this.melody);
    }

    /**
     * 恢复音频处理
     */
    resume() {
        if (this.audioContext) {
            // 检查AudioContext状态，如果已关闭则不尝试操作
            if (this.audioContext.state === 'closed') {
                logger.debug('AudioContext已关闭，无法恢复');
                return;
            }

            if (this.audioContext.state === 'suspended') {
                try {
                    // 在恢复之前，先尝试一次"静音操作"，这可以帮助中断任何可能仍在播放的声音
                    // 只有当AudioContext没有关闭时，才尝试创建节点
                    const silenceNode = this.audioContext.createGain();
                    silenceNode.gain.value = 0;
                    silenceNode.connect(this.audioContext.destination);

                    // 短暂延迟后恢复上下文并断开静音节点
                    setTimeout(() => {
                        try {
                            this.audioContext.resume();
                            silenceNode.disconnect();
                        } catch (e) {
                            logger.warn('恢复音频失败:', e);
                        }
                    }, 10);
                } catch (e) {
                    // 如果静音操作失败，直接尝试恢复
                    try {
                        this.audioContext.resume();
                    } catch (e) {
                        logger.warn('恢复音频失败:', e);
                    }
                }
            }
        }
    }

    /**
     * 播放音效，由于AudioSystem没有内置音效，此方法仅用于兼容性
     * @param {string} soundId - 音效ID
     */
    playSound(soundId) {
        logger.info(`AudioSystem接收到播放音效请求: ${soundId}，但高级系统不直接支持播放音效`);

        // 获取音效音量设置
        let soundVolume = 0.6; // 默认音量
        try {
            const settingsKey = 'jumpOrbits_audioSettings';
            const savedSettings = localStorage.getItem(settingsKey);
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings.soundVolume !== undefined) {
                    soundVolume = settings.soundVolume;
                    logger.debug('使用设置面板的音效音量:', soundVolume);
                }
            }
        } catch (e) {
            logger.warn('读取设置面板音效音量失败:', e);
        }

        // 如果音量为0，则不播放音效
        if (soundVolume <= 0) {
            logger.debug('音效音量为0，不播放音效');
            return;
        }

        // 创建变奏参数，应用音量设置
        const variation = {
            volumeFactor: soundVolume // 音量因子
        };

        // 这里可以通过播放某个特定音符或简短旋律来模拟音效
        // 例如，可以根据soundId播放不同的简短音符
        switch (soundId) {
            case 'buttonClick':
                // 可以播放一个简短的高音符作为按钮点击反馈
                this.playNote('E', { ...variation, tempoFactor: 2 });
                break;
            case 'collision':
                // 可以播放一个低音符作为碰撞音效
                this.playNote('C', { ...variation, timbre: 'sawtooth' });
                break;
            case 'clear':
                // 可以播放一个上升的音符作为清除音效
                this.playNote('G', { ...variation, tempoFactor: 1.5 });
                break;
            case 'score':
                // 可以播放一个明亮的音符作为得分音效
                this.playNote('A', { ...variation, timbre: 'sine' });
                break;
            case 'specialTrack':
                // 可以播放一个特殊的音符作为特殊轨道音效
                this.playNote('B', { ...variation, timbre: 'triangle' });
                break;
            default:
                // 默认播放中等音高的音符
                this.playNote('D', variation);
        }
    }

    /**
     * 播放一系列音符
     * @param {Array} notes - 音符数组
     * @param {Object} variation - 变奏参数
     */
    playNotes(notes, variation = null) {
        if (!Array.isArray(notes) || notes.length === 0) {
            logger.warn('无效的音符序列');
            return;
        }

        // 检查音频系统状态
        if (!this.isInitialized || !this.audioContext || this.audioContext.state === 'closed') {
            logger.warn('AudioContext不可用或未初始化，无法播放音符序列');
            return;
        }

        // 暂存当前旋律
        const originalMelody = this.melody;
        const originalIndex = this.currentNoteIndex;

        // 记录当前的时间戳，用于后续检查是否发生了重置
        const playStartTime = Date.now();
        const resetTimeAtStart = this.resetTime || 0;

        // 设置临时音符序列
        this.melody = notes;
        this.currentNoteIndex = 0;

        // 播放第一个音符
        this.playNextNote(variation);

        // 使用简单的方法顺序播放剩余音符
        // 注意：这种方法不考虑音符持续时间差异，仅为了简单演示
        for (let i = 1; i < notes.length; i++) {
            setTimeout(() => {
                // 检查是否发生了重置（resetTime比我们开始播放的时间更新）
                const wasResetAfterStart = this.resetTime && this.resetTime > resetTimeAtStart;

                // 检查音频系统状态
                const isAudioAvailable = this.isInitialized && this.audioContext &&
                    this.audioContext.state !== 'closed';

                // 只有在没有重置并且当前索引在范围内且音频系统可用时才播放音符
                if (!wasResetAfterStart && this.currentNoteIndex < this.melody.length && isAudioAvailable) {
                    this.playNextNote(variation);
                } else {
                    // 如果在播放过程中发生了重置或音频系统不可用，则不再继续播放
                    logger.debug('不再播放后续音符，系统状态可能已改变');
                }
            }, i * (this.playbackParams.noteDuration * 1000));
        }

        // 播放完毕后恢复原始旋律
        setTimeout(() => {
            // 同样检查是否发生了重置
            const wasResetAfterStart = this.resetTime && this.resetTime > resetTimeAtStart;

            // 只有在没有重置的情况下才恢复原始旋律
            if (!wasResetAfterStart) {
                this.melody = originalMelody;
                this.currentNoteIndex = originalIndex;
            } else {
                // 如果已经重置，则不恢复原始状态
                logger.debug('不恢复旋律状态，因为已经重置了音频系统');
            }
        }, notes.length * (this.playbackParams.noteDuration * 1000));
    }

    /**
     * 播放变奏
     * @param {Object} variationConfig - 变奏配置
     */
    playVariation(variationConfig) {
        if (!variationConfig) {
            logger.warn('无效的变奏配置');
            return;
        }

        // 根据变奏配置类型处理
        if (variationConfig.notes) {
            // 如果有音符序列，播放它们
            this.playNotes(variationConfig.notes, variationConfig);
        } else if (variationConfig.note) {
            // 如果只有单个音符，播放它
            this.playNote(variationConfig.note, variationConfig);
        } else {
            // 其他情况，播放当前音符的变奏
            this.playNextNote(variationConfig);
        }
    }

    // 静态方法，提供一个备用的重置函数
    static resetInstance(instance) {
        if (!instance) return;

        // 尝试停止声音
        if (instance.audioContext && instance.audioContext.state === 'running') {
            try {
                instance.audioContext.suspend();
            } catch (e) {
                logger.warn('静态方法停止音频失败:', e);
            }
        }

        // 重置索引
        instance.currentNoteIndex = 0;

        // 尝试创建静音节点
        if (instance.audioContext && instance.audioContext.state === 'running') {
            try {
                const silenceNode = instance.audioContext.createGain();
                silenceNode.gain.value = 0;
                silenceNode.connect(instance.audioContext.destination);

                setTimeout(() => {
                    try {
                        silenceNode.disconnect();
                    } catch (e) {
                        // 忽略可能的错误
                    }
                }, 10);
            } catch (e) {
                logger.warn('静态方法重置音频时出错:', e);
            }
        }
    }
}

export default AudioSystem; 