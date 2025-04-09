// src/personalStatsPage.tsx
//import React from 'react';
import { useUser } from './userContext';
import { PersonalStats } from './components/PersonalStats/PersonalStats';

function PersonalStatsPage() {
  const { userId, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-700 rounded">
          <h2 className="text-lg font-semibold mb-2">Sign In Required</h2>
          <p>Please sign in to view your personal health statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-4">
      <div className="max-w-6xl mx-auto px-4">
        <PersonalStats />
      </div>
    </div>
  );
}

export default PersonalStatsPage;