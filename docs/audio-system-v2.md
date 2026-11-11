# 音效系统 v2：主题 × 昼夜氛围（设计 + 研究原型）

> 分支 `hark/audio-system-v2-20261111`｜日期 2026-11-11｜状态：研究原型，默认关闭（`?audio=v2` 开启）
> 参考：Saltline 的音频做法（分层配方 + 种子随机、声部池、母线、合成混响、时间片烘焙、分层音乐）。**只借鉴方法，代码与音色参数全部原创**（Saltline 未声明许可证）。
> 标注约定：**【实测】** = 在本沙盒里跑出来的数；**【文档】** = 微信官方文档原文；**【估计】** = 推算或经验值，需真机复核。没有真机，**iPhone 13 / 安卓均未测试**。

---

## 0. 一页结论

1. 现在的声音“够用但是平”：所有音效直连扬声器，没有母线、没有限幅、没有并发上限；跳跃音每次完全一样；声音和主题、时间毫无关系；`bg.mp3` 一个文件就占了 4MB 主包的 1/3。
2. v2 的核心是一个 **AudioDirector**：4 条母线 + 声部池 + 一个“快照”（主题 × 昼夜）决定整体听感；跳跃音随连击在音阶上“走”，音乐随连击一层层加进来；环境底按主题和昼夜切换。
3. **微信小游戏的 WebAudioContext 没有 ConvolverNode**【文档】，所以混响改用 DelayNode + 滤波器搭的 FDN（反馈延迟网络），原型已经只用微信列出的节点。
4. 全部声音运行时合成：代码 **压缩后约 26KB（gzip 约 10KB）**【实测】，可以替代 `bg.mp3 + fail.mp3 + clear.mp3` 共 **1.46MB**；代价是运行时内存约 **3MB**（float32 缓冲）【实测】，和启动时约 **10–50ms** 的同步合成【实测，沙盒 CPU】。
5. 试听：`index.html?show=audio`（试听台）或 `index.html?audio=v2&daypart=night`（游戏内）；离线样本 `npm run audio:render`。

---

## 1. 现状审计（读代码得出）

### 1.1 仓库与线上版本的关系（先说明）
- 本仓库只有 `platforms/web`（Canvas 2D 实现，`game.js` 用 `getContext('2d')`；README 写的是 Three.js，与代码不符）。
- `CLAUDE.md` 提到的 `platforms/phaser`、`platforms/wechat` **不在仓库里**；唯一一次提交是 2026-03-31 的 “initial commit”。
- 结论：**线上微信小游戏的代码很可能在别处**，本仓库落后于线上版本。本文和原型基于这份 Web 代码，架构与配方可以直接搬，接线部分（`integrate.js`）需要在微信版里重写一遍。

### 1.2 现有结构

| 模块 | 体积 | 做什么 |
|---|---|---|
| `core/audio.js`（WebAudio 类） | 43.6KB | 启动后合成 8 个单层音效（跳跃、碰撞、升级、特殊轨道、按钮、结束、正/反滑动）；`fail.mp3`、`clear.mp3` 用 HTML Audio 播；`bg.mp3` fetch + decode 后循环播放 |
| `core/audioManager.js` | 35.9KB | 在“默认系统”和“高级系统”之间切换，管解锁、测试模式、暂停/恢复 |
| `core/music/*`（高级系统） | 72.6KB | 每次点击播放旋律的下一个音（振荡器直连 destination），带变奏系统 |
| 音频文件 | 1,461,207 B | `bg.mp3` 1,366,560 B、`fail.mp3` 79,484 B、`clear.mp3` 15,163 B（根目录 `assets/audio` 另有一份副本） |

### 1.3 触发点（`game.js` / `player.js`）

| 事件 | 代码位置 | 当前声音 |
|---|---|---|
| 跳跃成功 | `game.onPlayerJump()` → `playSound('jump')` + `handlePlayerClick()` | 400→4400Hz 正弦扫频 0.2s；高级系统再叠一个旋律音 |
| 滑动手势跳 | `player.performJump()` → `audio.playSlideSound()` | 正/反向扫频 |
| 落地 | `player.updateBasic()` → `trackSystem.onPlayerLand()` | **无声** |
| 特殊轨道清除 / 无清除 | `playSound('clear')` / `playSound('specialTrack')` | clear.mp3 / 双正弦 |
| 得分 | `addScore()` → `playSound('score')` | 默认系统里**没有 `score` 缓冲，实际无声**（推断自代码） |
| 碰撞 → 结束 | `checkCollision()` → `collision`；`gameOver()` → `fail` + 暂停 BGM | 两个声音在同一时刻叠加 |
| 暂停 | `playSound('pause')` | 同 `score`，**无对应缓冲** |
| 按钮 | 各 UI → `buttonClick` | 2kHz 短嘀 |
| 主题切换 | `themeManager.onThemeChange` | **与声音无关** |

