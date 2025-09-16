import type { ReactNode } from "react"
import { focusAreaOptions, recommendedHashtags } from "./constraints"
import type { PostDraft, PostMetrics, SourceEntry } from "./utils"
import { buildPostPreview, countWords } from "./utils"

interface PostEditorProps {
  draft: PostDraft
  metrics: PostMetrics
  onFieldChange: (field: keyof PostDraft, value: PostDraft[keyof PostDraft]) => void
  onToggleFocusArea: (id: string) => void
  onUpdateSource: (sourceId: string, update: Partial<SourceEntry>) => void
  onAddSource: () => void
  onRemoveSource: (sourceId: string) => void
}

type BadgeTone = "neutral" | "positive" | "warning" | "danger"

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-primary-600 dark:text-primary">
      {children}
    </h3>
  )
}

function Badge({ children, tone = "neutral" }: BadgeProps) {
  const color = tone === "positive"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    : tone === "warning"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
      : tone === "danger"
        ? "bg-red-500/10 text-red-600 dark:text-red-300"
        : "bg-primary/5 text-primary"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${color}`}>
      {children}
    </span>
  )
}

export function PostEditor({
  draft,
  metrics,
  onFieldChange,
  onToggleFocusArea,
  onUpdateSource,
  onAddSource,
  onRemoveSource,
}: PostEditorProps) {
  const articleWordCount = metrics.article ? countWords(metrics.article) : 0
  const openingWordCount = countWords(draft.opening)
  const middleWordCount = countWords(draft.middle)
  const closingWordCount = countWords(draft.closing)
  const lengthLabel = `Length: ${metrics.characterCount} chars / ${articleWordCount} words`
  const titleLabel = `Title: ${metrics.titleLength} chars`
  const hashtagLabel = `Hashtags: ${metrics.hashtagsCount}`
  const similarityLabel = metrics.similarityPercent >= 30
    ? `Similarity: ${metrics.similarityPercent.toFixed(1)}% (rewrite required)`
    : `Similarity: ${metrics.similarityPercent.toFixed(1)}%`
  const contentLengthStatus = metrics.withinLength
    ? "Content length within 80-150 char range"
    : "Content length outside 80-150 char range"
  const bannedLabel = metrics.bannedMatches.length
    ? `Banned terms: ${metrics.bannedMatches.join(", ")}`
    : "No banned terms"
  const closestPostLabel = metrics.closestMatch ? `Closest historical post: ${metrics.closestMatch.title}` : ""
  const openingCountLabel = `Word count: ${openingWordCount}`
  const middleCountLabel = `Word count: ${middleWordCount}`
  const closingCountLabel = `Word count: ${closingWordCount}`
  const postHeading = `Post ${draft.id}`

  const handleCopy = async () => {
    const preview = buildPostPreview(draft, metrics)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(preview)
      window.dispatchEvent(new CustomEvent("toast", { detail: { title: "Post copied", message: `Post ${draft.id} ready to share.` } }))
    }
  }

  return (
    <article className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 shadow-sm space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{postHeading}</h2>
          <p className="text-xs text-neutral-500">Ensure 80-120 characters total with clear opening, middle, closing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={metrics.withinLength ? "positive" : "warning"}>{lengthLabel}</Badge>
          <Badge tone={metrics.titleWithinRange ? "positive" : "warning"}>{titleLabel}</Badge>
          <Badge tone={metrics.hashtagsWithinRange ? "positive" : "warning"}>{hashtagLabel}</Badge>
          <Badge tone={metrics.similarityPercent >= 30 ? "danger" : "positive"}>{similarityLabel}</Badge>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Title</span>
          <input
            value={draft.title}
            onChange={event => onFieldChange("title", event.target.value)}
            placeholder="Data-led headline with APAC keyword"
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Series name</span>
            <input
              value={draft.seriesName}
              onChange={event => onFieldChange("seriesName", event.target.value)}
              placeholder="e.g., India compliance traps"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Series part</span>
            <input
              value={draft.seriesPart}
              onChange={event => onFieldChange("seriesPart", event.target.value)}
              placeholder="Part 1/4"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Authority myth busting angle</span>
          <textarea
            value={draft.authorityAngle}
            onChange={event => onFieldChange("authorityAngle", event.target.value)}
            placeholder="State which outdated belief is challenged and the evidence."
            className="min-h-24 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Execution notes / immediate action</span>
          <textarea
            value={draft.executionNotes}
            onChange={event => onFieldChange("executionNotes", event.target.value)}
            placeholder="Outline step-by-step guidance for brands."
            className="min-h-24 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
        </label>
      </section>

      <section className="space-y-3">
        <SectionTitle>Focus areas</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {focusAreaOptions.map(option => (
            <label key={option.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.focusAreas.includes(option.id)}
                onChange={() => onToggleFocusArea(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.b2bHook}
            onChange={event => onFieldChange("b2bHook", event.target.checked)}
          />
          <span>Explicit B2B client acquisition hook included</span>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Opening (20-30 words)</span>
          <textarea
            value={draft.opening}
            onChange={event => onFieldChange("opening", event.target.value)}
            placeholder="Latest APAC data reveals..."
            className="min-h-28 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
          <span className="text-xs text-neutral-500">{openingCountLabel}</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Middle (40-60 words)</span>
          <textarea
            value={draft.middle}
            onChange={event => onFieldChange("middle", event.target.value)}
            placeholder="Explain regional dynamics, platform shifts, compliance complexities."
            className="min-h-28 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
          <span className="text-xs text-neutral-500">{middleCountLabel}</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Closing (20-30 words)</span>
          <textarea
            value={draft.closing}
            onChange={event => onFieldChange("closing", event.target.value)}
            placeholder="Authority-driven conclusion emphasizing agency value."
            className="min-h-28 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
          <span className="text-xs text-neutral-500">{closingCountLabel}</span>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Hashtags (3-4 high-traffic tags)</span>
          <textarea
            value={draft.hashtags}
            onChange={event => onFieldChange("hashtags", event.target.value)}
            placeholder={recommendedHashtags.slice(0, 4).join(" ")}
            className="min-h-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Media strategy</span>
          <div className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Format</span>
              <select
                value={draft.mediaFormat}
                onChange={event => onFieldChange("mediaFormat", event.target.value as PostDraft["mediaFormat"])}
                className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
              >
                <option value="Carousel">Carousel</option>
                <option value="Single image">Single image</option>
                <option value="Video">Video</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Structure</span>
              <textarea
                value={draft.mediaStructure}
                onChange={event => onFieldChange("mediaStructure", event.target.value)}
                placeholder="Frame 1 insight, Frame 2 data, Frame 3 call-to-action"
                className="min-h-18 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Key elements</span>
              <textarea
                value={draft.mediaElements}
                onChange={event => onFieldChange("mediaElements", event.target.value)}
                placeholder="Charts, localized icons, compliance checklist"
                className="min-h-18 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>AI prompt</span>
              <textarea
                value={draft.mediaPrompt}
                onChange={event => onFieldChange("mediaPrompt", event.target.value)}
                placeholder="Prompt for Midjourney / DALL·E"
                className="min-h-18 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Rationale</span>
              <textarea
                value={draft.mediaRationale}
                onChange={event => onFieldChange("mediaRationale", event.target.value)}
                placeholder="Why this format supports the message"
                className="min-h-18 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Publish strategy (weekday)</span>
          <select
            value={draft.publishStrategy}
            onChange={event => onFieldChange("publishStrategy", event.target.value)}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
          >
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>对比检查记录</span>
            <textarea
              value={draft.comparisonNotes}
              onChange={event => onFieldChange("comparisonNotes", event.target.value)}
              placeholder="Record comparison outcome vs Final_Post database"
              className="min-h-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>严格检查结果</span>
            <textarea
              value={draft.strictCheckNotes}
              onChange={event => onFieldChange("strictCheckNotes", event.target.value)}
              placeholder="Note final validation outcome"
              className="min-h-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Source validation (must be within last 7 days & double verified)</SectionTitle>
        <div className="space-y-4">
          {draft.sourceEntries.map(source => (
            <div key={source.id} className="rounded-xl border border-neutral-300/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Source</h4>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => onRemoveSource(source.id)}
                  disabled={draft.sourceEntries.length <= 1}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Tool</span>
                  <input
                    value={source.tool}
                    onChange={event => onUpdateSource(source.id, { tool: event.target.value })}
                    placeholder="Tavily / Perplexity / EXA"
                    className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Media / Outlet</span>
                  <input
                    value={source.outlet}
                    onChange={event => onUpdateSource(source.id, { outlet: event.target.value })}
                    placeholder="Reuters, Campaign Asia..."
                    className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Date</span>
                  <input
                    type="date"
                    value={source.date}
                    onChange={event => onUpdateSource(source.id, { date: event.target.value })}
                    className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>URL</span>
                  <input
                    value={source.url}
                    onChange={event => onUpdateSource(source.id, { url: event.target.value })}
                    placeholder="https://"
                    className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span>Key insight</span>
                <textarea
                  value={source.insight}
                  onChange={event => onUpdateSource(source.id, { insight: event.target.value })}
                  placeholder="Summarize the validated datapoint and its marketing impact"
                  className="min-h-18 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="rounded-full border border-dashed border-primary px-4 py-2 text-sm text-primary hover:(bg-primary/10)"
            onClick={onAddSource}
          >
            Add another source
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Quality gates</SectionTitle>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-xs">
          <Badge tone={metrics.withinLength ? "positive" : "warning"}>{contentLengthStatus}</Badge>
          <Badge tone={metrics.hasTwoVerifiedSources ? "positive" : "danger"}>
            {metrics.hasTwoVerifiedSources ? "2+ verified sources" : "Need double verification"}
          </Badge>
          <Badge tone={metrics.sourceFreshnessOk ? "positive" : "danger"}>
            {metrics.sourceFreshnessOk ? "Sources within 7 days" : "Check source dates"}
          </Badge>
          <Badge tone={metrics.bannedMatches.length ? "danger" : "positive"}>{bannedLabel}</Badge>
        </div>
        {closestPostLabel && (
          <p className="text-xs text-neutral-500">{closestPostLabel}</p>
        )}
      </section>

      <footer className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          Copy formatted output
        </button>
        <div className="text-xs text-neutral-500 self-center">
          Preview updates automatically with every change.
        </div>
      </footer>
    </article>
  )
}
