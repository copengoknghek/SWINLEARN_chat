export const CONSULTATION_ROOM_NAMES = [
  'India room',
  'Australia',
  'Japan',
  'Innovation Lab',
  'Vietnam',
  'Malaysia',
  'Cambodia',
]

export async function seedConsultationRooms(prismaClient) {
  for (const name of CONSULTATION_ROOM_NAMES) {
    await prismaClient.room.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  return CONSULTATION_ROOM_NAMES.length
}
