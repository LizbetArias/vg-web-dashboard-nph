/**
 * Utilidades para manejo de fechas
 * Funciones helper para formateo y validación de fechas
 */

/**
 * Meses del año para formateo
 */
export const MONTHS = [
    { value: '01', label: 'Ene' }, { value: '02', label: 'Feb' }, { value: '03', label: 'Mar' },
    { value: '04', label: 'Abr' }, { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' }, { value: '08', label: 'Ago' }, { value: '09', label: 'Sep' },
    { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dic' },
];

/**
 * Formatea una fecha para mostrar en formato legible
 */
export function formatDate(dateString: string): string {
    if (!dateString) return '';

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const dayStr = String(date.getDate()).padStart(2, '0');
    const monthStr = MONTHS[date.getMonth()].label;
    const yearStr = date.getFullYear();

    return `${dayStr}/${monthStr}/${yearStr}`;
}

/**
 * Obtiene el rango de fechas para un trimestre específico
 */
export function getDateRangeForTrimester(trimester: string): { startMonth: string; endMonth: string } {
    const ranges = {
        'Enero-Marzo': { startMonth: '01', endMonth: '03' },
        'Abril-Junio': { startMonth: '04', endMonth: '06' },
        'Julio-Septiembre': { startMonth: '07', endMonth: '09' },
        'Octubre-Diciembre': { startMonth: '10', endMonth: '12' },
    };

    return ranges[trimester as keyof typeof ranges] || { startMonth: '01', endMonth: '12' };
}

/**
 * Valida que una fecha de fin sea posterior a una fecha de inicio
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
    if (!startDate || !endDate) return true; // Si no hay fechas, no validar

    const start = new Date(startDate);
    const end = new Date(endDate);

    return end >= start;
}

/**
 * Obtiene el año actual
 */
export function getCurrentYear(): number {
    return new Date().getFullYear();
}

/**
 * Valida si un año está en el rango permitido
 */
export function isValidYear(year: number, minYear = 2020, maxYear = getCurrentYear() + 1): boolean {
    return year >= minYear && year <= maxYear;
}