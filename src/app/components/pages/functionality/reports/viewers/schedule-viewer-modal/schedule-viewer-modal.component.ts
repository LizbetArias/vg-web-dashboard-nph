import { CommonModule } from "@angular/common"
import { Component, Input, Output, EventEmitter, type OnInit, type OnDestroy } from "@angular/core"

/**
 * Componente modal independiente para visualizar el cronograma
 * Se renderiza fuera del modal padre para ocupar toda la pantalla
 */
@Component({
    selector: "app-schedule-viewer-modal",
    standalone: true,
    templateUrl: "./schedule-viewer-modal.component.html",
    imports: [CommonModule],
})
export class ScheduleViewerModalComponent implements OnInit, OnDestroy {
    @Input() showViewer = false
    @Input() preview = ""
    @Output() viewerToggle = new EventEmitter<boolean>()

    private originalBodyOverflow = ""

    ngOnInit(): void {
        // Prevenir scroll del body cuando el modal está abierto
        if (this.showViewer) {
            this.disableBodyScroll()
        }
    }

    ngOnDestroy(): void {
        this.enableBodyScroll()
    }

    ngOnChanges(): void {
        if (this.showViewer) {
            this.disableBodyScroll()
        } else {
            this.enableBodyScroll()
        }
    }

    closeViewer(): void {
        this.enableBodyScroll()
        this.viewerToggle.emit(false)
    }

    private disableBodyScroll(): void {
        this.originalBodyOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
    }

    private enableBodyScroll(): void {
        document.body.style.overflow = this.originalBodyOverflow
    }
}
