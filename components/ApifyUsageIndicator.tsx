import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { apifyService } from '../services/apifyService';

interface ApifyUsageIndicatorProps {
    className?: string;
}

const ApifyUsageIndicator: React.FC<ApifyUsageIndicatorProps> = ({ className = '' }) => {
    const [usage, setUsage] = useState<{
        totalCredits: number;
        usedCredits: number;
        remainingCredits: number;
        usagePercentage: number;
        planName: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsage = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apifyService.getAccountUsage();
            if (data) {
                setUsage(data);
            } else {
                setError('No configurado');
            }
        } catch (e) {
            setError('Error al cargar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsage();
        // Refresh every 5 minutes
        const interval = setInterval(fetchUsage, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Determine color based on usage
    const getColor = () => {
        if (!usage) return 'gray';
        if (usage.usagePercentage >= 90) return 'red';
        if (usage.usagePercentage >= 70) return 'yellow';
        return 'green';
    };

    const color = getColor();
    const colorClasses = {
        green: {
            bg: 'bg-emerald-500',
            bgLight: 'bg-emerald-100',
            text: 'text-emerald-700',
            border: 'border-emerald-200'
        },
        yellow: {
            bg: 'bg-yellow-500',
            bgLight: 'bg-yellow-100',
            text: 'text-yellow-700',
            border: 'border-yellow-200'
        },
        red: {
            bg: 'bg-red-500',
            bgLight: 'bg-red-100',
            text: 'text-red-700',
            border: 'border-red-200'
        },
        gray: {
            bg: 'bg-gray-400',
            bgLight: 'bg-gray-100',
            text: 'text-gray-600',
            border: 'border-gray-200'
        }
    };

    const colors = colorClasses[color];

    if (loading) {
        return (
            <div className={`flex items-center gap-2 text-gray-500 text-sm ${className}`}>
                <Loader2 className="animate-spin" size={16} />
                <span>Cargando API...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center gap-2 text-gray-500 text-sm ${className}`}>
                <AlertTriangle size={16} className="text-yellow-500" />
                <span>{error}</span>
            </div>
        );
    }

    if (!usage) return null;

    return (
        <div className={`${colors.bgLight} ${colors.border} border rounded-xl p-3 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Activity size={16} className={colors.text} />
                    <span className={`font-semibold text-sm ${colors.text}`}>Apify API</span>
                </div>
                <span className="text-xs text-gray-500">{usage.planName}</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${colors.bg} transition-all duration-500`}
                    style={{ width: `${Math.min(100, usage.usagePercentage)}%` }}
                />
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs">
                <span className="text-gray-600">
                    Usado: <strong className={colors.text}>${usage.usedCredits.toFixed(2)}</strong>
                </span>
                <span className="text-gray-600">
                    Disponible: <strong className="text-emerald-600">${usage.remainingCredits.toFixed(2)}</strong>
                </span>
            </div>

            {/* Warning */}
            {usage.usagePercentage >= 70 && (
                <div className={`mt-2 flex items-center gap-1 text-xs ${colors.text}`}>
                    {usage.usagePercentage >= 90 ? (
                        <>
                            <AlertTriangle size={12} />
                            <span>⚠️ Créditos casi agotados!</span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={12} />
                            <span>Uso elevado ({usage.usagePercentage.toFixed(0)}%)</span>
                        </>
                    )}
                </div>
            )}

            {usage.usagePercentage < 30 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle size={12} />
                    <span>Créditos disponibles</span>
                </div>
            )}

            {/* Refresh Button */}
            <button
                onClick={fetchUsage}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
                ↻ Actualizar
            </button>
        </div>
    );
};

export default ApifyUsageIndicator;
