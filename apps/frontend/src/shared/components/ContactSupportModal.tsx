import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, Phone, MessageSquare, Building2, User, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useFormValidation } from '../hooks/useFormValidation';

type SubjectOption =
  | 'Suporte Técnico'
  | 'Dúvidas sobre IA Jurídica'
  | 'Problemas de Login'
  | 'Planos e Preços'
  | 'Integrações'
  | 'Outros';

type ContactPreference = 'email' | 'telefone' | 'whatsapp';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: SubjectOption;
  contactPreference: ContactPreference;
  message: string;
  isClient: boolean;
  consent: boolean;
}

const SUBJECT_OPTIONS: SubjectOption[] = [
  'Suporte Técnico',
  'Dúvidas sobre IA Jurídica',
  'Problemas de Login',
  'Planos e Preços',
  'Integrações',
  'Outros',
];

const ContactSupportModal: React.FC<ContactSupportModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: 'Suporte Técnico',
    contactPreference: 'email',
    message: '',
    isClient: false,
    consent: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const { errors, validateForm, clearFieldError, clearErrors } = useFormValidation({
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    subject: { required: true },
    contactPreference: { required: true },
    message: { required: true, minLength: 10, maxLength: 2000 },
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (firstInputRef.current) {
        firstInputRef.current.focus();
      }
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setForm(prev => ({ ...prev, [name]: target.checked }));
      clearFieldError(name);
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
    clearFieldError(name);
  }, [clearFieldError]);

  const handleToggleClient = useCallback(() => {
    setForm(prev => ({ ...prev, isClient: !prev.isClient }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const baseValues: Record<string, string> = {
      name: form.name,
      email: form.email,
      subject: form.subject,
      contactPreference: form.contactPreference,
      message: form.message,
    };

    if (!form.consent) {
      setError('É necessário consentir com o contato para prosseguir.');
      return;
    }

    const isValid = validateForm(baseValues);
    if (!isValid) return;

    setIsLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        subject: form.subject,
        contactPreference: form.contactPreference,
        message: form.message,
        isClient: form.isClient,
        consent: form.consent,
      };

      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const txt = await response.text();
        setError(txt || 'Erro ao enviar sua solicitação.');
        return;
      }

      setSuccess(true);
      clearErrors();
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: 'Suporte Técnico',
        contactPreference: 'email',
        message: '',
        isClient: false,
        consent: false,
      });
    } catch {
      setError('Erro de conexão. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  }, [form, validateForm, clearErrors]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300" onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button onClick={handleClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Falar com o Suporte</h2>
        <p className="text-gray-500 mb-6">Preencha os dados e nossa equipe entrará em contato.</p>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3" role="alert">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">Solicitação enviada com sucesso! Em breve entraremos em contato.</p>
            </div>
            <button onClick={handleClose} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-gray-900/20">Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Nome completo *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input ref={firstInputRef} type="text" id="name" name="name" value={form.name} onChange={handleChange} className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.name ? 'border-red-500 focus:ring-red-500 bg-red-50' : ''}`} placeholder="Seu nome" />
                </div>
                {errors.name && <p className="mt-1 text-xs text-red-600 font-medium">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="email" id="email" name="email" value={form.email} onChange={handleChange} className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.email ? 'border-red-500 focus:ring-red-500 bg-red-50' : ''}`} placeholder="seu@email.com" />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-600 font-medium">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Telefone/WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-1.5">Empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="text" id="company" name="company" value={form.company} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors" placeholder="Nome da empresa (opcional)" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-1.5">Assunto *</label>
                <div className="relative">
                  <select id="subject" name="subject" value={form.subject} onChange={handleChange} className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block p-2.5 transition-colors appearance-none ${errors.subject ? 'border-red-500 focus:ring-red-500 bg-red-50' : ''}`}>
                    {SUBJECT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                {errors.subject && <p className="mt-1 text-xs text-red-600 font-medium">{errors.subject}</p>}
              </div>
              <div>
                <label htmlFor="contactPreference" className="block text-sm font-semibold text-gray-700 mb-1.5">Preferência de contato *</label>
                <div className="relative">
                  <select id="contactPreference" name="contactPreference" value={form.contactPreference} onChange={handleChange} className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block p-2.5 transition-colors appearance-none ${errors.contactPreference ? 'border-red-500 focus:ring-red-500 bg-red-50' : ''}`}>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                {errors.contactPreference && <p className="mt-1 text-xs text-red-600 font-medium">{errors.contactPreference}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-1.5">Mensagem *</label>
              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3.5 text-gray-400 h-4 w-4" />
                <textarea id="message" name="message" value={form.message} onChange={handleChange} rows={4} className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.message ? 'border-red-500 focus:ring-red-500 bg-red-50' : ''}`} placeholder="Como podemos ajudar?" />
              </div>
              {errors.message && <p className="mt-1 text-xs text-red-600 font-medium">{errors.message}</p>}
            </div>

            <div className="flex items-start space-x-3 bg-gray-50 p-3 rounded-xl">
              <div className="flex items-center h-5">
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={handleChange}
                  className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2"
                />
              </div>
              <label htmlFor="consent" className="text-sm font-medium text-gray-600">
                Concordo com o processamento dos meus dados para fins de contato.
              </label>
            </div>
            {errors.consent && <p className="mt-1 text-xs text-red-600 font-medium">{errors.consent}</p>}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-center gap-2" role="alert">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-gray-900/20">
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              Enviar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ContactSupportModal;
