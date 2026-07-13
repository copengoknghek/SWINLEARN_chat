import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import test from 'node:test'

import {
  buildImportTemplateWorkbook,
  buildMajorTitleMaps,
  buildUsersExportWorkbook,
  parseWorkbookRow,
  readImportRowsFromWorkbook,
} from './adminUserWorkbook.js'

const catalog = {
  mainMajors: [
    { id: 'cs', title: 'Computer Science' },
    { id: 'business', title: 'Business' },
  ],
  childMajors: [
    { id: 'software-development', title: 'Software Development', main_major_id: 'cs' },
    { id: 'ai', title: 'Artificial Intelligence', main_major_id: 'cs' },
  ],
}

const majorMaps = buildMajorTitleMaps(catalog.mainMajors, catalog.childMajors)

const buildWorkbookBuffer = async (rows) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Users')

  for (const row of rows) {
    worksheet.addRow(row)
  }

  return workbook.xlsx.writeBuffer()
}

const readWorkbookRows = async (buffer) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  const rows = []

  worksheet.eachRow((row) => {
    rows.push(row.values.slice(1).map((value) => String(value ?? '').trim()))
  })

  return rows
}

test('parseWorkbookRow maps readable major titles from workbook rows', () => {
  const studentRow = {
    getCell: (columnNumber) => ({
      value:
        [
          'Example Student',
          'SWD00015',
          'student',
          'Hanoi',
          'Software Development',
          '',
        ][columnNumber - 1] ?? '',
    }),
  }
  const teacherRow = {
    getCell: (columnNumber) => ({
      value:
        [
          'Example Teacher',
          'SWT00010',
          'teacher',
          'Da Nang',
          'Computer Science',
          'inactive',
        ][columnNumber - 1] ?? '',
    }),
  }
  const valueFor = (row, names) => {
    const headerIndexes = {
      full_name: 1,
      user_id: 2,
      role: 3,
      campus: 4,
      major: 5,
      status: 6,
    }

    for (const name of names) {
      const index = headerIndexes[name]

      if (index !== undefined) {
        return String(row.getCell(index).value ?? '').trim()
      }
    }

    return ''
  }

  const student = parseWorkbookRow(studentRow, 2, valueFor, majorMaps)
  const teacher = parseWorkbookRow(teacherRow, 3, valueFor, majorMaps)

  assert.equal(student.input.child_major_id, 'software-development')
  assert.equal(teacher.input.main_major_id, 'cs')
})

test('parseWorkbookRow rejects missing full name, user ID, and unknown majors', () => {
  const valueFor = (row, names) => {
    const headerIndexes = {
      full_name: 1,
      user_id: 2,
      role: 3,
      campus: 4,
      major: 5,
      status: 6,
    }

    for (const name of names) {
      const index = headerIndexes[name]

      if (index !== undefined) {
        return String(row.getCell(index).value ?? '').trim()
      }
    }

    return ''
  }
  const row = {
    getCell: (columnNumber) => ({
      value: ['', 'SWD00015', 'student', 'Hanoi', 'Unknown Major', 'active'][columnNumber - 1] ?? '',
    }),
  }

  assert.throws(() => parseWorkbookRow(row, 2, valueFor, majorMaps), /Full name is required/)
  row.getCell = (columnNumber) => ({
    value: ['Example Student', '', 'student', 'Hanoi', 'Software Development', 'active'][columnNumber - 1] ?? '',
  })
  assert.throws(() => parseWorkbookRow(row, 2, valueFor, majorMaps), /User ID is required/)
  row.getCell = (columnNumber) => ({
    value: ['Example Student', 'SWD00015', 'student', 'Hanoi', 'Unknown Major', 'active'][columnNumber - 1] ?? '',
  })
  assert.throws(() => parseWorkbookRow(row, 2, valueFor, majorMaps), /Unknown major/)
})

