require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
    // 允许的前端域名
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());

// 设置静态文件服务，用于托管 public 文件夹下的 index.html
app.use(express.static('public'));

// === 修复的环境变量处理 ===
console.log('=== 环境变量检查 ===');
console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('RANK_URL:', process.env.RANK_URL ? '✅ 已设置' : '❌ 未设置');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || '使用默认值 *');
console.log('==================');

// 使用环境变量或默认值，服务不会退出
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAe_aOVT1gSfmHKBrorFvX4fRwN5nODXVA';
const RANK_URL = process.env.RANK_URL || 'https://placeholder.com/api';

if (!process.env.FIREBASE_API_KEY || !process.env.RANK_URL) {
    console.warn('⚠️ 警告：部分环境变量使用默认值，建议在Render中配置');
}

// 1. 登录接口（封装Firebase验证）
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 后端验证
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "请提供邮箱和密码"
            });
        }

        console.log('登录尝试:', email);

        // 调用Firebase登录接口
        const firebaseResponse = await fetch(
            `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            }
        );

        const firebaseData = await firebaseResponse.json();

        if (!firebaseResponse.ok) {
            console.error('Firebase登录失败:', firebaseData.error);
            throw new Error(
                firebaseData.error?.message || "Firebase登录验证失败"
            );
        }

        console.log('登录成功:', email);

        // 返回用户信息
        res.json({
            success: true,
            data: {
                email: firebaseData.email,
                idToken: firebaseData.idToken
            }
        });

    } catch (error) {
        console.error('登录错误:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 2. 修改邮箱接口
app.post('/api/change-email', async (req, res) => {
    try {
        const { idToken, newEmail } = req.body;

        if (!idToken || !newEmail) {
            return res.status(400).json({
                success: false,
                message: "请提供token和新邮箱"
            });
        }

        // 调用Firebase修改邮箱接口
        const firebaseResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken,
                    email: newEmail,
                    returnSecureToken: true
                })
            }
        );

        const firebaseData = await firebaseResponse.json();

        if (!firebaseResponse.ok) {
            throw new Error(
                firebaseData.error?.message || "修改邮箱失败"
            );
        }

        res.json({
            success: true,
            data: {
                email: firebaseData.email,
                idToken: firebaseData.idToken
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 3. 修改密码接口
app.post('/api/change-password', async (req, res) => {
    try {
        const { idToken, newPassword } = req.body;

        if (!idToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "请提供token和新密码"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "密码长度不能少于6位"
            });
        }

        // 调用Firebase修改密码接口
        const firebaseResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken,
                    password: newPassword,
                    returnSecureToken: true
                })
            }
        );

        const firebaseData = await firebaseResponse.json();

        if (!firebaseResponse.ok) {
            throw new Error(
                firebaseData.error?.message || "修改密码失败"
            );
        }

        res.json({
            success: true,
            data: {
                idToken: firebaseData.idToken
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 4. 设置国王等级接口
app.post('/api/king-rank', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: "请提供有效的身份令牌"
            });
        }

        const idToken = authHeader.split(' ')[1];

        // 构造等级数据
        const ratingData = {
            "cars": 100000, "car_fix": 100000, "car_collided": 100000, "car_exchange": 100000,
            "car_trade": 100000, "car_wash": 100000, "slicer_cut": 100000, "drift_max": 100000,
            "drift": 100000, "cargo": 100000, "delivery": 100000, "taxi": 100000, "levels": 100000,
            "gifts": 100000, "fuel": 100000, "offroad": 100000, "speed_banner": 100000,
            "reactions": 100000, "police": 100000, "run": 100000, "real_estate": 100000,
            "t_distance": 100000, "treasure": 100000, "block_post": 100000, "push_ups": 100000,
            "burnt_tire": 100000, "passanger_distance": 100000, "time": 10000000000, "race_win": 3000
        };

        console.log('设置国王等级请求，RANK_URL:', RANK_URL);

        // 调用等级设置接口
        const rankResponse = await fetch(RANK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
                'User-Agent': 'okhttp/3.12.13'
            },
            body: JSON.stringify({
                data: JSON.stringify({ RatingData: ratingData })
            })
        });

        if (!rankResponse.ok) {
            throw new Error(`等级设置接口返回错误：${rankResponse.status} ${rankResponse.statusText}`);
        }

        res.json({
            success: true,
            message: "国王等级设置成功"
        });

    } catch (error) {
        console.error('设置等级错误:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Backend is running',
        timestamp: new Date().toISOString()
    });
});

// 启动服务
app.listen(PORT, () => {
    console.log(`🚀 后端服务已启动，端口：${PORT}`);
    console.log(`📡 API基础地址：http://localhost:${PORT}/api`);
    console.log(`🌐 前端地址：http://localhost:${PORT}/`);
    console.log(`❤️  健康检查：http://localhost:${PORT}/health`);
});
