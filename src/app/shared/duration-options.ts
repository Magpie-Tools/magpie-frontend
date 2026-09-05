export interface DurationOption {
  label: string;
  value: number;
}

function createDurationOptions(length: number, unit: string): DurationOption[] {
  return Array.from({length}, (_, value) => ({
    label: `${value} ${unit}`,
    value,
  }));
}

export const dayOptions = createDurationOptions(31, 'Days');
export const hourOptions = createDurationOptions(24, 'Hours');
export const minuteOptions = createDurationOptions(60, 'Minutes');
export const secondOptions = createDurationOptions(60, 'Seconds');
