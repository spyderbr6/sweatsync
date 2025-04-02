import { useState, useEffect } from 'react';
import { useUser } from '../../userContext';

export function PersonalStatsPage() {
  const { userId } = useUser();
  const [loading, setLoading] = useState(true);


  const loadData = async () => {
    if (!userId) return;

    try {
      setLoading(true);
    } catch (err) {
      console.error('Error loading personal stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }


}