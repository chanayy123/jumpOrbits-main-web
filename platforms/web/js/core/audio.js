import { GAME_CONFIG } from './utils/config.js';
import { AUDIO_CONSTANTS } from './utils/constants.js';
import logger from './utils/logger.js';

export class WebAudio {
    constructor() {
        // 基础音频系统属性（原Audio类的属性）
        this.sounds = {}; // 用于存储音效
        this.volume = 1.0;
        this.muted = false;

        // WebAudio特有属性
        this.audioContext = null;
        this.soundBuffers = {};
        this.backgroundMusic = null;          // AudioBuffer 对象
        this.backgroundMusicSource = null;    // AudioBufferSourceNode 对象
        this.bgMusicGainNode = null;
        this.soundVolume = GAME_CONFIG.SOUND_EFFECTS.VOLUME || 1.0; // 音效音量
        this._savedBackgroundMusicVolume = undefined;
        this._delayedInitComplete = false; // 标记延迟初始化是否完成
        this._fadeTimeout = null; // 用于存储渐变定时器
        this._originalVolume = undefined;

        // 添加音频系统信息
        this._audioSystemInfo = {
            systemType: 'default', // 默认或高级
            volumeModifier: 1.0    // 音量修改系数
        };

        // 尝试创建音频上下文，但不进行实际音频处理
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // 立即挂起音频上下文，等待用户交互
            if (this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend().catch(err => {
                    logger.warn('无法挂起AudioContext:', err);
                });
            }
        } catch (e) {
            logger.warn('Web Audio API is not supported in this browser. Using fallback Audio element.');
        }

