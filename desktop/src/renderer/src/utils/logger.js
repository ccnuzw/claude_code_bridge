/**
 * Logger — 统一日志工具
 *
 * 替代零散的 console.log，提供分级日志和统一前缀。
 * 生产环境自动静默 debug 和 info 级别。
 */

const isDev = typeof window !== 'undefined' &&
    (window.location?.hostname === 'localhost' || window.location?.protocol === 'file:')

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL = isDev ? LEVELS.debug : LEVELS.warn

function createLogger(namespace) {
    const prefix = `[CCB:${namespace}]`
    const noop = () => { }

    return {
        debug: MIN_LEVEL <= LEVELS.debug
            ? (...args) => console.debug(prefix, ...args)
            : noop,

        info: MIN_LEVEL <= LEVELS.info
            ? (...args) => console.info(prefix, ...args)
            : noop,

        warn: (...args) => console.warn(prefix, ...args),

        error: (...args) => console.error(prefix, ...args),

        time: (label) => isDev ? console.time(`${prefix} ${label}`) : undefined,
        timeEnd: (label) => isDev ? console.timeEnd(`${prefix} ${label}`) : undefined,
        group: (label) => isDev ? console.group(`${prefix} ${label}`) : undefined,
        groupEnd: () => isDev ? console.groupEnd() : undefined
    }
}

export default createLogger

// 常用预定义 logger 实例
export const appLogger = createLogger('App')
export const storeLogger = createLogger('Store')
export const ipcLogger = createLogger('IPC')
export const askLogger = createLogger('Ask')
export const termLogger = createLogger('Terminal')
export const providerLogger = createLogger('Provider')
