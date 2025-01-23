// src/utils/personalStatsOperations.ts

import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../amplify/data/resource";
import {
    CreatePersonalGoalInput,
    UpdatePersonalGoalInput,
    CreateDailyLogInput,
    UpdateDailyLogInput,
    DateRangeInput,
    GoalFilterInput,
    PersonalGoal,
    DailyLog
} from "../types/personalStats";

const client = generateClient<Schema>();

// Goal Operations
export async function createPersonalGoal(
    input: CreatePersonalGoalInput
): Promise<PersonalGoal | null> {
    try {
        const result = await client.models.PersonalGoal.create({
            ...input,
            streakCount: 0,
            bestStreak: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return result.data as PersonalGoal;
    } catch (error) {
        console.error('Error creating personal goal:', error);
        return null;
    }
}

export async function updatePersonalGoal(
    input: UpdatePersonalGoalInput
): Promise<PersonalGoal | null> {
    try {
        const result = await client.models.PersonalGoal.update({
            ...input,
            updatedAt: new Date().toISOString()
        });
        return result.data as PersonalGoal;
    } catch (error) {
        console.error('Error updating personal goal:', error);
        return null;
    }
}

export async function getActiveGoals(
    userId: string,
    filter?: GoalFilterInput
): Promise<PersonalGoal[]> {
    try {
        const result = await client.models.PersonalGoal.listGoalsByType({
            userID: userId,
            //status: { eq: filter?.status || 'ACTIVE' },
            type: filter?.type ? { eq: filter.type } : undefined
        });
        return result.data as PersonalGoal[];
    } catch (error) {
        console.error('Error fetching active goals:', error);
        return [];
    }
}

// Daily Log Operations
export async function createDailyLog(
    input: CreateDailyLogInput
): Promise<DailyLog | null> {
    try {
        const result = await client.models.DailyLog.create({
            ...input,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return result.data as DailyLog;
    } catch (error) {
        console.error('Error creating daily log:', error);
        return null;
    }
}

export async function updateDailyLog(
    input: UpdateDailyLogInput
): Promise<DailyLog | null> {
    try {
        const result = await client.models.DailyLog.update({
            ...input,
            updatedAt: new Date().toISOString()
        });
        return result.data as DailyLog;
    } catch (error) {
        console.error('Error updating daily log:', error);
        return null;
    }
}

export async function getDailyLogs(
    userId: string,
    dateRange: DateRangeInput
): Promise<DailyLog[]> {
    try {
        const result = await client.models.DailyLog.listLogsByDate({
            userID: userId,
            date: {
                between: [dateRange.startDate, dateRange.endDate]
            }
        });
        return result.data as DailyLog[];
    } catch (error) {
        console.error('Error fetching daily logs:', error);
        return [];
    }
}

// Streak Calculation Helper
export async function calculateCurrentStreak(
    userId: string,
    goalId: string
): Promise<number> {
    const today = new Date();
    let currentDate = new Date(today);
    currentDate.setHours(0, 0, 0, 0);

    let streak = 0;
    //const logs: DailyLog[] = [];

    try {
        while (true) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const result = await client.models.DailyLog.listLogsByDate({
                userID: userId,
                date: { eq: dateStr }
            });

            const log = result.data[0] as DailyLog;
            if (!log) break;

            // Check if goal was met for this day
            const goalMet = await checkGoalMet(log, goalId);
            if (!goalMet) break;

            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return streak;
    } catch (error) {
        console.error('Error calculating streak:', error);
        return 0;
    }
}

// Helper function to check if a goal was met for a given day
async function checkGoalMet(log: DailyLog, goalId: string): Promise<boolean> {
    try {
        const goalResult = await client.models.PersonalGoal.get({
            id: goalId
        });
        const goal = goalResult.data;
        if (!goal) return false;

        switch (goal.type) {
            case 'CALORIE':
                return log.calories !== undefined && log.calories <= goal.target;
            case 'WEIGHT':
                return log.weight !== undefined && log.weight <= goal.target;
            case 'CUSTOM':
                // Implement custom goal logic here
                return false;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error checking goal met:', error);
        return false;
    }
}