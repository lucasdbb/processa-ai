import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, X } from 'lucide-react';
import { sanitizeText } from '@/shared/utils/sanitize';
import type { BlogCategoryId } from '../types/blog';
import { ToastContainer } from '@/shared/components/Toast';
import type { ToastType } from '@/shared/components/Toast';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { $convertToMarkdownString, $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import 'prismjs/themes/prism.css';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { Input, TextArea, Select } from './ui/FormComponents';
import { ImageUpload } from './ui/ImageUpload';
import { ToolbarPlugin } from './plugins/ToolbarPlugin';

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').trim();

const categories: Array<{ id: BlogCategoryId; name: string; value: string; label: string }> = [
  { id: 'direito-trabalho', name: 'Direito do Trabalho', value: 'direito-trabalho', label: 'Direito do Trabalho' },
  { id: 'previdenciario', name: 'Previdenciário', value: 'previdenciario', label: 'Previdenciário' },
  { id: 'calculos', name: 'Cálculos', value: 'calculos', label: 'Cálculos' },
  { id: 'jurisprudencia', name: 'Jurisprudência', value: 'jurisprudencia', label: 'Jurisprudência' },
  { id: 'legislacao', name: 'Legislação', value: 'legislacao', label: 'Legislação' },
];

function toSlug(input: string): string {
  const s = sanitizeText(input).toLowerCase();
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Helper component to update editor content
const UpdatePlugin = ({ content }: { content: string }) => {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (content) {
      editor.update(() => {
        $convertFromMarkdownString(content, TRANSFORMERS);
      });
    }
  }, [content, editor]);

  return null;
};

