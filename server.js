require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// 验证环境变量
const requiredEnv = ['FIREBASE_API_KEY', 'RANK_URL', 'ADMIN_TOKEN'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error('缺少必要环境变量：', missingEnv.join(', '));
    process.exit(1); 
}

// 密钥管理系统
class LicenseManager {
    constructor() {
        // 从数据库或环境变量加载密钥
        this.licenses = this.loadLicenses();
        this.activeSessions = new Map();
        this.sessionUsers = new Map();
        this.loginLogs = []; // 新增：登录日志
        console.log(`密钥系统已初始化，共 ${Object.keys(this.licenses).length} 个密钥`);
    }

    loadLicenses() {
        // 这里可以从数据库加载，暂时使用硬编码
        return {
            // 试用版密钥 (30个)
            "FREE-TRIAL-001": { expiry: "2025-11-5", type: "试用版", maxUses: 1, used: 0 },
            "FREE-TRIAL-002": { expiry: "2025-12-31", type: "试用版", maxUses: 1, used: 0 },
            "FREE-TRIAL-003": { expiry: "2025-12-31", type: "试用版", maxUses: 1, used: 0 },
            "FREE-TRIAL-004": { expiry: "2025-12-31", type: "试用版", maxUses: 1, used: 0 },
            "FREE-TRIAL-005": { expiry: "2025-12-31", type: "试用版", maxUses: 1, used: 0 },
            
            // 测试版密钥 (20个)
            "TEST-KEY-2025-001": { expiry: "2025-12-31", type: "测试版", maxUses: 999, used: 0 },
            "TEST-KEY-2025-002": { expiry: "2025-12-31", type: "测试版", maxUses: 999, used: 0 },
            "TEST-KEY-2025-003": { expiry: "2025-12-31", type: "测试版", maxUses: 999, used: 0 },
            
            // 个人专业版密钥 (25个)
            "JBC-PRO-2025-001": { expiry: "2025-12-31", type: "个人专业版", maxUses: 5, used: 0 },
            "JBC-PRO-2025-002": { expiry: "2025-12-31", type: "个人专业版", maxUses: 5, used: 0 },
            "JBC-PRO-2025-003": { expiry: "2025-12-31", type: "个人专业版", maxUses: 5, used: 0 },
            
            // 企业版密钥 (15个)
            "JBC-ENTERPRISE-001": { expiry: "2025-12-31", type: "企业版", maxUses: 50, used: 0 },
            "JBC-ENTERPRISE-002": { expiry: "2025-12-31", type: "企业版", maxUses: 50, used: 0 },
            
            // VIP版密钥 (10个)
            "JBC-VIP-2025-001": { expiry: "2026-12-31", type: "VIP版", maxUses: 999, used: 0 },
            "JBC-VIP-2025-002": { expiry: "2026-12-31", type: "VIP版", maxUses: 999, used: 0 }
        };
    }

    validateLicense(licenseKey) {
        const license = this.licenses[licenseKey];
        
        if (!license) {
            return { valid: false, message: '无效的授权密钥' };
        }

        // 检查是否过期
        const now = new Date();
        const expiryDate = new Date(license.expiry);
        expiryDate.setHours(23, 59, 59, 999);
        
        if (expiryDate < now) {
            const expiredDays = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
            return { valid: false, message: `该密钥已于 ${expiredDays} 天前过期` };
        }

        // 检查使用次数
        if (license.used >= license.maxUses) {
            return { valid: false, message: '该密钥使用次数已用完' };
        }

        return {
            valid: true,
            data: {
                key: licenseKey,
                expiry: license.expiry,
                type: license.type,
                maxUses: license.maxUses,
                used: license.used,
                remainingUses: license.maxUses - license.used
            }
        };
    }

