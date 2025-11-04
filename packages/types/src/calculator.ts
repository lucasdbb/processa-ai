/**
 * Calculator-related type definitions for the Processa AI application
 */

import type { ComponentType } from 'react';

/**
 * Types of employment termination
 */
export type TipoRescisao = 
  | 'sem_justa_causa'
  | 'com_justa_causa'
  | 'pedido_demissao'
  | 'acordo'
  | 'aposentadoria';

/**
 * Gender options for retirement calculations
 */
export type Sexo = 'masculino' | 'feminino';

/**
 * Types of retirement calculations
 */
export type TipoAposentadoria = 
  | 'tempo_contribuicao'
  | 'idade'
  | 'especial'
  | 'invalidez';

/**
 * Calculator types available in the application
 */
export type CalculatorType = 'rescisao' | 'aposentadoria';

/**
 * Form data structure for all calculator inputs
 */
export interface CalculatorFormData {
  // Severance calculation fields
  /** Monthly salary amount */
  salario: string;
  /** Employment start date */
  dataAdmissao: string;
  /** Employment termination date */
  dataRescisao: string;
  /** Type of employment termination */
  tipoRescisao: TipoRescisao;
  /** Whether prior notice applies */
  avisoPrevio: boolean;
  /** Accrued vacation days */
  feriasVencidas: string;
  /** Whether proportional vacation applies */
  feriasProporcionais: boolean;
  /** Whether 13th salary applies */
  decimoTerceiro: boolean;

  // Retirement calculation fields
  /** Current age */
  idade: string;
  /** Years of contribution */
  tempoContribuicao: string;
  /** Monthly contribution salary */
  salarioContribuicao: string;
  /** Gender for retirement rules */
  sexo: Sexo;
  /** Type of retirement calculation */
  tipoAposentadoria: TipoAposentadoria;
}

/**
 * Detailed breakdown of severance calculation results
 */
export interface DetalhesRescisao {
  /** Proportional salary for worked days */
  saldoSalario: number;
  /** Prior notice compensation */
  avisoPrevio: number;
  /** Accrued vacation payment */
  feriasVencidas: number;
  /** Proportional vacation payment */
  feriasProporcionais: number;
  /** 13th salary payment */
  decimoTerceiro: number;
  /** FGTS (Employment Guarantee Fund) balance */
  fgts: number;
  /** FGTS penalty (40% fine) */
  multaFgts: number;
  /** Total severance amount */
  total: number;
}

/**
 * Detailed breakdown of retirement calculation results
 */
export interface DetalhesAposentadoria {
  /** Whether the person can retire now */
  podeAposentar: boolean;
  /** Years remaining until retirement eligibility */
  anosRestantes: number;
  /** Time remaining until retirement (formatted string) */
  tempoRestante: number;
  /** Estimated monthly retirement benefit */
  beneficio: number;
  /** Minimum age required for retirement */
  idadeMinima: number;
  /** Minimum contribution time required */
  tempoMinimoContrib: number;
}

/**
 * Severance calculation result
 */
export interface ResultadoRescisao {
  /** Type identifier for the result */
  tipo: 'rescisao';
  /** Detailed calculation breakdown */
  detalhes: DetalhesRescisao;
}

/**
 * Retirement calculation result
 */
export interface ResultadoAposentadoria {
  /** Type identifier for the result */
  tipo: 'aposentadoria';
  /** Detailed calculation breakdown */
  detalhes: DetalhesAposentadoria;
}

/**
 * Union type for all possible calculation results
 */
export type Resultado = ResultadoRescisao | ResultadoAposentadoria;

/**
 * Calculator configuration for the UI
 */
export interface CalculatorConfig {
  /** Unique identifier for the calculator */
  id: CalculatorType;
  /** Display name of the calculator */
  name: string;
  /** Brief description of what the calculator does */
  description: string;
  /** Icon component for the calculator */
  icon: ComponentType<{ className?: string }>;
  /** Whether the calculator is currently available */
  available: boolean;
  /** CSS color class for the calculator */
  color?: string;
}

/**
 * Props for calculator input components
 */
export interface CalculatorInputProps {
  /** Current form data */
  formData: CalculatorFormData;
  /** Function to update form data */
  onChange: (data: Partial<CalculatorFormData>) => void;
  /** Function to handle calculation */
  onCalculate: () => void;
  /** Whether calculation is in progress */
  loading?: boolean;
}

/**
 * Props for calculator result display components
 */
export interface CalculatorResultProps {
  /** Calculation result to display */
  resultado: Resultado;
  /** Function to clear/reset the result */
  onClear: () => void;
  /** Function to download result as PDF */
  onDownload?: () => void;
}