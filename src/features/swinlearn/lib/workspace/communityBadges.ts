export type CommunityBadgeType =
  | 'FAN_FAVORITE'
  | 'SUPER_SUPPORTER'
  | 'GOLD_KING'
  | 'TRENDING_CREATOR'
  | 'NEWBIE'

export const COMMUNITY_BADGE_META: Record<
  CommunityBadgeType,
  { emoji: string; label: string }
> = {
  FAN_FAVORITE: { emoji: '❤️', label: 'Fan Favorite' },
  SUPER_SUPPORTER: { emoji: '🤝', label: 'Super Supporter' },
  GOLD_KING: { emoji: '👑', label: 'Gold King' },
  TRENDING_CREATOR: { emoji: '🔥', label: 'Trending Creator' },
  NEWBIE: { emoji: '🌱', label: 'Newbie' },
}
