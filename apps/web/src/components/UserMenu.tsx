import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import ProfileModal from './ProfileModal';
import type { User as UserType } from '../types/auth';

interface UserMenuProps {
  user: UserType;
  onLogout: () => void;
  onUpdateProfile: (updatedUser: Partial<UserType>) => Promise<void>;
}

/**
 * User menu dropdown component that appears when user is logged in
 * Provides access to profile, settings, and logout functionality
 */
const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onUpdateProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  // Use the user's full name if available, otherwise fallback to email prefix
  const displayName = user.name || user.email.split('@')[0];
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleProfileClick = () => {
    setIsOpen(false);
    setIsProfileModalOpen(true);
  };

  const handleProfileUpdate = async (updatedData: Partial<UserType>) => {
    await onUpdateProfile(updatedData);
    setIsProfileModalOpen(false);
  };

  return (
    <div className="relative">
      {/* User Menu Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Menu do usuário ${displayName}`}
      >
        {/* User Avatar */}
        <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium overflow-hidden">
          {user.avatar_url || user.avatar ? (
            <img 
              src={user.avatar_url || user.avatar} 
              alt={`Avatar de ${displayName}`} 
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        
        {/* User Name */}
        <span className="text-sm font-medium text-gray-700 max-w-32 truncate">
          {displayName}
        </span>
        
        {/* Dropdown Arrow */}
        <ChevronDown 
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
        >
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {user.email}
            </p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleProfileClick}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 focus:outline-none focus:bg-gray-50"
              role="menuitem"
            >
              <User className="w-4 h-4 mr-3 text-gray-400" aria-hidden="true" />
              Perfil
            </button>

            <button
              onClick={() => handleMenuItemClick(() => {
                // TODO: Implementar navegação para configurações
                console.log('Navegar para configurações');
              })}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 focus:outline-none focus:bg-gray-50"
              role="menuitem"
            >
              <Settings className="w-4 h-4 mr-3 text-gray-400" aria-hidden="true" />
              Configurações
            </button>

            <div className="border-t border-gray-100 my-1"></div>

            <button
              onClick={() => handleMenuItemClick(onLogout)}
              className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-150 focus:outline-none focus:bg-red-50"
              role="menuitem"
            >
              <LogOut className="w-4 h-4 mr-3 text-red-400" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateProfile={handleProfileUpdate}
      />
    </div>
  );
};

export default UserMenu;