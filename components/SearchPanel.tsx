import React, { useState } from 'react';
import { Search, Instagram, Loader, AlertCircle } from 'lucide-react';
import { runPropertyDiscovery } from '../services/discoveryService';
import { Property } from '../types';
import ManualPropertyForm from './ManualPropertyForm';


interface SearchPanelProps {
    onPropertiesFound: (properties: Property[]) => void;
    existingProperties?: Property[];
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onPropertiesFound, existingProperties = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<string>('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setError('Por favor ingresa hashtags o palabras clave');
            return;
        }

        setIsSearching(true);
        setError(null);
        setSearchStatus('Buscando propiedades en Instagram...');

        try {
            // Extract hashtags from query and clean them (remove # symbol)
            const hashtags = searchQuery
                .split(/[\s,]+/)
                .filter(tag => tag.trim())
                .map(tag => tag.startsWith('#') ? tag.slice(1) : tag);

            setSearchStatus(`Procesando ${hashtags.length} hashtag(s)...`);

            const result = await runPropertyDiscovery(hashtags);
            const properties = result.properties;

            if (properties.length === 0) {
                setError('No se encontraron propiedades. Intenta con otros hashtags.');
                setSearchStatus('');
            } else {
                setSearchStatus(`✓ ${properties.length} propiedades encontradas`);
                onPropertiesFound(properties);
            }
        } catch (err: any) {
            console.error('Search error:', err);
            const errorMessage = err.message || 'Error al buscar propiedades';
            if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                setError('Cuota de API excedida. Intenta de nuevo en unos minutos.');
            } else if (errorMessage.includes('API')) {
                setError('Error de API. Verifica tus API keys en el archivo .env');
            } else {
                setError(errorMessage);
            }
            setSearchStatus('');
        } finally {
            setIsSearching(false);
        }
    };

    const popularHashtags = [
        '#VentaMargarita',
        '#CasaMargarita',
        '#ApartamentoMargarita',
        '#PropiedadesMargarita',
        '#InmueblesPorlamar',
        '#VentaPampatar'
    ];

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Instagram className="text-white" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Buscar Propiedades</h2>
                    <p className="text-sm text-gray-600">Descubre desde Instagram</p>
                </div>
            </div>

            {/* Search Input */}
            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Ej: #VentaMargarita #CasaPorlamar"
                        disabled={isSearching}
                        className="w-full px-5 py-3.5 pr-12 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
            </div>

            {/* Search Button */}
            <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-2"
            >
                {isSearching ? (
                    <>
                        <Loader className="animate-spin" size={20} />
                        <span>Buscando...</span>
                    </>
                ) : (
                    <>
                        <Search size={20} />
                        <span>Buscar Propiedades</span>
                    </>
                )}
            </button>

            {/* Status Message */}
            {searchStatus && !error && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">{searchStatus}</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Popular Hashtags */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Hashtags populares:</p>
                <div className="flex flex-wrap gap-2">
                    {popularHashtags.map((tag, index) => (
                        <button
                            key={index}
                            onClick={() => setSearchQuery(tag)}
                            disabled={isSearching}
                            className="text-xs bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-gray-700 leading-relaxed">
                    <strong>💡 Consejo:</strong> Combina múltiples hashtags para mejores resultados.
                    Ejemplo: <code className="bg-white px-1.5 py-0.5 rounded text-emerald-600">#VentaMargarita #Porlamar</code>
                </p>
            </div>

            {/* Manual Entry Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">O agrega manualmente</span>
                </div>
            </div>

            {/* Manual Form */}
            <ManualPropertyForm
                onPropertyAdded={(prop) => onPropertiesFound([prop])}
                existingProperties={existingProperties}
            />
        </div>
    );
};

export default SearchPanel;
