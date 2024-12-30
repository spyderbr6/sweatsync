// ChallengeDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import {
    Share2, UserPlus, Trophy, Calendar, Users, Dumbbell, Heart,
    MessageCircle, Clock, Medal, Crown, ExternalLink,
    Trash2, UserMinus
} from 'lucide-react';
import { useChallengeDetail } from './useChallengeDetail';
import InviteFriendsModal from './inviteFriendsModal';
import { shareContent } from './utils/shareAction';
import { promptAction } from './utils/promptAction';
import './challenges.css';
import { ChallengeDetails } from './challengeTypes';
import { removeParticipantFromChallenge, archiveChallenge } from './challengeOperations';
import { useUser } from './userContext';
import ActionMenu from './components/cardActionMenu/cardActionMenu';
import ChallengeDailyPrompt from './utils/challengeDailyPrompt';

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
        isCurrentCreator,
        todaysChallengeCreated,
        profileUrls,
        workoutUrls,
        refreshData
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
    const handleDeleteChallenge = async (challengeId: string) => {
        archiveChallenge(challengeId);
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

    const getChallengeActions = (challenge: ChallengeDetails) => {
        const isOwner = challenge.createdBy === userId;

        return [
            {
                label: 'Delete Challenge',
                icon: <Trash2 size={16} />,
                onClick: () => handleDeleteChallenge(challenge.id),
                destructive: true,
                show: isOwner,
            },
            {
                label: 'Leave Challenge',
                icon: <UserMinus size={16} />,
                onClick: () => handleLeaveChallenge(challenge),
                destructive: true,
                show: challengeDetails.userParticipation?.userID,
            },
            {
                label: 'Share',
                icon: <Share2 size={16} />,
                onClick: () => handleShare(challenge),
                show: true,
            },
        ];
    };

    return (
        <div className="challenge-container">
            {/* Hero Section */}
            <div className="challenge-hero">
                {isCurrentCreator && challengeDetails?.dailyChallenges && !todaysChallengeCreated && challengeId && (
                    <ChallengeDailyPrompt
                        challengeId={challengeId}
                        challengePoints={challengeDetails.dailyChallengePoints || 10}
                        parentTitle={challengeDetails.title || ''}
                        onSuccess={() => { refreshData();
                        }}
                    />
                )}
                <div className="challenge-header">
                    <div>
                        <h1 className="challenge-title">{challengeDetails.title}</h1>
                        <p className="challenge-description">{challengeDetails.description}</p>
                    </div>
                    <div className="challenge-actions">
                        <button
                            className="action-button action-button--invite"
                            onClick={() => setIsInviteModalOpen(true)}
                        >
                            <UserPlus size={16} />
                            Invite
                        </button>
                        <ActionMenu actions={getChallengeActions(challengeDetails)} />

                        {/* Add the modal */}
                        <InviteFriendsModal
                            isOpen={isInviteModalOpen}
                            onClose={() => setIsInviteModalOpen(false)}
                            challengeId={challengeId ?? ''}
                        />
                    </div>
                </div>


                <div className="stats-grid">
                    <div className="stat-card">
                        <Calendar className="stat-icon" />
                        <p className="stat-value">{challengeDetails.daysRemaining ?? 0}</p>
                        <p className="stat-label">Days Left</p>
                        <Users className="stat-icon" />
                        <p className="stat-value">{challengeDetails.totalParticipants}</p>
                        <p className="stat-label">Participants</p>
                    </div>
                    <div className="stat-card">
                        <p className="stat-label">Your Rank</p>

                        <p className="profile-rank">
                            {leaderboard.findIndex(user =>
                                user.id === challengeDetails.userParticipation?.userID
                            ) + 1} of {leaderboard.length}
                        </p>
                    </div>
                    <div className="stat-card">
                        <Dumbbell className="stat-icon" />
                        <p className="stat-value">
                            {challengeDetails.userParticipation?.workoutsCompleted ?? 0}
                        </p>
                        <p className="stat-label">Your Workouts</p>
                        <Trophy className="stat-icon" />
                        <p className="stat-value"> {challengeDetails.userParticipation.points}</p>
                        <p className="stat-label">Points</p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Left Column - Your Stats & Leaderboard */}
                <div>
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