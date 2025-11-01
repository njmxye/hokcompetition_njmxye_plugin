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

## 作者

- njmxye
- GitHub: https://github.com/njmxye
- QQ交流群: 348582328

## 许可证

MIT License