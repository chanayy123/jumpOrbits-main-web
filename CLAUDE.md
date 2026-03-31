# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 提供在此代码库中工作的指导。

## 项目概览

**指尖跳跳 (Jump Orbits)** - 一款基于节奏的休闲游戏，玩家控制星球在同心轨道间跳跃，同时避开障碍物。项目包含多个平台实现：

- **Web (Three.js)**: `platforms/web/` - 使用 Three.js 的原始实现
- **Phaser 3 (TypeScript)**: `platforms/phaser/` - 使用 Phaser 3 引擎的增强版本
- **微信小游戏**: `platforms/wechat/` - 微信小游戏适配版本

## 平台特定命令

### Phaser 3 TypeScript 版本（推荐）
```bash
# 进入 Phaser 版本目录
cd platforms/phaser

# 开发
npm install
npm run dev          # Vite 开发服务器，访问 http://localhost:3000
npm run build        # 生产环境构建
npm run preview      # 预览生产构建
npm run type-check   # TypeScript 类型检查
```

### Web 版本（Three.js）
```bash
# 从项目根目录
npm install
npm run dev          # Live 服务器，访问 http://localhost:8080
npm run dev:web      # 同上
npm run debug        # 详细调试模式
npm run debug:custom # 自定义调试服务器
```

## 架构概览

### 核心系统（Phaser 版本）

**游戏管理器 (GameManager)** (`platforms/phaser/src/core/index.ts:16`)
- 单例模式的游戏状态管理
- 处理分数持久化（localStorage）
- 管理游戏状态转换（加载 → 菜单 → 游戏中 → 暂停 → 游戏结束）

**资源管理器 (AssetManager)** (`platforms/phaser/src/core/index.ts:170`)
- 资源加载和缓存
- 场景的资源集中管理

**输入管理器 (InputManager)** (`platforms/phaser/src/core/index.ts:198`)
- 手势识别和输入处理
- 触摸/鼠标事件标准化
- 与手势管理器集成实现滑动物理效果

### 场景架构（Phaser）

- **启动场景 (BootScene)**: 资源加载和初始化
- **游戏场景 (GameScene)**: 主要游戏场景（首先作为背景启动）
- **菜单场景 (MenuScene)**: 主菜单界面
- **UI场景 (UIScene)**: HUD 和 UI 覆盖层
- **游戏结束场景 (GameOverScene)**: 游戏结束画面和重新开始流程

### 关键游戏对象

- **玩家 (Player)** (`platforms/phaser/src/objects/Player.ts`): 带有跳跃机制的星球
- **轨道 (Track)** (`platforms/phaser/src/objects/Track.ts`): 同心轨道
- **障碍物 (Obstacle)** (`platforms/phaser/src/objects/Obstacle.ts`): 轨道上的移动障碍物
- **粒子系统 (ParticleSystem)** (`platforms/phaser/src/objects/ParticleSystem.ts`): 视觉效果

### 配置系统

**游戏配置 (GameConfig)** (`platforms/phaser/src/utils/index.ts:397`)
- 与 web 版本匹配的集中游戏配置
- 包含物理、视觉、音频和难度设置
- 支持渐变的主题颜色定义

**关键配置部分：**
- 障碍物阶段和难度缩放
- 轨道间距和视觉属性
- 跳跃惯性和手势灵敏度
- 音频音量和淡入淡出设置
- 无障碍视觉舒适模式

### 类型系统

**全面的 TypeScript 定义** (`platforms/phaser/src/types/index.ts`):
- 游戏状态枚举和接口
- 支持 HSL 颜色的轨道/障碍物数据结构
- 输入事件类型和手势数据
- 主题系统接口
- 性能监控类型

## 开发指南

### 添加新功能

1. **新游戏对象**: 在 `src/objects/` 中创建并通过 `src/objects/index.ts` 导出
2. **新场景**: 在 `src/scenes/` 中创建并在 `main.ts:61` 中注册
3. **新 UI 组件**: 在 `src/ui/` 中创建并通过 `src/ui/index.ts` 导出
4. **新主题**: 添加到 `src/themes/` 遵循现有模式

### 代码规范

- **路径别名**: 使用 `@/` 前缀实现清晰导入
- **类型安全**: 所有游戏对象使用严格 TypeScript
- **事件系统**: 使用 Phaser.Events.EventEmitter 实现松耦合
- **单例模式**: GameManager、AssetManager 遵循单例模式

### 性能考虑

- **对象池**: 使用 `GameObjectPool` 和 `ObjectPool` 实现高效对象重用
- **渲染优化**: 使用 utils 中的 `RenderOptimizer` 进行批处理
- **资源管理**: 在 BootScene 中预加载资源
- **内存管理**: 在场景关闭时进行适当清理

### 构建系统

- **Vite**: 带热重载的快速开发服务器
- **TypeScript**: 严格类型检查（可通过 tsconfig 放宽）
- **路径映射**: `@/` 别名在 tsconfig 和 vite.config 中都配置
- **源映射**: 启用调试支持

## 测试和调试

- **浏览器开发工具**: 游戏实例可作为 `window.game` 访问
- **游戏管理器**: 可作为 `window.gameManager` 访问以检查状态
- **调试标志**: 通过 GameConfig.DEV.DEBUG_MODE 启用
- **性能统计**: 内置 FPS 和内存跟踪

## 关键文件

- `platforms/phaser/src/main.ts` - 游戏初始化和配置
- `platforms/phaser/src/types/index.ts` - 所有 TypeScript 接口和类型
- `platforms/phaser/src/utils/index.ts` - GameConfig 和实用函数
- `platforms/phaser/src/core/index.ts` - 核心游戏系统（GameManager 等）
- `platforms/web/js/main.js` - Web 版本入口点
- `package.json` - 根项目脚本和依赖
- 代码改完，没必要再执行npm run dev启动