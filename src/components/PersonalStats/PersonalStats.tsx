import { useState, useEffect } from 'react';
import { useUser } from '../../userContext';
import { getActiveGoals, getDailyLogs } from '../../utils/personalStatsOperations';
import { PersonalGoal, GoalType } from '../../types/personalStats';
//import { Trophy, Scale, Utensils } from 'lucide-react';
import { StatsTrends } from './StatsTrends';
import { MealTracker } from './MealTracker';
import './PersonalStats.css';

export function PersonalStatsPage() {
  const { userId } = useUser();
  const [activeGoals, setActiveGoals] = useState<PersonalGoal[]>([]);
  //const [todaysLog, setTodaysLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        
        const [goalsResult] = await Promise.all([
          getActiveGoals(userId),
          getDailyLogs(userId, { startDate: today, endDate: today })
        ]);

        setActiveGoals(goalsResult);
        //setTodaysLog(logsResult[0] || null);
      } catch (err) {
        console.error('Error loading personal stats:', err);
        setError('Failed to load stats. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className="stats-loading-container">
        <div className="stats-loading-spinner"></div>
        <span>Loading your stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-error-container">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="stats-retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  const calorieGoal = activeGoals.find(goal => goal.type === GoalType.CALORIE);
  const weightGoal = activeGoals.find(goal => goal.type === GoalType.WEIGHT);

  return (
    <div className="stats-container">
      <div className="stats-header">
        <h1>Personal Stats</h1>
      </div>

      {/* Calorie goal trends */}
      {calorieGoal && (
        <StatsTrends
          goalType={GoalType.CALORIE}
          target={calorieGoal.target}
        />
      )}

      {/* Meal tracking */}
      <MealTracker />

      {/* Weight goal trends */}
      {weightGoal && (
        <StatsTrends
          goalType={GoalType.WEIGHT}
          target={weightGoal.target}
        />
      )}
    </div>
  );
}