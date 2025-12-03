/**
 * Session Timeout Manager
 * Gerencia timeout automático de sessão por inatividade
 */

/**
 * Configurações de timeout
 */
export const SESSION_CONFIG = {
  // Tempo de inatividade antes do logout (30 minutos)
  TIMEOUT_DURATION: 30 * 60 * 1000, // 30 minutos em ms

  // Tempo de aviso antes do logout (2 minutos antes do timeout)
  WARNING_DURATION: 2 * 60 * 1000, // 2 minutos em ms

  // Eventos que resetam o timer de inatividade
  ACTIVITY_EVENTS: [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click',
  ] as const,

  // Intervalo para verificar inatividade (1 segundo)
  CHECK_INTERVAL: 1000,

  // Key para armazenar última atividade no localStorage
  LAST_ACTIVITY_KEY: 'lastActivityTime',
};

/**
 * Callback para quando o timeout está próximo
 */
export type TimeoutWarningCallback = (remainingSeconds: number) => void;

/**
 * Callback para quando o timeout ocorre
 */
export type TimeoutCallback = () => void;

/**
 * Estado do gerenciador de timeout
 */
interface SessionTimeoutState {
  timeoutId: NodeJS.Timeout | null;
  warningTimeoutId: NodeJS.Timeout | null;
  checkIntervalId: NodeJS.Timeout | null;
  lastActivityTime: number;
  isWarningActive: boolean;
  activityListeners: (() => void)[];
}

/**
 * Classe para gerenciar timeout de sessão
 */
export class SessionTimeoutManager {
  private state: SessionTimeoutState = {
    timeoutId: null,
    warningTimeoutId: null,
    checkIntervalId: null,
    lastActivityTime: Date.now(),
    isWarningActive: false,
    activityListeners: [],
  };

  private onTimeout: TimeoutCallback | null = null;
  private onWarning: TimeoutWarningCallback | null = null;

  /**
   * Inicializa o gerenciador de timeout
   * @param onTimeout - Callback executado quando o timeout ocorre (fazer logout)
   * @param onWarning - Callback executado quando o aviso de timeout é ativado
   */
  start(onTimeout: TimeoutCallback, onWarning?: TimeoutWarningCallback): void {
    this.onTimeout = onTimeout;
    this.onWarning = onWarning || null;

    // Registrar última atividade
    this.updateLastActivity();

    // Adicionar listeners de atividade
    this.addActivityListeners();

    // Iniciar timer de timeout
    this.resetTimer();

    // Iniciar verificação periódica (para sincronizar entre abas)
    this.startPeriodicCheck();

    console.log('[SessionTimeout] Manager iniciado');
  }

  /**
   * Para o gerenciador de timeout
   */
  stop(): void {
    // Limpar timers
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
      this.state.timeoutId = null;
    }

    if (this.state.warningTimeoutId) {
      clearTimeout(this.state.warningTimeoutId);
      this.state.warningTimeoutId = null;
    }

    if (this.state.checkIntervalId) {
      clearInterval(this.state.checkIntervalId);
      this.state.checkIntervalId = null;
    }

    // Remover listeners de atividade
    this.removeActivityListeners();

