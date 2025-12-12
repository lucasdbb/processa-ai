/**
 * Cookie utilities for managing authentication tokens
 */

export const cookieUtils = {
  /**
   * Set a cookie
   */
  set(name: string, value: string, days = 7) {
    if (typeof window === 'undefined') return

    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  },

  /**
   * Get a cookie value
   */
  get(name: string): string | null {
    if (typeof window === 'undefined') return null

    const nameEQ = name + '='
    const ca = document.cookie.split(';')

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
    }

    return null
  },

  /**
   * Delete a cookie
   */
  delete(name: string) {
    if (typeof window === 'undefined') return

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
  },
}
