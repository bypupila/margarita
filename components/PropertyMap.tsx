import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { Map, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Property, PropertyType } from '../types';
import { AlertTriangle } from 'lucide-react';

interface PropertyMapProps {
    properties: Property[];
    onPropertySelect: (property: Property) => void;
    selectedProperty: Property | null;
}

// Points of Interest - EXACT Google Maps Coordinates (Verified)
const POINTS_OF_INTEREST = [
    // Ciudades Principales
    { name: 'Porlamar (Centro)', lat: 10.9580, lng: -63.8520, type: 'city', icon: '🏙️' },
    { name: 'Pampatar', lat: 10.9970, lng: -63.7975, type: 'city', icon: '⚓' },
    { name: 'Juan Griego', lat: 11.0850, lng: -63.9690, type: 'city', icon: '🌅' },
    { name: 'La Asunción', lat: 11.0333, lng: -63.8628, type: 'city', icon: '🏛️' },

    // Playas - GMaps Exact
    { name: 'Playa El Agua', lat: 11.1455, lng: -63.8630, type: 'beach', icon: '🏖️' },
    { name: 'Playa Parguito', lat: 11.1350, lng: -63.8510, type: 'beach', icon: '🏖️' },
    { name: 'El Yaque', lat: 10.9023, lng: -63.9616, type: 'beach', icon: '🏖️' },
    { name: 'Playa Caribe', lat: 11.1110, lng: -63.9580, type: 'beach', icon: '🏖️' },
    { name: 'Guacuco', lat: 11.0502, lng: -63.8133, type: 'beach', icon: '🏖️' },
    { name: 'Manzanillo', lat: 11.1575, lng: -63.8920, type: 'beach', icon: '🏖️' },

    // Centros Comerciales & Sitios Clave - GMaps Exact
    { name: 'Sambil Margarita', lat: 10.9962, lng: -63.8140, type: 'shopping', icon: '🛒' },
    { name: 'La Caracola', lat: 10.9580, lng: -63.8491, type: 'shopping', icon: '🏃' },
    { name: 'Rattan Plaza', lat: 10.9926, lng: -63.8234, type: 'shopping', icon: '🛒' },
    { name: 'Parque Costazul', lat: 10.9880, lng: -63.8540, type: 'shopping', icon: '🛒' },

    // Zonas Residenciales - GMaps Exact
    { name: 'Costa Azul', lat: 10.9772, lng: -63.8229, type: 'residential', icon: '🏘️' },
    { name: 'Jorge Coll', lat: 10.9991, lng: -63.8228, type: 'residential', icon: '🏘️' },
    { name: 'Los Robles', lat: 10.9880, lng: -63.8310, type: 'residential', icon: '🏘️' },

    // Atracciones
    { name: 'Castillo San Carlos', lat: 10.9965, lng: -63.7970, type: 'landmark', icon: '🏰' },
];

