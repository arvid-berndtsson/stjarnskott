export type CliOptions = {
  manifestPath: string;
  serviceIds: string[];
  targetUrl?: string;
  mode?: 'passive' | 'active';
  url?: string;
  securityKey?: string;
  install?: boolean;
};
