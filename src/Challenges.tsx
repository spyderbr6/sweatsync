import { useState, useEffect } from 'react';
import { Plus, Trash2, UserMinus, Share2, LucideIcon } from 'lucide-react';
import { CreateChallengeModal } from './CreateChallengeModal';
import { listChallenges, getPendingChallenges, handleChallengeResponses, listAvailableChallenges, addParticipantToChallenge, archiveChallenge, removeParticipantFromChallenge } from './challengeOperations';
import type { Schema } from "../amplify/data/resource";
import './challenges.css';
import { useUser } from './userContext';
import { useDataVersion } from './dataVersionContext';
import { useNavigate } from 'react-router-dom';
import ActionMenu from './components/cardActionMenu/cardActionMenu';
import { shareContent } from './utils/shareAction';
import { ChallengeType } from './challengeTypes';
import { promptAction } from './utils/promptAction';
import { getChallengeStyle, getChallengeIcon, challengeStyles } from './styles/challengeStyles';
import { useUrlCache } from './urlCacheContext';

type StatItem = {
  category: ChallengeCategory;
  label: string;
  IconComponent: LucideIcon;  // Changed to store the component type
  count: number;
  style: ReturnType<typeof getChallengeStyle>;
};
type ChallengeCategory = 'all' | ChallengeType;
type Challenge = Schema["Challenge"]["type"];

function ChallengesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeAvailableFilter, setActiveAvailableFilter] = useState<ChallengeCategory>('all');
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [activeMyFilter, setActiveMyFilter] = useState<ChallengeCategory>('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useUser();
  const [pendingChallenges, setPendingChallenges] = useState<(Challenge & {
    participationId: string;
    inviterName: string;
    inviterPicture: string; 
    invitedAt: string | null;
    expiresIn: number;
  })[]>([]);
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);
  const { incrementVersion } = useDataVersion();
  const navigate = useNavigate();
  const { getStorageUrl } = useUrlCache();


  const loadAllChallenges = async () => {
    try {
      setIsLoading(true);
      const [myChallenges, available, pending] = await Promise.all([
        listChallenges(userId!),
        listAvailableChallenges(userId!),
        getPendingChallenges(userId!,getStorageUrl)
      ]);

      setChallenges(myChallenges);
      setAvailableChallenges(available);
      setPendingChallenges(pending);
    } catch (err) {
      console.error('Error loading challenges:', err);
      setError('Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadAllChallenges();
    }
  }, [userId]);

  const handleNavigateToChallenge = (challengeId: string) => {
    navigate(`/challenge/${challengeId}`);
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      setJoiningChallenge(challengeId);
      await addParticipantToChallenge({
        challengeID: challengeId,
        userID: userId!
      });

      incrementVersion(); //this tells certain functions to rerender and pull data as a result of this change.

      // Refresh challenges to get updated data
      await loadAllChallenges();
    } catch (error) {
      console.error('Error joining challenge:', error);
    } finally {
      setJoiningChallenge(null);
    }
  };

  const handleChallengeResponse = async (participationId: string, accept: boolean) => {
    try {
        const challenge = pendingChallenges.find(c => c.participationId === participationId);
        if (!challenge) return;

        const success = await handleChallengeResponses(participationId, accept, challenge.id, userId!);
        if (success) {
            await loadAllChallenges();
            incrementVersion();
        }
    } catch (err) {
        console.error('Error responding to challenge:', err);
    }
};


  const stats: StatItem[] = Object.values(ChallengeType)
    .filter(type => type !== ChallengeType.NONE && type !== ChallengeType.DAILY)
    .map(challengeType => {
      const style = getChallengeStyle(challengeType);

      // Get the icon component directly from challengeStyles
      const IconComponent = challengeStyles[challengeType].icon;

      return {
        category: challengeType as ChallengeCategory,
        label: style.name,
        IconComponent,  // Store the component itself
        count: challenges.filter(c => c.challengeType === challengeType).length,
        style: style
      };
    });

  const filteredMyChallenges = challenges.filter(challenge =>
    activeMyFilter === 'all' || (challenge.challengeType && challenge.challengeType === activeMyFilter)
  );

  const filteredAvailableChallenges = availableChallenges.filter(challenge =>
    activeAvailableFilter === 'all' || (challenge.challengeType && challenge.challengeType === activeAvailableFilter)
  );

  const handleCategoryClick = (category: ChallengeCategory, section: 'my' | 'available') => {
    if (section === 'my') {
      setActiveMyFilter(category === activeMyFilter ? 'all' : category);
    } else {
      setActiveAvailableFilter(category === activeAvailableFilter ? 'all' : category);
    }
  };
  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const getChallengeActions = (challenge: Challenge) => {
    const isOwner = challenge.createdBy === userId;
    const isParticipating = challenges.some(c => c.id === challenge.id);

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
        onClick: () => handleLeaveChallenge(challenge.id),
        destructive: true,
        show: isParticipating,
      },
      {
        label: 'Share',
        icon: <Share2 size={16} />,
        onClick: () => handleShare(challenge),
        show: true,
      },
    ];
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    archiveChallenge(challengeId);
  };


  async function handleLeaveChallenge(challengeId: string) {
    const confirmed = await promptAction({
      title: "Leave Challenge",
      message: 'Are you sure you want to leave this challenge?',
      confirmText: 'Leave',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      await removeParticipantFromChallenge(challengeId, userId!);
 loadAllChallenges();
      incrementVersion();
    }

  };

  const handleShare = (challenge: Challenge) => {
    shareContent(
      `${challenge.title}:${challenge.description}`,
      'Join me on SweatSync',
      `${import.meta.env.BASE_URL}challenge/${challenge.id}`
    );
  };

  return (
    <div className="challenges-container">
      <div className="challenges-header">
        <div className="header-title-container">
          <h1 className="header-title">Challenges</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus size={20} />
            Create Challenge
          </button>
        </div>

        {pendingChallenges.length > 0 && (
  <div className="friend-challenges">
    <div className="friend-challenges-header">
      <h2 className="friend-challenges-title">
        Pending Challenge Invites
        <span className="invite-count">{pendingChallenges.length}</span>
      </h2>
    </div>
    
    <div className="friend-challenges-scroll">
      {pendingChallenges.map((challenge) => {
        const style = getChallengeStyle(challenge.challengeType, 'default');
        const Icon = getChallengeIcon(challenge.challengeType, {
          size: 20,
          style: { color: style.textColor }
        });

        return (
          <div 
            key={challenge.id} 
            className="friend-challenge-card"
            style={{
              backgroundColor: style.bgColor,
              borderColor: style.borderColor
            }}
          >
            <div className="inviter-section">
              <img
                src={challenge.inviterPicture ?? "/profileDefault.png"}
                alt={challenge.inviterName}
                className="inviter-avatar"
              />
              <div className="inviter-text">
                <span className="inviter-name">{challenge.inviterName}</span>
                <span className="invite-message">invited you</span>
              </div>
            </div>

            <div className="challenge-badge">
              {Icon}
              {style.name}
            </div>

            <h3 className="challenge-name">{challenge.title}</h3>

            <div className="challenge-pending-actions">
              <button
                onClick={() => handleChallengeResponse(challenge.participationId, true)}
                className="accept-button"
                style={{ backgroundColor: style.mainColor }}
              >
                Accept
              </button>
              <button
                onClick={() => handleChallengeResponse(challenge.participationId, false)}
                className="decline-button"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

      </div>


      {/* My Challenges Section */}
      <div className="challenges-section">
        <h2 className="section-title">My Challenges</h2>
        <div className="stats-row">
          {stats.map(({ category, label, IconComponent, style }) => (
            <div
              key={category}
              className={`stat-card ${activeMyFilter === category ? 'stat-card--active' : ''}`}
              onClick={() => handleCategoryClick(category, 'my')}
              role="button"
              tabIndex={0}
            >
              <div className="stat-card-content">
                <div
                  className="stat-icon"
                  style={{
                    backgroundColor: `${style.mainColor}15`,
                    color: style.mainColor
                  }}
                >
                  <IconComponent size={24} />
                </div>
                <div className="stat-text">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">
                    {challenges.filter(c => c.challengeType === category).length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="challenges-grid">
          {isLoading ? (<div>Loading challenges...</div>) : (
            filteredMyChallenges.map(challenge => {
              if (!challenge) return null;

              const style = getChallengeStyle(challenge.challengeType, 'default');
              const Icon = getChallengeIcon(challenge.challengeType, {
                size: 20,
                style: { color: style.mainColor }
              });

              return (
                <div key={challenge.id} className="challenge-card">
                  <div className="challenge-card-header">
                    <div
                      className="challenge-icon-wrapper"
                      style={{
                        backgroundColor: style.bgColor,
                        color: style.textColor
                      }}
                    >
                      {Icon}
                    </div>
                    <div className="challenge-info">
                      <h3
                        className="challenge-title"
                        onClick={() => handleNavigateToChallenge(challenge.id)}
                      >
                        {challenge.title}
                      </h3>
                      <p className="challenge-meta">
                        {challenge.description}
                      </p>
                    </div>
                    <div className="challenge-card-header-menu">
                      <ActionMenu actions={getChallengeActions(challenge)} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Available Challenges Section */}
      <div className="challenges-section">
        <h2 className="section-title">Available Challenges</h2>
        <div className="stats-row">
          {stats.map(({ category, label, IconComponent, style }) => (
            <div
              key={category}
              className={`stat-card ${activeAvailableFilter === category ? 'stat-card--active' : ''}`}
              onClick={() => handleCategoryClick(category, 'available')}
              role="button"
              tabIndex={0}
            >
              <div className="stat-card-content">
                <div
                  className="stat-icon"
                  style={{
                    backgroundColor: `${style.mainColor}15`,
                    color: style.mainColor
                  }}
                >
                  <IconComponent size={24} />
                </div>
                <div className="stat-text">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">
                    {availableChallenges.filter(c => c.challengeType === category).length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="challenges-grid">
          {filteredAvailableChallenges.map(challenge => {
            if (!challenge) return null;

            const style = getChallengeStyle(challenge.challengeType, 'default');
            const Icon = getChallengeIcon(challenge.challengeType, {
              size: 20,
              style: { color: style.mainColor }
            });

            return (
              <div key={challenge.id} className="challenge-card">
                <div className="challenge-card-header">
                  <div
                    className="challenge-icon-wrapper"
                    style={{
                      backgroundColor: style.bgColor,
                      color: style.textColor
                    }}
                  >
                    {Icon}
                  </div>
                  <div className="challenge-info">
                    <h3
                      className="challenge-title"
                      onClick={() => handleNavigateToChallenge(challenge.id)}
                    >
                      {challenge.title}
                    </h3>
                    <p className="challenge-meta">
                      {challenge.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinChallenge(challenge.id)}
                  disabled={joiningChallenge === challenge.id}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: style.mainColor,
                    borderColor: style.mainColor
                  }}
                >
                  {joiningChallenge === challenge.id ? 'Joining...' : 'Join Challenge'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <CreateChallengeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadAllChallenges(); // Refresh challenges after creation
        }}
      />
    </div>
  );
}

export default ChallengesPage;