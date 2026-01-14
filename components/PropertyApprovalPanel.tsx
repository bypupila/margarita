import React, { useState, useMemo } from 'react';
import { Check, X, CheckCircle2, XCircle, Eye, MapPin, DollarSign, Home, ChevronDown, ChevronUp, Calendar, Bot, FileSpreadsheet, Filter } from 'lucide-react';
import { Property } from '../types';

interface PropertyApprovalPanelProps {
    pendingProperties: Property[];
    onApprove: (property: Property) => void;
    onReject: (property: Property) => void;
    onApproveAll: () => void;
    onRejectAll: () => void;
}

type SourceFilter = 'all' | 'automation' | 'csv' | 'manual';

const PropertyApprovalPanel: React.FC<PropertyApprovalPanelProps> = ({
    pendingProperties,
    onApprove,
    onReject,
    onApproveAll,
    onRejectAll
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

    // Group properties by source
    const stats = useMemo(() => {
        const fromAutomation = pendingProperties.filter(p => (p as any).source === 'apify').length;
        const fromCSV = pendingProperties.filter(p => (p as any).source === 'csv').length;
        const fromManual = pendingProperties.filter(p => !(p as any).source || (p as any).source === 'manual').length;
        return { fromAutomation, fromCSV, fromManual, total: pendingProperties.length };
    }, [pendingProperties]);

    // Filter properties by source
    const filteredProperties = useMemo(() => {
        if (sourceFilter === 'all') return pendingProperties;
        if (sourceFilter === 'automation') return pendingProperties.filter(p => (p as any).source === 'apify');
        if (sourceFilter === 'csv') return pendingProperties.filter(p => (p as any).source === 'csv');
        return pendingProperties.filter(p => !(p as any).source || (p as any).source === 'manual');
    }, [pendingProperties, sourceFilter]);

    if (pendingProperties.length === 0) {
        return null;
    }

    const formatPrice = (price?: number) => {
        if (!price) return 'Sin precio';
        return `$${price.toLocaleString()}`;
    };

    const getSourceBadge = (property: Property) => {
        const source = (property as any).source;
        if (source === 'apify') {
            return (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    <Bot size={10} />
                    Auto
                </span>
            );
        }
        if (source === 'csv') {
            return (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    <FileSpreadsheet size={10} />
                    CSV
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Manual
            </span>
        );
    };

    const getScrapedDate = (property: Property) => {
        const scrapedAt = (property as any).scrapedAt;
        if (!scrapedAt) return null;
        const date = new Date(scrapedAt);
        return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-xl p-6 mb-6 border border-amber-200">
            {/* Header with Daily Automation Badge */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Bot className="text-white" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">Propiedades Pendientes</h2>
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-medium">
                                <Calendar size={12} />
                                Scrape Diario
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{stats.total} propiedades esperando tu aprobación</p>
                    </div>
                </div>
            </div>

            {/* Source Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                    onClick={() => setSourceFilter(sourceFilter === 'automation' ? 'all' : 'automation')}
                    className={`p-2 rounded-lg text-center transition-all ${sourceFilter === 'automation'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-white/70 text-gray-700 hover:bg-purple-100'}`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Bot size={14} />
                        <span className="font-bold">{stats.fromAutomation}</span>
                    </div>
                    <span className="text-xs">Automatización</span>
                </button>
                <button
                    onClick={() => setSourceFilter(sourceFilter === 'csv' ? 'all' : 'csv')}
                    className={`p-2 rounded-lg text-center transition-all ${sourceFilter === 'csv'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-white/70 text-gray-700 hover:bg-blue-100'}`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <FileSpreadsheet size={14} />
                        <span className="font-bold">{stats.fromCSV}</span>
                    </div>
                    <span className="text-xs">CSV</span>
                </button>
                <button
                    onClick={() => setSourceFilter(sourceFilter === 'manual' ? 'all' : 'manual')}
                    className={`p-2 rounded-lg text-center transition-all ${sourceFilter === 'manual'
                        ? 'bg-gray-600 text-white shadow-md'
                        : 'bg-white/70 text-gray-700 hover:bg-gray-200'}`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <span className="font-bold">{stats.fromManual}</span>
                    </div>
                    <span className="text-xs">Manual</span>
                </button>
            </div>

            {/* Active Filter Indicator */}
            {sourceFilter !== 'all' && (
                <div className="flex items-center justify-between mb-3 p-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                        <Filter size={14} />
                        Mostrando: <strong>{sourceFilter === 'automation' ? 'Automatización' : sourceFilter === 'csv' ? 'CSV' : 'Manual'}</strong>
                        ({filteredProperties.length} de {stats.total})
                    </span>
                    <button
                        onClick={() => setSourceFilter('all')}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        Limpiar filtro
                    </button>
                </div>
            )}

            {/* Bulk Actions */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={onApproveAll}
                    className="flex-1 py-2.5 px-4 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                    <CheckCircle2 size={18} />
                    Aprobar Todas ({filteredProperties.length})
                </button>
                <button
                    onClick={onRejectAll}
                    className="flex-1 py-2.5 px-4 bg-white text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                    <XCircle size={18} />
                    Rechazar Todas
                </button>
            </div>

            {/* Property List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredProperties.map((property) => (
                    <div
                        key={property.id}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-amber-300 hover:shadow-md transition-all"
                    >
                        {/* Collapsed View */}
                        <div className="flex items-center gap-3 p-3">
                            {/* Thumbnail */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                {property.thumbnailUrl ? (
                                    <img
                                        src={property.thumbnailUrl}
                                        alt={property.title}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=📷';
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Home className="text-gray-400" size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {getSourceBadge(property)}
                                    {getScrapedDate(property) && (
                                        <span className="text-xs text-gray-400">{getScrapedDate(property)}</span>
                                    )}
                                </div>
                                <h3 className="font-semibold text-gray-900 truncate text-sm">
                                    {property.title || 'Propiedad sin título'}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} className="text-amber-500" />
                                        {property.zone}
                                    </span>
                                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                                        <DollarSign size={12} />
                                        {formatPrice(property.price)}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => onApprove(property)}
                                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                                    title="Aprobar"
                                >
                                    <Check size={18} />
                                </button>
                                <button
                                    onClick={() => onReject(property)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                    title="Rechazar"
                                >
                                    <X size={18} />
                                </button>
                                <button
                                    onClick={() => setExpandedId(expandedId === property.id ? null : property.id)}
                                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                    title="Ver más"
                                >
                                    {expandedId === property.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Expanded View */}
                        {expandedId === property.id && (
                            <div className="px-3 pb-3 border-t border-gray-100 pt-3 bg-gray-50">
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {property.description?.slice(0, 300)}
                                    {(property.description?.length || 0) > 300 && '...'}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {property.bedrooms && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                            🛏️ {property.bedrooms} hab
                                        </span>
                                    )}
                                    {property.bathrooms && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                            🚿 {property.bathrooms} baños
                                        </span>
                                    )}
                                    {property.areaM2 && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                            📐 {property.areaM2} m²
                                        </span>
                                    )}
                                </div>
                                {property.instagramUrl && (
                                    <a
                                        href={property.instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-pink-600 hover:underline mt-2 inline-flex items-center gap-1"
                                    >
                                        📸 Ver en Instagram →
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Empty state when filtering */}
            {filteredProperties.length === 0 && pendingProperties.length > 0 && (
                <div className="text-center py-8 text-gray-500">
                    <Filter size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No hay propiedades de este tipo</p>
                    <button
                        onClick={() => setSourceFilter('all')}
                        className="text-amber-600 hover:underline text-sm mt-1"
                    >
                        Ver todas
                    </button>
                </div>
            )}
        </div>
    );
};

export default PropertyApprovalPanel;
