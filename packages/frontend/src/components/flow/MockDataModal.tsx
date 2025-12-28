import { useState, useEffect } from 'react';
import type { View, MockDataEntityDTO, MockData } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';
import { X, Database, MessageSquare, Save, Loader2 } from 'lucide-react';

interface MockDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  view: View | null;
  onMockDataUpdated: () => void;
}

/**
 * Modal for viewing and editing mock data
 * Supports direct editing and AI-powered regeneration via chat
 */
export function MockDataModal({
  isOpen,
  onClose,
  view,
  onMockDataUpdated,
}: MockDataModalProps) {
  const [mockData, setMockData] = useState<MockDataEntityDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load mock data when view changes
  useEffect(() => {
    if (!isOpen || !view) {
      setMockData(null);
      setChatMessage('');
      setChatResponse(null);
      return;
    }

    async function loadMockData() {
      if (!view?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        console.log('Loading mock data for view:', view.id);
        const data = await api.getMockDataByViewId(view.id);
        console.log('Mock data loaded:', data);
        setMockData(data);
      } catch (err) {
        console.error('Failed to load mock data:', err);
        setError('Failed to load mock data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadMockData();
  }, [isOpen, view]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    // Check if we have a mock data ID
    if (!mockData?.id) {
      setError('No mock data entity found. The view may need to be recreated.');
      console.error('Mock data has no ID:', mockData);
      return;
    }

    setIsSendingChat(true);
    setError(null);
    setChatResponse(null);

    try {
      console.log('Sending chat request to mock data ID:', mockData.id);
      const response = await api.chatWithMockData(mockData.id, {
        message: chatMessage.trim(),
      });

      console.log('Chat response received:', response);
      console.log('New mock data:', JSON.stringify(response.mockData.data, null, 2));
      // Force new object reference and increment key to trigger React re-render
      setMockData({ ...response.mockData });
      setRefreshKey(prev => prev + 1);
      setChatResponse(response.message);
      setChatMessage('');
      onMockDataUpdated();
    } catch (err) {
      console.error('Failed to regenerate mock data:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate mock data');
    } finally {
      setIsSendingChat(false);
    }
  };

  if (!isOpen) return null;

  // Render mock data preview based on type
  const renderMockDataPreview = (data: MockData) => {
    if (data.type === 'table') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {data.columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-2 font-medium text-gray-700 bg-gray-50"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 5).map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  {data.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-600">
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 5 && (
            <p className="text-sm text-gray-500 mt-2 px-3">
              ...and {data.rows.length - 5} more rows
            </p>
          )}
        </div>
      );
    }

    if (data.type === 'post-list') {
      return (
        <div className="space-y-3">
          {data.posts.slice(0, 3).map((post, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <h4 className="font-medium text-gray-900">{post.title}</h4>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{post.author}</span>
                <span>-</span>
                <span>{post.date}</span>
              </div>
            </div>
          ))}
          {data.posts.length > 3 && (
            <p className="text-sm text-gray-500">
              ...and {data.posts.length - 3} more posts
            </p>
          )}
        </div>
      );
    }

    return <p className="text-gray-500">Unknown data type</p>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mock Data</h2>
              <p className="text-sm text-gray-500">
                {view?.name || 'View'} - {view?.layoutTemplate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
              {error}
            </div>
          ) : mockData?.data ? (
            <div className="space-y-6">
              {/* Data Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Data Preview</h3>
                <div
                  key={`preview-${refreshKey}`}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {renderMockDataPreview(mockData.data)}
                </div>
              </div>

              {/* AI Chat Response */}
              {chatResponse && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700">{chatResponse}</p>
                </div>
              )}

              {/* AI Regeneration Chat */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Regenerate with AI
                </h3>
                <form onSubmit={handleChatSubmit} className="space-y-3">
                  <textarea
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Describe how you want the mock data to change... (e.g., 'Add more products with higher prices' or 'Change to tech blog posts')"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    rows={3}
                    disabled={isSendingChat}
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || isSendingChat}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSendingChat ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Regenerate Data
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No mock data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
