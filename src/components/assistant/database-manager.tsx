import dayjs from "dayjs"
import { type ChangeEvent, type FormEventHandler, type ReactNode, useMemo, useState } from "react"
import type { DatabaseEntryDraft, ExistingPost } from "./utils"

interface DatabaseManagerProps {
  entries: ExistingPost[]
  onAdd: (entry: DatabaseEntryDraft) => void
}

function createInitialEntry(): DatabaseEntryDraft {
  return {
    title: "",
    keywords: "",
    dataPoints: "",
    publishDate: dayjs().format("YYYY-MM-DD"),
  }
}

export function DatabaseManager({ entries, onAdd }: DatabaseManagerProps) {
  const [form, setForm] = useState<DatabaseEntryDraft>(createInitialEntry)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof DatabaseEntryDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value
    setForm(current => ({ ...current, [field]: value }))
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const trimmed: DatabaseEntryDraft = {
      title: form.title.trim(),
      keywords: form.keywords.trim(),
      dataPoints: form.dataPoints.trim(),
      publishDate: form.publishDate.trim(),
    }

    if (!trimmed.title || !trimmed.keywords || !trimmed.dataPoints || !trimmed.publishDate) {
      setError("Please complete title, keywords, data points, and publish date before adding.")
      return
    }

    setError(null)
    onAdd(trimmed)
    setForm(createInitialEntry())
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("toast", { detail: { title: "Database updated", message: "Entry appended to Final_Post.md" } }))
    }
  }

  const keywordsSummary = useMemo(() => {
    const tally = new Map<string, number>()
    entries.forEach((entry) => {
      entry.keywords.forEach((keyword) => {
        const current = tally.get(keyword) ?? 0
        tally.set(keyword, current + 1)
      })
    })
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [entries])

  const existingRecordsContent = useMemo<ReactNode>(() => {
    if (entries.length === 0) {
      return <p className="text-xs text-neutral-500">No records loaded yet.</p>
    }

    return entries.map(entry => (
      <article
        key={entry.id}
        className="space-y-1 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 text-xs dark:bg-neutral-900/60"
      >
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{entry.title}</p>
        {entry.publishDate && (
          <p className="text-[11px] text-neutral-500">
            <span>Publish Date:</span>
            <span className="ml-1">{entry.publishDate}</span>
          </p>
        )}
        {entry.keywords.length > 0 && (
          <p className="text-[11px] text-neutral-500">
            <span>Keywords:</span>
            <span className="ml-1">{entry.keywords.join(", ")}</span>
          </p>
        )}
        {entry.dataPoints && (
          <p className="text-[11px] text-neutral-500 line-clamp-2">
            <span>Data Points:</span>
            <span className="ml-1">{entry.dataPoints}</span>
          </p>
        )}
      </article>
    ))
  }, [entries])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Final_Post database helper</h3>
          <span className="text-xs text-neutral-500">{`${entries.length} historical posts loaded`}</span>
        </div>
        <p className="text-xs text-neutral-500">
          Upload or paste your Final_Post.md above, then append new records here without leaving the planner.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Existing records</h4>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-300/60 p-3 space-y-3">
            {existingRecordsContent}
          </div>
          {keywordsSummary.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Top keywords</h4>
              <ul className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                {keywordsSummary.map(([keyword, count]) => (
                  <li key={keyword} className="rounded-full border border-neutral-200 px-3 py-1 text-center">
                    {`${keyword} · ${count}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Add new record</h4>
            <p className="text-[11px] text-neutral-500">
              Complete every field to keep the historical database aligned with mandatory checks.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span>Title</span>
            <input
              value={form.title}
              onChange={handleChange("title")}
              placeholder="Theme or headline"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Keywords</span>
            <input
              value={form.keywords}
              onChange={handleChange("keywords")}
              placeholder="Separate with commas"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Data points</span>
            <textarea
              value={form.dataPoints}
              onChange={handleChange("dataPoints")}
              placeholder="Key metrics or findings"
              className="min-h-24 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Publish date</span>
            <input
              type="date"
              value={form.publishDate}
              onChange={handleChange("publishDate")}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 focus:(outline-none border-primary)"
            />
          </label>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <button
            type="submit"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Append to database text
          </button>
        </form>
      </div>
    </div>
  )
}
