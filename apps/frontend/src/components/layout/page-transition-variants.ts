import type { Variants, Transition } from "framer-motion";

/**
 * Variantes de transição de página
 *
 * Exemplos de uso:
 *
 * ```tsx
 * // Padrão (fade sutil)
 * <PageTransition>{children}</PageTransition>
 *
 * // Slide horizontal (navegação lateral)
 * <PageTransition variant="slide">{children}</PageTransition>
 *
 * // Slide vertical (navegação hierárquica)
 * <PageTransition variant="slideUp">{children}</PageTransition>
 *
 * // Scale (destaque/modal)
 * <PageTransition variant="scale">{children}</PageTransition>
 *
 * // Sem animação (performance)
 * <PageTransition variant="none">{children}</PageTransition>
 * ```
 *
 * Recomendações por contexto:
 * - Páginas públicas: 'fade' (padrão)
 * - App interno: 'fade' ou 'slideUp'
 * - Navegação em breadcrumbs: 'slide'
 * - Modais/Overlays: 'scale'
 * - Admin/Editor: 'none' (mais pesado)
 */
export type TransitionVariant = "fade" | "slide" | "slideUp" | "scale" | "none";

export const transitionVariants: Record<TransitionVariant, Variants> = {
  // Fade simples (padrão - sutil e rápido)
  fade: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },

  // Slide horizontal (para navegação lateral)
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },

  // Slide vertical (para scroll/navegação vertical)
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },

  // Scale (zoom suave)
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },

  // Sem animação
  none: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
  },
};

export const transitionConfig: Transition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.2,
};

// Transição mais lenta para páginas complexas
export const slowTransitionConfig: Transition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3,
};

// Transição instantânea (para modais, etc.)
export const fastTransitionConfig: Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.15,
};
