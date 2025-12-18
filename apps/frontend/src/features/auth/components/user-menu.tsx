'use client'

import { User as UserIcon, LogOut, Settings, Shield, ChevronDown } from 'lucide-react'
import Link from 'next/link'
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
import { ProfileModal } from './profile-modal'
import { useAuthStore } from '../store/auth-store'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const setUser = useAuthStore((state) => state.setUser)

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

  const handleProfileClick = () => {
    setIsOpen(false)
    setIsProfileModalOpen(true)
  }

  const handleUpdateProfile = (updatedUser: User) => {
    setUser(updatedUser)
  }

  return (
    <DropdownMenu modal={false} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
            <AvatarFallback className="bg-primary-600 text-white text-sm font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 max-w-32 truncate">
            {displayName}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-0 font-sans"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
      >
        <DropdownMenuLabel className="px-4 py-3 border-b border-gray-100 font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-sm text-gray-500 truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <div className="py-1">
          <DropdownMenuItem asChild className="rounded-none p-0 focus:bg-transparent">
            <button onClick={handleProfileClick} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer focus:outline-none">
              <UserIcon className="w-4 h-4 mr-3 text-gray-400" />
              <span>Perfil</span>
            </button>
          </DropdownMenuItem>
          {(user.role === 'admin' || user.role === 'author') && (
            <DropdownMenuItem asChild className="rounded-none p-0 focus:bg-transparent">
              <Link href="/admin" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer focus:outline-none">
                <Shield className="w-4 h-4 mr-3 text-red-400" />
                <span className="flex items-center gap-2">
                  Painel Admin
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
                </span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="rounded-none p-0 focus:bg-transparent">
            <Link href="/configuracoes" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer focus:outline-none">
              <Settings className="w-4 h-4 mr-3 text-gray-400" />
              <span>Configurações</span>
            </Link>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="border-t border-gray-100 my-1 bg-transparent" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="rounded-none flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 focus:bg-red-50 transition-colors duration-150 cursor-pointer focus:text-red-700"
        >
          <LogOut className="w-4 h-4 mr-3 text-red-400" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateProfile={handleUpdateProfile}
      />
    </DropdownMenu>
  )
}
