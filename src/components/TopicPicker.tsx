import { TRACK_LABEL, topicsFor, type Track } from '../content/topics'
import type { Lang } from '../db'
import { Icon } from './ui'

/**
 * Topic chips grouped by track (Everyday / Courtroom & law / AI). Locked
 * tracks show why they're locked and how to open them.
 */
export function TopicPicker({
  lang,
  track,
  topic,
  onTrack,
  onTopic,
  unlocked,
  lockedHint,
}: {
  lang: Lang
  track: Track
  topic: string
  onTrack: (t: Track) => void
  onTopic: (id: string) => void
  unlocked: Record<Track, boolean>
  lockedHint: string
}) {
  const tracks = (['general', 'law', 'ai'] as Track[]).filter((t) => topicsFor(lang, t).length > 0)
  const topics = topicsFor(lang, track)
  return (
    <div className="field">
      <span className="field-label">Topic</span>
      {tracks.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Topic group">
          {tracks.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={track === t}
              className={track === t ? 'on' : ''}
              onClick={() => {
                onTrack(t)
                if (unlocked[t]) onTopic(topicsFor(lang, t)[0].id)
              }}
            >
              {!unlocked[t] && <Icon name="lock" size={13} />} {TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      {unlocked[track] ? (
        <div className="chips">
          {topics.map((t) => (
            <button key={t.id} type="button" className={'chip' + (topic === t.id ? ' on' : '')} onClick={() => onTopic(t.id)}>
              {t.role ? '🎭 ' : ''}
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint locked-hint">
          <Icon name="lock" size={14} /> {lockedHint}
        </p>
      )}
    </div>
  )
}