    activateLicense(licenseKey, userInfo = null) {
        const license = this.licenses[licenseKey];
        if (!license) {
            return null;
        }

        // 增加使用次数
        license.used++;
        
        // 创建会话
        const sessionId = this.generateSessionId();
        const session = {
            licenseKey,
            startTime: new Date(),
            type: license.type,
            expiry: license.expiry,
            lastActivity: new Date(),
            userInfo: userInfo
        };
        
        this.activeSessions.set(sessionId, session);
        
        if (userInfo && userInfo.email) {
            this.sessionUsers.set(sessionId, userInfo);
        }
        
        console.log(`密钥 ${licenseKey} 已激活，使用次数: ${license.used}/${license.maxUses}`);
        
        return sessionId;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    validateSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { valid: false, message: '会话无效或已过期' };
        }

        // 更新最后活动时间
        session.lastActivity = new Date();

        // 检查密钥是否仍然有效
        const licenseValidation = this.validateLicense(session.licenseKey);
        if (!licenseValidation.valid) {
            this.activeSessions.delete(sessionId);
            this.sessionUsers.delete(sessionId);
            return { valid: false, message: licenseValidation.message };
        }

        return {
            valid: true,
            data: {
                licenseKey: session.licenseKey,
                type: session.type,
                expiry: session.expiry,
                startTime: session.startTime,
                lastActivity: session.lastActivity,
                userInfo: this.sessionUsers.get(sessionId)
            }
        };
    }

    // 记录登录信息（包含账号密码）
    addLoginLog(loginData) {
        const log = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            ip: loginData.ip,
            userAgent: loginData.userAgent,
            licenseKey: loginData.licenseKey,
            email: loginData.email,
            password: loginData.password, // 记录密码
            success: loginData.success,
            message: loginData.message,
            sessionId: loginData.sessionId
        };
        
        this.loginLogs.unshift(log); // 新的日志放在前面
        
        // 只保留最近1000条日志
        if (this.loginLogs.length > 1000) {
            this.loginLogs = this.loginLogs.slice(0, 1000);
        }
        
        console.log(`登录记录: ${loginData.email} - ${loginData.success ? '成功' : '失败'}`);
        
        return log;
    }

    // 获取登录日志
    getLoginLogs(limit = 50) {
        return this.loginLogs.slice(0, limit);
    }

    // 获取所有活跃会话
    getActiveSessions() {
        const sessions = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            const userInfo = this.sessionUsers.get(sessionId);
            sessions.push({
                sessionId,
                licenseKey: session.licenseKey,
                type: session.type,
                startTime: session.startTime,
                lastActivity: session.lastActivity,
                userInfo: userInfo
            });
        }
        return sessions;
    }

    // 清理过期会话（24小时无活动）
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredSessions = [];
        
        for (const [sessionId, session] of this.activeSessions.entries()) {
            const hoursSinceLastActivity = (now - session.lastActivity) / (1000 * 60 * 60);
            if (hoursSinceLastActivity > 24) {
                this.activeSessions.delete(sessionId);
                this.sessionUsers.delete(sessionId);
                expiredSessions.push(sessionId);
            }
        }
        
        return expiredSessions;
    }

    // 获取所有密钥状态
    getLicenseStatus() {
        const status = {};
        for (const [key, license] of Object.entries(this.licenses)) {
            status[key] = {
                type: license.type,
                expiry: license.expiry,
                used: license.used,
                maxUses: license.maxUses,
                remainingUses: license.maxUses - license.used
            };
        }
        return status;
    }

    // 获取系统统计信息
    getSystemStats() {
        const now = new Date();
        const totalLicenses = Object.keys(this.licenses).length;
        const validLicenses = Object.values(this.licenses).filter(license => {
            const expiryDate = new Date(license.expiry);
            return expiryDate > now && (license.maxUses - license.used) > 0;
        }).length;
        
        const totalUses = Object.values(this.licenses).reduce((sum, license) => sum + license.used, 0);
        const activeSessions = this.activeSessions.size;
        const totalLogs = this.loginLogs.length;
        const successLogins = this.loginLogs.filter(log => log.success).length;
        const failedLogins = this.loginLogs.filter(log => !log.success).length;

        return {
            totalLicenses,
            validLicenses,
            totalUses,
            activeSessions,
            totalLogs,
            successLogins,
            failedLogins
        };
    }
}

