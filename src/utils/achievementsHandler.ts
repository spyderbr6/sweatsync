import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../amplify/data/resource";
import { PersonalGoal, DailyLog } from "../types/personalStats";

const client = generateClient<Schema>();

interface EarnedAchievement {
  type: 'STREAK';
  goalId: string;
  streakDays: number;
  message: string;
}

export async function checkAndProcessAchievements(
  userId: string,
  goalId: string,
  currentStreak: number
): Promise<void> {
  try {
    // Get the goal details
    const goalResult = await client.models.PersonalGoal.get({ id: goalId });
    const goal = goalResult.data;
    
    if (!goal?.achievementsEnabled || !goal.achievementThresholds) return;

    const thresholds = goal.achievementThresholds as Array<{
      streakDays: number;
      message: string;
      postToFeed: boolean;
    }>;

    // Find eligible achievements
    const eligibleAchievements = thresholds.filter(threshold => 
      threshold.streakDays === currentStreak && threshold.postToFeed
    );

    // Process each eligible achievement
    for (const achievement of eligibleAchievements) {
      // Check if this achievement was already posted
      const existingPosts = await client.models.PostforWorkout.list({
        filter: {
          userID: { eq: userId },
          challengeIds: { contains: goalId },
          content: { contains: `Achieved ${achievement.streakDays} day streak` }
        }
      });

      // If no existing post found, create one
      if (existingPosts.data.length === 0) {
        await createAchievementPost({
          userId,
          goalId,
          streakDays: achievement.streakDays,
          message: achievement.message,
          goalName: goal.name,
          goalType: goal.type
        });
      }
    }
  } catch (error) {
    console.error('Error processing achievements:', error);
  }
}

interface CreateAchievementPostParams {
  userId: string;
  goalId: string;
  streakDays: number;
  message: string;
  goalName: string;
  goalType: string;
}

async function createAchievementPost({
  userId,
  goalId,
  streakDays,
  message,
  goalName,
  goalType
}: CreateAchievementPostParams): Promise<void> {
  try {
    // Create the achievement post
    const postContent = `🏆 Achievement Unlocked: ${message}\n\nAchieved ${streakDays} day streak in ${goalName}! ${
      goalType === 'CALORIE' ? '🔥' : goalType === 'WEIGHT' ? '⚖️' : '🎯'
    }`;

    const postResult = await client.models.PostforWorkout.create({
      content: postContent,
      userID: userId,
      username: (await client.models.User.get({ id: userId })).data?.preferred_username,
      challengeIds: [goalId], // Store the goal ID in challengeIds for reference
      thumbsUp: 0,
      smiley: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // If URL is required for the post, you can add it later
    if (postResult.data?.id) {
      // Optionally, you could create a notification for the user's followers
      await notifyFollowers(userId, postResult.data.id, goalName);
    }

  } catch (error) {
    console.error('Error creating achievement post:', error);
    throw error;
  }
}

async function notifyFollowers(
  achieverId: string, 
  postId: string,
  goalName: string
): Promise<void> {
  try {
    // Get user's followers
    const friendships = await client.models.Friend.list({
      filter: { friendUser: { eq: achieverId } }
    });

    const achieverResult = await client.models.User.get({ id: achieverId });
    const achieverName = achieverResult.data?.preferred_username || 'Someone';

    // Create notifications for each follower
    await Promise.all(
      friendships.data.map(friendship => 
        client.queries.sendPushNotificationFunction({
          type: 'ACHIEVEMENT_EARNED',
          userID: friendship.user,
          title: "Friend Achievement! 🏆",
          body: `${achieverName} reached a milestone in ${goalName}!`,
          data: JSON.stringify({
            postId,
            achieverId,
            type: 'ACHIEVEMENT'
          })
        })
      )
    );
  } catch (error) {
    console.error('Error notifying followers:', error);
  }
}

// Helper function to validate streak for a goal
export async function validateStreak(
  userId: string,
  goalId: string,
  latestLog: DailyLog
): Promise<boolean> {
  try {
    const goalResult = await client.models.PersonalGoal.get({ id: goalId });
    const goal = goalResult.data;
    
    if (!goal) return false;

    switch (goal.type) {
      case 'CALORIE':
        return latestLog.calories !== undefined && latestLog.calories <= goal.target;
      case 'WEIGHT':
        return latestLog.weight !== undefined && latestLog.weight <= goal.target;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error validating streak:', error);
    return false;
  }
}