const PropertyMap: React.FC<PropertyMapProps> = ({ properties, onPropertySelect, selectedProperty }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<Map | null>(null);
    const propertyMarkers = useRef<Marker[]>([]);
    const poiMarkers = useRef<Marker[]>([]);
    const popupRef = useRef<Popup | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [showPOI, setShowPOI] = useState(true);

    const formatPrice = (price?: number) => {
        if (!price) return 'Precio a consultar';
        return `$${price.toLocaleString()} USD`;
    };

    const getTypeLabel = (type?: PropertyType) => {
        switch (type) {
            case PropertyType.CASA: return 'Casa';
            case PropertyType.APARTAMENTO: return 'Apartamento';
            case PropertyType.TERRENO: return 'Terreno';
            case PropertyType.LOCAL_COMERCIAL: return 'Local Comercial';
            default: return 'Propiedad';
        }
    };

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current) return;

        try {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                center: [-63.8480, 11.0069],
                zoom: 11,
                attributionControl: false
            });

            map.current.on('load', () => {
                setIsMapReady(true);
                setTimeout(() => map.current?.resize(), 100);

                // Add pulse animation style for new properties
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5); }
                        50% { transform: scale(1.1); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.8); }
                    }
                `;
                document.head.appendChild(style);
            });

            map.current.on('error', (e) => {
                console.error('Map error:', e);
                setMapError('Error al cargar el mapa');
            });

            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
            map.current.addControl(
                new maplibregl.AttributionControl({ compact: true }),
                'bottom-right'
            );

            const handleResize = () => map.current?.resize();
            window.addEventListener('resize', handleResize);
            setTimeout(() => map.current?.resize(), 500);

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        } catch (error) {
            console.error('Map initialization error:', error);
            setMapError('No se pudo inicializar el mapa');
        }

        return () => {
            try {
                popupRef.current?.remove();
                map.current?.remove();
            } catch (e) { }
        };
    }, []);

    useEffect(() => {
        if (map.current && isMapReady) {
            setTimeout(() => map.current?.resize(), 100);
        }
    }, [isMapReady]);

    // Add Points of Interest markers
    useEffect(() => {
        if (!map.current || !isMapReady) return;

        // Clear existing POI markers
        poiMarkers.current.forEach(m => { try { m.remove(); } catch (e) { } });
        poiMarkers.current = [];

        if (!showPOI) return;

        POINTS_OF_INTEREST.forEach(poi => {
            const el = document.createElement('div');
            el.style.cssText = `
                width: 32px;
                height: 32px;
                background: white;
                border: 2px solid #6366f1;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            `;
            el.innerHTML = poi.icon;
            el.title = poi.name;

            el.addEventListener('mouseenter', () => {
                el.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            });

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([poi.lng, poi.lat])
                .addTo(map.current!);

            // Popup for POI
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                popupRef.current?.remove();

                const content = document.createElement('div');
                content.style.cssText = 'padding: 12px; min-width: 150px; font-family: system-ui;';
                content.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 24px;">${poi.icon}</span>
                        <strong style="font-size: 14px; color: #1f2937;">${poi.name}</strong>
                    </div>
                    <p style="font-size: 12px; color: #6b7280; margin: 0;">
                        ${poi.type === 'beach' ? 'Playa' :
                        poi.type === 'shopping' ? 'Centro Comercial' :
                            poi.type === 'city' ? 'Ciudad' :
                                poi.type === 'residential' ? 'Zona Residencial' :
                                    'Punto de Interés'}
                    </p>
                `;

                popupRef.current = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    offset: [0, -10]
                })
                    .setLngLat([poi.lng, poi.lat])
                    .setDOMContent(content)
                    .addTo(map.current!);
            });

            poiMarkers.current.push(marker);
        });
    }, [isMapReady, showPOI]);

    // Update property markers
    useEffect(() => {
        if (!map.current || !isMapReady) return;

        try {
            propertyMarkers.current.forEach(marker => {
                try { marker.remove(); } catch (e) { }
            });
            propertyMarkers.current = [];
            popupRef.current?.remove();

            properties.forEach(property => {
                // Validate coordinates exist and are numbers
                if (!property.coordinates ||
                    typeof property.coordinates.lng !== 'number' ||
                    typeof property.coordinates.lat !== 'number' ||
                    isNaN(property.coordinates.lng) ||
                    isNaN(property.coordinates.lat)) {
                    console.warn(`[PropertyMap] Propiedad sin coordenadas válidas:`, property.title);
                    return;
                }

                // Validate coordinates are within Margarita Island bounds
                // Margarita: lat ~10.85-11.17, lng ~-64.05 to -63.75
                const lat = property.coordinates.lat;
                const lng = property.coordinates.lng;
                const isInMargarita = lat >= 10.8 && lat <= 11.2 && lng >= -64.1 && lng <= -63.7;

                if (!isInMargarita) {
                    console.warn(`[PropertyMap] Coordenadas fuera de Margarita (${lat}, ${lng}):`, property.title);
                    return;
                }

                const el = document.createElement('div');

                // Calculate property age
                const now = new Date();
                const postedDate = property.postedAt ? new Date(property.postedAt) : now;
                const ageMs = now.getTime() - postedDate.getTime();
                const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
                const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

                const isNew = ageMs < TWO_WEEKS_MS;
                const isRecent = ageMs >= TWO_WEEKS_MS && ageMs < FOUR_WEEKS_MS;
                const isOld = ageMs >= FOUR_WEEKS_MS;

                // Color based on property status and age
                const propertyStatus = property.status || 'available';
                let bgGradient = 'linear-gradient(135deg, #059669 0%, #0d9488 100%)'; // Default green
                let shadowColor = 'rgba(5, 150, 105, 0.5)';
                let badgeBg = '#059669';
                let badgeText = 'EN VENTA';
                let borderColor = 'white';

                // Status takes priority for sold/reserved
                if (propertyStatus === 'sold') {
                    bgGradient = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    shadowColor = 'rgba(220, 38, 38, 0.5)';
                    badgeBg = '#dc2626';
                    badgeText = 'VENDIDO';
                } else if (propertyStatus === 'reserved') {
                    bgGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    shadowColor = 'rgba(245, 158, 11, 0.5)';
                    badgeBg = '#f59e0b';
                    badgeText = 'RESERVADO';
                } else {
                    // Age-based colors for available properties
                    if (isNew) {
                        // NEW - Bright blue with pulsing border
                        bgGradient = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                        shadowColor = 'rgba(59, 130, 246, 0.6)';
                        badgeBg = '#3b82f6';
                        badgeText = '✨ NUEVA';
                        borderColor = '#fbbf24'; // Yellow border for NEW
                    } else if (isRecent) {
                        // RECENT - Green (default)
                        bgGradient = 'linear-gradient(135deg, #059669 0%, #0d9488 100%)';
                        shadowColor = 'rgba(5, 150, 105, 0.5)';
                    } else if (isOld) {
                        // OLD - Gray
                        bgGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                        shadowColor = 'rgba(107, 114, 128, 0.5)';
                    }
                }

                el.style.width = '36px';
                el.style.height = '36px';
                el.style.background = bgGradient;
                el.style.border = '3px solid ' + borderColor;
                el.style.borderRadius = '50%';
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                el.style.cursor = 'pointer';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                if (propertyStatus === 'sold') {
                    el.style.opacity = '0.7';
                }
                // Add pulse animation for new properties
                if (isNew && propertyStatus === 'available') {
                    el.style.animation = 'pulse 2s infinite';
                }

                // Icon based on status
                if (propertyStatus === 'sold') {
                    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                } else {
                    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
                }

                el.addEventListener('mouseenter', () => {
                    el.style.boxShadow = '0 6px 20px ' + shadowColor;
                });
                el.addEventListener('mouseleave', () => {
                    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                });

                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([property.coordinates.lng, property.coordinates.lat])
                    .addTo(map.current!);

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    popupRef.current?.remove();

                    const popupContent = document.createElement('div');
                    popupContent.style.cssText = 'min-width: 280px; font-family: system-ui, sans-serif;';

                    const imageHtml = property.thumbnailUrl
                        ? '<img src="' + property.thumbnailUrl + '" alt="' + (property.title || 'Propiedad') + '" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" />'
                        : '<div style="width: 100%; height: 80px; background: ' + bgGradient + '; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>';

                    popupContent.innerHTML = '<div style="position: relative;">' + imageHtml + '<div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">' + getTypeLabel(property.type) + '</div><div style="position: absolute; top: 8px; right: 8px; background: ' + badgeBg + '; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">' + badgeText + '</div></div>' +
                        '<div style="padding: 12px;">' +
                        '<h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #1f2937; line-height: 1.3;">' + (property.title || getTypeLabel(property.type) + ' en ' + property.zone) + '</h3>' +
                        '<p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: #059669;">' + formatPrice(property.price) + '</p>' +
                        '<p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">📍 ' + property.zone + (property.neighborhood && property.neighborhood !== property.zone ? ', ' + property.neighborhood : '') + '</p>' +
                        '<div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px;">' +
                        (property.bedrooms ? '<span style="font-size: 12px; color: #4b5563;">🛏️ ' + property.bedrooms + ' hab.</span>' : '') +
                        (property.bathrooms ? '<span style="font-size: 12px; color: #4b5563;">🚿 ' + property.bathrooms + ' baños</span>' : '') +
                        ((property.areaM2 || property.area) ? '<span style="font-size: 12px; color: #4b5563;">📐 ' + (property.areaM2 || property.area) + ' m²</span>' : '') +
                        '</div>' +
                        (property.features && property.features.length > 0 ? '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;">' + property.features.slice(0, 4).map(f => '<span style="font-size: 10px; background: #f0fdf4; color: #059669; padding: 3px 8px; border-radius: 12px;">' + f + '</span>').join('') + '</div>' : '') +
                        '<a href="' + property.instagramUrl + '" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">Ver en Instagram</a>' +
                        '</div>';

                    popupRef.current = new maplibregl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                        maxWidth: '320px',
                        offset: [0, -10]
                    })
                        .setLngLat([property.coordinates!.lng, property.coordinates!.lat])
                        .setDOMContent(popupContent)
                        .addTo(map.current!);

                    onPropertySelect(property);
                });

                propertyMarkers.current.push(marker);
            });

            map.current?.resize();
        } catch (error) {
            console.error('Error updating markers:', error);
        }
    }, [properties, onPropertySelect, isMapReady]);

    // Fly to selected property and show popup
    useEffect(() => {
        if (map.current && isMapReady && selectedProperty?.coordinates &&
            typeof selectedProperty.coordinates.lng === 'number' &&
            typeof selectedProperty.coordinates.lat === 'number') {
            try {
                // Close any existing popup
                popupRef.current?.remove();

                // Fly to the property
                map.current.flyTo({
                    center: [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
                    zoom: 14,
                    duration: 1500
                });

                // Show popup after flight animation completes
                setTimeout(() => {
                    if (!map.current || !selectedProperty.coordinates) return;

                    // Determine colors based on status and age
                    const now = new Date();
                    const postedDate = selectedProperty.postedAt ? new Date(selectedProperty.postedAt) : now;
                    const ageMs = now.getTime() - postedDate.getTime();
                    const isNew = ageMs < 14 * 24 * 60 * 60 * 1000;

                    const propertyStatus = selectedProperty.status || 'available';
                    let badgeBg = '#059669';
                    let badgeText = 'EN VENTA';
                    let bgGradient = 'linear-gradient(135deg, #059669 0%, #0d9488 100%)';

                    if (propertyStatus === 'sold') {
                        badgeBg = '#dc2626';
                        badgeText = 'VENDIDO';
                        bgGradient = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    } else if (propertyStatus === 'reserved') {
                        badgeBg = '#f59e0b';
                        badgeText = 'RESERVADO';
                        bgGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    } else if (isNew) {
                        badgeBg = '#3b82f6';
                        badgeText = '✨ NUEVA';
                        bgGradient = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                    }

                    const popupContent = document.createElement('div');
                    popupContent.style.cssText = 'min-width: 280px; font-family: system-ui, sans-serif;';

                    const imageHtml = selectedProperty.thumbnailUrl
                        ? '<img src="' + selectedProperty.thumbnailUrl + '" alt="' + (selectedProperty.title || 'Propiedad') + '" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" />'
                        : '<div style="width: 100%; height: 80px; background: ' + bgGradient + '; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>';

                    popupContent.innerHTML = '<div style="position: relative;">' + imageHtml + '<div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">' + getTypeLabel(selectedProperty.type) + '</div><div style="position: absolute; top: 8px; right: 8px; background: ' + badgeBg + '; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">' + badgeText + '</div></div>' +
                        '<div style="padding: 12px;">' +
                        '<h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #1f2937; line-height: 1.3;">' + (selectedProperty.title || getTypeLabel(selectedProperty.type) + ' en ' + selectedProperty.zone) + '</h3>' +
                        '<p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: #059669;">' + formatPrice(selectedProperty.price) + '</p>' +
                        '<p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">📍 ' + selectedProperty.zone + '</p>' +
                        '<a href="' + selectedProperty.instagramUrl + '" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">Ver en Instagram</a>' +
                        '</div>';

                    popupRef.current = new maplibregl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                        maxWidth: '320px',
                        offset: [0, -10]
                    })
                        .setLngLat([selectedProperty.coordinates.lng, selectedProperty.coordinates.lat])
                        .setDOMContent(popupContent)
                        .addTo(map.current!);
                }, 1600); // Wait for flight animation to complete

            } catch (error) {
                console.error('Error flying to property:', error);
            }
        }
    }, [selectedProperty, isMapReady]);

    if (mapError) {
        return (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle className="text-yellow-500 mb-4" size={48} />
                <p className="text-gray-600 text-lg mb-2">{mapError}</p>
                <p className="text-gray-500 text-sm">Intenta recargar la página</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

            {/* Legend */}
            <div style={{
                position: 'absolute',
                bottom: 40,
                left: 10,
                background: 'white',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                fontSize: 11,
                zIndex: 1000,
                maxWidth: 180
            }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Leyenda</div>
                {/* Property status/age markers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: '50%', border: '2px solid #fbbf24' }}></div>
                    <span style={{ color: '#4b5563' }}>✨ Nueva (&lt;2 sem)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #059669, #0d9488)', borderRadius: '50%', border: '2px solid white' }}></div>
                    <span style={{ color: '#4b5563' }}>En Venta (2-4 sem)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #6b7280, #4b5563)', borderRadius: '50%', border: '2px solid white' }}></div>
                    <span style={{ color: '#4b5563' }}>Antigua (&gt;4 sem)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderRadius: '50%', border: '2px solid white', opacity: 0.7 }}></div>
                    <span style={{ color: '#4b5563' }}>Vendido</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '50%', border: '2px solid white' }}></div>
                    <span style={{ color: '#4b5563' }}>Reservado</span>
                </div>
                {/* POI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderTop: '1px solid #e5e7eb', paddingTop: 6, marginTop: 4 }}>
                    <div style={{ width: 16, height: 16, background: 'white', borderRadius: 3, border: '2px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>📍</div>
                    <span style={{ color: '#4b5563' }}>Punto de Interés</span>
                </div>
                <button
                    onClick={() => setShowPOI(!showPOI)}
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: showPOI ? '#eef2ff' : '#f3f4f6',
                        border: showPOI ? '1px solid #6366f1' : '1px solid #d1d5db',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 11,
                        color: showPOI ? '#4f46e5' : '#6b7280',
                        fontWeight: 500
                    }}
                >
                    {showPOI ? '🔵 Ocultar POI' : '⚪ Mostrar POI'}
                </button>
            </div>

            {!isMapReady && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Cargando mapa...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PropertyMap;