const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const editPostId = routeId || null;

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState<BlogCategoryId>('direito-trabalho');
  const [tagsInput, setTagsInput] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [isPublishing, setIsPublishing] = useState(false);
  const [contentMd, setContentMd] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);
  const [initialContent, setInitialContent] = useState('');

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fillForm = useCallback((post: any) => {
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt || '');
    setContentMd(post.content || '');
    setInitialContent(post.content || '');
    setCategory(post.category_slug || post.category_id || 'direito-trabalho');
    if (post.tags && Array.isArray(post.tags)) {
      setTagsInput(post.tags.join(', '));
    }
    setImageBase64(post.cover_image_url || null);
    setCreatedPostId(post.id);
    setPostStatus(post.status || 'draft');
  }, []);

  const loadPost = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');

      // Try admin endpoint first (handles drafts and published)
      const res = await fetch(`/api/blog/admin/posts/${id}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const post = await res.json();
        fillForm(post);
        return;
      }

      // Fallback to public endpoint (only published)
      const publicRes = await fetch(`${API_BASE_URL}/api/blog/posts/${id}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!publicRes.ok) {
        throw new Error('Post não encontrado');
      }

      const post = await publicRes.json();
      fillForm(post);
    } catch (e) {
      showToast('Erro ao carregar post para edição', 'error');
      navigate('/admin');
    } finally {
      setIsLoading(false);
    }
  }, [fillForm, navigate]);

  // Load post data if editing
  useEffect(() => {
    if (editPostId) {
      loadPost(editPostId);
    }
  }, [editPostId, loadPost]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    // Only auto-update slug if it matches the old title slugified (new post behavior)
    // Or if user hasn't manually edited the slug yet
    if (!editPostId) {
      setSlug(toSlug(v));
    }
  };

  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700"></div>
      </div>
    );
  }

  const saveDraft = async () => {
    const payload = {
      title: sanitizeText(title),
      slug: slug || toSlug(title),
      excerpt: sanitizeText(excerpt),
      content: contentMd,
      category,
      tags: sanitizeText(tagsInput).split(',').map(t => t.trim()).filter(Boolean),
      cover_image_url: imageBase64 || undefined,
    };

    if (!payload.title || !payload.content) {
      return; // Silently skip if not enough content
    }

    try {
      setSaveStatus('saving');
      setIsSaving(true);
      const token = localStorage.getItem('access_token');

      let url = `${API_BASE_URL}/api/blog/posts`;
      let method = 'POST';

      if (createdPostId) {
         url = `${API_BASE_URL}/api/blog/posts/${createdPostId}`;
         method = 'PATCH';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setSaveStatus('error');
        return;
      }

      const saved = await res.json();
      if (!createdPostId && saved?.id) {
        setCreatedPostId(saved.id);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishOrUpdate = async () => {
    const payload = {
      title: sanitizeText(title),
      slug: slug || toSlug(title),
      excerpt: sanitizeText(excerpt),
      content: contentMd,
      category,
      tags: sanitizeText(tagsInput).split(',').map(t => t.trim()).filter(Boolean),
      cover_image_url: imageBase64 || undefined,
    };

    if (!payload.title || !payload.slug || !payload.content) {
      showToast('Preencha título e conteúdo.', 'error');
      return;
    }

    try {
      setIsPublishing(true);
      const token = localStorage.getItem('access_token');

      // First, save the content
      let postId = createdPostId;
      if (!postId) {
        // Create draft first
        const createRes = await fetch(`${API_BASE_URL}/api/blog/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
          const text = await createRes.text();
          showToast(text || 'Erro ao salvar post', 'error');
          return;
        }

        const created = await createRes.json();
        postId = created.id;
        setCreatedPostId(postId);
      } else {
        // Update existing post
        const updateRes = await fetch(`${API_BASE_URL}/api/blog/posts/${postId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!updateRes.ok) {
          const text = await updateRes.text();
          showToast(text || 'Erro ao atualizar post', 'error');
          return;
        }
      }

      // If already published, we're done (just updated)
      if (postStatus === 'published') {
        setPostStatus('published');
        showToast('Post atualizado!', 'success');
        return;
      }

      // Otherwise, publish it
      const publishRes = await fetch(`${API_BASE_URL}/api/blog/posts/${postId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!publishRes.ok) {
        const txt = await publishRes.text();
        showToast(txt || 'Erro ao publicar.', 'error');
        return;
      }

      setPostStatus('published');
      showToast('Post publicado!', 'success');
    } catch (e) {
      showToast('Falha ao processar.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraftOrRestore = async () => {
    await saveDraft();
    if (createdPostId && postStatus === 'archived') {
      try {
        setIsSaving(true);
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/blog/posts/${createdPostId}/restore`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        });
        if (!res.ok) {
          const txt = await res.text();
          showToast(txt || 'Erro ao restaurar rascunho', 'error');
          return;
        }
        setPostStatus('draft');
        showToast('Rascunho restaurado!', 'success');
      } catch (e) {
        showToast('Falha ao salvar rascunho', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-4 font-sans">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between sticky top-0 z-10 bg-gray-50/50 backdrop-blur-sm py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin?tab=posts')}
              className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900 hover:shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editPostId ? 'Editar Artigo' : 'Novo Artigo'}
              </h1>
              <p className="text-sm text-gray-500">
                {editPostId ? 'Atualize seu conteúdo' : 'Crie conteúdo relevante para sua audiência'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Save Status Indicator */}
            {saveStatus === 'saving' && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
                <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                Salvando...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                {postStatus === 'published' ? 'Publicado' : 'Rascunho salvo'}
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                <X className="w-4 h-4" />
                Erro ao salvar
              </div>
            )}

            <div className="flex-1"></div>

            {/* Single Action Button */}
            <button
              onClick={() => {
                if (!createdPostId || postStatus === 'archived') {
                  handleSaveDraftOrRestore();
                } else {
                  handlePublishOrUpdate();
                }
              }}
              disabled={isPublishing || isSaving}
              className="btn-primary h-10 flex items-center justify-center gap-2 shadow-lg shadow-primary-900/20 disabled:opacity-50"
            >
              {isPublishing || isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {!createdPostId || postStatus === 'archived' ? 'Salvando...' : postStatus === 'published' ? 'Atualizando...' : 'Publicando...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {!createdPostId || postStatus === 'archived' ? 'Salvar rascunho' : postStatus === 'published' ? 'Atualizar' : 'Publicar'}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Main Content Column */}
          <div className="xl:col-span-8 space-y-6 flex flex-col h-full min-h-[calc(100vh-8rem)]">
            {/* Editor Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-grow flex flex-col">
              <div className="p-0 flex-grow flex flex-col">
                <LexicalComposer
                  initialConfig={{
                    namespace: 'CreatePostEditor',
                    onError: (error) => console.error(error),
                    nodes: [
                      HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, 
                      AutoLinkNode, CodeNode, CodeHighlightNode
                    ],
                    theme: {
                      paragraph: 'mb-4 text-gray-700 leading-relaxed',
                      quote: 'border-l-4 border-primary-500 pl-4 italic text-gray-700 my-4 bg-gray-50 py-2 pr-2 rounded-r',
                      heading: {
                        h1: 'text-3xl font-bold text-gray-900 mb-4 mt-6',
                        h2: 'text-2xl font-semibold text-gray-900 mb-3 mt-5',
                        h3: 'text-xl font-semibold text-gray-900 mb-2 mt-4',
                      },
                      link: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
                      list: {
                        ul: 'list-disc list-inside mb-4 space-y-1 text-gray-700',
                        ol: 'list-decimal list-inside mb-4 space-y-1 text-gray-700',
                      },
                      code: 'font-mono text-sm bg-gray-900 text-gray-100 rounded-lg px-4 py-3 block overflow-x-auto my-4',
                      codeHighlight: {
                        atrule: 'text-purple-400',
                        attr: 'text-blue-400',
                        boolean: 'text-red-400',
                        builtin: 'text-green-400',
                        cdata: 'text-gray-500',
                        char: 'text-gray-400',
                        class: 'text-yellow-400',
                        'class-name': 'text-yellow-400',
                        comment: 'text-gray-500 italic',
                        constant: 'text-orange-400',
                        deleted: 'text-red-400',
                        doctype: 'text-gray-500',
                        entity: 'text-gray-400',
                        function: 'text-blue-400',
                        important: 'text-purple-400 font-bold',
                        inserted: 'text-green-400',
                        keyword: 'text-purple-400',
                        namespace: 'text-gray-500',
                        number: 'text-orange-400',
                        operator: 'text-gray-400',
                        prolog: 'text-gray-500',
                        property: 'text-blue-400',
                        punctuation: 'text-gray-400',
                        regex: 'text-red-400',
                        selector: 'text-yellow-400',
                        string: 'text-green-400',
                        symbol: 'text-orange-400',
                        tag: 'text-red-400',
                        url: 'text-blue-400 underline',
                        variable: 'text-yellow-400',
                      },
                    },
                  }}
                >
                  <ToolbarPlugin />
                  <div className="relative flex-grow flex flex-col p-6">
                    <RichTextPlugin
                      contentEditable={<ContentEditable className="flex-grow outline-none min-h-full" />}
                      placeholder={<div className="absolute top-6 left-6 text-gray-400 pointer-events-none">Comece a escrever seu artigo...</div>}
                      ErrorBoundary={LexicalErrorBoundary}
                    />
                    <HistoryPlugin />
                    <AutoFocusPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                    <UpdatePlugin content={initialContent} />
                    <OnChangePlugin onChange={(editorState) => {
                      const md = editorState.read(() => $convertToMarkdownString(TRANSFORMERS));
                      setContentMd(md);
                    }} />
                  </div>
                </LexicalComposer>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
              <h3 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">Detalhes do Artigo</h3>
              
              <div className="space-y-5">
                <Input
                  label="Título do Post"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Ex: Como funciona a IA Jurídica"
                />

                <Input
                  label="Slug (URL amigável)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="como-funciona-ia-juridica"
                  className="font-mono text-sm"
                />

                <Select
                  label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BlogCategoryId)}
                  options={categories}
                />

                <TextArea
                  label="Resumo (Excerpt)"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Breve descrição para aparecer nos cards..."
                  rows={4}
                />

                <Input
                  label="Tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tecnologia, direito, ia (separadas por vírgula)"
                />

                <ImageUpload
                  value={imageBase64}
                  onChange={(base64) => {
                    setImageBase64(base64 || null);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
};

export default CreatePostPage;
