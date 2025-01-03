// src/components/FeedbackModal/feedbackModal.tsx

import React, { useState } from 'react';
import { X } from 'lucide-react';
import './feedbackModal.css';
import { submitGitHubIssue } from '../../utils/githubUtils';


interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'feedback'>('feedback');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getSystemInfo = () => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString(),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
  
    try {
      const systemInfo = getSystemInfo();
      const issueBody = `### Description\n${description}\n\n### System Information\n\`\`\`json\n${JSON.stringify(systemInfo, null, 2)}\n\`\`\``;
  
      await submitGitHubIssue({
        title: `[${type.toUpperCase()}] ${title}`,
        body: issueBody,
        labels: [type]
      });
  
      // Success - clear form
      setTitle('');
      setDescription('');
      setType('feedback');
      
      // Show success message
      alert('Thank you for your feedback!');
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="feedback-modal">
        <div className="feedback-modal__header">
          <h2 className="feedback-modal__title">Submit Feedback</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-modal__form">
          <div className="form-group">
            <label htmlFor="type" className="form-label">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as 'bug' | 'feature' | 'feedback')}
              className="form-select"
              required
            >
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="feedback">General Feedback</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="feedbacktitle" className="form-label">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              placeholder="Brief summary of your feedback"
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              placeholder="Provide more details..."
              required
              rows={4}
            />
          </div>

          <div className="feedback-modal__actions">
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
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;