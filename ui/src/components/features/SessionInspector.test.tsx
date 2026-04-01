import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionInspector } from './SessionInspector';
import * as useSessionHook from '../../features/session/useSession';
import type { AnalyzedSession } from '../../types';

// Mock the useSessionExport hook
vi.mock('../../features/session/useSession', () => ({
  useSessionExport: vi.fn(),
}));

// Type assertion for the mock
const useSessionExportMock = useSessionHook.useSessionExport as vi.Mock;

const mockSession: AnalyzedSession = {
  sessionId: 'session-123',
  projectId: 'project-abc',
  timestamp: Date.now(),
  modelId: 'gemini-pro',
  expressionQuality: {
    score: 85,
    suggestion: 'Improve clarity in step-by-step instructions.',
    ambiguities: ['clarity', 'instructions'],
  },
  category: 'Coding',
  stats: {
    turns: 10,
    tokenUsage: { total: 500, input: 300, output: 200 },
  },
  messages: [
    { id: 'msg-1', type: 'user', content: 'Hello', timestamp: Date.now() - 100000 },
    { id: 'msg-2', type: 'model', content: 'Hi there!', timestamp: Date.now() - 90000 },
  ],
};

describe('SessionInspector Component', () => {
  const onSelectMessageMock = vi.fn();

  beforeEach(() => {
    useSessionExportMock.mockClear();
    onSelectMessageMock.mockClear();
    // Default mock for useSessionExport
    useSessionExportMock.mockReturnValue({
      handleExport: vi.fn(),
      exporting: false,
      exported: false,
    });
  });

  it('should render session details in Intel tab by default', async () => {
    render(<SessionInspector session={mockSession} />);

    // Click on Intel tab
    fireEvent.click(screen.getByText('Intel'));

    // Check if Intel tab content is rendered
    expect(await screen.findByText('Expression Score')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Coding')).toBeInTheDocument();
    expect(screen.getByText('Total Turns')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Coach Suggestion')).toBeInTheDocument();
    expect(
      screen.getByText(/Improve clarity in step-by-step instructions/i)
    ).toBeInTheDocument();
    expect(screen.getByText('clarity')).toBeInTheDocument();
    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
  });

  it('should switch to Timeline tab and render messages', async () => {
    render(<SessionInspector session={mockSession} onSelectMessage={onSelectMessageMock} />);

    // Click on Timeline tab
    fireEvent.click(screen.getByText('Timeline'));

    // Check if Timeline tab content is rendered
    expect(screen.getByText('Chat Timeline')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();

    // Verify onSelectMessage is called
    fireEvent.click(screen.getByText('Hello'));
    expect(onSelectMessageMock).toHaveBeenCalledWith('msg-1');
  });

  it('should display export button correctly and call handleExport', async () => {
    const handleExportMock = vi.fn();
    useSessionExportMock.mockReturnValue({
      handleExport: handleExportMock,
      exporting: false,
      exported: false,
    });
    const { rerender } = render(<SessionInspector session={mockSession} />);

    const exportButton = screen.getByRole('button', { name: /Incubate to SKILL.md/i });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).not.toBeDisabled();

    fireEvent.click(exportButton);
    expect(handleExportMock).toHaveBeenCalledWith(mockSession.sessionId);

    // Test exporting state
    useSessionExportMock.mockReturnValue({
      handleExport: handleExportMock,
      exporting: true,
      exported: false,
    });
    rerender(<SessionInspector session={mockSession} />);
    expect(screen.getByRole('button', { name: /Incubate to SKILL.md/i })).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();


    // Test exported state
    useSessionExportMock.mockReturnValue({
      handleExport: handleExportMock,
      exporting: false,
      exported: true,
    });
    rerender(<SessionInspector session={mockSession} />);
    expect(screen.getByRole('button', { name: /Skill Exported/i })).toBeInTheDocument();
  });

  it('should render default message for no model data in Timeline', async () => {
    const sessionWithoutMessages = { ...mockSession, messages: [] };
    render(<SessionInspector session={sessionWithoutMessages} />);

    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument(); // Ensure no messages are rendered
    // If there's a specific 'no messages' text, assert its presence
  });
});
