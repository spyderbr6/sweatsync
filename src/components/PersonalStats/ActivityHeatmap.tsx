import { useState, useEffect } from 'react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";
import _ from 'lodash';

const client = generateClient<Schema>();

interface ActivityData {
    date: string;
    activityCount: number;
}

interface ActivityHeatmapProps {
    userId: string;
    weeks?: number; // Number of weeks to display, defaults to 52 (1 year)
}

const ActivityHeatmap = ({ userId, weeks = 52 }: ActivityHeatmapProps) => {
    const [activityData, setActivityData] = useState<ActivityData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchActivityData = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Calculate date range
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - (weeks * 7));

                // Format dates for queries
                const startDateStr = startDate.toISOString().split('T')[0];
                const endDateStr = endDate.toISOString().split('T')[0];

                // Get all activity types for the date range
                const [posts, dailyLogs] = await Promise.all([
                    client.models.PostChallenge.list({
                        filter: {
                            userId: { eq: userId },
                            and: [
                                { timestamp: { ge: startDateStr } },
                                { timestamp: { le: endDateStr } }
                            ]
                        }
                    }),
                    client.models.DailyLog.list({
                        filter: {
                            userID: { eq: userId },
                            date: {
                                between: [startDateStr, endDateStr]
                            }
                        }
                    })
                ]);

                // Process posts by date
                const postsByDate = _.groupBy(posts.data, (post) =>
                    new Date(post.timestamp!).toISOString().split('T')[0]
                );

                // Process daily logs
                const logsByDate = _.groupBy(dailyLogs.data, 'date');

                // Combine all dates
                const allDates = new Set([
                    ...Object.keys(postsByDate),
                    ...Object.keys(logsByDate)
                ]);

                // Create activity data array
                const activityCounts: ActivityData[] = Array.from(allDates).map(date => {
                    const postsCount = postsByDate[date]?.length || 0;
                    const hasLog = logsByDate[date]?.length > 0;

                    return {
                        date,
                        activityCount: postsCount + (hasLog ? 1 : 0)
                    };
                });

                setActivityData(_.sortBy(activityCounts, 'date'));
                setError(null);
            } catch (err) {
                console.error('Error fetching activity data:', err);
                setError('Failed to load activity data');
            } finally {
                setLoading(false);
            }
        };

        fetchActivityData();
    }, [userId, weeks]);

    // Calculate color intensity based on activity count
    const getColor = (count: number): string => {
        // Customize these colors as needed
        if (count === 0) return '#ebedf0';
        if (count === 1) return '#9be9a8';
        if (count === 2) return '#40c463';
        if (count === 3) return '#30a14e';
        return '#216e39'; // 4 or more activities
    };

    // Generate calendar grid
    const generateCalendarGrid = () => {
        const today = new Date();
        const cells = [];
        const daysToShow = weeks * 7;

        for (let i = 0; i < daysToShow; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayData = activityData.find(d => d.date === dateStr);
            const activityCount = dayData?.activityCount || 0;

            cells.unshift(
                <div
                    key={dateStr}
                    className="w-3 h-3 rounded-sm"
                    style={{
                        backgroundColor: getColor(activityCount),
                        margin: '1px'
                    }}
                    title={`${dateStr}: ${activityCount} activities`}
                />
            );
        }

        // Group cells into weeks
        const weekChunks = _.chunk(cells, 7);

        return (
            <div className="flex">
                {weekChunks.map((week, i) => (
                    <div key={i} className="flex flex-col">
                        {week}
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return <div className="h-32 flex items-center justify-center">Loading activity data...</div>;
    }

    if (error) {
        return <div className="text-red-600">{error}</div>;
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Activity Overview</h3>
            <div className="overflow-x-auto">
                <div className="min-w-full">
                    {generateCalendarGrid()}
                </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 text-sm">
                <span>Less</span>
                <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((level) => (
                        <div
                            key={level}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getColor(level) }}
                        />
                    ))}
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;