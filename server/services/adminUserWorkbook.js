import ExcelJS from 'exceljs'

import { httpError } from '../http.js'

const IMPORT_HEADERS = ['Full name', 'User ID', 'Role', 'Campus', 'Major', 'Status']

const EXPORT_HEADERS = [
  'Full name',
  'Email',
  'User ID',
  'Role',
  'Campus',
  'Major',
  'Profile status',
  'Password status',
  'Temporary password available',
]

const CREDENTIAL_HEADER = 'Temporary password'

const validCampuses = new Set(['hanoi', 'danang', 'hcm'])

const campusLabels = {
  hanoi: 'Hanoi',
  danang: 'Da Nang',
  hcm: 'HCM',
}

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

const normalizeCampus = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (normalized === 'da_nang') {
    return 'danang'
  }

  if (normalized === 'ho_chi_minh' || normalized === 'hcmc') {
    return 'hcm'
  }

  return validCampuses.has(normalized) ? normalized : 'hanoi'
}

const readCellText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String(value.text ?? '').trim()
  }

  return String(value).trim()
}

export const buildMajorTitleMaps = (mainMajors, childMajors) => ({
  mainByTitle: new Map(mainMajors.map((major) => [major.title.trim().toLowerCase(), major.id])),
  childByTitle: new Map(childMajors.map((major) => [major.title.trim().toLowerCase(), major.id])),
})

const resolveMajorIds = (role, majorTitle, majorMaps) => {
  const normalizedTitle = majorTitle.trim().toLowerCase()

  if (!normalizedTitle) {
    return {
      mainMajorId: null,
      childMajorId: null,
    }
  }

  if (role === 'teacher') {
    const mainMajorId = majorMaps.mainByTitle.get(normalizedTitle)

    if (!mainMajorId) {
      throw new Error(`Unknown major "${majorTitle}".`)
    }

    return {
      mainMajorId,
      childMajorId: null,
    }
  }

  const childMajorId = majorMaps.childByTitle.get(normalizedTitle)

  if (!childMajorId) {
    throw new Error(`Unknown major "${majorTitle}".`)
  }

  return {
    mainMajorId: null,
    childMajorId,
  }
}

const readHeaderIndexes = (headerRow) => {
  const headerMap = new Map()

  headerRow.eachCell((cell, columnNumber) => {
    headerMap.set(normalizeHeader(readCellText(cell.value)), columnNumber)
  })

  const valueFor = (row, names) => {
    for (const name of names) {
      const columnNumber = headerMap.get(name)

      if (columnNumber !== undefined) {
        return readCellText(row.getCell(columnNumber).value)
      }
    }

    return ''
  }

  return valueFor
}

export const parseWorkbookRow = (row, rowNumber, valueFor, majorMaps) => {
  const fullName = valueFor(row, ['full_name', 'name'])
  const userId = valueFor(row, ['user_id', 'userid', 'student_id', 'studentid', 'student_number'])
  const roleValue = valueFor(row, ['role']).toLowerCase()
  const role = roleValue === 'teacher' ? 'teacher' : 'student'
  const campus = normalizeCampus(valueFor(row, ['campus']))
  const majorTitle = valueFor(row, ['major', 'main_major', 'child_major', 'main_major_id', 'child_major_id'])

  if (!fullName) {
    throw new Error('Full name is required.')
  }

  if (!userId) {
    throw new Error('User ID is required.')
  }

  const { mainMajorId, childMajorId } = resolveMajorIds(role, majorTitle, majorMaps)

  return {
    row: rowNumber,
    input: {
      full_name: fullName,
      user_id: userId,
      role,
      campus,
      main_major_id: mainMajorId,
      child_major_id: childMajorId,
    },
  }
}

export async function readImportRowsFromWorkbook(buffer, catalog) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw httpError(400, 'Workbook must include at least one worksheet.')
  }

  const headerRow = worksheet.getRow(1)
  const valueFor = readHeaderIndexes(headerRow)
  const majorMaps = buildMajorTitleMaps(catalog.mainMajors, catalog.childMajors)
  const rows = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return
    }

    if (row.values.slice(1).every((value) => readCellText(value) === '')) {
      return
    }

    try {
      rows.push(parseWorkbookRow(row, rowNumber, valueFor, majorMaps))
    } catch (error) {
      rows.push({
        row: rowNumber,
        error: error instanceof Error ? error.message : 'User row could not be parsed.',
      })
    }
  })

  if (rows.length === 0) {
    throw httpError(400, 'Workbook must include at least one user row.')
  }

  return rows
}

const addHeaderRow = (worksheet, headers) => {
  const headerRow = worksheet.addRow(headers)
  headerRow.font = { bold: true }
}

export async function buildImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Users')
  addHeaderRow(worksheet, IMPORT_HEADERS)
  worksheet.addRow(['Example Student', 'SWD00015', 'student', 'Hanoi', 'Software Development', 'active'])
  worksheet.columns = IMPORT_HEADERS.map((header) => ({ header, width: Math.max(header.length + 2, 16) }))

  return workbook.xlsx.writeBuffer()
}

const majorTitleForUser = (user, catalog) => {
  if (user.role === 'teacher' && user.mainMajorId) {
    return catalog.mainMajors.find((major) => major.id === user.mainMajorId)?.title ?? ''
  }

  if (user.role === 'student' && user.childMajorId) {
    return catalog.childMajors.find((major) => major.id === user.childMajorId)?.title ?? ''
  }

  return ''
}

export async function buildUsersExportWorkbook(users, credentialsByUserId, catalog, options = {}) {
  const includeCredentials = options.includeCredentials === true
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Users')
  const headers = includeCredentials ? [...EXPORT_HEADERS, CREDENTIAL_HEADER] : EXPORT_HEADERS

  addHeaderRow(worksheet, headers)

  for (const user of users) {
    const credential = credentialsByUserId.get(user.id)
    const row = [
      user.fullName ?? user.displayName ?? '',
      user.email ?? '',
      user.studentId ?? '',
      user.role,
      user.campus ? campusLabels[user.campus] ?? user.campus : '',
      majorTitleForUser(user, catalog),
      user.status,
      user.mustChangePassword ? 'Must change' : 'Set',
      credential ? 'Yes' : 'No',
    ]

    if (includeCredentials) {
      row.push(credential?.tempPassword ?? '')
    }

    worksheet.addRow(row)
  }

  worksheet.columns = headers.map((header) => ({ header, width: Math.max(header.length + 2, 16) }))

  return workbook.xlsx.writeBuffer()
}
