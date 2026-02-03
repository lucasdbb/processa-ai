import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import {
  transitionVariants,
  transitionConfig,
  type TransitionVariant,
} from './page-transition-variants'

interface PageTransitionProps {
  children: ReactNode
  variant?: TransitionVariant
}

export function PageTransition({ children, variant = 'fade' }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={transitionVariants[variant]}
      transition={transitionConfig}
    >
      {children}
    </motion.div>
  )
}
