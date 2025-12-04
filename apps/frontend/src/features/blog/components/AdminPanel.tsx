import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Shield,
  Crown,
  Mail,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  Filter,
  User,
  Settings
} from 'lucide-react';
import { adminService } from '../services/admin.service';
import type { UserListItem } from '../services/admin.service';
import type { User as AuthUser } from '../../auth/types/auth';
import { ToastContainer } from '../../../shared/components/Toast';
import type { ToastType } from '../../../shared/components/Toast';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';

interface AdminPanelProps {
  user: AuthUser;
}

/**
 * Admin Panel component for managing users and system
 * Only accessible by users with admin role
 */
const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'author' | 'admin' | 'premium'>('all');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{ userId: string; role: 'user' | 'author' | 'admin' | 'premium' } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);
  const [stats, setStats] = useState({
    total: 0,
    byRole: { user: 0, admin: 0, premium: 0 },
    verified: 0,
    unverified: 0,
    recentSignups: 0
  });

  // Toast management
  const showToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Load users and stats (guard against double-invocation in StrictMode)
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load users (single request)
      const usersData = await adminService.listUsers(1, 100);
      setUsers(usersData.users);

      // Compute stats locally from the loaded users to avoid extra requests
      const usersArr = usersData.users;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const computedStats = {
        total: usersArr.length,
        byRole: {
          user: usersArr.filter(u => u.role === 'user').length,
          admin: usersArr.filter(u => u.role === 'admin').length,
          premium: usersArr.filter(u => u.role === 'premium').length,
        },
        verified: usersArr.filter(u => u.email_verified).length,
        unverified: usersArr.filter(u => !u.email_verified).length,
        recentSignups: usersArr.filter(u => new Date(u.created_at) > sevenDaysAgo).length,
      };
      setStats(computedStats);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChangeRequest = (userId: string, newRole: 'user' | 'author' | 'admin' | 'premium') => {
    setPendingRoleUpdate({ userId, role: newRole });
  };

  const handleConfirmRoleUpdate = async () => {
    if (!pendingRoleUpdate) return;

    const { userId, role: newRole } = pendingRoleUpdate;

    try {
      setIsUpdatingRole(true);
      await adminService.updateUserRole(userId, newRole);

      // Update local state
      setUsers(users.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));

      setSelectedUser(null);
      setPendingRoleUpdate(null);
      showToast(`Role atualizada para "${newRole}" com sucesso!`, 'success');

      // Reload to update stats
      loadData();
    } catch (err) {
      console.error('Error updating role:', err);
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar role', 'error');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleCancelRoleUpdate = () => {
    setPendingRoleUpdate(null);
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === '' ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-red-600" />;
      case 'author': return <User className="w-4 h-4 text-blue-600" />;
      case 'premium': return <Crown className="w-4 h-4 text-yellow-600" />;
      default: return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'author': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'premium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-bg py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary-700" />
            Painel de Administração
          </h1>
          <p className="mt-2 text-gray-600">
            Gerencie usuários, roles e visualize estatísticas do sistema
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Usuários</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <Users className="w-10 h-10 text-primary-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Usuários</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.byRole.user}</p>
              </div>
              <Users className="w-10 h-10 text-gray-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Premium</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.byRole.premium}</p>
              </div>
              <Crown className="w-10 h-10 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Admins</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.byRole.admin}</p>
              </div>
              <Shield className="w-10 h-10 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Novos (7 dias)</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.recentSignups}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Table Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Usuários ({filteredUsers.length})
              </h2>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por email ou nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Role Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as 'all' | 'user' | 'author' | 'admin' | 'premium')}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
                  >
                    <option value="all">Todas as roles</option>
                    <option value="user">Usuários</option>
                    <option value="author">Autores</option>
                    <option value="premium">Premium</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{u.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(u.role)}`}>
                        {getRoleIcon(u.role)}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {u.document_type && u.document_number ? (
                        <span className="font-mono">
                          {u.document_type.toUpperCase()}: {u.document_number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.email_verified ? (
                        <span className="inline-flex items-center gap-1 text-sm text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                          <XCircle className="w-4 h-4" />
                          Não verificado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {u.id !== user.id && (
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Alterar Role
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum usuário encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Update Role Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Alterar Role
              </h3>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Usuário:</p>
                <p className="font-medium text-gray-900">{selectedUser.name}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">Selecione a nova role:</p>
                <div className="space-y-2">
                  {(['user', 'author', 'premium', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChangeRequest(selectedUser.id, role)}
                      disabled={isUpdatingRole || selectedUser.role === role}
                      className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        selectedUser.role === role
                          ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-primary-500 hover:bg-primary-50'
                      } ${isUpdatingRole ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {getRoleIcon(role)}
                      <span className="font-medium capitalize">{role}</span>
                      {selectedUser.role === role && (
                        <span className="ml-auto text-xs text-gray-500">(atual)</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  disabled={isUpdatingRole}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={!!pendingRoleUpdate}
          title="Confirmar alteração de role"
          message={`Tem certeza que deseja alterar a role deste usuário para "${pendingRoleUpdate?.role}"? O usuário precisará fazer logout e login para que as mudanças tenham efeito.`}
          confirmText="Alterar Role"
          cancelText="Cancelar"
          onConfirm={handleConfirmRoleUpdate}
          onCancel={handleCancelRoleUpdate}
          type="warning"
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
};

export default AdminPanel;
