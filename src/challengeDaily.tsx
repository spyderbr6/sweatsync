// src/challengeDaily.tsx

import { useState, useEffect } from 'react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { Calendar, Plus, Trophy } from 'lucide-react';
import { checkAndRotateCreator } from './challengeRules';

const client = generateClient<Schema>();

interface DailyChallengeProps {
    groupChallengeId: string;
    onSuccess?: () => void;
}

interface DailyChallengeData {
    id: string;
    title: string;
    description: string;
    creatorId: string;
    date: string;
    pointsAwarded: number;
    creatorName?: string;
}

interface CreateDailyChallengeFormProps {
    groupChallengeId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DailyChallenge({ groupChallengeId, onSuccess }: DailyChallengeProps) {
    const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeData | null>(null);
    const [isCreator, setIsCreator] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { userId } = useUser();

    useEffect(() => {
        loadDailyChallenge();
    }, [groupChallengeId]);

    const loadDailyChallenge = async () => {
        try {
            setLoading(true);

            await checkAndRotateCreator(groupChallengeId);

            // Get the group challenge rules using the challengeRuleId
            const rulesResult = await client.models.GroupChallengeRules.list({
                filter: {
                    challengeRuleId: { eq: groupChallengeId }  // This links to the base ChallengeRules
                }
            });

            const rules = rulesResult.data[0];
            if (!rulesResult.data || rulesResult.data.length === 0) {
                throw new Error('Group challenge rules not found');
            }

            // Check if user is the current assigned creator
            const isCurrentCreator = rules.currentCreatorId === userId;
            setIsCreator(isCurrentCreator);

            // Get today's challenge if it exists
            const today = new Date().toISOString().split('T')[0];
            const challengesResponse = await client.models.DailyChallenge.list({
                filter: {
                    groupChallengeId: { eq: groupChallengeId },
                    date: { eq: today }
                }
            });

            if (challengesResponse.data.length > 0) {
                const challenge = challengesResponse.data[0];

                // Get creator's name
                const creatorResponse = await client.models.User.get({
                    id: challenge.creatorId
                });

                setDailyChallenge({
                    ...challenge,
                    creatorName: creatorResponse.data?.preferred_username || 'Unknown User'
                });
            } else if (isCurrentCreator) {
                setShowCreateForm(true);
            }

        } catch (error) {
            console.error('Error loading daily challenge:', error);
            setError('Failed to load daily challenge');
        } finally {
            setLoading(false);
        }
    };

    const CreateDailyChallengeForm: React.FC<CreateDailyChallengeFormProps> = ({
        groupChallengeId,
        onSuccess,
        onCancel
    }) => {
        const [formData, setFormData] = useState({
            title: '',
            description: '',
            pointsAwarded: 10  // Default points value
        });
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const { userId } = useUser();

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!userId) {
                setError('User must be logged in to create a challenge');
                return;
            }

            try {
                setIsSubmitting(true);

                await client.models.DailyChallenge.create({
                    groupChallengeId,
                    creatorId: userId,
                    title: formData.title,
                    description: formData.description,
                    date: new Date().toISOString(),
                    pointsAwarded: formData.pointsAwarded,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                onSuccess();
            } catch (error) {
                console.error('Error creating daily challenge:', error);
                setError(error instanceof Error ? error.message : 'Failed to create daily challenge');
            } finally {
                setIsSubmitting(false);
            }
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setFormData(prev => ({
                ...prev,
                [name]: name === 'pointsAwarded' ? Number(value) : value
            }));
        };

        return (
            <form onSubmit={handleSubmit} className="daily-challenge-form">
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="title" className="form-label">
                        Challenge Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="form-input"
                        required
                        placeholder="Give your challenge a title"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description" className="form-label">
                        Description
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="form-input"
                        required
                        placeholder="Describe what participants need to do"
                        rows={3}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="pointsAwarded" className="form-label">
                        Points Awarded
                    </label>
                    <input
                        type="number"
                        id="pointsAwarded"
                        name="pointsAwarded"
                        value={formData.pointsAwarded}
                        onChange={handleChange}
                        className="form-input"
                        required
                        min={1}
                        max={100}
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={onCancel}
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
                        {isSubmitting ? 'Creating...' : 'Create Daily Challenge'}
                    </button>
                </div>
            </form>
        );
    };

    if (loading) {
        return <div className="loading-state">Loading daily challenge...</div>;
    }

    if (error) {
        return <div className="error-state">{error}</div>;
    }

    return (
        <div className="daily-challenge-container">
            <div className="daily-challenge-header">
                <h3 className="daily-challenge-title">
                    <Calendar className="icon" />
                    Daily Challenge
                </h3>
                {isCreator && !dailyChallenge && (
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="btn btn-primary btn-sm"
                    >
                        <Plus size={16} />
                        Create Challenge
                    </button>
                )}
            </div>

            {showCreateForm && isCreator ? (
                <CreateDailyChallengeForm
                    groupChallengeId={groupChallengeId}
                    onSuccess={() => {
                        loadDailyChallenge(); // Refresh the data
                        setShowCreateForm(false); // Hide the form
                        onSuccess?.(); // Call parent success handler if provided
                    }}
                    onCancel={() => setShowCreateForm(false)}
                />
            ) : dailyChallenge ? (
                <div className="daily-challenge-content">
                    <div className="challenge-meta">
                        <span className="creator-name">
                            Created by {dailyChallenge.creatorName}
                        </span>
                        <span className="points">
                            <Trophy size={16} />
                            {dailyChallenge.pointsAwarded} points
                        </span>
                    </div>
                    <h4 className="challenge-title">{dailyChallenge.title}</h4>
                    <p className="challenge-description">
                        {dailyChallenge.description}
                    </p>
                </div>
            ) : (
                <div className="no-challenge-state">
                    No daily challenge has been created yet
                    {isCreator && (
                        <p>As today's assigned creator, you can create one!</p>
                    )}
                </div>
            )}
        </div>
    );
}