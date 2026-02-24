import { type AnalyticsService } from './types';
import posthog from 'posthog-js';

// Implementação "Fake" para desenvolvimento.
// Assim você vê os eventos no Console do navegador sem precisar de API Key.
export class ConsoleAnalyticsService implements AnalyticsService {
  init() {
    console.log('[Analytics] Initialized (Dev Mode)');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  track(event: string, properties?: Record<string, any>) {
    console.log(`[Analytics] Track: ${event}`, properties);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identify(userId: string, traits?: Record<string, any>) {
    console.log(`[Analytics] Identify User: ${userId}`, traits);
  }

  pageView(path: string) {
    console.log(`[Analytics] Page View: ${path}`);
  }
}

// Implementação Real do PostHog
export class PostHogAnalyticsService implements AnalyticsService {
  private apiKey: string;
  private apiHost: string;

  constructor(
    apiKey: string,
    apiHost: string = 'https://us.i.posthog.com'
  ) {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
  }

  init() {
    // Inicializa o PostHog apenas se estiver no navegador
    if (typeof window !== 'undefined') {
      posthog.init(this.apiKey, {
        api_host: this.apiHost,
        person_profiles: 'identified_only', // Otimização de custos: só cria perfil se identificar
        capture_pageview: false, // Vamos controlar manualmente para evitar duplicatas em SPA
        autocapture: false, // Desativado por padrão para reduzir ruído. Ative se quiser rastrear tudo.
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  track(event: string, properties?: Record<string, any>) {
    posthog.capture(event, properties);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identify(userId: string, traits?: Record<string, any>) {
    posthog.identify(userId, traits);
  }

  pageView(path: string) {
    posthog.capture('$pageview', {
      $current_url: path
    });
  }
}
