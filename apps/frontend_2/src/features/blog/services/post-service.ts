import type { BlogPost, CreatePostData, UpdatePostData } from '../types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export const postService = {
  async getPosts(params?: {
    category?: string
    published?: boolean
    limit?: number
    offset?: number
  }): Promise<BlogPost[]> {
    const queryParams = new URLSearchParams()
    if (params?.category) queryParams.append('category', params.category)
    if (params?.published !== undefined) queryParams.append('published', String(params.published))
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))

    const response = await fetch(`${API_URL}/blog/posts?${queryParams}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Erro ao carregar posts')
    }

    const data = await response.json()
    return data.items || []
  },

  async getPost(id: string): Promise<BlogPost> {
    const response = await fetch(`${API_URL}/blog/posts/${id}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Erro ao carregar post')
    }

    return response.json()
  },

  async createPost(data: CreatePostData): Promise<BlogPost> {
    const response = await fetch(`${API_URL}/blog/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao criar post')
    }

    return response.json()
  },

  async updatePost(data: UpdatePostData): Promise<BlogPost> {
    const { id, ...updateData } = data
    const response = await fetch(`${API_URL}/blog/posts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao atualizar post')
    }

    return response.json()
  },

  async deletePost(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/blog/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao deletar post')
    }
  },
}
