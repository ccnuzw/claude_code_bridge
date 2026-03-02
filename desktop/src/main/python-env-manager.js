/**
 * PythonEnvManager — Python 环境检测 & venv 自动安装
 *
 * 首次启动时：
 *   1. 检测系统是否有 python3
 *   2. 在 ~/.ccb/venv/ 创建虚拟环境
 *   3. pip install fastapi pydantic jinja2
 *   4. 后续运行 askd 使用 venv 中的 python
 */
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { spawn, execSync } from 'child_process'
import { EventEmitter } from 'events'

const CCB_DIR = join(homedir(), '.ccb')
const VENV_DIR = join(CCB_DIR, 'venv')

export default class PythonEnvManager extends EventEmitter {
    constructor() {
        super()
        this._pythonPath = null // 缓存检测到的 python 路径
        this._venvPython = null // venv 内的 python 路径
        this._ready = false
    }

    // ── 公共 API ─────────────────────────────────────────────

    /** 获取可用的 python3 路径（优先 venv，fallback 系统） */
    getPythonPath() {
        if (this._venvPython && existsSync(this._venvPython)) {
            return this._venvPython
        }
        return this._pythonPath || 'python3'
    }

    /** 检查 Python 环境是否就绪 */
    isReady() {
        return this._ready
    }

    /** 获取 venv 目录 */
    getVenvDir() {
        return VENV_DIR
    }

    /** 获取状态摘要 */
    getStatus() {
        return {
            pythonDetected: !!this._pythonPath,
            pythonPath: this._pythonPath,
            venvExists: existsSync(VENV_DIR),
            venvPython: this._venvPython,
            ready: this._ready
        }
    }

    // ── 初始化流程 ───────────────────────────────────────────

    /** 完整初始化：检测 → 创建 venv → 安装依赖 */
    async initialize() {
        this.emit('status', { phase: 'detecting', message: 'Detecting Python3...' })

        // Step 1: 检测 python3
        this._pythonPath = await this._detectPython()
        if (!this._pythonPath) {
            this.emit('status', { phase: 'missing', message: 'Python3 not found' })
            this.emit('error', {
                code: 'PYTHON_NOT_FOUND',
                message: 'Python3 is required. Please install Xcode Command Line Tools: xcode-select --install'
            })
            return false
        }

        this.emit('status', { phase: 'detected', message: `Python3 found: ${this._pythonPath}` })

        // Step 2: 检查或创建 venv
        const venvPythonPath = process.platform === 'win32'
            ? join(VENV_DIR, 'Scripts', 'python.exe')
            : join(VENV_DIR, 'bin', 'python3')

        if (existsSync(venvPythonPath)) {
            // venv 已存在，检查依赖
            this._venvPython = venvPythonPath
            this.emit('status', { phase: 'checking-deps', message: 'Checking dependencies...' })

            const depsOk = await this._checkDeps()
            if (depsOk) {
                this._ready = true
                this.emit('status', { phase: 'ready', message: 'Python environment ready' })
                this.emit('ready')
                return true
            }
            // 依赖不完整，重新安装
        } else {
            // 创建 venv
            this.emit('status', { phase: 'creating-venv', message: 'Creating virtual environment...' })
            if (!existsSync(CCB_DIR)) mkdirSync(CCB_DIR, { recursive: true })

            const created = await this._createVenv()
            if (!created) {
                this.emit('error', { code: 'VENV_FAILED', message: 'Failed to create virtual environment' })
                return false
            }
            this._venvPython = venvPythonPath
        }

        // Step 3: 安装依赖
        this.emit('status', { phase: 'installing', message: 'Installing dependencies (fastapi, pydantic)...' })
        const installed = await this._installDeps()
        if (!installed) {
            this.emit('error', { code: 'INSTALL_FAILED', message: 'Failed to install Python dependencies' })
            return false
        }

        this._ready = true
        this.emit('status', { phase: 'ready', message: 'Python environment ready' })
        this.emit('ready')
        return true
    }

    // ── 内部方法 ─────────────────────────────────────────────

    /** 检测系统 python3 */
    async _detectPython() {
        const candidates = [
            '/usr/bin/python3',
            '/usr/local/bin/python3',
            '/opt/homebrew/bin/python3',
            'python3'
        ]

        for (const cmd of candidates) {
            try {
                const result = execSync(`${cmd} --version 2>&1`, { timeout: 5000, encoding: 'utf-8' })
                if (result.includes('Python 3')) {
                    return cmd
                }
            } catch { /* skip */ }
        }
        return null
    }

    /** 创建 venv */
    async _createVenv() {
        return new Promise((resolve) => {
            const proc = spawn(this._pythonPath, ['-m', 'venv', VENV_DIR], {
                stdio: 'pipe',
                timeout: 60000
            })

            proc.on('close', (code) => resolve(code === 0))
            proc.on('error', () => resolve(false))
        })
    }

    /** 检查关键依赖是否已安装 */
    async _checkDeps() {
        try {
            const result = execSync(
                `"${this._venvPython}" -c "import fastapi; import pydantic; print('ok')"`,
                { timeout: 10000, encoding: 'utf-8', shell: true }
            )
            return result.trim() === 'ok'
        } catch {
            return false
        }
    }

    /** 安装依赖 */
    async _installDeps() {
        const pip = process.platform === 'win32'
            ? join(VENV_DIR, 'Scripts', 'pip')
            : join(VENV_DIR, 'bin', 'pip')

        return new Promise((resolve) => {
            const proc = spawn(pip, [
                'install', '--quiet',
                'fastapi', 'pydantic', 'jinja2', 'uvicorn'
            ], {
                stdio: 'pipe',
                timeout: 120000,
                env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }
            })

            let stderr = ''
            proc.stderr?.on('data', (d) => { stderr += d.toString() })

            proc.on('close', (code) => {
                if (code !== 0) {
                    console.error('[PythonEnvManager] pip install failed:', stderr)
                    // 检测是否是代理导致的连接问题，给出更友好的提示
                    if (stderr.includes('ProxyError') || stderr.includes('Cannot connect to proxy')) {
                        this.emit('error', {
                            code: 'PROXY_ERROR',
                            message: 'pip 安装失败：代理连接被拒绝。请检查代理软件是否已启动，或临时关闭代理后重试。'
                        })
                    }
                }
                resolve(code === 0)
            })
            proc.on('error', (err) => {
                console.error('[PythonEnvManager] pip spawn error:', err)
                resolve(false)
            })
        })
    }
}
