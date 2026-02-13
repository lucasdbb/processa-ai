import { LogOut, ChevronDown, LayoutDashboard } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '../hooks/use-auth'
import type { User } from '../types'
import { useState } from 'react'
import { useTheme } from 'next-themes'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Verifica se está nas rotas da aplicação (/app/*)
  const isAppRoute = location.pathname.startsWith('/app')

  const getInitials = () => {
    if (user.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user.email.slice(0, 2).toUpperCase()
  }

  const displayName = user.name || user.email.split('@')[0]

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <DropdownMenu modal={false} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-transparent hover:opacity-80 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
            <AvatarFallback className="bg-slate-900 text-white text-sm font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground max-w-32 truncate">
            {displayName}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-background/95 backdrop-blur-md text-card-foreground rounded-lg border border-border p-0 font-sans"
      >
        <DropdownMenuLabel className="px-4 py-3 border-b border-border font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <div className="py-1">
          <DropdownMenuItem asChild className="rounded-none p-0 focus:bg-transparent">
            <Link
              to="/app"
              data-tour="dashboard-link"
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer focus:outline-none"
            >
              <LayoutDashboard className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>Meu Painel</span>
            </Link>
          </DropdownMenuItem>
        </div>
        {!isAppRoute && (
          <>
            <DropdownMenuSeparator className="border-t border-border my-1 bg-transparent" />
            <DropdownMenuItem
              onClick={handleLogout}
              className={`rounded-none flex items-center w-full px-4 py-2 text-sm transition-colors duration-150 cursor-pointer ${
                isDark
                  ? 'text-red-400 hover:bg-red-900/10 focus:bg-red-900/10 focus:text-red-300'
                  : 'text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700'
              }`}
            >
              <LogOut className="w-4 h-4 mr-3 text-red-500" />
              <span>Sair</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
