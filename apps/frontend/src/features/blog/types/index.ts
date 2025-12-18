export interface BlogPost {
  id: string
  slug: string
  title: string
  content: string
  excerpt?: string
  category: string
  tags?: string[]
  featured_image?: string
  cover_image_url?: string
  author_id?: string
  author?: {
    id: string
    name: string
    avatar_url?: string
  }
  authors?: Array<{
    id: string
    name: string
  }>
  published: boolean
  published_at?: string
  created_at: string
  updated_at?: string
  views?: number
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string
  post_count?: number
}

export interface CreatePostData {
  title: string
  content: string
  excerpt?: string
  category: string
  tags?: string[]
  featured_image?: string
  published: boolean
}

export interface UpdatePostData extends Partial<CreatePostData> {
  id: string
}
