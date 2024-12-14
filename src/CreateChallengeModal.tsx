import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createChallenge } from './challengeOperations';

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ChallengeFormData {
  title: string;
  description: string;
  challengeType: 'public' | 'group' | 'friends' | 'personal';
  totalWorkouts: number;
  startDate: string;
  endDate: string;
}

export function CreateChallengeModal({ isOpen, onClose, onSuccess }: CreateChallengeModalProps) {
  const [formData, setFormData] = useState<ChallengeFormData>({
    title: '',
    description: '',
    challengeType: 'public',
    totalWorkouts: 30,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createChallenge({
        title: formData.title,
        description: formData.description,
        challengeType: formData.challengeType,
        totalWorkouts: formData.totalWorkouts,
        startAt: new Date(formData.startDate),
        endAt: new Date(formData.endDate),
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating challenge:', error);
      // You might want to add error handling/display here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Create New Challenge</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Challenge Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challengeType">
              Challenge Type
            </label>
            <select
              id="challengeType"
              name="challengeType"
              className="form-select"
              value={formData.challengeType}
              onChange={handleChange}
              required
            >
              <option value="public">Public Challenge</option>
              <option value="group">Group Challenge</option>
              <option value="friends">Friend Challenge</option>
              <option value="personal">Personal Goal</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="totalWorkouts">
              Total Workouts Goal
            </label>
            <input
              type="number"
              id="totalWorkouts"
              name="totalWorkouts"
              className="form-input"
              value={formData.totalWorkouts}
              onChange={handleChange}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="startDate">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              className="form-input"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="endDate">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              className="form-input"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}