import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Sai tên đăng nhập hoặc mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background"
    >
      {/* Animated grid background */}
      <div className="login-bg" />

      {/* Radial center glow */}
      <div className="login-glow" />

      {/* Slow scanning gradient */}
      <div className="login-scan" />

      {/* Corner accents */}
      <div
        className="pointer-events-none absolute left-6 top-6 h-12 w-12 rounded-tl-lg"
        style={{
          borderTop: '1px solid hsl(38 95% 53% / 0.3)',
          borderLeft: '1px solid hsl(38 95% 53% / 0.3)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-6 right-6 h-12 w-12 rounded-br-lg"
        style={{
          borderBottom: '1px solid hsl(38 95% 53% / 0.3)',
          borderRight: '1px solid hsl(38 95% 53% / 0.3)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="login-logo-icon">
              <Zap
                className="h-5 w-5"
                style={{ color: 'hsl(var(--primary-foreground))' }}
              />
            </div>
            <span
              className="font-mono text-2xl font-bold tracking-widest text-foreground"
            >
              TIỀN ĐIỆN
            </span>
          </div>
          <p
            className="font-mono text-[11px] tracking-[0.2em] uppercase"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Hệ thống quản lý điện năng
          </p>
        </div>

        {/* Login card */}
        <div className="login-card">
          <h2
            className="mb-5 text-sm font-semibold uppercase tracking-widest"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Đăng nhập hệ thống
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Tên đăng nhập
              </Label>
              <Input
                id="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="font-mono h-10 bg-background/60 placeholder:text-muted-foreground/40 focus-visible:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Mật khẩu
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-background/60 focus-visible:ring-primary/50"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="mt-1 h-10 w-full gap-2 font-semibold tracking-wide"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {loading ? 'Đang xác thực...' : 'Đăng nhập'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="mt-5 text-center font-mono text-[10px] tracking-widest uppercase"
          style={{ color: 'hsl(var(--muted-foreground) / 0.4)' }}
        >
          v1.0 · Điện lực khu phố
        </p>
      </div>
    </div>
  )
}
