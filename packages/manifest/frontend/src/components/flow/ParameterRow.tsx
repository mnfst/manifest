import { Trash2, Lock } from 'lucide-react';
import type { FlowParameter, ParameterType } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PARAMETER_TYPES: { value: ParameterType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

interface ParameterRowProps {
  parameter: FlowParameter;
  index: number;
  onChange: (index: number, updated: FlowParameter) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Single parameter row with name input, type dropdown, optional checkbox, and remove button
 */
export function ParameterRow({
  parameter,
  index,
  onChange,
  onRemove,
  disabled = false,
  error,
}: ParameterRowProps) {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...parameter, name: e.target.value });
  };

  const handleTypeChange = (value: string) => {
    onChange(index, { ...parameter, type: value as ParameterType });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...parameter, description: e.target.value });
  };

  const handleOptionalChange = (checked: boolean) => {
    onChange(index, { ...parameter, optional: checked });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  const isSystem = parameter.isSystem === true;
  const isFieldDisabled = disabled || isSystem;

  return (
    <div
      className={`space-y-2 p-3 border rounded-lg ${
        isSystem
          ? 'bg-muted/50 border-muted-foreground/20 opacity-75'
          : 'bg-muted/30'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* System parameter indicator */}
        {isSystem && (
          <div className="flex items-center gap-1 px-2 py-2" title="System parameter (cannot be modified)">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* Name input */}
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            value={parameter.name}
            onChange={handleNameChange}
            placeholder="Parameter name"
            className={`text-sm ${error ? 'border-destructive' : ''} ${isSystem ? 'cursor-not-allowed' : ''}`}
            disabled={isFieldDisabled}
            maxLength={50}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>

        {/* Type dropdown */}
        <Select
          value={parameter.type}
          onValueChange={handleTypeChange}
          disabled={isFieldDisabled}
        >
          <SelectTrigger className={`min-w-[110px] ${isSystem ? 'cursor-not-allowed' : ''}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARAMETER_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Optional checkbox */}
        <Label
          className={`flex items-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap font-normal ${
            isSystem ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <Checkbox
            checked={parameter.optional}
            onCheckedChange={handleOptionalChange}
            disabled={isFieldDisabled}
          />
          <span className="text-muted-foreground">Optional</span>
        </Label>

        {/* Remove button - hidden for system parameters */}
        {!isSystem && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove parameter ${parameter.name || index + 1}`}
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Description input */}
      <Input
        type="text"
        value={parameter.description}
        onChange={handleDescriptionChange}
        placeholder="Description (e.g., The user's email address)"
        className={`text-sm ${isSystem ? 'cursor-not-allowed' : ''}`}
        disabled={isFieldDisabled}
        maxLength={350}
      />
    </div>
  );
}
