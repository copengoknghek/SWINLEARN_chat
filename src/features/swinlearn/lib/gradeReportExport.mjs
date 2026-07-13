/** @param {string} [prefix] */
export const gradeReportFilename = (prefix = 'swinlearn-grades') =>
  `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`

/** @param {string} [path] @param {string} [prefix] */
export const downloadGradeReportXlsx = async (
  path = '/api/workspace/academic-progress/export',
  prefix,
) => {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    let message = 'Grade report could not be exported.'

    try {
      const data = JSON.parse(text)
      if (data?.error) {
        message = String(data.error)
      }
    } catch {
      if (text) {
        message = text
      }
    }

    throw new Error(message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = gradeReportFilename(prefix)
  anchor.click()
  URL.revokeObjectURL(url)
}
