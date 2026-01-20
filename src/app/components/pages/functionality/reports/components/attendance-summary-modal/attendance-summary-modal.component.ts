import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

/**
 * Interface para el resumen de asistencia mostrado en el modal
 */
export interface AttendanceSummary {
  fullName: string;
  attendances: number;
  absences: number;
  tardiness: number;
  justifications: number;
}

/**
 * Componente modal para mostrar el resumen de asistencia de un taller.
 * Muestra tabla con estadísticas de asistencia por persona.
 */
@Component({
  selector: 'app-attendance-summary-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attendance-summary-modal.component.html'
})
export class AttendanceSummaryModalComponent {
  @Input() isVisible = false;
  @Input() workshopName = '';
  @Input() attendanceSummary: AttendanceSummary[] = [];
  @Input() isLoading = false;

  @Output() close = new EventEmitter<void>();

  /**
   * Cierra el modal de resumen de asistencia
   */
  closeModal(): void {
    this.close.emit();
  }
}
