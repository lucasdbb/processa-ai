import React, { useState, useCallback, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import type { User, DocumentType } from '../types/auth';
import {
  phoneMask,
  removePhoneMask,
  isValidPhone,
  cpfMask,
  cnpjMask,
  removeDocumentMask,
  isValidCpf,
  isValidCnpj
} from '../../../shared/utils/masks';
import { fileToBase64 } from '../../../shared/utils/imageUtils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateProfile: (updatedUser: Partial<User>) => Promise<void>;
}

/**
 * Profile modal component for viewing and editing user information
 * Includes avatar upload functionality and form validation
 */
const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>(user.documentType || 'cpf');
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ? phoneMask(user.phone) : '',
    documentNumber: user.documentNumber
      ? (user.documentType === 'cnpj' ? cnpjMask(user.documentNumber) : cpfMask(user.documentNumber))
      : '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newsletterCheckboxRef = useRef<HTMLInputElement>(null);

  // Update checkbox when modal opens or user data changes
  React.useEffect(() => {
    if (newsletterCheckboxRef.current && isOpen) {
      newsletterCheckboxRef.current.checked = user.newsletter_opt_in || false;
    }
  }, [isOpen, user.newsletter_opt_in]);

  // Close modal on escape key and lock scroll
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Aplica máscara apropriada dependendo do campo
    let processedValue = value;
    if (name === 'phone') {
      processedValue = phoneMask(value);
    } else if (name === 'documentNumber') {
      processedValue = documentType === 'cpf' ? cpfMask(value) : cnpjMask(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  }, [documentType]);

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type);
    // Limpa o campo de documento ao trocar o tipo
    setFormData(prev => ({
      ...prev,
      documentNumber: ''
    }));
  }, []);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 5MB.');
        return;
      }

      try {
        // Convert to optimized base64 (400x400, quality 0.8)
        const base64 = await fileToBase64(file, 400, 400, 0.8);
        setAvatarPreview(base64);
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        alert('Erro ao processar imagem. Tente novamente.');
      }
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Remove as máscaras antes de enviar
      const cleanPhone = removePhoneMask(formData.phone);
      const cleanDocument = removeDocumentMask(formData.documentNumber);

      const updateData: Partial<User> = {
        name: formData.name,
        phone: cleanPhone.trim() === '' ? null : cleanPhone,
        documentType: documentType,
        documentNumber: cleanDocument.trim() === '' ? null : cleanDocument,
        newsletter_opt_in: newsletterCheckboxRef.current?.checked || false,
      };

      // If there's a new avatar, use the base64 from preview (already converted)
      if (avatarPreview) {
        updateData.avatar_url = avatarPreview; // avatarPreview já é base64
      }
      
      await onUpdateProfile(updateData);
      setIsEditing(false);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, avatarPreview, onUpdateProfile, documentType]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setDocumentType(user.documentType || 'cpf');
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone ? phoneMask(user.phone) : '',
      documentNumber: user.documentNumber
        ? (user.documentType === 'cnpj' ? cnpjMask(user.documentNumber) : cpfMask(user.documentNumber))
        : '',
    });
    setAvatarPreview(null);
    // Reset checkbox value
    if (newsletterCheckboxRef.current) {
      newsletterCheckboxRef.current.checked = user.newsletter_opt_in || false;
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Compacto com Avatar */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
             <div className="relative group">
              <div className="w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-bold overflow-hidden shadow-md ring-2 ring-gray-100">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : user.avatar_url || user.avatar ? (
                  <img 
                    src={user.avatar_url || user.avatar} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-white text-gray-900 border border-gray-200 rounded-full p-1.5 hover:bg-gray-50 transition-colors shadow-sm"
                  aria-label="Alterar foto"
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {isEditing ? 'Editar Perfil' : 'Meu Perfil'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {user.email}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name Field */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    !isEditing ? 'bg-gray-50 text-gray-500' : 'bg-white text-gray-900'
                  }`}
                  required
                />
              </div>

              {/* Phone Field */}
              <div>
                <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="(11) 99999-9999"
                  title={isEditing && formData.phone && !isValidPhone(formData.phone) ? "Telefone inválido" : ""}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    !isEditing
                      ? 'bg-gray-50 text-gray-500 border-gray-200'
                      : formData.phone && !isValidPhone(formData.phone)
                        ? 'border-red-300 focus:ring-red-500'
                        : formData.phone && isValidPhone(formData.phone)
                          ? 'border-green-300 focus:ring-green-500'
                          : 'border-gray-200 focus:ring-gray-900'
                  }`}
                />
              </div>

              {/* Document Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Documento
                </label>
                
                <div className="flex gap-2">
                   {isEditing && (
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleDocumentTypeChange('cpf')}
                        className={`px-2 py-1 rounded-md font-medium text-[10px] transition-all ${
                          documentType === 'cpf' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        CPF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentTypeChange('cnpj')}
                        className={`px-2 py-1 rounded-md font-medium text-[10px] transition-all ${
                          documentType === 'cnpj' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        CNPJ
                      </button>
                    </div>
                  )}
                  
                  <input
                    type="text"
                    id="documentNumber"
                    name="documentNumber"
                    value={formData.documentNumber}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                    title={isEditing && formData.documentNumber && (documentType === 'cpf' ? !isValidCpf(formData.documentNumber) : !isValidCnpj(formData.documentNumber)) ? (documentType === 'cpf' ? "CPF inválido" : "CNPJ inválido") : ""}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all flex-1 ${
                      !isEditing
                        ? 'bg-gray-50 text-gray-500 border-gray-200'
                        : formData.documentNumber && (
                            documentType === 'cpf'
                              ? !isValidCpf(formData.documentNumber)
                              : !isValidCnpj(formData.documentNumber)
                          )
                          ? 'border-red-300 focus:ring-red-500'
                          : formData.documentNumber && (
                              documentType === 'cpf'
                                ? isValidCpf(formData.documentNumber)
                                : isValidCnpj(formData.documentNumber)
                            )
                            ? 'border-green-300 focus:ring-green-500'
                            : 'border-gray-200 focus:ring-gray-900'
                    }`}
                  />
                </div>
              </div>

              {/* Created At Field (Read-only) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Membro desde
                </label>
                <input
                  type="text"
                  value={formatDate(user.createdAt)}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {/* Newsletter Checkbox */}
            <div className="flex items-center space-x-3 pt-2 bg-gray-50 p-3 rounded-xl">
              <input
                type="checkbox"
                id="newsletter"
                name="newsletter"
                ref={newsletterCheckboxRef}
                defaultChecked={user.newsletter_opt_in || false}
                disabled={!isEditing}
                className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded cursor-pointer disabled:opacity-50"
              />
              <label htmlFor="newsletter" className={`text-sm font-medium ${!isEditing ? 'text-gray-500' : 'text-gray-700'} cursor-pointer`}>
                Receber novidades e atualizações por e-mail
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 mt-4">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium text-sm"
                >
                  Editar Perfil
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 font-medium text-sm"
                  >
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