### 1.4 主要问题
1. **没有混音结构**：每个声音 `source → gain → destination`，几个声音一叠就可能超过 0dBFS，手机外放会破音。没有压缩、没有软削波。
2. **没有并发与间隔控制**：快速连点时同一个音无限叠加；没有优先级，失败音可能被跳跃音盖住。
3. **重复疲劳**：跳跃音参数固定、无变体、无音高变化；噪声用 `Math.random()`，每次启动都不一样，也无法复现。
4. **氛围缺位**：5 个主题（星空 / 轻盈 / 赛博朋克 / 森林 / 日出）在视觉上差别很大，声音上完全一样；没有昼夜。
5. **包体**：`bg.mp3` 占 4MB 主包约 33%。
6. **小毛病**：每次播放都 `resume()`、每次点击都读 `localStorage`；`/assets/audio/...` 用的是绝对路径；两套系统都会创建 AudioContext。

---

## 2. 目标架构

```
 事件(jump/land/clear/fail/ui) ─► AudioDirector.play(name) ─► 声部池（上限/优先级/最小间隔/抢占）
                                                             │
   ┌──────────── sfx 母线 ─► sfxLP ───────────────┐          │
   │──────────── ui 母线（干声）──────────────────┤◄─────────┘
   │──────────── amb 母线 ◄─ 环境底双槽（交叉淡化）│
   │──────────── music 母线 ◄─ pad/pulse/arp/sparkle 分层增益
   │                                               ▼
   └─ send ─► 预延迟 ─► FDN 混响(4 条延迟线) ─► wet ─► master(-4.5dB) ─► masterLP ─► 压缩器 ─► tanh 软削波(天花板 -1dBFS) ─► 输出
```

### 2.1 母线

| 母线 | 内容 | 进混响 | 声部上限 | 说明 |
|---|---|---|---|---|
| sfx | 跳跃、气流、落地、连击、清除、失败 | 0.5 | 12 | 后面挂一个低通，昼夜/主题控制亮度 |
| ui | 按钮 | 0 | 4 | 干声，比 sfx 低 4dB，永远清楚 |
| amb | 环境底循环 | 0.15 | 2（双槽） | 切换时 2–8 秒交叉淡化 |
| music | 自适应音乐 | 0.7 | 10 | 每层一个增益节点，按连击淡入淡出 |

### 2.2 声部池规则（每个音色一行，见 `recipes.js` 的 `SOUND_DEFS`）

| 音色 | 同名上限 max | 优先级 pri | 最小间隔 | 变体 | 启动即合成 |
|---|---|---|---|---|---|
| jump | 4 | 3 | 60ms | 4 | ✔ |
| air（气流） | 2 | 1 | 80ms | 3 | ✔ |
| land | 3 | 2 | 50ms | 4 | ✔ |
| combo（每 5 连击） | 2 | 4 | 250ms | 2 | |
| clear | 1 | 5 | 300ms | 1 | |
| special | 1 | 4 | 300ms | 1 | |
| fail | 1 | 6 | 500ms | 1 | |
| ui | 2 | 2 | 40ms | 2 | ✔ |
| pad / bass / arp / bell（音乐用） | 6 / 2 / 4 / 2 | 1–2 | 0 | 1–2 | |

- **抢占**：同名超上限 → 停掉最老的那个；母线满 → 停掉“优先级最低、最老”的；如果被抢的优先级比新来的高，新来的直接丢弃（计入 `dropped`）。被抢的声部 **4ms 线性淡出** 再停，避免咔哒声。
- **失败最优先**（pri 6）：任何时候都能出声。

