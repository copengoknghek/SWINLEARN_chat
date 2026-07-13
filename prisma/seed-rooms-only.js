import { prisma } from '../server/db.js'
import { CONSULTATION_ROOM_NAMES, seedConsultationRooms } from './consultationRooms.js'

async function main() {
  const count = await seedConsultationRooms(prisma)
  console.log(`Upserted ${count} consultation rooms: ${CONSULTATION_ROOM_NAMES.join(', ')}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
