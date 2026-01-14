import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, CheckCircle, XCircle, Eye, Clock, Zap, Hash, Settings, Plus, X } from 'lucide-react';
import { runPropertyDiscovery } from '../services/discoveryService';
import { Property } from '../types';
import { MARGARITA_HASHTAGS } from '../services/apifyService';
import ApifyUsageIndicator from './ApifyUsageIndicator';

interface AutoDiscoveryProps {
    onPropertiesApproved: (properties: Property[]) => void;
    approvedProperties: Property[];
}

interface PendingProperty extends Property {
    queueStatus: 'pending' | 'approved' | 'rejected';  // Renombrado para evitar conflicto con Property.status
    discoveredAt: string;
}

const AutoDiscovery: React.FC<AutoDiscoveryProps> = ({ onPropertiesApproved, approvedProperties }) => {
    const [isRunning, setIsRunning] = useState(false);
    // Load pending queue from localStorage
    const [pendingQueue, setPendingQueue] = useState<PendingProperty[]>(() => {
        const saved = localStorage.getItem('margarita_discovery_queue');
        return saved ? JSON.parse(saved) : [];
    });

    // Persist pending queue to localStorage
    useEffect(() => {
        localStorage.setItem('margarita_discovery_queue', JSON.stringify(pendingQueue));
    }, [pendingQueue]);

    const [currentHashtagIndex, setCurrentHashtagIndex] = useState(0);
    const [hashtags, setHashtags] = useState<string[]>(MARGARITA_HASHTAGS);
    const [showHashtagEditor, setShowHashtagEditor] = useState(false);
    const [newHashtag, setNewHashtag] = useState('');
    const [stats, setStats] = useState({
        discovered: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        skipped: 0,  // Nuevo contador para omitidas por duplicado
        updated: 0   // Nuevo contador para actualizadas a vendido
    });
    const [status, setStatus] = useState('Detenido');
    const [lastSearch, setLastSearch] = useState<string | null>(null);

    // Auto-discovery loop
    useEffect(() => {
        if (!isRunning || hashtags.length === 0) return;

        const discoverNext = async () => {
            const hashtag = hashtags[currentHashtagIndex % hashtags.length];
            setStatus(`Buscando en #${hashtag}...`);
            setLastSearch(hashtag);

            try {
                const result = await runPropertyDiscovery([hashtag]);

                if (result.properties.length > 0) {
                    let skippedCount = 0;
                    let updatedCount = 0;
                    let dateUpdatedCount = 0;

                    const newProperties: PendingProperty[] = [];

                    for (const prop of result.properties) {
                        // === DEDUPLICACIÓN POR INSTAGRAM URL ===
                        const existingApprovedByUrl = approvedProperties.find(p => p.instagramUrl === prop.instagramUrl);

                        if (existingApprovedByUrl) {
                            // === ACTUALIZAR ESTADO VENDIDO ===
                            if (prop.status === 'sold' && existingApprovedByUrl.status !== 'sold') {
                                console.log(`[AutoDiscovery] Actualizando a VENDIDO: ${prop.title}`);
                                const updatedApproved = approvedProperties.map(p =>
                                    p.instagramUrl === prop.instagramUrl
                                        ? { ...p, status: 'sold' as const }
                                        : p
                                );
                                onPropertiesApproved(updatedApproved);
                                updatedCount++;
                            }
                            skippedCount++;
                            continue;
                        }

                        if (pendingQueue.some(p => p.instagramUrl === prop.instagramUrl)) {
                            skippedCount++;
                            continue;
                        }

                        // === DETECTAR DUPLICADOS POR CARACTERÍSTICAS SIMILARES ===
                        // Buscar propiedades con misma zona, tipo y precio similar (±10%)
                        const findSimilarProperty = (properties: Property[]) => {
                            return properties.find(existing => {
                                if (!existing.zone || !prop.zone) return false;
                                if (existing.zone.toLowerCase() !== prop.zone.toLowerCase()) return false;
                                if (existing.type !== prop.type) return false;

                                // Precio similar (±10%)
                                if (existing.price && prop.price) {
                                    const priceDiff = Math.abs(existing.price - prop.price) / existing.price;
                                    if (priceDiff > 0.1) return false;
                                }

                                // Mismas habitaciones y baños si existen
                                if (existing.bedrooms && prop.bedrooms && existing.bedrooms !== prop.bedrooms) return false;
                                if (existing.bathrooms && prop.bathrooms && existing.bathrooms !== prop.bathrooms) return false;

                                return true;
                            });
                        };

                        const similarApproved = findSimilarProperty(approvedProperties);

                        if (similarApproved) {
                            // === ACTUALIZAR FECHA DE PUBLICACIÓN A LA MÁS ANTIGUA ===
                            const existingDate = similarApproved.postedAt ? new Date(similarApproved.postedAt) : new Date();
                            const newDate = prop.postedAt ? new Date(prop.postedAt) : new Date();

                            if (newDate < existingDate) {
                                // La nueva propiedad es más antigua - actualizar fecha
                                console.log(`[AutoDiscovery] Actualizando fecha de publicación a más antigua: ${similarApproved.title} (${newDate.toLocaleDateString()} < ${existingDate.toLocaleDateString()})`);
                                const updatedApproved = approvedProperties.map(p =>
                                    p.id === similarApproved.id
                                        ? { ...p, postedAt: prop.postedAt }
                                        : p
                                );
                                onPropertiesApproved(updatedApproved);
                                dateUpdatedCount++;
                            }

                            // También actualizar estado vendido si aplica
                            if (prop.status === 'sold' && similarApproved.status !== 'sold') {
                                const updatedApproved = approvedProperties.map(p =>
                                    p.id === similarApproved.id
                                        ? { ...p, status: 'sold' as const }
                                        : p
                                );
                                onPropertiesApproved(updatedApproved);
                                updatedCount++;
                            }

                            skippedCount++;
                            console.log(`[AutoDiscovery] Propiedad similar encontrada, omitiendo: ${prop.title}`);
                            continue;
                        }

                        // Nueva propiedad
                        newProperties.push({
                            ...prop,
                            queueStatus: 'pending',
                            discoveredAt: new Date().toISOString()
                        });
                    }

                    if (newProperties.length > 0) {
                        setPendingQueue(prev => [...prev, ...newProperties]);
                    }

                    setStats(prev => ({
                        ...prev,
                        discovered: prev.discovered + newProperties.length,
                        pending: prev.pending + newProperties.length,
                        skipped: prev.skipped + skippedCount,
                        updated: prev.updated + updatedCount + dateUpdatedCount
                    }));

                    if (skippedCount > 0) {
                        console.log(`[AutoDiscovery] Omitidas ${skippedCount} propiedades duplicadas`);
                    }
                    if (dateUpdatedCount > 0) {
                        console.log(`[AutoDiscovery] Actualizadas ${dateUpdatedCount} fechas de publicación a más antiguas`);
                    }
                }

                // Move to next hashtag
                setCurrentHashtagIndex(prev => (prev + 1) % hashtags.length);
                setStatus(`Esperando próxima búsqueda...`);

            } catch (error) {
                console.error('Auto-discovery error:', error);
                setStatus('Error - Reintentando...');
            }
        };

        // Run immediately and then every 60 seconds
        discoverNext();
        const interval = setInterval(discoverNext, 60000);

        return () => clearInterval(interval);
    }, [isRunning, currentHashtagIndex, pendingQueue, approvedProperties, hashtags, onPropertiesApproved]);

    // Update pending count
    useEffect(() => {
        const pending = pendingQueue.filter(p => p.queueStatus === 'pending').length;
        setStats(prev => ({ ...prev, pending }));
    }, [pendingQueue]);

    const handleApprove = useCallback((property: PendingProperty) => {
        setPendingQueue(prev =>
            prev.map(p => p.id === property.id ? { ...p, queueStatus: 'approved' as const } : p)
        );
        setStats(prev => ({
            ...prev,
            approved: prev.approved + 1,
            pending: Math.max(0, prev.pending - 1)
        }));

        // Add to approved properties
        const { queueStatus, discoveredAt, ...cleanProperty } = property;
        onPropertiesApproved([...approvedProperties, cleanProperty as Property]);
    }, [approvedProperties, onPropertiesApproved]);

    const handleReject = useCallback((property: PendingProperty) => {
        setPendingQueue(prev =>
            prev.map(p => p.id === property.id ? { ...p, queueStatus: 'rejected' as const } : p)
        );
        setStats(prev => ({
            ...prev,
            rejected: prev.rejected + 1,
            pending: Math.max(0, prev.pending - 1)
        }));
    }, []);

    const handleApproveAll = useCallback(() => {
        const pending = pendingQueue.filter(p => p.queueStatus === 'pending');
        setPendingQueue(prev =>
            prev.map(p => p.queueStatus === 'pending' ? { ...p, queueStatus: 'approved' as const } : p)
        );
        setStats(prev => ({
            ...prev,
            approved: prev.approved + pending.length,
            pending: 0
        }));

        const cleanProperties = pending.map(({ queueStatus, discoveredAt, ...p }) => p as Property);
        onPropertiesApproved([...approvedProperties, ...cleanProperties]);
    }, [pendingQueue, approvedProperties, onPropertiesApproved]);

    const addHashtag = () => {
        if (newHashtag.trim() && !hashtags.includes(newHashtag.trim())) {
            setHashtags(prev => [...prev, newHashtag.trim().replace(/^#/, '')]);
            setNewHashtag('');
        }
    };

    const removeHashtag = (tag: string) => {
        setHashtags(prev => prev.filter(h => h !== tag));
    };

    const pendingProperties = pendingQueue.filter(p => p.queueStatus === 'pending');

    return (
        <div className="bg-white rounded-2xl shadow-xl p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRunning ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gray-200'}`}>
                        <Zap className={isRunning ? 'text-white' : 'text-gray-500'} size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Auto-Descubrimiento</h2>
                        <p className="text-xs text-gray-500">{status}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowHashtagEditor(!showHashtagEditor)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Configurar hashtags"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => setIsRunning(!isRunning)}
                        className={`p-3 rounded-xl transition-all ${isRunning
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            }`}
                    >
                        {isRunning ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                </div>
            </div>

            {/* Apify API Usage Indicator */}
            <ApifyUsageIndicator className="mb-4" />

            {/* Hashtag Editor */}
            {showHashtagEditor && (
                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Hash size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Hashtags de búsqueda ({hashtags.length})</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                        {hashtags.map((tag, index) => (
                            <span
                                key={index}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${currentHashtagIndex % hashtags.length === index && isRunning
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                #{tag}
                                <button
                                    onClick={() => removeHashtag(tag)}
                                    className="hover:text-red-600"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newHashtag}
                            onChange={(e) => setNewHashtag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                            placeholder="Agregar hashtag..."
                            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:border-emerald-400 outline-none"
                        />
                        <button
                            onClick={addHashtag}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Current Hashtag Indicator */}
            {isRunning && (
                <div className="mb-4 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-700 flex items-center gap-2">
                        <Hash size={14} />
                        <span>Buscando: <strong>#{hashtags[currentHashtagIndex % hashtags.length]}</strong></span>
                        <span className="text-emerald-500">({currentHashtagIndex + 1}/{hashtags.length})</span>
                    </p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{stats.discovered}</p>
                    <p className="text-xs text-blue-500">Encontradas</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
                    <p className="text-xs text-yellow-500">Pendientes</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                    <p className="text-xs text-green-500">Aprobadas</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                    <p className="text-xs text-red-500">Rechazadas</p>
                </div>
            </div>

            {/* Pending Queue */}
            {pendingProperties.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Clock size={14} />
                            Cola de Moderación ({pendingProperties.length})
                        </h3>
                        <button
                            onClick={handleApproveAll}
                            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full hover:bg-emerald-200 transition-colors"
                        >
                            Aprobar Todas
                        </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pendingProperties.slice(0, 5).map(property => (
                            <div
                                key={property.id}
                                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                            >
                                {property.thumbnailUrl && (
                                    <img
                                        src={property.thumbnailUrl}
                                        alt=""
                                        className="w-12 h-12 object-cover rounded-lg"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {property.title || 'Propiedad sin título'}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{property.zone}</span>
                                        {property.price && (
                                            <span className="text-emerald-600 font-semibold">
                                                ${property.price.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleApprove(property)}
                                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                                        title="Aprobar"
                                    >
                                        <CheckCircle size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleReject(property)}
                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                        title="Rechazar"
                                    >
                                        <XCircle size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {pendingProperties.length > 5 && (
                            <p className="text-xs text-center text-gray-400 py-2">
                                +{pendingProperties.length - 5} más en cola
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {pendingProperties.length === 0 && !isRunning && (
                <div className="text-center py-6 text-gray-400">
                    <Eye size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Presiona play para iniciar el descubrimiento automático</p>
                </div>
            )}

            {pendingProperties.length === 0 && isRunning && (
                <div className="text-center py-6 text-gray-400">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm">Buscando propiedades...</p>
                    {lastSearch && <p className="text-xs mt-1">Último: #{lastSearch}</p>}
                </div>
            )}

            {/* Info */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                <p className="text-xs text-gray-600">
                    <strong>💡 Modo Automático:</strong> Busca en {hashtags.length} hashtags diferentes.
                    Solo las propiedades que apruebes aparecerán en el mapa.
                </p>
            </div>
        </div>
    );
};

export default AutoDiscovery;
