import React from 'react';
import { 
  Brain, 
  Calculator, 
  Newspaper, 
  FileText, 
  Clock,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import type { User } from '../types/auth';

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = React.memo(({ user, onLogout }) => {
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-bg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Acesso Restrito
          </h2>
          <p className="text-gray-600">
            Você precisa fazer login para acessar o dashboard.
          </p>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      icon: Brain,
      title: 'Criar Peça Processual',
      description: 'Use IA para criar petições e documentos',
      color: 'bg-blue-500',
      href: '/ferramentas'
    },
    {
      icon: Calculator,
      title: 'Calculadoras',
      description: 'Calcule rescisões e aposentadorias',
      color: 'bg-green-500',
      href: '/calculadoras'
    },
    {
      icon: Newspaper,
      title: 'Últimas Notícias',
      description: 'Veja as novidades do direito',
      color: 'bg-purple-500',
      href: '/blog'
    },
    {
      icon: FileText,
      title: 'Meus Documentos',
      description: 'Acesse seus arquivos salvos',
      color: 'bg-orange-500',
      href: '/documentos'
    }
  ];

  const recentActivity = [
    {
      action: 'Criou petição inicial',
      time: '2 horas atrás',
      type: 'document'
    },
    {
      action: 'Calculou rescisão trabalhista',
      time: '1 dia atrás',
      type: 'calculation'
    },
    {
      action: 'Leu artigo sobre nova lei',
      time: '2 dias atrás',
      type: 'reading'
    }
  ];

  const stats = [
    {
      label: 'Documentos Criados',
      value: '24',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      label: 'Cálculos Realizados',
      value: '18',
      icon: Calculator,
      color: 'text-green-600'
    },
    {
      label: 'Artigos Lidos',
      value: '42',
      icon: Newspaper,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Header do Dashboard */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bem-vindo, {user.name}!
              </h1>
              <p className="text-gray-600">
                Aqui está um resumo das suas atividades
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <UserIcon className="h-5 w-5" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Ações Rápidas */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ações Rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quickActions.map((action, index) => (
                <div key={index} className="card hover:shadow-lg transition-shadow duration-300 cursor-pointer">
                  <div className="flex items-start space-x-4">
                    <div className={`${action.color} p-3 rounded-lg`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {action.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atividade Recente */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Atividade Recente</h2>
            <div className="card">
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progresso do Mês */}
            <div className="card mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Progresso do Mês
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Documentos</span>
                    <span className="text-gray-900">24/30</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Cálculos</span>
                    <span className="text-gray-900">18/25</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '72%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;