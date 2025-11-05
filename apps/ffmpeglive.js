import fs from 'fs'
import { spawn } from 'child_process'
import path from 'path'

// 随机打乱音乐列表
function shuffleMusicList() {
  const musicDir = './plugins/hokcompetition_njmxye_plugin/resources/music'
  const musicListPath = path.join(musicDir, 'music_list.txt')
  
  // 检查音乐目录是否存在
  if (!fs.existsSync(musicDir)) {
    logger.error(`❌ 音乐目录不存在: ${musicDir}`)
    return false
  }
  
  // 读取音乐目录中的所有mp3文件
  const musicFiles = fs.readdirSync(musicDir)
    .filter(file => file.endsWith('.mp3'))
    .map(file => `file './${file}'`)
  
  if (musicFiles.length === 0) {
    logger.error(`❌ 音乐目录中没有找到mp3文件: ${musicDir}`)
    return false
  }
  
  // 随机打乱音乐文件列表
  for (let i = musicFiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [musicFiles[i], musicFiles[j]] = [musicFiles[j], musicFiles[i]];
  }
  
  // 写入打乱后的列表到文件
  try {
    fs.writeFileSync(musicListPath, musicFiles.join('\n'), 'utf-8')
    logger.info(`🎵 音乐列表已随机更新，共${musicFiles.length}首歌曲`)
    return true
  } catch (err) {
    logger.error(`❌ 更新音乐列表失败: ${err.message}`)
    return false
  }
}

// 推流进程类
class StreamProcess {
  constructor(id, sourceUrl, targetUrl, isKeepAlive = false) {
    this.id = id
    this.sourceUrl = sourceUrl
    this.targetUrl = targetUrl
    this.process = null
    this.status = '未启动'
    this.isKeepAlive = isKeepAlive // 标记是否为保活流
    this.parentStreamId = null // 如果是保活流，记录原始流的ID
  }

