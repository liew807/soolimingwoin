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

// API路由
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: '星悦娱乐平台服务器运行正常',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 星悦娱乐平台服务器启动成功`);
    console.log(`📍 前台地址: http://localhost:${PORT}`);
    console.log(`🔧 后台地址: http://localhost:${PORT}/admin`);
    console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
});

module.exports = app;
