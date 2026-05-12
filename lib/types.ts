export interface SlidePoint {
  heading: string;
  detail: string;
}

// Layout determines how the slide canvas renders
export type SlideLayout = "hero" | "bullets" | "steps" | "two-column" | "stat";

export interface DocumentSection {
  id: string;
  index: number;
  title: string;
  content: string;
  script: string;
  duration: number;
  keyPoints: string[];
  slidePoints: SlidePoint[];
  layout: SlideLayout;
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  title: string;
  summary: string;
  sections: DocumentSection[];
  totalDuration: number;
  createdAt: string;
}

export interface AnalyticsEvent {
  sessionId: string;
  docId: string;
  type: "play" | "pause" | "skip" | "seek" | "section_complete" | "question_asked" | "revisit";
  sectionIndex?: number;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface SectionAnalytics {
  sectionIndex: number;
  title: string;
  watchTime: number;       // seconds
  completionRate: number;  // 0-1
  skipped: boolean;
  revisits: number;
  questionsAsked: number;
}

export interface DocAnalytics {
  docId: string;
  totalSessions: number;
  avgWatchTime: number;
  completionRate: number;
  totalQuestions: number;
  sections: SectionAnalytics[];
  topQuestions: string[];
}
