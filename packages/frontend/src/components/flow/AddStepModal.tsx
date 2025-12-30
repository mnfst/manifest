import { X, LayoutGrid, FileText, PhoneForwarded } from 'lucide-react';

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stepType: 'Interface' | 'Return' | 'CallFlow') => void;
}

interface StepOption {
  type: 'Interface' | 'Return' | 'CallFlow';
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const stepOptions: StepOption[] = [
  {
    type: 'Interface',
    name: 'Interface',
    description: 'Display a UI interface with data in a layout template',
    icon: LayoutGrid,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
  },
  {
    type: 'Return',
    name: 'Return Value',
    description: 'Return a text value as the flow output',
    icon: FileText,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200 hover:border-green-400',
  },
  {
    type: 'CallFlow',
    name: 'Call Flow',
    description: 'Invoke another flow and pass its result',
    icon: PhoneForwarded,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200 hover:border-purple-400',
  },
];

/**
 * Modal for selecting a node type to add to the flow
 */
export function AddStepModal({ isOpen, onClose, onSelect }: AddStepModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Node</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Select the type of node to add to your flow:
          </p>

          <div className="space-y-3">
            {stepOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.type}
                  onClick={() => onSelect(option.type)}
                  className={`w-full flex items-start gap-4 p-4 rounded-lg border-2 ${option.borderColor} transition-all hover:shadow-md text-left`}
                >
                  <div className={`w-12 h-12 rounded-lg ${option.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${option.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{option.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
