import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from "@angular/core"
import { CommonModule } from "@angular/common"
import { ReportService } from "../../../../../services/report.service"
import { ReportDto, ReportWithWorkshopsDto, ReportWorkshopDto, ReportAttendanceSummaryDto } from "../../../../../interfaces/report.interface"
import { DomSanitizer, SafeHtml } from "@angular/platform-browser"
import Swal from "sweetalert2"

// Importar componentes modulares
import { DescriptionModalComponent } from "../components/description-modal/description-modal.component"
import { ImageViewerModalComponent } from "../viewers/image-viewer-modal/image-viewer-modal.component"
import { ScheduleViewerModalComponent } from "../viewers/schedule-viewer-modal/schedule-viewer-modal.component"
import { AttendanceSummaryModalComponent, AttendanceSummary } from "../components/attendance-summary-modal/attendance-summary-modal.component"

@Component({
  selector: "app-report-viewer-modal",
  standalone: true,
  imports: [
    CommonModule,
    DescriptionModalComponent,
    ImageViewerModalComponent,
    ScheduleViewerModalComponent,
    AttendanceSummaryModalComponent
  ],
  templateUrl: "./report-viewer-modal.component.html",
  styleUrls: ["./report-viewer-modal.component.css"],
})
export class ReportViewerModalComponent implements OnInit, OnChanges {
  @Input() isVisible = false
  @Input() reportData: ReportDto | ReportWithWorkshopsDto | null = null
  @Output() close = new EventEmitter<void>()
  @Input() workshopDateStart: string | null = null
  @Input() workshopDateEnd: string | null = null

  // Estados de modales
  showDescriptionModal = false
  showImageViewer = false
  showScheduleViewer = false
  showAttendanceModal = false

  // Datos para modales
  currentImages: string[] = []
  currentImageIndex = 0
  schedulePreview = ""
  currentWorkshopIndex = 0
  descriptionContent: SafeHtml = ""
  isLoadingDescription = false
  attendanceSummary: AttendanceSummary[] = []
  isLoadingAttendance = false
  currentWorkshopName = ""

