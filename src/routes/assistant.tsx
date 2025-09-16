import { createFileRoute } from "@tanstack/react-router"
import dayjs from "dayjs"
import { type ChangeEventHandler, useMemo, useState } from "react"
import { PostEditor } from "~/components/assistant/post-editor"
import { bannedMatchers, finalChecklistItems, focusAreaOptions, priorityFocusIds } from "~/components/assistant/constraints"
import type { ExistingPost, PostDraft, PostMetrics } from "~/components/assistant/utils"
import {
  buildPostPreview,
  computeSimilarity,
  countCharacters,
  countHashtags,
  countWords,
  createInitialDraft,
  createInitialSource,
  parseFinalPostDatabase,
  validateSourceRecency,
} from "~/components/assistant/utils"

export const Route = createFileRoute("/assistant")({
  component: AssistantPlanner,
})

interface CoverageSummary {
  focusCounts: Record<string, number>
  seriesMap: Map<string, number>
  hasValidSeries: boolean
  b2bCount: number
}

function evaluatePost(draft: PostDraft, existingPosts: ExistingPost[], today: dayjs.Dayjs): PostMetrics {
  const article = [draft.opening, draft.middle, draft.closing].filter(Boolean).join("\n\n")
  const wordCount = countWords(article)
  const characterCount = countCharacters(article)
  const withinLength = characterCount >= 80 && characterCount <= 150
  const hashtagsCount = countHashtags(draft.hashtags)
  const hashtagsWithinRange = hashtagsCount >= 3 && hashtagsCount <= 4
  const titleLength = draft.title.trim().length
  const titleWithinRange = titleLength >= 50 && titleLength <= 60

  let similarityScore = 0
  let closestMatch: ExistingPost | undefined
  for (const existing of existingPosts) {
    const score = computeSimilarity(article || draft.title, existing.content)
    if (score > similarityScore) {
      similarityScore = score
      closestMatch = existing
    }
  }

  const combinedText = [
    draft.title,
    draft.opening,
    draft.middle,
    draft.closing,
    draft.hashtags,
    draft.mediaStructure,
    draft.mediaElements,
    draft.mediaPrompt,
    draft.mediaRationale,
  ].join(" ")

  const bannedMatches = bannedMatchers
    .filter(({ regex }) => regex.test(combinedText))
    .map(({ label }) => label)

  const validSources = draft.sourceEntries.filter(entry => validateSourceRecency(entry, today))
  const staleSources = draft.sourceEntries.filter(entry => entry.date && !validateSourceRecency(entry, today))
  const missingSourceFields = draft.sourceEntries.filter(entry => !entry.tool || !entry.outlet || !entry.date)

  const hasTwoVerifiedSources = validSources.length >= 2
  const sourceFreshnessOk = staleSources.length === 0 && (!draft.sourceEntries.length || validSources.length === draft.sourceEntries.filter(entry => entry.date).length)

  const sourceGapReasons: string[] = []
  if (!hasTwoVerifiedSources) sourceGapReasons.push("Need at least two validated sources")
  if (staleSources.length) sourceGapReasons.push("Some sources exceed the 7-day limit")
  if (missingSourceFields.length) sourceGapReasons.push("Complete tool/outlet/date for every source")

  return {
    article,
    wordCount,
    characterCount,
    withinLength,
    hashtagsCount,
    hashtagsWithinRange,
    titleLength,
    titleWithinRange,
    similarityScore,
    similarityPercent: similarityScore * 100,
    closestMatch,
    bannedMatches,
    validSources,
    staleSources,
    missingSourceFields,
    hasTwoVerifiedSources,
    sourceFreshnessOk,
    sourceGapReasons,
  }
}

