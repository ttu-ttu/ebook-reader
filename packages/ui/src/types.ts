/**
 * @custom-ereader/ui
 * Common types and component interfaces
 */

export interface SegmentOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ToggleGroupOption<T = any> {
  id: T;
  text: string;
  style?: Record<string, string>;
  thickBorders?: boolean;
  showIcons?: boolean;
  disabled?: boolean;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonElevation = 'none' | 'sm' | 'md';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'subtle' | 'outline';
export type IconButtonShape = 'rounded' | 'circle';

export type CardVariant = 'surface' | 'card' | 'flat' | 'elevated';
export type CardElevation = 'none' | 'sm' | 'md' | 'lg';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRadius = 'sm' | 'md' | 'lg';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type DialogSize = 'sm' | 'md' | 'lg' | 'full';
export type AstryxTheme = 'neutral' | 'stone' | 'gothic';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'outline' | 'filled' | 'underline';

export type ListVariant = 'plain' | 'card' | 'bordered';
export type ListDensity = 'compact' | 'normal' | 'relaxed';
export type ListItemDensity = 'compact' | 'normal' | 'relaxed';
export type ListItemLayout = 'row' | 'stacked';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}
export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'outline' | 'filled' | 'underline';

export interface TabItem {
  id: string;
  label: string;
  icon?: any;
  badge?: string | number;
  disabled?: boolean;
}
export type TabVariant = 'pill' | 'underline' | 'bar';
export type TabSize = 'sm' | 'md' | 'lg';
