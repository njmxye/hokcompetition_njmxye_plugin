import puppeteer from 'puppeteer';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

const _path = process.cwd();
const configPath = path.join(_path, '/plugins/hokcompetition_njmxye_plugin/config/config.yaml');
const dataPath = path.join(_path, '/plugins/hokcompetition_njmxye_plugin/data/accounts.json');
let config = {};

// 确保数据目录存在
const dataDir = path.join(_path, '/plugins/hokcompetition_njmxye_plugin/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化账号数据
let accountsData = {};
try {
  if (fs.existsSync(dataPath)) {
    accountsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
} catch (e) {
  logger.error(`王者赛宝插件账号数据读取错误: ${e}`);
  accountsData = {};
}

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
        },
        {
          reg: '^#赛宝账号$',
          fnc: 'accountList'
        },
        {
          reg: '^#赛宝主页$',
          fnc: 'homePage'
        }
      ]
    })
  }

  async login(e) {
    try {
      const browserConfig = config.browser || {};
      const loginConfig = config.login || {};
      const userId = e.user_id;
      
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
          
          // 获取登录后的用户信息和cookies
          const cookies = await page.cookies();
          
          // 确保cookies有正确的域名和路径
          const processedCookies = cookies.map(cookie => {
            // 如果没有域名，设置为当前域名
            if (!cookie.domain) {
              cookie.domain = '.qq.com';
            }
            // 如果没有路径，设置为根路径
            if (!cookie.path) {
              cookie.path = '/';
            }
            // 确保httpOnly和secure标志正确设置
            if (cookie.name.includes('S') || cookie.name.includes('token')) {
              cookie.httpOnly = true;
              cookie.secure = true;
            }
            return cookie;
          });
          
          const userInfo = await page.evaluate(() => {
            // 尝试多种方式获取用户昵称
            const selectors = [
              '.user-name',
              '.nickname',
              '.username',
              '.user-info',
              '.profile-name',
              '.avatar-name',
              '[data-nickname]',
              '.nick'
            ];
            
            let nickname = '未知用户';
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent && element.textContent.trim()) {
                nickname = element.textContent.trim();
                break;
              }
            }
            
            return {
              nickname: nickname,
              url: window.location.href
            };
          });
          
          // 生成唯一ID
          // 生成简单数字ID
