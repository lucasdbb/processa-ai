/**
 * Utilitários para máscaras de formatação
 */

/**
 * Aplica máscara de telefone brasileiro no formato (XX) XXXXX-XXXX
 * @param value - Valor do telefone (apenas números)
 * @returns Telefone formatado com máscara
 */
export const phoneMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos (DDD + 9 dígitos)
  const limitedNumbers = numbers.slice(0, 11);
  
  // Aplica a máscara baseada na quantidade de dígitos
  if (limitedNumbers.length <= 2) {
    return limitedNumbers;
  } else if (limitedNumbers.length <= 7) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
  } else {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
  }
};

/**
 * Remove a máscara do telefone, retornando apenas os números
 * @param maskedValue - Telefone com máscara
 * @returns Apenas os números do telefone
 */
export const removePhoneMask = (maskedValue: string): string => {
  return maskedValue.replace(/\D/g, '');
};

/**
 * Valida se o telefone tem o formato correto (11 dígitos)
 * @param phone - Telefone (com ou sem máscara)
 * @returns true se válido, false caso contrário
 */
export const isValidPhone = (phone: string): boolean => {
  const numbers = removePhoneMask(phone);
  return numbers.length === 11;
};