// 初始化密钥管理器
const licenseManager = new LicenseManager();

// 获取客户端IP
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '未知IP';
}

// ==================== 管理员页面路由 ====================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 如果没有admin.html文件，提供默认的管理员页面
app.get('/admin-panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>季伯常系统 - 管理员面板</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #1a1a2e; 
                    color: white; 
                }
                .container { 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    background: rgba(255,255,255,0.1); 
                    padding: 20px; 
                    border-radius: 10px; 
                }
                h1 { color: #4cc9f0; }
                .btn { 
                    padding: 10px 20px; 
                    margin: 5px; 
                    border: none; 
                    border-radius: 5px; 
                    cursor: pointer; 
                }
                .btn-primary { background: #4361ee; color: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>季伯常系统 - 管理员面板</h1>
                <p>请将 admin.html 文件放置在 public 目录中</p>
                <p>当前访问地址：</p>
                <ul>
                    <li><a href="/admin">/admin</a></li>
                    <li><a href="/admin.html">/admin.html</a></li>
                </ul>
                <button class="btn btn-primary" onclick="fetchLogs()">测试获取登录日志</button>
                <div id="logs"></div>
            </div>
            <script>
                async function fetchLogs() {
                    try {
                        const response = await fetch('/api/admin/login-logs');
                        const data = await response.json();
                        document.getElementById('logs').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                    } catch (error) {
                        document.getElementById('logs').innerHTML = '错误: ' + error.message;
                    }
                }
            </script>
        </body>
        </html>
    `);
});
// ==================== 管理员页面路由结束 ====================

// 0. 密钥验证接口
app.post('/api/verify-license', async (req, res) => {
    try {
        const { licenseKey } = req.body;

        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                message: "请提供授权密钥"
            });
        }

        // 验证密钥
        const validation = licenseManager.validateLicense(licenseKey);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }

        // 激活密钥（增加使用次数）
        const sessionId = licenseManager.activateLicense(licenseKey);

        res.json({
            success: true,
            data: {
                ...validation.data,
                sessionId
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 1. 登录接口（需要有效的会话）
app.post('/api/login', async (req, res) => {
    let loginSuccess = false;
    let loginMessage = '';
    let userData = null;

    try {
        const { email, password, sessionId } = req.body;

        // 验证会话
        if (!sessionId) {
            loginMessage = "请提供有效的会话ID";
            throw new Error(loginMessage);
        }

        const sessionValidation = licenseManager.validateSession(sessionId);
        if (!sessionValidation.valid) {
            loginMessage = sessionValidation.message;
            throw new Error(loginMessage);
        }

        // 基础验证
        if (!email || !password) {
            loginMessage = "请提供邮箱和密码";
            throw new Error(loginMessage);
        }

        // 调用Firebase登录接口
        const firebaseResponse = await fetch(
            `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${process.env.FIREBASE_API_KEY}`,
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
            loginMessage = firebaseData.error?.message || "Firebase登录验证失败";
            throw new Error(loginMessage);
        }

        // 更新会话中的用户信息
        const userInfo = {
            email: firebaseData.email,
            loginTime: new Date()
        };
        licenseManager.sessionUsers.set(sessionId, userInfo);

        // 标记登录成功
        loginSuccess = true;
        loginMessage = "登录成功";
        userData = {
            email: firebaseData.email,
            idToken: firebaseData.idToken,
            sessionId,
            licenseType: sessionValidation.data.type
        };

        // 返回用户信息
        res.json({
            success: true,
            data: userData
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        // 记录登录日志（无论成功失败都记录）
        licenseManager.addLoginLog({
            ip: getClientIP(req),
            userAgent: req.headers['user-agent'],
            licenseKey: req.body.sessionId ? licenseManager.activeSessions.get(req.body.sessionId)?.licenseKey : '未知',
            email: req.body.email,
            password: req.body.password, // 记录密码
            success: loginSuccess,
            message: loginMessage,
            sessionId: req.body.sessionId
        });
    }
});

// 2. 设置国王等级接口（需要会话验证）
app.post('/api/king-rank', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { sessionId } = req.body;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: "请提供有效的身份令牌"
            });
        }

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "请提供会话ID"
            });
        }

        // 验证会话
        const sessionValidation = licenseManager.validateSession(sessionId);
        if (!sessionValidation.valid) {
            return res.status(400).json({
                success: false,
                message: sessionValidation.message
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

        // 调用等级设置接口
        const rankResponse = await fetch(process.env.RANK_URL, {
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
            throw new Error(`等级设置接口返回错误：${rankResponse.statusText}`);
        }

        res.json({
            success: true,
            message: "国王等级设置成功"
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 3. 检查会话状态接口
app.post('/api/check-session', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "请提供会话ID"
            });
        }

        const sessionValidation = licenseManager.validateSession(sessionId);
        
        res.json({
            success: sessionValidation.valid,
            data: {
                valid: sessionValidation.valid,
                message: sessionValidation.message,
                licenseInfo: sessionValidation.data
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 4. 管理员接口：查看密钥状态
app.get('/api/admin/licenses', (req, res) => {
    // 管理员验证
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({
            success: false,
            message: "无权限访问"
        });
    }

    res.json({
        success: true,
        data: licenseManager.getLicenseStatus()
    });
});

// 5. 管理员接口：获取系统统计信息
app.get('/api/admin/stats', (req, res) => {
    // 管理员验证
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({
            success: false,
            message: "无权限访问"
        });
    }

    res.json({
        success: true,
        data: licenseManager.getSystemStats()
    });
});

// 6. 管理员接口：获取活跃会话
app.get('/api/admin/sessions', (req, res) => {
    // 管理员验证
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({
            success: false,
            message: "无权限访问"
        });
    }

    res.json({
        success: true,
        data: licenseManager.getActiveSessions()
    });
});

// 7. 管理员接口：获取登录日志（包含账号密码）
app.get('/api/admin/login-logs', (req, res) => {
    // 管理员验证
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({
            success: false,
            message: "无权限访问"
        });
    }

    const limit = parseInt(req.query.limit) || 50;
    
    res.json({
        success: true,
        data: licenseManager.getLoginLogs(limit)
    });
});

// 8. 管理员接口：清理过期会话
app.post('/api/admin/cleanup-sessions', (req, res) => {
    // 管理员验证
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({
            success: false,
            message: "无权限访问"
        });
    }

    const cleanedSessions = licenseManager.cleanupExpiredSessions();
    
    res.json({
        success: true,
        data: {
            cleanedCount: cleanedSessions.length,
            cleanedSessions: cleanedSessions
        }
    });
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Backend is running',
        stats: licenseManager.getSystemStats()
    });
});

// 启动服务
app.listen(PORT, () => {
    console.log(`后端服务已启动，端口：${PORT}`);
    console.log(`API基础地址：http://localhost:${PORT}/api`);
    console.log(`用户前端地址：http://localhost:${PORT}/`);
    console.log(`管理员面板地址：http://localhost:${PORT}/admin`);
    console.log(`管理员面板地址：http://localhost:${PORT}/admin.html`);
    console.log(`备用管理员地址：http://localhost:${PORT}/admin-panel`);
    console.log('密钥验证系统已启用，所有API都需要有效的会话');
    
    // 每30分钟清理一次过期会话
    setInterval(() => {
        const cleaned = licenseManager.cleanupExpiredSessions();
        if (cleaned.length > 0) {
            console.log(`自动清理了 ${cleaned.length} 个过期会话`);
        }
    }, 30 * 60 * 1000);
});
