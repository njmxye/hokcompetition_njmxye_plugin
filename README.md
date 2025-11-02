# 王者赛宝插件

基于Yunzai-Bot的王者赛宝插件，提供创建比赛对接ffmpeg可以qq群在线看群友内战。随手给群友写的。


## 安装
```
使用Github
git clone --depth=1 https://github.com/njmxye/hokcompetition_njmxye_plugin.git ./plugins/hokcompetition_njmxye_plugin/
安装依赖
pnpm install
```

## 使用方法

- `#赛宝登录` - 启动王者赛宝登录流程
- `#比赛` - 使用最近活跃的账号访问王者赛宝主页
- `#比赛 [ID]` - 使用指定ID的账号访问王者赛宝主页
- `#赛宝账号列表` - 查看已保存的账号信息
- `#赛宝切换账号 [ID]` - 切换到指定ID的账号
- `#赛宝删除账号 [ID]` - 删除指定ID的账号
- `#赛宝帮助` - 查看插件帮助信息

## 功能

- 自动访问王者赛宝登录页面
- 自动点击QQ登录获取二维码
- 等待用户扫码登录完成
- 截图展示登录后页面状态
- 保存登录状态和账号信息
- 使用ID序号管理多个登录账号
- 使用用户QQ号和昵称标注账号
- 使用保存的token直接访问主页
- 支持通过ID切换不同账号访问主页

## 配置

修改`config/config.yaml`文件调整插件设置：

```yaml
# 浏览器设置
browser:
  headless: true  # 无头模式
  width: 1280     # 浏览器宽度
  height: 720     # 浏览器高度
  timeout: 30000  # 页面加载超时时间(ms)

# 登录设置
login:
  wait_time: 3000    # 页面加载等待时间(ms)
  qr_timeout: 60000  # 扫码登录超时时间(ms)
  login_wait: 3000   # 登录成功后等待时间(ms)
  save_cookies: true # 是否保存登录状态

# 数据存储设置
data:
  save_account_info: true  # 是否保存账号信息
  auto_cleanup_days: 30    # 账号信息自动清理天数
```

## 数据存储

插件会在 `data/accounts.json` 文件中保存以下信息：
- 用户昵称
- 登录cookies
- 登录时间
- 最后活跃时间

每个用户的信息独立存储，支持多用户使用。

## 依赖

- puppeteer: 浏览器自动化
- js-yaml: 配置文件解析
- chalk: 控制台彩色输出

## 作者

- njmxye
- GitHub: https://github.com/njmxye
- QQ交流群: 348582328

## 许可证

MIT License