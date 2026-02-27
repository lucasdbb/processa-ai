export interface AnalyticsEvent {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>;
}

export interface AnalyticsUser {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traits?: Record<string, any>;
}

// Essa interface garante que não importa a ferramenta, o método é o mesmo
export interface AnalyticsService {
  init(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  track(event: string, properties?: Record<string, any>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identify(userId: string, traits?: Record<string, any>): void;
  pageView(path: string): void;
  reset(): void;
}
