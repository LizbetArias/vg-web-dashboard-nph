/**
 * Utilidades para manejo de imágenes
 * Funciones helper para procesamiento y validación de imágenes
 */

/**
 * Valida si un archivo es una imagen válida
 */
export function isValidImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Valida múltiples archivos de imagen
 */
export function validateImageFiles(files: FileList): boolean {
    for (let i = 0; i < files.length; i++) {
        if (!isValidImageFile(files[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Obtiene la vista previa de una imagen (URL o base64)
 */
export function getImagePreview(imageData: string): string {
    if (imageData.startsWith('http')) return imageData;
    if (imageData.startsWith('data:image')) return imageData;

    // Detectar base64 y agregar prefijo si es necesario
    if (isBase64Image(imageData)) {
        return `data:image/png;base64,${imageData}`;
    }

    return '/assets/placeholder-image.png';
}

/**
 * Detecta si una cadena es una imagen en base64
 */
export function isBase64Image(data: string): boolean {
    return (
        data.startsWith('iVBOR') ||
        data.startsWith('ASUN') ||
        data.includes('/9j/') ||
        data.includes('+/9k=')
    );
}

/**
 * Convierte un archivo a base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Extrae el path de una URL de Supabase para eliminación
 */
export function extractPathFromUrl(url: string): string | null {
    try {
        const urlParts = url.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
            const pathParts = urlParts[1].split('/');
            pathParts.shift(); // Remover el nombre del bucket
            return pathParts.join('/');
        }
        return null;
    } catch (error) {
        console.error('Error al extraer path de URL:', error);
        return null;
    }
}