import { CommonModule } from "@angular/common"
import { Component, Input, Output, EventEmitter } from "@angular/core"

/**
 * Componente para visualizar el cronograma del reporte
 * Maneja la previsualización y modal de visualización del cronograma
 */
@Component({
    selector: "app-schedule-viewer",
    standalone: true,
    templateUrl: "./schedule-viewer.component.html",
    imports: [CommonModule],
})
export class ScheduleViewerComponent {
    @Input() fileName = ""
    @Input() preview = ""
    @Input() showViewer = false
    @Output() fileSelected = new EventEmitter<File>()
    @Output() viewerToggle = new EventEmitter<boolean>()

    /**
     * Maneja el cambio de archivo del cronograma
     */
    onFileChange(event: any): void {
        const files = event.target.files
        if (files && files.length > 0) {
            const file = files[0]
            if (this.isValidImageFile(file)) {
                this.fileSelected.emit(file)
            }
        }
        event.target.value = ""
    }

    /**
     * Valida si el archivo es una imagen
     */
    private isValidImageFile(file: File): boolean {
        return file.type.startsWith("image/")
    }

    /**
     * Abre el visor del cronograma
     */
    openViewer(): void {
        if (this.preview) {
            this.viewerToggle.emit(true)
        }
    }

    /**
     * Cierra el visor del cronograma
     */
    closeViewer(): void {
        this.viewerToggle.emit(false)
    }
}
