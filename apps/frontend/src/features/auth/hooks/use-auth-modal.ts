import { useRouter } from 'next/navigation'

type ModalType = 'login' | 'register'

export function useAuthModal() {
  const router = useRouter()

  const openModal = (type: ModalType) => {
    // Since we're using a server-rendered page structure,
    // we'll navigate to the home page with a query parameter
    // that will trigger the modal to open
    router.push(`/?modal=${type}`)
  }

  return {
    openModal,
  }
}
