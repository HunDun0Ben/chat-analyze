import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Dashboard } from './Dashboard';
import * as useStatsHook from '../../features/dashboard/useStats';
import { useTheme } from '../../features/theme/useTheme';

// Mock hooks
vi.mock('../../features/dashboard/useStats', () => ({
  useStats: vi.fn(),
}));
vi.mock('../../features/theme/useTheme', () => ({
  useTheme: vi.fn(),
}));

// Type assertion for the mock
const useStatsMock = useStatsHook.useStats as Mock;
const useThemeMock = useTheme as Mock;

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    useStatsMock.mockClear();
    useThemeMock.mockClear();
    // Provide a default theme mock
    useThemeMock.mockReturnValue({ theme: 'light' });
  });

  it('should render loading state correctly', () => {
    // Arrange
    useStatsMock.mockReturnValue({
      data: [],
      models: [],
      loading: true, // Derived from isLoading
      error: null,
    });

    // Act
    render(<Dashboard />);

    // Assert
    expect(screen.getByText(/Loading stats.../i)).toBeInTheDocument();
  });

  it('should render error state correctly', () => {
    // Arrange
    const errorMessage = 'Failed to fetch';
    useStatsMock.mockReturnValue({
      data: [],
      models: [],
      loading: false, // Derived from isLoading
      error: new Error(errorMessage), // Pass the error directly
    });

    // Act
    render(<Dashboard />);

    // Assert
    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
  });

  it('should render stats when data is fetched successfully', () => {
    // Arrange
    const mockData = [
      { date: '2024-01-01', sessionCount: 5, totalTokens: 10000, avgScore: 85 },
      { date: '2024-01-02', sessionCount: 5, totalTokens: 15000, avgScore: 90 },
    ];
    const mockModels = [
      {
        modelId: 'model/gemini-pro',
        sessionCount: 8,
        avgTokens: 2800,
        avgScore: 92.5,
      },
      {
        modelId: 'model/gpt-4',
        sessionCount: 2,
        avgTokens: 4000,
        avgScore: 88.0,
      },
    ];
    useStatsMock.mockReturnValue({
      data: mockData,
      models: mockModels,
      loading: false, // Derived from isLoading
      error: null,
    });

    // Act
    render(<Dashboard />);

    // Assert
    // Check summary cards
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // 5 + 5

    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('25.0k')).toBeInTheDocument(); // 10000 + 15000

    expect(screen.getByText('Avg Tokens/Session')).toBeInTheDocument();
    expect(screen.getByText('2.5k')).toBeInTheDocument(); // 25000 / 10

    expect(screen.getByText('Peak Score')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument(); // max(85, 90)

    // Check chart and leaderboard titles
    expect(screen.getByText('Session Growth')).toBeInTheDocument();
    expect(screen.getByText('Model Leaderboard')).toBeInTheDocument();

    // Check if model names are rendered
    expect(screen.getByText('gemini-pro')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('should handle empty data state correctly', () => {
    // Arrange
    useStatsMock.mockReturnValue({
      data: [],
      models: [],
      loading: false,
      error: null,
    });

    // Act
    render(<Dashboard />);

    // Assert
    const totalSessionsCard = screen
      .getByText('Total Sessions')
      .closest('div.bg-\\[var\\(--card-bg\\)\\]');
    expect(totalSessionsCard).toHaveTextContent('0');

    const totalTokensCard = screen
      .getByText('Total Tokens')
      .closest('div.bg-\\[var\\(--card-bg\\)\\]');
    expect(totalTokensCard).toHaveTextContent('0');

    expect(screen.getByText('No model data available.')).toBeInTheDocument();
  });
});
