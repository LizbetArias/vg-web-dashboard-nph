// admission-reason.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { AdmissionReason } from '../interfaces/familiaDto';
import { environment } from '../../environments/environments';
import { AuthService } from '../auth/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdmissionReasonService {
  private apiUrl = `${environment.ms_family}/api/v1/admission-reasons`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private withAuthHeaders(): Observable<HttpHeaders> {
    return from(this.authService.getToken()).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        });
        return from([headers]);
      })
    );
  }

  /**
   * Obtiene todas las razones de admisión disponibles
   */
  getAllAdmissionReasons(): Observable<AdmissionReason[]> {
    return this.withAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.get<AdmissionReason[]>(`${this.apiUrl}`, { headers })
      )
    );
  }

  /**
   * Metodo de creacion de razones de admisión
   */
  createReason(admissionReason: AdmissionReason): Observable<AdmissionReason> {
    return this.withAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.post<AdmissionReason>(this.apiUrl, admissionReason, { headers })
      )
    );
  }
}
