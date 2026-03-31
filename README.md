# 指尖跳跳 (Jump Orbits)

一款基于Three.js的休闲小游戏，通过点击控制星球从外层轨道向内层轨道跳跃，避开轨道上运行的其他星球，尽可能深入到更多的内层轨道以获取更高分数。

## 游戏特点

- 多层圆形同心轨道，每层轨道上有不同数量的星球
- 点击屏幕使玩家星球向内层跳跃
- 成功避开内层轨道上的星球就得分，碰撞则游戏结束
- 简约几何风格，易于上手的操作方式

## 如何运行

### 本地开发环境

由于浏览器的安全限制，直接打开HTML文件可能无法正常加载模块。请使用以下方法之一运行游戏：

#### 方法1：使用Python的简易HTTP服务器

如果你已安装Python，在项目根目录运行：

```bash
# Python 3.x
python -m http.server

# Python 2.x
python -m SimpleHTTPServer
```

然后在浏览器中访问 `http://localhost:8000`

#### 方法2：使用Node.js的http-server

安装：
```bash
npm install -g http-server
```

运行：
```bash
http-server
```

然后在浏览器中访问 `http://localhost:8080`

#### 方法3：使用Visual Studio Code的Live Server插件

1. 在VS Code中安装Live Server插件
2. 右键点击index.html，选择"Open with Live Server"

## 技术栈

- Three.js：WebGL 3D图形库
- 原生JavaScript：游戏逻辑和UI交互
- HTML5 & CSS3：游戏界面和样式

## 后续开发计划

1. 添加音效和背景音乐
2. 优化移动设备体验
3. 增加粒子特效
4. 实现更多游戏机制（如特殊能力、收集物等）
5. 美化UI界面
6. 微信小游戏适配
7. 增加排行榜功能