import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

/**
 * Interface para imágenes del visor
 */
export interface ImageData {
    preview: string;
    name?: string;
}

/**
 * Modal independiente para visualizar imágenes con navegación
 * Reutilizable para cualquier conjunto de imágenes
 */
@Component({
    selector: 'app-image-viewer-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './image-viewer-modal.component.html',
    styleUrls: ['./image-viewer-modal.component.css']
})
export class ImageViewerModalComponent {
    @Input() showViewer = false;
    @Input() images: (string | ImageData)[] = [];
    @Input() currentImageIndex = 0;
    @Input() currentImageUrl = '';

    @Output() viewerToggle = new EventEmitter<boolean>();
    @Output() imageIndexChanged = new EventEmitter<number>();

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

    /**
     * Obtiene la vista previa de una imagen
     */
    getImagePreview(image: string | ImageData): string {
        if (typeof image === 'string') {
            return this.processImageUrl(image);
        }
        return this.processImageUrl(image.preview);
    }

    /**
     * Procesa una URL de imagen (valida base64, URL remota o local)
     */
    private processImageUrl(url: string): string {
        if (url.startsWith('http')) return url;
        if (url.startsWith('data:image')) return url;
        if (url.startsWith('iVBOR') || url.startsWith('ASUN') || url.includes('/9j/') || url.includes('+/9k=')) {
            return `data:image/png;base64,${url}`;
        }
        return '/assets/placeholder-image.png';
    }
}
