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
import { validateStreak, checkAndProcessAchievements } from './achievementsHandler';


const client = generateClient<Schema>();

// Goal Operations
export async function createPersonalGoal(
    input: CreatePersonalGoalInput
): Promise<PersonalGoal | null> {
    try {
        console.log('Creating personal goal with input:', input);
        const result = await client.models.PersonalGoal.create({
            ...input,
            // Stringify JSON fields
            achievementThresholds: input.achievementThresholds ? JSON.stringify(input.achievementThresholds) : null,
            streakCount: 0,
            bestStreak: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log('Create goal result:', result);
        
        if (result.errors && result.errors.length > 0) {
            console.error('Errors during goal creation:', result.errors);
            throw new Error(result.errors[0].message);
        }
        
        if (!result.data) {
            console.error('No data returned from goal creation');
            return null;
        }
        
        return result.data as PersonalGoal;
    } catch (error) {
        console.error('Full error creating personal goal:', error);
        throw error;
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
        console.log('Fetching active goals for user:', userId);
        const result = await client.models.PersonalGoal.listGoalsByType({
            userID: userId,
            //status: { eq: filter?.status || 'ACTIVE' },
            type: filter?.type ? { eq: filter.type } : undefined
        });
        console.log('Goals result:', result);

        // Parse JSON fields in the results
        const goals = result.data?.map(goal => ({
            ...goal,
            achievementThresholds: goal.achievementThresholds ? 
                JSON.parse(goal.achievementThresholds as string) : 
                null
        })) || [];

        return goals as PersonalGoal[];
    } catch (error) {
        console.error('Error fetching active goals:', error);
        throw error;
    }
}

export async function createDailyLog(
    input: CreateDailyLogInput
): Promise<DailyLog | null> {
    try {
        console.log('Creating daily log with input:', input);
        const result = await client.models.DailyLog.create({
            ...input,
            meals: JSON.stringify(input.meals), // Stringify the meals JSON
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        console.log('Daily log creation result:', result);
        
        if (result.errors && result.errors.length > 0) {
            console.error('Errors during daily log creation:', result.errors);
            throw new Error(result.errors[0].message);
        }

        if (!result.data) {
            console.error('No data returned from daily log creation');
            return null;
        }

        // Get all active goals for the user
        const activeGoals = await getActiveGoals(input.userID);
        
        // Process achievements for each goal
        await Promise.all(activeGoals.map(async (goal) => {
            // Validate if the log meets the goal's criteria
            const isValid = await validateStreak(goal.id, result.data!);
            
            if (isValid) {
                const streak = await calculateCurrentStreak(input.userID, goal.id);
                // Check for any achievements based on the current streak
                await checkAndProcessAchievements(input.userID, goal.id, streak);
                
                // Update the goal's streak count
                await updatePersonalGoal({
                    id: goal.id,
                    streakCount: streak,
                    bestStreak: Math.max(streak, goal.bestStreak || 0)
                });
            }
        }));

        // Parse meals back to object when returning
        return {
            ...result.data,
            meals: result.data.meals ? JSON.parse(result.data.meals as string) : null
        } as DailyLog;
    } catch (error) {
        console.error('Full error creating daily log:', error);
        throw error;
    }
}

export async function updateDailyLog(
    input: UpdateDailyLogInput
): Promise<DailyLog | null> {
    try {
        console.log('Updating daily log with input:', input);
        const result = await client.models.DailyLog.update({
            ...input,
            meals: input.meals ? JSON.stringify(input.meals) : null,
            updatedAt: new Date().toISOString()
        });

        console.log('Daily log update result:', result);

        if (!result.data) {
            console.error('No data returned from daily log update');
            return null;
        }

        // Parse meals back to object when returning
        return {
            ...result.data,
            meals: result.data.meals ? JSON.parse(result.data.meals as string) : null
        } as DailyLog;
    } catch (error) {
        console.error('Error updating daily log:', error);
        throw error;
    }
}

export async function getDailyLogs(
    userId: string,
    dateRange: DateRangeInput
): Promise<DailyLog[]> {
    try {
        console.log('Fetching daily logs for user:', userId, 'range:', dateRange);
        // Query using index defined pattern
        const result = await client.models.DailyLog.list({
            filter: {
                userID: { eq: userId },
                date: { between: [dateRange.startDate, dateRange.endDate] }
            }
        });

        console.log('Daily logs result:', result);

        // Parse meals JSON for each log
        const logs = result.data?.map(log => ({
            ...log,
            meals: log.meals ? JSON.parse(log.meals as string) : null
        })) || [];

        return logs as DailyLog[];
    } catch (error) {
        console.error('Error fetching daily logs:', error);
        throw error;
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
    
    try {
        while (true) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const result = await client.models.DailyLog.list({
                filter: {
                    userID: { eq: userId },
                    date: { eq: dateStr }
                }
            });

            const log = result.data[0];
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
async function checkGoalMet(log: Schema['DailyLog']['type'], goalId: string): Promise<boolean> {
    try {
        const goalResult = await client.models.PersonalGoal.get({
            id: goalId
        });
        const goal = goalResult.data;
        if (!goal) return false;

        switch (goal.type) {
            case 'CALORIE':
                return log.calories != null && log.calories <= goal.target;
            case 'WEIGHT':
                return log.weight != null && log.weight <= goal.target;
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