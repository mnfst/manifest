import { useEffect, useRef } from 'react';
import { Layout, FileText, PhoneForwarded, X } from 'lucide-react';

export type StepType = 'view' | 'returnValue' | 'callFlow';

interface StepTypeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: StepType) => void;
  disabledTypes?: StepType[];
}

/**
 * Drawer for selecting the type of step to add to a flow
 * Offers View and Return Value options
 */
export function StepTypeDrawer({
  isOpen,
  onClose,
  onSelect,
  disabledTypes = [],
}: StepTypeDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSelect = (type: StepType) => {
    if (!disabledTypes.includes(type)) {
      onSelect(type);
      onClose();
    }
  };

  const isViewDisabled = disabledTypes.includes('view');
  const isReturnValueDisabled = disabledTypes.includes('returnValue');
  const isCallFlowDisabled = disabledTypes.includes('callFlow');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={drawerRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-type-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="step-type-title" className="text-lg font-semibold">
            Add Step
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Choose the type of step to add to your flow:
          </p>

          {/* View Option */}
          <button
            onClick={() => handleSelect('view')}
            disabled={isViewDisabled}
            className={`w-full p-4 border rounded-lg text-left transition-all group ${
              isViewDisabled
                ? 'opacity-50 cursor-not-allowed bg-muted'
                : 'hover:border-primary hover:bg-primary/5 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isViewDisabled ? 'bg-gray-100' : 'bg-blue-100 group-hover:bg-blue-200'
              }`}>
                <Layout className={`w-5 h-5 ${isViewDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-medium ${isViewDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                  View
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Display data in the ChatGPT interface using a layout template
                </p>
                {isViewDisabled && (
                  <p className="text-xs text-amber-600 mt-2">
                    Cannot add views to a flow with return values
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Return Value Option */}
          <button
            onClick={() => handleSelect('returnValue')}
            disabled={isReturnValueDisabled}
            className={`w-full p-4 border rounded-lg text-left transition-all group ${
              isReturnValueDisabled
                ? 'opacity-50 cursor-not-allowed bg-muted'
                : 'hover:border-primary hover:bg-primary/5 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isReturnValueDisabled ? 'bg-gray-100' : 'bg-green-100 group-hover:bg-green-200'
              }`}>
                <FileText className={`w-5 h-5 ${isReturnValueDisabled ? 'text-gray-400' : 'text-green-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-medium ${isReturnValueDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                  Return Value
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Return text content to the LLM for further processing
                </p>
                {isReturnValueDisabled && (
                  <p className="text-xs text-amber-600 mt-2">
                    Cannot add return values to a flow with views
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Call Flow Option */}
          <button
            onClick={() => handleSelect('callFlow')}
            disabled={isCallFlowDisabled}
            className={`w-full p-4 border rounded-lg text-left transition-all group ${
              isCallFlowDisabled
                ? 'opacity-50 cursor-not-allowed bg-muted'
                : 'hover:border-primary hover:bg-primary/5 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isCallFlowDisabled ? 'bg-gray-100' : 'bg-purple-100 group-hover:bg-purple-200'
              }`}>
                <PhoneForwarded className={`w-5 h-5 ${isCallFlowDisabled ? 'text-gray-400' : 'text-purple-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-medium ${isCallFlowDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                  Call Flow
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Trigger another flow in this app when this action executes
                </p>
                {isCallFlowDisabled && (
                  <p className="text-xs text-amber-600 mt-2">
                    Cannot add call flows to a flow with views or return values
                  </p>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
