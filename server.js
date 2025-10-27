// userManager.js - 用户管理模块
const userManager = {
    // 获取所有用户
    getUsers: function() {
        return JSON.parse(localStorage.getItem('entertainmentUsers')) || [];
    },

    // 保存用户数据
    saveUsers: function(users) {
        localStorage.setItem('entertainmentUsers', JSON.stringify(users));
    },

    // 获取当前用户
    getCurrentUser: function() {
        return JSON.parse(localStorage.getItem('currentUser')) || null;
    },

    // 保存当前用户
    saveCurrentUser: function(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    },

    // 用户登录
    login: function(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            user.lastLogin = new Date().toISOString();
            this.saveUsers(users);
            this.saveCurrentUser(user);
            return user;
        }
        return null;
    },

    // 用户注册
    register: function(username, password) {
        const users = this.getUsers();
        
        if (users.find(u => u.username === username)) {
            return { success: false, message: '用户名已存在' };
        }

        const newUser = {
            id: Date.now(),
            username: username,
            password: password,
            balance: 1000,
            registrationDate: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            vipLevel: 1,
            totalRecharged: 0,
            totalBet: 0,
            totalWin: 0
        };

        users.push(newUser);
        this.saveUsers(users);
        this.saveCurrentUser(newUser);

        return { success: true, user: newUser };
    },

    // 更新用户余额
    updateBalance: function(userId, amount) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1) {
            users[userIndex].balance += amount;
            this.saveUsers(users);
            
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.balance = users[userIndex].balance;
                this.saveCurrentUser(currentUser);
            }
            
            return users[userIndex].balance;
        }
        return null;
    },

    // 获取用户信息
    getUserInfo: function(userId) {
        const users = this.getUsers();
        return users.find(u => u.id === userId);
    },

    // 退出登录
    logout: function() {
        localStorage.removeItem('currentUser');
    }
};

// transactionManager.js - 交易管理模块
const transactionManager = {
    // 获取所有交易
    getTransactions: function() {
        return JSON.parse(localStorage.getItem('userTransactions')) || [];
    },

    // 保存交易数据
    saveTransactions: function(transactions) {
        localStorage.setItem('userTransactions', JSON.stringify(transactions));
    },

    // 记录充值交易
    recordRecharge: function(userId, amount, credits, paymentMethod = 'alipay') {
        const transactions = this.getTransactions();
        
        const transaction = {
            id: Date.now(),
            userId: userId,
            type: 'recharge',
            amount: amount,
            credits: credits,
            status: 'completed',
            paymentMethod: paymentMethod,
            transactionId: 'TX_' + Date.now(),
            date: new Date().toISOString()
        };

        transactions.push(transaction);
        this.saveTransactions(transactions);

        // 更新用户总充值金额
        const users = userManager.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].totalRecharged += amount;
            userManager.saveUsers(users);
        }

        return transaction;
    },

    // 记录游戏交易
    recordGameTransaction: function(userId, gameType, betAmount, winAmount, result) {
        const transactions = this.getTransactions();
        
        const transaction = {
            id: Date.now(),
            userId: userId,
            type: 'game',
            gameType: gameType,
            betAmount: betAmount,
            winAmount: winAmount,
            result: result,
            date: new Date().toISOString()
        };

        transactions.push(transaction);
        this.saveTransactions(transactions);

        // 更新用户游戏统计
        const users = userManager.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].totalBet += betAmount;
            if (winAmount > 0) {
                users[userIndex].totalWin += winAmount;
            }
            userManager.saveUsers(users);
        }

        return transaction;
    },

    // 获取用户交易记录
    getUserTransactions: function(userId, limit = 50) {
        const transactions = this.getTransactions();
        return transactions
            .filter(t => t.userId === userId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    },

    // 获取用户充值统计
    getUserRechargeStats: function(userId) {
        const transactions = this.getTransactions();
        const rechargeTransactions = transactions.filter(t => 
            t.userId === userId && t.type === 'recharge'
        );
        
        return {
            totalRechargeAmount: rechargeTransactions.reduce((sum, t) => sum + t.amount, 0),
            totalRechargeCount: rechargeTransactions.length,
            lastRechargeDate: rechargeTransactions.length > 0 ? 
                rechargeTransactions[0].date : null
        };
    }
};

