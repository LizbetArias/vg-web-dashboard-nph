import { Injectable } from "@angular/core"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { environment } from "../../../environments/environments"

@Injectable({ providedIn: "root" })
export class SupabaseReportService {
    private supabase: SupabaseClient

    constructor() {
        // Inicializa el cliente de Supabase con las credenciales del entorno
        this.supabase = createClient(
            environment.supabaseStorage.supabaseUrl,
            environment.supabaseStorage.supabaseKey
        )
    }

    /**
     * Sube una imagen a Supabase Storage
     *  File Imagen en formato File
     * path Ruta (carpeta) donde se almacenará dentro del bucket
     * URL pública del archivo o null si falló
     */
    async uploadImage(file: File, path: string): Promise<string | null> {
        const fileName = `${Date.now()}_${file.name}` // Nombre único usando timestamp

        const { data, error } = await this.supabase.storage
            .from(environment.supabaseStorage.supabaseBucket)
            .upload(`${path}/${fileName}`, file, {
                cacheControl: "3600", // 1 hora de caché
                upsert: false         // No sobrescribir si ya existe
            })

        if (error) {
            console.error("❌ Error al subir a Supabase:", error)
            return null
        }

        // Obtener y devolver la URL pública del archivo
        const publicUrl = this.supabase.storage
            .from(environment.supabaseStorage.supabaseBucket)
            .getPublicUrl(`${path}/${fileName}`).data.publicUrl

        return publicUrl
    }

    /**
     * Elimina un archivo del bucket de Supabase Storage
     * path Ruta completa del archivo (incluye carpeta y nombre)
     * true si se eliminó correctamente, false en caso de error
     */
    async deleteImage(path: string): Promise<boolean> {
        try {
            const { error } = await this.supabase.storage
                .from(environment.supabaseStorage.supabaseBucket)
                .remove([path])

            if (error) {
                console.error("Error al eliminar archivo de Supabase:", error)
                return false
            }

            console.log("Archivo eliminado exitosamente:", path)
            return true
        } catch (error) {
            console.error("Error inesperado al eliminar archivo:", error)
            return false
        }
    }

    /**
     * Sube un archivo HTML (por ejemplo: descripción de un reporte)
     * htmlContent Contenido HTML como string
     * path Ruta (carpeta) dentro del bucket
     * URL pública del archivo HTML o null si hubo error
     */
    async uploadHtmlFile(htmlContent: string, path: string): Promise<string | null> {
        try {
            const fileName = `description_${Date.now()}.html`

            // Crea un Blob con tipo MIME HTML y lo convierte a File
            const htmlBlob = new Blob([htmlContent], { type: "text/html; charset=utf-8" })
            const htmlFile = new File([htmlBlob], fileName, { type: "text/html" })

            // Sube el archivo HTML
            const { data, error } = await this.supabase.storage
                .from(environment.supabaseStorage.supabaseBucket)
                .upload(`${path}/${fileName}`, htmlFile, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: "text/html"
                })

            if (error) {
                console.error("Error al subir archivo HTML a Supabase:", error)
                return null
            }

            const publicUrl = this.supabase.storage
                .from(environment.supabaseStorage.supabaseBucket)
                .getPublicUrl(`${path}/${fileName}`).data.publicUrl

            console.log("Archivo HTML subido exitosamente:", publicUrl)
            return publicUrl
        } catch (error) {
            console.error("Error inesperado al subir archivo HTML:", error)
            return null
        }
    }
}
