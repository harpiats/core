import type { Store } from "./store";

export interface VisitorData {
  totalRequests: number;
  pagesVisited: { path: string; timestamp: string; trafficSource?: TrafficSource }[];
  responseTimes: number[];
  errors: number;
}

type DailyVisitors = Map<string, VisitorData>;

type AccessData = {
  visitorsByDate: Map<string, DailyVisitors>;
  totalRequests: number;
};

type BehaviorData = {
  pageViews: Map<string, number>;
};

export interface MonitorInterface {
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
};
