import React from 'react';
import { Dumbbell, Utensils, Scale } from 'lucide-react';
import { PostType } from '../../types/posts';
import './PostTypeSelector.css';

interface PostTypeSelectorProps {
  selectedType: PostType;
  detectedType?: PostType;
  onChange: (type: PostType) => void;
  disabled?: boolean;
}

export const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({
  selectedType,
  detectedType,
  onChange,
  disabled = false
}) => {
  const postTypes: { type: PostType; label: string; icon: typeof Dumbbell }[] = [
    { type: 'workout', label: 'Workout', icon: Dumbbell },
    { type: 'meal', label: 'Meal', icon: Utensils },
    { type: 'weight', label: 'Weight', icon: Scale }
  ];

  return (
    <div className="post-type-selector">
      <label className="post-type-selector__label">
        Post Type
        {detectedType && (
          <span className="post-type-selector__detected">
            (AI detected: {detectedType})
          </span>
        )}
      </label>
      <div className="post-type-selector__options">
        {postTypes.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            disabled={disabled}
            className={`post-type-selector__option ${
              selectedType === type ? 'post-type-selector__option--selected' : ''
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {detectedType === type && (
              <span className="post-type-selector__ai-badge">AI</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
