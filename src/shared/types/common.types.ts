export interface User {
    id: string;
    name: string;
    email?: string;
    createdAt: number;
}

export interface Stats {
    totalPracticeTime: number;
    streak: number;
    avgScore: number;
    movesLearned: number;
}

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}