//src/createChallengeModal.tsx
import React, { useState } from 'react';
import { X,Dumbbell,Utensils, Scale } from 'lucide-react';
import { useDataVersion } from './dataVersionContext';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { ChallengeType } from './challengeTypes';

const client = generateClient<Schema>();

interface CreateChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Add validation check
const isValidChallengeType = (type: ChallengeType): boolean => {
    return type !== ChallengeType.NONE;
};


interface ChallengeFormData {
    // Existing base fields
    title: string;
    description: string;
    challengeType: ChallengeType;
    totalWorkouts: number;
    startDate: string;
    endDate: string;
    basePointsPerWorkout: number;

    // New tracking flags
    trackWorkouts: boolean;
    trackMeals: boolean;
    trackWeight: boolean;
    requireWeeklyWeighIn: boolean;
    weighInDay?: string;

    // Existing group rules
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
        // Existing defaults
        title: '',
        description: '',
        challengeType: ChallengeType.NONE,
        totalWorkouts: 30,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        basePointsPerWorkout: 10,

        // New tracking defaults
        trackWorkouts: true,
        trackMeals: false,
        trackWeight: false,
        requireWeeklyWeighIn: false,
        weighInDay: 'MONDAY',

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
    const showGroupRules = formData.challengeType === 'GROUP';
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
        if (formData.challengeType !== 'GROUP') {
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
            if (!isValidChallengeType(formData.challengeType)) {
                throw new Error('Please select a valid challenge type');
            }

            // Validate tracking options
            if (formData.trackWeight && formData.requireWeeklyWeighIn && !formData.weighInDay) {
                throw new Error('Please select a weigh-in day');
            }

            const now = new Date().toISOString()

            // Create challenge with all fields in one operation
            const challengeResult = await client.models.Challenge.create({
                title: formData.title,
                description: formData.description,
                challengeType: formData.challengeType,
                totalWorkouts: formData.totalWorkouts,
                startAt: new Date(formData.startDate).toISOString(),
                endAt: new Date(formData.endDate).toISOString(),
                createdAt: now,
                updatedAt: now,
                createdBy: userId,
                status: 'ACTIVE',
                basePointsPerWorkout: formData.basePointsPerWorkout,
                isActive: true,

                // Add new tracking fields
                trackWorkouts: formData.trackWorkouts,
                trackMeals: formData.trackMeals,
                trackWeight: formData.trackWeight,
                requireWeeklyWeighIn: formData.requireWeeklyWeighIn,
                weighInDay: formData.requireWeeklyWeighIn ? formData.weighInDay : undefined,

                // Add group-specific fields if it's a group challenge
                ...(formData.challengeType === ChallengeType.GROUP && {
                    maxPostsPerDay: formData.groupRules.maxPostsPerDay,
                    maxPostsPerWeek: formData.groupRules.maxPostsPerWeek,
                    dailyChallenges: formData.groupRules.enableDailyChallenges,
                    rotationIntervalDays: formData.groupRules.rotationIntervalDays,
                    dailyChallengePoints: formData.groupRules.dailyChallengePoints,
                    currentCreatorId: userId,
                    nextRotationDate: new Date(Date.now() +
                        formData.groupRules.rotationIntervalDays * 86400000).toISOString()
                })
            });

            if (!challengeResult.data) {
                throw new Error('Failed to create challenge');
            }

            await Promise.all([
                // Create initial participant
                client.models.ChallengeParticipant.create({
                    challengeID: challengeResult.data.id,
                    userID: userId,
                    status: 'ACTIVE',
                    points: 0,
                    workoutsCompleted: 0,
                    joinedAt: now,
                    updatedAt: now
                }),
                // Create reminder schedule
                client.models.ReminderSchedule.create({
                    userId,
                    challengeId: challengeResult.data.id,
                    type: formData.challengeType === ChallengeType.GROUP ? 'GROUP_POST' : 'DAILY_POST',
                    scheduledTime: now,
                    repeatDaily: true,
                    status: 'PENDING',
                    createdAt: now,
                    updatedAt: now,
                    nextScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
            ]);


            onSuccess();
            incrementVersion();
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

                    {/* Workout tracking options section*/}
                    <div className="tracking-options-section">
                        <h3 className="form-section-title">Challenge Activities</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Select which activities participants need to track in this challenge
                        </p>

                        <div className="space-y-4">
                            {/* Workout Tracking - Default */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Dumbbell className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <label className="font-medium text-gray-900">
                                            Track Workouts
                                        </label>
                                        <p className="text-sm text-gray-500">
                                            Participants post their exercise activities
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="trackWorkouts"
                                        name="trackWorkouts"
                                        checked={formData.trackWorkouts}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            trackWorkouts: e.target.checked
                                        }))}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                </div>
                            </div>

                            {/* Meal Tracking Option */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Utensils className="w-5 h-5 text-green-600" />
                                    <div>
                                        <label className="font-medium text-gray-900">
                                            Track Meals
                                        </label>
                                        <p className="text-sm text-gray-500">
                                            Participants log their daily meals
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="trackMeals"
                                        name="trackMeals"
                                        checked={formData.trackMeals}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            trackMeals: e.target.checked
                                        }))}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                </div>
                            </div>

                            {/* Weight Tracking Option */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Scale className="w-5 h-5 text-purple-600" />
                                    <div>
                                        <label className="font-medium text-gray-900">
                                            Track Weight
                                        </label>
                                        <p className="text-sm text-gray-500">
                                            Participants track their weight progress
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="trackWeight"
                                        name="trackWeight"
                                        checked={formData.trackWeight}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            trackWeight: e.target.checked,
                                            // Reset weigh-in settings if unchecked
                                            requireWeeklyWeighIn: e.target.checked ? prev.requireWeeklyWeighIn : false
                                        }))}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                </div>
                            </div>

                            {/* Weekly Weigh-in Settings - Only show if weight tracking is enabled */}
                            {formData.trackWeight && (
                                <div className="ml-8 mt-2 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="requireWeeklyWeighIn"
                                            name="requireWeeklyWeighIn"
                                            checked={formData.requireWeeklyWeighIn}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                requireWeeklyWeighIn: e.target.checked
                                            }))}
                                            className="form-checkbox h-4 w-4 text-blue-600"
                                        />
                                        <label htmlFor="requireWeeklyWeighIn" className="text-sm text-gray-700">
                                            Require weekly weigh-ins
                                        </label>
                                    </div>

                                    {formData.requireWeeklyWeighIn && (
                                        <div className="flex items-center gap-3">
                                            <label htmlFor="weighInDay" className="text-sm text-gray-700">
                                                Weigh-in day:
                                            </label>
                                            <select
                                                id="weighInDay"
                                                name="weighInDay"
                                                value={formData.weighInDay}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    weighInDay: e.target.value
                                                }))}
                                                className="form-select text-sm"
                                            >
                                                {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(day => (
                                                    <option key={day} value={day}>{day.charAt(0) + day.slice(1).toLowerCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                                {formData.challengeType === 'GROUP' ? (
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