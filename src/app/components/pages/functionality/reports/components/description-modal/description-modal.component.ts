import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Modal independiente para mostrar la descripción de reportes
 * Componente reutilizable con carga asíncrona de contenido HTML
 */
@Component({
    selector: 'app-description-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './description-modal.component.html'
})
export class DescriptionModalComponent {
    // Visibilidad del modal
    @Input() isVisible = false;

    // Cargando (spinner)
    @Input() isLoading = false;

    // Contenido HTML sanitizado (HTML enriquecido seguro)
    @Input() htmlContent: SafeHtml = '';

    // Evento para cerrar el modal
    @Output() close = new EventEmitter<void>();

    /**
     * Cierra el modal de descripción
     */
    closeModal(): void {
        this.close.emit();
    }
}