### 2.3 防疲劳规则（针对每秒 2–3 次的跳跃）
1. **变体轮换**：4 个预合成变体按顺序轮换，30% 概率跳过一个，避免听出规律。
2. **连击音高行走**：第 N 跳的音高 = 当前主题音阶的第 N 度，先一路上行，到 1.5 个八度后往回走（乒乓），**永远在主音以上 0–24 半音之间**（`check.mjs` 自动检查）。这既是奖励反馈，也让连续跳跃变成一段旋律（取代原“高级系统”的点击弹旋律）。
3. **细微随机**：有音高的音只做 ±10 音分（±0.6%）随机，保证在调上；无音高的（气流、落地）做 ±3.5% 音高、0–8% 音量随机。
4. **最小间隔**：同名音 60ms 内不重复触发（压力测试：1 秒 40 次跳跃，实际出声约 16 次）。
5. **密度压低**：2 秒内跳得越多，气流层最多压低 6dB；连击越高，跳跃本身越“融”进音乐里。
6. **失败时**整体低通瞬间压到 1.5kHz，0.6 秒后恢复，代替“再叠一个大声的失败音”。

### 2.4 快照：主题 × 昼夜
一个快照决定：主低通、sfx 低通、混响（衰减/阻尼/预延迟/湿度）、环境底选哪条、各母线电平、音乐速度、高光层密度。切换时所有参数用 `setTargetAtTime` 平滑过渡（主题 1.5 秒，昼夜 2.5 秒；跟随时钟自动切换时 8 秒）。

昼夜由本地时间决定：5–8 点清晨，8–17 白天，17–20 黄昏，其余夜晚。也可以 `&daypart=night` 强制。

| 昼夜 | 主低通 | 混响湿度 | 衰减倍数 | 速度 | 音乐 | 环境 | 高光密度 | 用哪条环境底 |
|---|---|---|---|---|---|---|---|---|
| 清晨 | 10kHz | +0.04 | ×1.1 | ×0.95 | −2dB | 0dB | 0.6 | 白天 |
| 白天 | 18kHz | +0 | ×1.0 | ×1.0 | 0dB | −2dB | 1.0 | 白天 |
| 黄昏 | 8kHz | +0.06 | ×1.2 | ×0.92 | −1dB | 0dB | 0.7 | 夜晚 |
| 夜晚 | 5.2kHz | +0.10 | ×1.35 | ×0.85 | −3dB | +1dB | 0.4 | 夜晚 |

设计意图：白天亮、近、节奏正常；夜晚暗、远（混响更湿更长）、慢、稀疏，更接近 ASMR 的“陪伴感”。

### 2.5 环境底（ambience beds）
每主题两条 8 秒无缝循环（首尾 0.5 秒等功率交叉淡化），22.05kHz 单声道，按需合成，旧的 3 秒后释放。

### 2.6 自适应音乐（连击驱动的 5 层）

| 层 | 何时加入 | 内容 |
|---|---|---|
| 环境底 bed | 一直 | 见 2.5 |
| 和声垫 pad | 开局 | 每小节一个三和弦（音阶内叠三度），根音按音阶度数 0–3–4–2 循环 4 小节 |
| 低音脉冲 pulse | 连击 ≥ 5 | 每小节第 1、3 拍 |
| 琶音 arp | 连击 ≥ 12 | 八分音符琶音，主题音色 |
| 高光 sparkle | 连击 ≥ 25 | 反拍上的随机钟声，密度受昼夜控制 |

失败时连击归零，pulse/arp/sparkle 在约 1.2 秒内淡出。音乐用 25ms 定时器 + 150ms 预排程，音符是“主音烘焙一次，用 playbackRate 移调”，所以音乐层几乎不占额外合成时间。

### 2.7 每个主题一个“空间”（混响）
微信没有 ConvolverNode，所以用 4 条延迟线（29.7/37.1/41.1/43.7ms）的 FDN：每条线自反馈 0.6g、交叉到下一条 0.4g（行和 = g < 1，保证稳定），g 按“衰减秒数内降 60dB”计算，反馈路径里串低通做高频阻尼。改空间只改增益和滤波器，不改延迟时间（改延迟时间会产生变调）。

---

## 3. 主题声音调色板