  start() {
    if (this.status === '运行中') return `❌ ID: ${this.id} 推流已在运行`

    // 如果不是保活流，检查是否已有推流在运行
    if (!this.isKeepAlive) {
      const runningStream = streamList.find(s => s.status === '运行中')
      if (runningStream) {
        // 如果已有推流在运行，停止它（可能是保活流）
        runningStream.stop()
        logger.info(`🔄 已停止现有推流ID: ${runningStream.id}，为新推流腾出位置`)
      }
    }

    // 构建音乐文件路径
    const musicListPath = './plugins/hokcompetition_njmxye_plugin/resources/music'
    
    // 每次启动推流前随机打乱音乐列表
    if (!shuffleMusicList()) {
      return `❌ ID: ${this.id} 音乐列表更新失败，无法启动推流`
    }
    
    // 检查音乐列表文件是否存在
    if (!fs.existsSync(musicListPath)) {
      return `❌ ID: ${this.id} 音乐列表文件不存在: ${musicListPath}\n请确保./plugins/hokcompetition_njmxye_plugin/resources/music/music_list.txt文件存在`
    }

    // 更新的FFmpeg命令，添加音乐混合功能
    const args = [
      '-i', this.sourceUrl,                    // 输入源流
      '-re',                                   // 读取输入按其帧速率
      '-stream_loop', '-1',                    // 无限循环音乐
      '-f', 'concat',                          // 使用concat格式
      '-safe', '0',                            // 允许不安全的文件路径
      '-i', musicListPath,                     // 音乐列表文件
      '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest,volume=0.8', // 混合音频
      '-c:v', 'copy',                          // 视频流直接复制
      '-maxrate', '5000k',                     // 最大比特率
      '-bufsize', '6000k',                     // 缓冲区大小
      '-c:a', 'aac',                           // 音频编码为AAC
      '-b:a', '64k',                           // 音频比特率
      '-threads', '1',                         // 使用单线程
      '-f', 'flv',                             // 输出格式为FLV
      this.targetUrl                           // 输出目标
    ]
    
    this.process = spawn('ffmpeg', args)
    this.status = '运行中'

    this.process.on('exit', (code, signal) => {
      this.status = '已停止'
      this.process = null
      logger.info(`📢 ID: ${this.id} 推流进程退出，代码: ${code}, 信号: ${signal}`)
      
      // 如果不是保活流且进程异常退出，启动保活机制
      if (!this.isKeepAlive && code !== 0) {
        logger.info(`🔄 ID: ${this.id} 检测到推流异常终止，启动保活机制`)
        this.startKeepAliveStream()
      }
      
      // 如果是保活流且进程退出，重新启动保活流
      if (this.isKeepAlive) {
        logger.info(`🔄 保活流ID: ${this.id} 已退出，重新启动保活流`)
        setTimeout(() => {
          this.startKeepAliveStream()
        }, 3000) // 3秒后重新启动保活流
      }
    })

    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim()
      // 只记录真正的错误信息，忽略常规的推流状态信息
      if (message.includes('Error') || message.includes('error') || message.includes('failed')) {
        logger.error(`⚠️ ID: ${this.id} 推流错误: ${message}`)
      }
    })

    const streamType = this.isKeepAlive ? '保活流' : '正常流'
    return `✅ ID: ${this.id} ${streamType}推流已启动\n📥 来源: ${this.sourceUrl}\n📤 目标: ${this.targetUrl}\n🎵 背景音乐: 已随机排序`
  }

  // 启动保活流
  startKeepAliveStream() {
    // 检查是否已有推流在运行
    const runningStream = streamList.find(s => s.status === '运行中')
    if (runningStream) {
      logger.info(`🔄 已有推流ID: ${runningStream.id} 正在运行，跳过启动保活流`)
      return
    }
    
    // 永久不结束的直播流地址
    const keepAliveUrl = 'rtmp://liteavapp.qcloud.com/live/liteavdemoplayerstreamid'
    
    // 获取目标URL，优先使用原始流的目标URL，如果没有则使用默认
    const targetUrl = this.targetUrl || 'rtmp://livepush.example.com/live/stream'
    
    // 创建保活流实例
    const keepAliveStream = new StreamProcess(
      `${this.id}-keepalive`,
      keepAliveUrl,
      targetUrl,
      true // 标记为保活流
    )
    
    // 设置保活流的父流ID为原始流ID
    keepAliveStream.parentStreamId = this.id
    
    // 启动保活流
    const result = keepAliveStream.start()
    
    // 将保活流添加到流列表
    streamList.push(keepAliveStream)
    
    logger.info(`🛡️ 保活流已启动，原始流ID: ${this.id}`)
    
    return result
  }

  stop() {
    if (this.status !== '运行中') return `❌ ID: ${this.id} 推流未在运行`

    this.process.kill('SIGTERM')
    this.status = '已停止'
    return `✅ ID: ${this.id} 推流已终止`
  }

  getStatusInfo() {
    return {
      id: this.id,
      source: this.sourceUrl,
      target: this.targetUrl,
      status: this.status,
      isKeepAlive: this.isKeepAlive,
      parentStreamId: this.parentStreamId
    }
  }
}

// 全局变量存储用户输入状态
const userInputStatus = {}

// 静态变量存储推流列表，避免插件重新初始化时丢失数据
let streamList = []
let nextStreamId = 1
let refreshTimer = null

// 主插件类
export class LiveStreamPlugin extends plugin {
  constructor() {
    super({
      name: '直播推流插件',
      dsc: '支持多进程FFmpeg推流，含启动/停止/列表查询等功能',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#开始直播$', fnc: 'startStreamFlow' },
        { reg: '^#直播状态$', fnc: 'getStreamList' },
        { reg: '^#清空直播$', fnc: 'clearAllStreams' },
        { reg: '^#直播帮助$', fnc: 'showHelp' },
        { reg: '^(?!#).*', fnc: 'handleStreamInput' } // 匹配所有非指令消息
      ]
    })

    // 使用静态变量而不是实例变量
    this.streamList = streamList
    this.nextStreamId = nextStreamId
    
