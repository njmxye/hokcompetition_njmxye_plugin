import fs from 'node:fs'
import chalk from 'chalk'

logger.info(chalk.rgb(120, 255, 108)(`---------=.=---------`))
logger.info(chalk.rgb(120, 255, 108)(`王者赛宝插件hokcompetition_njmxye_plugin载入成功~`))
logger.info(chalk.rgb(120, 255, 108)(`作者-njmxye`))
logger.info(chalk.rgb(120, 255, 108)(`GitHub: https://github.com/njmxye`))
logger.info(chalk.rgb(120, 255, 108)(`QQ交流群: 348582328`))
logger.info(chalk.rgb(120, 255, 108)(`---------------------`))

const files = fs
  .readdirSync('./plugins/hokcompetition_njmxye_plugin/apps')
  .filter((file) => file.endsWith('.js'))

let ret = []

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')
  
  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
export { apps }