| 主题 | 调式 / 主音 | 跳跃音色 | 空间（混响） | 白天环境底 | 夜晚环境底 | 速度(BPM) | 和弦色彩 |
|---|---|---|---|---|---|---|---|
| 星空 starsky | D 大调五声 | 玻璃钟琴（非谐波分音，长尾） | 星空大厅：3.2s，阻尼 5.2kHz，湿 0.30 | 低频星际底噪 + 缓慢漂移的持续音 | 更暗的底噪 + 偶发“星星闪烁”钟声 | 66 | 大七 |
| 轻盈 light | F 利底亚 | 拇指琴（基音 + 高位金属舌） | 明亮小房间：1.1s，9kHz，湿 0.16 | 轻风（带通扫动） | 更低、更柔的风 | 76 | 加九 |
| 赛博朋克 cyberpunk | A 小调五声 | 双算子 FM 拨弦 | 金属板：1.8s，7kHz，湿 0.24 | 城市低频嗡声 + 远处提示音 | 城市 + 雨声 + 雨滴 | 84 | 小七 |
| 森林 forest | G 大调五声 | 木琴 / 木块 | 林间：1.4s，4.2kHz（很闷），湿 0.20 | 风 + 鸟鸣 | 夜风 + 蟋蟀 | 70 | 大六 |
| 日出 sunrise | C 大调（六声） | 毛毡钢琴感（谐波 + 低通 + 双音微失谐） | 海边：2.0s，6kHz，湿 0.22 | 海浪（两浪 / 8 秒）+ 少量鸟鸣 | 更轻的海浪 | 72 | 六九 |

> 主题投票里如果新增主题，只需要在 `palettes.js` 加一行（调式、音色、空间、两条环境底），不用改引擎。

---

## 4. 体积预算（对照 4MB 主包）