    this.initPlugin()
  }

  initPlugin() {
    this.loadSettings()
    this.startStatusRefresh()
    
    // 检查是否需要启动保活流
    this.ensureKeepAliveStream()
    
    logger.info('📻 直播推流刷新完成')
  }

  loadSettings() {
    const configPath = './data/liveStream/settings.json'
    if (!fs.existsSync('./data/liveStream')) {
      fs.mkdirSync('./data/liveStream', { recursive: true })
    }
    
    const defaultSettings = {
      autoRefreshInterval: 5000,
      isMasterOnly: 1
    }
    
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8')
        this.settings = { ...defaultSettings, ...JSON.parse(fileContent) }
      } catch (err) {
        logger.error(`⚠️ 读取直播配置失败: ${err.message}`)
        this.settings = { ...defaultSettings }
      }
    } else {
      fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2), 'utf-8')
      this.settings = { ...defaultSettings }
    }
  }

  saveSettings() {
    const configPath = './data/liveStream/settings.json'
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.settings, null, 2), 'utf-8')
      return true
    } catch (err) {
      logger.error(`⚠️ 保存直播配置失败: ${err.message}`)
      return false
    }
  }

  startStatusRefresh() {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(() => {
      streamList.forEach(stream => {
        if (stream.status === '运行中' && !stream.process) {
          stream.status = '已停止'
          logger.warn(`📢 ID: ${stream.id} 推流意外停止`)
        }
      })
    }, this.settings.autoRefreshInterval)
  }

  // 确保保活流运行
  ensureKeepAliveStream() {
    // 检查是否有正在运行的推流
    const runningStream = streamList.find(s => s.status === '运行中')
    
    // 如果没有正在运行的推流，启动保活流
    if (!runningStream) {
      logger.info('🔄 当前无推流运行，启动保活流')
      
      // 永久不结束的直播流地址
      const keepAliveUrl = 'rtmp://liteavapp.qcloud.com/live/liteavdemoplayerstreamid'
      const targetUrl = 'rtmp://livepush.example.com/live/stream'
      
      // 创建保活流实例
      const keepAliveStream = new StreamProcess(
        `keepalive-${Date.now()}`,
        keepAliveUrl,
        targetUrl,
        true // 标记为保活流
      )
      
      // 启动保活流
      const result = keepAliveStream.start()
      
      // 将保活流添加到流列表
      streamList.push(keepAliveStream)
      
      logger.info('🛡️ 保活流已自动启动')
    }
  }

  checkPermission(e) {
    if (this.settings.isMasterOnly === 1 && !e.isMaster) {
      e.reply('❌ 仅主人可操作直播推流功能', true)
      return false
    }
    return true
  }

  // 开始推流流程
  async startStreamFlow(e, sourceUrl = null) {
    if (!this.checkPermission(e)) return
    
    const userId = e.user_id
    
    // 如果提供了比赛流地址，直接跳到输入直播间地址步骤
    if (sourceUrl) {
      userInputStatus[userId] = { step: 'inputTarget', data: { source: sourceUrl } }
      e.reply(`✅ 比赛流地址已自动设置：${sourceUrl}\n📤 请输入【直播间流地址】`, true)
    } else {
      userInputStatus[userId] = { step: 'inputSource', data: {} }
      e.reply('📥 请输入【比赛流地址】（如rtmp://xxx）', true)
    }
  }

  // 处理用户输入
  async handleStreamInput(e) {
    const userId = e.user_id
    const userStatus = userInputStatus[userId]
    
    // 如果用户没有在进行推流流程，则不处理
    if (!userStatus) return false
    
    const input = e.msg.trim()
    
    if (userStatus.step === 'inputSource') {
      if (!input) {
        e.reply('❌ 比赛流地址不能为空', true)
        return true
      }
      
      userStatus.data.source = input
      userStatus.step = 'inputTarget'
      
      e.reply(`✅ 比赛流地址已接收：${input}\n📤 请输入【直播间流地址】`, true)
      return true
    }
    
    if (userStatus.step === 'inputTarget') {
      if (!input) {
        e.reply('❌ 直播间流地址不能为空', true)
        return true
      }
      
      userStatus.data.target = input
      
      // 创建推流实例
      const newStream = new StreamProcess(nextStreamId++, userStatus.data.source, userStatus.data.target)
      streamList.push(newStream)
      
      // 启动推流
      const startResult = newStream.start()
      e.reply(`${startResult}\n💡 可输入#直播状态查看当前推流状态`, true)
      
      // 清除用户状态
      delete userInputStatus[userId]
      return true
    }
    
    return false
  }

  // 查询推流状态
  async getStreamList(e) {
    if (streamList.length === 0) {
      e.reply('📭 当前无任何推流任务', true)
      return
    }

    // 获取当前运行的流
    const runningStream = streamList.find(s => s.status === '运行中')
    
    if (runningStream) {
      const info = runningStream.getStatusInfo()
      const streamType = info.isKeepAlive ? '保活流' : '正常流'
      let statusMsg = `📺 当前直播状态\n━━━━━━━━━━━━━━━━━━━━\n`
      statusMsg += `状态: ${info.status}\n`
      statusMsg += `类型: ${streamType}\n`
      statusMsg += `来源: ${info.source}\n`
      statusMsg += `目标: ${info.target}\n`
      if (info.parentStreamId) {
        statusMsg += `关联原始流ID: ${info.parentStreamId}\n`
      }
      e.reply(statusMsg, true)
    } else {
      e.reply('📭 当前无运行的推流', true)
    }
  }

  // 启动推流
  async controlStreamStart(e) {
    if (!this.checkPermission(e)) return
    const streamId = parseInt(e.msg.replace('#启动推流 ', ''))
    const stream = streamList.find(s => s.id === streamId)
    
    if (!stream) {
      e.reply(`❌ 未找到ID: ${streamId} 的推流`, true)
      return
    }
    
    const result = stream.start()
    e.reply(result, true)
  }

  // 停止推流
  async controlStreamStop(e) {
    if (!this.checkPermission(e)) return
    const streamId = parseInt(e.msg.replace('#停止推流 ', ''))
    const stream = streamList.find(s => s.id === streamId)
    
    if (!stream) {
      e.reply(`❌ 未找到ID: ${streamId} 的推流`, true)
      return
    }
    
    const result = stream.stop()
    e.reply(result, true)
    
    // 停止推流后，确保保活流启动
    setTimeout(() => {
      this.ensureKeepAliveStream()
    }, 3000) // 3秒后检查并启动保活流
  }

  // 删除推流
  async deleteStream(e) {
    if (!this.checkPermission(e)) return
    const streamId = parseInt(e.msg.replace('#删除推流 ', ''))
    const index = streamList.findIndex(s => s.id === streamId)
    
    if (index === -1) {
      e.reply(`❌ 未找到ID: ${streamId} 的推流`, true)
      return
    }
    
    const stream = streamList[index]
    if (stream.status === '运行中') stream.stop()
    
    streamList.splice(index, 1)
    e.reply(`✅ ID: ${streamId} 的推流已删除`, true)
    
    // 删除推流后，确保保活流启动
    setTimeout(() => {
      this.ensureKeepAliveStream()
    }, 3000) // 3秒后检查并启动保活流
  }

  // 清空所有推流
  async clearAllStreams(e) {
    if (!this.checkPermission(e)) return
    
    if (streamList.length === 0) {
      e.reply('📭 当前无任何推流任务', true)
      return
    }
    
    streamList.forEach(stream => stream.status === '运行中' && stream.stop())
    streamList = []
    e.reply('✅ 所有推流已清空', true)
    
    // 清空推流后，确保保活流启动
    setTimeout(() => {
      this.ensureKeepAliveStream()
    }, 3000) // 3秒后检查并启动保活流
  }

  // 新增：停止保活流
  async stopKeepAliveStream(e) {
    if (!this.checkPermission(e)) return
    const parentStreamId = parseInt(e.msg.replace('#停止保活流 ', ''))
    
    // 查找关联的保活流
    const keepAliveStream = streamList.find(s => s.parentStreamId === parentStreamId)
    
    if (!keepAliveStream) {
      e.reply(`❌ 未找到关联原始流ID: ${parentStreamId} 的保活流`, true)
      return
    }
    
    if (keepAliveStream.status === '运行中') {
      const result = keepAliveStream.stop()
      e.reply(result, true)
    } else {
      e.reply(`❌ 保活流ID: ${keepAliveStream.id} 当前未在运行`, true)
    }
  }

  // 显示帮助
  async showHelp(e) {
    const helpText = `📺 直播推流助手使用指南

1. #开始直播 - 开始推流
2. #直播状态 - 查看当前直播状态
3. #清空直播 - 清空所有推流
4. #直播帮助 - 显示此帮助信息

🔧 自动保活模式说明：
- 系统始终确保至少有一个流在运行
- 启动正常流时会自动停止现有流
- 清空所有推流后会自动启动保活流
- 保活流确保直播间持续存活

📝 注意事项：
- 推流地址支持RTMP/HTTP/WebSocket等协议
- 音乐目录需包含MP3文件用于随机播放
- 保活流使用永久不结束的直播流地址`
    
    e.reply(helpText, true)
  }
}