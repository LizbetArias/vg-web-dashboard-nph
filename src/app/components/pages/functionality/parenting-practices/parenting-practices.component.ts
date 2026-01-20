import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ParentingPracticesPlan } from '../../../../interfaces/parenting-practices-plan';
import { Session } from '../../../../interfaces/session';
import { ParentingPracticesPlanService } from '../../../../services/parenting-practices-plan.service';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-parenting-practices',
  templateUrl: './parenting-practices.component.html',
  styleUrls: ['./parenting-practices.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ParentingPracticesComponent implements OnInit {
  // Lists to hold data
  plans: ParentingPracticesPlan[] = [];
  sessions: Session[] = [];
  filteredPlans: ParentingPracticesPlan[] = [];
  
  // Form management
  planForm: FormGroup;
  isEditMode = false;
  currentPlanId: number | null = null;
  
  // UI state management
  loading = false;
  showInactive = false;
  selectedSessionId: number | null = null;
  currentDate = new Date();
  selectedPlan: ParentingPracticesPlan | null = null;
  showModal = false;

 constructor(
   private planService: ParentingPracticesPlanService,
   private fb: FormBuilder,
   private router: Router
 ) {
   this.planForm = this.createForm();
 }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    
    // Get all sessions
    this.planService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        // After getting sessions, get all plans
        this.loadPlans();
      },
      error: (error) => {
        Swal.fire({
          title: 'Error',
          text: 'Error al cargar sesiones',
          icon: 'error'
        });
        this.loading = false;
      }
    });
  }

  loadPlans(): void {
    this.planService.getAllPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        Swal.fire({
          title: 'Error',
          text: 'Error al cargar planes',
          icon: 'error'
        });
        this.loading = false;
      }
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      sessionId: [null, Validators.required],
      startDate: [null],
      preparedBy: ['', Validators.maxLength(100)],
      topic: ['', Validators.maxLength(200)],
      objective: [''],
      goal: ['']
    });
  }

  applyFilters(): void {
    this.filteredPlans = this.plans.filter(plan => {
      // Filter by active/inactive status
      const statusMatch = this.showInactive || plan.generalStatus !== 'SUSPENDED';
      
      // Filter by selected session
      const sessionMatch = !this.selectedSessionId || plan.sessionId === this.selectedSessionId;
      
      return statusMatch && sessionMatch;
    });
  }

  onSessionFilterChange(sessionId: string | null): void {
    this.selectedSessionId = sessionId ? parseInt(sessionId, 10) : null;
    this.applyFilters();
  }

  toggleShowInactive(): void {
    this.showInactive = !this.showInactive;
    this.applyFilters();
  }

  resetForm(): void {
    this.planForm.reset();
    this.isEditMode = false;
    this.currentPlanId = null;
    this.selectedPlan = null;
  }

  openModal(): void {
    this.resetForm();
    this.showModal = true;
    document.body.classList.add('modal-open');
  }

  closeModal(): void {
    this.showModal = false;
    document.body.classList.remove('modal-open');
    this.resetForm();
  }

  closeModalOnBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.closeModal();
    }
  }

  editPlan(plan: ParentingPracticesPlan): void {
    this.isEditMode = true;
    this.currentPlanId = plan.id || null;
    this.selectedPlan = plan;
    
    this.planForm.patchValue({
      sessionId: plan.sessionId,
      startDate: plan.startDate ? new Date(plan.startDate) : null,
      preparedBy: plan.preparedBy || '',
      topic: plan.topic || '',
      objective: plan.objective || '',
      goal: plan.goal || ''
    });
    
    // Open the modal
    this.showModal = true;
    document.body.classList.add('modal-open');
  }

  confirmSuspendPlan(plan: ParentingPracticesPlan): void {
    Swal.fire({
      title: '¿Suspender plan?',
      text: `¿Está seguro que desea suspender el plan de ${plan.topic || 'prácticas parentales'}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, suspender',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed && plan.id) {
        this.planService.logicalDeletePlan(plan.id).subscribe({
          next: () => {
            Swal.fire({
              title: '¡Suspendido!',
              text: 'El plan ha sido suspendido correctamente.',
              icon: 'success'
            });
            this.loadPlans();
          },
          error: (error) => {
            Swal.fire({
              title: 'Error',
              text: 'No se pudo suspender el plan. Por favor intente nuevamente.',
              icon: 'error'
            });
          }
        });
      }
    });
  }

  confirmRestorePlan(plan: ParentingPracticesPlan): void {
    Swal.fire({
      title: '¿Restaurar plan?',
      text: `¿Está seguro que desea restaurar el plan de ${plan.topic || 'prácticas parentales'}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed && plan.id) {
        this.planService.restorePlan(plan.id).subscribe({
          next: (restoredPlan) => {
            Swal.fire({
              title: '¡Restaurado!',
              text: 'El plan ha sido restaurado correctamente.',
              icon: 'success'
            });
            this.loadPlans();
          },
          error: (error) => {
            Swal.fire({
              title: 'Error',
              text: 'No se pudo restaurar el plan. Por favor intente nuevamente.',
              icon: 'error'
            });
          }
        });
      }
    });
  }

  onSubmit(): void {
    if (this.planForm.invalid) {
      Swal.fire({
        title: 'Advertencia',
        text: 'Por favor complete todos los campos requeridos',
        icon: 'warning'
      });
      return;
    }

    const planData: ParentingPracticesPlan = this.planForm.value;
    
    if (this.isEditMode && this.currentPlanId) {
      // Update existing plan
      this.planService.updatePlan(this.currentPlanId, planData).subscribe({
        next: (updatedPlan) => {
          Swal.fire({
            title: 'Éxito',
            text: 'Plan actualizado correctamente',
            icon: 'success'
          });
          this.closeModal();
          this.loadPlans();
        },
        error: (error) => {
          Swal.fire({
            title: 'Error',
            text: 'Error al actualizar el plan',
            icon: 'error'
          });
        }
      });
    } else {
      // Create new plan
      this.planService.createPlan(planData).subscribe({
        next: (newPlan) => {
          Swal.fire({
            title: 'Éxito',
            text: 'Plan creado correctamente',
            icon: 'success'
          });
          this.closeModal();
          this.loadPlans();
        },
        error: (error) => {
          Swal.fire({
            title: 'Error',
            text: 'Error al crear el plan',
            icon: 'error'
          });
        }
      });
    }
  }

  getSessionName(sessionId: number): string {
    const session = this.sessions.find(s => s.id === sessionId);
    return session ? session.name : 'Sesión no encontrada';
  }
}
