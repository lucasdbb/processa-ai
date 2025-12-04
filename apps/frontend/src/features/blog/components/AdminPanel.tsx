import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Shield,
  Crown,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  User,
  FileText,
  LayoutDashboard,
  Edit,
  Trash2,
  Send,
  Save,
  MoreVertical
} from 'lucide-react';
import { adminService } from '../services/admin.service';
import type { UserListItem, AdminPostListItem } from '../services/admin.service';
import type { User as AuthUser } from '../../auth/types/auth';
import { ToastContainer } from '../../../shared/components/Toast';
import type { ToastType } from '../../../shared/components/Toast';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { cn } from '@/shared/utils/cn';

interface AdminPanelProps {
  user: AuthUser;
}

type Tab = 'overview' | 'users' | 'posts';

const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);
  
  // Users State
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'author' | 'admin' | 'premium'>('all');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{ userId: string; role: 'user' | 'author' | 'admin' | 'premium' } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Posts State
  const [posts, setPosts] = useState<AdminPostListItem[]>([]);
  const [postSearch, setPostSearch] = useState('');
  const [postStatusFilter, setPostStatusFilter] = useState<string>('all');
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [pendingPostAction, setPendingPostAction] = useState<{ id: string; action: 'publish' | 'archive' | 'restore'; title: string } | null>(null);
  const [isProcessingPost, setIsProcessingPost] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    total: 0,
    byRole: { user: 0, admin: 0, premium: 0 },
    verified: 0,
    unverified: 0,
    recentSignups: 0
  });

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'overview' || tab === 'users' || tab === 'posts') {
      setActiveTab(tab as Tab);
    }
  }, [location.search]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load users
      const usersData = await adminService.listUsers(1, 100);
      setUsers(usersData.users);

      // Load posts
      try {
        const postsData = await adminService.listPosts(1, 50, undefined, 'all');
        setPosts(postsData.items);
      } catch (e) {
        console.error('Failed to load posts:', e);
      }

      // Compute stats
      const usersArr = usersData.users;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      setStats({
        total: usersArr.length,
        byRole: {
          user: usersArr.filter(u => u.role === 'user').length,
          admin: usersArr.filter(u => u.role === 'admin').length,
          premium: usersArr.filter(u => u.role === 'premium').length,
        },
        verified: usersArr.filter(u => u.email_verified).length,
        unverified: usersArr.filter(u => !u.email_verified).length,
        recentSignups: usersArr.filter(u => new Date(u.created_at) > sevenDaysAgo).length,
      });
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
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setSelectedUser(null);
      setPendingRoleUpdate(null);
      showToast(`Role atualizada para "${newRole}" com sucesso!`, 'success');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar role', 'error');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      if (activeActionMenu) {
        setActiveActionMenu(null);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [activeActionMenu]);

  const toggleActionMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeActionMenu === id) {
      setActiveActionMenu(null);
      setMenuPosition(null);
    } else {
      const button = menuButtonRefs.current[id];
      if (button) {
        const rect = button.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4, // Não adicionar scrollY para position fixed
          left: rect.right - 192, // 192px (w-48)
        });
        setActiveActionMenu(id);
      }
    }
  };

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeActionMenu) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeActionMenu]);

  const handleActionClick = (callback: () => void) => {
    callback();
    setActiveActionMenu(null);
  };

  const handlePostAction = (id: string, action: 'archive' | 'publish' | 'restore', title: string) => {
    setPendingPostAction({ id, action, title });
    setActiveActionMenu(null); // Fechar menu após ação
  };

  const handleConfirmPostAction = async () => {
    if (!pendingPostAction) return;
    const { id, action } = pendingPostAction;

    try {
      setIsProcessingPost(true);
      if (action === 'publish') {
        await adminService.publishPost(id);
        setPosts(posts.map(p => p.id === id ? { ...p, status: 'published', published_at: new Date().toISOString() } : p));
        showToast('Post publicado com sucesso!', 'success');
      } else if (action === 'archive') {
        await adminService.deletePost(id); // Backend now handles soft delete (archive)
        setPosts(posts.map(p => p.id === id ? { ...p, status: 'archived' } : p));
        showToast('Post arquivado com sucesso!', 'success');
      } else if (action === 'restore') {
        await adminService.restorePostToDraft(id);
        setPosts(posts.map(p => p.id === id ? { ...p, status: 'draft', published_at: undefined } : p));
        showToast('Post salvo como rascunho!', 'success');
      }
      setPendingPostAction(null);
      // Reload stats
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : `Erro ao ${action === 'publish' ? 'publicar' : action === 'archive' ? 'arquivar' : 'salvar como rascunho'} post`,
        'error'
      );
    } finally {
      setIsProcessingPost(false);
    }
  };

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeActionMenu && !(event.target as Element).closest('.action-menu-container')) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionMenu]);

  // Filtering
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === '' ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredPosts = posts.filter(p => {
    const matchesSearch = postSearch === '' ||
      p.title.toLowerCase().includes(postSearch.toLowerCase());
    const matchesStatus = postStatusFilter === 'all' || p.status === postStatusFilter;
    return matchesSearch && matchesStatus;
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

  const getUserStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
      case 'overdue': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUserStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'suspended': return 'Suspenso';
      case 'overdue': return 'Inadimplente';
      default: return status || 'Desconhecido';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800 border-green-200';
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <div className="min-h-screen bg-gray-50/50 flex">
      {/* Sidebar / Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 hidden lg:flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-700" />
            Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              activeTab === 'overview' ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              activeTab === 'users' ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Users className="w-5 h-5" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              activeTab === 'posts' ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <FileText className="w-5 h-5" />
            Artigos do Blog
          </button>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        <div className="p-8 max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[40px]">
                <h2 className="text-2xl font-bold text-gray-900">Visão Geral do Sistema</h2>
                <button onClick={loadData} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 shadow-sm h-10" title="Atualizar">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>
              <div className="grid grid-cols-1 gap-8">
                {/* Seção de Usuários */}
                <section>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Métricas de Usuários</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                      <p className="text-sm text-gray-600 mt-1">Usuários cadastrados</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                          <Crown className="w-6 h-6 text-yellow-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">Premium</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{stats.byRole.premium}</p>
                      <p className="text-sm text-gray-600 mt-1">Assinantes ativos</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-xs font-medium text-green-600">+7 dias</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{stats.recentSignups}</p>
                      <p className="text-sm text-gray-600 mt-1">Novos usuários</p>
                    </div>
                  </div>
                </section>

                {/* Seção de Conteúdo */}
                <section>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Métricas de Conteúdo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <FileText className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{posts.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Artigos criados</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">Publicados</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">
                        {posts.filter(p => p.status === 'published').length}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Visíveis no blog</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                          <Edit className="w-6 h-6 text-yellow-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">Rascunhos</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">
                        {posts.filter(p => p.status === 'draft').length}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Em edição</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[40px]">
                <h2 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h2>
                <button onClick={loadData} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 shadow-sm h-10" title="Atualizar">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar usuários..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[200px]"
                  >
                    <option value="all">Todas as roles</option>
                    <option value="user">Usuário</option>
                    <option value="author">Autor</option>
                    <option value="premium">Premium</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-medium text-gray-500">Usuário</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Data Cadastro</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium overflow-hidden">
                                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.name ? u.name.substring(0, 2).toUpperCase() : u.email.substring(0, 2).toUpperCase())}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{u.name || 'Sem nome'}</p>
                                <div className="flex items-center gap-1">
                                  <p className="text-gray-500">{u.email}</p>
                                  {u.email_verified ? (
                                    <span title="Email verificado">
                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                    </span>
                                  ) : (
                                    <span title="Email não verificado">
                                      <XCircle className="w-3 h-3 text-gray-400" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(u.role)}`}>
                              {getRoleIcon(u.role)}
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getUserStatusBadge(u.status || 'active')}`}>
                              {getUserStatusLabel(u.status || 'active')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {u.id !== user.id && (
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="text-primary-600 hover:text-primary-800 font-medium text-xs px-3 py-1 rounded-md border border-primary-200 hover:bg-primary-50 transition-colors"
                              >
                                Editar Role
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">Nenhum usuário encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[40px]">
                <h2 className="text-2xl font-bold text-gray-900">Gerenciar Artigos</h2>
                <div className="flex items-center gap-2">
                  <button onClick={loadData} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 shadow-sm h-10" title="Atualizar">
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                  </button>
                  <button
                    onClick={() => navigate('/admin/posts/edit')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm h-10"
                  >
                    <FileText className="w-4 h-4" />
                    Novo Artigo
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar artigos..."
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <select
                    value={postStatusFilter}
                    onChange={(e) => setPostStatusFilter(e.target.value)}
                    className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[200px]"
                  >
                    <option value="all">Todos os status</option>
                    <option value="published">Publicados</option>
                    <option value="draft">Rascunhos</option>
                    <option value="archived">Arquivados</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-medium text-gray-500">Título</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Autor</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                        <th className="px-6 py-3 font-medium text-gray-500">Data</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPosts.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900 truncate max-w-xs" title={p.title}>{p.title}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">/{p.slug}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {p.author?.name || 'Desconhecido'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(p.status)}`}>
                              {p.status === 'draft' ? 'Rascunho' : p.status === 'published' ? 'Publicado' : 'Arquivado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {p.published_at 
                              ? new Date(p.published_at).toLocaleDateString('pt-BR')
                              : (p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="relative action-menu-container">
                              <button
                                ref={(el) => { menuButtonRefs.current[p.id] = el; }}
                                onClick={(e) => toggleActionMenu(p.id, e)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeActionMenu === p.id && menuPosition && createPortal(
                                <div 
                                  className="fixed bg-white rounded-lg shadow-lg border border-gray-100 z-[9999] py-1 animate-in fade-in zoom-in duration-200 w-48"
                                  style={{ top: menuPosition.top, left: menuPosition.left }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  {/* Edit - Link to create page with state */}
                                  <button
                                    onClick={() => handleActionClick(() => navigate(`/admin/posts/edit/${p.id}`))} 
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Editar
                                  </button>
                                  
                                  {p.status === 'draft' && (
                                    <button
                                      onClick={() => handlePostAction(p.id, 'publish', p.title)}
                                      className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                    >
                                      <Send className="w-4 h-4" />
                                      Publicar
                                    </button>
                                  )}

                                  {p.status === 'archived' && (
                                    <button
                                      onClick={() => handlePostAction(p.id, 'restore', p.title)}
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                    >
                                      <Save className="w-4 h-4" />
                                      Salvar rascunho
                                    </button>
                                  )}

                                  {p.status !== 'archived' && (
                                    <button
                                      onClick={() => handlePostAction(p.id, 'archive', p.title)}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Arquivar
                                    </button>
                                  )}
                                </div>,
                                document.body
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPosts.length === 0 && (
                    <div className="text-center py-12 text-gray-500">Nenhum artigo encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modals & Dialogs */}
          {selectedUser && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Alterar Role</h3>
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Usuário selecionado</p>
                  <p className="font-medium text-gray-900">{selectedUser.name}</p>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
                <div className="space-y-2 mb-6">
                  {(['user', 'author', 'premium', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChangeRequest(selectedUser.id, role)}
                      disabled={isUpdatingRole || selectedUser.role === role}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3",
                        selectedUser.role === role
                          ? "border-primary-100 bg-primary-50 text-primary-800"
                          : "border-gray-100 hover:border-primary-200 hover:bg-white"
                      )}
                    >
                      {getRoleIcon(role)}
                      <span className="capitalize flex-1 text-left">{role}</span>
                      {selectedUser.role === role && <CheckCircle className="w-4 h-4 text-primary-600" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <ConfirmDialog
            isOpen={!!pendingRoleUpdate}
            title="Confirmar alteração"
            message={`Deseja alterar a role para "${pendingRoleUpdate?.role}"?`}
            confirmText="Confirmar"
            cancelText="Cancelar"
            onConfirm={handleConfirmRoleUpdate}
            onCancel={() => setPendingRoleUpdate(null)}
            type="warning"
          />

          <ConfirmDialog
            isOpen={!!pendingPostAction}
            title={
              pendingPostAction?.action === 'archive'
                ? 'Arquivar Post'
                : pendingPostAction?.action === 'restore'
                ? 'Salvar como Rascunho'
                : 'Publicar Post'
            }
            message={
              pendingPostAction?.action === 'archive'
                ? `Tem certeza que deseja arquivar o post "${pendingPostAction?.title}"? Ele deixará de ser visível publicamente.`
                : pendingPostAction?.action === 'restore'
                ? `Deseja salvar o post "${pendingPostAction?.title}" como rascunho?`
                : `Deseja publicar o post "${pendingPostAction?.title}" agora? Ele ficará visível para todos os usuários.`
            }
            confirmText={
              pendingPostAction?.action === 'archive'
                ? 'Arquivar'
                : pendingPostAction?.action === 'restore'
                ? 'Salvar rascunho'
                : 'Publicar'
            }
            cancelText="Cancelar"
            onConfirm={handleConfirmPostAction}
            onCancel={() => setPendingPostAction(null)}
            type={
              pendingPostAction?.action === 'archive'
                ? 'danger'
                : pendingPostAction?.action === 'restore'
                ? 'info'
                : 'info'
            }
            isLoading={isProcessingPost}
          />

          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