// gameManager.js - 游戏管理模块
const gameManager = {
    // 游戏配置
    gameConfig: {
        dice: {
            name: '掷骰子',
            minBet: 10,
            maxBet: 1000,
            payout: 2
        },
        slots: {
            name: '幸运转盘',
            minBet: 20,
            maxBet: 500,
            symbols: ['🍒', '🍋', '🍊', '⭐', '🔔', '7️⃣'],
            payouts: {
                '3x7️⃣': 10,
                '3x🔔': 5,
                '3x⭐': 3,
                '3x🍊': 2,
                '3x🍋': 2,
                '3x🍒': 2,
                'any2': 1
            }
        },
        blackjack: {
            name: '21点',
            minBet: 50,
            maxBet: 2000,
            payout: 2
        }
    },

    // 掷骰子游戏
    playDice: function(betAmount, selectedChoice) {
        const dice = Math.floor(Math.random() * 6) + 1;
        const isWin = (selectedChoice === 'big' && dice > 3) || 
                     (selectedChoice === 'small' && dice <= 3);
        
        const winAmount = isWin ? betAmount * this.gameConfig.dice.payout : 0;
        
        return {
            dice: dice,
            isWin: isWin,
            winAmount: winAmount,
            result: isWin ? 'win' : 'lose'
        };
    },

    // 老虎机游戏
    playSlots: function(betAmount) {
        const symbols = this.gameConfig.slots.symbols;
        const spin = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        let winAmount = 0;
        let result = 'lose';

        // 检查中奖情况
        if (spin[0] === spin[1] && spin[1] === spin[2]) {
            const symbol = spin[0];
            winAmount = betAmount * (this.gameConfig.slots.payouts[`3x${symbol}`] || 1);
            result = 'jackpot';
        } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
            winAmount = betAmount * this.gameConfig.slots.payouts.any2;
            result = 'win';
        }

        return {
            spin: spin,
            winAmount: winAmount,
            result: result
        };
    },

    // 21点游戏
    playBlackjack: function() {
        // 生成一副牌
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        let deck = [];
        
        suits.forEach(suit => {
            values.forEach(value => {
                deck.push({ suit, value });
            });
        });

        // 洗牌
        deck = this.shuffleArray(deck);

        return {
            deck: deck,
            playerHand: [deck.pop(), deck.pop()],
            dealerHand: [deck.pop(), deck.pop()]
        };
    },

    // 计算21点手牌点数
    calculateHandValue: function(cards) {
        let value = 0;
        let aces = 0;
        
        for (const card of cards) {
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        }
        
        // 处理Ace
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
        
        return value;
    },

    // 洗牌算法
    shuffleArray: function(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    },

    // 验证下注金额
    validateBet: function(gameType, betAmount, userBalance) {
        const config = this.gameConfig[gameType];
        
        if (betAmount < config.minBet) {
            return { valid: false, message: `最低下注${config.minBet}积分` };
        }
        
        if (betAmount > config.maxBet) {
            return { valid: false, message: `最高下注${config.maxBet}积分` };
        }
        
        if (betAmount > userBalance) {
            return { valid: false, message: '积分不足' };
        }
        
        return { valid: true };
    }
};

