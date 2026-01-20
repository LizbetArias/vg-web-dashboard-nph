import { Component, inject, OnInit } from '@angular/core';
import { WorkshopService } from '../../../../services/workshop.service';
import { IssueService } from './../../../../services/issue.service';
import { Issue } from '../../../../interfaces/issue';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssueModalComponent } from './issue-modal/issue-modal.component';
import { finalize } from 'rxjs/operators';
import { ActivityService } from '../../../../services/ui/activity.service';
import { AuthService } from '../../../../auth/services/auth.service';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, FormsModule, IssueModalComponent],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.css'
})
export class IssuesComponent implements OnInit{
  dateError: boolean = false;
  private issueService = inject(IssueService);
  isModalOpen: boolean = false;
  issue: Issue[] = [];
  filteredIssues: Issue[] = [];
  isLoading: boolean = true;
  isActive: boolean = true;
  isEditMode = false;
  workshops: any[] = [];
  items: any[] = [];
  selectedWorkshopName: string = '';
  // Filtros
  nameFilter: string = '';
  descriptionFilter: string = '';
  // Variables para paginación
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalItems: number = 0;

  // Variables para el control de permisos
  userRole: string | null = null
  isAdmin = false
  isUser = false


  editSupplier: Issue | null = null;
  issueForm: Issue = { id: 0, name: '', workshopId: 0, scheduledTime: '', observation: '', state: 'A' };
  openModalForCreate() {
    this.isEditMode = false;
    this.issueForm = {
      id: 0,
      name: '',
      workshopId: 0,
      scheduledTime: '',
      observation: '',
      state: 'A'
    };
    this.isModalOpen = true;
  }
  constructor(
    private workshopService: WorkshopService,
    private activityService: ActivityService,
        private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.checkUserPermissions();
    this.getIssues();
    this.getActiveWorkshops();

    this.items.sort((a, b) => a.name.localeCompare(b.name));
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

  /**
     * ⚠️ Mostrar mensaje de permisos insuficientes
     */
    private showPermissionDeniedAlert(): void {
      Swal.fire({
        title: "⚠️ Acceso Restringido",
        text: "No puedes realizar esta función. Estás en modo usuario, solo puedes ver la información.",
        icon: "warning",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b",
        backdrop: true,
        allowOutsideClick: false,
        customClass: {
          popup: "swal2-popup-custom",
        },
      })
    }

  private logIssueActivity(action: string, issueData: any): void {
  this.authService.getLoggedUserInfo().subscribe({
    next: (currentUser) => {
      const issue = "issue" in issueData ? issueData.issue : issueData;

      const activity = {
        imagen: currentUser?.profileImage || "/placeholder.svg?height=40&width=40",
        nombre: `${currentUser?.name || ""} ${currentUser?.lastName || ""}`.trim() || currentUser?.email || "Usuario",
        modulo: "Incidencias",
        accion: `${action} la incidencia "${issue.title}" (#${issue.id})`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada: ${action} incidencia ${issue.title} (#${issue.id})`);
    },
    error: () => {
      const issue = "issue" in issueData ? issueData.issue : issueData;

      const activity = {
        imagen: "/placeholder.svg?height=40&width=40",
        nombre: "Usuario del sistema",
        modulo: "Incidencias",
        accion: `${action} la incidencia "${issue.title}" (#${issue.id})`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada (fallback): ${action} incidencia ${issue.title} (#${issue.id})`);
    },
  });
}

  getIssues(): void {
    this.isLoading = true;
    this.issueService.getIssues().subscribe({
      next: (data) => {
        this.issue = data;
        const workshopRequests = this.issue.map((issue) =>
          this.workshopService.getWorkshopById(issue.workshopId)
        );
        forkJoin(workshopRequests).subscribe({
          next: (workshops: { name: string | undefined; }[]) => {
            // Asignamos el nombre del taller a cada issue
            this.issue.forEach((issue, index) => {
              issue.workshopName = workshops[index].name;
            });
            this.filterIssues();
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error fetching workshops:', err);
            this.isLoading = false;
          },
        });
      },
      error: (err) => {
        console.error('Error fetching issues:', err);
        this.isLoading = false;
      },
    });
  }

  filterIssues(): void {
    this.filteredIssues = this.issue.filter(issue => {
      const matchesStatus = issue.state === (this.isActive ? 'A' : 'I'); // Filtrar por estado
      const matchesName = issue.name
        .toLowerCase()
        .includes(this.nameFilter.toLowerCase()); // Filtrar por nombre del tema
      const matchesWorkshop =
        this.selectedWorkshopName === '' || issue.workshopName === this.selectedWorkshopName; // Filtrar por nombre del taller

      return matchesStatus && matchesName && matchesWorkshop;
    });
  }

  // Cambiar el estado del switcher y actualizar la lista filtrada
  toggleStatus(): void {
    this.filterIssues(); // Refrescar la lista filtrada
  }

  activateIssue(id: number | undefined): void {
    if (id !== undefined) {
      this.issueService.activateIssue(id).subscribe({
        next: () => {
          this.getIssues();
        },
        error: (err) => {
          console.error('Error activating supplier:', err);
        }
      });
    } else {
      console.error('Invalid supplier ID');
    }
  }

  inactivateIssue(id: number | undefined): void {
    if (id !== undefined) {
      Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción desactivará el tema.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.issueService.deactivateIssue(id).subscribe({
            next: () => {
              this.getIssues(); // Refrescar la lista
              Swal.fire({
                title: 'Éxito',
                text: 'El tema ha sido desactivado correctamente.',
                icon: 'success',
                confirmButtonText: 'Aceptar',
              });
            },
            error: (err) => {
              console.error('Error inactivating issue:', err);
              Swal.fire({
                title: 'Error',
                text: 'Hubo un problema al desactivar el tema.',
                icon: 'error',
                confirmButtonText: 'Aceptar',
              });
            },
          });
        }
      });
    } else {
      console.error('Invalid issue ID');
    }
  }


  openModal(): void {
    this.isEditMode = false;
    this.issueForm = { id: 0, name: '', workshopId: 0, scheduledTime: this.getCurrentDateTime(), observation: '', state: 'A' };
    this.isModalOpen = true;
  }

  editSupplierDetails(issue: Issue): void {
    this.isEditMode = true;
    this.issueForm = { ...issue };
    this.isModalOpen = true;
    console.log(this.issueForm.workshopId);
  }

  // Cerrar el modal
  closeModal(): void {
    this.isModalOpen = false;
  }


  addIssue(): void {
  if (this.issueForm.id === 0) {
    this.issueForm.id = undefined;
  }

  this.issueService.createIssue(this.issueForm).pipe(
    finalize(() => {
      this.closeModal();
    })
  ).subscribe({
    next: () => {
      Swal.fire({
        title: 'Éxito',
        text: 'El tema ha sido agregado correctamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
      }).then(() => {
        this.getIssues();
      });
    },
    error: (err: any) => {
      console.error('Error adding supplier:', err);
      Swal.fire({
        title: 'Error',
        text: 'Hubo un problema al agregar el tema.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
      });
    }
  });
}


  updateSupplier(): void {
  if (this.issueForm.id) {
    this.issueService.updateIssue(this.issueForm.id, this.issueForm).subscribe({
      next: () => {
        this.closeModal();
        Swal.fire({
          title: '¡Éxito!',
          text: 'El tema se actualizó correctamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
        }).then(() => {
          this.getIssues();
        });
      },
      error: (err) => {
        console.error('Error updating sesión:', err);
        Swal.fire({
          title: 'Error',
          text: 'Hubo un problema al actualizar el tema.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
        });
      }
    });
  }
}

  getActiveWorkshops(): void {
    this.workshopService.getActiveWorkshops().subscribe({
      next: (data) => {
        this.workshops = data;
        console.log(this.workshops);
      },
      error: (err) => {
        console.error('Error fetching workshops:', err);
      },
    });
  }



  exportToPDFGrouped(): void {
  const doc = new jsPDF();
  const groupedIssues = this.groupIssuesByWorkshop();

  const today = new Date();
  const formattedDate = today.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // 🟦 Encabezado
  doc.setFontSize(16);
  doc.setTextColor(0, 53, 84);
  doc.text('EMPRESA NPH', 20, 20);
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('Área de Bienestar Social', 20, 28);
  doc.setFontSize(12);
  doc.text('Reporte de Temas con Talleres', 20, 36);
  doc.text(`Fecha de Exportación: ${formattedDate}`, 20, 44);

  let finalY = 52;

  Object.entries(groupedIssues).forEach(([workshopName, issues]) => {
    const tableData = issues.map((issue, i) => {
      const fecha = issue.scheduledTime
        ? new Date(issue.scheduledTime).toLocaleString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Sin fecha';

      return [
        i + 1,
        issue.name,
        fecha,
        issue.observation || '',
      ];
    });

    autoTable(doc, {
      head: [[
        { content: `Taller: ${workshopName}`, colSpan: 5, styles: { fillColor: [13, 53, 110], halign: 'left', textColor: 255, fontStyle: 'bold' } }
      ]],
      startY: finalY,
      margin: { left: 20, right: 20 },
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10, cellPadding: 2 },
      body: tableData,
      theme: 'grid',
      columns: [
        { header: 'N.º', dataKey: 0 },
        { header: 'Nombre del Tema', dataKey: 1 },
        { header: 'Fecha Programada', dataKey: 3 },
        { header: 'Observación', dataKey: 4 },
      ],
      didDrawPage: (data) => {
        if (data.cursor) {
          finalY = data.cursor.y + 10;
        }
      },
    });
  });

  doc.save('temas_por_taller.pdf');
}


  exportToXLSGrouped(): void {
  const groupedIssues = this.groupIssuesByWorkshop();
  const wb = XLSX.utils.book_new();

  for (const [workshopName, issues] of Object.entries(groupedIssues)) {
    const wsData = issues.map((issue) => ({
      Nombre: issue.name,
      Taller: issue.workshopName || 'No workshop',
      'Fecha y Hora': issue.scheduledTime
        ? new Date(issue.scheduledTime).toLocaleString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Sin fecha',
      Observación: issue.observation || '',
      Estado: issue.state === 'A' ? 'Activo' : 'Inactivo',
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, workshopName.substring(0, 31));
  }

  XLSX.writeFile(wb, 'temas_por_taller.xlsx');
}



  exportToCSVGrouped(): void {
  const groupedIssues = this.groupIssuesByWorkshop();
  let csvContent = 'Taller,Nombre,Fecha y Hora,Observación\n';

  for (const [workshopName, issues] of Object.entries(groupedIssues)) {
    issues.forEach((issue) => {
      const fecha = issue.scheduledTime
        ? new Date(issue.scheduledTime).toLocaleString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Sin fecha';

      const observacion = issue.observation?.replace(/\n/g, ' ').replace(/,/g, ';') || '';

      csvContent += `"${workshopName}","${issue.name}","${fecha}","${observacion}"\n`;
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'temas_por_taller.csv';
  a.click();
}

  groupIssuesByWorkshop(): Record<string, Issue[]> {
    return this.filteredIssues.reduce((grouped, issue) => {
      const workshopName = issue.workshopName || 'Sin Taller';
      if (!grouped[workshopName]) {
        grouped[workshopName] = [];
      }
      grouped[workshopName].push(issue);
      return grouped;
    }, {} as Record<string, Issue[]>);
  }

  getCurrentDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  validateDateTime(event: Event): void {
  const target = event.target as HTMLInputElement;

  if (!target || !target.value) return;

  const inputDate = new Date(target.value);
  const currentDate = new Date();

  if (inputDate < currentDate) {
    this.dateError = true;  // Mostrar el mensaje de error si la fecha es inválida
    this.issueForm.scheduledTime = this.getCurrentDateTime();  // Restablecer a la fecha actual
  } else {
    this.dateError = false;  // Ocultar el mensaje de error si la fecha es válida
  }
}


  get totalPages(): number {
    return Math.ceil(this.filteredIssues.length / this.itemsPerPage);
  }

  get paginatedIssues(): Issue[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredIssues.slice(start, end);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onModalClosed(): void {
    this.isModalOpen = false;
  }

  onIssueSaved(issue: Issue): void {
    console.log('Asistencia guardada:', issue);
    this.isModalOpen = false;
  }

  handleCloseModal() {
    this.isModalOpen = false;
  }
handleSaveIssue(issue: Issue) {
  if (this.isEditMode) {
    this.issueForm = { ...issue };
    this.updateSupplier();
  } else {
    this.issueForm = { ...issue };
    this.addIssue();
  }
}
}
