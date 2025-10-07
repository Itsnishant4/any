import React, { useState, useEffect } from 'react';

/**
 * Multi-Step Loader component inspired by Aceternity UI
 * Displays different loading stages for WebRTC connection process
 */
function FullScreenLoading({
  isVisible = false,
  stage = 'connecting',
  onClose = null
}) {
  const [currentStep, setCurrentStep] = useState(0);

  // Define the loading steps
  const loadingSteps = [
    {
      id: 'connecting',
      title: 'Connecting',
      description: 'Establishing connection to server...',
      icon: '🌐',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'joining',
      title: 'Joining Session',
      description: 'Authenticating and joining the session...',
      icon: '🚪',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'webrtc',
      title: 'WebRTC Setup',
      description: 'Setting up peer-to-peer connection...',
      icon: '🔗',
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'ice',
      title: 'Optimizing',
      description: 'Finding the best connection path...',
      icon: '⚡',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'ready',
      title: 'Ready!',
      description: 'Connection established successfully!',
      icon: '✅',
      color: 'from-green-600 to-green-400'
    }
  ];

  // Get current step index based on stage
  useEffect(() => {
    const stepIndex = loadingSteps.findIndex(step => step.id === stage);
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex);
    }
  }, [stage]);

  if (!isVisible) return null;

  const currentStepData = loadingSteps[currentStep] || loadingSteps[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4">
        {/* Main loading card */}
        <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
          {/* Header with icon and title */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${currentStepData.color} flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg`}>
              {currentStepData.icon}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {currentStepData.title}
            </h2>
            <p className="text-gray-300 text-sm">
              {currentStepData.description}
            </p>
          </div>

          {/* Progress steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {loadingSteps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center">
                  {/* Step circle */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500 ${
                    index <= currentStep
                      ? `bg-gradient-to-r ${step.color} text-white shadow-lg scale-110`
                      : index === currentStep + 1
                      ? 'bg-gray-700 text-gray-400 animate-pulse'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    {index < currentStep ? '✓' : index + 1}
                  </div>

                  {/* Step label */}
                  <div className={`text-xs mt-2 text-center transition-colors duration-300 ${
                    index <= currentStep ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${currentStepData.color} transition-all duration-700 ease-out rounded-full`}
                style={{ width: `${((currentStep + 1) / loadingSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Animated loading indicator */}
          <div className="flex justify-center items-center space-x-2 mb-6">
            <div className={`w-2 h-2 bg-gradient-to-r ${currentStepData.color} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
            <div className={`w-2 h-2 bg-gradient-to-r ${currentStepData.color} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
            <div className={`w-2 h-2 bg-gradient-to-r ${currentStepData.color} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>

          {/* Current step progress */}
          <div className="text-center">
            <div className="text-sm text-gray-400">
              Step {currentStep + 1} of {loadingSteps.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.round(((currentStep + 1) / loadingSteps.length) * 100)}% complete
            </div>
          </div>

          {/* Continue button for final stage */}
          {stage === 'ready' && onClose && (
            <div className="mt-6 text-center">
              <button
                onClick={onClose}
                className={`px-6 py-3 bg-gradient-to-r ${currentStepData.color} text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200`}
              >
                Continue to Session
              </button>
            </div>
          )}
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className={`w-72 h-72 bg-gradient-to-r ${currentStepData.color} rounded-full opacity-10 blur-3xl absolute -top-20 -left-20 animate-pulse`} />
          <div className={`w-72 h-72 bg-gradient-to-r ${currentStepData.color} rounded-full opacity-10 blur-3xl absolute -bottom-20 -right-20 animate-pulse`} style={{ animationDelay: '1s' }} />
        </div>
      </div>
    </div>
  );
}

export default FullScreenLoading;
