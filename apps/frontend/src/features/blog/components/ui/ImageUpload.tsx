import React from 'react';
import { cn } from '@/shared/utils/cn';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value: string | null;
  onChange: (base64: string, name: string) => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, className }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      // Handle error via prop or toast context if needed, but keeping simple for UI component
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange('', '');
  };

  return (
    <div className={cn("w-full", className)}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Imagem de Capa
      </label>
      
      {!value ? (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-primary-500 transition-all group">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-gray-400 group-hover:text-primary-600" />
            </div>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold text-primary-600">Clique para upload</span> ou arraste e solte
            </p>
            <p className="text-xs text-gray-400">PNG, JPG ou GIF (max. 4MB)</p>
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      ) : (
        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 group shadow-sm">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={handleRemove}
              className="p-2 bg-white/90 rounded-full text-red-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
            <ImageIcon className="w-3 h-3" /> Capa definida
          </div>
        </div>
      )}
    </div>
  );
};
