import { useState, useEffect } from 'react';
import { useUser } from '../../userContext';
import { getActiveGoals} from '../../utils/personalStatsOperations';
import { PersonalGoal, GoalType } from '../../types/personalStats';
import { Trophy, Plus } from 'lucide-react';
import { StatsTrends } from './StatsTrends';
import { MealTracker } from './MealTracker';
import { GoalModal } from './GoalModal';
import './PersonalStats.css';

export function PersonalStatsPage() {
  const { userId } = useUser();
  const [activeGoals, setActiveGoals] = useState<PersonalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const loadData = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const goals = await getActiveGoals(userId);
      setActiveGoals(goals || []);
      setError(null);
    } catch (err) {
      console.error('Error loading personal stats:', err);
      setError('Failed to load stats. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
          onClick={() => loadData()}
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
        <button
          className="stats-new-goal-button"
          onClick={() => setShowGoalModal(true)}
        >
          <Plus size={20} /> Add Goal
        </button>
      </div>

      {activeGoals.length === 0 ? (
        <div className="stats-empty-state">
          <Trophy size={48} />
          <h2>No Goals Set</h2>
          <p>Start tracking your progress by setting your first goal!</p>
          <button
            className="stats-add-goal-button"
            onClick={() => setShowGoalModal(true)}
          >
            Set Your First Goal
          </button>
        </div>
      ) : (
        <>
          {calorieGoal && (
            <StatsTrends
              goalType={GoalType.CALORIE}
              target={calorieGoal.target}
            />
          )}

          {calorieGoal && <MealTracker />}

          {weightGoal && (
            <StatsTrends
              goalType={GoalType.WEIGHT}
              target={weightGoal.target}
            />
          )}
        </>
      )}

      <GoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSuccess={() => {
          setShowGoalModal(false);
          loadData();
        }}
      />
    </div>
  );
}