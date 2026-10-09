/* ============================================================
   阳澄湖·蟹逅之旅 —— 零依赖后端
   功能：托管 index.html + 提供 /api 共享数据（投票/记账/留言/想法）
   运行：node server.js         （默认端口 3000）
        PORT=80 node server.js  （用 80，需 root）
   数据：存在同目录 data.json（自动创建）；备份=复制此文件，清空=删掉它重启
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const CAR_CAP = 4; // 每辆车 4 人（含司机），需与前端一致

const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

function load(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e){ return { members: [], expenses: [], messages: [], tripNotes: [] }; }
}
let data = load();

let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try{ const tmp = DATA_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, DATA_FILE); }
    catch(e){ console.error('保存失败:', e.message); }
  }, 50); // 轻微防抖，合并高频写入
}

// 应用一次操作；返回 {error} 表示拒绝，否则直接修改 data
function applyOp(op){
  if(!op || typeof op !== 'object') return { error: 'bad' };
  switch(op.type){
    case 'vote': {
      const name = (op.name || '').toString().trim();
      if(!name) return { error: 'bad' };
      const from = op.from, hasCar = !!op.hasCar;
      let carId = op.carId || null;
      let m = data.members.find(x => x.name === name);
      if(hasCar){
        if(m){ m.from = from; m.hasCar = true; m.carId = null; }
        else data.members.push({ id: uid(), name, from, hasCar: true, carId: null });
      } else {
        if(carId){
          const d = data.members.find(x => x.id === carId);
          if(!d) carId = null; // 车没了→待定
          else {
            const occ = data.members.filter(p => !p.hasCar && p.carId === carId && (!m || p.id !== m.id)).length;
            if(occ >= CAR_CAP - 1) return { error: 'full' }; // 满员，拒绝
          }
        }
        if(m){
          if(m.hasCar) data.members.forEach(p => { if(p.carId === m.id) p.carId = null; }); // 原司机→乘客，释放其乘客
          m.from = from; m.hasCar = false; m.carId = carId;
        } else data.members.push({ id: uid(), name, from, hasCar: false, carId });
      }
      return {};
    }
    case 'delMember': {
      const m = data.members.find(x => x.id === op.id);
      if(m && m.hasCar) data.members.forEach(p => { if(p.carId === op.id) p.carId = null; });
      data.members = data.members.filter(x => x.id !== op.id);
      return {};
    }
    case 'addExpense':  if(op.expense) data.expenses.push(op.expense); return {};
    case 'delExpense':  data.expenses = data.expenses.filter(e => e.id !== op.id); return {};
    case 'addMessage':  if(op.message) data.messages.push(op.message); return {};
    case 'addNote':     if(op.note)    data.tripNotes.push(op.note);   return {};
    case 'delNote':     data.tripNotes = data.tripNotes.filter(n => n.id !== op.id); return {};
    default: return { error: 'unknown' };
  }
}

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.ico':'image/x-icon', '.png':'image/png', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // --- API: 读取全部状态 ---
  if(url === '/api/state' && req.method === 'GET'){
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(data));
  }

  // --- API: 执行一次操作 ---
  if(url === '/api/op' && req.method === 'POST'){
    let body = '';
    req.on('data', c => { body += c; if(body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let op; try{ op = JSON.parse(body); }catch(e){ res.writeHead(400, {'Content-Type':'application/json'}); return res.end('{"error":"bad json"}'); }
      const r = applyOp(op);
      if(r && r.error){
        res.writeHead(r.error === 'full' ? 409 : 400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(r));
      }
      save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data)); // 返回最新完整状态
    });
    return;
  }

  // --- 静态文件（主要就是 index.html）---
  let file = url === '/' ? '/index.html' : url;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, file);
  if(!full.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden'); }
  if(path.basename(full) === 'data.json'){ res.writeHead(403); return res.end('forbidden'); } // 不暴露数据文件原文件
  fs.readFile(full, (err, buf) => {
    if(err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🦀 阳澄湖·蟹逅之旅 已启动  →  http://0.0.0.0:' + PORT);
  console.log('   数据文件:', DATA_FILE);
});
