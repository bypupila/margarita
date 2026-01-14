# 🏠 Margarita Properties

Plataforma inteligente de descubrimiento de propiedades en **Margarita, Venezuela** usando Instagram, IA y análisis de zonas automático.

## ✨ Características

- 🔍 **Scraping Automático**: Descubre propiedades desde Instagram usando hashtags específicos de Margarita
- 🤖 **Extracción con IA**: Gemini AI extrae precio, ubicación, dormitorios, baños y características automáticamente
- 📍 **Geocodificación**: Ubica propiedades en el mapa usando zonas conocidas de Margarita
- 🗺️ **Mapa Interactivo**: Visualiza propiedades con MapLibre GL
- 📊 **Análisis de Zonas**: Identifica las mejores zonas con precio promedio por m²
- 💰 **Estimación de Precios**: Compara propiedades similares para detectar buenas oportunidades
- 🎯 **Filtros Avanzados**: Por tipo, precio, zona, calidad del anuncio

## 🚀 Inicio Rápido

### 1. Configurar API Keys

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_APIFY_API_TOKEN=your-apify-token-here
VITE_GEMINI_API_KEY=your-gemini-api-key-here
```

#### Obtener las Keys:

- **Apify** (para scraping de Instagram): 
  - Crea cuenta gratuita en https://apify.com
  - Ve a Settings > Integrations > API token
  - Tier gratuito: $5/mes = ~2,000-12,000 posts/mes

- **Gemini AI** (para extracción de datos):
  - Crea API key en https://aistudio.google.com/app/apikey
  - Tier gratuito: 15 requests/min

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Ejecutar en Desarrollo

```bash
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## 📖 Cómo Usar

### Descubrir Propiedades

1. **Panel de Administración**: Click en el ícono de configuración (⚙️)
2. **Scraping por Hashtag**: 
   - Ingresa hashtag: `#MargaritaVenezuela`, `#VentaMargarita`, etc.
   - Click en "Buscar Propiedades"
   - Espera el pipeline completo (1-5 min dependiendo del volumen)
3. **Scraping por Cuenta**:
   - Ingresa username de inmobiliaria: `@inmobiliariamargarita`
   - El sistema analizará todos sus posts

### Pipeline de Procesamiento

```
Instagram → Apify → Gemini AI → Geocoding → Análisis → Mapa
```

1. **Apify** scrape posts desde Instagram
2. **Gemini AI** extrae datos estructurados (precio, habitaciones, ubicación)
3. **Geocoding** convierte zonas a coordenadas GPS
4. **Análisis** agrupa propiedades, calcula promedios y recomendaciones
5. **Visualización** muestra todo en el mapa interactivo

### Filtrar Propiedades

- **Por Tipo**: Casa, Ap artamento, Terreno, Local Comercial
- **Por Precio**: Rango min-max en USD
- **Por Zona**: Selecciona zonas específicas de Margarita
- **Por Calidad**: Anuncios completos vs incompletos

### Análisis de Zonas

El sistema automáticamente:
- Agrupa propiedades por zona
- Calcula precio promedio y precio/m²
- Identifica zonas recomendadas (buena relación calidad-precio)
- Muestra heat map en el mapa

## 🏗️ Arquitectura

```
margarita/
├── types.ts                 # Definiciones de tipos
├── services/
│   ├── apifyService.ts     # Scraping de Instagram
│   ├── geminiService.ts    # Extracción con IA
│   ├── geocodingService.ts # Conversión zona → coords
│   ├── zoneAnalyzer.ts     # Análisis de zonas
│   ├── priceEstimator.ts   # Estimación de precios
│   └── discoveryService.ts # Orquestador del pipeline
├── components/
│   ├── Map.tsx             # Mapa principal (MapLibre)
│   ├── PropertyCard.tsx    # Tarjeta de propiedad
│   ├── PropertyPopup.tsx   # Popup en el mapa
│   ├── ZoneHeatMap.tsx     # Mapa de calor de zonas
│   ├── FilterPanel.tsx     # Panel de filtros
│   └── DiscoveryPanel.tsx  # Panel de administración
└── utils/
    └── helpers.ts          # Funciones auxiliares
```

