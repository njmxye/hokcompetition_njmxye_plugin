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

const dataDir = path.join(_path, '/plugins/hokcompetition_njmxye_plugin/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
        e.reply('你先登录喵~扫这个二维码');
        
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: loginConfig.qr_timeout || 60000
          });
          
          await page.waitForTimeout(3000);
          
          const cookies = await page.cookies();
          
          const processedCookies = cookies.map(cookie => {
            if (!cookie.domain) {
              cookie.domain = '.qq.com';
            }
            if (!cookie.path) {
              cookie.path = '/';
            }
            if (cookie.name.includes('S') || cookie.name.includes('token')) {
              cookie.httpOnly = true;
              cookie.secure = true;
            }
            return cookie;
          });
          
          const userInfo = await page.evaluate(() => {
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
          
let nextId = accountsData._nextId || 1;
const accountId = nextId.toString();
accountsData._nextId = nextId + 1;
          
            const existingAccountIds = Object.keys(accountsData).filter(id => 
              id !== '_nextId' && accountsData[id].qqId === userId
            );
            
            if (existingAccountIds.length > 0) {
              for (const oldAccountId of existingAccountIds) {
                delete accountsData[oldAccountId];
              }
              e.reply(`正在替换旧的登录信息！`);
            }
            
            accountsData[accountId] = {
              qqId: userId,
              qqName: e.sender.card || e.sender.nickname,
              cookies: processedCookies,
              loginTime: new Date().toISOString(),
              lastActive: new Date().toISOString()
            };
          
          fs.writeFileSync(dataPath, JSON.stringify(accountsData, null, 2));
          
          await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/', {
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          
          await page.waitForTimeout(loginConfig.login_wait || 3000);
          
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
赛宝插件简单说明：

命令：
#赛宝登录 - 登录王者赛宝账号
#赛宝账号 - 查看已保存的账号
#比赛 - 创建比赛房间
#赛宝帮助 - 查看帮助信息

小贴士：
- 新用户或者token过期了用#赛宝登录
- 系统会自动识别你的QQ号
- 不用手动切换账号，系统会自动处理
- 多个用户可以同时用，各用各的

有问题找我喵~楠寻github@njmxye
    `;
    
    e.reply(helpMessage);
  }

  async accountList(e) {
    try {
      const userId = e.user_id;
      
      const userAccounts = Object.entries(accountsData).filter(([id, account]) => id !== '_nextId' && account.qqId === userId);
      
      if (userAccounts.length === 0) {
        e.reply('当前没有保存的账号信息');
        return;
      }
      
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
      e.reply('🎮 正在创建比赛房间，请稍等一下喵~\n⏱️ 房间链接将在30秒内发送给你哦！\n💫 别催别催，马上就好啦~');
      
      const browserConfig = config.browser || {};
      const userId = e.user_id;
      
      const existingAccounts = Object.entries(accountsData).filter(([id, account]) => account.qqId === userId);
      
      if (existingAccounts.length === 0) {
        await this.login(e);
        return;
      }
      
      const [accountId, account] = existingAccounts.sort((a, b) => 
        new Date(b[1].lastActive) - new Date(a[1].lastActive)
      )[0];
      
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
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setViewport({ 
        width: browserConfig.width || 1280, 
        height: browserConfig.height || 720
      });
      
      await page.goto('https://h5.nes.smoba.qq.com/', {
        waitUntil: 'networkidle2',
        timeout: 10000
      });
      
      await page.setCookie(...account.cookies);
      
      try {
        await page.goto('https://h5.nes.smoba.qq.com/pvpesport.next.user/views/match-create/create/index?createType=1', {
          waitUntil: 'networkidle2',
          timeout: 15000
        });
        
        await page.waitForTimeout(3000);
        
        const iframeElement = await page.waitForSelector('iframe.web-iframe', { timeout: 10000 });
        if (!iframeElement) {
          await browser.close();
          return;
        }
        
        const frame = await iframeElement.contentFrame();
        if (!frame) {
          await browser.close();
          return;
        }
        
        await frame.waitForTimeout(1500);
        
        try {
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
            await frame.evaluate((element) => {
              element.focus();
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, matchFormat);
            
        await frame.waitForTimeout(1500);
          }
        } catch (err) {
        }
        
        await frame.waitForTimeout(1500);
        
        try {
          await frame.evaluate(() => {
            const scrollContainer = document.querySelector('.tip-match-popup-group-scroll');
            
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
              
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
          
          await frame.waitForTimeout(1500);
          
          await frame.waitForSelector('.tip-match-popup-press-wrap', { timeout: 10000 });
          const quickMatchClicked = await frame.evaluate(() => {
            const options = document.querySelectorAll('.tip-match-popup-press-wrap');
            for (const option of options) {
              const titleElement = option.querySelector('.tip-match-type-name');
              if (titleElement && titleElement.textContent.includes('快速赛')) {
                const labelElement = option.querySelector('.label');
                if (labelElement) {
                  labelElement.focus();
                  
                  const mouseDownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  labelElement.dispatchEvent(mouseDownEvent);
                  
                  setTimeout(() => {
                    const mouseUpEvent = new MouseEvent('mouseup', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(mouseUpEvent);
                    
                    const clickEvent = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(clickEvent);
                  }, 100);
                  
                  setTimeout(() => {
                    if (labelElement.classList.contains('checked')) {
                      console.log('快速赛选项已选中');
                    } else {
                      console.log('快速赛选项未选中，尝试直接点击');
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
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
        }
        
        await frame.waitForTimeout(3000);
        
        const isQuickMatchSelected = await frame.evaluate(() => {
          const options = document.querySelectorAll('.tip-match-popup-press-wrap');
          for (const option of options) {
            const titleElement = option.querySelector('.tip-match-type-name');
            if (titleElement && titleElement.textContent.includes('快速赛')) {
              const labelElement = option.querySelector('.label');
              return labelElement && labelElement.classList.contains('checked');
            }
          }
          return false;
        });
        
        if (!isQuickMatchSelected) {
          try {
            const quickMatchClickedAgain = await frame.evaluate(() => {
              const options = document.querySelectorAll('.tip-match-popup-press-wrap');
              for (const option of options) {
                const titleElement = option.querySelector('.tip-match-type-name');
                if (titleElement && titleElement.textContent.includes('快速赛')) {
                  const labelElement = option.querySelector('.label');
                  if (labelElement) {
                    labelElement.focus();
                    
                    const mouseDownEvent = new MouseEvent('mousedown', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    labelElement.dispatchEvent(mouseDownEvent);
                    
                    setTimeout(() => {
                      const mouseUpEvent = new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                      });
                      labelElement.dispatchEvent(mouseUpEvent);
                      
                      const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                      });
                      labelElement.dispatchEvent(clickEvent);
                    }, 100);
                    
                    setTimeout(() => {
                      if (labelElement.classList.contains('checked')) {
                        console.log('快速赛选项已选中');
                      } else {
                        console.log('快速赛选项未选中，尝试直接点击');
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
          }
          await frame.waitForTimeout(3000);
        }
        
        try {
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
            await frame.evaluate((element) => {
              element.focus();
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, confirmBtn);
            
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
        }
        
        await frame.waitForTimeout(3000);
        
        try {
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
            await frame.evaluate((element) => {
              element.focus();
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(mouseDownEvent);
              
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(mouseUpEvent);
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
            }, createMatchBtn);
            
          await frame.waitForTimeout(3000);
          }
        } catch (err) {
        }
        
        await frame.waitForTimeout(3000);
        
        try {
          await frame.waitForSelector('div.press-popup__left', { timeout: 10000 });
          const closeBtnClicked = await frame.evaluate(() => {
            const closeBtnElement = document.querySelector('div.press-popup__left');
            if (closeBtnElement) {
              closeBtnElement.focus();
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              closeBtnElement.dispatchEvent(mouseDownEvent);
              
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                closeBtnElement.dispatchEvent(mouseUpEvent);
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                closeBtnElement.dispatchEvent(clickEvent);
              }, 100);
              
              return true;
            }
            return false;
          });
          
          if (closeBtnClicked) {
            await frame.waitForTimeout(1000);
          }
        } catch (err) {
        }
        
        try {
          await frame.waitForSelector('div.match-qr-code-tip', { timeout: 10000 });
          const qrCodeClicked = await frame.evaluate(() => {
            const qrCodeElement = document.querySelector('div.match-qr-code-tip');
            if (qrCodeElement) {
              qrCodeElement.focus();
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              qrCodeElement.dispatchEvent(mouseDownEvent);
              
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                qrCodeElement.dispatchEvent(mouseUpEvent);
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                qrCodeElement.dispatchEvent(clickEvent);
              }, 100);
              
              return true;
            }
            return false;
          });
          
          if (qrCodeClicked) {
            await frame.waitForTimeout(1000);
            
            try {
                const pageScreenshot = await page.screenshot({
                  type: 'jpeg',
                  quality: 80,
                  clip: {
                    x: 0,
                    y: 0,
                    width: page.viewport().width * 0.363,
                    height: page.viewport().height
                  }
                });
                e.reply(segment.image(pageScreenshot));
              } catch (err) {
              }
          }
        } catch (err) {
        }
        
      } catch (err) {
        await browser.close();
        return;
      }
      
      accountsData[accountId].lastActive = new Date().toISOString();
      fs.writeFileSync(dataPath, JSON.stringify(accountsData, null, 2));
      
      const currentUrl = page.url();
      const urlObj = new URL(currentUrl);
      const pathParam = urlObj.searchParams.get('path');
      
      if (pathParam && pathParam !== 'https://h5.nes.smoba.qq.com/pvpesport.next.user/views/match-create/create/index?createType=1') {
        e.reply(`🏆 比赛房间创建成功啦！\n🔗 点击这里或者扫描二维码进入比赛喵~\n${pathParam}\n🎉 祝你力压群雄，取得好成绩哦！`);
      } else {
        e.reply(`🆘 比赛创建失败了！\n🤖 触发了腾讯风控验证码！\n💡 据我所知动态风控过段时间会自动解除，你可以等待十分钟。\n🤓🤓🤓如果你着急的话，点击链接手动建房${pathParam}\n🔄 `);
        const pageScreenshot1 = await page.screenshot({
            type: 'jpeg',
            quality: 80,
            clip: {
                x: 0,
                y: 0,
                width: page.viewport().width * 0.363,
                height: page.viewport().height
            }
        });
        e.reply(segment.image(pageScreenshot1));
      }
      
      await browser.close();
      
    } catch (error) {
      logger.error(`比赛访问错误: ${error}`);
      e.reply(`访问主页失败: ${error.message}`);
    }
  }
}