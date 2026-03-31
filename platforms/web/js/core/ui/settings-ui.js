import logger from '../utils/logger.js';

export class SettingsUI {
    constructor(audio, audioManager = null, themeManager = null, game = null) {
        this.audio = audio;
        this.audioManager = audioManager;
        this.themeManager = themeManager;
        this.game = game;
        this.container = null;
        this.isVisible = false;
        this.overlay = null;
        this.STORAGE_KEY = 'jumpOrbits_audioSettings';
        this.settings = this.loadSettings();

        // Used by theme
        this.originalTheme = null;
        this.previewTimer = null;

        this.applySettings();
        this.createUI();
        this.registerEvents();
        
        if (this.audioManager) {
            this.updateAudioSystemUIState();
        }
    }

    // Helper for creating DOM elements
    createElement(tag, options = {}, children = []) {
        const element = document.createElement(tag);
        Object.keys(options).forEach(key => {
            if (key === 'className') element.className = options[key];
            else if (key === 'dataset') Object.assign(element.dataset, options[key]);
            else if (key === 'style') Object.assign(element.style, options[key]);
            else element[key] = options[key];
        });
        children.forEach(child => {
            if (typeof child === 'string') element.appendChild(document.createTextNode(child));
            else element.appendChild(child);
        });
        return element;
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            logger.warn('加载设置失败:', e);
        }
        return {
            musicVolume: 1.0, soundVolume: 0.6,
            visualComfort: true, highContrast: false, showFps: false
        };
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {}
    }

    applySettings() {
        if (this.audio) {
            if (this.audioManager && this.audioManager.setMusicVolume) {
                this.audioManager.setMusicVolume(this.settings.musicVolume);
            } else if (this.audio.setBackgroundMusicVolume) {
                this.audio.setBackgroundMusicVolume(this.settings.musicVolume);
            }
            this.audio.setSoundVolume(this.settings.soundVolume);
        }
        if (window.GAME_CONFIG) {
            if (window.GAME_CONFIG.VISUAL_COMFORT) {
                window.GAME_CONFIG.VISUAL_COMFORT.ENABLED = this.settings.visualComfort;
                window.GAME_CONFIG.VISUAL_COMFORT.HIGH_CONTRAST = this.settings.highContrast;
            }
            if (window.GAME_CONFIG.DEV) {
                window.GAME_CONFIG.DEV.SHOW_FPS = this.settings.showFps;
                if (window.game && window.game.performancePanel) {
                    window.game.performancePanel.setVisible(this.settings.showFps);
                }
            }
        }
    }

    createUI() {
        this.container = this.createElement('div', { className: 'settings-ui' });
        this.container.style.display = 'none';

        // 标签栏
        this.tabsHeader = this.createElement('div', { className: 'settings-tabs-header' });
        this.tabVisualBtn = this.createElement('button', { className: 'tab-btn active', textContent: '画面与主题' });
        this.tabAudioBtn = this.createElement('button', { className: 'tab-btn', textContent: '声音与系统' });
        
        this.tabsHeader.appendChild(this.tabVisualBtn);
        this.tabsHeader.appendChild(this.tabAudioBtn);
        this.container.appendChild(this.tabsHeader);

        // 内容区
        this.tabsContent = this.createElement('div', { className: 'settings-tabs-content' });
        
        // Tab 1: 画面与主题
        this.visualTab = this.createElement('div', { className: 'settings-tab active' });
        this.createVisualTabContent(this.visualTab);
        
        // Tab 2: 声音与系统
        this.audioTab = this.createElement('div', { className: 'settings-tab', style: { display: 'none' } });
        this.createAudioTabContent(this.audioTab);
        
        this.tabsContent.appendChild(this.visualTab);
        this.tabsContent.appendChild(this.audioTab);
        this.container.appendChild(this.tabsContent);

        // 关闭按钮
        const closeArea = this.createElement('div', { className: 'settings-footer' }, [
            this.createElement('button', { className: 'neo-button primary close-button', type: 'button', textContent: '关闭设置' })
        ]);
        this.container.appendChild(closeArea);

        document.body.appendChild(this.container);
        this.addStyles();
    }

    createVisualTabContent(parent) {
        // 主题选择区
        if (this.themeManager) {
            const themeSection = this.createElement('div', { className: 'settings-section' }, [
                this.createElement('h3', { textContent: '游戏主题' })
            ]);
            
            const themesContainer = this.createElement('div', { className: 'theme-options-container flex-wrap' });
            const themes = this.themeManager.getThemes();
            const currentTheme = this.themeManager.getCurrentTheme();

            Object.entries(themes).forEach(([themeId, theme]) => {
                const themeOption = this.createElement('div', { className: `theme-option ${theme === currentTheme ? 'selected' : ''}` });
                
                const themePreview = this.createElement('div', { className: 'theme-preview', dataset: { themeId } });
                
                const colorProperties = ['player', 'platform', 'obstacle', 'powerup'];
                colorProperties.forEach(prop => {
                    if (theme[prop]) {
                        themePreview.appendChild(this.createElement('div', { className: 'color-sample', style: { backgroundColor: theme[prop] } }));
                    }
                });
                if (theme.background) {
                    themePreview.appendChild(this.createElement('div', { className: 'color-sample bg-sample', style: { backgroundColor: theme.background } }));
                }
                
                themeOption.appendChild(themePreview);
                themeOption.appendChild(this.createElement('span', { className: 'theme-name', textContent: theme.name }));
                
                themeOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    themesContainer.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
                    themeOption.classList.add('selected');
                    this.themeManager.applyTheme(themeId);
                });
                
                themesContainer.appendChild(themeOption);
            });
            themeSection.appendChild(themesContainer);
            parent.appendChild(themeSection);
        }

        // 视觉舒适度等复选框
        const visualGroup = this.createElement('div', { className: 'settings-section' }, [
            this.createElement('h3', { textContent: '视觉与性能' })
        ]);

        this.visualComfortCheckbox = this.createElement('input', { type: 'checkbox', id: 'visual-comfort', checked: this.settings.visualComfort });
        visualGroup.appendChild(this.createCheckboxGroup(this.visualComfortCheckbox, '视觉舒适模式', '减少闪烁和脉动效果，适合长时间游戏'));

        this.highContrastCheckbox = this.createElement('input', { type: 'checkbox', id: 'high-contrast', checked: this.settings.highContrast });
        visualGroup.appendChild(this.createCheckboxGroup(this.highContrastCheckbox, '高对比度模式', '增强游戏元素的对比度，使障碍物更容易识别'));

        this.showFpsCheckbox = this.createElement('input', { type: 'checkbox', id: 'show-fps', checked: this.settings.showFps });
        visualGroup.appendChild(this.createCheckboxGroup(this.showFpsCheckbox, '显示性能面板', '显示FPS和其他性能指标'));

        parent.appendChild(visualGroup);
    }

    createAudioTabContent(parent) {
        // 基础音量
        const volumeSection = this.createElement('div', { className: 'settings-section' }, [
            this.createElement('h3', { textContent: '基础音量' })
        ]);
        
        // 音乐
        this.musicVolumeSlider = this.createElement('input', { type: 'range', min: '0', max: '1', step: '0.01', value: this.settings.musicVolume });
        const musicVal = this.createElement('span', { className: 'volume-value', textContent: Math.round(this.settings.musicVolume * 100) + '%' });
        const musicGroup = this.createElement('div', { className: 'slider-group' }, [
            this.createElement('label', { textContent: '背景音乐' }), this.musicVolumeSlider, musicVal
        ]);
        this.musicVolumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            this.settings.musicVolume = v;
            musicVal.textContent = Math.round(v * 100) + '%';
            if (this.audioManager && this.audioManager.setMusicVolume) this.audioManager.setMusicVolume(v);
            else if (this.audio) this.audio.setBackgroundMusicVolume(v);
            this.saveSettings();
        });
        
        // 音效
        this.soundVolumeSlider = this.createElement('input', { type: 'range', min: '0', max: '1', step: '0.01', value: this.settings.soundVolume });
        const soundVal = this.createElement('span', { className: 'volume-value', textContent: Math.round(this.settings.soundVolume * 100) + '%' });
        const soundGroup = this.createElement('div', { className: 'slider-group' }, [
            this.createElement('label', { textContent: '游戏音效' }), this.soundVolumeSlider, soundVal
        ]);
        this.soundVolumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            this.settings.soundVolume = v;
            soundVal.textContent = Math.round(v * 100) + '%';
            if (this.audio) this.audio.setSoundVolume(v);
            this.saveSettings();
        });
        
        volumeSection.appendChild(musicGroup);
        volumeSection.appendChild(soundGroup);
        parent.appendChild(volumeSection);

        // 高级系统
        const systemSection = this.createElement('div', { className: 'settings-section' }, [
            this.createElement('h3', { textContent: '高级音乐系统' })
        ]);

        this.unlockAudioButton = this.createElement('button', { className: 'neo-button secondary small margin-y', textContent: '解锁高级音乐系统' });
        this.unlockAudioButton.style.display = 'block';
        systemSection.appendChild(this.unlockAudioButton);

        const controlRow = this.createElement('div', { className: 'd-flex align-center margin-y', style: { justifyContent: 'space-between' } });

        const switchContainer = this.createElement('div', { className: 'd-flex align-center gap-2' });
        const switchLabel = this.createElement('label', { className: 'toggle-switch', style: { margin: 0 } });
        this.audioSystemSwitch = this.createElement('input', { type: 'checkbox' });
        switchLabel.appendChild(this.audioSystemSwitch);
        switchLabel.appendChild(this.createElement('span', { className: 'slider' }));
        
        switchContainer.appendChild(switchLabel);
        switchContainer.appendChild(this.createElement('span', { textContent: '启用变奏流音乐' }));
        
        this.audioStatusDisplay = this.createElement('div', { className: 'status-display', textContent: '当前状态加载中...' });
        
        controlRow.appendChild(switchContainer);
        controlRow.appendChild(this.audioStatusDisplay);

        systemSection.appendChild(controlRow);

        // 高级配置面板 (折叠)
        this.audioConfigPanel = this.createElement('div', { className: 'advanced-config', style: { display: 'none' } });
        
        // 变奏设置
        this.variationForm = this.createElement('form', { className: 'config-sub-form' });
        this.variationEnabled = this.createElement('input', { type: 'checkbox' });
        this.variationForm.appendChild(this.createCheckboxGroup(this.variationEnabled, '允许应用变奏', '自动为音乐添加丰富变化'));
        this.variationOnLoop = this.createElement('input', { type: 'checkbox' });
        this.variationForm.appendChild(this.createCheckboxGroup(this.variationOnLoop, '每次循环变更变奏', '轨道重置时更新'));
        
        this.variationForm.appendChild(this.createElement('h4', { textContent: '支持的变奏维度' }));
        const vTypes = [{id: 'keyShift', n: '调性'}, {id: 'tempoChange', n: '速度'}, {id: 'timbreChange', n: '音色'}, {id: 'octaveShift', n: '八度'}];
        vTypes.forEach(t => {
            const cb = this.createElement('input', { type: 'checkbox', dataset: { type: t.id } });
            this.variationForm.appendChild(this.createCheckboxGroup(cb, t.n));
        });
        this.variationForm.appendChild(this.createElement('button', { className: 'neo-button primary small mt-2', type: 'submit', textContent: '保存变奏参数' }));
        this.audioConfigPanel.appendChild(this.variationForm);

        // 播放策略
        this.playbackForm = this.createElement('form', { className: 'config-sub-form' });
        this.playbackForm.appendChild(this.createElement('h4', { textContent: '全局播放模式' }));
        
        this.playbackMode = this.createElement('select', { className: 'ui-input' }, [
            this.createElement('option', { value: 'loopCurrent', textContent: '单曲循环' }),
            this.createElement('option', { value: 'autoNext', textContent: '顺序播放' }),
            this.createElement('option', { value: 'smartMix', textContent: '智能混音' }),
            this.createElement('option', { value: 'categorySequence', textContent: '同分类连播' })
        ]);
        
        this.playbackForm.appendChild(this.createElement('div', { className: 'form-group' }, [
            this.createElement('label', { textContent: '策略选择:' }), this.playbackMode
        ]));

        this.categorySelectorContainer = this.createElement('div', { className: 'form-group', style: { display: 'none' } });
        this.categorySelector = this.createElement('select', { className: 'ui-input' });
        this.categorySelectorContainer.appendChild(this.createElement('label', { textContent: '音乐风格:' }));
        this.categorySelectorContainer.appendChild(this.categorySelector);
        this.playbackForm.appendChild(this.categorySelectorContainer);

        this.playbackMode.addEventListener('change', () => {
            this.categorySelectorContainer.style.display = this.playbackMode.value === 'categorySequence' ? 'flex' : 'none';
        });

        this.loopCount = this.createElement('input', { type: 'number', min: '1', max: '10', value: '2', className: 'ui-input w-20' });
        this.playbackForm.appendChild(this.createElement('div', { className: 'form-group' }, [
            this.createElement('label', { textContent: '循环次数:' }), this.loopCount
        ]));

        this.fadeTransition = this.createElement('input', { type: 'checkbox' });
        this.playbackForm.appendChild(this.createCheckboxGroup(this.fadeTransition, '启用淡入淡出过渡'));

        this.playbackForm.appendChild(this.createElement('button', { className: 'neo-button primary small mt-2', type: 'submit', textContent: '保存播放策略' }));
        this.audioConfigPanel.appendChild(this.playbackForm);

        // 测试模式区
        this.testingForm = this.createElement('form', { className: 'config-sub-form testing-mode-section' });
        this.testingForm.appendChild(this.createElement('h4', { textContent: '系统调试工具' }));
        this.testingEnabled = this.createElement('input', { type: 'checkbox' });
        this.autoUnlock = this.createElement('input', { type: 'checkbox' });
        this.forceAdvanced = this.createElement('input', { type: 'checkbox' });
        this.loadTestMelodies = this.createElement('input', { type: 'checkbox' });
        
        this.testingForm.appendChild(this.createCheckboxGroup(this.testingEnabled, '开启控制台测试模式'));
        this.testingForm.appendChild(this.createCheckboxGroup(this.autoUnlock, '无条件自动解锁'));
        this.testingForm.appendChild(this.createCheckboxGroup(this.forceAdvanced, '强制驻留高级版'));
        this.testingForm.appendChild(this.createCheckboxGroup(this.loadTestMelodies, '装载测试用预置简谱'));
        
        const qWrap = this.createElement('div', { className: 'flex-row gap-2 mt-2' }, [
            (this.testDefaultButton = this.createElement('button', { type: 'button', className: 'neo-button secondary small', textContent: '退回基础版' })),
            (this.testAdvancedButton = this.createElement('button', { type: 'button', className: 'neo-button secondary small', textContent: '进入高级版' }))
        ]);
        this.testingForm.appendChild(qWrap);
        this.testingForm.appendChild(this.createElement('button', { className: 'neo-button warning small mt-2', type: 'submit', textContent: '应用调试规则' }));
        this.audioConfigPanel.appendChild(this.testingForm);

        // 展开配置按钮
        this.configButton = this.createElement('button', { className: 'neo-button secondary small', textContent: '打开高级参数与测试面板' });
        systemSection.appendChild(this.configButton);
        systemSection.appendChild(this.audioConfigPanel);

        parent.appendChild(systemSection);
    }

    createCheckboxGroup(checkbox, labelText, desc = '') {
        const group = this.createElement('div', { className: 'checkbox-item' });
        const label = this.createElement('label', { className: 'd-flex align-center cursor-pointer' });
        label.appendChild(checkbox);
        label.appendChild(this.createElement('span', { className: 'checkbox-text margin-left', textContent: labelText }));
        group.appendChild(label);
        if (desc) {
            group.appendChild(this.createElement('div', { className: 'checkbox-desc', textContent: desc }));
        }
        return group;
    }

    addStyles() {
        if (document.getElementById('unified-settings-style')) return;
        const style = document.createElement('style');
        style.id = 'unified-settings-style';
        style.textContent = `
            .settings-ui {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 90%; max-width: 500px; max-height: 85vh; background: rgba(20, 20, 30, 0.95);
                border: 2px solid rgba(139, 139, 255, 0.5); border-radius: 12px;
                box-shadow: 0 0 30px rgba(0, 0, 0, 0.8); z-index: 2500; display: flex; flex-direction: column; overflow: hidden;
            }
            .settings-tabs-header { display: flex; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(139,139,255,0.3); }
            .tab-btn { flex: 1; padding: 15px; background: none; border: none; color: #888; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
            .tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
            .tab-btn.active { color: #8bf; border-bottom: 3px solid #8bf; background: rgba(139,139,255,0.1); }
            
            .settings-tabs-content { padding: 20px; overflow-y: auto; flex: 1; }
            .settings-section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .settings-section:last-child { border-bottom: none; }
            .settings-section h3 { margin-top: 0; margin-bottom: 20px; color: #ddd; border-left: 4px solid #8bf; padding-left: 10px; font-size: 18px; }
            .settings-section h4 { color: #aaa; font-size: 14px; margin-bottom: 10px; }
            
            .slider-group { margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
            .slider-group label { width: 90px; color: #bbb;}
            .slider-group input { flex: 1; }
            .volume-value { width: 45px; text-align: right; color: #8bf; }

            .checkbox-item { margin-bottom: 12px; }
            .checkbox-text { margin-left: 8px; color: #eee; }
            .checkbox-desc { margin: 4px 0 0 24px; font-size: 12px; color: #888; }
            
            .flex-wrap { display: flex; flex-wrap: wrap; gap: 10px; }
            .flex-row { display: flex; flex-direction: row; }
            .align-center { align-items: center; }
            .gap-2 { gap: 10px; }
            .mt-2 { margin-top: 15px; }
            .margin-y { margin: 15px 0; }
            .margin-left { margin-left: 8px; }
            .d-flex { display: flex; }
            .cursor-pointer { cursor: pointer; }
            .w-20 { width: 60px; }

            .theme-option { border: 2px solid transparent; border-radius: 8px; padding: 10px; cursor: pointer; text-align: center; background: rgba(255,255,255,0.05); transition: 0.3s; width: calc(50% - 5px); box-sizing: border-box; }
            .theme-option:hover { background: rgba(255,255,255,0.1); }
            .theme-option.selected { border-color: #fca; background: rgba(255,200,100,0.15); }
            .theme-preview { display: flex; gap: 4px; margin-bottom: 8px; justify-content: center; }
            .color-sample { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #555; }
            .theme-name { color: #eee; font-size: 14px; }
            
            .advanced-config { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid rgba(100, 100, 200, 0.2); }
            .config-sub-form { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); }
            .config-sub-form:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .form-group { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
            .form-group label { min-width: 80px; color: #bbb; }
            
            .settings-footer { padding: 15px; display: flex; justify-content: center; background: rgba(0,0,0,0.6); border-top: 1px solid rgba(255,255,255,0.1); }
            
            .ui-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); z-index: 2400; display: none; }
            .ui-input { background: rgba(0,0,0,0.5); color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 4px; outline: none; }
            .ui-input:focus { border-color: #8bf; }
            .status-display { color: #8bf; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    registerEvents() {
        this.container.addEventListener('click', e => e.stopPropagation());
        
        // Prevent form submissions from reloading page globally in container
        this.container.querySelectorAll('form').forEach(f => {
            f.addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); });
        });

        // Tab 切換
        this.tabVisualBtn.addEventListener('click', () => {
            this.tabVisualBtn.classList.add('active'); this.tabAudioBtn.classList.remove('active');
            this.visualTab.style.display = 'block'; this.audioTab.style.display = 'none';
            if (this.audio) this.audio.playSound('buttonClick');
        });
        
        this.tabAudioBtn.addEventListener('click', () => {
            this.tabAudioBtn.classList.add('active'); this.tabVisualBtn.classList.remove('active');
            this.audioTab.style.display = 'block'; this.visualTab.style.display = 'none';
            if (this.audio) this.audio.playSound('buttonClick');
        });

        // 基础视觉设置
        this.visualComfortCheckbox.addEventListener('change', e => {
            this.settings.visualComfort = e.target.checked;
            this.applySettings(); this.saveSettings();
            if (this.audio) this.audio.playSound('buttonClick');
        });
        
        this.highContrastCheckbox.addEventListener('change', e => {
            this.settings.highContrast = e.target.checked;
            this.applySettings(); this.saveSettings();
            if (this.audio) this.audio.playSound('buttonClick');
        });
        
        this.showFpsCheckbox.addEventListener('change', e => {
            this.settings.showFps = e.target.checked;
            this.applySettings(); this.saveSettings();
            if (this.audio) this.audio.playSound('buttonClick');
        });

        // AudioManager 逻辑挂载
        if (this.audioManager) {
            this.unlockAudioButton.addEventListener('click', e => {
                e.stopPropagation();
                if (this.audio) this.audio.playSound('buttonClick');
                if (this.audioManager.unlockAdvancedSystem()) {
                    alert('高级音乐系统解锁成功!');
                    this.updateAudioSystemUIState();
                }
            });

            this.audioSystemSwitch.addEventListener('change', e => {
                if (this.audio) this.audio.playSound('buttonClick');
                if (!this.audioManager.initialized) {
                    alert('音频管理器尚未初始化');
                    this.audioSystemSwitch.checked = !this.audioSystemSwitch.checked;
                    return;
                }
                const sys = e.target.checked ? this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED : this.audioManager.AUDIO_SYSTEM_TYPES.DEFAULT;
                this.audioManager.switchToSystem(sys);
                this.updateAudioSystemUIState();
            });

            this.configButton.addEventListener('click', e => {
                if (this.audio) this.audio.playSound('buttonClick');
                this.audioConfigPanel.style.display = this.audioConfigPanel.style.display === 'none' ? 'block' : 'none';
            });

            // 变奏表单
            this.variationForm.addEventListener('submit', e => {
                const m = this.audioManager.getAdvancedMusicPlayer();
                if (!m) return;
                const av = [];
                this.variationForm.querySelectorAll('input[dataset]').forEach(cb => { if(cb.checked && cb.dataset.type) av.push(cb.dataset.type); });
                m.configureVariation({ enabled: this.variationEnabled.checked, variationOnLoop: this.variationOnLoop.checked, activeVariations: av });
                alert('变奏系统参数已更新');
            });

            // 策略表单
            this.playbackForm.addEventListener('submit', e => {
                const m = this.audioManager.getAdvancedMusicPlayer();
                if (!m) return;
                const cfg = {
                    mode: this.playbackMode.value, loopCount: parseInt(this.loopCount.value), fadeTransition: this.fadeTransition.checked, transitionTime: 2000
                };
                if (cfg.mode === 'categorySequence') cfg.currentCategory = this.categorySelector.value;
                m.configurePlayback(cfg);
                if (cfg.mode === 'categorySequence' && cfg.currentCategory) m.playMelodyByCategory(cfg.currentCategory);
                alert('播放策略修改成功');
            });

            // 测试表单
            this.testingForm.addEventListener('submit', e => {
                this.audioManager.setTestingMode({
                    enabled: this.testingEnabled.checked,
                    autoUnlock: this.autoUnlock.checked,
                    forceAdvanced: this.forceAdvanced.checked,
                    testMelodies: this.loadTestMelodies.checked
                });
                this.updateAudioSystemUIState();
                alert('系统测试规则已覆盖');
            });

            this.testDefaultButton.addEventListener('click', () => { this.audioManager.switchToSystem(this.audioManager.AUDIO_SYSTEM_TYPES.DEFAULT); this.updateAudioSystemUIState(); });
            this.testAdvancedButton.addEventListener('click', () => {
                if (!this.audioManager.getUnlockState().isUnlocked) this.audioManager.unlockAdvancedSystem();
                this.audioManager.switchToSystem(this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED);
                this.updateAudioSystemUIState();
            });
        }

        // 关闭
        const closeBtn = this.container.querySelector('.close-button');
        if (closeBtn) closeBtn.addEventListener('click', () => {
             if (this.audio) this.audio.playSound('buttonClick');
             this.hide();
        });
    }

    updateAudioSystemUIState() {
        if (!this.audioManager || !this.audioManager.initialized) {
            this.unlockAudioButton.disabled = true; this.audioSystemSwitch.disabled = true; this.configButton.disabled = true;
            this.audioStatusDisplay.textContent = '音频正在加载中...'; return;
        }

        const unlockState = this.audioManager.getUnlockState();
        const activeSystem = this.audioManager.getActiveSystem();
        const testingMode = this.audioManager.getTestingMode();

        this.testingEnabled.checked = testingMode.enabled;
        this.autoUnlock.checked = testingMode.autoUnlock;
        this.forceAdvanced.checked = testingMode.forceAdvanced;
        this.loadTestMelodies.checked = testingMode.testMelodies;

        this.testDefaultButton.disabled = activeSystem === this.audioManager.AUDIO_SYSTEM_TYPES.DEFAULT;
        this.testAdvancedButton.disabled = activeSystem === this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED;

        this.unlockAudioButton.style.display = unlockState.isUnlocked ? 'none' : 'block';

        this.audioSystemSwitch.checked = activeSystem === this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED;
        this.audioSystemSwitch.disabled = !unlockState.isUnlocked && !testingMode.forceAdvanced;
        this.audioStatusDisplay.textContent = activeSystem === this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED ? '>> 当前使用: 高级音乐系统' : '>> 当前使用: 默认音频系统';

        this.configButton.disabled = !unlockState.isUnlocked && !testingMode.forceAdvanced && activeSystem !== this.audioManager.AUDIO_SYSTEM_TYPES.ADVANCED;

        const musicPlayer = this.audioManager.getAdvancedMusicPlayer();
        if (musicPlayer) {
            const vCfg = musicPlayer.getVariationConfig();
            if (vCfg) {
                this.variationEnabled.checked = vCfg.enabled; this.variationOnLoop.checked = vCfg.variationOnLoop;
                this.variationForm.querySelectorAll('input[dataset]').forEach(cb => { cb.checked = vCfg.activeVariations.includes(cb.dataset.type); });
            }
            const pCfg = musicPlayer.getPlaybackConfig();
            if (pCfg) {
                this.playbackMode.value = pCfg.mode; this.loopCount.value = pCfg.loopCount; this.fadeTransition.checked = pCfg.fadeTransition;
                this.categorySelectorContainer.style.display = pCfg.mode === 'categorySequence' ? 'flex' : 'none';
                if (pCfg.mode === 'categorySequence' && pCfg.currentCategory) this.categorySelector.value = pCfg.currentCategory;
            }
            // Populate category selector
            this.categorySelector.innerHTML = '';
            const cats = musicPlayer.getAvailableCategories();
            Object.entries(cats).forEach(([id, name]) => {
                const opt = document.createElement('option'); opt.value = id; opt.textContent = name;
                this.categorySelector.appendChild(opt);
            });
            if (pCfg && pCfg.currentCategory) this.categorySelector.value = pCfg.currentCategory;
        }
    }

    show() {
        if (this.audioManager) this.updateAudioSystemUIState();
        if (!this.overlay) {
            this.overlay = this.createElement('div', { className: 'ui-overlay' });
            document.body.appendChild(this.overlay);
            this.overlay.addEventListener('click', e => {
                e.stopPropagation();
                if (e.target === this.overlay) this.hide();
            });
        }
        this.overlay.style.display = 'block';
        this.container.style.display = 'flex';
        this.isVisible = true;

        if (this.themeManager) this.originalTheme = Object.keys(this.themeManager.themes).find(id => this.themeManager.themes[id] === this.themeManager.getCurrentTheme());
    }

    hide() {
        this.container.style.display = 'none';
        if (this.overlay) this.overlay.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide(); else this.show();
        return this.isVisible;
    }
}