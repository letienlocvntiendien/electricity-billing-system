import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, FileText,
  Settings, LogOut, Zap, Banknote,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  ACCOUNTANT: 'Kế toán',
  METER_READER: 'Nhân viên đọc đồng hồ',
}

const roleColor: Record<string, string> = {
  ADMIN: 'text-amber-400',
  ACCOUNTANT: 'text-sky-400',
  METER_READER: 'text-emerald-400',
}

const navItems = [
  { to: '/',          label: 'Tổng quan',     icon: LayoutDashboard },
  { to: '/periods',   label: 'Kỳ điện',       icon: CalendarDays },
  { to: '/customers', label: 'Khách hàng',    icon: Users,          accountantOnly: true },
  { to: '/reports',   label: 'Báo cáo',       icon: FileText,       accountantOnly: true },
  { to: '/payments',  label: 'Thanh toán',    icon: Banknote,       accountantOnly: true },
  { to: '/settings',  label: 'Cài đặt',       icon: Settings,       adminOnly: true },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'ADMIN') return false
    if (item.accountantOnly && user?.role === 'METER_READER') return false
    return true
  })

  const sidebarStyle: React.CSSProperties = {
    background: 'hsl(222 28% 8%)',
    borderRight: '1px solid hsl(var(--border))',
  }

  return (
    <div className="flex h-dvh bg-background">

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col flex-shrink-0" style={sidebarStyle}>
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: 'hsl(var(--primary))',
              boxShadow: '0 0 16px hsl(var(--primary) / 0.4)',
            }}
          >
            <Zap className="h-4 w-4" style={{ color: 'hsl(var(--primary-foreground))' }} />
          </div>
          <span
            className="font-mono text-sm font-bold tracking-widest uppercase"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            Tiền Điện
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {({ isActive }) => (
                <span
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer select-none',
                    isActive
                      ? 'nav-active text-foreground bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-primary')} />
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid hsl(var(--border))' }} />

        {/* User footer */}
        <div className="px-3 py-3 space-y-2.5 flex-shrink-0">
          <div className="px-2 py-2 rounded-md" style={{ background: 'hsl(var(--accent) / 0.5)' }}>
            <p className="text-sm font-medium truncate text-foreground leading-tight">
              {user?.fullName}
            </p>
            <p
              className={cn(
                'font-mono text-[11px] tracking-wide mt-0.5',
                user?.role ? (roleColor[user.role] ?? 'text-muted-foreground') : 'text-muted-foreground',
              )}
            >
              {user?.role ? (roleLabel[user.role] ?? user.role) : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-2 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors duration-150"
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Right column (mobile header + content) ─────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Mobile sticky header */}
        <header
          className="md:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0"
          style={{
            background: 'hsl(222 28% 8%)',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: 'hsl(var(--primary))',
              boxShadow: '0 0 12px hsl(var(--primary) / 0.35)',
            }}
          >
            <Zap className="h-3.5 w-3.5" style={{ color: 'hsl(var(--primary-foreground))' }} />
          </div>
          <span
            className="font-mono text-sm font-bold tracking-widest uppercase flex-1"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            Tiền Điện
          </span>
          <span
            className={cn(
              'font-mono text-[11px] tracking-wide',
              user?.role ? (roleColor[user.role] ?? 'text-muted-foreground') : 'text-muted-foreground',
            )}
          >
            {user?.role ? (roleLabel[user.role] ?? user.role) : ''}
          </span>
        </header>

        {/* Page content — padded bottom to clear the mobile nav */}
        <main className="flex-1 overflow-auto main-scroll">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'hsl(222 28% 8%)',
          borderTop: '1px solid hsl(var(--border))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex">
          {filteredNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="flex-1">
              {({ isActive }) => (
                <div
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {isActive && (
                    <div
                      className="absolute top-0 h-0.5 w-8 rounded-full"
                      style={{ background: 'hsl(var(--primary))' }}
                    />
                  )}
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Đăng xuất</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