let nextId = accountsData._nextId || 1;
const accountId = nextId.toString();
accountsData._nextId = nextId + 1;
          
          // 检查是否已有该QQ号的账号，如果有则删除旧的
            const existingAccountIds = Object.keys(accountsData).filter(id => 
              id !== '_nextId' && accountsData[id].qqId === userId
            );
            
            if (existingAccountIds.length > 0) {
              // 删除旧账号
              for (const oldAccountId of existingAccountIds) {
                delete accountsData[oldAccountId];
              }
              e.reply(`已替换旧的登录信息，之前登录的账号已被移除`);
            }
            
            // 保存账号信息
            accountsData[accountId] = {
              qqId: userId,
              qqName: e.sender.card || e.sender.nickname,
              cookies: processedCookies,
              loginTime: new Date().toISOString(),
              lastActive: new Date().toISOString()
            };
          
          // 保存到文件
          fs.writeFileSync(dataPath, JSON.stringify(accountsData, null, 2));
          
          await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/', {
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          
          await page.waitForTimeout(loginConfig.login_wait || 3000);
          
          const loginScreenshot = await page.screenshot({ encoding: 'base64' });
          e.reply(segment.image(`base64://${loginScreenshot}`));
          e.reply(`登录成功！账号信息已保存\n账号ID: ${accountId}`);
          
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
    const helpMessage = `
王者赛宝插件使用说明：

命令列表：
#赛宝登录 - 登录王者赛宝账号（适用于新用户或token过期用户）
#赛宝账号 - 查看已保存的账号列表
#赛宝主页 - 访问王者赛宝主页

功能说明：
1. 自动账号管理：系统会自动识别您的QQ号，并匹配对应的赛宝账号
2. 无需手动切换：使用任何命令时，系统会自动切换到您的账号
3. 登录流程：#赛宝登录命令会引导您完成完整的登录流程
4. 多用户支持：支持多个QQ用户同时使用，各自管理自己的账号

注意事项：
- #赛宝登录适用于新用户或token过期的用户
- 登录成功后，系统会自动保存您的账号信息
- 如果您已有账号但token过期，请使用#赛宝登录重新登录
- 如遇到问题，请联系管理员
    `;
    
    e.reply(helpMessage);
  }



  async accountList(e) {
    try {
      const userId = e.user_id;
      
      // 获取当前用户的所有账号
      const userAccounts = Object.entries(accountsData).filter(([id, account]) => id !== '_nextId' && account.qqId === userId);
      
      if (userAccounts.length === 0) {
        e.reply('当前没有保存的账号信息');
        return;
      }
      
      // 构建账号列表
      let listMsg = '账号列表：\n';
      userAccounts.forEach(([id, account], index) => {
        const loginTime = new Date(account.loginTime).toLocaleString();
        const lastActive = new Date(account.lastActive).toLocaleString();
        listMsg += `\nID: ${id}`;
        listMsg += `\nQQ: ${account.qqName}(${account.qqId})`;
        listMsg += `\n登录时间: ${loginTime}`;
        listMsg += `\n最后活跃: ${lastActive}`;
        listMsg += `\n${index < userAccounts.length - 1 ? '---' : ''}`;
      });
      
      e.reply(listMsg);
    } catch (error) {
      logger.error(`王者赛宝账号列表错误: ${error}`);
      e.reply(`获取账号列表失败: ${error.message}`);
    }
  }




  async homePage(e) {
    try {
      const browserConfig = config.browser || {};
      const userId = e.user_id;
      
      // 检查是否有保存的账号信息
      const existingAccounts = Object.entries(accountsData).filter(([id, account]) => account.qqId === userId);
      
      // 如果没有账号信息，自动调用登录
      if (existingAccounts.length === 0) {
        await this.login(e);
        return;
      }
      
      // 使用最后活跃的账号
      const [accountId, account] = existingAccounts.sort((a, b) => 
        new Date(b[1].lastActive) - new Date(a[1].lastActive)
      )[0];
      
      // 启动浏览器
      const browser = await puppeteer.launch({
        headless: browserConfig.headless !== undefined ? browserConfig.headless : false,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const page = await browser.newPage();
      
      // 设置用户代理
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 设置视口大小
      await page.setViewport({ 
        width: browserConfig.width || 1280, 
        height: browserConfig.height || 720 
      });
      
      // 先访问登录页面域名，确保cookies可以正确设置
      await page.goto('https://h5.nes.smoba.qq.com/', {
        waitUntil: 'networkidle2',
        timeout: 10000
      });
      
      // 设置cookies，使用之前保存的登录状态
      await page.setCookie(...account.cookies);
      
      // 直接访问主页
      await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/', {
        waitUntil: 'networkidle2',
        timeout: browserConfig.timeout || 30000
      });
      
      // 等待页面加载
      await page.waitForTimeout(3000);
      
      // 截图并发送
      const screenshot = await page.screenshot({ encoding: 'base64' });
      e.reply(segment.image(`base64://${screenshot}`));
      
      // 更新最后活跃时间
      accountsData[accountId].lastActive = new Date().toISOString();
      fs.writeFileSync(dataPath, JSON.stringify(accountsData, null, 2));
      
      e.reply(`已访问王者赛宝主页\n当前账号: ${account.qqName}(${account.qqId})`);
      
      // 关闭浏览器
      await browser.close();
      
    } catch (error) {
      logger.error(`王者赛宝主页访问错误: ${error}`);
      e.reply(`访问主页失败: ${error.message}`);
    }
  }
}
