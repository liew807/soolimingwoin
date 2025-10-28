const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 基础路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 开发者后台路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: '星悦娱乐平台服务器运行正常',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        platform: 'Render.com'
    });
});

// 用户API路由
app.get('/api/users', (req, res) => {
    res.json({
        message: '获取用户列表',
        data: []
    });
});

// 游戏API路由
app.get('/api/games', (req, res) => {
    res.json({
        message: '获取游戏列表',
        data: [
            { id: 'dice', name: '掷骰子', status: 'active' },
            { id: 'slots', name: '幸运转盘', status: 'active' },
            { id: 'blackjack', name: '21点', status: 'active' }
        ]
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: err.message,
        timestamp: new Date().toISOString(),
        platform: 'Render.com'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 星悦娱乐平台服务器启动成功`);
    console.log(`📍 服务端口: ${PORT}`);
    console.log(`🌐 访问地址: https://您的应用名称.onrender.com`);
    console.log(`🔧 后台管理: https://您的应用名称.onrender.com/admin`);
    console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
    console.log(`🛠️  环境: ${process.env.NODE_ENV || 'production'}`);
    console.log(`☁️  平台: Render.com`);
});

module.exports = app;
