// types/admin.types.ts

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetIn: string;
}

export interface DetailedRateLimitInfo {
  ip: string;
  limits: {
    api: RateLimitInfo;
    auth: RateLimitInfo;
    search: RateLimitInfo;
    order: RateLimitInfo;
  };
}

export interface ClearLimitInfo {
  cleared: number;
}
