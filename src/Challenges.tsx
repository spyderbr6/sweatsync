import { useState, useEffect } from 'react';
import { Users, UserPlus, Target, Globe, Plus, Trash2, UserMinus, Share2 } from 'lucide-react';
import { CreateChallengeModal } from './CreateChallengeModal';
import { listChallenges, checkChallengeParticipation, addParticipantToChallenge, archiveChallenge,removeParticipantFromChallenge } from './challengeOperations';
import type { Schema } from "../amplify/data/resource";
import './challenges.css';
import { getPendingChallenges, respondToChallenge } from './challengeOperations';
import { useUser } from './userContext';
import { useDataVersion } from './dataVersionContext';
import { useNavigate } from 'react-router-dom';
import ActionMenu from './components/cardActionMenu/cardActionMenu';
import { shareContent } from './utils/shareAction';
import { ChallengeType } from './challengeTypes';

type ChallengeCategory = 'all' | ChallengeType;
type Challenge = Schema["Challenge"]["type"];

function ChallengesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChallengeCategory>('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useUser();
  const [pendingChallenges, setPendingChallenges] = useState<(Challenge & {
    participationId: string;
    inviterName: string;    
    invitedAt: string | null;
    expiresIn: number;
  })[]>([]);
  const [participations, setParticipations] = useState<Record<string, boolean>>({});
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);
  const { incrementVersion } = useDataVersion();
  const navigate = useNavigate();



  useEffect(() => {
    loadChallenges();
    loadPendingChallenges();
  }, []);

  useEffect(() => {
    if (userId && challenges.length > 0) {
      checkParticipations();
    }
  }, [userId, challenges]);

  const checkParticipations = async () => {
    try {
      const participationStatus: Record<string, boolean> = {};
      await Promise.all(
        challenges.map(async (challenge) => {
          const participation = await checkChallengeParticipation(challenge.id, userId!);
          participationStatus[challenge.id] = !!participation;
        })
      );
      setParticipations(participationStatus);
    } catch (error) {
      console.error('Error checking participations:', error);
    }
  };
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

      // Update local state
      setParticipations(prev => ({
        ...prev,
        [challengeId]: true
      }));

      incrementVersion(); //this tells certain functions to rerender and pull data as a result of this change.

      // Refresh challenges to get updated data
      await loadChallenges();
    } catch (error) {
      console.error('Error joining challenge:', error);
    } finally {
      setJoiningChallenge(null);
    }
  };

  const loadChallenges = async () => {
    try {
      setIsLoading(true);
      const fetchedChallenges = await listChallenges();
      setChallenges(fetchedChallenges);
    } catch (err) {
      console.error('Error loading challenges:', err);
      setError('Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingChallenges = async () => {
    try {
      const pending = await getPendingChallenges(userId!);
      setPendingChallenges(pending);
    } catch (err) {
      console.error('Error loading pending challenges:', err);
    } finally {
    }
  };

  const handleChallengeResponse = async (participationId: string, accept: boolean) => {
    try {
      await respondToChallenge(participationId, accept ? 'ACTIVE' : 'DROPPED');
      // Refresh both pending challenges and main challenges list
      loadPendingChallenges();
      loadChallenges();
      incrementVersion();
    } catch (err) {
      console.error('Error responding to challenge:', err);
    }
  };

  const stats = [
    {
      category: 'PUBLIC' as ChallengeCategory,
      label: 'Public Challenges',
      icon: Globe,
      count: challenges.filter(c => c.challengeType === 'PUBLIC').length,
      iconClass: 'stat-icon--public'
    },
    {
      category: 'FRIENDS' as ChallengeCategory,
      label: 'Friend Challenges',
      icon: UserPlus,
      count: challenges.filter(c => c.challengeType === 'FRIENDS').length,
      iconClass: 'stat-icon--friend'
    },
    {
      category: 'GROUP' as ChallengeCategory,
      label: 'Group Challenges',
      icon: Users,
      count: challenges.filter(c => c.challengeType === 'GROUP').length,
      iconClass: 'stat-icon--group'
    },
    {
      category: 'PERSONAL' as ChallengeCategory,
      label: 'Personal Goals',
      icon: Target,
      count: challenges.filter(c => c.challengeType === 'PERSONAL').length,
      iconClass: 'stat-icon--personal'
    },
  ];

  const getChallengeIcon = (type: string | null | undefined) => {
    // Convert string to enum value
    const challengeType = type as ChallengeType;
    
    switch (challengeType) {
        case ChallengeType.PUBLIC:
            return <Globe size={20} />;
        case ChallengeType.FRIENDS:
            return <UserPlus size={20} />;
        case ChallengeType.GROUP:
            return <Users size={20} />;
        case ChallengeType.PERSONAL:
            return <Target size={20} />;
        default:
            return <Globe size={20} />; // Fallback to Globe
    }
};

  const filteredChallenges = challenges.filter(challenge =>
    activeFilter === 'all' || (challenge.challengeType && challenge.challengeType === activeFilter)
);

  const handleCategoryClick = (category: ChallengeCategory) => {
    setActiveFilter(category === activeFilter ? 'all' : category);
  };
  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const getChallengeActions = (challenge: Challenge) => {
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
        onClick: () => handleLeaveChallenge(challenge.id),
        destructive: true,
        show: participations[challenge.id],
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

  const handleLeaveChallenge = async (challengeId: string) => {
    removeParticipantFromChallenge(challengeId, userId!)  };

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
              <h2 className="friend-challenges-title">Friend Challenges</h2>
            </div>
            <div className="friend-challenges-scroll">
              {pendingChallenges.map((challenge) => (
                <div key={challenge.id} className="friend-challenge-card">
                  <div className="friend-card-header">
                    <img
                      src="/profileDefault.png"
                      alt={challenge.inviterName}
                      className="friend-avatar"
                    />
                    <div className="friend-info">
                      <div className="friend-name">{challenge.inviterName} challenged you!</div>
                      <div className="challenge-type">{challenge.title}</div>
                    </div>
                  </div>
                  <p className="challenge-description">{challenge.description}</p>
                  <div className="challenge-actions">
                    <button
                      onClick={() => handleChallengeResponse(challenge.participationId, true)}
                      className="challenge-button challenge-button--accept"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleChallengeResponse(challenge.participationId, false)}
                      className="challenge-button challenge-button--decline"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="stats-row">
          {stats.map(({ category, label, icon: Icon, count, iconClass }) => (
            <div
              key={category}
              className={`stat-card ${activeFilter === category ? 'stat-card--active' : ''}`}
              onClick={() => handleCategoryClick(category)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCategoryClick(category);
                }
              }}
            >
              <div className="stat-card-content">
                <div className={`stat-icon ${iconClass}`}>
                  <Icon size={24} />
                </div>
                <div className="stat-text">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>




      </div>

      {/* Main Challenges Grid */}
      <div className="challenges-grid">
        {isLoading ? (
          <div>Loading challenges...</div>
        ) : (
          filteredChallenges.map(challenge => {
            if (!challenge) return null; // Defensive check to skip any null values

            // Calculate progress based on workouts completed
            const isParticipant = participations[challenge.id];
            const progress = challenge.totalWorkouts ? 0 : 0; // This needs to be calculated from actual data

            return (
              <div
                key={challenge.id}
                className="challenge-card"
              >
                <div className="challenge-card-header">
                  <div className={`challenge-icon-wrapper challenge-icon-wrapper--${challenge.challengeType}`}>
                  {getChallengeIcon(challenge.challengeType || ChallengeType.NONE)}
                  </div>
                  <div className="challenge-info">
                    <h3 className="challenge-title" onClick={() => handleNavigateToChallenge(challenge.id)}>{challenge.title}</h3>
                    <p className="challenge-meta">
                      {challenge.description}
                    </p>
                  </div>
                  <div className="challenge-card-header-menu">
                    <ActionMenu actions={getChallengeActions(challenge)} />
                  </div>
                </div>

                {isParticipant && (
                  <div className="challenge-progress">
                    <div className="progress-header">
                      <span>Progress</span>
                      <span>{progress}/{challenge.totalWorkouts} workouts</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-bar-fill progress-bar-fill--${challenge.challengeType}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}


                {!isParticipant && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      handleJoinChallenge(challenge.id);
                    }}
                    disabled={joiningChallenge === challenge.id}
                    className="btn btn-primary"
                  >
                    {joiningChallenge === challenge.id ? 'Joining...' : 'Join Challenge'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <CreateChallengeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadChallenges(); // Refresh challenges after creation
        }}
      />
    </div>
  );
}

export default ChallengesPage;