function AssistantPlanner() {
  const today = useMemo(() => dayjs(), [])
  const [databaseText, setDatabaseText] = useState("")
  const [existingPosts, setExistingPosts] = useState<ExistingPost[]>([])
  const [posts, setPosts] = useState(() => Array.from({ length: 10 }, (_, index) => createInitialDraft(index)))
  const [proposedTheme, setProposedTheme] = useState("")
  const [proposedKeywords, setProposedKeywords] = useState("")
  const [conflictNotes, setConflictNotes] = useState("")

  const metrics = useMemo(() => posts.map(post => evaluatePost(post, existingPosts, today)), [posts, existingPosts, today])

  const coverage = useMemo<CoverageSummary>(() => {
    const focusCounts: Record<string, number> = {}
    for (const option of focusAreaOptions) focusCounts[option.id] = 0
    const seriesMap = new Map<string, number>()
    let b2bCount = 0
    posts.forEach((post) => {
      post.focusAreas.forEach((area) => {
        focusCounts[area] = (focusCounts[area] ?? 0) + 1
      })
      if (post.seriesName.trim()) {
        const key = post.seriesName.trim().toLowerCase()
        seriesMap.set(key, (seriesMap.get(key) ?? 0) + 1)
      }
      if (post.b2bHook) b2bCount += 1
    })
    const hasValidSeries = Array.from(seriesMap.values()).some(count => count >= 3 && count <= 4)
    return { focusCounts, seriesMap, hasValidSeries, b2bCount }
  }, [posts])

  const automaticChecklist = useMemo(() => ({
    databaseLoaded: existingPosts.length > 0,
    similaritySafe: metrics.every(metric => !metric.article || metric.similarityPercent < 30),
    hasPriorityCoverage: priorityFocusIds.every(id => coverage.focusCounts[id] > 0),
    dataFresh: metrics.every(metric => metric.staleSources.length === 0 && metric.validSources.length >= 2),
    noBannedTerms: metrics.every(metric => metric.bannedMatches.length === 0),
    tenPosts: posts.length === 10,
    b2bIncluded: coverage.b2bCount > 0,
  }), [coverage, existingPosts.length, metrics, posts.length])

  const conflictAnalysis = useMemo(() => {
    if (!proposedTheme && !proposedKeywords) return null
    const composite = `${proposedTheme} ${proposedKeywords}`
    let maxScore = 0
    let closest: ExistingPost | undefined
    let keywordOverlap = 0
    for (const existing of existingPosts) {
      const score = computeSimilarity(composite, existing.content)
      if (score > maxScore) {
        maxScore = score
        closest = existing
      }
      if (proposedKeywords) {
        const keywords = proposedKeywords.toLowerCase().split(/[，,\s]+/).filter(Boolean)
        const overlap = keywords.filter(keyword => existing.keywords.includes(keyword)).length
        keywordOverlap = Math.max(keywordOverlap, overlap)
      }
    }
    return {
      score: maxScore * 100,
      closest,
      keywordOverlap,
    }
  }, [existingPosts, proposedKeywords, proposedTheme])

  const handleFileUpload: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setDatabaseText(text)
    setExistingPosts(parseFinalPostDatabase(text))
  }

  const handleDatabaseTextChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    const value = event.target.value
    setDatabaseText(value)
    setExistingPosts(parseFinalPostDatabase(value))
  }

  const updatePostField = (postId: number, field: keyof PostDraft, value: PostDraft[keyof PostDraft]) => {
    setPosts(current => current.map(post => (post.id === postId ? { ...post, [field]: value } : post)))
  }

  const toggleFocusArea = (postId: number, area: string) => {
    setPosts(current => current.map((post) => {
      if (post.id !== postId) return post
      const exists = post.focusAreas.includes(area)
      const focusAreas = exists ? post.focusAreas.filter(item => item !== area) : [...post.focusAreas, area]
      return { ...post, focusAreas }
    }))
  }

  const updateSource = (postId: number, sourceId: string, update: Partial<PostDraft["sourceEntries"][number]>) => {
    setPosts(current => current.map((post) => {
      if (post.id !== postId) return post
      return {
        ...post,
        sourceEntries: post.sourceEntries.map(source => (source.id === sourceId ? { ...source, ...update } : source)),
      }
    }))
  }

  const addSource = (postId: number) => {
    setPosts(current => current.map(post => (post.id === postId
      ? { ...post, sourceEntries: [...post.sourceEntries, createInitialSource()] }
      : post)))
  }

  const removeSource = (postId: number, sourceId: string) => {
    setPosts(current => current.map((post) => {
      if (post.id !== postId) return post
      if (post.sourceEntries.length <= 1) return post
      return {
        ...post,
        sourceEntries: post.sourceEntries.filter(source => source.id !== sourceId),
      }
    }))
  }

  const previews = useMemo(
    () => posts.map((post, index) => ({ id: post.id, content: buildPostPreview(post, metrics[index]) })),
    [metrics, posts],
  )

  const todaySummary = `Today is ${today.format("YYYY-MM-DD")} (auto-synced). Complete each step sequentially to satisfy the mandatory workflow.`
  const databaseSummary = existingPosts.length ? `${existingPosts.length} historical posts parsed.` : "No database loaded yet."
  const seriesStatus = coverage.hasValidSeries
    ? "Requirement: at least one series with 3-4 posts. Status: ✅"
    : "Requirement: at least one series with 3-4 posts. Status: ⚠️"
  const b2bStatus = `Posts with explicit B2B hook: ${coverage.b2bCount}`
  const focusAreaList = focusAreaOptions.map(option => (
    <li
      key={option.id}
      className="flex items-center justify-between rounded-lg border border-neutral-300/60 px-3 py-2"
    >
      <span>{option.label}</span>
      <span className="font-semibold">{coverage.focusCounts[option.id] ?? 0}</span>
    </li>
  ))
  const seriesEntries = Array.from(coverage.seriesMap.entries()).map(([name, count]) => (
    <li key={name}>{`${name} · ${count} entries`}</li>
  ))
  const seriesContent = coverage.seriesMap.size
    ? (
        <ul className="space-y-1 text-xs">
          {seriesEntries}
        </ul>
      )
    : "No series planned yet."

  return (
    <div className="space-y-8 pb-24">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Influencer Intelligence Planner</h1>
        <p className="text-sm text-neutral-500">{todaySummary}</p>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Step 1 · 日期与数据库同步</h2>
          <span className="text-xs text-neutral-500">Confirm the current date before planning.</span>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Final_Post.md</label>
            <input type="file" accept=".md,.txt" onChange={handleFileUpload} className="block text-sm" />
            <p className="text-xs text-neutral-500">If the desktop file path is unavailable, paste the latest database manually below.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Database preview</label>
            <div className="rounded-lg border border-dashed border-primary/30 p-3 text-xs text-neutral-600">
              {databaseSummary}
            </div>
          </div>
        </div>
        <textarea
          value={databaseText}
          onChange={handleDatabaseTextChange}
          placeholder="Paste Final_Post.md content here to enable conflict checks."
          className="min-h-40 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-sm focus:(outline-none border-primary)"
        />
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Step 2 · 冲突预判</h2>
          <span className="text-xs text-neutral-500">Similarity must stay below 30% before drafting.</span>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span>Proposed theme</span>
            <input
              value={proposedTheme}
              onChange={event => setProposedTheme(event.target.value)}
              placeholder="e.g., Indian festive season compliance"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Keywords</span>
            <input
              value={proposedKeywords}
              onChange={event => setProposedKeywords(event.target.value)}
              placeholder="regulatory shift, creator payouts"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Pre-analysis note</span>
            <textarea
              value={conflictNotes}
              onChange={event => setConflictNotes(event.target.value)}
              placeholder="Record why the topic is distinct vs historical posts."
              className="min-h-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
        </div>
        {conflictAnalysis && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm space-y-2">
            <p>{`Predicted similarity: ${conflictAnalysis.score.toFixed(1)}%`}</p>
            <p>{`Keyword overlap count: ${conflictAnalysis.keywordOverlap}`}</p>
            {conflictAnalysis.closest && (
              <p>{`Closest existing post: ${conflictAnalysis.closest.title}`}</p>
            )}
            <p className="text-xs text-neutral-600">Ensure similarity remains below 30% before drafting. If higher, redefine the topic.</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-3">
        <h2 className="text-xl font-semibold">Step 3 · 搜索守则速查</h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li className="rounded-lg border border-dashed border-primary/30 p-3">Use Tavily + Perplexity/EXA for every datapoint (double verification).</li>
          <li className="rounded-lg border border-dashed border-primary/30 p-3">Always include time filters: “past week”, “last 7 days”, “recent”, “this week”, “latest”.</li>
          <li className="rounded-lg border border-dashed border-primary/30 p-3">Accept sources only from the approved authority list; reject competitor materials.</li>
          <li className="rounded-lg border border-dashed border-primary/30 p-3">Capture date, outlet, and actionable marketing impact in the insight field.</li>
        </ul>
      </section>

      <section className="space-y-6">
        {posts.map((post, index) => (
          <PostEditor
            key={post.id}
            draft={post}
            metrics={metrics[index]}
            onFieldChange={(field, value) => updatePostField(post.id, field, value)}
            onToggleFocusArea={area => toggleFocusArea(post.id, area)}
            onUpdateSource={(sourceId, update) => updateSource(post.id, sourceId, update)}
            onAddSource={() => addSource(post.id)}
            onRemoveSource={sourceId => removeSource(post.id, sourceId)}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Step 4 · 策略覆盖进度</h2>
          <span className="text-xs text-neutral-500">Track pillar coverage, series design, and B2B hooks.</span>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Focus area coverage</h3>
            <ul className="grid gap-2 text-xs">
              {focusAreaList}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Series health</h3>
            <div className="rounded-lg border border-dashed border-primary/30 p-3 text-sm">
              {seriesContent}
            </div>
            <p className="text-xs text-neutral-500">{seriesStatus}</p>
            <p className="text-xs text-neutral-500">{b2bStatus}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Step 5 · 提交前严格检查</h2>
          <span className="text-xs text-neutral-500">All conditions must be satisfied before publishing.</span>
        </header>
        <ul className="space-y-2 text-sm">
          {finalChecklistItems.map((item) => {
            let status = false
            switch (item) {
              case "已读取Final_Post.md并记录重复主题，包含内容、数据都没有和已经post过的相同":
                status = automaticChecklist.databaseLoaded
                break
              case "确认与Final_Post.md相似度<30%":
                status = automaticChecklist.similaritySafe
                break
              case "包含行业重要新闻或重大事件影响分析":
                status = automaticChecklist.hasPriorityCoverage
                break
              case "所有数据来自最近7天内":
                status = automaticChecklist.dataFresh
                break
              case "无竞品/nano词汇":
                status = automaticChecklist.noBannedTerms
                break
              case "10篇不同风格":
                status = automaticChecklist.tenPosts
                break
              case "包含B2B吸引策略":
                status = automaticChecklist.b2bIncluded
                break
              default:
                status = false
            }
            return (
              <li key={item} className="flex items-center justify-between rounded-lg border border-neutral-300/60 px-4 py-2">
                <span>{item}</span>
                <span className={status ? "text-emerald-500" : "text-red-500"}>{status ? "完成" : "待处理"}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-base bg-op-70! p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Step 6 · 输出预览</h2>
          <span className="text-xs text-neutral-500">Copy-ready markdown for LinkedIn publishing.</span>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {previews.map(preview => (
            <textarea
              key={preview.id}
              value={preview.content}
              readOnly
              className="min-h-60 rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-xs font-mono"
            />
          ))}
        </div>
      </section>
    </div>
  )
}