// rechargeManager.js - 充值管理模块
const rechargeManager = {
    // 充值选项配置
    rechargeOptions: [
        { amount: 1000, credits: 1000, bonus: 0, label: "1000积分" },
        { amount: 2000, credits: 2000, bonus: 0, label: "2000积分" },
        { amount: 5000, credits: 5500, bonus: 500, label: "5500积分" },
        { amount: 10000, credits: 12000, bonus: 2000, label: "12000积分" },
        { amount: 20000, credits: 25000, bonus: 5000, label: "25000积分" },
        { amount: 50000, credits: 70000, bonus: 20000, label: "70000积分" }
    ],

    // 获取充值选项
    getRechargeOptions: function() {
        return this.rechargeOptions;
    },

    // 处理充值
    processRecharge: function(userId, optionIndex, paymentMethod = 'alipay') {
        const option = this.rechargeOptions[optionIndex];
        if (!option) {
            return { success: false, message: '无效的充值选项' };
        }

        // 更新用户余额
        const newBalance = userManager.updateBalance(userId, option.credits);
        if (newBalance === null) {
            return { success: false, message: '用户不存在' };
        }

        // 记录交易
        const transaction = transactionManager.recordRecharge(
            userId, 
            option.amount, 
            option.credits, 
            paymentMethod
        );

        return {
            success: true,
            amount: option.amount,
            credits: option.credits,
            bonus: option.bonus,
            newBalance: newBalance,
            transaction: transaction
        };
    },

    // 生成支付二维码数据
    generatePaymentQRData: function(amount, credits, paymentMethod) {
        const timestamp = Date.now();
        const orderId = `ORDER_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
            orderId: orderId,
            amount: amount,
            credits: credits,
            paymentMethod: paymentMethod,
            timestamp: timestamp,
            status: 'pending'
        };
    },

    // 获取用户充值统计
    getUserRechargeHistory: function(userId) {
        return transactionManager.getUserRechargeStats(userId);
    }
};

// vipManager.js - VIP管理模块
const vipManager = {
    // VIP等级配置
    vipLevels: [
        { level: 1, name: '普通会员', requiredAmount: 0, benefits: [] },
        { level: 2, name: '白银会员', requiredAmount: 10000, benefits: ['每日签到奖励+10%'] },
        { level: 3, name: '黄金会员', requiredAmount: 50000, benefits: ['每日签到奖励+20%', '游戏返水1%'] },
        { level: 4, name: '白金会员', requiredAmount: 200000, benefits: ['每日签到奖励+30%', '游戏返水2%', '专属客服'] },
        { level: 5, name: '钻石会员', requiredAmount: 500000, benefits: ['每日签到奖励+50%', '游戏返水3%', '专属客服', '生日礼物'] }
    ],

    // 获取用户VIP等级
    getUserVipLevel: function(userId) {
        const user = userManager.getUserInfo(userId);
        if (!user) return null;

        const totalRecharged = user.totalRecharged || 0;
        
        // 找到符合条件的最高VIP等级
        for (let i = this.vipLevels.length - 1; i >= 0; i--) {
            if (totalRecharged >= this.vipLevels[i].requiredAmount) {
                return this.vipLevels[i];
            }
        }
        
        return this.vipLevels[0];
    },

    // 更新用户VIP等级
    updateUserVipLevel: function(userId) {
        const newLevel = this.getUserVipLevel(userId);
        const users = userManager.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1 && users[userIndex].vipLevel !== newLevel.level) {
            users[userIndex].vipLevel = newLevel.level;
            userManager.saveUsers(users);
            
            // 更新当前用户
            const currentUser = userManager.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.vipLevel = newLevel.level;
                userManager.saveCurrentUser(currentUser);
            }
            
            return newLevel;
        }
        
        return null;
    },

    // 获取VIP等级信息
    getVipLevelInfo: function(level) {
        return this.vipLevels.find(vip => vip.level === level) || this.vipLevels[0];
    }
};

// 初始化数据
function initializeData() {
    // 检查是否已有数据，如果没有则创建示例数据
    if (!localStorage.getItem('entertainmentUsers')) {
        const sampleUsers = [
            {
                id: 1,
                username: "demo",
                password: "demo123",
                balance: 5000,
                registrationDate: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                vipLevel: 2,
                totalRecharged: 15000,
                totalBet: 50000,
                totalWin: 45000
            }
        ];
        userManager.saveUsers(sampleUsers);
    }

    console.log('系统初始化完成');
}

// 导出到全局作用域
window.userManager = userManager;
window.transactionManager = transactionManager;
window.gameManager = gameManager;
window.rechargeManager = rechargeManager;
window.vipManager = vipManager;
window.initializeData = initializeData;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeData();
});
