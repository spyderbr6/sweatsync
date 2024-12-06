import { useEffect, useState } from "react";
import { getAllGoals, getAllChallenges, createGoal, createChallenge } from "./goalsAndChallenges";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { DataStore } from "aws-amplify";
import { Goal, Challenge } from "../models";

function GoalsAndChallenges() {
  const [goals, setGoals] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [challengeName, setChallengeName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friendsList, setFriendsList] = useState([]); // Mock friends list for demo purposes
  const { user } = useAuthenticator();

  useEffect(() => {
    async function fetchData() {
      const goalsData = await getAllGoals();
      const challengesData = await getAllChallenges();
      setGoals(goalsData);
      setChallenges(challengesData);
    }

    fetchData();
    // Mock data for friends list
    setFriendsList(["Alice", "Bob", "Charlie", "Dave"]);
  }, []);

  const handleCreateGoal = async () => {
    const name = prompt("Enter the goal name:");
    if (name) {
      const isGroupGoal = window.confirm("Is this a group goal?");
      await createGoal(name, isGroupGoal);
      const updatedGoals = await getAllGoals();
      setGoals(updatedGoals);
    }
  };

  const handleCreateChallenge = async () => {
    if (challengeName && selectedFriends.length > 0) {
      await createChallenge(challengeName, selectedFriends);
      const updatedChallenges = await getAllChallenges();
      setChallenges(updatedChallenges);
      setChallengeName("");
      setSelectedFriends([]);
    } else {
      alert("Please enter a challenge name and select at least one friend.");
    }
  };

  const handleFriendSelection = (friend) => {
    if (selectedFriends.includes(friend)) {
      setSelectedFriends(selectedFriends.filter((f) => f !== friend));
    } else {
      setSelectedFriends([...selectedFriends, friend]);
    }
  };

  return (
    <div className="goals-challenges-container">
      <h2>Goals and Challenges</h2>

      <div className="goals-section">
        <h3>Goals</h3>
        <button onClick={handleCreateGoal}>Create Goal</button>
        <ul>
          {goals.map((goal) => (
            <li key={goal.id}>{goal.name} - {goal.isGroupGoal ? "Group Goal" : "Individual Goal"}</li>
          ))}
        </ul>
      </div>

      <div className="challenges-section">
        <h3>Challenges</h3>
        <input
          type="text"
          value={challengeName}
          onChange={(e) => setChallengeName(e.target.value)}
          placeholder="Enter challenge name"
        />
        <div className="friends-list">
          <h4>Select Friends to Challenge</h4>
          {friendsList.map((friend) => (
            <div key={friend}>
              <input
                type="checkbox"
                checked={selectedFriends.includes(friend)}
                onChange={() => handleFriendSelection(friend)}
              />
              {friend}
            </div>
          ))}
        </div>
        <button onClick={handleCreateChallenge}>Create Challenge</button>
        <ul>
          {challenges.map((challenge) => (
            <li key={challenge.id}>{challenge.name} - Challenged Users: {challenge.challengedUsers.join(", ")}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default GoalsAndChallenges;
