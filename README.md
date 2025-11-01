# 王者赛宝插件

基于Yunzai-Bot的王者赛宝登录插件，使用Puppeteer实现自动登录功能。

## 功能

- 自动访问王者赛宝登录页面
- 自动点击QQ登录获取二维码
- 等待用户扫码登录完成
- 截图展示登录后页面状态

## 安装

1. 将插件文件夹放入Yunzai-Bot的plugins目录
2. 安装依赖：`pnpm install`
3. 重启Yunzai-Bot

## 使用方法

- `#赛宝登录` - 启动王者赛宝登录流程
- `#赛宝帮助` - 查看插件帮助信息

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
```

## 依赖

- puppeteer: 浏览器自动化
- js-yaml: 配置文件解析
- chalk: 控制台彩色输出

## 开发

插件结构：
```
hokcompetition_njmxye_plugin/
├── apps/
│   └── hok.js         # 主要功能实现
├── config/
│   └── config.yaml    # 配置文件
├── index.js           # 插件入口
├── package.json       # 项目配置
└── README.md          # 说明文档
```

## 作者

- njmxye
- GitHub: https://github.com/njmxye
- QQ交流群: 348582328

## 许可证

MIT License