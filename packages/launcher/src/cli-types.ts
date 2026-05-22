export type CliOptions = {
  manifestPath: string;
  serviceIds: string[];
  targetUrl?: string;
  mode?: 'passive' | 'active';
};

