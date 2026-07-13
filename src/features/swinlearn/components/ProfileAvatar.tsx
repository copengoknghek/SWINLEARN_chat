import { accountAvatarInitials } from '../pages/shared/accountProfileInitials'
import { profileName } from '../lib/workspace/api'
import type { ProfileRow } from '../lib/workspace/types'

type ProfileAvatarProfile = Pick<
  ProfileRow,
  'full_name' | 'display_name' | 'email' | 'student_id' | 'avatar_url'
>

type ProfileAvatarProps = {
  profile?: ProfileAvatarProfile | null
  size?: 'sm' | 'md'
  className?: string
}

export function ProfileAvatar({ profile, size = 'sm', className }: ProfileAvatarProps) {
  const initials = accountAvatarInitials(
    profile?.full_name ?? profile?.display_name ?? profileName(profile ?? undefined),
    profile?.email ?? profile?.student_id ?? 'WU',
  )
  const sizeClass = size === 'md' ? 'profile-avatar profile-avatar--md' : 'profile-avatar profile-avatar--sm'
  const classes = [sizeClass, className].filter(Boolean).join(' ')

  if (profile?.avatar_url) {
    return <img className={classes} src={profile.avatar_url} alt="" aria-hidden="true" />
  }

  return (
    <span className={classes} aria-hidden="true">
      {initials}
    </span>
  )
}
