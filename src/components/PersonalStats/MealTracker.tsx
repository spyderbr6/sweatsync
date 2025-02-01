//src/components/PersonalStats/MealTracker.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Cookie } from 'lucide-react';
import { useUser } from '../../userContext';
import { DailyLog, DailyMeals, Meal } from '../../types/personalStats';
import { createDailyLog, getDailyLogs, updateDailyLog } from '../../utils/personalStatsOperations';
import { MealForm } from './MealForm';
import { Button, IconButton } from './UIComponents';

interface MealSectionProps {
  label: string;
  icon: JSX.Element;
  meals: Meal[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const MealSection: React.FC<MealSectionProps> = ({
  label,
  icon,
  meals,
  onEdit,
  onDelete
}) => (
  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium text-gray-900 dark:text-white">{label}</h3>
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-300">
        {meals.reduce((sum, meal) => sum + meal.calories, 0)} cal
      </span>
    </div>

    <div className="space-y-2">
      {meals.map((meal, index) => (
        <div
          key={index}
          className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-md shadow-xs"
        >
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{meal.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              {meal.calories} cal · {meal.time}
            </p>
          </div>
          <div className="flex gap-2">
            <IconButton onClick={() => onEdit(index)} variant="secondary">
              <Edit2 size={16} />
            </IconButton>
            <IconButton onClick={() => onDelete(index)} variant="danger">
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export function MealTracker() {
  const { userId } = useUser();
  const [todayLog, setTodayLog] = useState<DailyLog | undefined>();
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{
    type: keyof DailyMeals;
    index: number;
  } | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

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

      if (logs && logs.length > 0) {
        setTodayLog(logs[0]);
      } else {
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
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mealTypes.map(({ key, label, icon }) => (
          <MealSection
            key={key}
            label={label}
            icon={icon}
            meals={(todayLog?.meals as DailyMeals)?.[key] || []}
            onEdit={(index) => setEditingMeal({ type: key, index })}
            onDelete={(index) => handleDeleteMeal(key, index)}
          />
        ))}
      </div>

      <Button
        onClick={() => setIsAddingMeal(true)}
        variant="primary"
        className="w-full md:w-auto"
      >
        <Plus size={18} className="mr-2" />
        Add Meal
      </Button>

      {(isAddingMeal || editingMeal) && (
        <MealForm
          onSubmit={handleAddMeal}
          onClose={() => {
            setIsAddingMeal(false);
            setEditingMeal(undefined);
          }}
          editingMeal={editingMeal
            ? ((todayLog?.meals ?? {}) as DailyMeals)[editingMeal.type]?.[editingMeal.index]
            : undefined}
          mealType={editingMeal?.type}
        />
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
}