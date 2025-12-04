import React, { useEffect } from 'react';
import { X, Calendar, User, Tag, Users } from 'lucide-react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface PostViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    cover_image_url?: string;
    category_id?: string;
    published_at?: string;
    authors: Array<{ id: string; name?: string }>;
  } | null;
  categoryName?: string;
}

/**
 * Plugin to load markdown content into Lexical editor
 */
function MarkdownLoaderPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
  }, [editor, markdown]);

  return null;
}

/**
 * Modal component for viewing blog post with Lexical markdown rendering
 */
const PostViewModal: React.FC<PostViewModalProps> = ({ isOpen, onClose, post, categoryName }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const initialConfig = {
    namespace: 'PostViewer',
    theme: {
      paragraph: 'mb-4 text-gray-700 leading-relaxed',
      heading: {
        h1: 'text-3xl font-bold mb-6 mt-8 text-gray-900',
        h2: 'text-2xl font-bold mb-4 mt-6 text-gray-900',
        h3: 'text-xl font-bold mb-3 mt-5 text-gray-900',
        h4: 'text-lg font-bold mb-2 mt-4 text-gray-900',
        h5: 'text-base font-bold mb-2 mt-3 text-gray-900',
      },
      list: {
        ul: 'list-disc list-inside mb-4 ml-4 text-gray-700',
        ol: 'list-decimal list-inside mb-4 ml-4 text-gray-700',
        listitem: 'mb-2',
      },
      link: 'text-primary-600 hover:text-primary-800 underline',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'bg-gray-100 text-red-600 px-1 py-0.5 rounded font-mono text-sm',
      },
      code: 'bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 overflow-x-auto font-mono text-sm',
      quote: 'border-l-4 border-primary-300 pl-4 italic text-gray-600 my-4',
    },
    editable: false,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const estimateReadTime = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min de leitura`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with close button */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-primary-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{post.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {/* Cover Image */}
          {post.cover_image_url && (
            <div className="w-full h-64 md:h-80 overflow-hidden">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Post metadata */}
          <div className="px-6 md:px-8 py-6 border-b border-gray-200">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Meta information */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {/* Date */}
              {post.published_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  <span>{formatDate(post.published_at)}</span>
                </div>
              )}

              {/* Read time */}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{estimateReadTime(post.content)}</span>
              </div>

              {/* Authors */}
              {post.authors && post.authors.length > 0 && (
                <div className="flex items-center gap-2">
                  {post.authors.length === 1 ? (
                    <User className="w-4 h-4 text-primary-600" />
                  ) : (
                    <Users className="w-4 h-4 text-primary-600" />
                  )}
                  <span>
                    {post.authors.map((author, idx) => (
                      <span key={author.id}>
                        {author.name || 'Autor Anônimo'}
                        {idx < post.authors.length - 1 && ', '}
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {/* Category */}
              {categoryName && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary-600" />
                  <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium">
                    {categoryName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Post content with Lexical */}
          <div className="px-6 md:px-8 py-8">
            <LexicalComposer initialConfig={initialConfig}>
              <div className="relative">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable className="outline-none prose prose-lg max-w-none" />
                  }
                  placeholder={<></>}
                  ErrorBoundary={() => (
                    <div className="text-red-600 p-4 bg-red-50 rounded">
                      Erro ao renderizar o conteúdo
                    </div>
                  )}
                />
                <HistoryPlugin />
                <MarkdownLoaderPlugin markdown={post.content} />
              </div>
            </LexicalComposer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostViewModal;
