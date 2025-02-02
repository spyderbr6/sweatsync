import { useState, useEffect } from 'react';
import { Trophy, Plus } from 'lucide-react';
import { useUser } from '../../userContext';
import { getActiveGoals } from '../../utils/personalStatsOperations';
import { PersonalGoal } from '../../types/personalStats';
import { GoalModal } from './GoalModal';
import { Button, ProgressCard } from './UIComponents';
import ActivityHeatmap from './ActivityHeatmap';

export function PersonalStatsPage() {
  const { userId } = useUser();
  const [activeGoals, setActiveGoals] = useState<PersonalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PersonalGoal | undefined>();

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
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p>{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => loadData()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Activity Dashboard
        </h1>
        <Button
          variant="primary"
          onClick={() => setShowGoalModal(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          {activeGoals.length ? 'New Goal' : 'Set a Goal'}
        </Button>
      </header>

      {/* Activity Heatmap Section */}
      {userId && (
        <div className="mb-8">
          <ActivityHeatmap userId={userId} />
        </div>
      )}

      {/* Active Goals Section */}
      {activeGoals.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="mb-4 flex justify-center">
            <Trophy size={48} className="text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            No Active Goals
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Set your first goal to start tracking your fitness journey!
          </p>
          <Button
            variant="primary"
            onClick={() => setShowGoalModal(true)}
          >
            Create First Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeGoals.map(goal => (
            <ProgressCard
              key={goal.id}
              title={goal.name}
              type={goal.type}
              currentValue={goal.currentValue || 0}
              targetValue={goal.target}
              progress={Math.round(((goal.currentValue || 0) / goal.target) * 100)}
              onEdit={() => setEditingGoal(goal)}
            />
          ))}
        </div>
      )}

      {/* Goal Modal */}
      <GoalModal
        isOpen={showGoalModal || !!editingGoal}
        onClose={() => {
          setShowGoalModal(false);
          setEditingGoal(undefined);
        }}
        onSuccess={() => {
          setShowGoalModal(false);
          setEditingGoal(undefined);
          loadData();
        }}
        existingGoal={editingGoal}
      />
    </div>
  );
}