test('readImportRowsFromWorkbook returns row-level parse errors without failing the workbook', async () => {
  const buffer = await buildWorkbookBuffer([
    ['Full name', 'User ID', 'Role', 'Campus', 'Major', 'Status'],
    ['Valid Student', 'SWD00020', 'student', 'Hanoi', 'Software Development', 'active'],
    ['', 'SWD00021', 'student', 'Hanoi', 'Software Development', 'active'],
  ])
  const rows = await readImportRowsFromWorkbook(buffer, catalog)

  assert.equal(rows.length, 2)
  assert.equal(rows[0].input.full_name, 'Valid Student')
  assert.match(rows[1].error, /Full name is required/)
})

test('buildUsersExportWorkbook includes every provided user and hides credentials by default', async () => {
  const users = [
    {
      id: 'user-1',
      fullName: 'Pending Student',
      displayName: 'Pending Student',
      email: 'swd00015@student.swin.edu.au',
      studentId: 'SWD00015',
      role: 'student',
      campus: 'hanoi',
      childMajorId: 'software-development',
      mainMajorId: null,
      status: 'inactive',
      mustChangePassword: true,
    },
    {
      id: 'user-2',
      fullName: 'Ready Student',
      displayName: 'Ready Student',
      email: 'swd00016@student.swin.edu.au',
      studentId: 'SWD00016',
      role: 'student',
      campus: 'hanoi',
      childMajorId: 'software-development',
      mainMajorId: null,
      status: 'active',
      mustChangePassword: false,
    },
  ]
  const credentialsByUserId = new Map([
    [
      'user-1',
      {
        userId: 'user-1',
        tempPassword: 'TempPass123!',
      },
    ],
  ])
  const buffer = await buildUsersExportWorkbook(users, credentialsByUserId, catalog, {
    includeCredentials: false,
  })
  const rows = await readWorkbookRows(buffer)

  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0].slice(0, 3), [
    'Full name',
    'Email',
    'User ID',
  ])
  assert.equal(rows[1][0], 'Pending Student')
  assert.equal(rows[2][0], 'Ready Student')
  assert.equal(rows[1][8], 'Yes')
  assert.equal(rows[2][8], 'No')
  assert.equal(rows[1].length, 9)
  assert.doesNotMatch(rows[1].join('|'), /TempPass123!/)
})

test('buildUsersExportWorkbook includes managed temporary passwords only in credential export', async () => {
  const users = [
    {
      id: 'user-1',
      fullName: 'Pending Student',
      displayName: 'Pending Student',
      email: 'swd00015@student.swin.edu.au',
      studentId: 'SWD00015',
      role: 'student',
      campus: 'hanoi',
      childMajorId: 'software-development',
      mainMajorId: null,
      status: 'inactive',
      mustChangePassword: true,
    },
    {
      id: 'user-2',
      fullName: 'Pending Without Credential',
      displayName: 'Pending Without Credential',
      email: 'swd00017@student.swin.edu.au',
      studentId: 'SWD00017',
      role: 'student',
      campus: 'hanoi',
      childMajorId: 'software-development',
      mainMajorId: null,
      status: 'inactive',
      mustChangePassword: true,
    },
  ]
  const credentialsByUserId = new Map([
    [
      'user-1',
      {
        userId: 'user-1',
        tempPassword: 'TempPass123!',
      },
    ],
  ])
  const buffer = await buildUsersExportWorkbook(users, credentialsByUserId, catalog, {
    includeCredentials: true,
  })
  const rows = await readWorkbookRows(buffer)

  assert.equal(rows[0].at(-1), 'Temporary password')
  assert.equal(rows[1].at(-1), 'TempPass123!')
  assert.equal(rows[2].at(-1), '')
})

test('buildImportTemplateWorkbook includes the expected import columns', async () => {
  const buffer = await buildImportTemplateWorkbook()
  const rows = await readWorkbookRows(buffer)

  assert.deepEqual(rows[0], [
    'Full name',
    'User ID',
    'Role',
    'Campus',
    'Major',
    'Status',
  ])
})
