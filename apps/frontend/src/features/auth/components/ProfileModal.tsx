import React, { useState, useCallback, useRef } from 'react';
import { X, Camera, User as UserIcon, Mail, Calendar, Phone, FileText } from 'lucide-react';
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newsletterCheckboxRef = useRef<HTMLInputElement>(null);

  // Update checkbox when modal opens or user data changes
  React.useEffect(() => {
    if (newsletterCheckboxRef.current && isOpen) {
      newsletterCheckboxRef.current.checked = user.newsletter_opt_in || false;
    }
  }, [isOpen, user.newsletter_opt_in]);

  // Close modal on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
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
        setAvatarFile(file);
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
      setAvatarFile(null);
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
    setAvatarFile(null);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Editar Perfil' : 'Meu Perfil'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-medium overflow-hidden">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Preview do avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : user.avatar_url || user.avatar ? (
                  <img 
                    src={user.avatar_url || user.avatar} 
                    alt="Avatar do usuário" 
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
                  className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-2 hover:bg-primary-700 transition-colors shadow-lg"
                  aria-label="Alterar foto de perfil"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                <UserIcon className="w-4 h-4 inline mr-2" />
                Nome
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  !isEditing ? 'bg-gray-50 text-gray-600' : ''
                }`}
                required
              />
            </div>

            {/* Email Field (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                readOnly
              />
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-2" />
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  !isEditing
                    ? 'bg-gray-50 text-gray-600 border-gray-300'
                    : formData.phone && !isValidPhone(formData.phone)
                      ? 'border-red-300 focus:ring-red-500'
                      : formData.phone && isValidPhone(formData.phone)
                        ? 'border-green-300 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-primary-500'
                }`}
              />
              {isEditing && formData.phone && !isValidPhone(formData.phone) && (
                <p className="mt-1 text-sm text-red-600">
                  Telefone deve ter 11 dígitos no formato (XX) XXXXX-XXXX
                </p>
              )}
            </div>

            {/* Document Type Toggle and Document Number Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Documento
              </label>

              {/* Toggle CPF/CNPJ */}
              {isEditing && (
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => handleDocumentTypeChange('cpf')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                      documentType === 'cpf'
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    CPF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDocumentTypeChange('cnpj')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                      documentType === 'cnpj'
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    CNPJ
                  </button>
                </div>
              )}

              {/* Document Number Input */}
              <input
                type="text"
                id="documentNumber"
                name="documentNumber"
                value={formData.documentNumber}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  !isEditing
                    ? 'bg-gray-50 text-gray-600 border-gray-300'
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
                        : 'border-gray-300 focus:ring-primary-500'
                }`}
              />
              {isEditing && formData.documentNumber && (
                documentType === 'cpf'
                  ? !isValidCpf(formData.documentNumber)
                  : !isValidCnpj(formData.documentNumber)
              ) && (
                <p className="mt-1 text-sm text-red-600">
                  {documentType === 'cpf' ? 'CPF inválido' : 'CNPJ inválido'}
                </p>
              )}
              {isEditing && formData.documentNumber && (
                documentType === 'cpf'
                  ? isValidCpf(formData.documentNumber)
                  : isValidCnpj(formData.documentNumber)
              ) && (
                <p className="mt-1 text-sm text-green-600 flex items-center">
                  <span className="mr-1">✓</span>
                  {documentType === 'cpf' ? 'CPF válido' : 'CNPJ válido'}
                </p>
              )}
            </div>

            {/* Created At Field (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-2" />
                Membro desde
              </label>
              <input
                type="text"
                value={formatDate(user.createdAt)}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>

            {/* Newsletter Checkbox */}
            <div className="flex items-start space-x-3 pt-2">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  ref={newsletterCheckboxRef}
                  defaultChecked={user.newsletter_opt_in || false}
                  disabled={!isEditing}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="newsletter" className={`font-medium ${!isEditing ? 'text-gray-500' : 'text-gray-700'} cursor-pointer`}>
                  Desejo receber a newsletter
                </label>
                <p className="text-gray-500 text-xs mt-1">
                  Receba novidades, atualizações e artigos jurídicos exclusivos diretamente no seu e-mail.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Editar Perfil
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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