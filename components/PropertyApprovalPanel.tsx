import React, { useState } from 'react';
import { Check, X, CheckCircle2, XCircle, Eye, MapPin, DollarSign, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Property } from '../types';

interface PropertyApprovalPanelProps {
    pendingProperties: Property[];
    onApprove: (property: Property) => void;
    onReject: (property: Property) => void;
    onApproveAll: () => void;
    onRejectAll: () => void;
}

const PropertyApprovalPanel: React.FC<PropertyApprovalPanelProps> = ({
    pendingProperties,
    onApprove,
    onReject,
    onApproveAll,
    onRejectAll
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (pendingProperties.length === 0) {
        return null;
    }

    const formatPrice = (price?: number) => {
        if (!price) return 'Sin precio';
        return `$${price.toLocaleString()}`;
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <Eye className="text-white" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Revisión Pendiente</h2>
                        <p className="text-sm text-gray-600">{pendingProperties.length} propiedades por aprobar</p>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={onApproveAll}
                    className="flex-1 py-2 px-4 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2"
                >
                    <CheckCircle2 size={18} />
                    Aprobar Todas
                </button>
                <button
                    onClick={onRejectAll}
                    className="flex-1 py-2 px-4 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                    <XCircle size={18} />
                    Rechazar Todas
                </button>
            </div>

            {/* Property List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingProperties.map((property) => (
                    <div
                        key={property.id}
                        className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
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
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=Sin+Foto';
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
                                <h3 className="font-semibold text-gray-900 truncate text-sm">
                                    {property.title || 'Propiedad sin título'}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                    <MapPin size={12} />
                                    <span className="truncate">{property.zone}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 mt-1">
                                    <DollarSign size={12} />
                                    <span>{formatPrice(property.price)}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onApprove(property)}
                                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                                    title="Aprobar"
                                >
                                    <Check size={18} />
                                </button>
                                <button
                                    onClick={() => onReject(property)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
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
                                            {property.bedrooms} hab
                                        </span>
                                    )}
                                    {property.bathrooms && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                            {property.bathrooms} baños
                                        </span>
                                    )}
                                    {property.areaM2 && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                            {property.areaM2} m²
                                        </span>
                                    )}
                                </div>
                                {property.instagramUrl && (
                                    <a
                                        href={property.instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-pink-600 hover:underline mt-2 inline-block"
                                    >
                                        Ver en Instagram →
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PropertyApprovalPanel;
