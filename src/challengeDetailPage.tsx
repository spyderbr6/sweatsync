// ChallengeDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import {
    Share2, UserPlus, Trophy, Calendar, Users, Dumbbell, Heart,
    MessageCircle, Clock, Medal, Crown, ExternalLink,
    CircleMinus
} from 'lucide-react';
import { useChallengeDetail } from './useChallengeDetail';
import InviteFriendsModal from './inviteFriendsModal';
import { shareContent } from './utils/shareAction';
import { promptAction } from './utils/promptAction';
import './challenges.css';
import { ChallengeDetails } from './challengeTypes';
import { removeParticipantFromChallenge } from './challengeOperations';
import { useUser } from './userContext';

type RouteParams = {
    challengeId: string;
};

export default function ChallengeDetailPage() {
    const { challengeId } = useParams<RouteParams>();
    const {
        isLoading,
        error,
        challengeDetails,
        leaderboard,
        activity,
        profileUrls,
        workoutUrls
    } = useChallengeDetail(challengeId ?? '');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const { userId } = useUser();

    const handleShare = (challenge: ChallengeDetails) => {
        shareContent(
            `${challenge.title}:${challenge.description}`,
            'Join me on SweatSync',
            `${import.meta.env.BASE_URL}challenge/${challenge.id}`
        );
    };

    async function handleLeaveChallenge(challenge: ChallengeDetails) {
        const confirmed = await promptAction({
            title: "Leave Challenge",
            message: 'Are you sure you want to leave this challenge?',
            confirmText: 'Leave',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (confirmed) {
            await removeParticipantFromChallenge(challenge.id, userId || '');
        }

    };

    if (isLoading) {
        return (
            <div className="challenge-container">
                <div className="loading-container">Loading challenge details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="challenge-container">
                <div className="error-container">{error.message}</div>
            </div>
        );
    }

    if (!challengeDetails) {
        return (
            <div className="challenge-container">
                <div className="error-container">Challenge not found</div>
            </div>
        );
    }

    const progress = challengeDetails?.totalWorkouts
        ? (challengeDetails.userParticipation?.workoutsCompleted || 0) / challengeDetails.totalWorkouts * 100
        : 0;

    return (
        <div className="challenge-container">
            {/* Hero Section */}
            <div className="challenge-hero">
                <div className="challenge-header">
                    <div>
                        <h1 className="challenge-title">{challengeDetails.title}</h1>
                        <p className="challenge-description">{challengeDetails.description}</p>
                    </div>
                    <div className="challenge-actions">
                        <button className="action-button action-button--leave"
                            onClick={() => handleLeaveChallenge(challengeDetails)}>
                            <CircleMinus size={16} />
                            Drop
                        </button>

                        <button className="action-button action-button--share"
                            onClick={() => handleShare(challengeDetails)}>
                            <Share2 size={16} />
                            Share
                        </button>
                        <button
                            className="action-button action-button--invite"
                            onClick={() => setIsInviteModalOpen(true)}
                        >
                            <UserPlus size={16} />
                            Invite
                        </button>

                        {/* Add the modal */}
                        <InviteFriendsModal
                            isOpen={isInviteModalOpen}
                            onClose={() => setIsInviteModalOpen(false)}
                            challengeId={challengeId ?? ''}
                        />
                    </div>
                </div>

                <div className="progress-section">
                    <div className="progress-header">
                        <div className="progress-label">
                            <Trophy size={20} />
                            <span>Challenge Progress</span>
                        </div>
                        <span className="progress-count">
                            {challengeDetails.userParticipation?.workoutsCompleted || 0} of{' '}
                            {challengeDetails.totalWorkouts || 0} workouts completed
                        </span>
                    </div>

                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Calendar className="stat-icon" />
                        <p className="stat-value">{challengeDetails.daysRemaining ?? 0}</p>
                        <p className="stat-label">Days Left</p>
                    </div>
                    <div className="stat-card">
                        <Users className="stat-icon" />
                        <p className="stat-value">{challengeDetails.totalParticipants}</p>
                        <p className="stat-label">Participants</p>
                    </div>
                    <div className="stat-card">
                        <Dumbbell className="stat-icon" />
                        <p className="stat-value">
                            {challengeDetails.userParticipation?.workoutsCompleted ?? 0}
                        </p>
                        <p className="stat-label">Your Workouts</p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Left Column - Your Stats & Leaderboard */}
                <div>
                    {challengeDetails.userParticipation && (
                        <div className="personal-stats">
                            <div className="profile-header">
                                <img
                                    src={profileUrls[challengeDetails.userParticipation?.userID || ''] || '/profileDefault.png'}
                                    alt="Your profile"
                                    className="profile-image"
                                />
                                <div className="profile-info">
                                    <h2 className="profile-name">Your Progress</h2>
                                    <p className="profile-rank">
                                        {leaderboard.findIndex(user =>
                                            user.id === challengeDetails.userParticipation?.userID
                                        ) + 1} of {leaderboard.length}
                                    </p>
                                </div>
                            </div>

                            <div className="stats-grid-2">
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper stat-icon-wrapper--points">
                                        <Trophy className="stat-icon" />
                                    </div>
                                    <div>
                                        <p className="stat-label">Points</p>
                                        <p className="stat-value">
                                            {challengeDetails.userParticipation.points}
                                        </p>
                                    </div>
                                </div>

                                <div className="stat-box">
                                    <div className="stat-icon-wrapper stat-icon-wrapper--workouts">
                                        <Dumbbell className="stat-icon" />
                                    </div>
                                    <div>
                                        <p className="stat-label">Workouts</p>
                                        <p className="stat-value">
                                            {challengeDetails.userParticipation.workoutsCompleted}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leaderboard */}
                    <div className="leaderboard">
                        <div className="leaderboard-header">
                            <h3 className="leaderboard-title">Top Performers</h3>
                        </div>
                        <div className="leaderboard-list">
                            {leaderboard.slice(0, 10).map((user, index) => (
                                <div key={user.id} className="leaderboard-item">
                                    <div className="leaderboard-user">
                                        <span className="leaderboard-rank">
                                            {index === 0 && <Crown size={20} />}
                                            {index === 1 && <Trophy size={20} />}
                                            {index === 2 && <Trophy size={20} />}
                                            {index > 2 && index + 1}
                                        </span>
                                        <img
                                            src={profileUrls[user.id] || '/profileDefault.png'}
                                            alt={user.name}
                                            className="leaderboard-avatar"
                                        />
                                        <span className="leaderboard-name">{user.name}</span>
                                    </div>
                                    <div className="leaderboard-points">{user.points} pts</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Activity Feed */}
                <div className="activity-feed">
                    <div className="activity-header">
                        <h2 className="activity-title">Recent Activity</h2>
                    </div>

                    <div className="activity-list">
                        {activity.map((item) => (
                            <div key={item.id} className="activity-item">
                                <div className="activity-content">
                                    <img
                                        src={profileUrls[item.userId] || '/profileDefault.png'}
                                        alt={item.username}
                                        className="activity-avatar"
                                    />

                                    <div className="activity-details">
                                        <div className="activity-meta">
                                            <span className="activity-user">{item.username}</span>
                                            <div className="activity-time">
                                                <Clock size={16} />
                                                <time>{new Date(item.timestamp).toLocaleDateString()}</time>
                                            </div>
                                        </div>

                                        <p className="activity-text">{item.content}</p>

                                        {item.workoutImage && (
                                            <div className="activity-media">
                                                <img
                                                    src={workoutUrls[item.id] || '/picsoritdidnthappen.webp'}
                                                    alt="Workout"
                                                    className="activity-image"
                                                />
                                                <div className="activity-image-overlay">
                                                    <ExternalLink size={20} />
                                                </div>
                                            </div>
                                        )}

                                        <div className="activity-points">
                                            <Medal size={16} />
                                            <span>+{item.points} points earned</span>
                                        </div>

                                        <div className="activity-actions">
                                            <button className="action-button-small">
                                                <Heart size={16} />
                                                <span>{item.likes}</span>
                                            </button>
                                            <button className="action-button-small">
                                                <MessageCircle size={16} />
                                                <span>{item.comments}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}