        // 轻量级初始化，只准备必要的结构
        this.initializeBasicAudio();
    }

    /**
     * 设置音频系统信息
     * @param {Object} info - 音频系统信息
     * @param {string} info.systemType - 系统类型 ('default' 或 'advanced')
     * @param {number} info.volumeModifier - 音量修改系数 (如高级系统为0.3)
     */
    setAudioSystemInfo(info) {
        this._audioSystemInfo = { ...this._audioSystemInfo, ...info };
        logger.debug('音频系统信息已更新:', this._audioSystemInfo);

        // 如果需要，可以立即应用音量修改
        if (this.bgMusicGainNode && this._savedBackgroundMusicVolume !== undefined) {
            const baseVolume = this._savedBackgroundMusicVolume;
            const actualVolume = info.systemType === 'advanced' ?
                baseVolume * info.volumeModifier : baseVolume;

            if (!this.muted) {
                this.bgMusicGainNode.gain.value = actualVolume;
                logger.debug(`根据音频系统信息更新音量: ${actualVolume} (基础音量: ${baseVolume})`);
            }
        }
    }

    /**
     * 轻量级初始化 - 仅创建基本结构，不加载音频资源
     */
    initializeBasicAudio() {
        // 只创建基本音频结构，不加载实际资源
        // 这样可以减轻游戏启动时的负担
        logger.debug('音频系统基础结构已初始化，等待游戏开始后加载资源');
    }

    /**
     * 完整初始化 - 在游戏开始后调用
     */
    async initializeAudio() {
        // 如果已经完成延迟初始化，则无需重复执行
        if (this._delayedInitComplete) return Promise.resolve();

        try {
            // 恢复音频上下文（如果处于挂起状态）
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 加载基础音效（优先加载必要的游戏音效）
            this.loadBasicSounds();

            // 预先创建bgMusicGainNode，确保音量设置能够立即生效
            if (this.audioContext && !this.bgMusicGainNode) {
                try {
                    this.bgMusicGainNode = this.audioContext.createGain();
                    // 使用保存的音量或默认值
                    const volume = this._savedBackgroundMusicVolume !== undefined ?
                        this._savedBackgroundMusicVolume : 1.0;
                    this.bgMusicGainNode.gain.value = this.muted ? 0 : volume;
                    this.bgMusicGainNode.connect(this.audioContext.destination);
                    logger.debug(`初始化时创建了背景音乐增益节点，音量设置为: ${volume}`);
                } catch (e) {
                    logger.warn('初始化时创建背景音乐增益节点失败:', e);
                }
            }

            // 使用Promise.all并行加载其他资源，提高加载效率
            await Promise.all([
                this.loadExternalSounds(),
                this.loadBackgroundMusic(),
                this.loadGameOverSound(),
                this.loadClearSound()
            ]);

            this._delayedInitComplete = true;
            logger.debug('音频系统完整初始化完成');

            return Promise.resolve();
        } catch (error) {
            logger.warn('音频系统初始化过程中发生错误:', error);
            this._delayedInitComplete = false; // 初始化失败时重置状态
            return Promise.reject(error);
        }
    }

    loadBasicSounds() {
        // 创建简单的跳跃音效（使用程序生成的声音，无需外部资源）
        this.createJumpSound();
        this.createCollisionSound();
        this.createLevelUpSound();
        this.createSpecialTrackSound();
        this.createButtonClickSound();
        this.createGameOverSound();
        this.createForwardSlideSound();  // 添加顺向滑动音效
        this.createReverseSlideSound();  // 添加反向滑动音效
    }

    /**
     * 创建简单的跳跃音效，通过 Web Audio API 合成
     */
    createJumpSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.2秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.2;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建跳跃音效 - 上扬的音调
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 开始频率 400Hz，结束频率 1200Hz
            const frequency = 400 + 4000 * t;
            // 指数衰减音量
            const volume = 0.8 * Math.exp(-8 * t);
            // 正弦波
            data[i] = volume * Math.sin(frequency * t * Math.PI * 2);
        }

        this.soundBuffers['jump'] = buffer;
    }

    /**
     * 创建简单的碰撞音效，通过 Web Audio API 合成
     */
    createCollisionSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.3秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建碰撞音效 - 下降音调加噪声
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 开始频率 300Hz，结束频率 150Hz
            const frequency = 300 - 150 * t;
            // 快速衰减音量
            const volume = 0.9 * Math.exp(-10 * t);
            // 正弦波加噪声
            const noise = (Math.random() * 2 - 1) * 0.5;
            data[i] = volume * (Math.sin(frequency * t * Math.PI * 2) * 0.7 + noise * 0.3);
        }

        this.soundBuffers['collision'] = buffer;
    }

    /**
     * 创建简单的升级音效，通过 Web Audio API 合成
     */
    createLevelUpSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.5秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建升级音效 - 上升音调的短阶梯
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 5个音节的阶梯
            const step = Math.floor(t * 5);
            // 每个音节的频率提高
            const baseFreq = 440 + step * 110;
            // 每个音节内部的音量衰减
            const stepT = t * 5 - step;
            const volume = 0.7 * Math.exp(-3 * stepT);
            // 正弦波
            data[i] = volume * Math.sin(baseFreq * t * Math.PI * 2);
        }

        this.soundBuffers['levelUp'] = buffer;
    }

    /**
     * 创建简单的特殊轨道音效，通过 Web Audio API 合成
     */
    createSpecialTrackSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.5秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建特殊轨道音效 - 明亮的音调
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 两个交替的频率
            const freq1 = 880;
            const freq2 = 1320;
            // 缓慢衰减音量
            const volume = 0.8 * Math.exp(-3 * t);
            // 两个正弦波的混合
            data[i] = volume * (
                Math.sin(freq1 * t * Math.PI * 2) * 0.6 +
                Math.sin(freq2 * t * Math.PI * 2) * 0.4
            );
        }

        this.soundBuffers['specialTrack'] = buffer;
    }

    /**
     * 创建简单的按钮点击音效
     */
    createButtonClickSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.1秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.1;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建按钮点击音效 - 简短清脆的声音
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 使用较高的频率
            const frequency = 2000;
            // 快速衰减音量
            const volume = 0.3 * Math.exp(-30 * t);
            // 正弦波
            data[i] = volume * Math.sin(frequency * t * Math.PI * 2);
        }

        this.soundBuffers['buttonClick'] = buffer;
    }

    /**
     * 创建游戏结束音效
     */
    createGameOverSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.8秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.8;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建游戏结束音效 - 下降音调的和弦
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 三个下降的频率组成和弦
            const freq1 = 440 * Math.pow(0.5, t);
            const freq2 = 550 * Math.pow(0.5, t);
            const freq3 = 660 * Math.pow(0.5, t);
            // 缓慢衰减音量
            const volume = 0.4 * Math.exp(-4 * t);
            // 三个正弦波的混合
            data[i] = volume * (
                Math.sin(freq1 * t * Math.PI * 2) * 0.4 +
                Math.sin(freq2 * t * Math.PI * 2) * 0.3 +
                Math.sin(freq3 * t * Math.PI * 2) * 0.3
            );
        }

        this.soundBuffers['gameOver'] = buffer;
    }

    /**
     * 创建顺向滑动音效
     */
    createForwardSlideSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.3秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建顺向滑动音效 - 上升的滑音
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 从低频滑向高频
            const frequency = 300 + 1200 * t;
            // 渐变音量
            const volume = 0.6 * (1 - Math.pow(t / duration, 2));
            // 添加一些噪声来模拟摩擦声
            const noise = (Math.random() * 2 - 1) * 0.2;
            data[i] = volume * (Math.sin(frequency * t * Math.PI * 2) * 0.8 + noise * 0.2);
        }

        this.soundBuffers['forwardSlide'] = buffer;
    }

    /**
     * 创建反向滑动音效
     */
    createReverseSlideSound() {
        if (!this.audioContext) return;

        // 创建音频缓冲区（0.3秒）
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // 创建反向滑动音效 - 下降的滑音
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            // 从高频滑向低频
            const frequency = 1500 - 1200 * t;
            // 渐变音量
            const volume = 0.6 * (1 - Math.pow(t / duration, 2));
            // 添加一些噪声来模拟摩擦声
            const noise = (Math.random() * 2 - 1) * 0.2;
            data[i] = volume * (Math.sin(frequency * t * Math.PI * 2) * 0.8 + noise * 0.2);
        }

        this.soundBuffers['reverseSlide'] = buffer;
    }

    /**
     * 播放滑动音效
     * @param {boolean} isForward - 是否是顺向滑动
     * @param {number} intensity - 滑动强度 (0-1)
     */
    playSlideSound(isForward, intensity = 1.0) {
        if (!this.audioContext || this.muted) return;

        // 检查AudioContext状态，如果是closed则不继续
        if (this.audioContext.state === 'closed') {
            logger.warn('AudioContext已关闭，无法播放滑动音效');
            return;
        }

        // 确保AudioContext已经处于running状态
        if (this.audioContext.state === 'suspended') {
            // 尝试恢复AudioContext
            this.audioContext.resume().catch(err => {
                logger.warn('恢复AudioContext失败:', err);
                return; // 如果无法恢复，则不继续尝试播放
            });
        }

        const soundName = isForward ? 'forwardSlide' : 'reverseSlide';
        const buffer = this.soundBuffers[soundName];
        if (!buffer) return;

        // 创建音源和增益节点
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;

        // 根据滑动强度调整音量
        const volume = Math.min(Math.max(intensity, 0), 1) * this.soundVolume;
        gainNode.gain.value = volume;

        // 连接节点
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // 播放音效
        source.start(0);
    }

    /**
     * 加载外部音效文件
     */
    async loadExternalSounds() {
        const soundFiles = {
            // 'collect': '/assets/audio/collect.mp3',
            // 'powerup': '/assets/audio/powerup.mp3',
            // 可以在这里添加更多音效文件
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            try {
                const audio = new Audio();
                audio.src = path;
                audio.volume = this.soundVolume;

                // 等待音频加载完成
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', reject);
                    // 5秒超时
                    setTimeout(reject, 5000);
                });

                this.sounds[name] = audio;
                logger.debug(`Sound ${name} loaded successfully`);
            } catch (error) {
                logger.warn(`Failed to load sound ${name}:`, error);
            }
        }
    }

    /**
     * 播放指定的音效
     * @param {string} soundName - 音效名称
     */
    async playSound(soundName) {
        if (this.muted) return;

        // 记录开始尝试播放的时间
        logger.debug(`Attempting to play sound: ${soundName}`);

        // 确保AudioContext已经处于running状态
        if (this.audioContext && this.audioContext.state === 'suspended') {
            // 尝试恢复AudioContext
            await this.audioContext.resume();
        }

        const sound = this.sounds[soundName];
        if (sound) {
            try {
                // 重置音效播放位置
                sound.currentTime = 0;
                // 确保音量正确
                sound.volume = this.soundVolume;

                const playPromise = sound.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        logger.warn(`Failed to play sound ${soundName}:`, error);
                        // 如果外部音效播放失败，尝试播放合成音效
                        this.playFallbackSound(soundName);
                    });
                }
            } catch (error) {
                logger.warn(`Error playing sound ${soundName}:`, error);
                // 如果出现错误，尝试播放合成音效
                this.playFallbackSound(soundName);
            }
        } else {
            // 直接尝试播放合成音效
            this.playFallbackSound(soundName);
        }
    }

    /**
     * 播放合成的备选音效
     * @private
     */
    playFallbackSound(soundName) {
        if (!this.audioContext || this.muted) return;

        // 检查AudioContext状态，如果是closed则不继续
        if (this.audioContext.state === 'closed') {
            logger.warn('AudioContext已关闭，无法播放备选音效');
            return;
        }

        if (this.soundBuffers[soundName]) {
            try {
                // 确保AudioContext已经处于running状态
                if (this.audioContext.state === 'suspended') {
                    // 尝试恢复AudioContext
                    this.audioContext.resume().catch(err => {
                        logger.warn('恢复AudioContext失败:', err);
                        return; // 如果无法恢复，则不继续尝试播放
                    });
                }

                const source = this.audioContext.createBufferSource();
                source.buffer = this.soundBuffers[soundName];

                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = this.soundVolume;

                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                source.start(0);
                logger.debug(`Playing synthesized sound: ${soundName}`);
            } catch (error) {
                logger.warn(`Failed to play synthesized sound ${soundName}:`, error);
            }
        } else {
            logger.warn(`No fallback sound available for ${soundName}`);
        }
    }

    /**
     * 设置音效音量
     * @param {number} volume - 音量值 (0.0 到 1.0)
     */
    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        // 更新所有已加载的音效的音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.soundVolume;
        });
    }

    /**
     * 静音/取消静音所有音效
     */
    toggleMute() {
        this.muted = !this.muted;

        // 更新 HTML Audio 标签音效
        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.muted = this.muted;
        });

        // 处理背景音乐的静音
        if (this.bgMusicGainNode) {
            if (this.muted) {
                // 保存当前音量，然后设为0
                this._savedBackgroundMusicVolume = this._savedBackgroundMusicVolume || this.bgMusicGainNode.gain.value;
                this.bgMusicGainNode.gain.value = 0;
            } else {
                // 恢复到保存的音量
                const volumeToRestore = this._savedBackgroundMusicVolume !== undefined ?
                    this._savedBackgroundMusicVolume : 1.0;
                this.bgMusicGainNode.gain.value = volumeToRestore;
            }
        } else if (this.audioContext && this.muted) {
            // 如果静音时增益节点不存在，确保记录当前音量设置
            this._savedBackgroundMusicVolume = this._savedBackgroundMusicVolume || 1.0;
        }

        return this.muted;
    }

    /**
     * 加载背景音乐
     * @returns {Promise<void>}
     * @throws {Error} 当加载或解码失败时抛出错误
     */
    async loadBackgroundMusic() {
        try {
            // 如果AudioContext不可用，则不尝试加载
            if (!this.audioContext) {
                logger.warn('AudioContext不可用，无法加载背景音乐');
                return;
            }

            // 如果已经加载过背景音乐，直接返回
            if (this.backgroundMusic) {
                return;
            }

            // 加载音频文件
            const response = await fetch('/assets/audio/bg.mp3');
            if (!response.ok) {
                throw new Error(`加载背景音乐失败: HTTP ${response.status} - ${response.statusText}`);
            }

            // 获取音频数据并解码
            const arrayBuffer = await response.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('背景音乐文件数据为空');
            }

            this.backgroundMusic = await this.audioContext.decodeAudioData(arrayBuffer);

            // 验证解码后的音频数据
            if (!this.backgroundMusic || this.backgroundMusic.length === 0) {
                throw new Error('背景音乐解码后数据无效');
            }

            logger.debug('背景音乐加载完成', {
                duration: this.backgroundMusic.duration,
                numberOfChannels: this.backgroundMusic.numberOfChannels,
                sampleRate: this.backgroundMusic.sampleRate
            });
        } catch (error) {
            logger.error('加载背景音乐失败:', error);
            this.backgroundMusic = null;
            throw error; // 向上传播错误，让调用者决定如何处理
        }
    }

    /**
     * 渐变设置背景音乐音量
     * @param {number} targetVolume - 目标音量 (0-1)
     * @param {number} duration - 渐变持续时间(毫秒)
     * @param {number} steps - 渐变步数
     * @param {boolean} saveVolume - 是否保存目标音量，默认为true
     * @returns {Promise} 渐变完成的Promise
     */
    fadeBackgroundMusicVolume(targetVolume, duration = AUDIO_CONSTANTS.FADE_TRANSITION.DURATION, steps = AUDIO_CONSTANTS.FADE_TRANSITION.STEPS, saveVolume = true) {
        // 如果没有背景音乐或增益节点，直接返回
        if (!this.bgMusicGainNode) {
            logger.warn('无法执行音量渐变：增益节点不存在');
            return Promise.resolve();
        }

        // 清除之前的渐变定时器
        if (this._fadeTimeout) {
            clearTimeout(this._fadeTimeout);
            this._fadeTimeout = null;
        }

        // 只有当需要保存音量且目标音量大于0时才保存
        if (saveVolume && targetVolume > 0) {
            this._savedBackgroundMusicVolume = targetVolume;
            logger.debug('[音量渐变] 保存目标音量:', targetVolume);
        } else if (!saveVolume) {
            logger.debug('[音量渐变] 不保存目标音量:', targetVolume);
        }

        return new Promise((resolve) => {
            const startVolume = this.bgMusicGainNode.gain.value;
            logger.debug('[音量渐变] 开始音量:', startVolume, '目标音量:', targetVolume);

            // 如果当前音量已经接近目标音量，直接设置并返回
            if (Math.abs(startVolume - targetVolume) < 0.01) {
                this.bgMusicGainNode.gain.value = targetVolume;
                logger.debug('[音量渐变] 音量已经接近目标值，直接设置为:', targetVolume);
                resolve();
                return;
            }

            const volumeDiff = targetVolume - startVolume;
            const stepDuration = duration / steps;
            let currentStep = 0;

            const fadeStep = () => {
                currentStep++;
                const progress = currentStep / steps;
                const currentVolume = startVolume + (volumeDiff * progress);

                // 直接设置音量值
                this.bgMusicGainNode.gain.value = currentVolume;
                logger.debug('[音量渐变] 当前步骤:', currentStep, '当前音量:', currentVolume);

                if (currentStep < steps) {
                    this._fadeTimeout = setTimeout(fadeStep, stepDuration);
                } else {
                    // 最后一步，确保音量精确设置为目标值
                    this.bgMusicGainNode.gain.value = targetVolume;
                    logger.debug('[音量渐变] 完成，最终音量:', this.bgMusicGainNode.gain.value);
                    this._fadeTimeout = null;
                    resolve();
                }
            };

            fadeStep();
        });
    }

    /**
     * 停止背景音乐
     * @param {boolean} fadeOut - 是否使用淡出效果
     */
    async stopBackgroundMusic(fadeOut = true) {
        try {
            // 如果需要淡出,先执行淡出
            if (fadeOut && this.bgMusicGainNode) {
                // 不保存当前音量，音量应该从设置中获取
                logger.debug('停止背景音乐，执行淡出效果');

                // 使用fadeBackgroundMusicVolume方法，但不保存音量值
                await this.fadeBackgroundMusicVolume(0, 500, 10, false);
            }

            // 停止当前正在播放的音源
            if (this.backgroundMusicSource) {
                try {
                    this.backgroundMusicSource.stop();
                } catch (e) {
                    // 忽略已经停止的错误
                    logger.warn('停止背景音乐时出错:', e);
                }
                this.backgroundMusicSource = null;
            }
        } catch (error) {
            logger.warn('停止背景音乐时出错:', error);
        }
    }

    /**
     * 播放背景音乐
     * @param {boolean} fadeIn - 是否使用淡入效果
     */
    async playBackgroundMusic(fadeIn = true) {
        try {
            // 确保完整初始化已完成
            if (!this._delayedInitComplete) {
                await this.initializeAudio();
            }

            // 检查音频上下文和背景音乐
            if (!this.audioContext || !this.backgroundMusic) {
                logger.warn('音频上下文或背景音乐不可用，无法播放');
                return;
            }

            // 如果之前已经在播放，先停止
            await this.stopBackgroundMusic(false); // 不使用淡出效果

            // 创建新的音频源
            this.backgroundMusicSource = this.audioContext.createBufferSource();
            this.backgroundMusicSource.buffer = this.backgroundMusic;
            this.backgroundMusicSource.loop = true;

            // 创建或重用增益节点
            if (!this.bgMusicGainNode) {
                this.bgMusicGainNode = this.audioContext.createGain();
                this.bgMusicGainNode.connect(this.audioContext.destination);
            }

            // 直接从设置中获取音量值
            let baseVolume = 1.0; // 默认音量
            const settingsKey = 'jumpOrbits_audioSettings';
            try {
                const savedSettings = localStorage.getItem(settingsKey);
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    if (settings.musicVolume !== undefined) {
                        baseVolume = settings.musicVolume;
                        logger.debug('[播放背景音乐] 使用设置面板的原始音量:', baseVolume);
                    }
                }
            } catch (e) {
                logger.warn('[播放背景音乐] 读取设置面板音量失败:', e);
                // 如果读取失败，使用保存的音量值
                baseVolume = this._savedBackgroundMusicVolume !== undefined ?
                    this._savedBackgroundMusicVolume : 1.0;
            }

            // 保存基础音量值（未修改的原始值）
            this._savedBackgroundMusicVolume = baseVolume;

            // 根据当前系统类型计算实际音量
            const actualVolume = this._audioSystemInfo.systemType === 'advanced' ?
                baseVolume * this._audioSystemInfo.volumeModifier : baseVolume;

            logger.debug('重新播放背景音乐，音量计算:', {
                baseVolume: baseVolume,
                systemType: this._audioSystemInfo.systemType,
                volumeModifier: this._audioSystemInfo.volumeModifier,
                actualVolume: actualVolume
            });

            // 如果需要淡入，先将音量设为0
            if (fadeIn) {
                this.bgMusicGainNode.gain.value = 0;
            } else {
                this.bgMusicGainNode.gain.value = this.muted ? 0 : actualVolume;
            }

            // 连接音频节点
            this.backgroundMusicSource.connect(this.bgMusicGainNode);

            // 确保音频上下文是运行状态
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 开始播放
            this.backgroundMusicSource.start(0);

            // 如果需要淡入，渐变到实际音量
            if (fadeIn && this.bgMusicGainNode) {
                await this.fadeBackgroundMusicVolume(actualVolume);
            }
        } catch (error) {
            logger.error('播放背景音乐时出错:', error);
        }
    }

    /**
     * 暂停背景音乐
     */
    async pauseBackgroundMusic() {
        if (this.backgroundMusicSource) {
            try {
                // 先将音量设为0，实现立即静音效果
                if (this.bgMusicGainNode) {
                    this.bgMusicGainNode.gain.value = 0;
                }

                // 记录当前时间点，以便恢复时从相同位置继续播放
                this._musicPauseTime = this.audioContext.currentTime;

                // 暂停音频上下文
                if (this.audioContext && this.audioContext.state === 'running') {
                    await this.audioContext.suspend();
                }

                // 停止当前音源
                this.backgroundMusicSource.stop();
                this.backgroundMusicSource = null;

                logger.debug('背景音乐已暂停');
            } catch (e) {
                logger.warn('暂停背景音乐失败:', e);
            }
        }
    }

    /**
     * 恢复播放背景音乐
     */
    async resumeBackgroundMusic() {
        // 检查是否有背景音乐和音频上下文
        if (!this.backgroundMusic || !this.audioContext) {
            return;
        }

        // 如果音源不存在，可能需要重新创建
        if (!this.backgroundMusicSource) {
            await this.playBackgroundMusic();
            return;
        }

        try {
            // 恢复音频上下文
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 直接从设置中获取音量值
            let baseVolume = 1.0; // 默认音量
            const settingsKey = 'jumpOrbits_audioSettings';
            try {
                const savedSettings = localStorage.getItem(settingsKey);
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    if (settings.musicVolume !== undefined) {
                        baseVolume = settings.musicVolume;
                        logger.debug('[恢复背景音乐] 使用设置面板的原始音量:', baseVolume);
                    }
                }
            } catch (e) {
                logger.warn('[恢复背景音乐] 读取设置面板音量失败:', e);
                // 如果读取失败，使用保存的音量值
                baseVolume = this._savedBackgroundMusicVolume !== undefined ?
                    this._savedBackgroundMusicVolume : 1.0;
            }

            // 根据当前系统类型计算实际音量
            const actualVolume = this._audioSystemInfo.systemType === 'advanced' ?
                baseVolume * this._audioSystemInfo.volumeModifier : baseVolume;

            logger.debug('恢复背景音乐，音量计算:', {
                baseVolume: baseVolume,
                systemType: this._audioSystemInfo.systemType,
                volumeModifier: this._audioSystemInfo.volumeModifier,
                actualVolume: actualVolume
            });

            // 恢复音量
            if (this.bgMusicGainNode) {
                this.bgMusicGainNode.gain.value = this.muted ? 0 : actualVolume;
            }
        } catch (e) {
            logger.warn('恢复背景音乐失败:', e);
            // 如果恢复失败，尝试重新播放
            await this.playBackgroundMusic();
        }
    }

    /**
     * 设置背景音乐音量
     * @param {number} volume - 音量值 (0.0 到 1.0)
     */
    setBackgroundMusicVolume(volume) {
        // 确保音量在有效范围内
        const normalizedVolume = Math.max(0, Math.min(1, volume));

        // 保存音量设置，以便在创建或恢复增益节点时使用
        this._savedBackgroundMusicVolume = normalizedVolume;

        // 更新背景音乐音量
        if (this.bgMusicGainNode) {
            // 如果增益节点存在，直接设置音量
            this.bgMusicGainNode.gain.value = this.muted ? 0 : normalizedVolume;
            logger.debug(`背景音乐音量已设置为: ${normalizedVolume}`);
        } else if (this.audioContext) {
            // 如果增益节点不存在但有音频上下文，创建一个新的增益节点
            try {
                logger.debug('背景音乐增益节点不存在，正在创建...');
                this.bgMusicGainNode = this.audioContext.createGain();
                this.bgMusicGainNode.gain.value = this.muted ? 0 : normalizedVolume;
                this.bgMusicGainNode.connect(this.audioContext.destination);

                // 如果背景音乐源已经存在，将其连接到新的增益节点
                if (this.backgroundMusicSource) {
                    // 先断开旧连接，再连接到新节点
                    try {
                        this.backgroundMusicSource.disconnect();
                    } catch (disconnectErr) {
                        // 忽略可能的"未连接"错误
                    }

                    // 连接到新的增益节点
                    this.backgroundMusicSource.connect(this.bgMusicGainNode);
                    logger.debug('已将现有背景音乐重新连接到新的增益节点');
                }

                logger.debug(`已创建背景音乐增益节点并设置音量为: ${normalizedVolume}`);
            } catch (e) {
                logger.warn('创建背景音乐增益节点失败:', e);
            }
        } else {
            logger.warn('音频上下文不可用，无法创建背景音乐增益节点');
        }
    }

    // 修改原有setVolume方法，确保它也调用setBackgroundMusicVolume
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));

        // 更新背景音乐音量 - 直接使用用户设置的音量，不再乘以配置中的音量
        this.setBackgroundMusicVolume(this.volume);

        // 更新音效音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    async loadGameOverSound() {
        try {
            // 先创建合成音效作为备选
            if (this.audioContext) {
                this.createGameOverSound();
                this.soundBuffers['fail'] = this.soundBuffers['gameOver'];
            }

            // 确保使用window.Audio
            if (typeof window.Audio !== 'function') {
                throw new Error('Audio API not supported');
            }

            logger.debug('开始加载游戏结束音效...');
            const failSound = new window.Audio();
            failSound.src = '/assets/audio/fail.mp3';
            failSound.volume = this.soundVolume;

            // 添加事件监听器用于调试
            failSound.addEventListener('loadstart', () => { logger.debug('游戏结束音效开始加载') });
            failSound.addEventListener('loadeddata', () => { logger.debug('游戏结束音效数据加载完成') });
            failSound.addEventListener('error', (e) => {
                logger.error('游戏结束音效加载错误:', {
                    code: e.target.error?.code,
                    message: e.target.error?.message,
                    src: e.target.src
                });
            });

            // 等待音效加载完成
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    logger.warn('游戏结束音效加载超时，使用合成音效');
                    reject(new Error('Loading timeout'));
                }, 5000);

                failSound.addEventListener('canplaythrough', () => {
                    clearTimeout(timeout);
                    this.sounds['fail'] = failSound;
                    logger.debug('游戏结束音效加载完成');
                    resolve();
                }, { once: true });

                failSound.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(e);
                }, { once: true });

                failSound.load();
            });
        } catch (error) {
            logger.warn('加载游戏结束音效失败:', error);
            // 确保至少有合成音效可用
            if (this.audioContext && !this.soundBuffers['fail']) {
                this.createGameOverSound();
                this.soundBuffers['fail'] = this.soundBuffers['gameOver'];
            }
        }
    }

    /**
     * 加载清除音效
     */
    async loadClearSound() {
        try {
            // 确保使用window.Audio
            if (typeof window.Audio !== 'function') {
                throw new Error('Audio API not supported');
            }

            logger.debug('开始加载清除音效...');
            const clearSound = new window.Audio();
            clearSound.src = '/assets/audio/clear.mp3';
            clearSound.volume = this.soundVolume;

            // 添加事件监听器用于调试
            clearSound.addEventListener('loadstart', () => { logger.debug('清除音效开始加载') });
            clearSound.addEventListener('loadeddata', () => { logger.debug('清除音效数据加载完成') });
            clearSound.addEventListener('error', (e) => {
                logger.error('清除音效加载错误:', {
                    code: e.target.error?.code,
                    message: e.target.error?.message,
                    src: e.target.src
                });
            });

            // 等待音效加载完成
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    logger.warn('清除音效加载超时');
                    reject(new Error('Loading timeout'));
                }, 5000);

                clearSound.addEventListener('canplaythrough', () => {
                    clearTimeout(timeout);
                    this.sounds['clear'] = clearSound;
                    logger.debug('清除音效加载完成');
                    resolve();
                }, { once: true });

                clearSound.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(e);
                }, { once: true });

                clearSound.load();
            });
        } catch (error) {
            logger.warn('加载清除音效失败:', error);
            // 如果加载失败，使用特殊轨道音效作为备选
            if (this.audioContext) {
                this.soundBuffers['clear'] = this.soundBuffers['specialTrack'];
            }
        }
    }

    // ===== 基础Audio类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 加载音效（基础Audio类方法）
     * @param {string} id - 音效ID
     * @param {string} url - 音效URL
     * @returns {Promise} 加载完成的Promise
     */
    loadSound(id, url) {
        const audio = new window.Audio();
        audio.src = url;
        this.sounds[id] = audio;
        return new Promise((resolve, reject) => {
            audio.oncanplaythrough = resolve;
            audio.onerror = reject;
        });
    }

    /**
     * 停止音效（基础Audio类方法）
     * @param {string} id - 音效ID
     */
    stopSound(id) {
        const sound = this.sounds[id];
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }

    /**
     * 设置音量（基础Audio类方法）
     * @param {number} volume - 音量值 (0.0 到 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    /**
     * 播放音效（基础Audio类方法）
     * 这是基础Audio类的原始playSound实现，作为备用方法
     * @param {string} id - 音效ID
     * @param {Object} options - 播放选项
     */
    playSoundBasic(id, options = {}) {
        if (this.muted) return;

        const sound = this.sounds[id];
        if (!sound) return;

        const volume = options.volume !== undefined ? options.volume : this.volume;
        sound.volume = volume;

        if (options.loop !== undefined) {
            sound.loop = options.loop;
        }

        // 如果需要重播，先重置
        if (sound.currentTime > 0) {
            sound.currentTime = 0;
        }

        sound.play().catch(err => {
            logger.warn(`Error playing sound ${id}:`, err);
        });
    }

    /**
     * 静音/取消静音（基础Audio类方法，已被重写但保留基础逻辑）
     * 注意：WebAudio类已经重写了toggleMute方法，这里保留基础实现作为参考
     */
    toggleMuteBasic() {
        this.muted = !this.muted;
        Object.values(this.sounds).forEach(sound => {
            sound.muted = this.muted;
        });
        return this.muted;
    }
} 