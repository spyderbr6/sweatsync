import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useDataVersion } from './dataVersionContext';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { createChallengeRules } from './challengeRules';


const client = generateClient<Schema>();

interface CreateChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

enum ChallengeType {
    NONE = 'none',
    PUBLIC = 'public',
    GROUP = 'group',
    FRIENDS = 'friends',
    PERSONAL = 'personal'
}

// Add validation check
const isValidChallengeType = (type: ChallengeType): boolean => {
    return type !== ChallengeType.NONE;
};


interface ChallengeFormData {
    // Base challenge fields
    title: string;
    description: string;
    challengeType: ChallengeType;  // Using the enum
    totalWorkouts: number;
    startDate: string;
    endDate: string;
    basePointsPerWorkout: number;

    // Group challenge specific fields - Make required fields non-optional
    groupRules: {
        maxPostsPerDay: number;
        maxPostsPerWeek: number;
        enableDailyChallenges: boolean;
        rotationIntervalDays: number;
        dailyChallengePoints: number;
    }
}

export function CreateChallengeModal({ isOpen, onClose, onSuccess }: CreateChallengeModalProps) {
    const { userId } = useUser();
    const [formData, setFormData] = useState<ChallengeFormData>({
        title: '',
        description: '',
        challengeType: ChallengeType.NONE,
        totalWorkouts: 30,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        basePointsPerWorkout: 10,
        groupRules: {
            maxPostsPerDay: 1,
            maxPostsPerWeek: 5,
            enableDailyChallenges: false,
            rotationIntervalDays: 1,
            dailyChallengePoints: 10
        }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { incrementVersion } = useDataVersion();
    const showGroupRules = formData.challengeType === 'group';
    const [error, setError] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [startDateError, setStartDateError] = useState<string | null>(null);
    const [endDateError, setEndDateError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;

        if (name === "title") {
            if (value.length < 5) {
                setTitleError("Title must be at least 5 characters long.");
            } else if (value.length > 50) {
                setTitleError("Title must not exceed 50 characters.");
            } else {
                setTitleError(null); // Clear the error if validation passes
            }
        }
        if (name === "startDate") {
            const startDate = new Date(value);
            const endDate = new Date(formData.endDate);

            if (startDate > endDate) {
                setStartDateError("Start date cannot be later than the end date.");
            } else {
                setStartDateError(null);
            }
        }

        if (name === "endDate") {
            const startDate = new Date(formData.startDate);
            const endDate = new Date(value);

            if (endDate < startDate) {
                setEndDateError("End date cannot be earlier than the start date.");
            } else {
                setEndDateError(null);
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleGroupRulesChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value, type, checked } = e.target;
        const fieldName = name.split('.')[1]; // Get the field name after 'groupRules.'

        setFormData(prev => ({
            ...prev,
            groupRules: {
                ...prev.groupRules,
                [fieldName]: type === 'checkbox' ? checked : Number(value)
            }
        }));
    };

    // Add a function to calculate total workouts
    const calculateTotalWorkouts = (): number => {
        if (formData.challengeType !== 'group') {
            return formData.totalWorkouts;
        }

        // Calculate duration in weeks
        const startDate = new Date(formData.startDate);
        const endDate = new Date(formData.endDate);
        const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const fullWeeks = Math.floor(durationInDays / 7);
        const remainingDays = durationInDays % 7;

        // Calculate base workouts from maxPostsPerWeek
        let totalWorkouts = fullWeeks * (formData.groupRules?.maxPostsPerWeek || 0);

        // Add remaining days' workouts (pro-rated)
        const dailyLimit = formData.groupRules?.maxPostsPerDay || 0;
        const remainingWorkouts = Math.min(
            remainingDays * dailyLimit,
            formData.groupRules?.maxPostsPerWeek || 0
        );
        totalWorkouts += remainingWorkouts;

        // Add daily challenges if enabled
        if (formData.groupRules?.enableDailyChallenges) {
            totalWorkouts += durationInDays; // One daily challenge per day
        }

        return totalWorkouts;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId) {
            setError('User must be logged in to create a challenge');
            return;
        }
        setIsSubmitting(true);

        try {
            // Validate challenge type
            if (!isValidChallengeType(formData.challengeType)) {
                throw new Error('Please select a valid challenge type');
            }

            // Calculate total workouts for group challenges
            const totalWorkouts = formData.challengeType === ChallengeType.GROUP
                ? calculateTotalWorkouts()
                : formData.totalWorkouts;

            // Create the base challenge
            const challengeResult = await client.models.Challenge.create({
                title: formData.title,
                description: formData.description,
                challengeType: formData.challengeType,
                totalWorkouts,
                startAt: new Date(formData.startDate).toISOString(),
                endAt: new Date(formData.endDate).toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: userId, // from useUser hook, 
                status: 'DRAFT'
            });

            if (!challengeResult.data) {
                throw new Error('Failed to create challenge');
            }

            // Create challenge rules
            await createChallengeRules(
                challengeResult.data.id,
                formData.challengeType,
                {
                    endDate: formData.endDate,
                    basePointsPerWorkout: formData.basePointsPerWorkout,
                    isActive: true
                },
                // Only include group rules if it's a group challenge
                formData.challengeType === ChallengeType.GROUP ? {
                    challengeRuleId: challengeResult.data.id, 
                    maxPostsPerDay: formData.groupRules.maxPostsPerDay,
                    maxPostsPerWeek: formData.groupRules.maxPostsPerWeek,
                    dailyChallenges: formData.groupRules.enableDailyChallenges,
                    rotationIntervalDays: formData.groupRules.rotationIntervalDays,
                    dailyChallengePoints: formData.groupRules.dailyChallengePoints
                } : undefined
            );

            // If it's a group challenge, create initial participant entry for creator
            if (formData.challengeType === ChallengeType.GROUP) {
                await client.models.ChallengeParticipant.create({
                    challengeID: challengeResult.data.id,
                    userID: userId,  // TypeScript now knows this is string
                    status: 'ACTIVE',
                    points: 0,
                    workoutsCompleted: 0,
                    joinedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            // Inform parent component of success
            onSuccess();
            incrementVersion(); //this tells certain functions to rerender and pull data as a result of this change.
            // Close the modal
            onClose();

        } catch (error) {
            console.error('Error creating challenge:', error);
            setError(error instanceof Error ? error.message : 'Failed to create challenge');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = (): boolean => {
        return (
            !titleError &&
            !startDateError &&
            !endDateError &&
            formData.title.trim().length > 0 && // Ensure title is not empty
            formData.startDate.trim().length > 0 && // Ensure startDate is not empty
            formData.endDate.trim().length > 0 && // Ensure endDate is not empty
            isValidChallengeType(formData.challengeType) &&
            !isSubmitting
        );
    };

    return (
        <div className="modal-overlay">

            {error && (
                <div className="error-message" >
                    <span>{error} </span>
                    < button
                        onClick={() => setError(null)}
                        className="error-dismiss"
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )
            }

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
                            Challenge Title <span className="required-asterisk">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            className={`form-input ${titleError ? 'input-error' : ''}`}
                            value={formData.title}
                            onChange={handleChange}
                            required
                            maxLength={50} // Prevent typing beyond 50 characters
                        />
                        {titleError && <p className="error-message">{titleError}</p>}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="description">
                            Description <span className="required-asterisk">*</span>
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
                        <label className="form-label" htmlFor="startDate">
                            Start Date <span className="required-asterisk">*</span>
                        </label>
                        <input
                            type="date"
                            id="startDate"
                            name="startDate"
                            className={`form-input ${startDateError ? 'input-error' : ''}`}
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                        />
                        {startDateError && <p className="error-message">{startDateError}</p>}

                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="endDate">
                            End Date <span className="required-asterisk">*</span>
                        </label>
                        <input
                            type="date"
                            id="endDate"
                            name="endDate"
                            className={`form-input ${endDateError ? 'input-error' : ''}`}
                            value={formData.endDate}
                            onChange={handleChange}
                            required
                        />
                        {endDateError && <p className="error-message">{endDateError}</p>}

                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="challengeType">
                            Challenge Type <span className="required-asterisk">*</span>
                        </label>
                        <select
                            id="challengeType"
                            name="challengeType"
                            className={`form-select ${formData.challengeType === ChallengeType.NONE ? 'select-placeholder' : ''}`}
                            value={formData.challengeType}
                            onChange={handleChange}
                            required
                        >
                            <option value={ChallengeType.NONE} disabled>
                                Select a challenge type...
                            </option>
                            <option value={ChallengeType.GROUP}>Group Challenge</option>
                            <option value={ChallengeType.PERSONAL}>Personal Goal</option>
                        </select>
                        {formData.challengeType === ChallengeType.NONE && (
                            <p className="form-helper-text">Please select a challenge type</p>
                        )}
                    </div>

                    {/* Group-specific rules */}
                    {showGroupRules && (
                        <div className="group-rules-section">
                            <h3 className="form-section-title">Group Challenge Rules</h3>

                            <div className="form-group">
                                <label className="form-label" htmlFor="maxPostsPerDay">
                                    Maximum Posts Per Day
                                </label>
                                <input
                                    type="number"
                                    id="maxPostsPerDay"
                                    name="groupRules.maxPostsPerDay"
                                    className="form-input"
                                    value={formData.groupRules?.maxPostsPerDay}
                                    onChange={handleGroupRulesChange}
                                    min="1"
                                    required={showGroupRules}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="maxPostsPerWeek">
                                    Maximum Posts Per Week
                                </label>
                                <input
                                    type="number"
                                    id="maxPostsPerWeek"
                                    name="groupRules.maxPostsPerWeek"
                                    className="form-input"
                                    value={formData.groupRules?.maxPostsPerWeek}
                                    onChange={handleGroupRulesChange}
                                    min="1"
                                    required={showGroupRules}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="enableDailyChallenges">
                                    Enable Daily Challenges
                                </label>
                                <input
                                    type="checkbox"
                                    id="enableDailyChallenges"
                                    name="groupRules.enableDailyChallenges"
                                    checked={formData.groupRules?.enableDailyChallenges}
                                    onChange={handleGroupRulesChange}
                                />
                            </div>

                            {formData.groupRules?.enableDailyChallenges && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="rotationIntervalDays">
                                            Days Between Creator Rotation
                                        </label>
                                        <input
                                            type="number"
                                            id="rotationIntervalDays"
                                            name="groupRules.rotationIntervalDays"
                                            className="form-input"
                                            value={formData.groupRules?.rotationIntervalDays}
                                            onChange={handleGroupRulesChange}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="dailyChallengePoints">
                                            Points for Daily Challenge Completion
                                        </label>
                                        <input
                                            type="number"
                                            id="dailyChallengePoints"
                                            name="groupRules.dailyChallengePoints"
                                            className="form-input"
                                            value={formData.groupRules?.dailyChallengePoints}
                                            onChange={handleGroupRulesChange}
                                            min="1"
                                            required
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {formData.challengeType !== 'none' && (
                        <div className="form-group">
                            <label className="form-label">
                                Total Required Workouts
                            </label>
                            <div className="form-static-value">
                                {formData.challengeType === 'group' ? (
                                    <>
                                        {calculateTotalWorkouts()} workouts
                                        <span className="text-gray-500 text-sm">
                                            (Calculated from challenge rules)
                                        </span>
                                    </>
                                ) : (
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
                                )}
                            </div>
                        </div>
                    )}
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
                            disabled={!canSubmit()} // Disable the button if the form is invalid
                            >
                            {isSubmitting ? 'Creating...' : 'Create Challenge'}
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
}