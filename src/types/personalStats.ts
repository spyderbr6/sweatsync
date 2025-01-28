// src/types/personalStats.ts

export enum GoalType {
    CALORIE = 'CALORIE',
    WEIGHT = 'WEIGHT',
    CUSTOM = 'CUSTOM'
}

export enum GoalStatus {
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    ARCHIVED = 'ARCHIVED'
}

export interface Meal {
    name: string;
    calories: number;
    time: string;  // HH:mm format
    notes?: string;
}

export interface DailyMeals {
    breakfast?: Meal[];
    lunch?: Meal[];
    dinner?: Meal[];
    snacks?: Meal[];
}

// Achievement threshold configuration
export interface AchievementThreshold {
    streakDays: number;
    message: string;
    postToFeed: boolean;
}

export interface PersonalGoal {
    id: string;
    userID: string;
    type: GoalType;
    name: string;
    target: number;
    currentValue?: number;
    startDate: string;
    endDate?: string;
    streakCount: number;
    bestStreak: number;
    achievementsEnabled: boolean;
    achievementThresholds?: AchievementThreshold[];
    status: GoalStatus;
    createdAt: string;
    updatedAt: string;
}

export interface DailyLog {
    id: string;
    userID: string;
    date: string; // YYYY-MM-DD format
    weight?: number;
    calories?: number;
    meals?: DailyMeals;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// Input types for creating/updating records
export type CreatePersonalGoalInput = Omit<PersonalGoal, 
    'id' | 'streakCount' | 'bestStreak' | 'createdAt' | 'updatedAt'
>;

export type UpdatePersonalGoalInput = Partial<Omit<PersonalGoal, 
    'id' | 'userID' | 'createdAt' | 'updatedAt'
>> & {
    id: string;
};

export type CreateDailyLogInput = Omit<DailyLog, 
    'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateDailyLogInput = Partial<Omit<DailyLog, 
    'id' | 'userID' | 'createdAt' | 'updatedAt'
>> & {
    id: string;
};

// Query types for filtering and listing
export interface DateRangeInput {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

export interface GoalFilterInput {
    type?: GoalType;
    status?: GoalStatus;
}