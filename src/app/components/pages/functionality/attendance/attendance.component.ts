import { Component, ElementRef, inject, OnInit, ViewChild } from "@angular/core"
import { Attendance } from "../../../../interfaces/attendance"
import { AttendanceService } from "../../../../services/attendance.service"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { IssueService } from "./../../../../services/issue.service"
import { WorkshopService } from "../../../../services/workshop.service"
import { PersonaService } from "../../../../services/person.service"
import { forkJoin } from "rxjs"
import { AttendanceModalComponent } from "./attendance-modal/attendance-modal.component"
import { AuthService } from "../../../../auth/services/auth.service"
import { ActivityService } from "../../../../services/ui/activity.service"
import Swal from "sweetalert2"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

@Component({
  selector: "app-attendance",
  standalone: true,
  imports: [CommonModule, FormsModule, AttendanceModalComponent],
  templateUrl: "./attendance.component.html",
  styleUrl: "./attendance.component.css",
})
export class AttendanceComponent implements OnInit {
  @ViewChild('attendanceTable', { static: false }) attendanceTable!: ElementRef;
  private attendanceService = inject(AttendanceService)
  isModalOpen = false
  isEditMode = false
  attendanceList: Attendance[] = []
  attendance: Attendance[] = []
  filteredAttendance: Attendance[] = []
  isLoadingAttendance = true
  currentDateTime = ""
  issueList: any[] = []
  workshops: any[] = []
  personList: any[] = []
  previewImage: string | null = null // Para mostrar la vista previa de la imagen
  imageFile: File | null = null
  selectedPerson: any = null
  editAttendance: Attendance | null = null
  filteredIssues: any[] = [] // Temas filtrados según el taller seleccionado
  selectedWorkshopId = 0 // ID del taller seleccionado
  selectedIssueId = 0
  filteredPersons: any[] = []; // Lista filtrada de personas según el taller seleccionado

  attendanceForm: Attendance = {
    id: 0,
    issueId: 0,
    personId: 0,
    entryTime: "",
    justificationDocument: "",
    record: "",
    state: "",
  }

  // Variables para el control de permisos
  userRole: string | null = null
  isAdmin = false
  isUser = false

  constructor(
    private issueService: IssueService,
    private personService: PersonaService,
    private workshopService: WorkshopService,
    private authService: AuthService,
    private activityService: ActivityService,
  ) { }

