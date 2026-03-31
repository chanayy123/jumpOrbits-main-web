// 调试服务器启动脚本
import { createServer } from 'http';
import { createReadStream } from 'fs';
import { resolve, join, extname } from 'path';
import { parse } from 'url';

// 简单的MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// 端口号
const PORT = 8080;

// 根目录
const ROOT_DIR = resolve(process.cwd());

// 创建HTTP服务器
const server = createServer((req, res) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

    // 默认为index.html
    let url = req.url === '/' ? '/platforms/web/index.html' : req.url;

    // 解析URL
    const parsedUrl = parse(url);
    let pathname = parsedUrl.pathname;

    // 解析文件路径
    let filePath = join(ROOT_DIR, pathname);

    // 获取文件扩展名
    const ext = extname(filePath);

    // 设置内容类型
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 读取文件
    createReadStream(filePath)
        .on('error', () => {
            // 文件不存在
            res.writeHead(404);
            res.end('404 Not Found');
        })
        .on('open', () => {
            // 文件存在，设置响应头
            res.setHeader('Content-Type', contentType);
            // 允许跨域请求
            res.setHeader('Access-Control-Allow-Origin', '*');
            // 如果是JavaScript文件，添加sourcemap支持
            if (ext === '.js') {
                res.setHeader('SourceMap', `${pathname}.map`);
            }
        })
        .pipe(res);
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`Debug server started`);
    console.log(`Server ready: http://localhost:${PORT}`);
});

// 处理错误
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
}); 