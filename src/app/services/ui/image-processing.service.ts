import { Injectable } from "@angular/core"
import imageCompression from "browser-image-compression"

// Interface para representar una imagen procesada
export interface ProcessedImage {
    file: File
    preview: string
    name: string
}

@Injectable({
    providedIn: "root",
})
export class ImageProcessingService {

    constructor() { }

    /**
     * Procesa una sola imagen: comprime, redimensiona y convierte a JPG.
     * File Imagen original (tipo File)
     * Imagen procesada con preview y nuevo nombre
     */
    async processImage(file: File): Promise<ProcessedImage> {
        try {
            // Opciones para compresión de imagen
            const options = {
                maxSizeMB: 0.5,               // Peso máximo en MB (500 KB)
                maxWidthOrHeight: 1280,       // Máxima dimensión (ancho o alto)
                useWebWorker: true,           // Usa Web Worker para no bloquear el hilo principal
                fileType: "image/jpeg",       // Convertir a formato JPG
                initialQuality: 0.8,          // Calidad inicial (de 0 a 1)
                alwaysKeepResolution: false   // Permite redimensionar si es necesario
            }

            // Comprimir y redimensionar la imagen
            const compressedFile = await imageCompression(file, options)

            // Obtener nombre base del archivo original sin extensión
            const originalName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
            const newFileName = `${originalName}.jpg`

            // Crear un nuevo archivo .jpg con el resultado de la compresión
            const processedFile = new File([compressedFile], newFileName, { type: "image/jpeg" })

            // Generar una vista previa en base64 para mostrar en la UI
            const preview = await imageCompression.getDataUrlFromFile(processedFile)

            // Devolver objeto con la imagen procesada
            return {
                file: processedFile,
                preview,
                name: newFileName,
            }

        } catch (error) {
            console.error("Error al procesar la imagen:", error)
            throw error
        }
    }

    /**
     * Procesa múltiples imágenes al mismo tiempo.
     * Files Arreglo de archivos de imagen
     * Arreglo de imágenes procesadas
     */
    async processMultipleImages(files: File[]): Promise<ProcessedImage[]> {
        const processPromises = Array.from(files).map(file => this.processImage(file))
        return Promise.all(processPromises)
    }
}