    // Limpar localStorage
    localStorage.removeItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);

    console.log('[SessionTimeout] Manager parado');
  }

  /**
   * Reseta o timer de timeout (chamado em cada atividade do usuário)
   */
  resetTimer(): void {
    // Limpar timers existentes
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }

    if (this.state.warningTimeoutId) {
      clearTimeout(this.state.warningTimeoutId);
    }

    // Resetar estado de aviso
    this.state.isWarningActive = false;

    // Atualizar última atividade
    this.updateLastActivity();

    // Configurar aviso de timeout (2 minutos antes do timeout)
    const warningTime = SESSION_CONFIG.TIMEOUT_DURATION - SESSION_CONFIG.WARNING_DURATION;
    this.state.warningTimeoutId = setTimeout(() => {
      this.handleWarning();
    }, warningTime);

    // Configurar timeout final
    this.state.timeoutId = setTimeout(() => {
      this.handleTimeout();
    }, SESSION_CONFIG.TIMEOUT_DURATION);
  }

  /**
   * Atualiza o timestamp da última atividade
   */
  private updateLastActivity(): void {
    this.state.lastActivityTime = Date.now();

    // Salvar no localStorage para sincronizar entre abas
    try {
      localStorage.setItem(
        SESSION_CONFIG.LAST_ACTIVITY_KEY,
        this.state.lastActivityTime.toString()
      );
    } catch (error) {
      console.error('[SessionTimeout] Erro ao salvar última atividade:', error);
    }
  }

  /**
   * Adiciona listeners de atividade do usuário
   */
  private addActivityListeners(): void {
    const handleActivity = () => {
      // Se está no período de aviso, resetar o timer
      if (this.state.isWarningActive || this.shouldResetTimer()) {
        this.resetTimer();
      }
    };

    // Throttle para evitar muitos resets (máximo 1 reset por segundo)
    let lastReset = 0;
    const throttledHandleActivity = () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        handleActivity();
      }
    };

    // Adicionar listeners para cada tipo de evento
    SESSION_CONFIG.ACTIVITY_EVENTS.forEach((eventType) => {
      window.addEventListener(eventType, throttledHandleActivity, { passive: true });
      this.state.activityListeners.push(() => {
        window.removeEventListener(eventType, throttledHandleActivity);
      });
    });
  }

  /**
   * Remove listeners de atividade do usuário
   */
  private removeActivityListeners(): void {
    this.state.activityListeners.forEach((removeListener) => {
      removeListener();
    });
    this.state.activityListeners = [];
  }

  /**
   * Verifica se deve resetar o timer baseado na última atividade
   */
  private shouldResetTimer(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.state.lastActivityTime;

    // Resetar se passou mais de 10 segundos desde a última atividade
    return timeSinceLastActivity > 10000;
  }

  /**
   * Inicia verificação periódica de timeout (sincronização entre abas)
   */
  private startPeriodicCheck(): void {
    this.state.checkIntervalId = setInterval(() => {
      this.checkInactivity();
    }, SESSION_CONFIG.CHECK_INTERVAL);
  }

  /**
   * Verifica inatividade e sincroniza com outras abas
   */
  private checkInactivity(): void {
    try {
      // Ler última atividade do localStorage (pode ter sido atualizada por outra aba)
      const storedLastActivity = localStorage.getItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);

      if (storedLastActivity) {
        const lastActivity = parseInt(storedLastActivity, 10);
        const now = Date.now();
        const inactiveTime = now - lastActivity;

        // Se passou do tempo de timeout, fazer logout
        if (inactiveTime >= SESSION_CONFIG.TIMEOUT_DURATION) {
          this.handleTimeout();
          return;
        }

        // Se passou do tempo de aviso, mostrar aviso
        const warningTime = SESSION_CONFIG.TIMEOUT_DURATION - SESSION_CONFIG.WARNING_DURATION;
        if (inactiveTime >= warningTime && !this.state.isWarningActive) {
          this.handleWarning();
        }

        // Calcular tempo restante e chamar callback de aviso
        if (this.state.isWarningActive && this.onWarning) {
          const remainingTime = SESSION_CONFIG.TIMEOUT_DURATION - inactiveTime;
          const remainingSeconds = Math.ceil(remainingTime / 1000);
          this.onWarning(remainingSeconds);
        }
      }
    } catch (error) {
      console.error('[SessionTimeout] Erro ao verificar inatividade:', error);
    }
  }

  /**
   * Manipula o aviso de timeout
   */
  private handleWarning(): void {
    if (this.state.isWarningActive) return;

    this.state.isWarningActive = true;
    console.log('[SessionTimeout] Aviso de timeout ativado');

    if (this.onWarning) {
      const remainingSeconds = Math.ceil(SESSION_CONFIG.WARNING_DURATION / 1000);
      this.onWarning(remainingSeconds);
    }
  }

  /**
   * Manipula o timeout da sessão
   */
  private handleTimeout(): void {
    console.log('[SessionTimeout] Sessão expirou por inatividade');

    // Para o gerenciador
    this.stop();

    // Chama callback de timeout (fazer logout)
    if (this.onTimeout) {
      this.onTimeout();
    }
  }

  /**
   * Obtém o tempo restante até o timeout em segundos
   */
  getRemainingTime(): number {
    const now = Date.now();
    const inactiveTime = now - this.state.lastActivityTime;
    const remainingTime = SESSION_CONFIG.TIMEOUT_DURATION - inactiveTime;
    return Math.max(0, Math.ceil(remainingTime / 1000));
  }

  /**
   * Verifica se o aviso está ativo
   */
  isWarningActive(): boolean {
    return this.state.isWarningActive;
  }

  /**
   * Estende a sessão (chamado quando usuário clica em "Continuar Conectado")
   */
  extendSession(): void {
    console.log('[SessionTimeout] Sessão estendida pelo usuário');
    this.resetTimer();
  }
}

/**
 * Instância singleton do gerenciador de timeout
 */
let sessionTimeoutManager: SessionTimeoutManager | null = null;

/**
 * Obtém a instância do gerenciador de timeout (singleton)
 */
export function getSessionTimeoutManager(): SessionTimeoutManager {
  if (!sessionTimeoutManager) {
    sessionTimeoutManager = new SessionTimeoutManager();
  }
  return sessionTimeoutManager;
}

/**
 * Hook React para usar o gerenciador de timeout
 */
export function useSessionTimeout(
  onTimeout: TimeoutCallback,
  onWarning?: TimeoutWarningCallback
): SessionTimeoutManager {
  const manager = getSessionTimeoutManager();

  // Inicializar gerenciador no mount
  React.useEffect(() => {
    manager.start(onTimeout, onWarning);

    // Cleanup no unmount
    return () => {
      manager.stop();
    };
  }, [onTimeout, onWarning]);

  return manager;
}

/**
 * Formata segundos em formato legível (mm:ss)
 */
export function formatTimeRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Para poder usar o hook
import React from 'react';
