import React, { useState, useCallback } from 'react';
import { cn } from '@/shared/utils/cn';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { Check } from 'lucide-react';

interface ImageUploadProps {
  value: string | null;
  onChange: (base64: string, name: string) => void;
  className?: string;
  aspectRatio?: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, className, aspectRatio = 16 / 9 }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const image = new Image();
      image.src = imageSrc;
      await new Promise((resolve) => {
        image.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const croppedImageBase64 = canvas.toDataURL('image/jpeg', 0.9);
      onChange(croppedImageBase64, fileName);
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Erro ao processar imagem. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels, onChange, fileName]);

  const handleCancelCrop = useCallback(() => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleRemove = () => {
    onChange('', '');
  };

  return (
    <>
      {/* Crop Modal */}
      {imageSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex flex-col">
          {/* Header */}
          <div className="bg-white px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Ajustar Imagem (16:9)</h3>
            <button
              onClick={handleCancelCrop}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cancelar"
              type="button"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Cropper area */}
          <div className="flex-1 relative">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="bg-white px-6 py-4">
            <div className="max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleCancelCrop}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={createCroppedImage}
                disabled={isProcessing}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                type="button"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className={cn("w-full", className)}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Imagem de Capa (16:9)
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
              <p className="text-xs text-gray-400">PNG ou JPG • Proporção 16:9 • Max: 10MB</p>
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
              <ImageIcon className="w-3 h-3" /> Capa 16:9
            </div>
          </div>
        )}
      </div>
    </>
  );
};