| 项 | 现状 | v2 原型 | 备注 |
|---|---|---|---|
| 音频文件 | 1,461,207 B（bg/fail/clear） | 0 B（全合成） | 【实测】文件大小 |
| 音频代码 | 约 152KB 未压缩（audio.js + audioManager.js + music/*） | 新增 59KB 未压缩 / **26.3KB 压缩** / **9.7KB 压缩+gzip** | 【实测】esbuild 压缩；中文注释多，未压缩体积偏大 |
| 试听台 | — | 6.3KB（发布时可剔除） | 仅开发用 |
| **主包净变化** | — | **约 −1.40MB**（删掉三个 mp3、保留旧代码时）；若同时删除旧音频系统约 **−1.55MB** | 【估计】按原始文件大小计算，微信计包方式以开发者工具为准 |

建议的取舍：
- 如果想保留现在那首 BGM 作为“主题曲”，把 `bg.mp3` 放进**分包**（整包上限 30MB、主包 4MB【文档】），进游戏后再加载，作为 music 母线上的一层；主包里只留合成系统。
- 运行时内存：每个主题的音效缓冲约 **1.7–1.9MB**，两条环境底各 **0.69MB**，同时只保留当前主题，合计约 **3MB**【实测，float32】。若真机内存吃紧，第一刀砍 `pad`（3.2s）和 `clear/fail` 的尾巴。

---

## 5. 运行时合成 vs 烘焙成文件

| 内容 | 建议 | 理由 |
|---|---|---|
| 跳跃 / 落地 / 气流 / UI | **运行时合成**（启动时同步，boot） | 短、要变体、要随主题换音色；合成 < 10ms【实测，热启动】 |
| 连击 / 清除 / 特殊 / 失败 | **运行时合成**（6ms 时间片，后台） | 用得少，晚几百毫秒合成完不影响；没合成完就当场同步合成（`onDemandBakes` 计数） |
| 音乐层的单音（pad/bass/arp/bell） | **运行时合成，一音多用** | 主音烘焙一次，playbackRate 移调 |
| 环境底 | **运行时合成**（生成器分步） | 8 秒循环，每步 ≤ 8ms【实测】 |
| 长篇 BGM / 有人声的音乐 | **烘焙成文件，放分包，InnerAudio 播** | 合成不了；微信建议长音频用 InnerAudio【文档】 |
| 如果某机型 WebAudio 不可用 | **离线渲染成 WAV**（同一套配方，`render-samples.mjs`）→ InnerAudio | 原型未实现，见 §6 |

---

## 6. 微信小游戏适配要点

【文档】（均为微信开放文档，2026-11-11 读取）
- `wx.createWebAudioContext()` 基础库 **2.19.0** 起支持。https://developers.weixin.qq.com/minigame/dev/api/media/audio/wx.createWebAudioContext.html
- WebAudioContext 的创建方法有：`createAnalyser`、`createBiquadFilter`、`createBuffer`、`createBufferSource`、`createChannelMerger/Splitter`、`createConstantSource`、`createDelay`、`createDynamicsCompressor`、`createGain`、`createIIRFilter`、`createOscillator`、`createPanner`、`createPeriodicWave`、`createScriptProcessor`、`createWaveShaper`、`decodeAudioData`。**没有 `createConvolver`**。https://developers.weixin.qq.com/minigame/dev/api/media/audio/WebAudioContext.html
- 官方指南：InnerAudio 适合较大的文件（背景音乐），WebAudio 性能好但占内存，适合短而频繁的音效；**Android 上最多同时播放 10 个音频**（指 InnerAudio 场景）；iOS 高性能模式下，**iOS 17.5 以上退后台后 WebAudio 无法恢复，需要销毁重建**；基础库 2.25.3 以上旧客户端创建后需主动 `resume()` 一次；建议在 `wx.onShow`、`wx.onAudioInterruptionEnd` 里 `resume()`。https://developers.weixin.qq.com/minigame/dev/guide/base-ability/audio.html
- 包体：主包 ≤ 4MB，主包 + 分包 ≤ 30MB。https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html

原型里已经做了：
- `createAudioContext()` 优先用 `wx.createWebAudioContext()`，否则用浏览器的 `AudioContext`。
- 只用上面列表里有的节点（Gain / BiquadFilter / Delay / DynamicsCompressor / WaveShaper / Buffer / BufferSource；Analyser 只在试听台用，它要求基础库 2.22.0）。
- 合成代码零依赖、不碰 DOM，可以原样放进微信版。

微信版接入时还要做（原型未做，因为本仓库没有微信代码）：
1. `flag.js` 依赖 `location` / `localStorage`，微信版改成读配置或 `wx.getStorageSync`。
2. 微信小游戏不一定支持 `import()` 动态加载，改成静态引入 + 开关判断。
3. `wx.onShow` / `wx.onAudioInterruptionEnd` → `director.resume()`；iOS 17.5+ 高性能模式下回前台时 `destroy()` 后重建 Director（缓冲需要重新合成，约几十毫秒）。
4. 兜底：没有 `wx.createWebAudioContext` 时（基础库 < 2.19.0），用 `encodeWav` 把需要的音效写进 `wx.env.USER_DATA_PATH`，用 InnerAudioContext 播，只保留 jump/land/fail 三个，功能降级为“无母线、无混响”。

---

## 7. 验收标准（可量化）

| # | 标准 | 目标 | 原型当前值 | 依据 |
|---|---|---|---|---|
| A1 | 主输出峰值 | ≤ −1 dBFS（任何情况下） | 正常游玩 −1.2 ～ −1.5；压力测试 −1.3 ～ −1.7 dBFS | 【实测】node-web-audio-api 跑真实 WebAudio 图，AnalyserNode 每 20ms 采样，可能漏掉极短峰；软削波曲线的上限本身就是 −1 dBFS（构造保证） |
| A2 | 削波器之前的峰值 | ≤ 0 dBFS（说明不靠削波器“救”） | −0.4 ～ −1.1 dBFS | 【实测】同上；浏览器压缩器有自动补偿增益，这个值会随实现不同而变 |
| A3 | 离线样本峰值 | ≤ −1 dBFS | −3.9 ～ −7.6 dBFS（10 个文件） | 【实测】`samples/samples.json` |
| A4 | 同名并发 | jump ≤ 4、land ≤ 3、air ≤ 2，母线 sfx ≤ 12 | 压力测试中抢占 26–30 次、丢弃 0 次，未超上限 | 【实测】`getStats()` |
| A5 | 最小间隔 | jump ≥ 60ms | 1 秒 40 次点击 → 约 16 次出声 | 【实测】 |
| A6 | 启动同步合成（boot 音效） | 手机 ≤ 50ms | 沙盒热启动 8.9ms；冷启动（含 JIT）23–58ms | 【实测】沙盒；手机按慢 2–4 倍【估计】→ 20–200ms，**需真机确认**，超标就把 jump/land 的变体从 4 减到 2 |
| A7 | 时间片 | 单片目标 6ms | 单个任务最重 8.8ms（cyberpunk:special）；实测单片最长 8.8–15ms | 【实测】超出目标，原因是单个任务本身 > 6ms；下一步把 special/clear/pad 拆成两段合成 |
| A8 | 主题切换 | 1.5 秒内平滑过渡，无断音无爆音 | 旧缓冲 3 秒后释放；新主题 boot 音效优先合成 | 【实测】无报错；听感需真人确认 |
| A9 | 包体 | 主包净减 ≥ 1MB | 约 −1.40MB（删 mp3）/ 新增代码 26KB 压缩 | 【实测】文件大小；【估计】微信计包 |
| A10 | 内存 | ≤ 4MB 音频缓冲 | 约 3.0MB（单主题 + 两条环境底） | 【实测】`getStats().bufferKB` |
| A11 | 默认行为 | 不带参数时与原来完全一致 | 不加载任何 v2 代码（只多一个 0.7KB 的 flag.js），无报错 | 【实测】headless Chromium 打开 `index.html`：`window.__audioV2` 未定义、0 个错误 |
| A12 | 真机 | iPhone 13、中端安卓各玩 5 分钟：无爆音、无卡顿、前后台切换后有声 | **未测试** | 无真机 |

---

## 8. 原型说明与测试方法

### 文件
- `platforms/web/js/core/audio-v2/dsp.js` — DSP 原语（种子随机、滤波、分音、FM、包络、循环、WAV 编码、FDN 混响的 JS 版）
- `platforms/web/js/core/audio-v2/recipes.js` — 原创音色配方、环境底、连击音高行走
- `platforms/web/js/core/audio-v2/palettes.js` — 5 个主题调色板、昼夜修饰、快照解析、音乐分层表
- `platforms/web/js/core/audio-v2/audio-director.js` — 运行时：母线、声部池、FDN、快照过渡、时间片烘焙、自适应音乐、统计
- `platforms/web/js/core/audio-v2/integrate.js` — 接入 WebGame（只在开关打开时动态加载）
- `platforms/web/js/core/audio-v2/flag.js` — 开关
- `platforms/web/audio-lab.html` + `js/audio-lab.js` — 试听台
- `tools/audio-v2/check.mjs`、`render-samples.mjs`、`smoke-webaudio.mjs` — 自检、离线渲染、真实 WebAudio 冒烟
- 对原文件的改动：`game.js` +8 行（开关 + 动态 import），`main.js` +6 行（`?show=audio` 跳转），`package.json` 加 3 个脚本，`.gitignore` 忽略 `samples/`

### 怎么测
```bash
npm run dev                       # 或 python -m http.server（在 platforms/web 下）
# 游戏内：  http://localhost:8080/?audio=v2              （跟随本机时钟）
#          http://localhost:8080/?audio=v2&daypart=night
# 试听台：  http://localhost:8080/?show=audio&theme=forest&daypart=night
# 控制台：  __audioStats()   查看声部池、缓冲、烘焙耗时
npm run audio:check               # 无依赖自检：语法 / 峰值 / 合成耗时 / 代码体积
npm run audio:render              # 渲染 10 个 WAV 到 samples/
npm i --no-save node-web-audio-api && npm run audio:smoke   # 真实 WebAudio 图冒烟
```
关闭：去掉 `?audio=v2` 即可；也可以 `?audio=v1` 强制关闭（覆盖 localStorage 开关）。

---

## 9. 接下来（建议顺序）

| 优先级 | 事项 | 预计 |
|---|---|---|
| P0 | 真机听一遍（iPhone 13 + 安卓），按 §7 A12 记录；调 5 个主题的音量平衡 | 半天 |
| P0 | 移植到线上微信版：静态引入、`wx.onShow` 恢复、iOS 17.5+ 重建 | 1 天 |
| P1 | 把 special/clear/pad 拆成两段合成，让时间片真正 ≤ 6ms | 1 小时 |
| P1 | `bg.mp3` 进分包，作为可选的“主题曲层” | 半天 |
| P1 | 设置面板加“氛围：跟随时间 / 白天 / 夜晚”开关 | 1 小时 |
| P2 | 主题投票新主题的调色板；滑动手势的强弱映射到气流层音量 | 按需 |
| P2 | InnerAudio 兜底（基础库 < 2.19.0） | 半天 |

## 10. 风险与未验证
- **没有真机**：手机上的合成耗时、内存压力、iOS 静音键行为、蓝牙耳机延迟都没测。
- **听感未经真人评审**：样本是按规则生成的，我（Hark）不能“听”，只能看频谱和电平；音色好不好听要 YY 哥自己听。
- 离线样本用的是 JS 近似混音链（压缩器、滤波器实现与浏览器不同），电平会比游戏里低 2–4dB。
- `node-web-audio-api` 不是浏览器，冒烟测试只证明节点图能跑、参数合理。
- Headless Chromium 测试只验证了“无报错 + 事件路由通了”（12 次点击 → 13 个声音），**静音运行，没有听**。
