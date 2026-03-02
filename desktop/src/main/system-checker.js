/**
 * SystemChecker — 系统环境检测
 *
 * 供 Onboarding 和 Settings 使用，检测：
 *   - Python 版本
 *   - Node.js 版本
 *   - CCB 项目根目录
 *   - Git 版本
 *   - 各 daemon 进程状态
 */
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import processManager from './process-manager.js'
import healthChecker from './health-checker.js'

class SystemChecker {
    /** 执行完整环境检测 */
    async checkEnvironment() {
        const checks = [
            this._checkPython(),
            this._checkNode(),
            this._checkGit(),
            this._checkTmux(),
            this._checkCcbProject(),
            this._checkCcbConfig(),
            this._checkShell()
        ]

        const results = await Promise.all(checks)

        // 追加 provider 状态检测
        try {
            const healthResults = await healthChecker.checkAll()
            for (const [key, val] of Object.entries(healthResults)) {
                if (key.startsWith('_')) continue // skip _askd, _maild
                results.push({
                    id: `provider-${key}`,
                    label: val?.label || key,
                    description: `Provider daemon (${val?.daemonKey || key})`,
                    status: val?.status === 'operational' ? 'success' : val?.status === 'degraded' ? 'warning' : 'info',
                    detail: val?.status === 'operational'
                        ? `PID ${val.pid} • ${val.latency || '--'} latency`
                        : 'Not running (optional)',
                    icon: 'dns'
                })
            }
        } catch { /* ignore health check failures */ }

        return results
    }

    _checkPython() {
        try {
            const version = execSync('python3 --version 2>&1', { timeout: 5000 }).toString().trim()
            const match = version.match(/(\d+\.\d+\.\d+)/)
            const ver = match ? match[1] : version
            const major = parseInt(ver.split('.')[0])
            const minor = parseInt(ver.split('.')[1])
            return {
                id: 'python',
                label: 'Python 3.9+',
                description: 'Core runtime for CCB',
                status: (major >= 3 && minor >= 9) ? 'success' : 'warning',
                detail: `Installed (${ver})`,
                icon: 'terminal'
            }
        } catch {
            return {
                id: 'python',
                label: 'Python 3.9+',
                description: 'Core runtime for CCB',
                status: 'error',
                detail: 'Not found — install Python 3.9+',
                icon: 'terminal'
            }
        }
    }

    _checkNode() {
        try {
            const version = process.version
            return {
                id: 'node',
                label: 'Node.js',
                description: 'Electron runtime',
                status: 'success',
                detail: `Installed (${version})`,
                icon: 'code'
            }
        } catch {
            return {
                id: 'node', label: 'Node.js', description: 'Electron runtime',
                status: 'error', detail: 'Not found', icon: 'code'
            }
        }
    }

    _checkGit() {
        try {
            const version = execSync('git --version 2>&1', { timeout: 5000 }).toString().trim()
            return {
                id: 'git',
                label: 'Git',
                description: 'Version control',
                status: 'success',
                detail: version.replace('git version ', 'Installed (') + ')',
                icon: 'merge'
            }
        } catch {
            return {
                id: 'git', label: 'Git', description: 'Version control',
                status: 'warning', detail: 'Not found (optional)', icon: 'merge'
            }
        }
    }

    _checkCcbProject() {
        const root = processManager.getCcbRoot()
        if (root && existsSync(join(root, 'bin'))) {
            return {
                id: 'ccb-project',
                label: 'CCB Project',
                description: 'Claude Code Bridge installation',
                status: 'success',
                detail: `Found at ${root}`,
                icon: 'folder_open'
            }
        }
        return {
            id: 'ccb-project',
            label: 'CCB Project',
            description: 'Claude Code Bridge installation',
            status: 'error',
            detail: 'Project root not found',
            icon: 'folder_open'
        }
    }

    _checkCcbConfig() {
        const configPath = join(homedir(), '.ccb', 'ccb.config')
        if (existsSync(configPath)) {
            return {
                id: 'ccb-config',
                label: 'CCB Config',
                description: '~/.ccb/ccb.config',
                status: 'success',
                detail: 'Configuration file found',
                icon: 'settings'
            }
        }
        return {
            id: 'ccb-config',
            label: 'CCB Config',
            description: '~/.ccb/ccb.config',
            status: 'warning',
            detail: 'Not found — will be created on first use',
            icon: 'settings'
        }
    }

    _checkShell() {
        const shell = process.env.SHELL || '/bin/zsh'
        return {
            id: 'shell',
            label: 'Shell',
            description: 'Default terminal shell',
            status: 'success',
            detail: shell,
            icon: 'terminal'
        }
    }

    _checkTmux() {
        try {
            const version = execSync('tmux -V 2>&1', { timeout: 5000 }).toString().trim()
            return {
                id: 'tmux',
                label: 'tmux',
                description: 'Terminal multiplexer (for CCB panes)',
                status: 'success',
                detail: `Installed (${version.replace('tmux ', '')})`,
                icon: 'grid_view'
            }
        } catch {
            return {
                id: 'tmux',
                label: 'tmux',
                description: 'Terminal multiplexer (for CCB panes)',
                status: 'warning',
                detail: 'Not found — install with: brew install tmux',
                icon: 'grid_view'
            }
        }
    }
}

export default new SystemChecker()
