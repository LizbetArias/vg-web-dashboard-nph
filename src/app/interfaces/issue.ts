export interface Issue {
    id?: number;
    name: string;
    workshopId: number;
    workshopName?: string;
    scheduledTime: string;
    observation: string;
    state: string;
    sesion?: string;
}
