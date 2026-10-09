#!/usr/bin/env bash
# ============================================================
# 阳澄湖·蟹逅之旅 —— 阿里云 ECS 一键部署脚本
# 用法：把整个项目文件夹上传到服务器后，进入该目录执行：
#        bash deploy.sh
# 自定义端口： PORT=80 bash deploy.sh
# ============================================================
set -e
PORT="${PORT:-3001}"
cd "$(dirname "$0")"

echo "==> [1/4] 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "    未检测到 Node，开始安装 Node 20…"
  if command -v apt >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
    sudo dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
    sudo yum install -y nodejs
  else
    echo "    !! 无法自动识别包管理器，请手动安装 Node 后重跑本脚本"; exit 1
  fi
fi
echo "    Node 版本: $(node -v)"

echo "==> [2/4] 安装 pm2（进程守护，掉线/重启自动拉起）"
command -v pm2 >/dev/null 2>&1 || sudo npm i -g pm2

echo "==> [3/4] 放行系统防火墙端口 $PORT（若防火墙开启）"
if command -v firewall-cmd >/dev/null 2>&1 && sudo firewall-cmd --state >/dev/null 2>&1; then
  sudo firewall-cmd --permanent --add-port=${PORT}/tcp >/dev/null 2>&1 || true
  sudo firewall-cmd --reload >/dev/null 2>&1 || true
elif command -v ufw >/dev/null 2>&1; then
  sudo ufw allow ${PORT}/tcp >/dev/null 2>&1 || true
fi

echo "==> [4/4] 启动服务 (端口 $PORT)"
PORT=$PORT pm2 start server.js --name yangcheng --update-env 2>/dev/null \
  || PORT=$PORT pm2 restart yangcheng --update-env
pm2 save >/dev/null 2>&1 || true
# 开机自启（best-effort，失败不影响本次运行）
sudo env PATH=$PATH:"$(dirname "$(command -v node)")" pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true

# 探测公网 IP（阿里云内网元数据优先，再退回公网服务）
IP=$(curl -s --max-time 2 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)
[ -z "$IP" ] && IP=$(curl -s --max-time 2 http://100.100.100.200/latest/meta-data/public-ipv4 2>/dev/null || true)
[ -z "$IP" ] && IP=$(curl -s --max-time 3 cip.cc 2>/dev/null | awk '/IP/{print $3; exit}' || true)
[ -z "$IP" ] && IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || true)

echo ""
echo "============================================================"
echo "✅ 部署完成！访问地址： http://${IP:-<你的公网IP>}:${PORT}"
echo ""
echo "⚠️  最后一步（在浏览器里做，脚本代替不了）："
echo "    阿里云控制台 → 该实例 → 安全组 → 配置规则 → 入方向"
echo "    添加：协议 TCP，端口 ${PORT}，授权对象 0.0.0.0/0"
echo "    否则外网 / 朋友手机打不开！"
echo ""
echo "常用命令： pm2 logs yangcheng | pm2 restart yangcheng | pm2 stop yangcheng"
echo "============================================================"
