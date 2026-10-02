import type { Session } from "../types.js";
import { jaccard, wordSet } from "../normalize.js";

const CORRECTION =
  /^(no[,.! ]|nope\b|stop\b|wait\b|don'?t\b|do not\b|never\b|please don'?t|that'?s (not|wrong|incorrect)|wrong\b|i (said|told you|asked|already|meant)|why (did|are|do) you|you (should|shouldn'?t|forgot|didn'?t|keep|still|need to|must|\w+ed\b)|again\b|instead\b|actually[, ]|not that\b|always\b)/i;

export interface RawCorrection {
  text: string;
  sessionId: string;
  ts: number;
}

export function findCorrections(s: Session): RawCorrection[] {
  return s.messages
    .filter((m) => m.text.length >= 12 && m.text.length <= 300 && CORRECTION.test(m.text.trim()))
    .map((m) => ({ text: m.text.trim().replace(/\s+/g, " "), sessionId: s.id, ts: m.ts }));
}

export interface Cluster {
  text: string;
  words: Set<string>;
  items: RawCorrection[];
}

/** Greedy clustering by word overlap: "don't use sudo" and "do not use sudo here" land together. */
export function clusterCorrections(items: RawCorrection[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const item of items) {
    const words = wordSet(item.text);
    if (words.size < 2) continue;
    const home = clusters.find((c) => jaccard(c.words, words) >= 0.45);
    if (home) {
      home.items.push(item);
      if (item.text.length < home.text.length) home.text = item.text;
    } else {
      clusters.push({ text: item.text, words, items: [item] });
    }
  }
  return clusters;
}
