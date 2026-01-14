import React, { useState, useEffect, useMemo } from 'react';
import { Home, Settings, MapPin, List, ChevronDown, Zap, Search, Upload } from 'lucide-react';
import PropertyMap from './components/PropertyMap';
import PropertyCard from './components/PropertyCard';
import SearchPanel from './components/SearchPanel';
import AutoDiscovery from './components/AutoDiscovery';
import FileImportPanel from './components/FileImportPanel';
import PropertyApprovalPanel from './components/PropertyApprovalPanel';
import MapFiltersBar, { MapFilters } from './components/MapFiltersBar';
import { Property, PropertyFilters } from './types';
import { validateAndFixCoordinates, isValidMargaritaCoordinate } from './services/coordinateService';

const App: React.FC = () => {
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [mode, setMode] = useState<'manual' | 'auto' | 'import'>('manual');

    // Load properties from LocalStorage on initial mount
    // Clean and fix properties with invalid coordinates using coordinateService
    const [properties, setProperties] = useState<Property[]>(() => {
        const saved = localStorage.getItem('margarita_properties');
        if (!saved) return [];

        try {
            const parsed = JSON.parse(saved) as Property[];

            // Validate and fix coordinates using centralized service
            const fixedProperties = parsed.map(p => {
                // Check if current coordinates are valid
                const currentCoords = p.coordinates;
                if (currentCoords && isValidMargaritaCoordinate(currentCoords.lat, currentCoords.lng)) {
                    return p; // Already valid
                }

                // Try to fix using zone name
                const fixedCoords = validateAndFixCoordinates(currentCoords, p.zone);
                if (fixedCoords) {
                    console.log(`[App] Corrigiendo coordenadas de "${p.title}" usando zona "${p.zone}"`);
                    return {
                        ...p,
                        coordinates: fixedCoords,
                        latitude: fixedCoords.lat,
                        longitude: fixedCoords.lng
                    };
                }

                return p; // Return as-is, will be filtered out
            }).filter(p => {
                // Final validation - remove any properties without valid coordinates
                const coords = p.coordinates;
                const isValid = coords && isValidMargaritaCoordinate(coords.lat, coords.lng);

                if (!isValid) {
                    console.warn(`[App] Eliminando propiedad con coordenadas inválidas: ${p.title} (zona: ${p.zone})`);
                }
                return isValid;
            });

            return fixedProperties;
        } catch (e) {
            console.error('Error loading properties from localStorage:', e);
            return [];
        }
    });

    // Save properties to LocalStorage whenever they change
    useEffect(() => {
        localStorage.setItem('margarita_properties', JSON.stringify(properties));
    }, [properties]);

    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

    // Map Filters
    const [mapFilters, setMapFilters] = useState<MapFilters>({
        priceRange: 'all',
        propertyType: 'all',
        status: 'all',
        age: 'all',
        sortBy: 'newest'
    });

    // Filter and sort properties based on mapFilters
    const filteredProperties = useMemo(() => {
        const now = new Date();
        const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
        const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

        // Only show approved properties on the map (not pending)
        let result = properties.filter(p => p.approvalStatus !== 'pending').filter(p => {
            // Price filter
            if (mapFilters.priceRange !== 'all' && p.price) {
                const maxPrice = {
                    '20k': 20000,
                    '50k': 50000,
                    '100k': 100000,
                    '200k': 200000,
                    '500k': 500000
                }[mapFilters.priceRange];
                if (maxPrice && p.price > maxPrice) return false;
            }

            // Type filter
            if (mapFilters.propertyType !== 'all') {
                if (p.type !== mapFilters.propertyType) return false;
            }

            // Status filter
            if (mapFilters.status !== 'all') {
                const propStatus = p.status || 'available';
                if (propStatus !== mapFilters.status) return false;
            }

            // Age filter
            if (mapFilters.age !== 'all' && p.postedAt) {
                const postedDate = new Date(p.postedAt);
                const ageMs = now.getTime() - postedDate.getTime();

                if (mapFilters.age === 'new' && ageMs > TWO_WEEKS_MS) return false;
                if (mapFilters.age === 'recent' && (ageMs < TWO_WEEKS_MS || ageMs > FOUR_WEEKS_MS)) return false;
                if (mapFilters.age === 'old' && ageMs < FOUR_WEEKS_MS) return false;
            }

            return true;
        });

        // Sort
        result.sort((a, b) => {
            switch (mapFilters.sortBy) {
                case 'newest':
                    return new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
                case 'oldest':
                    return new Date(a.postedAt || 0).getTime() - new Date(b.postedAt || 0).getTime();
                case 'price_asc':
                    return (a.price || 0) - (b.price || 0);
                case 'price_desc':
                    return (b.price || 0) - (a.price || 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [properties, mapFilters]);

    const handlePropertiesFound = (newProperties: Property[]) => {
        setProperties(prev => {
            // Filter duplicates by ID
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNew = newProperties.filter(p => !existingIds.has(p.id));

            if (uniqueNew.length === 0) return prev;

            const updated = [...prev, ...uniqueNew];
            localStorage.setItem('margarita_properties', JSON.stringify(updated));
            return updated;
        });
    };

    // Approval workflow handlers
    const pendingProperties = useMemo(() =>
        properties.filter(p => p.approvalStatus === 'pending'),
        [properties]
    );

    const approvedProperties = useMemo(() =>
        properties.filter(p => p.approvalStatus === 'approved' || !p.approvalStatus),
        [properties]
    );

    const handleApprove = (property: Property) => {
        setProperties(prev => {
            const updated = prev.map(p =>
                p.id === property.id ? { ...p, approvalStatus: 'approved' as const } : p
            );
            localStorage.setItem('margarita_properties', JSON.stringify(updated));
            return updated;
        });
    };

    const handleReject = (property: Property) => {
        setProperties(prev => {
            const updated = prev.filter(p => p.id !== property.id);
            localStorage.setItem('margarita_properties', JSON.stringify(updated));
            return updated;
        });
    };

    const handleApproveAll = () => {
        setProperties(prev => {
            const updated = prev.map(p =>
                p.approvalStatus === 'pending' ? { ...p, approvalStatus: 'approved' as const } : p
            );
            localStorage.setItem('margarita_properties', JSON.stringify(updated));
            return updated;
        });
    };

    const handleRejectAll = () => {
        setProperties(prev => {
            const updated = prev.filter(p => p.approvalStatus !== 'pending');
            localStorage.setItem('margarita_properties', JSON.stringify(updated));
            return updated;
        });
    };

    const [filters, setFilters] = useState<PropertyFilters>({
        type: 'all',
        minPrice: undefined,
        maxPrice: undefined,
        minRooms: undefined,
        maxRooms: undefined,
        minBaths: undefined,
        maxBaths: undefined,
        location: '',
        keywords: '',
    });

    if (showWelcome) {
        return (
            <div className="h-screen w-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
                <div className="max-w-2xl bg-white rounded-3xl shadow-2xl p-8 sm:p-12">
                    {/* Logo */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Home className="text-white" size={32} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900">
                            Margarita<span className="text-emerald-600">Properties</span>
                        </h1>
                    </div>

                    {/* Welcome Message */}
                    <div className="text-center mb-8">
                        <p className="text-xl text-gray-700 mb-4">
                            Plataforma inteligente de descubrimiento de propiedades en <strong>Margarita, Venezuela</strong>
                        </p>
                        <p className="text-gray-600">
                            Encuentra casas y apartamentos en venta usando <strong>Instagram + IA</strong> con análisis de zonas y estimación de precios automática.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="grid sm:grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="text-2xl mb-2">🔍</div>
                            <h3 className="font-semibold text-gray-900 mb-1">Scraping Automático</h3>
                            <p className="text-sm text-gray-600">Descubre propiedades desde Instagram usando hashtags de Margarita</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="text-2xl mb-2">🤖</div>
                            <h3 className="font-semibold text-gray-900 mb-1">Extracción con IA</h3>
                            <p className="text-sm text-gray-600">Gemini AI extrae precio, ubicación y características automáticamente</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                            <div className="text-2xl mb-2">🗺️</div>
                            <h3 className="font-semibold text-gray-900 mb-1">Mapa Interactivo</h3>
                            <p className="text-sm text-gray-600">Visualiza propiedades en un mapa con filtros por zona y precio</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <div className="text-2xl mb-2">📊</div>
                            <h3 className="font-semibold text-gray-900 mb-1">Análisis de Zonas</h3>
                            <p className="text-sm text-gray-600">Recomendaciones de mejores zonas con precio promedio por m²</p>
                        </div>
                    </div>

                    {/* Configuration Required */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
                        <div className="flex items-start gap-3">
                            <Settings className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Configuración Requerida</h4>
                                <p className="text-sm text-gray-700 mb-3">
                                    Para usar la plataforma necesitas configurar tus API keys:
                                </p>
                                <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
                                    <li><strong>Apify API Token</strong> - Para scraping de Instagram (tier gratuito disponible)</li>
                                    <li><strong>Gemini API Key</strong> - Para procesamiento con IA (tier gratuito disponible)</li>
                                </ol>
                                <p className="text-xs text-gray-600 mt-3">
                                    Crea un archivo <code className="bg-white px-2 py-0.5 rounded text-emerald-600">.env</code> con tus keys antes de continuar.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={() => setShowWelcome(false)}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:scale-[1.02]"
                    >
                        Comenzar Exploración
                    </button>

                    {/* Footer */}
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Desarrollado con ❤️ para descubrir las mejores oportunidades en Margarita
                    </p>
                </div>
            </div>
        );
    }

    // Main App - Property Discovery Platform
    return (
        <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                            <Home className="text-white" size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Margarita<span className="text-emerald-600">Properties</span>
                            </h1>
                            <p className="text-xs text-gray-600">
                                {properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'} encontradas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="lg:hidden px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <List size={18} />
                        <span className="text-sm">Propiedades</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Search and Properties List */}
                <aside
                    className={`
                        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                        w-full lg:w-96 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300
                        absolute lg:relative h-full z-20 lg:z-0
                    `}
                >
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Mode Toggle */}
                        <div className="flex bg-gray-100 rounded-xl p-1">
                            <button
                                onClick={() => setMode('manual')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'manual'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Search size={16} />
                                Manual
                            </button>
                            <button
                                onClick={() => setMode('auto')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'auto'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Zap size={16} />
                                Auto
                            </button>
                            <button
                                onClick={() => setMode('import')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'import'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title="Importar archivos"
                            >
                                <Upload size={16} />
                                Importar
                            </button>
                        </div>

                        {/* Search Panel or Auto Discovery based on mode */}
                        {mode === 'manual' ? (
                            <SearchPanel
                                onPropertiesFound={handlePropertiesFound}
                                existingProperties={properties}
                            />
                        ) : mode === 'auto' ? (
                            <AutoDiscovery
                                onPropertiesApproved={setProperties}
                                approvedProperties={properties}
                            />
                        ) : (
                            <FileImportPanel
                                onPropertiesImported={handlePropertiesFound}
                                existingProperties={properties}
                            />
                        )}

                        {/* Approval Panel for pending properties */}
                        <PropertyApprovalPanel
                            pendingProperties={pendingProperties}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onApproveAll={handleApproveAll}
                            onRejectAll={handleRejectAll}
                        />

                        {/* Properties List - Only Approved */}
                        {approvedProperties.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <MapPin className="text-emerald-600" size={20} />
                                    Propiedades Aprobadas ({approvedProperties.length})
                                </h3>
                                <div className="space-y-4">
                                    {approvedProperties.map((property, index) => (
                                        <PropertyCard
                                            key={index}
                                            property={property}
                                            onClick={() => {
                                                setSelectedProperty(property);
                                                setShowSidebar(false);
                                            }}
                                            isSelected={selectedProperty === property}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {properties.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MapPin className="text-gray-400" size={32} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    No hay propiedades aún
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Usa el panel de búsqueda para descubrir propiedades en Instagram
                                </p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Map View - Full Height */}
                <main className="flex-1 relative">
                    {/* Map Filters Bar */}
                    <MapFiltersBar
                        filters={mapFilters}
                        onFiltersChange={setMapFilters}
                        totalCount={properties.length}
                        filteredCount={filteredProperties.length}
                    />

                    <PropertyMap
                        properties={filteredProperties}
                        onPropertySelect={(property) => {
                            setSelectedProperty(property);
                            setShowSidebar(true);
                        }}
                        selectedProperty={selectedProperty}
                    />
                </main>
            </div>
        </div>
    );
};

export default App;
