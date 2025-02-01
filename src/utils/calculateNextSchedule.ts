export function calculateNextSchedule(
    timePreference: string,
    secondPreference: string | null | undefined,
    currentTime: string,
    timezone: string = 'UTC' // Default to UTC if no timezone specified
  ): string {
    try {
      // Convert current time to user's timezone
      const userNow = new Date(currentTime).toLocaleString('en-US', { timeZone: timezone });
      const now = new Date(userNow);
  
      // Calculate next schedule for each time preference
      const schedules: Date[] = [];
  
      // Helper to convert user's preferred time to UTC
      const convertToUTC = (timeStr: string, baseDate: Date): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          // Create date in user's timezone
          const localDate = new Date(baseDate);
          localDate.setHours(hours, minutes, 0, 0);
  
          // Convert to UTC string then back to Date to get UTC time
          return new Date(
            new Date(localDate).toLocaleString('en-US', {
              timeZone: 'UTC',
              timeZoneName: 'short'
            })
          );
        }
        throw new Error('Invalid time format');
      };
  
      // Get tomorrow's date in user's timezone
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
  
      // Handle primary time
      try {
        const primarySchedule = convertToUTC(timePreference, tomorrow);
        schedules.push(primarySchedule);
        console.log('[Schedule] Primary time converted:', {
          original: timePreference,
          timezone,
          utc: primarySchedule.toISOString()
        });
      } catch (error) {
        console.error('[Schedule] Error converting primary time:', error);
      }
  
      // Handle secondary time if it exists
      if (secondPreference) {
        try {
          const secondarySchedule = convertToUTC(secondPreference, tomorrow);
          schedules.push(secondarySchedule);
          console.log('[Schedule] Secondary time converted:', {
            original: secondPreference,
            timezone,
            utc: secondarySchedule.toISOString()
          });
        } catch (error) {
          console.error('[Schedule] Error converting secondary time:', error);
        }
      }
  
      // Return the earliest next schedule
      if (schedules.length > 0) {
        const nextSchedule = schedules.sort((a, b) => a.getTime() - b.getTime())[0];
        console.log('[Schedule] Selected next schedule:', {
          timezone,
          userTime: nextSchedule.toLocaleString('en-US', { timeZone: timezone }),
          utc: nextSchedule.toISOString()
        });
        return nextSchedule.toISOString();
      }
  
      // Fallback to default 9 AM tomorrow if no valid times
      console.log('[Schedule] Using fallback time');
      const defaultSchedule = convertToUTC('09:00', tomorrow);
      return defaultSchedule.toISOString();
  
    } catch (error) {
      console.error('[Schedule] Error in calculateNextSchedule:', {
        error,
        timePreference,
        secondPreference,
        timezone,
        currentTime
      });
      // Ultimate fallback - 9 AM UTC tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    }
  }