import { HomePage } from './_components/home-page'

// Force dynamic rendering to avoid SSR issues with client components
export const dynamic = 'force-dynamic'

export default function Home() {
  return <HomePage />
}
