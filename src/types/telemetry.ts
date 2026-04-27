import type { Store } from "./store";

export interface VisitError {
  code: number;
  message: string;
}

export interface VisitData {
  path: string;
  timestamp: string;
  responseTime: number;
  error: VisitError | null;
  trafficSource?: TrafficSource;
}

export interface VisitorData {
  totalRequests: number;
  visits: VisitData[];
}

type DailyVisitors = Map<string, VisitorData>;

type AccessData = {
  visitorsByDate: Map<string, DailyVisitors>;
  totalRequests: number;
};

type BehaviorData = {
  pageViews: Map<string, number>;
};

export interface TelemetryData {
  access: AccessData;
  behavior: BehaviorData;
}

export interface TrafficSource {
  utm?: {
    id?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    sourcePlatform?: string;
    term?: string;
    content?: string;
    creativeFormat?: string;
    marketingTactic?: string;
  };
  [key: string]: any;
}

export type Options = {
  store?: Store;
  ignore?: string[];
  trustProxy?: boolean;
  maxVisitorsKeys?: number;
  accessToken?: string;
  allowedIps?: string[];
};

export interface TelemetrySummary {
  date: string;
  totalRequests: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  avgResponseTime: number;
  totalErrors: number;
}

export interface DailyStats {
  date: string;
  totalRequests: number;
  uniqueVisitors: number;
}

export interface PageData {
  path: string;
  views: number;
  visitors: string[];
  avgResponseTime: number;
  errorCount: number;
}

export interface SecurityParams {
  token?: string;
  callerIp?: string;
}

export interface QueryParams extends SecurityParams {
  date?: string;
}

export interface SummaryParams extends QueryParams {
  limit?: number;
}

export interface VisitorByIpParams extends QueryParams {
  ip: string;
}

export interface PageByPathParams extends QueryParams {
  path: string;
}

export interface SlowRequestsParams extends QueryParams {
  threshold: number;
}

export interface TopPagesParams extends QueryParams {
  limit: number;
}

export interface TrafficSourcesParams extends QueryParams {
  source?: string;
}

export interface DeleteParams extends SecurityParams {
  ip?: string;
  date?: string;
}
