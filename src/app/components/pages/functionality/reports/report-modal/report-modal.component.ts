import { Component, OnInit, Input, Output, EventEmitter, SimpleChanges, OnDestroy } from "@angular/core"
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms"
import { RouterModule } from "@angular/router"
import { CommonModule } from "@angular/common"
import { QuillModule } from "ngx-quill"
import { Subject } from "rxjs"
import { debounceTime, distinctUntilChanged } from "rxjs/operators"
import Swal from "sweetalert2"

// Services
import { ReportService } from "../../../../../services/report.service"
import { SupabaseReportService } from "../../../../../services/ui/supabase-report.service"
import { ImageProcessingService, ProcessedImage } from "../../../../../services/ui/image-processing.service"
import { AuthService } from "../../../../../auth/services/auth.service"

// Interfaces
import {
  ImageUrl,
  ReportDto,
  ReportWithWorkshopsDto,
  ReportWorkshopDto,
  WorkshopKafkaEventDto,
  ReportAttendanceSummaryDto,
} from "../../../../../interfaces/report.interface"

// Componentes modulares
import { ScheduleViewerComponent } from "./../viewers/schedule-viewer/schedule-viewer.component"
import { ScheduleViewerModalComponent } from "./../viewers/schedule-viewer-modal/schedule-viewer-modal.component"
import { ImageViewerComponent } from "./../viewers/image-viewer/image-viewer.component"
import { ImageViewerModalComponent } from "./../viewers/image-viewer-modal/image-viewer-modal.component"
import { AttendanceSummaryModalComponent } from "./../components/attendance-summary-modal/attendance-summary-modal.component"

// Utils
import { formatDate, getCurrentYear, isValidYear } from "../utils/date.utils"
import { fileToBase64, getImagePreview } from "../utils/image.utils"

// ===== CUSTOM VALIDATORS =====

/**
 * Valida que la fecha de fin sea posterior a la fecha de inicio
 */
export function dateRangeValidator(): ValidatorFn {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    const startDate = formGroup.get("workshopDateStart")?.value
    const endDate = formGroup.get("workshopDateEnd")?.value

    if (!startDate || !endDate) return null

    const start = new Date(startDate)
    const end = new Date(endDate)

    return end < start ? { invalidDateRange: true } : null
  }
}

/**
 * Valida el año del reporte (rango permitido: 2020 - año actual + 1)
 */
export function yearValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value
    if (!value) return { required: true }

    const year = Number.parseInt(value)
    if (!isValidYear(year)) {
      if (isNaN(year)) return { invalidYear: true }
      if (year < 2020) return { yearTooOld: true }
      if (year > getCurrentYear() + 1) return { yearTooFuture: true }
    }

    return null
  }
}

/**
 * Interface para el resumen de asistencia mostrado en el modal
 */
interface AttendanceSummary {
  fullName: string
  attendances: number
  absences: number
  tardiness: number
  justifications: number
}

@Component({
  selector: "app-report-modal",
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    RouterModule,
    QuillModule,
    ScheduleViewerComponent,
    ScheduleViewerModalComponent,
    ImageViewerComponent,
    ImageViewerModalComponent,
    AttendanceSummaryModalComponent,
  ],
  templateUrl: "./report-modal.component.html",
  styleUrl: "./report-modal.component.css",
})
export class ReportModalComponent implements OnInit, OnDestroy {
  // ===== COMPONENT INPUTS & OUTPUTS =====
  @Input() reportData: ReportDto | ReportWithWorkshopsDto | null = null
  @Input() isVisible = false
  @Output() close = new EventEmitter<void>()
  @Output() saved = new EventEmitter<ReportWithWorkshopsDto>()

  // ===== FORM PROPERTIES =====
  reportForm: FormGroup
  isEditMode = false
  isSubmitting = false

  // ===== WORKSHOP AUTOCOMPLETE SYSTEM =====
  allWorkshops: WorkshopKafkaEventDto[] = []
  workshopSuggestions: WorkshopKafkaEventDto[][] = []
  showSuggestions: boolean[] = []

  // ===== FILE MANAGEMENT =====
  scheduleFileName = ""
  scheduleFile: File | null = null
  schedulePreview = ""
  workshopImages: ImageUrl[][] = []

  // URLs anteriores para eliminar en modo edición
  previousScheduleUrl = ""
  previousDescriptionUrl = ""
  previousImageUrls: string[][] = []

