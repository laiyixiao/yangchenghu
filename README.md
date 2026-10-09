# 阳澄湖·蟹逅之旅 🦀（多人实时同步版）

13人 2天1夜阳澄湖团建（苏州凯悦 · 10.17–10.18）的综合旅游网页。
投票 / 记账 / 行程想法 / 留言 **多人实时同步**，朋友手机点链接即用、**零登录**。

## 功能
- **出发投票 + 车辆分配**：市区 / 金山 / 都可以；勾"我有车"自动成为司机（每车 4 人含司机），没车的人选一辆还有空位的车加入，满员自动禁选。
- **记账 AA 分摊**：记录花费 → 分类环形图 → 自动算出"谁该给谁、转账次数最少"。
- **行程安排**：Day1 / Day2 时间轴 + 返程途中古镇推荐。
- **行程想法墙**：谁有想法都能带名字贴上去，可标注关联环节。
- **工具**：倒计时、阳澄湖实时天气、行李清单（个人）、群留言板。

## 架构（零依赖，不用 npm install）
```
yangcheng-lake-trip/
├─ index.html   前端单文件（通过 /api 和后端通信，每 4 秒自动同步）
├─ server.js    零依赖 Node 后端（托管 index.html + 提供 /api）
├─ data.json    运行后自动生成，所有共享数据都在这（备份=复制它）
└─ README.md
```
> 行李清单的勾选是「个人」数据，存在各自手机浏览器里，不进服务器。

## 本地测试
需要 Node（任意较新版本）：
```bash
cd yangcheng-lake-trip
node server.js
# 浏览器打开 http://localhost:3000
```
> 注意：现在是联网版，**不能再直接双击 index.html 打开**（那样 /api 无法访问）。本地测试必须通过上面的命令跑起来。

---

## 部署到阿里云 ECS（云服务器 / 轻量应用服务器）

### 🚀 一键脚本（推荐）
把项目文件夹上传到服务器后，进入目录执行即可（自动装 Node + pm2、开防火墙、启动、设开机自启）：
```bash
cd /root/yangcheng-lake-trip
bash deploy.sh          # 想用 80 端口： PORT=80 bash deploy.sh
```
> 脚本代替不了的唯一一步：到**阿里云控制台→安全组**放行 TCP 3000 端口（见下方第 3 步）。

---
下面是手动分步（想了解细节或脚本失败时用）：

### 1) 服务器装 Node（若已装可跳过，先 `node -v` 看看）
```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# CentOS / Alibaba Cloud Linux
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### 2) 上传项目（在你本机电脑执行）
```bash
scp -r "yangcheng-lake-trip" root@<你的公网IP>:/root/
```
> 也可用阿里云的「宝塔面板 / Workbench 文件上传 / git」。

### 3) 放行端口（关键，否则朋友访问不了）
- **阿里云控制台** → 该实例 → **安全组** → 配置规则 → 入方向 → 手动添加：
  协议 **TCP**，端口 **3000**，授权对象 **0.0.0.0/0**。
- 如果服务器系统防火墙开着，也要放行：
  ```bash
  # firewalld（CentOS/Alinux）
  sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload
  # ufw（Ubuntu）
  sudo ufw allow 3000/tcp
  ```

### 4) 启动（后台常驻，推荐 pm2 开机自启）
```bash
cd /root/yangcheng-lake-trip
sudo npm i -g pm2
pm2 start server.js --name yangcheng
pm2 save
pm2 startup        # 按提示再执行它打印的那条命令，实现开机自启
```
查看日志 / 重启 / 停止：
```bash
pm2 logs yangcheng
pm2 restart yangcheng
pm2 stop yangcheng
```
> 不想装 pm2 的极简版：`nohup node server.js > app.log 2>&1 &`

### 5) 把链接发群里
```
http://<你的公网IP>:3000
```
13 个人手机点开即可一起投票 / 记账 🦀。

---

## 常见问题
- **想用 80 端口**（链接不带 `:3000`）：`PORT=80 pm2 start server.js --name yangcheng`（需 root）。注意：用**域名** + 80/443 需完成 ICP 备案；**直接用公网 IP + 3000 端口不需要备案**，最省事。
- **清空全部数据**：`pm2 stop yangcheng && rm data.json && pm2 start yangcheng`。
- **备份数据**：复制 `data.json` 即可。
- **改每车人数**：改 `server.js` 和 `index.html` 里的 `CAR_CAP`（两处要一致）后重启。
- **天气不显示**：天气来自 open-meteo 公共接口，服务器需能访问外网 https；拉取失败会显示参考值，不影响其他功能。