## 🔧 Servicios

### ApifyService
- Busca posts por hashtags de Margarita
- Filtra solo posts de venta (no alquiler)
- Extrae imágenes, caption, cuenta del propietario

### GeminiService
- Analiza caption con IA
- Extrae: tipo, precio USD, habitaciones, baños, m², zona, features
- Calcula quality score (0-100) basado en completitud del anuncio
- Solo valida propiedades en venta en Margarita

### GeocodingService
- Usa Nominatim (OpenStreetMap) - gratis
- Mapeo de zonas conocidas (Pampatar, Porlamar, etc.)
- Fallback a coordenadas de zona si dirección exacta falla

### ZoneAnalyzer
- Agrupa propiedades por zona
- Calcula estadísticas (precio promedio, precio/m², calidad)
- Algoritmo de recomendación: `(calidad*0.4 + densidad*0.3 + precio-valor*0.3)`

### PriceEstimator
- Encuentra propiedades comparables (mismo tipo, zona, tamaño)
- Calcula precio estimado con weighted average
- Indica si precio es: 🟢 Bueno, 🟡 Justo, 🔴 Alto

## 🌍 Zonas de Margarita

Zonas pre-configuradas:
- Porlamar (centro comercial)
- Pampatar (histórico)
- Juan Griego (pueblo pesquero)
- La Asunción (capital)
- Playa El Agua (turístico)
- El Yaque (deportes acuáticos)
- Playa Parguito (surf)
- Costa Azul
- Bella Vista
- El Tirano

## 📊 Indicadores de Calidad

### Quality Score (0-100)
- **80-100**: Anuncio completo (precio, fotos, ubicación, detalles)
- **50-79**: Anuncio parcial (falta información)
- **0-49**: Anuncio muy incompleto

### Price Indicator
- **🟢 Buen Precio**: 10%+ por debajo del mercado
- **🟡 Precio Justo**: Dentro de ±10% del mercado
- **🔴 Sobre Valorado**: 10%+ por encima del mercado

### Recommendation Level (Zonas)
- **HIGH**: Buena relación calidad-precio, varias opciones disponibles
- **MEDIUM**: Precio promedio del mercado
- **LOW**: Pocas opciones o precios altos

## 🎨 Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite
- **Mapa**: MapLibre GL
- **Estilos**: Tailwind CSS + Montserrat Typography
- **IA**: Google Gemini 2.0 Flash
- **Scraping**: Apify Instagram Scrapers
- **Geocoding**: Nominatim (OpenStreetMap)

## 📝 Notas de Desarrollo

### Hashtags Recomendados

Mejores hashtags para encontrar propiedades:
- `#MargaritaVenezuela`
- `#VentaMargarita`
- `#InmuebleMargarita`
- `#CasaMargarita`
- `#ApartamentoMargarita`
- `#VentaCasaMargarita`
- `#PorlamarVenezuela`
- `#PampatarVenezuela`

### Cuentas de Inmobiliarias

(Agregar cuentas locales conocidas para scraping directo)

### Rate Limits

- **Apify**: 100 requests/día (tier gratuito)
- **Gemini**: 15 requests/min, 1500 requests/día (tier gratuito)
- **Nominatim**: 1 request/segundo (fair use)

## 🤝 Contribuir

Para agregar nuevas zonas, editar `services/geocodingService.ts`:

```typescript
const KNOWN_ZONES: Record<string, [number, number]> = {
    'Tu Nueva Zona': [-63.XXXX, 10.XXXX], // [lng, lat]
    // ...
};
```

## 📄 Licencia

MIT

---

Hecho con ❤️ para encontrar la mejor casa en **Margarita, Venezuela** 🏝️
