import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Cookie } from 'lucide-react';
import { useUser } from '../../userContext';
import { DailyLog, DailyMeals, Meal } from '../../types/personalStats';
import { createDailyLog, getDailyLogs, updateDailyLog } from '../../utils/personalStatsOperations';
import { MealForm } from './MealForm';
import './MealTracker.css';

export function MealTracker() {
  const { userId } = useUser();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{
    type: keyof DailyMeals;
    index: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mealTypes: Array<{
    key: keyof DailyMeals;
    label: string;
    icon: JSX.Element;
  }> = [
    { key: 'breakfast', label: 'Breakfast', icon: <Cookie className="meal-icon" /> },
    { key: 'lunch', label: 'Lunch', icon: <Cookie className="meal-icon" /> },
    { key: 'dinner', label: 'Dinner', icon: <Cookie className="meal-icon" /> },
    { key: 'snacks', label: 'Snacks', icon: <Cookie className="meal-icon" /> }
  ];

  useEffect(() => {
    loadTodayLog();
  }, [userId]);

  const loadTodayLog = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const logs = await getDailyLogs(userId, {
        startDate: today,
        endDate: today
      });

      // Check if logs exists and has items
      if (logs && logs.length > 0) {
        setTodayLog(logs[0]);
      } else {
        // Create new log for today
        const newLog = await createDailyLog({
          userID: userId,
          date: today,
          meals: {
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: []
          }
        });
        
        if (newLog) {
          setTodayLog(newLog);
        } else {
          setError('Failed to create daily log');
        }
      }
    } catch (err) {
      setError('Failed to load meal data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeal = async (mealType: keyof DailyMeals, meal: Meal) => {
    if (!todayLog?.id) return;

    try {
      const currentMeals = (todayLog.meals as DailyMeals) ?? {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      };

      const updatedMeals = {
        ...currentMeals,
        [mealType]: [...(currentMeals[mealType] || []), meal]
      };

      // Calculate total calories
      const totalCalories = Object.values(updatedMeals)
        .flat()
        .reduce((sum, meal) => sum + meal.calories, 0);

      const updatedLog = await updateDailyLog({
        id: todayLog.id,
        meals: updatedMeals,
        calories: totalCalories
      });

      if (updatedLog) {
        setTodayLog(updatedLog);
      }
      setIsAddingMeal(false);
    } catch (err) {
      setError('Failed to add meal');
      console.error(err);
    }
  };

  const handleDeleteMeal = async (mealType: keyof DailyMeals, index: number) => {
    if (!todayLog?.id) return;

    try {
      const currentMeals = (todayLog.meals as DailyMeals) ?? {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      };
      const updatedMeals = {
        ...currentMeals,
        [mealType]: (currentMeals[mealType] ?? []).filter((_, i) => i !== index)
      };

      // Recalculate total calories
      const totalCalories = Object.values(updatedMeals)
        .flat()
        .reduce((sum, meal) => sum + meal.calories, 0);

      const updatedLog = await updateDailyLog({
        id: todayLog.id,
        meals: updatedMeals,
        calories: totalCalories
      });

      if (updatedLog) {
        setTodayLog(updatedLog);
      }
    } catch (err) {
      setError('Failed to delete meal');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="meal-tracker-loading">Loading meal tracker...</div>;
  }

  if (error) {
    return <div className="meal-tracker-error">{error}</div>;
  }

  return (
    <div className="meal-tracker">
      <div className="meal-tracker-header">
        <h2>Today's Meals</h2>
        <button 
          className="add-meal-button"
          onClick={() => setIsAddingMeal(true)}
        >
          <Plus size={20} /> Add Meal
        </button>
      </div>

      <div className="meal-sections">
        {mealTypes.map(({ key, label, icon }) => (
          <div key={key} className="meal-section">
            <div className="meal-section-header">
              {icon}
              <h3>{label}</h3>
              <span className="meal-calories">
                {(((todayLog?.meals as DailyMeals)?.[key]) ?? [])
                  .reduce((sum, meal) => sum + (meal?.calories ?? 0), 0)} cal
              </span>
            </div>

            <div className="meal-list">
                              {(((todayLog?.meals as DailyMeals)?.[key]) ?? []).map((meal, index) => (
                <div key={index} className="meal-item">
                  <div className="meal-item-info">
                    <span className="meal-name">{meal.name}</span>
                    <span className="meal-calories">{meal.calories} cal</span>
                  </div>
                  <div className="meal-item-actions">
                    <button
                      className="meal-action-button"
                      onClick={() => setEditingMeal({ type: key, index })}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="meal-action-button delete"
                      onClick={() => handleDeleteMeal(key, index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(isAddingMeal || editingMeal) && (
        <MealForm
        onSubmit={handleAddMeal}
        onClose={() => {
          setIsAddingMeal(false);
          setEditingMeal(null);
        }}
        editingMeal={editingMeal ? 
          ((todayLog?.meals ?? {}) as DailyMeals)[editingMeal.type]?.[editingMeal.index] 
          : undefined}
        mealType={editingMeal?.type}
      />
      )}
    </div>
  );
}