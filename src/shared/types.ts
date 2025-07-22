export interface BlockPeriod {
  start: string; // HH:mm
  end: string;   // HH:mm
  domains: string[];
}

export interface BlockListResponse {
  periods: BlockPeriod[];
} 