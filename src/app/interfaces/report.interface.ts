/**
 * Representa los datos básicos de un reporte trimestral.
 */
export interface ReportDto {
    id: number;
    year: number;
    trimester: string;
    descriptionUrl: string;
    scheduleUrl?: string;
    status: string;
}

/**
 * Representa un taller asociado a un reporte, incluyendo posibles imágenes y resumen de asistencia.
 */
export interface ReportWorkshopDto {
    id: number;
    reportId: number;
    workshopId?: number;
    workshopName: string;
    workshopDateStart?: string;
    workshopDateEnd?: string;
    description?: string;
    imageUrl: string[];
    workshopStatus?: string;
    attendanceSummaries?: ReportAttendanceSummaryDto[];
}

/**
 * Agrupa un reporte junto con sus talleres relacionados.
 */
export interface ReportWithWorkshopsDto {
    report: ReportDto;                         // Datos generales del reporte
    workshops: ReportWorkshopDto[];            // Lista de talleres asociados
}

/**
 * Representa una imagen seleccionada por el usuario, útil para previews.
 */
export interface ImageUrl {
    file: File | null;                         // Objeto File de la imagen original (null si ya fue subida)
    preview: string;                           // Imagen en formato base64 para mostrar en pantalla
    name: string;                              // Nombre del archivo (ej: "foto1.jpg")
}

/**
 * Representa un taller disponible desde el microservicio de cache (Kafka).
 */
export interface WorkshopKafkaEventDto {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    state: string;
    personId: string
}

/**
 * DTO que se utiliza para mostrar un resumen previo (preview) de asistencia
 * al seleccionar un taller (`workshopId`) en el formulario.
 *
 * Permite visualizar rápidamente cuántas asistencias, faltas, tardanzas y
 * justificaciones tiene cada persona que participa en ese taller,
 * sin necesidad de haber creado aún el reporte completo.
 */
export interface PreviewAttendanceSummaryDto {
    personId: number;          // ID de la persona
    personName: string;        // Nombre completo de la persona
    presentCount: number;      // Total de asistencias (A)
    absentCount: number;       // Total de faltas (F)
    lateCount: number;         // Total de tardanzas (T)
    justifiedCount: number;    // Total de faltas justificadas (J)
}

/**
 * Resumen de asistencia de una persona a un taller específico.
 */
export interface ReportAttendanceSummaryDto {
    id: number;                                // ID del resumen de asistencia
    reportWorkshopId: number;                  // ID del taller al que pertenece el resumen
    personId: number;                          // ID de la persona
    personName: string;                        // Nombre completo de la persona
    presentCount: number;                      // Cantidad de asistencias
    absentCount: number;                       // Cantidad de faltas
    lateCount: number;                         // Cantidad de tardanzas
    justifiedCount: number;                    // Cantidad de faltas justificadas
}