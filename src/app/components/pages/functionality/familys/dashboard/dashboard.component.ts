import { Component, OnInit, Renderer2 } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { FamilyService } from '../../../../../services/family.service';
import { AdmissionReason, Family } from '../../../../../interfaces/familiaDto';
import { Person } from '../../../../../interfaces/person';
import { PersonaService } from '../../../../../services/person.service';
import { FormulariofamiliaComponent } from '../formulariofamilia/formulariofamilia.component';
import { FormulariopersonaComponent } from '../formularioPerson/formulariopersona.component';
import { VistaComponent } from '../vista/vista.component';
import { FamilyExcelService } from '../../../../../report/familyExcel.service';
import { FamilyPdfService } from '../../../../../report/familyPdf.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../auth/services/auth.service';
import { AdmissionReasonService } from '../../../../../services/admission-reason.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    FormulariofamiliaComponent,
    FormulariopersonaComponent,
    VistaComponent,
  ],
  providers: [FamilyService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  displayed: Family[] = [];
  family: Family[] = [];
  filtered: Family[] = [];
  familyMembers: Person[] = [];
  selectedFamilyId: number | undefined;
  selectedFamily: Family | undefined;
  familySelected: Family | null = null;
  newFamily: Family = this.initializeFamily();
  isCreateFamilyModalOpen = false;
  isViewModalOpen = false;
  isEditModalOpen = false;
  isConfirmModalOpen = false;
  isFamilyMembersModalOpen = false;
  isFamilyInfoModalOpen = false;
  isPersonFormOpen = false;
  currentPage = 1;
  itemsPerPage = 5;
  total = 0;
  totalPages = 0;
  searchText = '';
  filterOption = 'Apellido';
  showFilterOptions = false;
  isActive: boolean = true;
  darkMode: boolean = false;
  formSubmitted: boolean = false;

  // Control de roles
  isAdmin: boolean = false;
  userRole: string | null = null;
  isAuthorized: boolean = true;

  // Dashboard metrics
  activeFamiliesCount: number = 0;
  inactiveFamiliesCount: number = 0;
  totalMembersCount: number = 0;

  // Lista de razones de admisión desde el API
  admissionReasons: AdmissionReason[] = []
  loadingAdmissionReasons = false

  // Nueva sección de razones de admisión
  isAdmissionReasonSectionOpen = false
  newAdmissionReason: AdmissionReason = { id: 0, reason: "" }

  constructor(
    private familyService: FamilyService,
    private personaService: PersonaService,
    private authService: AuthService, // Inyectar AuthService
    private familyExcelService: FamilyExcelService,
    private familyPdfService: FamilyPdfService,
    private admissionReasonService: AdmissionReasonService,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    this.checkUserAuthorization();
    this.loadAdmissionReasons();
  }

  /**
    * Carga las razones de admisión desde el microservicio
   */
  loadAdmissionReasons() {
    this.loadingAdmissionReasons = true
    this.admissionReasonService.getAllAdmissionReasons().subscribe({
      next: (reasons) => {
        this.admissionReasons = reasons
        this.loadingAdmissionReasons = false
      },
      error: (error) => {
        console.error("Error loading admission reasons:", error)
        this.loadingAdmissionReasons = false
        Swal.fire({
          title: "Error",
          text: "No se pudieron cargar las razones de admisión. Se usarán opciones por defecto.",
          icon: "warning",
          confirmButtonText: "Entendido",
        })
      },
    })
  }

  /**
   * 🔐 Verificar autorización del usuario
   */
  checkUserAuthorization(): void {
    // Verificar si el usuario está autenticado
    if (!this.authService.hasToken()) {
      // Si no hay token, no mostrar nada y salir
      return;
    }

    // Obtener rol desde localStorage
    this.userRole = this.authService.getRole();

    // Verificar si es admin
    this.isAdmin = this.userRole === 'ADMIN';

    if (!this.isAdmin && this.userRole) {
      // Solo mostrar alerta si hay un rol válido pero no es admin
      // Esto evita mostrar la alerta cuando se cierra sesión
      this.isAuthorized = false;
      this.showUnauthorizedAlert();
    } else if (this.isAdmin) {
      // Si es admin, cargar todo normalmente
      this.isAuthorized = true;
      this.loadFamily();
      this.loadDashboardMetrics();
    }

    // También verificar con Observable para mayor seguridad
    this.authService.isAdmin().subscribe(isAdminFromToken => {
      if (!isAdminFromToken && this.isAdmin && this.authService.hasToken()) {
        // Solo verificar si hay token válido
        this.isAdmin = false;
        this.isAuthorized = false;
        this.showUnauthorizedAlert();
      }
    });
  }

  /**
   * ⚠️ Mostrar alerta de no autorización
   */
  showUnauthorizedAlert(): void {
    Swal.fire({
      title: 'Acceso Restringido',
      text: 'No tienes permisos de administrador para realizar acciones en esta sección.',
      icon: 'warning',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      // Después de cerrar la alerta, cargar datos en modo solo lectura
      this.loadFamily();
      this.loadDashboardMetrics();
    });
  }

  /**
   * 🔒 Verificar si una acción está permitida
   */
  isActionAllowed(): boolean {
    return this.isAdmin && this.isAuthorized;
  }

  loadDashboardMetrics(): void {
    // Get active families count
    this.familyService.getFamiliesActive().subscribe((data: Family[]) => {
      this.activeFamiliesCount = data.length
    })

    // Get inactive families count
    this.familyService.getFamiliesInactive().subscribe((data: Family[]) => {
      this.inactiveFamiliesCount = data.length
    })

    // Get total members count
    this.personaService.getPersons().subscribe((data: Person[]) => {
      this.totalMembersCount = data.length
    })
  }

  loadFamily(): void {
    (this.isActive
      ? this.familyService.getFamiliesActive()
      : this.familyService.getFamiliesInactive()
    ).subscribe(
      (data: Family[]) => {
        this.family = data.sort((a, b) => a.id - b.id);
        this.total = data.length;
        this.totalPages = Math.ceil(this.total / this.itemsPerPage);
        this.updateFiltered();
      },
      (error) => {
        console.error('❌ Error fetching family ');
      }
    );
  }

  toggleActiveStatus(): void {
    this.loadFamily();
  }

  updateFiltered(): void {
    const allFiltered = this.family.filter((family) => {
      if (this.filterOption === 'Apellido') {
        return family.lastName
          .toLowerCase()
          .includes(this.searchText.toLowerCase());
      } else {
        return family.direction
          .toLowerCase()
          .includes(this.searchText.toLowerCase());
      }
    });

    this.total = allFiltered.length;
    this.totalPages = Math.ceil(this.total / this.itemsPerPage);
    this.currentPage = 1;

    this.filtered = allFiltered;

    this.updateDisplayed();
  }

  updateDisplayed(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayed = this.filtered.slice(startIndex, endIndex);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayed();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayed();
    }
  }

  toggleFilterOption(): void {
    this.showFilterOptions = !this.showFilterOptions;
  }

  setFilterOption(option: string): void {
    this.filterOption = option;
    this.showFilterOptions = false;
    this.updateFiltered();
  }

  getFormattedDate(dateString?: string): string {
    if (!dateString) return '---';
    const date = new Date(dateString);

    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day} - ${month} - ${year}`;
  }

  eliminarFamilia(id: number) {
    // 🔒 Verificar autorización antes de ejecutar
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará la familia de forma lógica.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.familyService.deleteFamily(id).subscribe(
          () => {
            Swal.fire('Eliminado', 'La familia ha sido eliminada.', 'success');
            this.loadFamily();
            this.loadDashboardMetrics();
          },
          (error) => {
            console.error('Error al eliminar la familia:', error);
            Swal.fire(
              'Error',
              'Ocurrió un error al eliminar la familia.',
              'error'
            );
          }
        );
      }
    });
  }

  reactivarFamilia(id: number) {
    // 🔒 Verificar autorización antes de ejecutar
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción reactivará la familia.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, reactivar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.familyService.activeFamily(id).subscribe(
          () => {
            Swal.fire(
              'Reactivado',
              'La familia ha sido reactivada.',
              'success'
            );
            this.loadFamily();
            this.loadDashboardMetrics();
          },
          (error) => {
            console.error('Error al reactivar la familia:', error);
            Swal.fire(
              'Error',
              'Ocurrió un error al reactivar la familia.',
              'error'
            );
          }
        );
      }
    });
  }

  /**
   * ⚠️ Mostrar alerta para acciones no autorizadas
   */
  showUnauthorizedActionAlert(): void {
    Swal.fire({
      title: 'Acción No Permitida',
      text: 'No tienes permisos para realizar esta acción. Solo los administradores pueden modificar datos.',
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  }

  openViewModal(familyId: number): void {
    this.selectedFamilyId = familyId;
    this.isConfirmModalOpen = true;
  }

  viewMembers(): void {
    if (this.selectedFamilyId) {
      this.personaService.getPersonsByFamilyId(this.selectedFamilyId).subscribe(
        (members: Person[]) => {
          this.familyMembers = members;
          this.isViewModalOpen = true;
          this.isConfirmModalOpen = false;
        },
        (error) => {
          console.error('Error fetching family members', error);
          this.isConfirmModalOpen = false;
          Swal.fire(
            'Error',
            'No se pudieron cargar los miembros de la familia.',
            'error'
          );
        }
      );
    }
  }

  viewFamilyInfo(): void {
    if (this.selectedFamilyId) {
      this.familyService
        .getFamilyInformationById(this.selectedFamilyId)
        .subscribe(
          (family: Family) => {
            this.familySelected = family;
            this.isFamilyInfoModalOpen = true;
            this.isConfirmModalOpen = false;
          },
          (error) => {
            console.error('Error fetching family details', error);
            this.isConfirmModalOpen = false;
          }
        );
    }
  }

  onPersonFormClosed() {
    this.isPersonFormOpen = false;
    this.isFamilyInfoModalOpen = true;
    this.loadDashboardMetrics();
  }

  openCreateFamilyModal(): void {
    // 🔒 Verificar autorización antes de abrir modal
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    this.isCreateFamilyModalOpen = true;
    this.newFamily = this.initializeFamily();
    this.formSubmitted = false;
  }

  validateAndCreateFamily(form: NgForm): void {
    // 🔒 Verificar autorización antes de crear
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    this.formSubmitted = true;

    if (form.invalid) {
      Swal.fire({
        title: 'Formulario incompleto',
        text: 'Por favor, completa todos los campos requeridos antes de guardar.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.createFamily();
  }

  createFamily(): void {
    this.familyService
      .createFamily(this.newFamily)
      .subscribe((family: Family) => {
        this.isCreateFamilyModalOpen = false;
        this.loadFamily();
        this.loadDashboardMetrics();
        this.resetNewFamily();
        this.familySelected = family;

        this.isPersonFormOpen = true;
        Swal.fire('Éxito', 'Familia creada exitosamente.', 'success');
      });
  }

  initializeFamily(): Family {
    return {
      id: 0,
      lastName: "",
      direction: "",
      reasibAdmission: 0,
      //Composicion Familiar
      numberMembers: 0,
      numberChildren: 0,
      familyType: "",
      socialProblems: "",
      //Alimentacion Familiar
      weeklyFrequency: "",
      feedingType: "",
      //Salud Familiar
      safeType: "",
      familyDisease: "",
      treatment: "",
      diseaseHistory: "",
      medicalExam: "",
      status: "A",
      basicService: {
        //Servicios Basicos
        waterService: "",
        servDrain: "",
        servLight: "",
        servCable: "",
        servGas: "",
        //Entorno de la comunidad
        area: "",
        referenceLocation: "",
        residue: "",
        publicLighting: "",
        security: "",
        //Vida social comunitario
        material: "",
        feeding: "",
        economic: "",
        spiritual: "",
        socialCompany: "",
        guideTip: "",
      },
      housingDetails: {
        //Entorno de la vivienda
        tenure: "",
        typeOfHousing: "",
        housingMaterial: "",
        housingSecurity: "",
        //Distribucion de la vivienda
        homeEnvironment: 0,
        bedroomNumber: 0,
        habitability: "",
        //Autonomia Laboral - Arreglar campos
        caregiverCondition: "",
        caringCondition: "",
        membersWork: 0,
        workingTime: "",
        monthlyIncome: 0,
        monthlyExpense: 0,
      },
    };
  }

  resetFamilyForm(): void {
    this.familySelected = null;
  }

  resetNewFamily(): void {
    this.newFamily = this.initializeFamily();
    this.formSubmitted = false;
  }

  closeCreateFamilyModal(): void {
    this.isCreateFamilyModalOpen = false;
    this.resetNewFamily();
  }

  closeFamilyInfoModal(): void {
    this.isFamilyInfoModalOpen = false;
    this.loadFamily();
    this.loadDashboardMetrics();
    this.selectedFamily = undefined;
    this.resetFamilyForm();
  }

  cancelView(): void {
    this.isConfirmModalOpen = false;
  }

  closeViewModal(): void {
    this.isViewModalOpen = false;
    this.selectedFamily = undefined;
  }

  exportToExcel(): void {
    // 🔒 Verificar autorización para exportar
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    this.familyService.getFamiliesActive().subscribe({
      next: (families) => {
        this.personaService.getPersons().subscribe({
          next: (persons: Person[]) => {
            this.familyExcelService.exportCombined(families, persons);
          },
          error: (err: any) => {
            console.error('Error al obtener personas para Excel:', err);
          }
        });
      },
      error: (err: any) => {
        console.error('Error al exportar a Excel:', err);
      }
    });
  }

  exportToPdf(): void {
    // 🔒 Verificar autorización para exportar
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    this.familyService.getFamiliesActive().subscribe({
      next: (families) => {
        this.personaService.getPersons().subscribe({
          next: (persons: Person[]) => {
            this.familyPdfService.generateConsolidatedReport(families, persons);
          },
          error: (err: any) => {
            console.error('Error al obtener personas para PDF:', err);
            Swal.fire(
              'Error',
              'Ocurrió un error al generar el informe PDF.',
              'error'
            );
          }
        });
      },
      error: (err: any) => {
        console.error('Error al obtener familias para PDF:', err);
        Swal.fire(
          'Error',
          'Ocurrió un error al generar el informe PDF.',
          'error'
        );
      }
    });
  }

  exportSingleFamilyToPdf(familyId: number): void {
    // 🔒 Verificar autorización para exportar
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert();
      return;
    }

    this.familyService.getFamilyInformationById(familyId).subscribe({
      next: (family: Family) => {
        this.personaService.getPersonsByFamilyId(familyId).subscribe({
          next: (members: Person[]) => {
            this.familyPdfService.generateDetailedFamilyReport(family, members);
          },
          error: (err: any) => {
            console.error('Error al obtener miembros de la familia para PDF:', err);
            Swal.fire(
              'Error',
              'Ocurrió un error al generar el informe PDF de la familia.',
              'error'
            );
          }
        });
      },
      error: (err: any) => {
        console.error('Error al obtener información de la familia para PDF:', err);
        Swal.fire(
          'Error',
          'Ocurrió un error al generar el informe PDF de la familia.',
          'error'
        );
      }
    });
  }

  // Nuevos métodos para la sección de razones de admisión
  toggleAdmissionReasonSection(): void {
    this.isAdmissionReasonSectionOpen = !this.isAdmissionReasonSectionOpen
    if (!this.isAdmissionReasonSectionOpen) {
      this.resetAdmissionReasonForm()
    }
  }

  createAdmissionReason(): void {
    if (!this.isActionAllowed()) {
      this.showUnauthorizedActionAlert()
      return
    }

    if (!this.newAdmissionReason.reason.trim()) {
      Swal.fire({
        title: "Campo requerido",
        text: "Por favor, ingresa una razón de admisión.",
        icon: "warning",
        confirmButtonText: "Entendido",
      })
      return
    }

    this.admissionReasonService.createReason(this.newAdmissionReason).subscribe({
      next: (reason) => {
        Swal.fire("Éxito", "Razón de admisión creada exitosamente.", "success")
        this.loadAdmissionReasons()
        this.resetAdmissionReasonForm()
        this.isAdmissionReasonSectionOpen = false
      },
      error: (error) => {
        console.error("Error al crear razón de admisión:", error)
        Swal.fire("Error", "Ocurrió un error al crear la razón de admisión.", "error")
      },
    })
  }

  resetAdmissionReasonForm(): void {
    this.newAdmissionReason = { id: 0, reason: "" }
  }
}
