import { profileName } from '../lib/workspace/api'
import { COMMUNITY_BADGE_META } from '../lib/workspace/communityBadges'
import type { ProfileRow } from '../lib/workspace/types'
import { toCommunityRelativeDate } from '../pages/shared/communityDate'
import { ProfileAvatar } from './ProfileAvatar'

type CommunityAuthorHeaderProps = {
  author?: ProfileRow | null
  createdAt: string
  badge?: string
}

export function CommunityAuthorHeader({ author, createdAt, badge }: CommunityAuthorHeaderProps) {
  return (
    <header className="course-detail-community-author-header">
      <ProfileAvatar profile={author} size="sm" />
      <div className="course-detail-community-author-meta">
        <strong>{profileName(author ?? undefined)}</strong>
        {badge && <span className="course-detail-community-badge">{badge}</span>}
        {author?.badges?.map((badgeType) => {
          const meta = COMMUNITY_BADGE_META[badgeType]

          if (!meta) {
            return null
          }

          return (
            <span
              key={badgeType}
              className="course-detail-community-title-badge"
              title={meta.label}
              aria-label={meta.label}
            >
              {meta.emoji}
            </span>
          )
        })}
        <span className="course-detail-community-meta-sep" aria-hidden="true">
          ·
        </span>
        <time className="course-detail-community-timestamp" dateTime={createdAt}>
          {toCommunityRelativeDate(createdAt)}
        </time>
      </div>
    </header>
  )
}
