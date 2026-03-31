import { ConsoleAnalyticsService, PostHogAnalyticsService } from './services';
import { type AnalyticsProperties, type AnalyticsService } from './types';

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

  public track(event: string, properties?: AnalyticsProperties) {
    this.service.track(event, properties);
  }

  public identify(userId: string, traits?: AnalyticsProperties) {
    this.service.identify(userId, traits);
  }

  public pageView(path: string) {
    this.service.pageView(path);
  }

  public reset() {
    this.service.reset();
  }

  public register(properties: AnalyticsProperties) {
    this.service.register(properties);
  }

  public unregister(property: string) {
    this.service.unregister(property);
  }
}

export const analytics = Analytics.getInstance();
