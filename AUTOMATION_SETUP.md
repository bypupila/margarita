# 🏠 Margarita Properties - Guía de Automatización

## 📋 Configuración del Scraping Automático

El sistema está configurado para scrapear Instagram automáticamente todos los días a las **6:00 AM** (hora de Venezuela).

### Paso 1: Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/margarita-properties.git
git push -u origin main
```

### Paso 2: Configurar los Secrets de GitHub

1. Ve a tu repositorio en GitHub
2. Click en **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**
4. Añade estos secrets:

| Nombre | Valor | Dónde obtenerlo |
|--------|-------|-----------------|
| `APIFY_API_TOKEN` | Tu token de Apify | [apify.com/account](https://apify.com/account) |
| `GEMINI_API_KEY` | Tu API key de Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) |

### Paso 3: Habilitar GitHub Actions

1. Ve a la pestaña **Actions** en tu repositorio
2. Click en **"I understand my workflows, go ahead and enable them"**
3. ¡Listo! El scraper correrá automáticamente cada día

### Paso 4: Ejecutar manualmente (opcional)

Para probar el scraper sin esperar 24 horas:

1. Ve a **Actions** → **Daily Property Scraper**
2. Click en **Run workflow** → **Run workflow**

---

## 🔄 Cómo funciona

```
Todos los días a las 6:00 AM:

1. GitHub Actions inicia
   ↓
2. Ejecuta scripts/daily-scraper.js
   ↓
3. Busca en Instagram:
   - #ventamargarita
   - #inmueblesmargarita
   - #apartamentomargarita
   - etc.
   ↓
4. Filtra propiedades válidas:
   ✓ Tiene precio en USD
   ✓ Está en Margarita
   ✓ Es venta (no alquiler)
   ↓
5. Guarda en public/data/scraped_properties.json
   ↓
6. Commit automático al repo
   ↓
7. Tú abres la app y ves las nuevas propiedades
   (aparecen como "Pendientes de Aprobación")
```

---

## 💰 Costos

| Servicio | Límite Gratuito | Uso Estimado |
|----------|-----------------|--------------|
| GitHub Actions | 2000 min/mes | ~5 min/día = 150 min/mes ✅ |
| Apify | $5 USD/mes en créditos | ~$2/mes ✅ |
| Gemini | Gratis | $0 ✅ |
| OpenStreetMap | Ilimitado | $0 ✅ |

**Total: $0/mes** (dentro de límites gratuitos)

---

## 🛠️ Estructura de Archivos

```
margarita-properties/
├── .github/
│   └── workflows/
│       └── daily-scrape.yml    # Workflow de GitHub Actions
├── scripts/
│   └── daily-scraper.js        # Script de scraping
├── public/
│   └── data/
│       └── scraped_properties.json  # Propiedades scrapeadas
├── services/
│   └── scrapedDataService.ts   # Carga propiedades en la app
└── ...
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo cambiar la hora de ejecución?

Sí, edita `.github/workflows/daily-scrape.yml`:

```yaml
on:
  schedule:
    - cron: '0 10 * * *'  # 10:00 UTC = 6:00 AM Venezuela
```

Usa [crontab.guru](https://crontab.guru/) para generar el cron.

### ¿Puedo añadir más hashtags?

Sí, edita `scripts/daily-scraper.js`:

```javascript
const HASHTAGS = [
    'ventamargarita',
    'inmueblesmargarita',
    // Añade más aquí
];
```

### ¿Qué pasa si Apify falla?

El script continuará con los otros hashtags y guardará las propiedades que sí pudo obtener.
