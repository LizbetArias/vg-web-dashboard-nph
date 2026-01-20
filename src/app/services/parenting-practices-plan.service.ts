import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, throwError, tap } from 'rxjs';
import { ParentingPracticesPlan } from '../interfaces/parenting-practices-plan';
import { Session } from '../interfaces/session';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class ParentingPracticesPlanService {
  private apiUrl = `${environment.ms_tranformation}/parenting-practices`;

  constructor(private http: HttpClient) { }

  getAllPlans(): Observable<ParentingPracticesPlan[]> {
    return this.http.get<ParentingPracticesPlan[]>(`${this.apiUrl}/`).pipe(
      tap(data => console.log('All plans fetched:', data)),
      catchError(this.handleError)
    );
  }

  getPlanById(id: number): Observable<ParentingPracticesPlan> {
    return this.http.get<ParentingPracticesPlan>(`${this.apiUrl}/listar/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getPlansBySessionId(sessionId: number): Observable<ParentingPracticesPlan[]> {
    return this.http.get<ParentingPracticesPlan[]>(`${this.apiUrl}/session/${sessionId}`).pipe(
      tap(data => console.log('Plans by session fetched:', data)),
      catchError(this.handleError)
    );
  }

  getSessions(): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}/sessions`).pipe(
      tap(data => console.log('Sessions fetched:', data)),
      catchError(this.handleError)
    );
  }

  createPlan(plan: ParentingPracticesPlan): Observable<ParentingPracticesPlan> {
    return this.http.post<ParentingPracticesPlan>(`${this.apiUrl}/create`, plan).pipe(
      tap(response => console.log('Create plan response:', response)),
      catchError(this.handleError)
    );
  }

  updatePlan(id: number, plan: ParentingPracticesPlan): Observable<ParentingPracticesPlan> {
    return this.http.put<ParentingPracticesPlan>(`${this.apiUrl}/actualizar/${id}`, plan).pipe(
      tap(response => console.log('Update plan response:', response)),
      catchError(this.handleError)
    );
  }

  restorePlan(id: number): Observable<ParentingPracticesPlan> {
    return this.http.put<ParentingPracticesPlan>(`${this.apiUrl}/restore/${id}`, {}).pipe(
      tap(response => console.log('Restore plan response:', response)),
      catchError(this.handleError)
    );
  }

  logicalDeletePlan(id: number): Observable<void> {
    return this.http.put(`${this.apiUrl}/eliminar-logico/${id}`, {}, { responseType: 'text' }).pipe(
      map(() => {
        console.log('Plan marked as suspended successfully');
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error occurred:', error);
    
    let errorMsg = '';
    if (error.error instanceof ErrorEvent) {
      errorMsg = `Error: ${error.error.message}`;
    } else {
      errorMsg = `Código: ${error.status}, Mensaje: ${error.error?.message || error.statusText}`;
    }
    
    console.error(errorMsg);
    return throwError(() => new Error(errorMsg));
  }
}
