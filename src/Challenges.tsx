// ChallengesPage.tsx
import React, { useEffect, useState } from "react";
import {
  createChallenge,
  addParticipantToChallenge,
  listChallenges,
  getParticipantsForChallenge,
} from "./challengeOperations";

type Challenge = {
  id: string;
  title?: string | null;
  description?: string | null;
  totalWorkouts?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  reward?: string | null;
};

type ChallengeParticipant = {
  id: string;
  challengeID: string;
  userID: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  points: number;
  workoutsCompleted: number;
};

const currentUserId = "user-123"; // Replace with actual logged-in user ID

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const modalStyle: React.CSSProperties = {
  background: "#fff",
  padding: "20px",
  borderRadius: "8px",
  width: "300px"
};

export const ChallengesPage: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newChallengeTitle, setNewChallengeTitle] = useState("");
  const [newChallengeDescription, setNewChallengeDescription] = useState("");
  const [participantsData, setParticipantsData] = useState<{
    [challengeId: string]: ChallengeParticipant[];
  }>({});

  useEffect(() => {
    loadChallenges();
  }, []);

  async function loadChallenges() {
    // Assuming listChallenges returns the list of Challenge objects
    const chals = await listChallenges();
    setChallenges(chals);

    // For each challenge, fetch participants
    const allParticipants: { [id: string]: ChallengeParticipant[] } = {};
    for (const c of chals) {
      const parts = await getParticipantsForChallenge(c.id);
      allParticipants[c.id] = parts;
    }
    setParticipantsData(allParticipants);
  }

  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    const msg = await createChallenge({
      title: newChallengeTitle,
      description: newChallengeDescription,
    });
    console.log(msg);
    setShowModal(false);
    setNewChallengeTitle("");
    setNewChallengeDescription("");
    loadChallenges();
  }

  async function handleJoinChallenge(challengeId: string) {
    const msg = await addParticipantToChallenge({ challengeID: challengeId, userID: currentUserId });
    console.log(msg);
    await loadChallenges();
  }

  // Determine user's status for a given challenge
  function getUserStatusForChallenge(challengeId: string): ChallengeParticipant | null {
    const participants = participantsData[challengeId];
    if (!participants) return null;
    return participants.find((p) => p.userID === currentUserId) || null;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Challenges</h1>
      
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          style={{
            padding: "10px 20px",
            borderRadius: "4px",
            background: "#007BFF",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
          onClick={() => setShowModal(true)}
        >
          Add New Challenge
        </button>
      </div>

      <div style={{
        display: "grid",
        gap: "20px",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))"
      }}>
        {challenges.map((c) => {
          const participant = getUserStatusForChallenge(c.id);
          let statusText = "Not Joined";
          let progressValue = 0;
          if (participant) {
            statusText = participant.status;
            if (participant.status === "ACTIVE") {
              // Show some progress out of a hypothetical goal
              // For example, if a challenge runs 30 days and user completed 10 workouts, show progress
              progressValue = participant.workoutsCompleted;
            } else if (participant.status === "COMPLETED") {
              progressValue = 100; // full progress
            }
          }

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "20px",
                background: "#f9f9f9"
              }}
            >
              <h2 style={{ marginTop: 0 }}>{c.title}</h2>
              <p>{c.description}</p>
              {participant ? (
                <div>
                  <p>Status: {statusText}</p>
                  {participant.status === "ACTIVE" && (
                    <div style={{ margin: "10px 0" }}>
                      <progress value={progressValue} max={30}></progress>
                      <div>{participant.workoutsCompleted}/30 workouts</div>
                    </div>
                  )}
                  {participant.status === "COMPLETED" && (
                    <div style={{ color: "green" }}>Challenge Completed!</div>
                  )}
                  {participant.status === "DROPPED" && (
                    <div style={{ color: "red" }}>You dropped this challenge</div>
                  )}
                </div>
              ) : (
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer"
                  }}
                  onClick={() => handleJoinChallenge(c.id)}
                >
                  Join Challenge
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <h2>Create a New Challenge</h2>
            <form onSubmit={handleCreateChallenge}>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  Title:
                  <input
                    type="text"
                    value={newChallengeTitle}
                    onChange={(e) => setNewChallengeTitle(e.target.value)}
                    style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                    required
                  />
                </label>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  Description:
                  <textarea
                    value={newChallengeDescription}
                    onChange={(e) => setNewChallengeDescription(e.target.value)}
                    style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                  ></textarea>
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "8px 12px" }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: "8px 12px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "4px" }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallengesPage;
