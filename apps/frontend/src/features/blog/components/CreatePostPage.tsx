import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
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
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import 'prismjs/themes/prism.css';

import { Input, TextArea, Select } from './ui/FormComponents';
import { ImageUpload } from './ui/ImageUpload';
import { ToolbarPlugin } from './plugins/ToolbarPlugin';

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

const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState<BlogCategoryId>('direito-trabalho');
  const [tagsInput, setTagsInput] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [contentMd, setContentMd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(toSlug(v));
  };

  const handleSaveDraft = async () => {
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
      setIsSubmitting(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/blog/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        showToast(text || 'Erro ao criar post', 'error');
        return;
      }
      const created = await res.json();
      setCreatedPostId(created?.id || null);
      showToast('Rascunho salvo!', 'success');
    } catch (e) {
      showToast('API não disponível. Post não foi salvo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!createdPostId) {
      await handleSaveDraft();
    }
    if (!createdPostId) {
      return;
    }
    const token = localStorage.getItem('access_token');
    try {
      setIsPublishing(true);
      const publishRes = await fetch(`/api/blog/posts/${createdPostId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (!publishRes.ok) {
        const txt = await publishRes.text();
        showToast(txt || 'Você não tem permissão para publicar.', 'error');
        return;
      }
      showToast('Post publicado!', 'success');
    } catch (e) {
      showToast('Falha ao publicar.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-4 font-sans">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between sticky top-0 z-10 bg-gray-50/50 backdrop-blur-sm py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900 hover:shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Artigo</h1>
              <p className="text-sm text-gray-500">Crie conteúdo relevante para sua audiência</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="px-4 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="btn-primary h-10 flex items-center justify-center gap-2 shadow-lg shadow-primary-900/20"
            >
              {isPublishing ? 'Publicando...' : 'Publicar post'}
            </button>
            {createdPostId && (
              <span className="inline-flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" /> Rascunho salvo
              </span>
            )}
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
