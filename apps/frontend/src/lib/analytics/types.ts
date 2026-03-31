export type AnalyticsProperties = Record<string, unknown>

export interface AnalyticsEvent {
  name: string
  properties?: AnalyticsProperties
}

export interface AnalyticsUser {
  id: string
  traits?: AnalyticsProperties
}

// Essa interface garante que não importa a ferramenta, o método é o mesmo
export interface AnalyticsService {
  init(): void
  track(event: string, properties?: AnalyticsProperties): void
  identify(userId: string, traits?: AnalyticsProperties): void
  pageView(path: string): void
  reset(): void
  register(properties: AnalyticsProperties): void
  unregister(property: string): void
}
