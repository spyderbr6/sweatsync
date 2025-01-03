// src/utils/githubUtils.ts

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_FEEDBACK_TOKEN;
const REPO_OWNER = 'spyderbr6';
const REPO_NAME = 'sweatsync';

interface GitHubError {
  message: string;
  documentation_url?: string;
}

interface GitHubIssueParams {
  title: string;
  body: string;
  labels: string[];
}

export async function submitGitHubIssue(params: GitHubIssueParams) {
  try {
    if (!GITHUB_TOKEN) {
      throw new Error('GitHub token is not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ...params,
          labels: [...params.labels, 'user-feedback'] // Adding a default label
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = data as GitHubError;
      throw new Error(
        error.message || `Failed to create issue: ${response.statusText}`
      );
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      // If it's a permissions error, give a more user-friendly message
      if (error.message.includes('Bad credentials') || 
          error.message.includes('401') ||
          error.message.includes('403')) {
        throw new Error('Unable to submit feedback due to authentication error. Please contact support.');
      }
      throw error;
    }
    throw new Error('An unexpected error occurred while submitting feedback');
  }
}