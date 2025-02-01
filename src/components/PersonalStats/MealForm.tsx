import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Meal, DailyMeals } from '../../types/personalStats';

interface MealFormProps {
  onSubmit: (type: keyof DailyMeals, meal: Meal) => void;
  onClose: () => void;
  editingMeal?: Meal;
  mealType?: keyof DailyMeals;
}

export function MealForm({ onSubmit, onClose, editingMeal, mealType }: MealFormProps) {
  const [formData, setFormData] = useState<Partial<Meal>>({
    name: editingMeal?.name || '',
    calories: editingMeal?.calories || 0,
    time: editingMeal?.time || new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  });
  const [selectedType, setSelectedType] = useState<keyof DailyMeals>(
    mealType || 'breakfast'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.calories) return;

    onSubmit(selectedType, {
      name: formData.name,
      calories: formData.calories,
      time: formData.time || new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    });
  };

  return (
    <div className="meal-form-overlay">
      <div className="meal-form">
        <div className="meal-form-header">
          <h3>{editingMeal ? 'Edit Meal' : 'Add Meal'}</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {!mealType && (
            <div className="form-group">
              <label>Meal Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as keyof DailyMeals)}
                className="meal-type-select"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snacks">Snacks</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Meal Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Oatmeal with Berries"
              required
              className="meal-input"
            />
          </div>

          <div className="form-group">
            <label>Calories</label>
            <input
              type="number"
              value={formData.calories || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                calories: parseInt(e.target.value) || 0 
              }))}
              placeholder="Enter calories"
              required
              min="0"
              className="meal-input"
            />
          </div>

          <div className="form-group">
            <label>Time</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              required
              className="meal-input"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button">
              {editingMeal ? 'Update Meal' : 'Add Meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}