  constructor(
    private reportService: ReportService,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit(): void {
    this.processReportData()
  }

  ngOnChanges(): void {
    if (this.isVisible && this.reportData) {
      this.processReportData()
    }
  }

  processReportData(): void {
    if (!this.reportData) return

    this.loadDescriptionContent()
    this.loadSchedulePreview()
    this.currentWorkshopIndex = 0
  }

  private loadDescriptionContent(): void {
    const report = this.getSafeReport()
    if (!report.descriptionUrl) {
      this.descriptionContent = this.sanitizer.bypassSecurityTrustHtml(
        '<p class="text-gray-500 italic">Sin descripción disponible</p>',
      )
      return
    }

    this.isLoadingDescription = true

    if (report.descriptionUrl.startsWith("http")) {
      fetch(report.descriptionUrl)
        .then((response) => response.ok ? response.text() : Promise.reject(`HTTP ${response.status}`))
        .then((htmlContent) => {
          this.descriptionContent = this.sanitizer.bypassSecurityTrustHtml(htmlContent)
          this.isLoadingDescription = false
        })
        .catch((error) => {
          console.error("Error loading description:", error)
          this.descriptionContent = this.sanitizer.bypassSecurityTrustHtml(
            '<p class="text-red-500">Error al cargar la descripción</p>',
          )
          this.isLoadingDescription = false
        })
    } else if (report.descriptionUrl.includes("<") && report.descriptionUrl.includes(">")) {
      this.descriptionContent = this.sanitizer.bypassSecurityTrustHtml(report.descriptionUrl)
      this.isLoadingDescription = false
    } else {
      this.descriptionContent = this.sanitizer.bypassSecurityTrustHtml(
        `<p class="text-gray-900 dark:text-gray-100">${report.descriptionUrl}</p>`,
      )
      this.isLoadingDescription = false
    }
  }

  private loadSchedulePreview(): void {
    const report = this.getSafeReport()
    if (report.scheduleUrl) {
      this.schedulePreview = this.processImageUrl(report.scheduleUrl)
    }
  }

  // Getters
  getWorkshops(): ReportWorkshopDto[] {
    if (!this.reportData) return []
    if ("workshops" in this.reportData) {
      return this.reportData.workshops
    }
    if ("report" in this.reportData && (this.reportData as any).report.workshops) {
      const nested = (this.reportData as any).report as ReportDto & { workshops: ReportWorkshopDto[] }
      return nested.workshops || []
    }
    return []
  }

  getCurrentWorkshop(): ReportWorkshopDto | null {
    const workshops = this.getWorkshops()
    return workshops[this.currentWorkshopIndex] || null
  }

  getSafeReport(): ReportDto {
    if (!this.reportData) {
      return {
        id: 0,
        year: 0,
        trimester: "",
        descriptionUrl: "",
        scheduleUrl: "",
        status: "",
      }
    }
    return "report" in this.reportData ? this.reportData.report : this.reportData
  }

  // Verifica si el taller actual tiene datos de asistencia
  hasAttendanceData(): boolean {
    const workshop = this.getCurrentWorkshop()
    return !!(workshop?.attendanceSummaries && workshop.attendanceSummaries.length > 0)
  }

  // Navegación de talleres
  prevWorkshop(): void {
    if (this.currentWorkshopIndex > 0) {
      this.currentWorkshopIndex--
    }
  }

  nextWorkshop(): void {
    const workshops = this.getWorkshops()
    if (this.currentWorkshopIndex < workshops.length - 1) {
      this.currentWorkshopIndex++
    }
  }

  // Métodos para abrir modales
  openDescriptionModal(): void {
    this.showDescriptionModal = true
  }

  openScheduleViewer(): void {
    if (this.schedulePreview) {
      this.showScheduleViewer = true
    }
  }

  openWorkshopImages(): void {
    const workshop = this.getCurrentWorkshop()
    if (!workshop?.imageUrl?.length) {
      Swal.fire({
        title: "Información",
        text: "Este taller no tiene imágenes disponibles",
        icon: "info",
        confirmButtonText: "Aceptar",
      })
      return
    }
    this.currentImages = workshop.imageUrl.map(url => this.processImageUrl(url))
    this.currentImageIndex = 0
    this.showImageViewer = true
  }

  openAttendanceSummary(): void {
    const workshop = this.getCurrentWorkshop()
    if (!workshop) return

    this.currentWorkshopName = workshop.workshopName
    this.showAttendanceModal = true

    // Verificar si hay datos de asistencia en el taller
    if (workshop.attendanceSummaries && workshop.attendanceSummaries.length > 0) {
      // Usar los datos reales del taller
      this.attendanceSummary = workshop.attendanceSummaries.map((summary: ReportAttendanceSummaryDto) => ({
        fullName: summary.personName,
        attendances: summary.presentCount,
        absences: summary.absentCount,
        tardiness: summary.lateCount,
        justifications: summary.justifiedCount
      }))
      this.isLoadingAttendance = false
    } else {
      // Mostrar mensaje de que no hay datos
      this.attendanceSummary = []
      this.isLoadingAttendance = false

      // Opcional: mostrar un mensaje informativo
      setTimeout(() => {
        if (this.showAttendanceModal && this.attendanceSummary.length === 0) {
          console.log("No hay datos de asistencia disponibles para este taller")
        }
      }, 100)
    }
  }

  // Métodos para cerrar modales
  closeDescriptionModal(): void {
    this.showDescriptionModal = false
  }

  closeImageViewer(): void {
    this.showImageViewer = false
    this.currentImageIndex = 0
    this.currentImages = []
  }

  closeScheduleViewer(): void {
    this.showScheduleViewer = false
  }

  closeAttendanceModal(): void {
    this.showAttendanceModal = false
    this.attendanceSummary = []
    this.currentWorkshopName = ""
    this.isLoadingAttendance = false
  }

  // Eventos de navegación de imágenes
  onImageIndexChanged(index: number): void {
    this.currentImageIndex = index
  }

  onImageViewerToggle(show: boolean): void {
    if (!show) {
      this.closeImageViewer()
    }
  }

  onScheduleViewerToggle(show: boolean): void {
    if (!show) {
      this.closeScheduleViewer()
    }
  }

  // Utilidades
  processImageUrl(url: string): string {
    if (!url) return "/assets/placeholder-image.png"
    if (url.startsWith("http") || url.startsWith("data:image")) return url
    if (url.startsWith("iVBOR") || url.startsWith("ASUN") || url.includes("/9j/") || url.includes("+/9k=")) {
      return `data:image/png;base64,${url}`
    }
    return "/assets/placeholder-image.png"
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return "Fecha no disponible"

    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Fecha inválida"

      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const day = date.getDate()
      const month = months[date.getMonth()]
      const year = date.getFullYear()

      return `${day}/${month}/${year}`
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Fecha no disponible"
    }
  }

  downloadPdf(): void {
    if (!this.reportData) return

    let reportId: number | null = null
    if ("id" in this.reportData) {
      reportId = this.reportData.id
    } else if ("report" in this.reportData && "id" in this.reportData.report) {
      reportId = this.reportData.report.id
    }

    if (reportId) {
      Swal.fire({
        title: "Generando PDF...",
        text: "Por favor espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      })

      this.reportService.downloadReportFile(reportId, "pdf", this.workshopDateStart!, this.workshopDateEnd!).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.target = "_blank"
          a.download = `reporte_${reportId}.pdf`
          a.click()
          window.URL.revokeObjectURL(url)
          Swal.close()
        },
        error: (error) => {
          console.error("Error downloading PDF:", error)
          Swal.fire("Error", "No se pudo generar el PDF.", "error")
        },
      })
    }
  }

  closeModal(): void {
    // Limpiar estados
    this.currentWorkshopIndex = 0
    this.currentImageIndex = 0
    this.currentImages = []
    this.showImageViewer = false
    this.showScheduleViewer = false
    this.showDescriptionModal = false
    this.showAttendanceModal = false
    this.descriptionContent = ""
    this.isLoadingDescription = false
    this.attendanceSummary = []
    this.isLoadingAttendance = false

    this.close.emit()
  }
}