import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

async function createAchievementPost({
  userId,
  goalId,
  streakDays,
  message,
  goalName,
  goalType
}: {
  userId: string;
  goalId: string;
  streakDays: number;
  message: string;
  goalName: string;
  goalType: string;
}): Promise<void> {
  try {
    const postContent = `🏆 Achievement Unlocked: ${message}\n\nAchieved ${streakDays} day streak in ${goalName}! ${
      goalType === 'CALORIE' ? '🔥' : goalType === 'WEIGHT' ? '⚖️' : '🎯'
    }`;

    const postResult = await client.models.PostforWorkout.create({
      content: postContent,
      userID: userId,
      username: (await client.models.User.get({ id: userId })).data?.preferred_username,
      challengeIds: [goalId],
      thumbsUp: 0,
      smiley: 0,
      strong: 0,
      fire: 0,
      zap: 0,
      fist: 0,
      target: 0,
      star: 0,
      rocket: 0,
      clap: 0,
      trophy: 0
    });

    if (postResult.data?.id) {
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
    const friendships = await client.models.Friend.list({
      filter: { friendUser: { eq: achieverId } }
    });

    const achieverResult = await client.models.User.get({ id: achieverId });
    const achieverName = achieverResult.data?.preferred_username || 'Someone';

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

export async function checkAndProcessAchievements(
  userId: string,
  goalId: string,
  currentStreak: number
): Promise<void> {
  try {
    const goalResult = await client.models.PersonalGoal.get({ id: goalId });
    const goal = goalResult.data;
    
    if (!goal?.achievementsEnabled || !goal.achievementThresholds) return;

    const thresholds = goal.achievementThresholds as Array<{
      streakDays: number;
      message: string;
      postToFeed: boolean;
    }>;

    const eligibleAchievements = thresholds.filter(threshold => 
      threshold.streakDays === currentStreak && threshold.postToFeed
    );

    for (const achievement of eligibleAchievements) {
      const existingPosts = await client.models.PostforWorkout.list({
        filter: {
          userID: { eq: userId },
          challengeIds: { contains: goalId },
          content: { contains: `Achieved ${achievement.streakDays} day streak` }
        }
      });

      if (existingPosts.data.length === 0) {
        await createAchievementPost({
          userId,
          goalId,
          streakDays: achievement.streakDays,
          message: achievement.message,
          goalName: goal.name,
          goalType: goal.type || 'CUSTOM'
        });
      }
    }
  } catch (error) {
    console.error('Error processing achievements:', error);
  }
}

export async function validateStreak(
  goalId: string,
  latestLog: Schema['DailyLog']['type']
): Promise<boolean> {
  try {
    const goalResult = await client.models.PersonalGoal.get({ id: goalId });
    const goal = goalResult.data;
    
    if (!goal) return false;

    switch (goal.type) {
      case 'CALORIE':
        return latestLog.calories != null && latestLog.calories <= goal.target;
      case 'WEIGHT':
        return latestLog.weight != null && latestLog.weight <= goal.target;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error validating streak:', error);
    return false;
  }
}