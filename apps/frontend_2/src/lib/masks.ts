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
  const numbers = value.replace(/\D/g, '')

  // Limita a 11 dígitos (DDD + 9 dígitos)
  const limitedNumbers = numbers.slice(0, 11)

  // Aplica a máscara baseada na quantidade de dígitos
  if (limitedNumbers.length <= 2) {
    return limitedNumbers
  } else if (limitedNumbers.length <= 7) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`
  } else {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`
  }
}

/**
 * Remove a máscara do telefone, retornando apenas os números
 * @param maskedValue - Telefone com máscara
 * @returns Apenas os números do telefone
 */
export const removePhoneMask = (maskedValue: string): string => {
  return maskedValue.replace(/\D/g, '')
}

/**
 * Valida se o telefone tem o formato correto (11 dígitos)
 * @param phone - Telefone (com ou sem máscara)
 * @returns true se válido, false caso contrário
 */
export const isValidPhone = (phone: string): boolean => {
  const numbers = removePhoneMask(phone)
  return numbers.length === 11
}

/**
 * Aplica máscara de CPF no formato XXX.XXX.XXX-XX
 * @param value - Valor do CPF (apenas números)
 * @returns CPF formatado com máscara
 */
export const cpfMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '')

  // Limita a 11 dígitos
  const limitedNumbers = numbers.slice(0, 11)

  // Aplica a máscara baseada na quantidade de dígitos
  if (limitedNumbers.length <= 3) {
    return limitedNumbers
  } else if (limitedNumbers.length <= 6) {
    return `${limitedNumbers.slice(0, 3)}.${limitedNumbers.slice(3)}`
  } else if (limitedNumbers.length <= 9) {
    return `${limitedNumbers.slice(0, 3)}.${limitedNumbers.slice(3, 6)}.${limitedNumbers.slice(6)}`
  } else {
    return `${limitedNumbers.slice(0, 3)}.${limitedNumbers.slice(3, 6)}.${limitedNumbers.slice(6, 9)}-${limitedNumbers.slice(9)}`
  }
}

/**
 * Aplica máscara de CNPJ no formato XX.XXX.XXX/XXXX-XX
 * @param value - Valor do CNPJ (apenas números)
 * @returns CNPJ formatado com máscara
 */
export const cnpjMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '')

  // Limita a 14 dígitos
  const limitedNumbers = numbers.slice(0, 14)

  // Aplica a máscara baseada na quantidade de dígitos
  if (limitedNumbers.length <= 2) {
    return limitedNumbers
  } else if (limitedNumbers.length <= 5) {
    return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2)}`
  } else if (limitedNumbers.length <= 8) {
    return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5)}`
  } else if (limitedNumbers.length <= 12) {
    return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8)}`
  } else {
    return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8, 12)}-${limitedNumbers.slice(12)}`
  }
}

/**
 * Remove a máscara do CPF/CNPJ, retornando apenas os números
 * @param maskedValue - CPF/CNPJ com máscara
 * @returns Apenas os números
 */
export const removeDocumentMask = (maskedValue: string): string => {
  return maskedValue.replace(/\D/g, '')
}

/**
 * Valida dígito verificador do CPF
 * @param cpf - CPF sem máscara (apenas números)
 * @returns true se válido, false caso contrário
 */
const validateCpfDigits = (cpf: string): boolean => {
  // Verifica se todos os dígitos são iguais (caso inválido)
  if (/^(\d)\1+$/.test(cpf)) return false

  // Valida primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cpf.charAt(9))) return false

  // Valida segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i)
  }
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cpf.charAt(10))) return false

  return true
}

/**
 * Valida dígito verificador do CNPJ
 * @param cnpj - CNPJ sem máscara (apenas números)
 * @returns true se válido, false caso contrário
 */
const validateCnpjDigits = (cnpj: string): boolean => {
  // Verifica se todos os dígitos são iguais (caso inválido)
  if (/^(\d)\1+$/.test(cnpj)) return false

  // Valida primeiro dígito verificador
  let length = cnpj.length - 2
  let numbers = cnpj.substring(0, length)
  const digits = cnpj.substring(length)
  let sum = 0
  let pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false

  // Valida segundo dígito verificador
  length = length + 1
  numbers = cnpj.substring(0, length)
  sum = 0
  pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false

  return true
}

/**
 * Valida se o CPF está no formato correto e é válido
 * @param cpf - CPF (com ou sem máscara)
 * @returns true se válido, false caso contrário
 */
export const isValidCpf = (cpf: string): boolean => {
  const numbers = removeDocumentMask(cpf)
  if (numbers.length !== 11) return false
  return validateCpfDigits(numbers)
}

/**
 * Valida se o CNPJ está no formato correto e é válido
 * @param cnpj - CNPJ (com ou sem máscara)
 * @returns true se válido, false caso contrário
 */
export const isValidCnpj = (cnpj: string): boolean => {
  const numbers = removeDocumentMask(cnpj)
  if (numbers.length !== 14) return false
  return validateCnpjDigits(numbers)
}
