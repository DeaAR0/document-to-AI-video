import type { AnalyticsEvent, DocAnalytics, SectionAnalytics } from "./types";

const eventLog: AnalyticsEvent[] = [];

// Track play start times per session+section to compute watchTime
const playStarts = new Map<string, number>(); // key: `${sessionId}:${sectionIndex}`

export function recordEvent(event: AnalyticsEvent) {
  eventLog.push(event);

  const key = `${event.sessionId}:${event.sectionIndex ?? 0}`;

  if (event.type === "play") {
    // Record wall-clock start time
    playStarts.set(key, event.timestamp);
  } else if (
    (event.type === "pause" || event.type === "section_complete" || event.type === "skip") &&
    playStarts.has(key)
  ) {
    // Compute elapsed seconds and store as a synthetic watchtime event
    const started = playStarts.get(key)!;
    const elapsed = Math.round((event.timestamp - started) / 1000);
    playStarts.delete(key);
    if (elapsed > 0) {
      eventLog.push({
        sessionId: event.sessionId,
        docId: event.docId,
        type: "seek", // reuse seek type as watchtime marker
        sectionIndex: event.sectionIndex,
        timestamp: event.timestamp,
        payload: { watchSeconds: elapsed },
      });
    }
  }
}

export function getAnalytics(docId: string): DocAnalytics {
  const events = eventLog.filter((e) => e.docId === docId);
  const sessions = new Set(events.map((e) => e.sessionId));

  const questions = events.filter((e) => e.type === "question_asked");
  const topQuestions = questions
    .map((e) => (e.payload?.question as string) || "")
    .filter(Boolean)
    .slice(0, 5);

  // Build per-section analytics
  const sectionMap = new Map<number, SectionAnalytics>();

  events.forEach((e) => {
    if (e.sectionIndex === undefined) return;
    if (!sectionMap.has(e.sectionIndex)) {
      sectionMap.set(e.sectionIndex, {
        sectionIndex: e.sectionIndex,
        title: (e.payload?.sectionTitle as string) || `Section ${e.sectionIndex + 1}`,
        watchTime: 0,
        completionRate: 0,
        skipped: false,
        revisits: 0,
        questionsAsked: 0,
      });
    }
    const sec = sectionMap.get(e.sectionIndex)!;
    if (e.type === "section_complete") sec.completionRate = 1;
    if (e.type === "skip") sec.skipped = true;
    if (e.type === "revisit") sec.revisits++;
    if (e.type === "question_asked") sec.questionsAsked++;
    // Accumulate real watchTime from synthetic markers
    if (e.type === "seek" && e.payload?.watchSeconds) {
      sec.watchTime += e.payload.watchSeconds as number;
      // If watch time >= some threshold treat as partial completion
      if (sec.completionRate === 0 && sec.watchTime > 5) sec.completionRate = 0.5;
    }
    // Capture section title from any event that has it
    if (e.payload?.sectionTitle && sec.title === `Section ${e.sectionIndex + 1}`) {
      sec.title = e.payload.sectionTitle as string;
    }
  });

  const secList = Array.from(sectionMap.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
  const totalWatchTime = secList.reduce((acc, s) => acc + s.watchTime, 0);
  const avgCompletion = secList.length > 0
    ? secList.reduce((acc, s) => acc + s.completionRate, 0) / secList.length
    : 0;

  return {
    docId,
    totalSessions: sessions.size,
    avgWatchTime: Math.round(totalWatchTime),
    completionRate: avgCompletion,
    totalQuestions: questions.length,
    sections: secList,
    topQuestions,
  };
}

export function getAllDocIds(): string[] {
  return [...new Set(eventLog.map((e) => e.docId))];
}
