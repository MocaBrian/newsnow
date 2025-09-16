import dayjs from "dayjs"

export interface ExistingPost {
  id: number
  title: string
  keywords: string[]
  content: string
  raw: string
}

export interface SourceEntry {
  id: string
  tool: string
  outlet: string
  date: string
  url: string
  insight: string
}

export interface PostDraft {
  id: number
  title: string
  opening: string
  middle: string
  closing: string
  hashtags: string
  mediaFormat: "Carousel" | "Single image" | "Video"
  mediaStructure: string
  mediaElements: string
  mediaPrompt: string
  mediaRationale: string
  publishStrategy: string
  comparisonNotes: string
  strictCheckNotes: string
  focusAreas: string[]
  seriesName: string
  seriesPart: string
  authorityAngle: string
  executionNotes: string
  b2bHook: boolean
  sourceEntries: SourceEntry[]
}

export interface PostMetrics {
  article: string
  wordCount: number
  characterCount: number
  withinLength: boolean
  hashtagsCount: number
  hashtagsWithinRange: boolean
  titleLength: number
  titleWithinRange: boolean
  similarityScore: number
  similarityPercent: number
  closestMatch?: ExistingPost
  bannedMatches: string[]
  validSources: SourceEntry[]
  staleSources: SourceEntry[]
  missingSourceFields: SourceEntry[]
  hasTwoVerifiedSources: boolean
  sourceFreshnessOk: boolean
  sourceGapReasons: string[]
}

export function createInitialSource(): SourceEntry {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    tool: "",
    outlet: "",
    date: "",
    url: "",
    insight: "",
  }
}

export function createInitialDraft(index: number): PostDraft {
  return {
    id: index + 1,
    title: "",
    opening: "",
    middle: "",
    closing: "",
    hashtags: "",
    mediaFormat: "Single image",
    mediaStructure: "",
    mediaElements: "",
    mediaPrompt: "",
    mediaRationale: "",
    publishStrategy: "Monday",
    comparisonNotes: "",
    strictCheckNotes: "",
    focusAreas: [],
    seriesName: "",
    seriesPart: "",
    authorityAngle: "",
    executionNotes: "",
    b2bHook: false,
    sourceEntries: [createInitialSource(), createInitialSource()],
  }
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function uniqueTokens(text: string) {
  const tokens = normalize(text).split(" ").filter(Boolean)
  return Array.from(new Set(tokens))
}

export function computeSimilarity(a: string, b: string) {
  const tokensA = uniqueTokens(a)
  const tokensB = uniqueTokens(b)
  if (!tokensA.length || !tokensB.length) return 0
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection += 1
  }
  const union = new Set([...tokensA, ...tokensB]).size
  return union ? intersection / union : 0
}

export function countWords(text: string) {
  return normalize(text).split(" ").filter(Boolean).length
}

export function countCharacters(text: string) {
  return text.replace(/\s/g, "").length
}

export function countHashtags(value: string) {
  return (value.match(/#[^#\s]+/g) ?? []).length
}

export function parseFinalPostDatabase(input: string): ExistingPost[] {
  if (!input.trim()) return []
  const sections = input.split(/\n(?=Title:)/).filter(Boolean)
  return sections.map((section, index) => {
    const titleMatch = section.match(/Title:\s*(.+)/)
    const keywordsMatch = section.match(/Keywords?:\s*(.+)/i)
    return {
      id: index + 1,
      title: titleMatch ? titleMatch[1].trim() : `Untitled ${index + 1}`,
      keywords: keywordsMatch
        ? keywordsMatch[1].split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean)
        : [],
      content: section.trim(),
      raw: section,
    }
  })
}

export function validateSourceRecency(entry: SourceEntry, today: dayjs.Dayjs) {
  if (!entry.date) return false
  const date = dayjs(entry.date)
  if (!date.isValid()) return false
  return Math.abs(today.diff(date, "day")) <= 6
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildPostPreview(draft: PostDraft, metrics: PostMetrics) {
  const articleLines = [draft.opening, draft.middle, draft.closing].map(line => line.trim()).filter(Boolean)
  const sourcesLine = draft.sourceEntries
    .filter(source => source.outlet || source.tool || source.date)
    .map((source) => {
      const parts = [source.outlet, source.tool && `(via ${source.tool})`, source.date].filter(Boolean)
      const urlPart = source.url ? ` ${source.url}` : ""
      return `${parts.join(" ")}${urlPart ? ` ${urlPart}` : ""}`.trim()
    })
    .join("; ") || "来源不可用"
  const similarityText = metrics.similarityPercent >= 30
    ? `${metrics.similarityPercent.toFixed(1)}% (需重写)`
    : `${metrics.similarityPercent.toFixed(1)}%`
  const mediaSuggestion = [
    `Format: ${draft.mediaFormat}`,
    draft.mediaStructure && `Structure: ${draft.mediaStructure}`,
    draft.mediaElements && `Key elements: ${draft.mediaElements}`,
    draft.mediaPrompt && `AI prompt: ${draft.mediaPrompt}`,
    draft.mediaRationale && `Reason: ${draft.mediaRationale}`,
  ].filter(Boolean).join(" | ")

  return [
    `Title: ${draft.title}`,
    `Article:`,
    ...articleLines,
    `HashTags: ${draft.hashtags}`,
    `Media Suggestion: ${mediaSuggestion}`,
    `与已发布过内容的相似性: ${similarityText}`,
    `发布策略: ${draft.publishStrategy}`,
    `来源日期: ${sourcesLine}`,
    `对比检查: ${draft.comparisonNotes || "未填写"}`,
    `严格检查结果: ${draft.strictCheckNotes || "未填写"}`,
  ].join("\n")
}
