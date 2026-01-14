import React from 'react';
import { Filter, DollarSign, Home, Clock, SortAsc, SortDesc, X } from 'lucide-react';

export interface MapFilters {
    priceRange: 'all' | '20k' | '50k' | '100k' | '200k' | '500k';
    propertyType: 'all' | 'CASA' | 'APARTAMENTO' | 'TERRENO' | 'LOCAL_COMERCIAL';
    status: 'all' | 'available' | 'sold' | 'reserved';
    age: 'all' | 'new' | 'recent' | 'old';  // new = <2 weeks, recent = 2-4 weeks, old = >4 weeks
    sortBy: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
}

interface MapFiltersBarProps {
    filters: MapFilters;
    onFiltersChange: (filters: MapFilters) => void;
    totalCount: number;
    filteredCount: number;
}

const MapFiltersBar: React.FC<MapFiltersBarProps> = ({ filters, onFiltersChange, totalCount, filteredCount }) => {
    const priceRanges = [
        { value: 'all', label: 'Todos los precios' },
        { value: '20k', label: '< $20,000' },
        { value: '50k', label: '< $50,000' },
        { value: '100k', label: '< $100,000' },
        { value: '200k', label: '< $200,000' },
        { value: '500k', label: '< $500,000' },
    ];

    const propertyTypes = [
        { value: 'all', label: 'Todos los tipos' },
        { value: 'CASA', label: '🏠 Casas' },
        { value: 'APARTAMENTO', label: '🏢 Apartamentos' },
        { value: 'TERRENO', label: '🏞️ Terrenos' },
        { value: 'LOCAL_COMERCIAL', label: '🏪 Locales' },
    ];

    const statusOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'available', label: '🟢 En Venta' },
        { value: 'sold', label: '🔴 Vendidos' },
        { value: 'reserved', label: '🟡 Reservados' },
    ];

    const ageOptions = [
        { value: 'all', label: 'Cualquier fecha' },
        { value: 'new', label: '✨ Nuevas (<2 sem)' },
        { value: 'recent', label: '📅 Recientes (2-4 sem)' },
        { value: 'old', label: '📆 Antiguas (>4 sem)' },
    ];

    const sortOptions = [
        { value: 'newest', label: '📅 Más nuevas' },
        { value: 'oldest', label: '📆 Más antiguas' },
        { value: 'price_asc', label: '💰 Menor precio' },
        { value: 'price_desc', label: '💎 Mayor precio' },
    ];

    const hasActiveFilters = filters.priceRange !== 'all' ||
        filters.propertyType !== 'all' ||
        filters.status !== 'all' ||
        filters.age !== 'all';

    const resetFilters = () => {
        onFiltersChange({
            priceRange: 'all',
            propertyType: 'all',
            status: 'all',
            age: 'all',
            sortBy: 'newest'
        });
    };

    return (
        <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 flex flex-wrap gap-2 items-center">
                {/* Filter Icon and Count */}
                <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
                    <Filter size={18} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                        {filteredCount}/{totalCount}
                    </span>
                </div>

                {/* Price Filter */}
                <select
                    value={filters.priceRange}
                    onChange={(e) => onFiltersChange({ ...filters, priceRange: e.target.value as MapFilters['priceRange'] })}
                    className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                    {priceRanges.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Type Filter */}
                <select
                    value={filters.propertyType}
                    onChange={(e) => onFiltersChange({ ...filters, propertyType: e.target.value as MapFilters['propertyType'] })}
                    className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                    {propertyTypes.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as MapFilters['status'] })}
                    className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                    {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Age Filter */}
                <select
                    value={filters.age}
                    onChange={(e) => onFiltersChange({ ...filters, age: e.target.value as MapFilters['age'] })}
                    className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                    {ageOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    value={filters.sortBy}
                    onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as MapFilters['sortBy'] })}
                    className="text-sm bg-emerald-100 text-emerald-700 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer font-medium"
                >
                    {sortOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Reset Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={resetFilters}
                        className="text-sm bg-red-100 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-200 transition-colors flex items-center gap-1"
                    >
                        <X size={14} />
                        Limpiar
                    </button>
                )}
            </div>
        </div>
    );
};

export default MapFiltersBar;
