import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { environment } from '../../environments/environments';
import { AuthService } from '../auth/services/auth.service';
import { from, Observable, Subject, switchMap } from "rxjs";
import {
  ReportDto,
  ReportWithWorkshopsDto,
  WorkshopKafkaEventDto,
  PreviewAttendanceSummaryDto
} from "../interfaces/report.interface";

@Injectable({
  providedIn: "root",
})
export class ReportService {
  private readonly reportUrl = `${environment.ms_report}/api/reports`;
  private readonly reportWorkshopUrl = `${environment.ms_report_workshop}/api/reports-workshop`;
  private readonly workshopUrl = `${environment.ms_report_workshop}/api/workshop-cache`;

  // Observable para notificar cambios en los reportes
  reportActualizar = new Subject<ReportWithWorkshopsDto[]>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // Agrega headers de autorización con el token actual
  private withAuthHeaders(): Observable<HttpHeaders> {
    return from(this.authService.getToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        });
        return from([headers]);
      })
    );
  }

  /**
   * Lista reportes aplicando filtros opcionales.
   */
  listReportsByFilter(
    trimester?: string,
    active?: string,
    year?: number,
    workshopDateStart?: string,
    workshopDateEnd?: string
  ): Observable<ReportWithWorkshopsDto[]> {
    return this.withAuthHeaders().pipe(
      switchMap(headers => {
        let params = new HttpParams();
        if (trimester) params = params.set('trimester', trimester);
        if (active) params = params.set('status', active);
        if (year) params = params.set('year', year.toString());
        if (workshopDateStart) params = params.set('workshopDateStart', workshopDateStart);
        if (workshopDateEnd) params = params.set('workshopDateEnd', workshopDateEnd);
        return this.http.get<ReportWithWorkshopsDto[]>(this.reportWorkshopUrl, { headers, params });
      })
    );
  }

  /**
   * Obtiene un reporte por ID con filtro de fechas para talleres.
   */
  getReportByIdWithDateFilter(reportId: number, workshopDateStart?: string, workshopDateEnd?: string): Observable<ReportWithWorkshopsDto> {
    return this.withAuthHeaders().pipe(
      switchMap(headers => {
        let params = new HttpParams();
        if (workshopDateStart) params = params.set('workshopDateStart', workshopDateStart);
        if (workshopDateEnd) params = params.set('workshopDateEnd', workshopDateEnd);
        return this.http.get<ReportWithWorkshopsDto>(`${this.reportWorkshopUrl}/${reportId}/filtered`, { headers, params });
      })
    );
  }

  /**
   * Crea un nuevo reporte
   */
  createReport(report: ReportWithWorkshopsDto): Observable<ReportWithWorkshopsDto> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.post<ReportWithWorkshopsDto>(this.reportWorkshopUrl, report, { headers })
      )
    );
  }

  /**
   * Actualiza un reporte existente
   */
  updateReportById(reportId: number, report: ReportWithWorkshopsDto): Observable<ReportWithWorkshopsDto> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.put<ReportWithWorkshopsDto>(`${this.reportWorkshopUrl}/${reportId}`, report, { headers })
      )
    );
  }

  updateReport(report: ReportWithWorkshopsDto): Observable<ReportWithWorkshopsDto> {
    return this.updateReportById(report.report.id, report);
  }

  /**
   * Elimina (desactiva) un reporte
   */
  deleteReport(reportId: number): Observable<void> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.delete<void>(`${this.reportWorkshopUrl}/${reportId}`, { headers })
      )
    );
  }

  /**
   * Restaura un reporte desactivado
   */
  restoreReport(reportId: number): Observable<ReportDto> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.put<ReportDto>(`${this.reportWorkshopUrl}/restore/${reportId}`, {}, { headers })
      )
    );
  }

  /**
   * Elimina permanentemente un reporte
   */
  deleteReportPermanently(reportId: number): Observable<void> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.delete<void>(`${this.reportWorkshopUrl}/hard-delete/${reportId}`, { headers })
      )
    );
  }

  /**
   * Descarga un archivo (PDF o PPTX) del reporte, opcionalmente filtrado por fechas de taller
   */
  downloadReportFile(
    reportId: number,
    tipo: 'pdf' | 'pptx',
    workshopDateStart?: string,
    workshopDateEnd?: string
  ): Observable<Blob> {
    return this.withAuthHeaders().pipe(
      switchMap(headers => {
        let params = new HttpParams();
        if (workshopDateStart) {
          params = params.set('startDate', workshopDateStart);
        }
        if (workshopDateEnd) {
          params = params.set('endDate', workshopDateEnd);
        }

        return this.http.get(`${this.reportWorkshopUrl}/export/${tipo}/${reportId}`, {
          headers,
          params,
          responseType: 'blob'
        });
      })
    );
  }

  /**
   * Lista los talleres en cache
   */
  listWorkshopCache(status?: string): Observable<WorkshopKafkaEventDto[]> {
    return this.withAuthHeaders().pipe(
      switchMap(headers => {
        let params = new HttpParams();
        if (status) {
          params = params.set('status', status);
        }
        return this.http.get<WorkshopKafkaEventDto[]>(this.workshopUrl, { headers, params });
      })
    );
  }

  /**
   * Obtiene un taller específico del cache por ID
   */
  getWorkshopCacheById(id: number): Observable<WorkshopKafkaEventDto> {
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.get<WorkshopKafkaEventDto>(`${this.workshopUrl}/${id}`, { headers })
      )
    );
  }

  /**
   * Verifica si ya existe un reporte para el año y trimestre especificado
   */
  checkReportExists(year: number, trimester: string): Observable<boolean> {
    return this.withAuthHeaders().pipe(
      switchMap(headers => {
        const params = new HttpParams()
          .set('year', year.toString())
          .set('trimester', trimester);
        return this.http.get<boolean>(`${this.reportUrl}/exist`, { headers, params });
      })
    );
  }

  /**
 * Obtiene un resumen de asistencia previo para un taller específico (sin necesidad de crear un reporte).
 */
  getPreviewAttendanceSummary(workshopId: number): Observable<PreviewAttendanceSummaryDto[]> {
    const previewUrl = `${environment.ms_report_workshop}/api/attendance-preview/workshop/${workshopId}`;
    return this.withAuthHeaders().pipe(
      switchMap(headers =>
        this.http.get<PreviewAttendanceSummaryDto[]>(previewUrl, { headers })
      )
    );
  }
}
