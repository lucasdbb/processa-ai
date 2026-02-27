import { ConsoleAnalyticsService, PostHogAnalyticsService } from './services';
import { type AnalyticsService } from './types';

// Singleton para garantir uma única instância
class Analytics {
  private service: AnalyticsService;
  private static instance: Analytics;

  private constructor() {
    const apiKey = import.meta.env.VITE_POSTHOG_KEY;
    const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

    // Se tivermos a chave, usamos PostHog (mesmo em DEV para testes).
    // Caso contrário, usamos o ConsoleAnalyticsService para debug local.
    if (apiKey) {
      this.service = new PostHogAnalyticsService(apiKey, apiHost);
      this.service.init(); // Inicializar aqui explicitamente
    } else {
      this.service = new ConsoleAnalyticsService();
      this.service.init();
    }
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

  public reset() {
    this.service.reset();
  }
}

export const analytics = Analytics.getInstance();
