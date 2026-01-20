import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportWorkshopDto } from './../../../../../../interfaces/report.interface';
import { formatDate as formatDateUtil } from './../../utils/date.utils';

/**
 * Modal independiente para visualizar talleres de un reporte
 * Incluye navegación entre talleres y vista de imágenes
 */
@Component({
    selector: 'app-workshops-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './workshops-modal.component.html'
})
export class WorkshopsModalComponent {
    @Input() isVisible = false;
    @Input() workshops: ReportWorkshopDto[] = [];
    @Input() currentWorkshopIndex = 0;

    @Output() close = new EventEmitter<void>();
    @Output() imageViewerOpen = new EventEmitter<{ images: string[], index: number }>();
    @Output() workshopIndexChanged = new EventEmitter<number>();

    /**
     * Devuelve el taller actual
     */
    get currentWorkshop(): ReportWorkshopDto | null {
        return this.workshops[this.currentWorkshopIndex] || null;
    }

    /**
     * Cierra el modal
     */
    closeModal(): void {
        this.close.emit();
    }

    /**
     * Ir al taller anterior
     */
    prevWorkshop(): void {
        if (this.currentWorkshopIndex > 0) {
            const newIndex = this.currentWorkshopIndex - 1;
            this.workshopIndexChanged.emit(newIndex);
        }
    }

    /**
     * Ir al siguiente taller
     */
    nextWorkshop(): void {
        if (this.currentWorkshopIndex < this.workshops.length - 1) {
            const newIndex = this.currentWorkshopIndex + 1;
            this.workshopIndexChanged.emit(newIndex);
        }
    }

    /**
     * Abre visor de imágenes
     */
    openImageViewer(imageIndex: number): void {
        if (this.currentWorkshop?.imageUrl?.length) {
            const images = this.currentWorkshop.imageUrl.map(url => this.getImagePreview(url));
            this.imageViewerOpen.emit({ images, index: imageIndex });
        }
    }

    /**
     * Devuelve la URL de imagen con formato adecuado
     */
    getImagePreview(imageData: string): string {
        if (imageData.startsWith('http')) return imageData;
        if (imageData.startsWith('data:image')) return imageData;
        if (imageData.startsWith('iVBOR') || imageData.startsWith('ASUN') || imageData.includes('/9j/') || imageData.includes('+/9k=')) {
            return `data:image/png;base64,${imageData}`;
        }
        return '/assets/placeholder-image.png';
    }

    /**
     * Wrapper para formatear fecha usando la utilidad global
     */
    format(date: string | undefined): string {
        return date ? formatDateUtil(date) : 'Fecha no disponible';
    }
}