  // ===== DUPLICATE VALIDATION SYSTEM =====
  isDuplicateReport = false
  isCheckingDuplicate = false
  duplicateCheckSubject = new Subject<{ year: number; trimester: string }>()

  // ===== LOADING STATES =====
  isLoadingDescription = false
  isProcessingImages: { [key: number]: boolean } = {} // Estado de compresión por taller
  isProcessingSchedule = false // Estado de compresión del cronograma

  // ===== MODULAR COMPONENT STATES =====
  // Schedule Viewer
  showScheduleViewer = false

  // Image Viewer - CORREGIDO: Modal independiente
  showImageViewer = false
  currentWorkshopImages: ImageUrl[] = []
  currentImageIndex = 0
  currentImageUrl = ""

  // Attendance Summary Modal
  showAttendanceModal = false
  attendanceSummary: AttendanceSummary[] = []
  isLoadingAttendance: { [key: number]: boolean } = {}
  currentWorkshopName = ""
  storedAttendanceSummaries: { [workshopIndex: number]: ReportAttendanceSummaryDto[] } = {}

  // ===== CONSTANTS =====
  readonly currentYear = getCurrentYear()
  readonly maxYear = getCurrentYear() + 1
  readonly minYear = 2020

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private supabaseService: SupabaseReportService,
    private imageProcessingService: ImageProcessingService,
    private authService: AuthService,
  ) {
    this.reportForm = this.createReportForm()
    this.setupDuplicateValidation()
  }

  // ===== LIFECYCLE HOOKS =====

  ngOnInit(): void {
    this.loadWorkshops()
    this.setupFormSubscriptions()
  }

  ngOnDestroy(): void {
    this.duplicateCheckSubject.complete()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isVisible"]) {
      if (changes["isVisible"].currentValue === true) {
        this.initializeModal()
      } else if (changes["isVisible"].currentValue === false) {
        this.resetModal()
      }
    }

    if (changes["reportData"] && changes["reportData"].currentValue && this.isVisible) {
      this.populateForm(changes["reportData"].currentValue)
    }
  }

  // ===== MODAL MANAGEMENT =====

  /**
   * Inicializa el modal según el modo (creación/edición)
   */
  private initializeModal(): void {
    if (this.reportData) {
      this.populateForm(this.reportData)
    } else {
      this.resetModal()
      this.isEditMode = false
    }
  }

  /**
   * Resetea completamente el estado del modal
   */
  private resetModal(): void {
    this.reportForm.reset()
    this.reportForm = this.createReportForm()

    // Limpiar arrays y estados
    this.workshopImages = []
    this.workshopSuggestions = []
    this.showSuggestions = []
    this.scheduleFileName = ""
    this.scheduleFile = null
    this.schedulePreview = ""
    this.previousScheduleUrl = ""
    this.previousDescriptionUrl = ""
    this.previousImageUrls = []

    // Resetear estados de carga
    this.isLoadingDescription = false
    this.isDuplicateReport = false
    this.isCheckingDuplicate = false
    this.isEditMode = false
    this.isSubmitting = false
    this.isProcessingImages = {}
    this.isProcessingSchedule = false

    // Cerrar modales
    this.closeAllModals()
    this.clearWorkshopsArray()

    // Limpiar estados de asistencia
    this.isLoadingAttendance = {}
    this.attendanceSummary = []
    this.storedAttendanceSummaries = {}
  }

  /**
   * Cierra todos los modales secundarios
   */
  private closeAllModals(): void {
    this.showImageViewer = false
    this.showScheduleViewer = false
    this.showAttendanceModal = false
    this.currentWorkshopImages = []
    this.currentImageIndex = 0
    this.currentImageUrl = ""
  }

  /**
   * Limpia el FormArray de talleres
   */
  private clearWorkshopsArray(): void {
    while (this.workshopsArray.length !== 0) {
      this.workshopsArray.removeAt(0)
    }
  }

  /**
   * Cierra el modal principal
   */
  closeModal(): void {
    this.close.emit()
    this.resetModal()
  }

  // ===== FORM MANAGEMENT =====

  /**
   * Crea el formulario reactivo principal
   */
  private createReportForm(): FormGroup {
    return this.fb.group({
      id: [null],
      year: [null, [Validators.required, yearValidator()]],
      trimester: [null, Validators.required],
      description: ["", Validators.required],
      schedule: [""],
      workshops: this.fb.array([]),
    })
  }

  /**
   * Getter para acceder al FormArray de talleres
   */
  get workshopsArray(): FormArray {
    return this.reportForm.get("workshops") as FormArray
  }

  /**
   * Crea un FormGroup para un taller individual
   */
  private createWorkshopFormGroup(workshop: ReportWorkshopDto | null = null): FormGroup {
    return this.fb.group(
      {
        workshopId: [workshop?.workshopId ?? null],
        workshopName: [workshop?.workshopName ?? "", Validators.required],
        description: [workshop?.description ?? ""],
        workshopDateStart: [workshop?.workshopDateStart ?? "", Validators.required],
        workshopDateEnd: [workshop?.workshopDateEnd ?? "", Validators.required],
        imageUrl: [workshop?.imageUrl ?? []],
      },
      { validators: dateRangeValidator() },
    )
  }

  /**
   * Configura las suscripciones del formulario para validación en tiempo real
   */
  private setupFormSubscriptions(): void {
    this.reportForm.get("year")?.valueChanges.subscribe(() => {
      this.handleYearOrTrimesterChange()
    })

    this.reportForm.get("trimester")?.valueChanges.subscribe(() => {
      this.handleYearOrTrimesterChange()
    })
  }

  /**
   * Maneja cambios en año o trimestre
   */
  private handleYearOrTrimesterChange(): void {
    const year = this.reportForm.get("year")?.value
    const trimester = this.reportForm.get("trimester")?.value

    this.isDuplicateReport = false

    if (year && trimester) {
      const yearControl = this.reportForm.get("year")
      if (yearControl?.valid) {
        this.duplicateCheckSubject.next({ year: Number(year), trimester })
      }
    }

    this.updateWorkshopDates()
  }

  // ===== WORKSHOP MANAGEMENT =====

  /**
   * Carga la lista de talleres disponibles desde el cache
   */
  private loadWorkshops(): void {
    this.reportService.listWorkshopCache("A").subscribe((data) => {
      this.allWorkshops = data
    })
  }

  /**
   * Agrega un nuevo taller al formulario
   */
  addWorkshop(): void {
    const newWorkshopIndex = this.workshopsArray.length

    this.workshopsArray.push(this.createWorkshopFormGroup())
    this.workshopImages.push([])
    this.workshopSuggestions.push([])
    this.showSuggestions.push(false)

    this.scrollToNewWorkshop()
  }

  /**
   * Hace scroll suave al último taller agregado
   */
  private scrollToNewWorkshop(): void {
    setTimeout(() => {
      const items = document.querySelectorAll(".workshop-item")
      if (items.length) {
        items[items.length - 1].scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 100)
  }

  /**
   * Elimina un taller del formulario con confirmación
   */
  removeWorkshop(index: number): void {
    Swal.fire({
      title: "¿Está seguro?",
      text: "¿Desea eliminar este taller?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        this.performWorkshopRemoval(index)
      }
    })
  }

  /**
   * Ejecuta la eliminación del taller
   */
  private performWorkshopRemoval(index: number): void {
    this.workshopsArray.removeAt(index)
    this.workshopImages.splice(index, 1)
    this.workshopSuggestions.splice(index, 1)
    this.showSuggestions.splice(index, 1)

    if (this.previousImageUrls[index]) {
      this.previousImageUrls.splice(index, 1)
    }

    if (this.storedAttendanceSummaries[index]) {
      delete this.storedAttendanceSummaries[index]
    }

    // Limpiar estado de procesamiento
    if (this.isProcessingImages[index]) {
      delete this.isProcessingImages[index]
    }
  }

  // ===== WORKSHOP AUTOCOMPLETE SYSTEM =====

  /**
   * Maneja la entrada de texto para mostrar sugerencias de autocompletado
   */
  onWorkshopNameInput(index: number): void {
    const inputValue = this.workshopsArray.at(index).get("workshopName")?.value || ""

    if (inputValue.trim() === "") {
      this.workshopSuggestions[index] = []
      this.showSuggestions[index] = false
      return
    }

    const matches = this.allWorkshops.filter((workshop) =>
      workshop.name.toLowerCase().includes(inputValue.toLowerCase()),
    )

    this.workshopSuggestions[index] = matches
    this.showSuggestions[index] = matches.length > 0
  }

  /**
   * Oculta las sugerencias con un pequeño delay para permitir clicks
   */
  hideAutocompleteDelayed(index: number): void {
    setTimeout(() => {
      this.showSuggestions[index] = false
    }, 200)
  }

  /**
   * Selecciona una sugerencia del autocompletado
   */
  selectWorkshopSuggestion(index: number, workshop: WorkshopKafkaEventDto): void {
    const group = this.workshopsArray.at(index) as FormGroup

    group.patchValue({
      workshopName: workshop.name,
      workshopId: workshop.id,
      workshopDateStart: workshop.startDate,
      workshopDateEnd: workshop.endDate,
    })

    this.disableWorkshopDates(group)
    this.workshopSuggestions[index] = []
    this.showSuggestions[index] = false
  }

  /**
   * Deshabilita los campos de fecha para talleres existentes
   */
  private disableWorkshopDates(group: FormGroup): void {
    group.get("workshopDateStart")?.disable()
    group.get("workshopDateEnd")?.disable()
  }

  /**
   * Habilita los campos de fecha para talleres manuales
   */
  private enableWorkshopDates(group: FormGroup): void {
    group.get("workshopDateStart")?.enable()
    group.get("workshopDateEnd")?.enable()
  }

  /**
   * Maneja el evento blur del nombre del taller
   */
  onWorkshopNameBlur(index: number): void {
    const group = this.workshopsArray.at(index) as FormGroup
    const currentName = group.get("workshopName")?.value

    if (!currentName) return

    const selectedWorkshop = this.findWorkshopByName(currentName)

    if (selectedWorkshop) {
      this.setupExistingWorkshop(group, selectedWorkshop)
    } else {
      this.setupManualWorkshop(group)
    }
  }

  /**
   * Busca un taller por nombre exacto
   */
  private findWorkshopByName(name: string): WorkshopKafkaEventDto | undefined {
    return this.allWorkshops.find((workshop) => workshop.name.toLowerCase() === name.toLowerCase())
  }

  /**
   * Configura un taller existente seleccionado
   */
  private setupExistingWorkshop(group: FormGroup, workshop: WorkshopKafkaEventDto): void {
    group.patchValue({
      workshopId: workshop.id,
      workshopDateStart: workshop.startDate,
      workshopDateEnd: workshop.endDate,
    })
    this.disableWorkshopDates(group)
  }

  /**
   * Configura un taller manual (nuevo)
   */
  private setupManualWorkshop(group: FormGroup): void {
    group.patchValue({ workshopId: null })
    this.enableWorkshopDates(group)
  }

  /**
   * Valida las fechas de un taller específico
   */
  validateWorkshopDatesQuick(index: number): void {
    const workshopForm = this.workshopsArray.at(index) as FormGroup
    workshopForm.updateValueAndValidity()
  }

  // ===== SCHEDULE VIEWER HANDLERS - ACTUALIZADO CON COMPRESIÓN =====

  /**
   * Maneja la selección de archivo del cronograma con compresión automática
   */
  async onScheduleFileSelected(file: File): Promise<void> {
    try {
      this.isProcessingSchedule = true

      // Comprimir la imagen del cronograma
      const processedImage = await this.imageProcessingService.processImage(file)

      this.scheduleFile = processedImage.file
      this.scheduleFileName = processedImage.name
      this.schedulePreview = processedImage.preview

      console.log(`✅ Cronograma comprimido: ${file.name} -> ${processedImage.name}`)
      console.log(`📊 Tamaño original: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`📊 Tamaño comprimido: ${(processedImage.file.size / 1024 / 1024).toFixed(2)} MB`)

    } catch (error) {
      console.error("❌ Error al comprimir cronograma:", error)

      // En caso de error, usar el archivo original
      this.scheduleFile = file
      this.scheduleFileName = file.name
      this.schedulePreview = URL.createObjectURL(file)

      Swal.fire({
        title: "Advertencia",
        text: "No se pudo comprimir el cronograma. Se usará el archivo original.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      })
    } finally {
      this.isProcessingSchedule = false
    }
  }

  /**
   * Maneja el toggle del visor de cronograma
   */
  onScheduleViewerToggle(show: boolean): void {
    this.showScheduleViewer = show
  }

  // ===== IMAGE VIEWER HANDLERS - ACTUALIZADO CON COMPRESIÓN =====

  /**
   * Maneja la selección de archivos de imagen con compresión automática
   */
  async onImageFilesSelected(files: FileList, workshopIndex: number): Promise<void> {
    this.ensureWorkshopImagesArray(workshopIndex)

    // Activar estado de procesamiento
    this.isProcessingImages[workshopIndex] = true

    try {
      // Limpiar imágenes anteriores
      this.workshopImages[workshopIndex] = []

      // Filtrar solo archivos de imagen
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

      if (imageFiles.length === 0) {
        Swal.fire({
          title: "Sin imágenes",
          text: "No se encontraron archivos de imagen válidos.",
          icon: "warning",
          confirmButtonText: "Aceptar",
        })
        return
      }

      console.log(`🔄 Procesando ${imageFiles.length} imágenes para el taller #${workshopIndex + 1}...`)

      // Procesar todas las imágenes con compresión
      const processedImages = await this.imageProcessingService.processMultipleImages(imageFiles)

      // Convertir a formato ImageUrl
      const imageUrls: ImageUrl[] = processedImages.map(processed => ({
        file: processed.file,
        name: processed.name,
        preview: processed.preview,
      }))

      this.workshopImages[workshopIndex] = imageUrls

      console.log(`✅ ${processedImages.length} imágenes procesadas exitosamente`)

      // Mostrar resumen de compresión
      const originalSizes = imageFiles.map(f => f.size)
      const compressedSizes = processedImages.map(p => p.file.size)
      const totalOriginal = originalSizes.reduce((sum, size) => sum + size, 0)
      const totalCompressed = compressedSizes.reduce((sum, size) => sum + size, 0)
      const compressionRatio = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1)

      console.log(`📊 Compresión total: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB -> ${(totalCompressed / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% reducción)`)

    } catch (error) {
      console.error("❌ Error al procesar imágenes:", error)

      Swal.fire({
        title: "Error",
        text: "Ocurrió un error al procesar las imágenes. Inténtelo nuevamente.",
        icon: "error",
        confirmButtonText: "Aceptar",
      })
    } finally {
      this.isProcessingImages[workshopIndex] = false
    }
  }

  /**
   * Maneja la eliminación de una imagen
   */
  onImageRemoved(imageIndex: number, workshopIndex: number): void {
    this.workshopImages[workshopIndex].splice(imageIndex, 1)
  }

  /**
   * Maneja el toggle del visor de imágenes (CORREGIDO: Modal independiente)
   */
  onImageViewerToggle(show: boolean): void {
    this.showImageViewer = show
  }

  /**
   * Maneja el cambio de índice de imagen
   */
  onImageIndexChanged(index: number): void {
    this.currentImageIndex = index
    this.currentImageUrl = this.currentWorkshopImages[index]?.preview || ""
  }

  /**
   * Abre el visor de imágenes para un taller específico (CORREGIDO)
   */
  openImageViewer(workshopIndex: number, imageIndex: number): void {
    this.currentWorkshopImages = [...this.workshopImages[workshopIndex]] // Copia para evitar referencias
    this.currentImageIndex = imageIndex
    this.currentImageUrl = this.currentWorkshopImages[imageIndex].preview
    this.showImageViewer = true
  }

  /**
   * Asegura que existe el array de imágenes para el taller
   */
  private ensureWorkshopImagesArray(workshopIndex: number): void {
    if (!this.workshopImages[workshopIndex]) {
      this.workshopImages[workshopIndex] = []
    }
  }

  /**
   * Verifica si se están procesando imágenes para un taller específico
   */
  isProcessingImagesForWorkshop(workshopIndex: number): boolean {
    return this.isProcessingImages[workshopIndex] || false
  }

  // ===== ATTENDANCE SUMMARY HANDLERS =====

  /**
   * Verifica si debe mostrar el botón de resumen de asistencia
   */
  shouldShowAttendanceButton(index: number): boolean {
    const workshop = this.workshopsArray.at(index) as FormGroup
    const workshopId = workshop.get("workshopId")?.value

    if (this.isEditMode) {
      return this.storedAttendanceSummaries[index]?.length > 0 || (workshopId !== null && workshopId !== undefined)
    } else {
      return workshopId !== null && workshopId !== undefined
    }
  }

  /**
   * Abre el modal de resumen de asistencia
   */
  async openAttendanceSummary(index: number): Promise<void> {
    const workshop = this.workshopsArray.at(index) as FormGroup
    const workshopId = workshop.get("workshopId")?.value
    const workshopName = workshop.get("workshopName")?.value

    this.currentWorkshopName = workshopName
    this.isLoadingAttendance[index] = true

    try {
      let summaryData: AttendanceSummary[] = []

      if (this.isEditMode && this.storedAttendanceSummaries[index]?.length > 0) {
        summaryData = this.storedAttendanceSummaries[index].map((item) => ({
          fullName: item.personName,
          attendances: item.presentCount,
          absences: item.absentCount,
          tardiness: item.lateCount,
          justifications: item.justifiedCount,
        }))
      } else if (workshopId) {
        const summary = await this.reportService.getPreviewAttendanceSummary(workshopId).toPromise()
        summaryData = (summary || []).map((item) => ({
          fullName: item.personName,
          attendances: item.presentCount,
          absences: item.absentCount,
          tardiness: item.lateCount,
          justifications: item.justifiedCount,
        }))
      }

      this.attendanceSummary = summaryData
      this.showAttendanceModal = true
    } catch (error) {
      console.error("Error al cargar resumen de asistencia:", error)
      Swal.fire({
        title: "Error",
        text: "No se pudo cargar el resumen de asistencia.",
        icon: "error",
        confirmButtonText: "Aceptar",
      })
    } finally {
      this.isLoadingAttendance[index] = false
    }
  }

  /**
   * Cierra el modal de resumen de asistencia
   */
  onAttendanceModalClose(): void {
    this.showAttendanceModal = false
    this.attendanceSummary = []
    this.currentWorkshopName = ""

    Object.keys(this.isLoadingAttendance).forEach((key) => {
      this.isLoadingAttendance[Number(key)] = false
    })
  }

  // ===== DUPLICATE VALIDATION SYSTEM =====

  /**
   * Configura la validación de duplicidad con debounce
   */
  private setupDuplicateValidation(): void {
    this.duplicateCheckSubject
      .pipe(
        debounceTime(800),
        distinctUntilChanged((prev, curr) => prev.year === curr.year && prev.trimester === curr.trimester),
      )
      .subscribe(({ year, trimester }) => {
        this.checkDuplicateReport(year, trimester)
      })
  }

  /**
   * Verifica si existe un reporte duplicado
   */
  private async checkDuplicateReport(year: number, trimester: string): Promise<void> {
    if (this.isEditMode && this.reportData) {
      const currentReport = "report" in this.reportData ? this.reportData.report : this.reportData
      if (currentReport.year === year && currentReport.trimester === trimester) {
        this.isDuplicateReport = false
        return
      }
    }

    this.isCheckingDuplicate = true

    try {
      const exists = await this.reportService.checkReportExists(year, trimester).toPromise()
      this.isDuplicateReport = exists === true
    } catch (error) {
      console.error("Error al verificar duplicidad:", error)
      this.isDuplicateReport = false
    } finally {
      this.isCheckingDuplicate = false
    }
  }

  // ===== FORM POPULATION (EDIT MODE) =====

  /**
   * Puebla el formulario con datos existentes para modo edición
   */
  async populateForm(reportDataInput: ReportWithWorkshopsDto | ReportDto): Promise<void> {
    this.isEditMode = true

    const { report, workshops } = this.extractReportData(reportDataInput)

    this.storePreviousUrls(report)
    const descriptionContent = await this.loadDescriptionContent(report.descriptionUrl)
    this.populateMainForm(report, descriptionContent)
    this.setupExistingSchedule(report.scheduleUrl)
    this.populateWorkshopsWithAttendance(workshops)
  }

  /**
   * Extrae datos del reporte según el tipo de entrada
   */
  private extractReportData(reportDataInput: ReportWithWorkshopsDto | ReportDto): {
    report: ReportDto
    workshops: ReportWorkshopDto[]
  } {
    if ("report" in reportDataInput) {
      return {
        report: reportDataInput.report,
        workshops: reportDataInput.workshops || [],
      }
    } else {
      return {
        report: reportDataInput,
        workshops: [],
      }
    }
  }

  /**
   * Almacena URLs anteriores para eliminar en caso de edición
   */
  private storePreviousUrls(report: ReportDto): void {
    this.previousScheduleUrl = report.scheduleUrl || ""
    this.previousDescriptionUrl = report.descriptionUrl || ""
  }

  /**
   * Puebla el formulario principal con datos del reporte
   */
  private populateMainForm(report: ReportDto, descriptionContent: string): void {
    this.reportForm.patchValue({
      id: report.id,
      year: report.year,
      trimester: report.trimester,
      description: descriptionContent,
      schedule: report.scheduleUrl,
    })
  }

  /**
   * Carga el contenido HTML de la descripción
   */
  private async loadDescriptionContent(descriptionUrl?: string): Promise<string> {
    if (!descriptionUrl || descriptionUrl.trim() === "") {
      return ""
    }

    try {
      this.isLoadingDescription = true
      const response = await fetch(descriptionUrl)
      if (response.ok) {
        return await response.text()
      }
      return ""
    } catch (error) {
      console.error("Error al cargar contenido HTML:", error)
      return ""
    } finally {
      this.isLoadingDescription = false
    }
  }

  /**
   * Configura el cronograma existente para visualización
   */
  private setupExistingSchedule(scheduleUrl?: string): void {
    if (scheduleUrl) {
      this.scheduleFileName = "Cronograma existente.jpg"
      this.schedulePreview = getImagePreview(scheduleUrl)
    }
  }

  /**
   * Puebla los talleres y almacena los resúmenes de asistencia existentes
   */
  private populateWorkshopsWithAttendance(workshops: ReportWorkshopDto[]): void {
    this.workshopsArray.clear()
    this.workshopImages = []
    this.previousImageUrls = []
    this.storedAttendanceSummaries = {}

    workshops.forEach((workshop, index) => {
      this.workshopsArray.push(this.createWorkshopFormGroup(workshop))
      this.populateWorkshopImages(workshop, index)

      if (workshop.attendanceSummaries && workshop.attendanceSummaries.length > 0) {
        this.storedAttendanceSummaries[index] = workshop.attendanceSummaries
      }
    })
  }

  /**
   * Puebla las imágenes de un taller específico
   */
  private populateWorkshopImages(workshop: ReportWorkshopDto, index: number): void {
    this.workshopImages[index] = []
    this.previousImageUrls[index] = workshop.imageUrl || []

    if (workshop.imageUrl?.length > 0) {
      workshop.imageUrl.forEach((url: string, imgIndex: number) => {
        this.workshopImages[index].push({
          file: null,
          preview: getImagePreview(url),
          name: `Imagen ${imgIndex + 1}`,
        })
      })
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Formatea una fecha para mostrar en formato legible
   */
  formatDate(dateString: string): string {
    return formatDate(dateString)
  }

  /**
   * Actualiza las fechas de los talleres según el trimestre seleccionado
   */
  private updateWorkshopDates(): void {
    // Implementación simplificada
    const year = this.reportForm.get("year")?.value
    const trimester = this.reportForm.get("trimester")?.value

    if (!year || !trimester) return
    // Lógica de actualización de fechas...
  }

  /**
   * Verifica si debe mostrar el campo de cronograma
   */
  shouldShowSchedule(): boolean {
    return this.reportForm.get("trimester")?.value === "Enero-Marzo"
  }

  /**
   * Obtiene el mensaje de error apropiado para el campo año
   */
  getYearErrorMessage(): string {
    const yearControl = this.reportForm.get("year")
    if (!yearControl?.errors || !yearControl.touched) return ""

    const errors = yearControl.errors
    if (errors["required"]) return "El año es requerido"
    if (errors["invalidYear"]) return "Por favor ingrese un año válido"
    if (errors["yearTooOld"]) return "El año debe ser mayor o igual a 2020"
    if (errors["yearTooFuture"]) return "El año no puede ser mayor al año actual + 1"
    if (errors["duplicate"]) return "Ya existe un reporte para este año y trimestre"

    return ""
  }

  // ===== SAVE REPORT SYSTEM =====

  /**
   * Método principal para guardar o actualizar el reporte
   */
  async saveReport(): Promise<void> {
    if (!this.validateForm()) return
    if (!this.validateWorkshopImages()) return

    this.isSubmitting = true
    this.showSaveLoader()

    try {
      const formValue = this.reportForm.value

      // Subir descripción como archivo HTML
      const descriptionUrl = await this.uploadDescriptionAsHtml(formValue.description)
      if (!descriptionUrl) {
        throw new Error("Error al subir la descripción")
      }

      // Subir cronograma si hay uno nuevo
      const scheduleUrl = await this.uploadScheduleIfNeeded(formValue.schedule)

      // Procesar talleres e imágenes
      const workshops = await this.processWorkshopsForSave()

      // Crear payload del reporte
      const reportPayload: ReportWithWorkshopsDto = {
        report: {
          id: formValue.id,
          year: Number.parseInt(formValue.year),
          trimester: formValue.trimester,
          descriptionUrl: descriptionUrl,
          scheduleUrl: scheduleUrl,
          status: "A",
        },
        workshops,
      }

      // Guardar reporte
      await this.saveReportToService(reportPayload)
    } catch (error) {
      this.handleSaveError(error)
    }
  }

  /**
   * Valida el formulario principal
   */
  private validateForm(): boolean {
    if (this.reportForm.invalid) {
      Swal.fire({
        title: "Formulario incompleto",
        text: "Por favor complete todos los campos requeridos",
        icon: "warning",
        confirmButtonText: "Aceptar",
      })
      return false
    }
    return true
  }

  /**
   * Valida que todos los talleres tengan al menos una imagen
   */
  private validateWorkshopImages(): boolean {
    for (let i = 0; i < this.workshopsArray.length; i++) {
      if (!this.workshopImages[i] || this.workshopImages[i].length === 0) {
        Swal.fire({
          title: "Error de validación",
          text: `El taller #${i + 1} debe tener al menos una imagen`,
          icon: "error",
          confirmButtonText: "Aceptar",
        })
        return false
      }
    }
    return true
  }

  /**
   * Sube la descripción como archivo HTML a Supabase
   */
  private async uploadDescriptionAsHtml(htmlContent: string): Promise<string | null> {
    try {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" })
      const fileName = `description_${Date.now()}.html`
      const htmlFile = new File([htmlBlob], fileName, { type: "text/html" })

      return await this.supabaseService.uploadImage(htmlFile, "reports/html")
    } catch (error) {
      console.error("Error al subir descripción HTML:", error)
      return null
    }
  }

  /**
   * Sube el cronograma si es necesario (ya comprimido)
   */
  private async uploadScheduleIfNeeded(currentScheduleUrl: string): Promise<string> {
    if (this.scheduleFile) {
      const uploaded = await this.supabaseService.uploadImage(this.scheduleFile, "reports/schedules")
      return uploaded || currentScheduleUrl
    }
    return currentScheduleUrl
  }

  /**
   * Procesa los talleres para el guardado (imágenes ya comprimidas)
   */
  private async processWorkshopsForSave(): Promise<ReportWorkshopDto[]> {
    const workshops: ReportWorkshopDto[] = []

    for (let i = 0; i < this.workshopsArray.length; i++) {
      const group = this.workshopsArray.at(i) as FormGroup
      const images = this.workshopImages[i]

      const urls: string[] = []
      for (const img of images) {
        if (img.file) {
          // Las imágenes ya están comprimidas, solo subirlas
          const url = await this.supabaseService.uploadImage(img.file, "reports/workshops")
          if (url) urls.push(url)
        } else {
          urls.push(img.preview)
        }
      }

      workshops.push({
        ...group.value,
        imageUrl: urls,
      })
    }

    return workshops
  }

  /**
   * Guarda el reporte usando el servicio apropiado
   */
  private async saveReportToService(reportPayload: ReportWithWorkshopsDto): Promise<void> {
    const save$ = this.isEditMode
      ? this.reportService.updateReportById(reportPayload.report.id, reportPayload)
      : this.reportService.createReport(reportPayload)

    save$.subscribe(
      (result) => {
        this.handleSaveSuccess(result)
      },
      (error) => {
        this.handleSaveServiceError(error)
      },
    )
  }

  /**
   * Maneja el éxito del guardado
   */
  private handleSaveSuccess(result: ReportWithWorkshopsDto): void {
    this.isSubmitting = false
    Swal.fire({
      title: this.isEditMode ? "¡Reporte editado!" : "¡Guardado correctamente!",
      icon: "success",
      confirmButtonText: "Aceptar",
    })
    this.saved.emit(result)
    this.closeModal()
  }

  /**
   * Maneja errores del servicio de guardado
   */
  private handleSaveServiceError(error: any): void {
    this.isSubmitting = false
    console.error("Error al guardar:", error)
    Swal.fire({
      title: "Error",
      text: "Ocurrió un error al guardar el reporte.",
      icon: "error",
      confirmButtonText: "Aceptar",
    })
  }

  /**
   * Maneja errores generales del guardado
   */
  private handleSaveError(error: any): void {
    this.isSubmitting = false
    console.error("Error inesperado:", error)
    Swal.fire({
      title: "Error",
      text: "Ocurrió un error inesperado.",
      icon: "error",
      confirmButtonText: "Aceptar",
    })
  }

  /**
   * Muestra loader durante guardado
   */
  private showSaveLoader(): void {
    Swal.fire({
      title: this.isEditMode ? "Editando reporte..." : "Guardando reporte...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      },
    })
  }
}