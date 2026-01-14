import React, { useState } from 'react';
import { Plus, Loader2, Instagram, MapPin, DollarSign, Home, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Property, PropertyType } from '../types';
import { enrichProperty } from '../services/geminiService';
import { validateAndFixCoordinates } from '../services/coordinateService';

interface ManualPropertyFormProps {
    onPropertyAdded: (property: Property) => void;
    existingProperties: Property[];
}

const ManualPropertyForm: React.FC<ManualPropertyFormProps> = ({ onPropertyAdded, existingProperties }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form fields
    const [instagramUrl, setInstagramUrl] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [ownerHandle, setOwnerHandle] = useState('');

    const resetForm = () => {
        setInstagramUrl('');
        setDescription('');
        setImageUrl('');
        setOwnerHandle('');
        setError(null);
        setSuccess(false);
    };

    const extractShortCode = (url: string): string | null => {
        // Extract shortcode from various Instagram URL formats
        const patterns = [
            /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
            /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
            /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Validate Instagram URL
            const shortCode = extractShortCode(instagramUrl);
            if (!shortCode && instagramUrl) {
                throw new Error('URL de Instagram inválida');
            }

            // Check for duplicates
            if (shortCode) {
                const exists = existingProperties.some(p =>
                    p.instagramId === shortCode || p.instagramUrl?.includes(shortCode)
                );
                if (exists) {
                    throw new Error('Esta propiedad ya existe en tu lista');
                }
            }

            // Validate description
            if (!description.trim()) {
                throw new Error('Ingresa una descripción de la propiedad');
            }

            // Create partial property
            const partialProperty: Partial<Property> = {
                id: `manual-${Date.now()}`,
                instagramId: shortCode || `manual-${Date.now()}`,
                instagramUrl: instagramUrl || undefined,
                description: description,
                mediaUrls: imageUrl ? [imageUrl] : [],
                thumbnailUrl: imageUrl || '',
                ownerHandle: ownerHandle || '@manual',
                postedAt: new Date().toISOString(),
                hasPhotos: !!imageUrl,
                isActive: true,
                updatedAt: new Date().toISOString(),
            };

            // Enrich with Gemini
            console.log('[ManualForm] Enviando a Gemini para enriquecimiento...');
            const enrichedProperty = await enrichProperty(partialProperty);

            if (!enrichedProperty) {
                throw new Error('No se pudo procesar la descripción. Asegúrate de incluir: tipo de propiedad, zona y precio en USD.');
            }

            // Validate coordinates one more time
            if (!enrichedProperty.coordinates ||
                !enrichedProperty.coordinates.lat ||
                !enrichedProperty.coordinates.lng) {
                const fixedCoords = validateAndFixCoordinates(undefined, enrichedProperty.zone);
                if (fixedCoords) {
                    enrichedProperty.coordinates = fixedCoords;
                    enrichedProperty.latitude = fixedCoords.lat;
                    enrichedProperty.longitude = fixedCoords.lng;
                }
            }

            console.log('[ManualForm] Propiedad enriquecida:', enrichedProperty);

            // Add to properties
            onPropertyAdded(enrichedProperty);
            setSuccess(true);

            // Reset form after success
            setTimeout(() => {
                resetForm();
                setIsOpen(false);
            }, 2000);

        } catch (err) {
            console.error('[ManualForm] Error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
                <Plus size={20} />
                Agregar Propiedad Manualmente
            </button>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Plus className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Agregar Propiedad</h3>
                        <p className="text-xs text-gray-500">Sin usar Apify - Gemini extraerá los datos</p>
                    </div>
                </div>
                <button
                    onClick={() => { setIsOpen(false); resetForm(); }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Instagram URL (Optional) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Instagram size={14} className="inline mr-1" />
                        URL de Instagram (opcional)
                    </label>
                    <input
                        type="url"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="https://instagram.com/p/ABC123..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">Si no tienes URL, puedes dejarlo vacío</p>
                </div>

                {/* Description (Required) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Home size={14} className="inline mr-1" />
                        Descripción del Inmueble *
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ejemplo: Casa en venta en Pampatar, 3 habitaciones, 2 baños, 150m2, piscina, precio $85.000 USD. Contacto @vendedor"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Gemini extraerá: tipo, zona, precio, habitaciones, baños, etc.
                    </p>
                </div>

                {/* Image URL (Optional) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL de Imagen (opcional)
                    </label>
                    <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {/* Owner Handle (Optional) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vendedor/Inmobiliaria (opcional)
                    </label>
                    <input
                        type="text"
                        value={ownerHandle}
                        onChange={(e) => setOwnerHandle(e.target.value)}
                        placeholder="@vendedor o nombre"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-500 mt-0.5" />
                        <span className="text-sm text-red-700">{error}</span>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-sm text-green-700">¡Propiedad agregada exitosamente!</span>
                    </div>
                )}

                {/* Gemini Badge */}
                <div className="bg-white/50 rounded-lg p-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-lg">✨</span>
                    <span>Gemini AI procesará la descripción y extraerá todos los datos automáticamente</span>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || !description.trim()}
                    className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${loading || !description.trim()
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                        }`}
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Procesando con Gemini...
                        </>
                    ) : (
                        <>
                            <Plus size={20} />
                            Agregar Propiedad
                        </>
                    )}
                </button>
            </form>

            {/* Tips */}
            <div className="mt-4 p-3 bg-white/70 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-2">💡 Tips para mejores resultados:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Incluye la <strong>zona</strong> (Pampatar, Costa Azul, El Yaque, etc.)</li>
                    <li>• Especifica el <strong>precio en USD</strong></li>
                    <li>• Menciona el <strong>tipo</strong> (casa, apartamento, terreno)</li>
                    <li>• Agrega <strong>detalles</strong> (habitaciones, baños, m², piscina, etc.)</li>
                </ul>
            </div>
        </div>
    );
};

export default ManualPropertyForm;