  ngOnInit(): void {
    this.getAttendances()
    this.getIssues()
    this.getPersons()
    this.setCurrentDateTime()
    this.checkUserPermissions()
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

  private logAttendanceActivity(action: string, attendanceData: any): void {
  this.authService.getLoggedUserInfo().subscribe({
    next: (currentUser) => {
      const attendance = "attendance" in attendanceData ? attendanceData.attendance : attendanceData;

      const activity = {
        imagen: currentUser?.profileImage || "/placeholder.svg?height=40&width=40",
        nombre: `${currentUser?.name || ""} ${currentUser?.lastName || ""}`.trim() || currentUser?.email || "Usuario",
        modulo: "Asistencias",
        accion: `${action} la asistencia del ${attendance.date} para ${attendance.personName || 'participante'}`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada: ${action} asistencia ${attendance.date}`);
    },
    error: () => {
      const attendance = "attendance" in attendanceData ? attendanceData.attendance : attendanceData;

      const activity = {
        imagen: "/placeholder.svg?height=40&width=40",
        nombre: "Usuario del sistema",
        modulo: "Asistencias",
        accion: `${action} la asistencia del ${attendance.date} para ${attendance.personName || 'participante'}`,
      };

      this.activityService.logActivity(activity);
      console.log(`Actividad registrada (fallback): ${action} asistencia ${attendance.date}`);
    },
  });
}



  getAttendances(): void {
    this.isLoadingAttendance = true
    forkJoin({
      persons: this.personService.getPersons(),
      issues: this.issueService.getActiveIssues(),
      attendances: this.attendanceService.getAttendances(),
      workshops: this.workshopService.getActiveWorkshops(),
    }).subscribe(
      ({ persons, issues, attendances, workshops }) => {
        this.personList = persons
        this.issueList = issues
        this.workshops = workshops

        this.attendance = attendances.map((att: any) => {
          const issue = issues.find((t) => t.id === att.issueId)
          const person = persons.find((p) => p.idPerson === att.personId)
          const workshop = workshops.find((w) => w.id === issue?.workshopId)

          return {
            ...att,
            issueName: issue ? issue.name : "No asignado",
            workshopName: workshop ? workshop.name : "No asignado",
            personName: person ? person.name : "No encontrado",
          }
        })

        this.filteredAttendance = [...this.attendance]
        this.filteredIssues = [...this.issueList]

        // ✅ Ahora que todos los datos están cargados, puedes filtrar correctamente
        this.filterPersonsByWorkshop()

        this.isLoadingAttendance = false
      },
      (error) => {
        console.error("Error retrieving attendance data:", error)
        this.isLoadingAttendance = false
      },
    )
  }


  getIssues(): void {
    this.issueService.getActiveIssues().subscribe({
      next: (data) => {
        console.log("Loaded Issues:", data) // Verificar la carga de issues
        this.issueList = data
        this.filteredIssues = [...this.issueList] // Inicialmente, mostrar todos los temas
      },
      error: (err) => {
        console.error("Error fetching issues:", err)
      },
    })
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

  loadData(): void {
    forkJoin({
      persons: this.personService.getPersons(),
      issues: this.issueService.getActiveIssues(),
      attendances: this.attendanceService.getAttendances(),
    }).subscribe(
      ({ persons, issues, attendances }) => {
        this.personList = persons
        this.issueList = issues

        this.attendanceList = attendances.map((att: any) => {
          const issue = this.issueList.find((t) => t.id === att.issueId)
          const person = this.personList.find((p) => p.idPerson === att.personId)
          return {
            ...att,
            issueName: issue ? issue.name : "No asignado",
            personName: person ? person.name : "⚠️ No encontrado",
          }
        })
      },
      (error) => {
        console.error("Error cargando datos:", error)
      },
    )
  }

  openModal(): void {
    this.isEditMode = false
    this.attendanceForm = {
      id: 0,
      issueId: 0,
      personId: 0,
      entryTime: this.getCurrentDateTime(), // ✅ Se asigna con el formato correcto
      record: "A",
      justificationDocument: "",
      state: "A",
    }
    this.isModalOpen = true
  }

  closeModal(): void {
    this.isModalOpen = false
  }

  setCurrentDateTime(): void {
    const now = new Date()
    const formattedDate = now.toISOString().slice(0, 16) // ✅ Formato correcto `YYYY-MM-DDTHH:mm`
    this.currentDateTime = formattedDate
  }

  getCurrentDateTime(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0") // Asegurar dos dígitos
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}:00` // ✅ Incluye los segundos ":00"
  }

  openEditModal(attendance: Attendance): void {
    this.isEditMode = true
    this.attendanceForm = { ...attendance } // Cargar la asistencia en el formulario
    this.isModalOpen = true
  }

  openEditModalForAttendance(issueId: number, personId: number): void {
    // Limpiar la vista previa y la imagen cargada antes de abrir el modal
    this.previewImage = null // Limpiar la vista previa
    this.imageFile = null // Limpiar el archivo de imagen

    // Buscar si existe un registro de asistencia para el tema y persona
    const attendanceRecord = this.attendance.find((att) => att.issueId === issueId && att.personId === personId)

    // Si el registro ya existe, se abre en modo edición
    if (attendanceRecord) {
      // Solo permitir edición si el estado es 'F' (falta) o 'T' (tarde)
      if (attendanceRecord.record === "F" || attendanceRecord.record === "T") {
        this.isEditMode = true // Establecemos el modo de edición
        this.attendanceForm = { ...attendanceRecord } // Cargamos los datos del registro en el formulario

        // Si hay un archivo de justificación, mostramos la vista previa
        if (attendanceRecord.justificationDocument && attendanceRecord.justificationDocument !== "N/A") {
          this.previewImage = `path_to_images_folder/${attendanceRecord.justificationDocument}` // Asumiendo que la imagen está en un folder accesible
        }

        this.isModalOpen = true // Abrimos el modal para editar
      } else {
        // Si el estado no es 'F' ni 'T', no permitimos la edición
        alert('No se puede editar esta asistencia, el record es "A" o "J"')
        return
      }
    } else {
      // Si no existe el registro, se crea uno nuevo
      this.isEditMode = false // Establecemos el modo de creación
      this.attendanceForm = {
        id: 0, // El ID será 0, ya que el backend lo asignará cuando se guarde.
        issueId,
        personId,
        entryTime: this.getCurrentDateTime(),
        record: "A", // Cambiado a 'A' por defecto
        justificationDocument: "",
        state: "A", // Estado por defecto, Activo
      }
      this.isModalOpen = true // Abrimos el modal para agregar un nuevo registro
    }
  }

  getAttendanceStatus(issueId: number, personId: number): string {
    const attendanceRecord = this.attendance.find((att) => att.issueId === issueId && att.personId === personId)

    if (attendanceRecord) {
      return attendanceRecord.record // Devuelve el estado (A, F, T, J)
    }

    return "none" // Si no hay registro, retorna 'none' para mostrar '-'
  }

  getIssueScheduledTime(issueId: number): string | null {
    const issue = this.issueList.find((t) => t.id === issueId)
    return issue ? issue.scheduledTime : null
  }

  filterAttendance(): void {
    if (this.filteredIssues.length === 0) {
      console.log("No issues found for the selected workshop.")
    }

    // Filtrar las asistencias basadas en los issues filtrados
    this.filteredAttendance = this.attendance.filter((attendance) => {
      return this.filteredIssues.some((issue) => issue.id === attendance.issueId)
    })

    console.log("Filtered Attendance:", this.filteredAttendance) // Verifica las asistencias filtradas
  }

  filterIssuesByWorkshop(): void {
    if (this.selectedWorkshopId === 0) {
      // Mostrar todos los issues si se selecciona "Todos los talleres"
      this.filteredIssues = [...this.issueList];
    } else {
      // Filtrar los issues que pertenecen al taller seleccionado
      this.filteredIssues = this.issueList.filter(issue => issue.workshopId === this.selectedWorkshopId);
    }

    // También filtrar las personas en función del taller seleccionado
    this.filterPersonsByWorkshop();

    // Y luego actualizar las asistencias mostradas
    this.filterAttendance();
  }



  onModalClosed(): void {
    this.isModalOpen = false
    this.getAttendancesAndFilter()
  }

  onAttendanceSaved(attendance: Attendance): void {
    console.log("Asistencia guardada:", attendance)
    this.isModalOpen = false
    this.getAttendancesAndFilter()
  }

  getAttendancesAndFilter(): void {
    this.getAttendances()
    setTimeout(() => {
      this.filterIssuesByWorkshop()
    }, 100) // Esperamos a que se actualicen los datos antes de filtrar
  }

  // Este método se llama cuando el usuario selecciona un taller
  filterPersonsByWorkshop(): void {
    const selectedWorkshopIdNumber = Number(this.selectedWorkshopId);

    if (selectedWorkshopIdNumber === 0) {
      this.filteredPersons = [...this.personList];
      this.filteredIssues = [...this.issueList];
      return;
    }

    const selectedWorkshop = this.workshops.find(
      (workshop) => Number(workshop.id) === selectedWorkshopIdNumber
    );

    if (selectedWorkshop && selectedWorkshop.personId) {
      const personIdsInWorkshop: number[] = selectedWorkshop.personId
        .split(',')
        .map((id: string): number => parseInt(id.trim(), 10))
        .filter((id: number): boolean => !isNaN(id));
      // Aseguramos que son IDs válidos

      this.filteredPersons = this.personList.filter((person) =>
        personIdsInWorkshop.includes(person.idPerson)
      );

      this.filteredIssues = this.issueList.filter(
        (issue) => Number(issue.workshopId) === selectedWorkshopIdNumber
      );
    } else {
      this.filteredPersons = [];
      this.filteredIssues = [];
    }

    console.log("Filtered Persons:", this.filteredPersons);
    console.log("Filtered Issues:", this.filteredIssues);
  }

  countAttendance(personId: number, type: string): number {
    // Solo cuenta los issues filtrados (respeta el filtro de taller)
    return this.attendance.filter(att =>
      att.personId === personId &&
      this.filteredIssues.some(issue => issue.id === att.issueId) &&
      att.record === type
    ).length;
  }

  downloadPDF(): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  // Cabeceras dinámicas según tus datos
  const head = [
    [
      { content: 'NOMBRE', rowSpan: 2 },
      ...this.filteredIssues.map(issue => ({
        content: `${issue.scheduledTime?.split('T')[0] || ''}\n${issue.name}`,
        rowSpan: 2
      })),
      { content: 'CONTADORES', colSpan: 4 }
    ],
    [
      // Segunda fila vacía porque los issues ya tienen rowSpan: 2
      { content: '%A' }, { content: '%F' }, { content: '%T' }, { content: '%J' }
    ]
  ];

  // Filas de datos
  const body = this.filteredPersons.map(person => {
    const row = [
      person.name,
      ...this.filteredIssues.map(issue => {
        const att = this.attendance.find(a => a.personId === person.idPerson && a.issueId === issue.id);
        if (!att) return '';
        if (att.record === 'A') return 'A';
        if (att.record === 'F') return 'F';
        if (att.record === 'T') return 'T';
        if (att.record === 'J') return 'J';
        return '';
      }),
      this.countAttendance(person.idPerson, 'A').toString(),
      this.countAttendance(person.idPerson, 'F').toString(),
      this.countAttendance(person.idPerson, 'T').toString(),
      this.countAttendance(person.idPerson, 'J').toString()
    ];
    return row;
  });

  // Tabla
  autoTable(doc, {
    head: head,
    body: body,
    startY: 40,
    styles: {
      halign: 'center',
      valign: 'middle',
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: 50,
    },
    columnStyles: {
      // Puedes personalizar colores de columnas aquí si quieres
      [body[0]?.length - 4]: { fillColor: [163, 202, 57] }, // %A
      [body[0]?.length - 3]: { fillColor: [255, 236, 139] }, // %F
      [body[0]?.length - 2]: { fillColor: [255, 186, 0] },   // %T
      [body[0]?.length - 1]: { fillColor: [255, 140, 0] },   // %J
    }
  });

  doc.save(`asistencia_taller_${new Date().toISOString().slice(0, 10)}.pdf`);
  Swal.fire({
    title: '✅ PDF generado',
    text: 'El archivo se ha descargado correctamente.',
    icon: 'success',
    confirmButtonColor: '#0d6efd',
  });
}

// ...existing code...
downloadCSV(): void {
  // Cabecera
  let csv = 'NOMBRE';
  this.filteredIssues.forEach(issue => {
    csv += `,${issue.scheduledTime?.split('T')[0] || ''} ${issue.name}`;
  });
  csv += ',%A,%F,%T,%J\n';

  // Filas
  this.filteredPersons.forEach(person => {
    let row = `"${person.name}"`;
    this.filteredIssues.forEach(issue => {
      const att = this.attendance.find(a => a.personId === person.idPerson && a.issueId === issue.id);
      let value = '';
      if (att) {
        if (att.record === 'A') value = 'A';
        else if (att.record === 'F') value = 'F';
        else if (att.record === 'T') value = 'T';
        else if (att.record === 'J') value = 'J';
      }
      row += `,${value}`;
    });
    row += `,${this.countAttendance(person.idPerson, 'A')}`;
    row += `,${this.countAttendance(person.idPerson, 'F')}`;
    row += `,${this.countAttendance(person.idPerson, 'T')}`;
    row += `,${this.countAttendance(person.idPerson, 'J')}`;
    csv += row + '\n';
  });

  // Descargar
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `asistencia_taller_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Swal.fire({
    title: '✅ CSV generado',
    text: 'El archivo se ha descargado correctamente.',
    icon: 'success',
    confirmButtonColor: '#0d6efd',
  });
}
// ...existing code...


}
