import React, { useState } from 'react';
import { X, Scale, Utensils, Trophy } from 'lucide-react';
import { 
  GoalType, 
  GoalStatus,
  CreatePersonalGoalInput, 
  UpdatePersonalGoalInput,
  PersonalGoal 
} from '../../types/personalStats';
import { createPersonalGoal, updatePersonalGoal } from '../../utils/personalStatsOperations';
import { useUser } from '../../userContext';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingGoal?: PersonalGoal;
}

interface AchievementOption {
  streakDays: number;
  postToFeed: boolean;
  message: string;
}

const DEFAULT_ACHIEVEMENTS: AchievementOption[] = [
  { streakDays: 7, postToFeed: true, message: "One week streak!" },
  { streakDays: 30, postToFeed: true, message: "One month streak!" },
  { streakDays: 100, postToFeed: true, message: "100 days strong!" }
];

export function GoalModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  existingGoal 
}: GoalModalProps) {
  const { userId } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreatePersonalGoalInput>({
    type: existingGoal?.type || GoalType.CALORIE,
    name: existingGoal?.name || '',
    target: existingGoal?.target || 0,
    achievementsEnabled: existingGoal?.achievementsEnabled ?? true,
    achievementThresholds: existingGoal?.achievementThresholds || DEFAULT_ACHIEVEMENTS,
    status: GoalStatus.ACTIVE,
    startDate: existingGoal?.startDate || new Date().toISOString(),
    endDate: existingGoal?.endDate,
    userID: userId || ''
  });

  const validateForm = (): boolean => {
    if (!formData.name?.trim()) {
      setError('Goal name is required');
      return false;
    }
    if (!formData.target || formData.target <= 0) {
      setError('Please set a valid target value');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      if (existingGoal) {
        const updateInput: UpdatePersonalGoalInput = {
          id: existingGoal.id,
          ...formData
        };
        await updatePersonalGoal(updateInput);
      } else {
        const createInput: CreatePersonalGoalInput = {
          userID: userId,
          type: formData.type!,
          name: formData.name!,
          target: formData.target!,
          achievementsEnabled: formData.achievementsEnabled!,
          achievementThresholds: formData.achievementThresholds,
          status: GoalStatus.ACTIVE,
          startDate: formData.startDate!,
          endDate: formData.endDate
        };
        await createPersonalGoal(createInput);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving goal:', err);
      setError('Failed to save goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{existingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
          <button onClick={onClose} className="modal-close-button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="goal-form">
          {error && (
            <div className="goal-form-error">
              {error}
            </div>
          )}

          <div className="goal-type-selector">
            {Object.values(GoalType).map(type => (
              <button
                key={type}
                type="button"
                className={`goal-type-button ${formData.type === type ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, type }))}
              >
                {type === GoalType.CALORIE && <Utensils size={20} />}
                {type === GoalType.WEIGHT && <Scale size={20} />}
                {type === GoalType.CUSTOM && <Trophy size={20} />}
                <span>{type}</span>
              </button>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="name">Goal Name</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Daily Calorie Target"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="target">Target {formData.type === GoalType.CALORIE ? '(calories)' : '(lbs)'}</label>
            <input
              type="number"
              id="target"
              value={formData.target || ''}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                target: parseFloat(e.target.value) 
              }))}
              placeholder="Enter target value"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">End Date (Optional)</label>
            <input
              type="date"
              id="endDate"
              value={formData.endDate?.split('T')[0] || ''}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined 
              }))}
              className="form-input"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.achievementsEnabled}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  achievementsEnabled: e.target.checked 
                }))}
              />
              Enable Achievements
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : existingGoal ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}