import React from 'react';
import { Property } from '../types';
import { Home, MapPin, Bed, Bath, Maximize, DollarSign, Star } from 'lucide-react';

interface PropertyCardProps {
    property: Property;
    onClick: () => void;
    isSelected?: boolean;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onClick, isSelected = false }) => {
    const formatPrice = (price: number | undefined) => {
        if (!price) return 'Precio no disponible';
        return `$${price.toLocaleString('es-VE')}`;
    };

    const getPropertyTypeEmoji = (type: string) => {
        switch (type.toLowerCase()) {
            case 'casa':
                return '🏠';
            case 'apartamento':
                return '🏢';
            case 'casa de playa':
                return '🏖️';
            case 'penthouse':
                return '🌆';
            default:
                return '🏘️';
        }
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer
                transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl
                ${isSelected ? 'ring-4 ring-emerald-500' : 'hover:ring-2 hover:ring-emerald-300'}
            `}
        >
            {/* Image Section */}
            {property.mediaUrls && property.mediaUrls.length > 0 && (
                <div className="relative h-48 bg-gradient-to-br from-emerald-100 to-blue-100 overflow-hidden">
                    <img
                        src={property.mediaUrls[0]}
                        alt={`${property.type} en ${property.zone || 'Margarita'}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%2310b981" width="400" height="300"/%3E%3Ctext fill="white" font-size="20" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                        }}
                    />
                    {/* Quality Score Badge */}
                    {property.qualityScore && (
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                            <Star className="text-yellow-500" size={16} fill="currentColor" />
                            <span className="text-sm font-bold text-gray-900">{property.qualityScore}/10</span>
                        </div>
                    )}
                    {/* Property Type Badge */}
                    <div className="absolute top-3 left-3 bg-emerald-600/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                        <span className="text-white text-sm font-semibold">
                            {getPropertyTypeEmoji(property.type)} {property.type}
                        </span>
                    </div>
                    {/* SOLD / RESERVED Badge */}
                    {property.status === 'sold' && (
                        <div className="absolute bottom-3 left-3 bg-red-600/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
                            <span className="text-white text-sm font-bold uppercase">⛔ VENDIDO</span>
                        </div>
                    )}
                    {property.status === 'reserved' && (
                        <div className="absolute bottom-3 left-3 bg-yellow-500/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
                            <span className="text-white text-sm font-bold uppercase">🔒 RESERVADO</span>
                        </div>
                    )}
                    {/* NEW Badge - Properties less than 2 weeks old */}
                    {property.status !== 'sold' && property.status !== 'reserved' && property.postedAt &&
                        (new Date().getTime() - new Date(property.postedAt).getTime()) < 14 * 24 * 60 * 60 * 1000 && (
                            <div className="absolute bottom-3 right-3 bg-blue-600/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg animate-pulse">
                                <span className="text-white text-sm font-bold uppercase">✨ NUEVA</span>
                            </div>
                        )}
                </div>
            )}

            {/* Content Section */}
            <div className="p-5">
                {/* Price */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="text-emerald-600" size={20} />
                        <span className="text-2xl font-bold text-gray-900">
                            {formatPrice(property.price)}
                        </span>
                    </div>
                    {property.price && property.area && (
                        <p className="text-sm text-gray-600">
                            ${Math.round(property.price / property.area)}/m²
                        </p>
                    )}
                </div>

                {/* Location */}
                {(property.zone || property.address) && (
                    <div className="flex items-start gap-2 mb-4">
                        <MapPin className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                        <div className="text-sm">
                            {property.zone && (
                                <p className="font-semibold text-gray-900">{property.zone}</p>
                            )}
                            {property.address && (
                                <p className="text-gray-600 line-clamp-1">{property.address}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Features Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {property.bedrooms && property.bedrooms > 0 && (
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                            <Bed className="text-gray-600" size={16} />
                            <span className="text-sm font-medium text-gray-900">{property.bedrooms}</span>
                        </div>
                    )}
                    {property.bathrooms && property.bathrooms > 0 && (
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                            <Bath className="text-gray-600" size={16} />
                            <span className="text-sm font-medium text-gray-900">{property.bathrooms}</span>
                        </div>
                    )}
                    {property.area && property.area > 0 && (
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                            <Maximize className="text-gray-600" size={16} />
                            <span className="text-sm font-medium text-gray-900">{property.area}m²</span>
                        </div>
                    )}
                </div>

                {/* Features Tags */}
                {property.features && property.features.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {property.features.slice(0, 3).map((feature, index) => (
                            <span
                                key={index}
                                className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200"
                            >
                                {feature}
                            </span>
                        ))}
                        {property.features.length > 3 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                +{property.features.length - 3} más
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyCard;
