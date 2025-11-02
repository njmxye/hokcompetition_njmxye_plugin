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
          reg: '^#比赛$',
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
          
          await page.waitForTimeout(3000);
          
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
#比赛 - 访问比赛

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
      
      // 先跳转到创建比赛页面
      try {
        await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/views/match-create/create/index?createType=1', {
          waitUntil: 'networkidle2',
          timeout: 15000
        });
        
        // 等待页面完全加载
        await page.waitForTimeout(3000);
        
        // 获取页面中的iframe
        const iframeElement = await page.waitForSelector('iframe.web-iframe', { timeout: 10000 });
        if (!iframeElement) {
          await browser.close();
          return;
        }
        
        // 切换到iframe内部
        const frame = await iframeElement.contentFrame();
        if (!frame) {
          await browser.close();
          return;
        }
        
        // 等待iframe内容加载
        await frame.waitForTimeout(3000);
        
        // 等待并点击比赛赛制选项（在iframe内部）
        try {
          // 通过文本内容"比赛赛制"来定位元素
          await frame.waitForSelector('div.info-normal-item', { timeout: 10000 });
          const matchFormat = await frame.evaluateHandle(() => {
            const items = document.querySelectorAll('div.info-normal-item');
            for (const item of items) {
              const text = item.textContent || '';
              if (text.includes('比赛赛制')) {
                return item;
              }
            }
            return null;
          });
          
          if (matchFormat) {
            // 使用更可靠的点击方式，模拟真实用户点击
            await frame.evaluate((element) => {
              // 先聚焦元素
              element.focus();
              // 模拟鼠标按下
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              // 模拟鼠标抬起
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                // 触发点击事件
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, matchFormat);
            
            // 等待页面响应
            await frame.waitForTimeout(3000);
          }
        } catch (err) {
          // 静默处理错误
        }
        
        // 等待加载完成
        await frame.waitForTimeout(3000);
        
        // 等待并点击快速赛选项（在iframe内部）
        try {
          // 先滚动列表到底部，确保快速赛选项可见
          await frame.evaluate(() => {
            // 查找可滚动的容器，使用稳定的类名
            const scrollContainer = document.querySelector('.tip-match-popup-group-scroll');
            
            if (scrollContainer) {
              // 滚动到底部
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
              
              // 模拟多次滚动，确保内容完全加载
              let scrollCount = 0;
              const scrollInterval = setInterval(() => {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
                scrollCount++;
                
                if (scrollCount >= 5) {
                  clearInterval(scrollInterval);
                }
              }, 500);
            }
          });
          
          // 等待滚动完成和内容加载
          await frame.waitForTimeout(3000);
          
          // 通过文本内容"快速赛"来定位元素
          await frame.waitForSelector('.tip-match-popup-press-wrap', { timeout: 10000 });
          const quickMatchClicked = await frame.evaluate(() => {
            // 查找所有赛制选项
            const options = document.querySelectorAll('.tip-match-popup-press-wrap');
            for (const option of options) {
              // 查找标题元素
              const titleElement = option.querySelector('.tip-match-type-name');
              if (titleElement && titleElement.textContent.includes('快速赛')) {
                // 查找可点击的label元素
                const labelElement = option.querySelector('.label');
                if (labelElement) {
                  // 先聚焦元素
                  labelElement.focus();
                  
                  // 模拟鼠标按下
                  const mouseDownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  labelElement.dispatchEvent(mouseDownEvent);
                  
                  // 模拟鼠标抬起
                  setTimeout(() => {
                    const mouseUpEvent = new MouseEvent('mouseup', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(mouseUpEvent);
                    
                    // 触发点击事件
                    const clickEvent = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(clickEvent);
                  }, 100);
                  
                  // 检查是否成功添加checked类
                  setTimeout(() => {
                    if (labelElement.classList.contains('checked')) {
                      console.log('快速赛选项已选中');
                    } else {
                      console.log('快速赛选项未选中，尝试直接点击');
                      // 如果没有选中，尝试直接调用click方法
                      labelElement.click();
                    }
                  }, 500);
                  
                  return true;
                }
              }
            }
            return false;
          });
          
          if (quickMatchClicked) {
            // 等待页面响应
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
          // 静默处理错误
        }
        
        // 等待选择完成
        await frame.waitForTimeout(3000);
        
        // 检查是否成功选择快速赛（在iframe内部）
        const isQuickMatchSelected = await frame.evaluate(() => {
          // 查找所有赛制选项
          const options = document.querySelectorAll('.tip-match-popup-press-wrap');
          for (const option of options) {
            // 查找标题元素
            const titleElement = option.querySelector('.tip-match-type-name');
            if (titleElement && titleElement.textContent.includes('快速赛')) {
              // 检查是否有checked类
              const labelElement = option.querySelector('.label');
              return labelElement && labelElement.classList.contains('checked');
            }
          }
          return false;
        });
        
        if (!isQuickMatchSelected) {
          // 如果没有选中，再尝试点击一次
          try {
            const quickMatchClickedAgain = await frame.evaluate(() => {
              // 查找所有赛制选项
              const options = document.querySelectorAll('.tip-match-popup-press-wrap');
              for (const option of options) {
                // 查找标题元素
                const titleElement = option.querySelector('.tip-match-type-name');
                if (titleElement && titleElement.textContent.includes('快速赛')) {
                  // 查找可点击的label元素
                  const labelElement = option.querySelector('.label');
                  if (labelElement) {
                    // 先聚焦元素
                    labelElement.focus();
                    
                    // 模拟鼠标按下
                    const mouseDownEvent = new MouseEvent('mousedown', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(mouseDownEvent);
                    
                    // 模拟鼠标抬起
                    setTimeout(() => {
                      const mouseUpEvent = new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                      });
                      labelElement.dispatchEvent(mouseUpEvent);
                      
                      // 触发点击事件
                      const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                      });
                      labelElement.dispatchEvent(clickEvent);
                    }, 100);
                    
                    // 检查是否成功添加checked类
                    setTimeout(() => {
                      if (labelElement.classList.contains('checked')) {
                        console.log('快速赛选项已选中');
                      } else {
                        console.log('快速赛选项未选中，尝试直接点击');
                        // 如果没有选中，尝试直接调用click方法
                        labelElement.click();
                      }
                    }, 500);
                    
                    return true;
                  }
                }
              }
              return false;
            });
          } catch (err) {
            // 静默处理错误
          }
          await frame.waitForTimeout(3000);
        }
        
        // 等待并点击确定按钮（在iframe内部）
        try {
          // 通过文本内容"确定"来定位元素
          await frame.waitForSelector('div.btn-primary', { timeout: 10000 });
          const confirmBtn = await frame.evaluateHandle(() => {
            const buttons = document.querySelectorAll('div.btn-primary');
            for (const button of buttons) {
              const text = button.textContent || '';
              if (text.includes('确定')) {
                return button;
              }
            }
            return null;
          });
          
          if (confirmBtn) {
            // 使用更可靠的点击方式，模拟真实用户点击
            await frame.evaluate((element) => {
              // 先聚焦元素
              element.focus();
              // 模拟鼠标按下
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              // 模拟鼠标抬起
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                // 触发点击事件
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, confirmBtn);
            
            // 等待页面响应
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
          // 静默处理错误
        }
        
        // 等待页面响应
        await frame.waitForTimeout(3000);
        
        // 等待并点击创建比赛按钮（在iframe内部）
        try {
          // 通过文本内容"创建比赛"来定位元素
          await frame.waitForSelector('uni-button', { timeout: 10000 });
          const createMatchBtn = await frame.evaluateHandle(() => {
            const buttons = document.querySelectorAll('uni-button');
            for (const button of buttons) {
              const text = button.textContent || '';
              if (text.includes('创建比赛')) {
                return button;
              }
            }
            return null;
          });
          
          if (createMatchBtn) {
            // 使用更可靠的点击方式，模拟真实用户点击
            await frame.evaluate((element) => {
              // 先聚焦元素
              element.focus();
              // 模拟鼠标按下
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              // 模拟鼠标抬起
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                // 触发点击事件
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, createMatchBtn);
            
            // 等待页面响应
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
          // 静默处理错误
        }
        
        // 等待页面加载完成
        await frame.waitForTimeout(3000);
        
      } catch (err) {
        await browser.close();
        return;
      }
      
      // 最终截图
      const finalScreenshot = await page.screenshot({ encoding: 'base64' });
      e.reply(segment.image(`base64://${finalScreenshot}`));
      
      // 更新最后活跃时间
      accountsData[accountId].lastActive = new Date().toISOString();
      fs.writeFileSync(dataPath, JSON.stringify(accountsData, null, 2));
      
      e.reply(`已访问比赛并创建比赛\n当前账号: ${account.qqName}(${account.qqId})`);
      
      // 关闭浏览器
      await browser.close();
      
    } catch (error) {
      logger.error(`比赛访问错误: ${error}`);
      e.reply(`访问主页失败: ${error.message}`);
    }
  }
}
