import { useState, useEffect } from 'react';

/**
 * Unified ScreenSourcePicker component
 * Consolidates the best features from both implementations
 * - Higher resolution (1920x1080) from SessionManagement version
 * - Better error handling and UI from SessionManagement version
 * - Clean component structure
 */
function ScreenSourcePicker({ onSourceSelected }) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (window.api && window.api.getScreenSources) {
        const availableSources = await window.api.getScreenSources();
        console.log("Available screen sources:", availableSources);
        setSources(availableSources);
      } else {
        setError("Electron API not available. Are you running in Electron with preload script?");
      }
    } catch (err) {
      console.error("Failed to get screen sources:", err);
      setError("Failed to retrieve screen sources. Please check permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSource = async (source) => {
    setSelectedSource(source);
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1920,
            maxWidth: 1920,
            minHeight: 1080,
            maxHeight: 1080
          }
        }
      });
      onSourceSelected(stream);
    } catch (err) {
      console.error("Error getting user media:", err);
      setError("Could not get media stream from selected source. Check permissions.");
    }
  };

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 bg-red-900 rounded-lg shadow-lg animate-fade-in">
        <p className="text-xl font-bold mb-2">Error:</p>
        <p>{error}</p>
        <p className="text-sm mt-4">Ensure you have granted screen recording permissions for this app.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl animate-scale-in">
        <div className="text-center text-gray-400 text-lg">
          <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
          <p>Loading screen sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl animate-scale-in">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Select a Screen or Window to Share</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-96 overflow-y-auto custom-scrollbar">
        {sources.map(source => (
          <div
            key={source.id}
            className={`cursor-pointer bg-gray-700 rounded-lg p-4 flex flex-col items-center transition-all duration-300 ease-in-out
              ${selectedSource && selectedSource.id === source.id ? 'border-4 border-blue-500 shadow-lg transform scale-105' : 'border-2 border-transparent hover:border-blue-400 hover:shadow-md'}`}
            onClick={() => handleSelectSource(source)}
          >
            <img
              src={source.thumbnail.toDataURL()}
              alt={source.name}
              className="w-full h-32 object-cover rounded-md mb-3 border border-gray-600"
            />
            <span className="text-white text-center text-sm font-medium">{source.name}</span>
          </div>
        ))}
      </div>
      {sources.length === 0 && !error && (
        <p className="text-center text-gray-400 mt-8 text-lg animate-fade-in">
          No screen or window sources found. Please ensure permissions are granted.
        </p>
      )}
    </div>
  );
}

export default ScreenSourcePicker;
