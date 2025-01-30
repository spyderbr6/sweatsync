import React, { useState, useEffect } from 'react';
import { Scale, Plus, Pencil, Trash2 } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../../amplify/data/resource';
import { useUser } from '../../userContext';
import { Button, IconButton } from './UIComponents';

const client = generateClient<Schema>();

type Nullable<T> = T | null;

type WeightEntry = {
  date: string;
  weight: Nullable<number>;
  notes: Nullable<string>;
}

interface WeightFormProps {
  onSubmit: (weight: number, notes?: string) => Promise<void>;
  onClose: () => void;
  currentWeight: Nullable<number>;
  currentNotes?: string | null;
}

const WeightForm: React.FC<WeightFormProps> = ({ 
  onSubmit, 
  onClose, 
  currentWeight, 
  currentNotes 
}) => {
  const [weight, setWeight] = useState(currentWeight?.toString() || '');
  const [notes, setNotes] = useState(currentNotes || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weight);
    
    if (isNaN(weightNum) || weightNum <= 0) {
      setError('Please enter a valid weight');
      return;
    }

    try {
      await onSubmit(weightNum, notes || undefined);
      onClose();
    } catch (err) {
      setError('Failed to save weight entry');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {currentWeight ? 'Edit Weight Entry' : 'Add Weight Entry'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              placeholder="Enter weight in pounds"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2"
              rows={3}
              placeholder="Add any notes about your weight measurement"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
            >
              {currentWeight != null ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export function WeightTracker() {
  const { userId } = useUser();
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);

  useEffect(() => {
    if (userId) {
      loadWeightEntries();
    }
  }, [userId]);

  const loadWeightEntries = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const result = await client.models.DailyLog.listLogsByDate({
        userID: userId,
        date: {
          between: [
            thirtyDaysAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
          ]
        }
      });

      const entries: WeightEntry[] = (result.data ?? [])
      // Remove the type predicate; just do a standard check:
      .filter((log) => log !== null)
      .map(log => {
        // TS might still think `log` could be `null`, so you can either:
        // a) Non-null assertion (!):  log!
        // b) Or inline check.
        return {
          date:    log!.date,
          weight:  log!.weight ?? null,
          notes:   log!.notes  ?? null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

      setWeightEntries(entries);
      setError(null);
    } catch (err) {
      console.error('Error loading weight entries:', err);
      setError('Failed to load weight entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWeight = async (weight: number, notes?: string) => {
    if (!userId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const existingLog = await client.models.DailyLog.listLogsByDate({
        userID: userId,
        date: { eq: today }
      });

      if (existingLog.data[0]) {
        await client.models.DailyLog.update({
          id: existingLog.data[0].id,
          weight,
          notes: notes || null,
          updatedAt: new Date().toISOString()
        });
      } else {
        await client.models.DailyLog.create({
          userID: userId,
          date: today,
          weight,
          notes: notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await loadWeightEntries();
      setShowForm(false);
      setEditingEntry(null);
    } catch (err) {
      console.error('Error saving weight entry:', err);
      throw err;
    }
  };

  const handleDeleteEntry = async (date: string) => {
    if (!userId) return;

    try {
      const result = await client.models.DailyLog.listLogsByDate({
        userID: userId,
        date: { eq: date }
      });

      const log = result.data[0];
      if (log?.id) {
        await client.models.DailyLog.delete({
          id: log.id
        });
        await loadWeightEntries();
      }
    } catch (err) {
      console.error('Error deleting weight entry:', err);
      setError('Failed to delete weight entry');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Scale className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold">Weight Tracker</h2>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Add Weight
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {weightEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No weight entries yet. Click "Add Weight" to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {weightEntries.map((entry) => (
            <div
              key={entry.date}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">
                  {new Date(entry.date).toLocaleDateString()}
                </div>
                <div className="text-lg font-semibold text-blue-600">
                  {entry.weight !== null ? `${entry.weight} lbs` : 'No weight recorded'}
                </div>
                {entry.notes && (
                  <div className="text-sm text-gray-600 mt-1">
                    {entry.notes}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <IconButton
                  onClick={() => setEditingEntry(entry)}
                  variant="secondary"
                  aria-label="Edit entry"
                >
                  <Pencil size={20} />
                </IconButton>
                <IconButton
                  onClick={() => handleDeleteEntry(entry.date)}
                  variant="danger"
                  aria-label="Delete entry"
                >
                  <Trash2 size={20} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showForm || editingEntry) && (
        <WeightForm
          onSubmit={handleSubmitWeight}
          onClose={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
          currentWeight={editingEntry?.weight ?? null}
          currentNotes={editingEntry?.notes}
        />
      )}
    </div>
  );
}