import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { fileImportService, ImportResult } from '../services/fileImportService';
import { Property } from '../types';

interface FileImportPanelProps {
    onPropertiesImported: (properties: Property[]) => void;
    existingProperties: Property[];
}

const FileImportPanel: React.FC<FileImportPanelProps> = ({ onPropertiesImported, existingProperties }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        validateAndSetFile(droppedFile);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (file: File) => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
        ];

        // Also check extension as backup
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (validTypes.includes(file.type) || hasValidExt) {
            setFile(file);
            setError(null);
            setResult(null);
        } else {
            setError('Formato no soportado. Usa Excel (.xlsx, .xls) o CSV.');
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);

        try {
            console.log('[FileImport] Parseando archivo:', file.name);
            const rows = await fileImportService.parseFile(file);

            console.log(`[FileImport] ${rows.length} filas encontradas. Comenzando procesamiento con Gemini...`);

            const importResult = await fileImportService.processImport(rows, (current, total) => {
                const percentage = Math.round((current / total) * 100);
                setProgress(percentage);
            });

            setResult(importResult);
            if (importResult.properties.length > 0) {
                onPropertiesImported(importResult.properties);
            }

        } catch (err: any) {
            console.error('Import error:', err);
            setError(err.message || 'Error al procesar el archivo');
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        setProgress(0);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="text-white" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Importar Datos</h2>
                    <p className="text-sm text-gray-600">Sube archivos de Instant Data Scraper o Excel</p>
                </div>
            </div>

            {!result && (
                <>
                    {/* Upload Area */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : file
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                            }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                        />

                        {file ? (
                            <div className="flex flex-col items-center">
                                <FileSpreadsheet size={48} className="text-emerald-500 mb-2" />
                                <p className="font-semibold text-emerald-700">{file.name}</p>
                                <p className="text-xs text-emerald-600 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload size={48} className="text-gray-400 mb-2" />
                                <p className="font-medium text-gray-700">Arrastra tu archivo aquí</p>
                                <p className="text-xs text-gray-500 mt-1">Soporta Excel (.xlsx) y CSV</p>
                            </div>
                        )}
                    </div>

                    {/* Format Tip */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                        <p><strong>💡 Formato esperado:</strong> El archivo debe tener columnas como "description", "caption", "url", o "image_url".</p>
                        <p className="mt-1">Si usas <strong>Instant Data Scraper</strong>, sube el archivo CSV tal cual lo descargas.</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={handleImport}
                        disabled={!file || isProcessing}
                        className={`mt-6 w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${!file || isProcessing
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Procesando ({progress}%)...
                            </>
                        ) : (
                            <>
                                <Upload size={20} />
                                {file ? 'Procesar Archivo con IA' : 'Selecciona un archivo'}
                            </>
                        )}
                    </button>

                    {/* Progress Bar */}
                    {isProcessing && (
                        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Result View */}
            {result && (
                <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¡Importación Completada!</h3>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-bold text-gray-900">{result.total}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg">
                            <p className="text-xs text-emerald-600">Éxito</p>
                            <p className="font-bold text-emerald-700">{result.success}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg">
                            <p className="text-xs text-red-600">Fallidos</p>
                            <p className="font-bold text-red-700">{result.failed}</p>
                        </div>
                    </div>

                    {result.properties.length > 0 ? (
                        <p className="text-sm text-gray-600 mb-6">
                            Se han agregado <strong>{result.properties.length}</strong> propiedades al mapa.
                        </p>
                    ) : (
                        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                            <p className="text-sm text-yellow-700">
                                No se encontraron propiedades válidas. Verifica que las descripciones contengan palabras clave como "venta", "precio", "m2".
                            </p>
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Importar Otro Archivo
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileImportPanel;
