import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ImageUrl } from './../../../../../../interfaces/report.interface';
import { CommonModule } from '@angular/common';

/**
 * Componente para visualizar imágenes de talleres
 * Incluye galería con navegación y vista previa
 */
@Component({
    selector: 'app-image-viewer',
    standalone: true,
    templateUrl: './image-viewer.component.html',
    imports: [CommonModule]
})
export class ImageViewerComponent {
    @Input() images: ImageUrl[] = [];
    @Input() showViewer = false;
    @Input() currentImageIndex = 0;
    @Input() currentImageUrl = '';
    @Output() filesSelected = new EventEmitter<FileList>();
    @Output() imageRemoved = new EventEmitter<number>();
    @Output() viewerToggle = new EventEmitter<boolean>();
    @Output() imageIndexChanged = new EventEmitter<number>();

    /**
     * Maneja la selección de archivos de imagen (uno por uno)
     */
    onFilesChange(event: any): void {
        const files = event.target.files;
        if (files && files.length > 0) {
            if (this.validateImageFiles(files)) {
                this.filesSelected.emit(files);
            } else {
                this.showValidationError();
            }
        }
        // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
        event.target.value = '';
    }

    /**
     * Valida que todos los archivos sean imágenes
     */
    private validateImageFiles(files: FileList): boolean {
        for (let i = 0; i < files.length; i++) {
            if (!files[i].type.startsWith('image/')) {
                return false;
            }
        }
        return true;
    }

    /**
     * Muestra error de validación
     */
    private showValidationError(): void {
        alert('Solo se permiten archivos de imagen (JPG, PNG, GIF, etc.)');
    }

    /**
     * Elimina una imagen específica
     */
    removeImage(index: number): void {
        this.imageRemoved.emit(index);
    }

    /**
     * Abre el visor de imágenes en un índice específico
     */
    openViewer(index: number): void {
        this.imageIndexChanged.emit(index);
        this.viewerToggle.emit(true);
    }

    /**
     * Cierra el visor de imágenes
     */
    closeViewer(): void {
        this.viewerToggle.emit(false);
    }

    /**
     * Navega a una imagen específica
     */
    viewImage(index: number): void {
        this.imageIndexChanged.emit(index);
    }

    /**
     * Navega a la imagen anterior
     */
    prevImage(): void {
        if (this.currentImageIndex > 0) {
            this.imageIndexChanged.emit(this.currentImageIndex - 1);
        }
    }

    /**
     * Navega a la imagen siguiente
     */
    nextImage(): void {
        if (this.currentImageIndex < this.images.length - 1) {
            this.imageIndexChanged.emit(this.currentImageIndex + 1);
        }
    }
}
