import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { WorkshopService } from '../../../../services/workshop.service';
import { Workshop, WorkshopResponseDto } from '../../../../interfaces/workshop';
import { WorkshopModalComponent } from './workshop-modal/workshop-modal.component';
import { PersonaService } from '../../../../services/person.service';
import { AuthService } from '../../../../auth/services/auth.service';
import { ActivityService } from '../../../../services/ui/activity.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkshopModalComponent],
  templateUrl: './workshops.component.html',
  styleUrls: ['./workshops.component.css'],
})
export class WorkshopsComponent implements OnInit {
  workshops: Workshop[] = [];
  filteredWorkshops: Workshop[] = [];
  paginatedWorkshops: Workshop[] = [];
  personList: any[] = []
  isViewModalOpen = false;
  viewedWorkshop: Workshop | null = null;

  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];

  searchTerm = '';
  activeFilter: 'active' | 'inactive' = 'active';
  statusFilter: 'A' | 'I' = 'A';
  startDateFilter: Date | null = null;
  endDateFilter: Date | null = null;


  showStartDateCalendar = false;
  showEndDateCalendar = false;
  currentStartMonth = new Date();
  currentEndMonth = new Date();

  isFormModalOpen = false;
  selectedWorkshop: WorkshopResponseDto | null = null;

  months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // Variables para el control de permisos
  userRole: string | null = null
  isAdmin = false
  isUser = false

  constructor(private workshopService: WorkshopService,
    private personService: PersonaService,
    private authService: AuthService,
    private activityService: ActivityService,
  ) { }

  ngOnInit(): void {
    this.checkUserPermissions()
    this.loadWorkshops();
    this.loadPersons();
    this.getPersons();
  }

  /**
   * 🔒 Verificar permisos del usuario
   */
  private checkUserPermissions(): void {
    this.userRole = this.authService.getRole()
    this.isAdmin = this.authService.isAdminSync()
    this.isUser = this.authService.isUserSync()

    console.log("Rol del usuario:", this.userRole)
    console.log("Es admin:", this.isAdmin)
    console.log("Es user:", this.isUser)
  }

  /**
   * 🚫 Verificar si el usuario puede realizar operaciones de escritura
   */
  private canPerformWriteOperation(): boolean {
    return this.authService.canWrite()
  }

  private logWorkshopActivity(action: string, workshopData: any): void {
  this.authService.getLoggedUserInfo().subscribe({
    next: (currentUser) => {
      const workshop = "workshop" in workshopData ? workshopData.workshop : workshopData;

      const activity = {
        imagen: currentUser?.profileImage || "/placeholder.svg?height=40&width=40",
        nombre: `${currentUser?.name || ""} ${currentUser?.lastName || ""}`.trim() || currentUser?.email || "Usuario",
        modulo: "Talleres",
        accion: `${action} el taller "${workshop.name}" (${workshop.startDate} - ${workshop.endDate})`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada: ${action} taller ${workshop.name}`);
    },
    error: () => {
      const workshop = "workshop" in workshopData ? workshopData.workshop : workshopData;

      const activity = {
        imagen: "/placeholder.svg?height=40&width=40",
        nombre: "Usuario del sistema",
        modulo: "Talleres",
        accion: `${action} el taller "${workshop.name}" (${workshop.startDate} - ${workshop.endDate})`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada (fallback): ${action} taller ${workshop.name}`);
    },
  });
}

  loadPersons() {
    this.personService.getPersons().subscribe(
      (data) => {
        this.personList = data;
        console.log('Personas cargadas:', this.personList); // 👈 Verifica en consola
      },
      (error) => {
        console.error('Error al cargar personas', error);
      }
    );
  }

  getPersonFullNames(personIds: string | number): string {
    if (!personIds) return 'Sin asignar';

    const ids = typeof personIds === 'string'
      ? personIds.split(',').map(id => parseInt(id.trim(), 10))
      : [personIds];

    const names = ids.map(id => {
      const person = this.personList.find(p => p.idPerson === id);
      return person ? `${person.name} ${person.surname}` : null;
    }).filter(name => name !== null);

    return names.length ? names.join(', ') : 'Sin asignar';
  }







  loadWorkshops() {
    this.workshopService.listAll().subscribe(response => {
      this.workshops = response
        .filter(w => w.state === this.statusFilter)
        .map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          dateStart: this.parseDateWithoutTimezone(w.startDate),
          dateEnd: this.parseDateWithoutTimezone(w.endDate),
          observation: w.observation,
          personId: w.personId,
          active: w.state === 'A',
        }));

      this.filteredWorkshops = [...this.workshops];
      this.currentPage = 1;
      this.updatePagination();

      setTimeout(() => {
        this.paginatedWorkshops = this.filteredWorkshops.slice(0, this.itemsPerPage);
      }, 0);
    });
  }

  parseDateWithoutTimezone(dateString: string): Date {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  formatDate(date?: Date): string {
    if (!date || isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = this.months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} / ${month} / ${year}`;
  }

  formatDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredWorkshops.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.goToPage(Math.min(this.currentPage, this.totalPages || 1));
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedWorkshops = this.filteredWorkshops.slice(start, end);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredWorkshops.length);
  }

  toggleActiveStatus(filter: 'active' | 'inactive') {
    this.activeFilter = filter;
    this.statusFilter = filter === 'active' ? 'A' : 'I';
    this.currentPage = 1;
    this.loadWorkshops();
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const term = this.searchTerm.toLowerCase().trim();

    this.filteredWorkshops = this.workshops.filter(w => {
      const matchesText = [w.name, w.description ?? ''].some(text =>
        text.toLowerCase().includes(term)
      );
      const matchesStart = !this.startDateFilter || w.dateStart >= this.startDateFilter!;
      const matchesEnd = !this.endDateFilter || w.dateEnd <= this.endDateFilter!;
      return matchesText && matchesStart && matchesEnd;
    });

    this.updatePagination();
  }

  clearFilters() {
    this.searchTerm = '';
    this.startDateFilter = null;
    this.endDateFilter = null;
    this.loadWorkshops();
  }

  toggleCalendar(type: 'start' | 'end') {
    this.showStartDateCalendar = type === 'start' ? !this.showStartDateCalendar : false;
    this.showEndDateCalendar = type === 'end' ? !this.showEndDateCalendar : false;
  }

  previousMonth(type: 'start' | 'end') {
    const current = type === 'start' ? this.currentStartMonth : this.currentEndMonth;
    const updated = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    type === 'start' ? this.currentStartMonth = updated : this.currentEndMonth = updated;
  }

  nextMonth(type: 'start' | 'end') {
    const current = type === 'start' ? this.currentStartMonth : this.currentEndMonth;
    const updated = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    type === 'start' ? this.currentStartMonth = updated : this.currentEndMonth = updated;
  }

  isSelectedDate(day: number, type: 'start' | 'end'): boolean {
    const selected = type === 'start' ? this.startDateFilter : this.endDateFilter;
    const month = type === 'start' ? this.currentStartMonth : this.currentEndMonth;
    return selected?.getDate() === day &&
      selected?.getMonth() === month.getMonth() &&
      selected?.getFullYear() === month.getFullYear();
  }

  selectDate(day: number, type: 'start' | 'end') {
    const month = type === 'start' ? this.currentStartMonth : this.currentEndMonth;
    const date = new Date(month.getFullYear(), month.getMonth(), day);

    if (type === 'start') {
      this.startDateFilter = date;
      this.showStartDateCalendar = false;
    } else {
      this.endDateFilter = date;
      this.showEndDateCalendar = false;
    }

    this.applyFilters();
  }

  isDateDisabled(day: number, type: 'end' | 'start'): boolean {
    if (type === 'end' && this.startDateFilter) {
      const month = this.currentEndMonth;
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      return date < this.startDateFilter;
    }
    return false;
  }

  generateCalendarDays(month: Date): number[] {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const startIndex = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: startIndex + daysInMonth }, (_, i) => i < startIndex ? 0 : i - startIndex + 1);
  }

  openNewWorkshopModal(): void {
    this.selectedWorkshop = null;
    this.isFormModalOpen = true;
  }

  openEditWorkshopModal(workshop: Workshop): void {
    const workshopResponse: WorkshopResponseDto = {
      id: workshop.id,
      name: workshop.name,
      description: workshop.description,
      startDate: workshop.dateStart.toISOString().split('T')[0],
      endDate: workshop.dateEnd.toISOString().split('T')[0],
      observation: workshop.observation,
      personId: workshop.personId,
      state: workshop.active ? 'A' : 'I'
    };
    this.selectedWorkshop = workshopResponse;
    this.isFormModalOpen = true;
  }

  closeModal(): void {
    this.isFormModalOpen = false;
    this.selectedWorkshop = null;
    this.loadWorkshops();
  }

  openViewModal(workshop: Workshop): void {
    this.viewedWorkshop = workshop;
    this.isViewModalOpen = true;
  }

  closeViewModal(): void {
    this.viewedWorkshop = null;
    this.isViewModalOpen = false;
  }

  openDeleteDialog(workshop: Workshop): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `El taller "${workshop.name}" será movido a inactivos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) {
        this.workshopService.disable(workshop.id).subscribe({
          next: () => {
            Swal.fire('Inactivado', 'El taller fue movido a inactivos.', 'success');
            this.loadWorkshops();
          },
          error: () => Swal.fire('Error', 'No se pudo desactivar el taller.', 'error')
        });
      }
    });
  }

  openPermanentDeleteDialog(workshop: Workshop): void {
    Swal.fire({
      title: '¿Eliminar permanentemente?',
      text: `El taller "${workshop.name}" será eliminado de forma permanente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) {
        this.workshopService.delete(workshop.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'El taller fue eliminado permanentemente.', 'success');
            this.loadWorkshops();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar el taller.', 'error')
        });
      }
    });
  }

  getPersons(): void {
    this.personService.getPersons().subscribe(
      (response) => {
        this.personList = response
      },
      (error) => {
        console.error("Error retrieving persons:", error)
      },
    )
  }

  restoreWorkshop(workshop: Workshop): void {
    Swal.fire({
      title: '¿Restaurar taller?',
      text: `¿Estás seguro de restaurar el taller "${workshop.name}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) {
        this.workshopService.restore(workshop.id).subscribe({
          next: () => {
            Swal.fire('Restaurado', 'El taller ha sido activado nuevamente.', 'success');
            this.loadWorkshops();
          },
          error: () => Swal.fire('Error', 'No se pudo restaurar el taller.', 'error')
        });
      }
    });
  }

  downloadPDFReport(): void {
  const doc = new jsPDF();
  const fecha = new Date().toLocaleDateString();

  // Encabezado
  doc.setFontSize(14);
  doc.text('Talleres Programos NPH', 105, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Empresa: Nuestros Pequeños Hermanos', 105, 18, { align: 'center' });
  doc.text('Área de Bienestar Social', 105, 23, { align: 'center' });
  doc.text(`Fecha de descarga: ${fecha}`, 105, 28, { align: 'center' });

  // Tabla compacta
  autoTable(doc, {
  startY: 40,
  head: [['Nombre', 'Fecha Inicio', 'Fecha Fin', 'Personas', 'Observación']],
  body: this.filteredWorkshops.map(w => [
    w.name,
    this.formatDate(w.dateStart),
    this.formatDate(w.dateEnd),
    this.getPersonFullNames(w.personId),
    w.observation || ''
  ]),
  styles: { fontSize: 9, cellPadding: 2 },
  headStyles: { fillColor: [41, 128, 185], fontSize: 10 },
  columnStyles: {
    0: { cellWidth: 45 },
    1: { cellWidth: 28 },
    2: { cellWidth: 28 },
    3: { cellWidth: 50 },
    4: { cellWidth: 40 },
  },
  margin: { left: 8, right: 8 }
});

  doc.save('talleres_nph.pdf');
}
downloadCSVReport(): void {
  const fecha = new Date().toLocaleDateString();
  let csv = '';
  // Cabecera de columnas
  csv += `"Nombre del Taller","Descripción","Fecha de Inicio","Fecha de Fin","Observaciones","Responsable"\n`;

  // Datos
  this.filteredWorkshops.forEach(w => {
    const nombre = (w.name || '').replace(/"/g, '""');
    const descripcion = (w.description || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
    const fechaInicio = this.formatDate(w.dateStart);
    const fechaFin = this.formatDate(w.dateEnd);
    const observacion = (w.observation || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
    const persona = this.getPersonFullNames(w.personId).replace(/"/g, '""');

    csv += `"${nombre}","${descripcion}","${fechaInicio}","${fechaFin}","${observacion}","${persona}"\n`;
  });

  // Descargar archivo
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'talleres_nph.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

exportToExcel(): void {
  const data = this.filteredWorkshops.map(w => ({
    'Nombre del Taller': w.name,
    'Descripción': w.description || '',
    'Fecha de Inicio': this.formatDate(w.dateStart),
    'Fecha de Fin': this.formatDate(w.dateEnd),
    'Observaciones': w.observation || '',
    'Responsable': this.getPersonFullNames(w.personId)
  }));

  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Talleres');

  XLSX.writeFile(wb, 'talleres_nph.xlsx');
}



}
