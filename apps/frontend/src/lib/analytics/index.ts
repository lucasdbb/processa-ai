import { ConsoleAnalyticsService, PostHogAnalyticsService } from './services';
import { type AnalyticsService } from './types';

// Singleton para garantir uma única instância
class Analytics {
  private service: AnalyticsService;
  private static instance: Analytics;

  private constructor() {
    const apiKey = import.meta.env.VITE_POSTHOG_KEY;
    const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
    const isProd = import.meta.env.PROD;

    // Se tivermos a chave e estivermos em produção, usamos PostHog.
    // Caso contrário, usamos o ConsoleAnalyticsService para debug local.
    if (apiKey && isProd) {
      this.service = new PostHogAnalyticsService(apiKey, apiHost);
    } else {
      this.service = new ConsoleAnalyticsService();
    }
    
    // ATENÇÃO: Se não aparecer nada no console em DEV, verifique se o 'console.groupCollapsed' não está filtrado no seu navegador.
    this.service.init();
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public track(event: string, properties?: Record<string, any>) {
    this.service.track(event, properties);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public identify(userId: string, traits?: Record<string, any>) {
    this.service.identify(userId, traits);
  }

  public pageView(path: string) {
    this.service.pageView(path);
  }
}

export const analytics = Analytics.getInstance();
