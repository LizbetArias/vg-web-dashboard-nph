import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Swal from 'sweetalert2';

// Services
import { ReportService } from '../../../../services/report.service';
import { ActivityService } from '../../../../services/ui/activity.service';
import { AuthService } from '../../../../auth/services/auth.service';

// Interfaces
import { ReportDto, ReportWorkshopDto, ReportWithWorkshopsDto } from '../../../../interfaces/report.interface';

// Componentes modulares
import { ReportModalComponent } from './report-modal/report-modal.component';
import { ReportViewerModalComponent } from './report-viewer-modal/report-viewer-modal.component';
import { DescriptionModalComponent } from './components/description-modal/description-modal.component';
import { WorkshopsModalComponent } from './components/workshops-modal/workshops-modal.component';
import { ImageViewerModalComponent } from './viewers/image-viewer-modal/image-viewer-modal.component';
import { AttendanceSummaryModalComponent } from './components/attendance-summary-modal/attendance-summary-modal.component';

/**
 * Componente principal de reportes - REFACTORIZADO Y REDUCIDO
 * Utiliza componentes modulares para cada funcionalidad específica
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ReportModalComponent,
    ReportViewerModalComponent,
    DescriptionModalComponent,
    WorkshopsModalComponent,
    ImageViewerModalComponent,
    AttendanceSummaryModalComponent
  ],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  // ===== DATOS PRINCIPALES =====
  reports: (ReportDto | ReportWithWorkshopsDto)[] = [];
  filteredReports: (ReportDto | ReportWithWorkshopsDto)[] = [];
  pagedReports: (ReportDto | ReportWithWorkshopsDto)[] = [];
  years: number[] = [];

  // ===== FILTROS =====
  selectedTrimester = '';
  selectedYear = '';
  workshopDateStart = '';
  workshopDateEnd = '';
  activeFilter: 'active' | 'inactive' = 'active';

  // ===== PAGINACIÓN =====
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;
  Math = Math;

  // ===== ESTADOS DE CARGA =====
  isLoading = false;
  isFilterLoading = false;
  isTableAnimating = false;
  showFilters = true;

  // ===== MODALES PRINCIPALES =====
  showReportForm = false;
  showReportViewer = false;
  selectedReport: ReportDto | ReportWithWorkshopsDto | null = null;

  // ===== MODAL DE DESCRIPCIÓN =====
  showDescriptionModal = false;
  isLoadingDescription = false;
  descriptionHtml: SafeHtml = '';

  // ===== MODAL DE TALLERES =====
  showWorkshopViewer = false;
  currentWorkshops: ReportWorkshopDto[] = [];
  currentWorkshopIndex = 0;

  // ===== MODAL DE IMÁGENES =====
  showImageViewer = false;
  currentImages: string[] = [];
  currentImageIndex = 0;

  // ===== MODAL DE ASISTENCIA =====
  showAttendanceModal = false;
  attendanceSummary: any[] = [];
  currentWorkshopName = '';
  isLoadingAttendance = false;

  // ===== PERMISOS =====
  userRole: string | null = null;
  isAdmin = false;
  isUser = false;

  constructor(
    private reportService: ReportService,
    private sanitizer: DomSanitizer,
    private activityService: ActivityService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.checkUserPermissions();
    this.loadReports();
  }

  // ===== GESTIÓN DE PERMISOS =====
  private checkUserPermissions(): void {
    this.userRole = this.authService.getRole();
    this.isAdmin = this.authService.isAdminSync();
    this.isUser = this.authService.isUserSync();
  }

  private canPerformWriteOperation(): boolean {
    return this.authService.canWrite();
  }

  private showPermissionDeniedAlert(): void {
    Swal.fire({
      title: '⚠️ Acceso Restringido',
      text: 'No puedes realizar esta función. Estás en modo usuario, solo puedes ver la información.',
      icon: 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#f59e0b'
    });
  }

  get canShowWriteButtons(): boolean {
    return this.canPerformWriteOperation();
  }

  // ===== VERIFICACIÓN DE ESTADO =====
  isActiveReport(reportData: ReportDto | ReportWithWorkshopsDto): boolean {
    const status = this.getReportStatus(reportData);
    return status === 'A';
  }

  isInactiveReport(reportData: ReportDto | ReportWithWorkshopsDto): boolean {
    const status = this.getReportStatus(reportData);
    return status === 'I';
  }

  // ===== CARGA Y FILTRADO DE DATOS =====
  loadReports(): void {
    this.isLoading = true;
    this.isTableAnimating = true;

    this.reportService.listReportsByFilter().subscribe(
      (data) => {
        setTimeout(() => {
          this.reports = data;
          this.extractYearsFromReports();
          this.filterReports();
          this.isLoading = false;
          this.isTableAnimating = false;
        }, 300);
      },
      (error) => {
        this.isLoading = false;
        this.isTableAnimating = false;
        this.showErrorToast('No se pudieron cargar los reportes');
      }
    );
  }

  filterReports(): void {
    this.isFilterLoading = true;
    this.isTableAnimating = true;

    const activeValue = this.activeFilter === 'active' ? 'A' : 'I';
    const yearValue = this.selectedYear ? Number(this.selectedYear) : undefined;

    this.reportService
      .listReportsByFilter(this.selectedTrimester, activeValue, yearValue, this.workshopDateStart, this.workshopDateEnd)
      .subscribe(
        (data) => {
          setTimeout(() => {
            this.filteredReports = data;
            this.totalPages = Math.ceil(this.filteredReports.length / this.pageSize);
            this.currentPage = 1;
            this.updatePagedReports();
            this.isFilterLoading = false;
            this.isTableAnimating = false;
          }, 400);
        },
        (error) => {
          this.isFilterLoading = false;
          this.isTableAnimating = false;
          this.showErrorToast('No se pudieron filtrar los reportes');
        }
      );
  }

  private extractYearsFromReports(): void {
    const uniqueYears = new Set<number>();
    this.reports.forEach((reportData) => {
      const year = 'year' in reportData ? reportData.year : 'report' in reportData ? reportData.report.year : undefined;
      if (year) uniqueYears.add(year);
    });
    this.years = Array.from(uniqueYears).sort((a, b) => b - a);
  }

  // ===== MODAL DE DESCRIPCIÓN =====
  async openDescriptionModal(descriptionUrl: string): Promise<void> {
    if (!descriptionUrl?.trim()) {
      this.showInfoToast('Este reporte no tiene descripción disponible');
      return;
    }

    this.isLoadingDescription = true;
    this.showDescriptionModal = true;
    this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(
      '<div class="text-center py-8"><div class="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Cargando descripción...</p></div>'
    );

    try {
      const response = await fetch(descriptionUrl, {
        method: 'GET',
        headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });

      if (response.ok) {
        const htmlContent = await response.text();
        this.descriptionHtml = htmlContent?.trim()
          ? this.sanitizer.bypassSecurityTrustHtml(htmlContent)
          : this.sanitizer.bypassSecurityTrustHtml('<div class="text-center py-8 text-gray-500"><p>El archivo de descripción está vacío</p></div>');
      } else {
        this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(`
          <div class="text-center py-8 text-red-500">
            <p class="font-medium">Error al cargar la descripción</p>
            <p class="text-sm mt-1">Código de error: ${response.status}</p>
          </div>
        `);
      }
    } catch (error) {
      this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(`
        <div class="text-center py-8 text-red-500">
          <p class="font-medium">Error de conexión</p>
          <p class="text-sm mt-1">No se pudo cargar la descripción</p>
        </div>
      `);
    } finally {
      this.isLoadingDescription = false;
    }
  }

  closeDescriptionModal(): void {
    this.showDescriptionModal = false;
  }

  // ===== MODAL DE TALLERES =====
  viewWorkshops(reportData: any): void {
    const reportId = 'report' in reportData ? reportData.report.id : reportData.id;

    this.showLoadingAlert('Cargando talleres', 'Por favor espere...');

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport) => {
        const workshops = detailedReport.workshops || [];
        this.currentWorkshops = workshops;
        this.currentWorkshopIndex = 0;
        this.showWorkshopViewer = true;
        Swal.close();
      },
      (error) => {
        Swal.fire('Error', 'No se pudieron cargar los detalles de los talleres', 'error');
      }
    );
  }

  closeWorkshopViewer(): void {
    this.showWorkshopViewer = false;
  }

  onWorkshopIndexChanged(index: number): void {
    this.currentWorkshopIndex = index;
  }

  // ===== MODAL DE IMÁGENES =====
  onImageViewerOpen(data: { images: string[], index: number }): void {
    this.currentImages = data.images;
    this.currentImageIndex = data.index;
    this.showImageViewer = true;
  }

  closeImageViewer(): void {
    this.showImageViewer = false;
  }

  onImageIndexChanged(index: number): void {
    this.currentImageIndex = index;
  }

  get currentImageUrl(): string {
    return this.currentImages[this.currentImageIndex] || '';
  }

  // ===== ACCIONES DE REPORTES =====
  viewReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    this.isLoading = true;
    const reportId = 'report' in reportData ? reportData.report.id : reportData.id;

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport: ReportWithWorkshopsDto) => {
        this.selectedReport = detailedReport;
        this.showReportViewer = true;
        this.isLoading = false;
      },
      (error) => {
        this.isLoading = false;
        this.showErrorToast('No se pudieron cargar los detalles del reporte');
      }
    );
  }

  editReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert();
      return;
    }

    this.isLoading = true;
    const reportId = 'report' in reportData ? reportData.report.id : reportData.id;

    this.showLoadingAlert('Cargando datos', 'Por favor espere...');

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport: ReportWithWorkshopsDto) => {
        this.selectedReport = detailedReport;
        this.showReportForm = true;
        this.isLoading = false;
        Swal.close();
      },
      (error) => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudieron cargar los detalles del reporte', 'error');
      }
    );
  }

  createReport(): void {
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert();
      return;
    }
    this.selectedReport = null;
    this.showReportForm = true;
  }

  deleteReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert();
      return;
    }

    const report = 'report' in reportData ? reportData.report : reportData;

    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el reporte del ${report.trimester} ${report.year}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.reportService.deleteReport(report.id).subscribe(
          () => {
            this.logReportActivity('eliminó', reportData);
            this.isLoading = false;
            this.showSuccessToast('El reporte ha sido eliminado correctamente');
            this.filterReports();
          },
          (error) => {
            this.isLoading = false;
            Swal.fire('Error', 'No se pudo eliminar el reporte.', 'error');
          }
        );
      }
    });
  }

  // ===== NUEVAS ACCIONES PARA REPORTES INACTIVOS =====
  restoreReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert();
      return;
    }

    const report = 'report' in reportData ? reportData.report : reportData;

    Swal.fire({
      title: '¿Restaurar reporte?',
      text: `¿Deseas restaurar el reporte del ${report.trimester} ${report.year}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.reportService.restoreReport(report.id).subscribe(
          () => {
            this.logReportActivity('restauró', reportData);
            this.isLoading = false;
            this.showSuccessToast('El reporte ha sido restaurado correctamente');
            this.filterReports();
          },
          (error) => {
            this.isLoading = false;
            Swal.fire('Error', 'No se pudo restaurar el reporte.', 'error');
          }
        );
      }
    });
  }

  deleteReportPermanently(reportData: ReportDto | ReportWithWorkshopsDto): void {
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert();
      return;
    }

    const report = 'report' in reportData ? reportData.report : reportData;

    Swal.fire({
      title: '⚠️ ¡PELIGRO!',
      html: `
        <div class="text-left">
          <p class="mb-3"><strong>¿Estás completamente seguro?</strong></p>
          <p class="mb-3">Esta acción eliminará <strong>PERMANENTEMENTE</strong> el reporte del ${report.trimester} ${report.year}.</p>
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p class="text-red-800 text-sm"><strong>⚠️ Esta acción NO se puede deshacer</strong></p>
            <p class="text-red-700 text-sm">• Se perderán todos los datos del reporte</p>
            <p class="text-red-700 text-sm">• Se eliminarán todas las imágenes asociadas</p>
            <p class="text-red-700 text-sm">• No podrás recuperar esta información</p>
          </div>
          <p class="text-sm text-gray-600">Escribe <strong>"ELIMINAR"</strong> para confirmar:</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'Escribe ELIMINAR para confirmar',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar Permanentemente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      preConfirm: (value) => {
        if (value !== 'ELIMINAR') {
          Swal.showValidationMessage('Debes escribir "ELIMINAR" para confirmar');
          return false;
        }
        return true;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.showLoadingAlert('Eliminando permanentemente...', 'Esta operación puede tardar unos momentos');

        this.reportService.deleteReportPermanently(report.id).subscribe(
          () => {
            this.logReportActivity('eliminó permanentemente', reportData);
            this.isLoading = false;
            Swal.fire({
              title: '¡Eliminado!',
              text: 'El reporte ha sido eliminado permanentemente',
              icon: 'success',
              confirmButtonText: 'Entendido'
            });
            this.filterReports();
          },
          (error) => {
            this.isLoading = false;
            Swal.fire('Error', 'No se pudo eliminar el reporte permanentemente.', 'error');
          }
        );
      }
    });
  }

  // ===== DESCARGAS =====
  downloadPdf(reportData: any): void {
    const reportId = 'report' in reportData ? reportData.report.id : reportData.id;

    this.showLoadingAlert('Generando PDF...', 'Por favor espera un momento');

    this.reportService.downloadReportFile(reportId, 'pdf', this.workshopDateStart, this.workshopDateEnd).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `reporte_${reportId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);

        Swal.close();
        this.showSuccessToast('El PDF se ha descargado correctamente');
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo generar el PDF.', 'error');
      }
    });
  }

  downloadPptx(reportData: any): void {
    const reportId = 'report' in reportData ? reportData.report.id : reportData.id;

    this.showLoadingAlert('Generando PPTX...', 'Por favor espera un momento');

    this.reportService.downloadReportFile(reportId, 'pptx', this.workshopDateStart, this.workshopDateEnd).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `reporte_${reportId}.pptx`;
        a.click();
        window.URL.revokeObjectURL(url);

        Swal.close();
        this.showSuccessToast('El PPTX se ha descargado correctamente');
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo generar el PPTX.', 'error');
      }
    });
  }

  // ===== EVENTOS DE MODALES =====
  closeReportForm(): void {
    this.showReportForm = false;
    this.selectedReport = null;
  }

  closeReportViewer(): void {
    this.showReportViewer = false;
    this.selectedReport = null;
  }

  onReportSaved(report: ReportWithWorkshopsDto): void {
    const isNewReport = !this.selectedReport ||
      ('report' in this.selectedReport ? !this.selectedReport.report?.id : !this.selectedReport.id);

    this.logReportActivity(isNewReport ? 'creó' : 'editó', report);
    this.showSuccessToast('El reporte ha sido guardado correctamente');
    this.filterReports();
  }

  // ===== UTILIDADES =====
  private logReportActivity(action: string, reportData: ReportDto | ReportWithWorkshopsDto): void {
    this.authService.getLoggedUserInfo().subscribe({
      next: (currentUser) => {
        const report = 'report' in reportData ? reportData.report : reportData;
        const activity = {
          imagen: currentUser?.profileImage || '/placeholder.svg?height=40&width=40',
          nombre: `${currentUser?.name || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'Usuario',
          modulo: 'Reportes',
          accion: `${action} el reporte del trimestre ${report.trimester} ${report.year}`
        };
        this.activityService.logActivity(activity);
      },
      error: () => {
        const report = 'report' in reportData ? reportData.report : reportData;
        const activity = {
          imagen: '/placeholder.svg?height=40&width=40',
          nombre: 'Usuario del sistema',
          modulo: 'Reportes',
          accion: `${action} el reporte del trimestre ${report.trimester} ${report.year}`
        };
        this.activityService.logActivity(activity);
      }
    });
  }

  // ===== MÉTODOS DE UTILIDAD PARA TEMPLATES =====
  getSafeReport(report: ReportDto | ReportWithWorkshopsDto): ReportDto {
    return 'report' in report ? report.report : report;
  }

  getReportStatus(report: ReportDto | ReportWithWorkshopsDto): string {
    return 'report' in report ? report.report.status : report.status;
  }

  getWorkshopsCount(report: ReportDto | ReportWithWorkshopsDto): number {
    if ('workshops' in report && report.workshops) return report.workshops.length;
    if ('report' in report && (report as any).report.workshops) return (report as any).report.workshops.length;
    return 0;
  }

  hasWorkshops(report: ReportDto | ReportWithWorkshopsDto): boolean {
    return this.getWorkshopsCount(report) > 0;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // ===== MÉTODOS DE FILTROS Y PAGINACIÓN =====
  clearAllFilters(): void {
    this.selectedTrimester = '';
    this.selectedYear = '';
    this.workshopDateStart = '';
    this.workshopDateEnd = '';
    this.activeFilter = 'active';
    this.loadReports();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  setActiveFilter(filter: 'active' | 'inactive'): void {
    this.activeFilter = filter;
    this.filterReports();
  }

  refreshReports(): void {
    this.filterReports();
  }

  updatePagedReports(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.pagedReports = this.filteredReports.slice(startIndex, endIndex);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedReports();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedReports();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePagedReports();
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const maxVisiblePages = 5;

    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = startPage + maxVisiblePages - 1;

      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
    }

    return pageNumbers;
  }

  // ===== MÉTODOS DE NOTIFICACIÓN =====
  private showSuccessToast(message: string): void {
    Swal.fire({
      title: '¡Éxito!',
      text: message,
      icon: 'success',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  private showErrorToast(message: string): void {
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  private showInfoToast(message: string): void {
    Swal.fire({
      title: 'Sin descripción',
      text: message,
      icon: 'info',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  private showLoadingAlert(title: string, text: string): void {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }
}