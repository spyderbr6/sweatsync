// src/components/PersonalStats/PersonalStats.tsx
import React, { useState, useEffect } from 'react';
import { Scale, Utensils, Dumbbell, Activity, BarChart2, TrendingUp, TrendingDown, Minus, Calendar, Trophy } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { useUser } from '../../userContext';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const client = generateClient<Schema>();

interface WeightLog {
  date: string;
  weight: number;
}

interface CalorieLog {
  date: string;
  calories: number;
}

interface WorkoutLog {
  date: string;
  count: number;
}

interface ChallengeParticipationStats {
  totalWorkouts: number;
  activeWeight: number;
  activeCalories: number;
  completedChallenges: number;
  activeChallenges: number;
}

export const PersonalStats: React.FC = () => {
  const { userId } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [calorieLogs, setCalorieLogs] = useState<CalorieLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [challengeStats, setChallengeStats] = useState<ChallengeParticipationStats>({
    totalWorkouts: 0,
    activeWeight: 0,
    activeCalories: 0,
    completedChallenges: 0,
    activeChallenges: 0
  });

  const [weightChange, setWeightChange] = useState<{
    value: number;
    trend: 'up' | 'down' | 'stable';
  }>({
    value: 0,
    trend: 'stable'
  });

  useEffect(() => {
    if (!userId) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch weight posts (for weight tracking)
        const weightPostsResult = await client.models.PostforWorkout.list({
          filter: {
            userID: { eq: userId },
            postType: { eq: 'weight' }
          }
        });
        
        // Process weight data
        const processedWeightLogs: WeightLog[] = [];
        weightPostsResult.data.forEach(post => {
          if (post.weightData && post.createdAt) {
            try {
              const weightData = typeof post.weightData === 'string' 
                ? JSON.parse(post.weightData) 
                : post.weightData;
              
              if (weightData.weight) {
                processedWeightLogs.push({
                  date: new Date(post.createdAt).toISOString().split('T')[0],
                  weight: weightData.weight
                });
              }
            } catch (e) {
              console.error('Error parsing weight data:', e);
            }
          }
        });
        
        // Sort by date
        processedWeightLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setWeightLogs(processedWeightLogs);
        
        // Calculate weight change
        if (processedWeightLogs.length >= 2) {
          const firstWeight = processedWeightLogs[0].weight;
          const latestWeight = processedWeightLogs[processedWeightLogs.length - 1].weight;
          const change = latestWeight - firstWeight;
          
          setWeightChange({
            value: Math.abs(change),
            trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
          });
        }
        
        // Fetch meal posts (for calorie tracking)
        const mealPostsResult = await client.models.PostforWorkout.list({
          filter: {
            userID: { eq: userId },
            postType: { eq: 'meal' }
          }
        });
        
        // Process calorie data
        const processedCalorieLogs: CalorieLog[] = [];
        const caloriesByDay: Record<string, number> = {};
        
        mealPostsResult.data.forEach(post => {
          if (post.mealData && post.createdAt) {
            try {
              const mealData = typeof post.mealData === 'string'
                ? JSON.parse(post.mealData)
                : post.mealData;
              
              if (mealData.calories) {
                const date = new Date(post.createdAt).toISOString().split('T')[0];
                
                // Aggregate calories by day
                caloriesByDay[date] = (caloriesByDay[date] || 0) + mealData.calories;
              }
            } catch (e) {
              console.error('Error parsing meal data:', e);
            }
          }
        });
        
        // Convert aggregated data to logs
        Object.entries(caloriesByDay).forEach(([date, calories]) => {
          processedCalorieLogs.push({ date, calories });
        });
        
        // Sort by date
        processedCalorieLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setCalorieLogs(processedCalorieLogs);
        
        // Fetch workout posts and group by week
        const workoutPostsResult = await client.models.PostforWorkout.list({
          filter: {
            userID: { eq: userId },
            postType: { eq: 'workout' }
          }
        });
        
        // Group workouts by week
        const workoutsByWeek: Record<string, number> = {};
        
        workoutPostsResult.data.forEach(post => {
          if (post.createdAt) {
            const date = new Date(post.createdAt);
            // Get the first day of the week (Sunday)
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            
            workoutsByWeek[weekKey] = (workoutsByWeek[weekKey] || 0) + 1;
          }
        });
        
        // Convert to logs
        const processedWorkoutLogs: WorkoutLog[] = Object.entries(workoutsByWeek).map(
          ([date, count]) => ({ date, count })
        );
        
        // Sort by date
        processedWorkoutLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setWorkoutLogs(processedWorkoutLogs);
        
        // Fetch challenge participation statistics
        const participationResult = await client.models.ChallengeParticipant.list({
          filter: {
            userID: { eq: userId }
          }
        });
        
        // Calculate challenge stats
        const stats: ChallengeParticipationStats = {
          totalWorkouts: 0,
          activeWeight: 0,
          activeCalories: 0,
          completedChallenges: 0,
          activeChallenges: 0
        };
        
        // Get challenge IDs to check for weight/calorie tracking
        const challengeIds = participationResult.data
          .map(p => p.challengeID)
          .filter(id => id) as string[];
        
        if (challengeIds.length > 0) {
          // Fetch challenges to check tracking settings
          const challenges = await Promise.all(
            challengeIds.map(id => client.models.Challenge.get({ id }))
          );
          
          // Count challenges by type
          participationResult.data.forEach(participation => {
            // Count workouts
            stats.totalWorkouts += participation.workoutsCompleted || 0;
            
            // Count challenge status
            if (participation.status === 'ACTIVE') {
              stats.activeChallenges++;
              
              // Find the challenge to check tracking settings
              const challenge = challenges.find(c => 
                c.data?.id === participation.challengeID
              );
              
              if (challenge?.data?.trackWeight) {
                stats.activeWeight++;
              }
              
              if (challenge?.data?.trackMeals) {
                stats.activeCalories++;
              }
            } else if (participation.status === 'COMPLETED') {
              stats.completedChallenges++;
            }
          });
        }
        
        setChallengeStats(stats);
        
      } catch (err) {
        console.error('Error fetching personal stats data:', err);
        setError('Failed to load your health statistics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Personal Health Dashboard</h1>
      
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center mb-2">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-full mr-3">
              <Scale size={20} />
            </div>
            <h3 className="text-lg font-medium text-gray-700">Weight Tracking</h3>
          </div>
          
          <div className="mt-4">
            {weightLogs.length > 0 ? (
              <>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-500">Current</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {weightLogs[weightLogs.length - 1].weight} <span className="text-sm font-normal">lbs</span>
                    </p>
                  </div>
                  
                  {weightLogs.length > 1 && (
                    <div className="flex items-center">
                      {weightChange.trend === 'down' ? (
                        <TrendingDown size={18} className="text-green-500 mr-1" />
                      ) : weightChange.trend === 'up' ? (
                        <TrendingUp size={18} className="text-red-500 mr-1" />
                      ) : (
                        <Minus size={18} className="text-gray-500 mr-1" />
                      )}
                      <span className={`
                        ${weightChange.trend === 'down' ? 'text-green-500' : ''}
                        ${weightChange.trend === 'up' ? 'text-red-500' : ''}
                        ${weightChange.trend === 'stable' ? 'text-gray-500' : ''}
                        font-medium
                      `}>
                        {weightChange.value.toFixed(1)} lbs
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-500 mt-1">
                  {weightLogs.length > 1 ? (
                    <span>From {formatDate(weightLogs[0].date)}</span>
                  ) : (
                    <span>Recorded on {formatDate(weightLogs[0].date)}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4">No weight data recorded yet</p>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center mb-2">
            <div className="bg-green-100 text-green-600 p-2 rounded-full mr-3">
              <Utensils size={20} />
            </div>
            <h3 className="text-lg font-medium text-gray-700">Calorie Tracking</h3>
          </div>
          
          <div className="mt-4">
            {calorieLogs.length > 0 ? (
              <>
                <div>
                  <p className="text-sm text-gray-500">Average Daily</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(
                      calorieLogs.reduce((sum, log) => sum + log.calories, 0) / calorieLogs.length
                    )}
                    <span className="text-sm font-normal"> cal</span>
                  </p>
                </div>
                
                <div className="text-sm text-gray-500 mt-1">
                  Based on {calorieLogs.length} days tracked
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4">No calorie data recorded yet</p>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center mb-2">
            <div className="bg-purple-100 text-purple-600 p-2 rounded-full mr-3">
              <Dumbbell size={20} />
            </div>
            <h3 className="text-lg font-medium text-gray-700">Workouts</h3>
          </div>
          
          <div className="mt-4">
            <div>
              <p className="text-sm text-gray-500">Total Workouts</p>
              <p className="text-2xl font-bold text-gray-900">
                {challengeStats.totalWorkouts}
              </p>
            </div>
            
            <div className="text-sm text-gray-500 mt-1">
              <span>Weekly Avg: {
                workoutLogs.length > 0 
                  ? (
                    Math.round(
                      (workoutLogs.reduce((sum, log) => sum + log.count, 0) / workoutLogs.length) * 10
                    ) / 10
                  ).toFixed(1)
                  : '0'
              }</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center mb-2">
            <div className="bg-amber-100 text-amber-600 p-2 rounded-full mr-3">
              <Trophy size={20} />
            </div>
            <h3 className="text-lg font-medium text-gray-700">Challenges</h3>
          </div>
          
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {challengeStats.activeChallenges}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {challengeStats.completedChallenges}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Weight Trend Chart */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-medium text-gray-700 mb-4">Weight Trend</h3>
          
          {weightLogs.length > 1 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightLogs}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tickCount={5}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} lbs`, 'Weight']}
                    labelFormatter={formatDate}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BarChart2 size={48} className="text-gray-300 mb-2" />
              <p>Not enough data to show trend</p>
              <p className="text-sm">Record your weight regularly to see trends</p>
            </div>
          )}
        </div>
        
        {/* Workout Frequency Chart */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-medium text-gray-700 mb-4">Weekly Workout Frequency</h3>
          
          {workoutLogs.length > 1 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workoutLogs}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={[0, 'dataMax + 2']}
                    tickCount={5}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} workouts`, 'Count']}
                    labelFormatter={(date) => `Week of ${formatDate(date)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BarChart2 size={48} className="text-gray-300 mb-2" />
              <p>Not enough data to show trend</p>
              <p className="text-sm">Complete more workouts to see your trends</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Goals & Active Challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Goals */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-medium text-gray-700 mb-4">Active Health Goals</h3>
          
          {(challengeStats.activeWeight > 0 || challengeStats.activeCalories > 0) ? (
            <div className="space-y-4">
              {challengeStats.activeWeight > 0 && (
                <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                  <Scale className="text-blue-500 mr-3" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Weight Goals</p>
                    <p className="text-sm text-gray-600">
                      You have {challengeStats.activeWeight} active weight tracking {
                        challengeStats.activeWeight === 1 ? 'challenge' : 'challenges'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {challengeStats.activeCalories > 0 && (
                <div className="flex items-center p-3 bg-green-50 rounded-lg">
                  <Utensils className="text-green-500 mr-3" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Calorie Goals</p>
                    <p className="text-sm text-gray-600">
                      You have {challengeStats.activeCalories} active nutrition tracking {
                        challengeStats.activeCalories === 1 ? 'challenge' : 'challenges'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <Activity size={48} className="text-gray-300 mb-2" />
              <p className="text-center">You don't have any active health goals</p>
              <p className="text-sm text-center mt-1">
                Join a challenge with weight or nutrition tracking to set goals
              </p>
            </div>
          )}
        </div>
        
        {/* Recent Health Activity */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-medium text-gray-700 mb-4">Recent Health Activity</h3>
          
          {weightLogs.length > 0 || calorieLogs.length > 0 ? (
            <div className="space-y-4">
              {/* Show the 5 most recent activities, either weight or calorie entries */}
              {[...weightLogs.map(log => ({ 
                type: 'weight' as const, 
                date: log.date, 
                value: log.weight 
              })), ...calorieLogs.map(log => ({ 
                type: 'calorie' as const, 
                date: log.date, 
                value: log.calories 
              }))]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((activity, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    {activity.type === 'weight' ? (
                      <Scale className="text-blue-500 mr-3" size={20} />
                    ) : (
                      <Utensils className="text-green-500 mr-3" size={20} />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {activity.type === 'weight' 
                          ? `Weighed ${activity.value} lbs` 
                          : `Logged ${activity.value} calories`
                        }
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDate(activity.date)}
                      </p>
                    </div>
                  </div>
                ))
              }
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <Calendar size={48} className="text-gray-300 mb-2" />
              <p className="text-center">No recent health activity recorded</p>
              <p className="text-sm text-center mt-1">
                Track your weight and meals to see your activity here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};