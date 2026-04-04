const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'leaderboard.md');

// 中间件
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// CORS 支持（小游戏可能跨域）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 初始化数据文件
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '# 贵人连连看排行榜\n\n| 排名 | 昵称 | 分数 | 时间 |\n|------|------|------|------|\n');
  }
}

// 读取排行榜数据
function readLeaderboard() {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    if (lines.length < 2) return [];

    // 跳过表头分隔线
    const dataLines = lines.slice(1).filter(line => line.includes('|'));

    return dataLines.map(line => {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      return {
        rank: parseInt(parts[0]) || 0,
        nickname: parts[1] || '',
        score: parseInt(parts[2]) || 0,
        time: parts[3] || ''
      };
    }).filter(entry => entry.nickname && !isNaN(entry.score));
  } catch (e) {
    console.error('读取排行榜失败:', e);
    return [];
  }
}

// 保存排行榜（按分数排序，保留前100）
function saveLeaderboard(newEntry) {
  const entries = readLeaderboard();

  // 添加新记录
  entries.push(newEntry);

  // 按分数降序排序
  entries.sort((a, b) => b.score - a.score || new Date(a.time) - new Date(b.time));

  // 去重（同一昵称取最高分）
  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!seen.has(entry.nickname)) {
      unique.push(entry);
      seen.add(entry.nickname);
    }
  }

  // 保留前100名
  const top100 = unique.slice(0, 100);

  // 重新编号
  const ranked = top100.map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));

  // 写入 markdown 文件
  let md = '# 贵人连连看排行榜\n\n';
  md += '> 数据更新时间：' + new Date().toLocaleString('zh-CN') + '\n\n';
  md += '| 排名 | 昵称 | 分数 | 时间 |\n';
  md += '|------|------|------|------|\n';

  ranked.forEach(entry => {
    md += `| ${entry.rank} | ${escapeMd(entry.nickname)} | ${entry.score} | ${entry.time} |\n`;
  });

  fs.writeFileSync(DATA_FILE, md, 'utf8');
}

// Markdown 转义
function escapeMd(text) {
  return text.replace(/\|/g, '\\|');
}

// API：提交分数
app.post('/api/score', (req, res) => {
  const { nickname, score } = req.body;

  if (!nickname || !score) {
    return res.status(400).json({ error: '缺少昵称或分数' });
  }

  const newEntry = {
    rank: 0,
    nickname: nickname.trim(),
    score: parseInt(score),
    time: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };

  saveLeaderboard(newEntry);

  res.json({ success: true, message: '分数已提交' });
});

// API：获取排行榜
app.get('/api/leaderboard', (req, res) => {
  const entries = readLeaderboard();
  res.json({ success: true, data: entries });
});

// 启动服务器
initDataFile();
app.listen(PORT, () => {
  console.log(`🏆 排行榜服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 数据文件: ${DATA_FILE}`);
});
