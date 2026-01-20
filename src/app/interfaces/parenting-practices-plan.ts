import { Session } from './session';

export interface ParentingPracticesPlan {
    id?: number;
    sessionId: number;
    startDate?: Date;
    preparedBy?: string;
    topic?: string;
    objective?: string;
    goal?: string;
    generalStatus?: string;
    createdDate?: Date;
    updatedDate?: Date;
    session?: Session;
}
