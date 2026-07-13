export function accountAvatarInitials(
  profileName: string | null | undefined,
  fallbackIdentity: string,
) {
  const nameParts = profileName?.trim().split(/\s+/).filter(Boolean) ?? []

  if (nameParts.length >= 2) {
    const firstName = nameParts[nameParts.length - 1]
    const lastName = nameParts[0]

    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase()
  }

  return fallbackIdentity.trim().slice(0, 2).toUpperCase() || 'WU'
}
