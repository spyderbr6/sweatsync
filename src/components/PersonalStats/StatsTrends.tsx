import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDailyLogs } from '../../utils/personalStatsOperations';
import { DailyLog, GoalType } from '../../types/personalStats';
import { useUser } from '../../userContext';

interface StatsTrendsProps {
  goalType: GoalType;
  target?: number;
}

type TimeRange = 'week' | 'month' | '3month';

interface ChartData {
  date: string;
  value: number;
  target?: number;
}

export function StatsTrends({ goalType, target }: StatsTrendsProps) {
  const { userId } = useUser();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range based on selected time range
  const dateRange = useMemo(() => {
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    const start = new Date(currentDate);

    switch (timeRange) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3month':
        start.setMonth(start.getMonth() - 3);
        break;
    }
    start.setHours(0, 0, 0, 0);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [currentDate, timeRange]);

  // Load data for the selected date range
  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const logs = await getDailyLogs(userId, dateRange);
        const formattedData = formatLogsForChart(logs, goalType, target);
        setChartData(formattedData);
      } catch (err) {
        console.error('Error loading trend data:', err);
        setError('Failed to load trend data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId, dateRange, goalType, target]);

  // Helper function to format logs for chart display
  const formatLogsForChart = (
    logs: DailyLog[],
    type: GoalType,
    targetValue?: number
  ): ChartData[] => {
    // Create a map of all dates in range
    const dateMap = new Map<string, ChartData>();
    let currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateMap.set(dateStr, {
        date: dateStr,
        value: 0,
        target: targetValue
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fill in actual values from logs
    logs.forEach(log => {
      const value = type === GoalType.CALORIE ? log.calories : log.weight;
      if (value !== undefined && dateMap.has(log.date)) {
        dateMap.set(log.date, {
          date: log.date,
          value,
          target: targetValue
        });
      }
    });

    return Array.from(dateMap.values());
  };

  const navigateTime = (direction: 'forward' | 'backward') => {
    const newDate = new Date(currentDate);
    switch (timeRange) {
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'forward' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'forward' ? 1 : -1));
        break;
      case '3month':
        newDate.setMonth(newDate.getMonth() + (direction === 'forward' ? 3 : -3));
        break;
    }
    setCurrentDate(newDate);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return timeRange === 'week' 
      ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="stats-trends">
      <div className="stats-trends-header">
        <div className="stats-trends-title">
          <Calendar className="stats-trends-icon" />
          <h3>{goalType === GoalType.CALORIE ? 'Calorie Trends' : 'Weight Trends'}</h3>
        </div>

        <div className="stats-trends-controls">
          <div className="stats-trends-range-buttons">
            {(['week', 'month', '3month'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`stats-trends-range-button ${timeRange === range ? 'active' : ''}`}
              >
                {range === '3month' ? '3M' : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <div className="stats-trends-navigation">
            <button
              onClick={() => navigateTime('backward')}
              className="stats-trends-nav-button"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="stats-trends-current-range">
              {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
            </span>
            <button
              onClick={() => navigateTime('forward')}
              className="stats-trends-nav-button"
              disabled={new Date(dateRange.endDate) >= new Date()}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="stats-trends-loading">Loading trend data...</div>
      ) : error ? (
        <div className="stats-trends-error">{error}</div>
      ) : (
        <div className="stats-trends-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                interval={timeRange === 'week' ? 0 : 'preserveStartEnd'}
              />
              <YAxis />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value: number) => [
                  `${value} ${goalType === GoalType.CALORIE ? 'cal' : 'lbs'}`,
                  goalType === GoalType.CALORIE ? 'Calories' : 'Weight'
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563EB"
                activeDot={{ r: 8 }}
                name={goalType === GoalType.CALORIE ? 'Calories' : 'Weight'}
              />
              {target && (
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#DC2626"
                  strokeDasharray="5 5"
                  name="Target"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}