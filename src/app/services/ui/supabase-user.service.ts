import { environment } from './../../../environments/environments';
import { Injectable } from "@angular/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Observable, from, of, throwError } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

@Injectable({
    providedIn: "root",
})
export class SupabaseUserService {
    private supabase: SupabaseClient;
    private bucketName: string;

    constructor() {
        this.supabase = createClient(
            environment.supabaseStorage.supabaseUrl,
            environment.supabaseStorage.supabaseKey
        );
        this.bucketName = environment.supabaseStorage.supabaseBucket;
    }

    /**
     * Sube una imagen a Supabase Storage
     * @param base64Image Imagen en formato base64
     * @param userId ID del usuario para crear un nombre de archivo único
     * @returns Observable con la URL de la imagen subida
     */
    uploadProfileImage(base64Image: string, userId: string): Observable<string> {
        if (!base64Image) {
            return throwError(() => new Error("No se proporcionó ninguna imagen"));
        }

        const base64Data = base64Image.split(",")[1];
        if (!base64Data) {
            return throwError(() => new Error("Formato de imagen inválido"));
        }

        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArrays.push(byteCharacters.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(byteArrays)], { type: "image/jpeg" });

        const fileName = `profile_${userId}_${Date.now()}.jpg`;
        const filePath = `users/${fileName}`;

        return from(
            this.supabase.storage.from(this.bucketName).upload(filePath, blob, {
                contentType: "image/jpeg",
                upsert: false,
            })
        ).pipe(
            switchMap((response) => {
                if (response.error) {
                    return throwError(() => new Error(`Error al subir imagen: ${response.error.message}`));
                }

                // ✅ getPublicUrl no devuelve error, accedemos directo al data
                const { publicUrl } = this.supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(filePath).data;

                return of(publicUrl);
            })
            ,
            catchError((error) => {
                console.error("Error en el servicio de almacenamiento:", error);
                return throwError(() => new Error(`Error al procesar la imagen: ${error.message}`));
            })
        );
    }

    /**
     * Elimina una imagen de Supabase Storage
     * @param imageUrl URL de la imagen a eliminar
     * @returns Observable que indica si la operación fue exitosa
     */
    deleteProfileImage(imageUrl: string): Observable<boolean> {
        if (!imageUrl) {
            return of(true); // No hay imagen que eliminar
        }

        const urlParts = imageUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `users/${fileName}`;

        if (!imageUrl.includes(environment.supabaseStorage.supabaseUrl)) {
            return of(true); // No es de Supabase
        }

        return from(
            this.supabase.storage.from(this.bucketName).remove([filePath])
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(`Error al eliminar imagen: ${response.error.message}`);
                }
                return true;
            }),
            catchError((error) => {
                console.error("Error al eliminar imagen:", error);
                return of(false);
            })
        );
    }
}
