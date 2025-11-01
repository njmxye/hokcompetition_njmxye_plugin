import puppeteer from 'puppeteer';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

const _path = process.cwd();
const configPath = path.join(_path, '/plugins/hokcompetition_njmxye_plugin/config/config.yaml');
let config = {};

try {
  if (fs.existsSync(configPath)) {
    config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  logger.error(`王者赛宝插件配置文件读取错误: ${e}`);
}

export class WangZheSaiBao extends plugin {
  constructor() {
    super({
      name: '[王者赛宝]登录功能',
      dsc: '王者赛宝登录功能',
      event: 'message',
      priority: 1145,
      rule: [
        {
          reg: '^#赛宝登录$',
          fnc: 'login'
        },
        {
          reg: '^#赛宝帮助$',
          fnc: 'help'
        }
      ]
    })
  }

  async login(e) {
    try {
      const browserConfig = config.browser || {};
      const loginConfig = config.login || {};
      
      const browser = await puppeteer.launch({
        headless: browserConfig.headless !== undefined ? browserConfig.headless : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      await page.setViewport({ 
        width: browserConfig.width || 1280, 
        height: browserConfig.height || 720 
      });
      
      await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/views/other/third-plat-login/index', {
        waitUntil: 'networkidle2',
        timeout: browserConfig.timeout || 30000
      });
      
      await page.waitForTimeout(loginConfig.wait_time || 3000);
      
      const qqLoginButton = await page.evaluateHandle(() => {
        const buttons = document.querySelectorAll('.btn-item');
        for (const button of buttons) {
          const text = button.textContent.trim();
          if (text.includes('QQ登录')) {
            return button;
          }
        }
        return null;
      });
      
      if (qqLoginButton.asElement()) {
        await qqLoginButton.asElement().click();
        
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 15000
          });
        } catch (navError) {
        }
        
        await page.waitForTimeout(3000);
        
        const qrScreenshot = await page.screenshot({ encoding: 'base64' });
        e.reply(segment.image(`base64://${qrScreenshot}`));
        e.reply('请使用手机QQ扫描上方二维码登录，等待登录完成...');
        
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: loginConfig.qr_timeout || 60000
          });
          
          await page.waitForTimeout(2000);
          
          await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/', {
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          
          await page.waitForTimeout(loginConfig.login_wait || 3000);
          
          const loginScreenshot = await page.screenshot({ encoding: 'base64' });
          e.reply(segment.image(`base64://${loginScreenshot}`));
          
        } catch (navError) {
          e.reply('等待登录超时，请重试');
        }
      } else {
        e.reply('未找到QQ登录按钮，可能页面结构已变化');
      }
      
      await browser.close();
      
    } catch (error) {
      logger.error(`王者赛宝登录错误: ${error}`);
      e.reply(`登录过程中发生错误: ${error.message}`);
    }
  }

  async help(e) {
    const helpMsg = `王者赛宝插件 v1.0.0
    
命令：
#赛宝登录 - 自动登录王者赛宝
#赛宝帮助 - 查看帮助信息
    
功能：
- 自动访问王者赛宝登录页面
- 自动点击QQ登录获取二维码
- 等待扫码登录完成
- 截图展示登录后页面
    
配置文件：config/config.yaml
    
作者：njmxye
GitHub：https://github.com/njmxye
QQ交流群：348582328`;
    
    e.reply(helpMsg);
  }
}