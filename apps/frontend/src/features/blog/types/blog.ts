/**
 * Blog-related type definitions for the Processa AI application
 */

/**
 * Represents a blog post category
 */
export interface BlogCategory {
  /** Unique identifier for the category */
  id: string;
  /** Display name of the category */
  name: string;
}

/**
 * Represents a blog post tag
 */
export type BlogTag = string;

/**
 * Valid blog post categories
 */
export type BlogCategoryId = 
  | 'all'
  | 'direito-trabalho'
  | 'previdenciario'
  | 'calculos'
  | 'jurisprudencia'
  | 'legislacao';

/**
 * Represents a complete blog post
 */
export interface BlogPost {
  /** Unique identifier for the blog post */
  id: number;
  /** Title of the blog post */
  title: string;
  /** Short excerpt or summary of the post */
  excerpt: string;
  /** Author's name */
  author: string;
  /** Publication date in YYYY-MM-DD format */
  date: string;
  /** Estimated reading time */
  readTime: string;
  /** Category the post belongs to */
  category: BlogCategoryId;
  /** URL to the post's featured image */
  image: string;
  /** Array of tags associated with the post */
  tags: BlogTag[];
}

/**
 * Props for blog post filtering
 */
export interface BlogFilterProps {
  /** Current search term */
  searchTerm: string;
  /** Currently selected category */
  selectedCategory: BlogCategoryId;
  /** Function to update search term */
  onSearchChange: (term: string) => void;
  /** Function to update selected category */
  onCategoryChange: (category: BlogCategoryId) => void;
  /** Available categories for filtering */
  categories: BlogCategory[];
}

/**
 * Props for individual blog post card component
 */
export interface BlogPostCardProps {
  /** The blog post data to display */
  post: BlogPost;
  /** Whether this is a featured post (larger display) */
  featured?: boolean;
  /** Optional click handler for the post */
  onClick?: (post: BlogPost) => void;
}
