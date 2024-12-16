// ChallengeDetailPage.tsx
//import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Share2, UserPlus, Trophy, Calendar, Users, Dumbbell, Heart,
  MessageCircle, Clock, Medal, Crown, ExternalLink
} from 'lucide-react';
import { useChallengeDetail } from './useChallengeDetail';

export default function ChallengeDetailPage() {

  const { challengeId } = useParams<{ challengeId: string }>();

  const {
    isLoading,
    error,
    challengeDetails,
    leaderboard,
    activity,
    profileUrls,
    workoutUrls,
  } = useChallengeDetail(challengeId!);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading challenge details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error.message}
        </div>
      </div>
    );
  }

  if (!challengeDetails) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          Challenge not found
        </div>
      </div>
    );
  }

  const progress = challengeDetails.totalWorkouts
    ? (challengeDetails.userParticipation?.workoutsCompleted || 0) / challengeDetails.totalWorkouts * 100
    : 0;

  return (
    <div className="challenge-container">
      {/* Hero Section */}
      <div className="challenge-hero">
        <div className="challenge-header">
          <div>
            <h1 className="challenge-title">
              {challengeDetails.title}
            </h1>
            <p className="challenge-description">
              {challengeDetails.description}
            </p>
          </div>
          <div className="challenge-actions">
            <button className="action-button action-button--share">
              <Share2 size={16} />
              Share
            </button>
            <button className="action-button action-button--invite">
              <UserPlus size={16} />
              Invite
            </button>
          </div>
        </div>

        {/* Progress Section */}
        <div className="progress-section">
          <div className="progress-header">
            <div className="progress-label">
              <Trophy size={20} className="text-blue-500" />
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

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <Calendar className="stat-icon text-blue-500" />
            <p className="stat-value">{challengeDetails.daysRemaining ?? 0}</p>
            <p className="stat-label">Days Left</p>
          </div>
          <div className="stat-card">
            <Users className="stat-icon text-green-500" />
            <p className="stat-value">{challengeDetails.totalParticipants}</p>
            <p className="stat-label">Participants</p>
          </div>
          <div className="stat-card">
            <Dumbbell className="stat-icon text-purple-500" />
            <p className="stat-value">{challengeDetails.userParticipation?.workoutsCompleted ?? 0}</p>
            <p className="stat-label">Your Workouts</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="content-grid">
          {/* Left Column - Your Stats & Leaderboard */}
          <div>
            {/* Personal Stats Card */}
            {challengeDetails.userParticipation && (
              <div className="personal-stats">
                <div className="profile-header">
                  <img
                    src={profileUrls[challengeDetails.userParticipation?.userID || ''] || '/profileDefault.png'}
                    alt="Your profile"
                    className="profile-image"
                  />
                  <div>
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
                      <Trophy className="w-6 h-6 text-blue-600" />
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
                      <Dumbbell className="w-6 h-6 text-green-600" />
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
                {leaderboard.map((user, index) => (
                  <div key={user.id} className="leaderboard-item">
                    <div className="leaderboard-user">
                      <span className="leaderboard-rank">
                        {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                        {index === 1 && <Trophy className="w-5 h-5 text-gray-400" />}
                        {index === 2 && <Trophy className="w-5 h-5 text-amber-600" />}
                      </span>
                      <img
                        src={user.profilePicture}
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
                          <Clock className="w-4 h-4 mr-1" />
                          <time>{new Date(item.timestamp).toLocaleDateString()}</time>
                        </div>
                      </div>

                      <p className="activity-text">{item.content}</p>

                      {item.workoutImage && (
                        <div className="challenge-header">
                          <div className="relative group">
                            <img
                              src={workoutUrls[item.id] || '/picsoritdidnthappen.webp'}
                              alt="Workout"
                              className="activity-image"
                            />
                            <div className="">
                              <ExternalLink className="activity-image-overlay" />
                            </div>
                          </div>

                          <div className="activity-points">
                            <Medal className="w-4 h-4" />
                            <span>+{item.points} points earned</span>
                          </div>
                        </div>
                      )}

                      <div className="activity-actions">
                        <button className="action-button-small">
                          <Heart className="w-4 h-4" />
                          <span className="text-sm">{item.likes}</span>
                        </button>
                        <button className="action-button-small">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm">{item.comments}</span>
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
    </div >
  );
}