import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminUsersPage = readFileSync(new URL('./AdminUsersPage.tsx', import.meta.url), 'utf8')
const workspaceCss = readFileSync(new URL('../../styles/WorkspacePages.css', import.meta.url), 'utf8')

test('admin user list exposes search first followed by compact role and campus dropdown filters', () => {
  assert.match(adminUsersPage, /const \[userSearchQuery, setUserSearchQuery\] = useState\(''\)/)
  assert.match(adminUsersPage, /className="admin-users-filter-toolbar"/)
  assert.match(adminUsersPage, /className="admin-users-search"/)
  assert.match(adminUsersPage, /type="search"/)
  assert.match(adminUsersPage, /placeholder="Search name or ID"/)
  assert.match(adminUsersPage, /value=\{userSearchQuery\}/)
  assert.match(adminUsersPage, /setUserSearchQuery\(event\.target\.value\)/)
  assert.match(
    adminUsersPage,
    /<label className="admin-users-search">[\s\S]*?<details className="admin-users-filter-dropdown"/,
  )
  assert.match(adminUsersPage, /<summary className="admin-users-filter-summary">/)
  assert.match(adminUsersPage, /\{roleFilter === 'all' \? 'All roles' : roleFilter\}/)
  assert.match(
    adminUsersPage,
    /\{campusFilter === 'all' \? 'All campuses' : campusLabels\[campusFilter\]\}/,
  )
  assert.match(adminUsersPage, /className="admin-users-filter-menu"/)
  assert.match(adminUsersPage, /\{role === 'all' \? 'All roles' : role\}/)
  assert.match(adminUsersPage, /\{campus === 'all' \? 'All campuses' : campusLabels\[campus\]\}/)
})

test('admin user search matches visible names and profile identifiers', () => {
  assert.match(adminUsersPage, /const normalizedUserSearchQuery = userSearchQuery\.trim\(\)\.toLowerCase\(\)/)
  assert.match(adminUsersPage, /profileName\(profile\)/)
  assert.match(adminUsersPage, /profile\.full_name/)
  assert.match(adminUsersPage, /profile\.display_name/)
  assert.match(adminUsersPage, /profile\.email/)
  assert.match(adminUsersPage, /profile\.id/)
  assert.match(adminUsersPage, /profile\.student_id/)
  assert.match(adminUsersPage, /searchableProfileText\.includes\(normalizedUserSearchQuery\)/)
  assert.match(adminUsersPage, /return roleMatches && campusMatches && statusMatches && searchMatches/)
})

test('admin user status filter matches password-update state via profile status', () => {
  assert.match(adminUsersPage, /const \[statusFilter, setStatusFilter\] = useState<'all' \| 'active' \| 'inactive'>\('all'\)/)
  assert.match(adminUsersPage, /aria-label="Status filter"/)
  assert.match(adminUsersPage, /statusFilterLabels/)
  assert.match(adminUsersPage, /All statuses/)
  assert.match(adminUsersPage, /Not active/)
  assert.match(adminUsersPage, /profile\.status === 'active'/)
  assert.match(adminUsersPage, /profile\.status === 'inactive'/)
  assert.match(adminUsersPage, /profile\.status === 'active' \? 'Active' : 'Inactive'/)
  assert.match(adminUsersPage, /admin-users-readonly-status/)
  assert.doesNotMatch(adminUsersPage, /editForm\.status[\s\S]*?<option value="active">Active<\/option>/)
})

test('admin user role count cards use compact admin-only sizing', () => {
  const statsGridRule = workspaceCss.match(/\.admin-users-stats-grid\s*\{[^}]*\}/)
  const statsCardRule = workspaceCss.match(/\.admin-users-stats-card\s*\{[^}]*\}/)

  assert.match(adminUsersPage, /className="workspace-grid workspace-grid--three admin-users-stats-grid"/)
  assert.match(adminUsersPage, /className="workspace-card admin-users-stats-card"/)

  assert.ok(statsGridRule, 'admin user stats grid rule should exist')
  assert.match(statsGridRule[0], /gap:\s*5px/)

  assert.ok(statsCardRule, 'admin user stats card rule should exist')
  assert.match(statsCardRule[0], /gap:\s*8px/)
  assert.match(statsCardRule[0], /padding:\s*8px 12px/)
  assert.match(statsCardRule[0], /border-radius:\s*999px/)
})

test('admin user filter toolbar styles search first with compact dropdown controls', () => {
  const toolbarRule = workspaceCss.match(/\.admin-users-filter-toolbar\s*\{[^}]*\}/)
  const searchRule = workspaceCss.match(/\.admin-users-search\s*\{[^}]*\}/)
  const searchInputRule = workspaceCss.match(/\.admin-users-search input\s*\{[^}]*\}/)
  const searchFocusRule = workspaceCss.match(
    /\.admin-users-search input:focus\s*\{[^}]*\}/,
  )
  const dropdownRule = workspaceCss.match(/\.admin-users-filter-dropdown\s*\{[^}]*\}/)
  const summaryRule = workspaceCss.match(/\.admin-users-filter-summary\s*\{[^}]*\}/)
  const menuRule = workspaceCss.match(/\.admin-users-filter-menu\s*\{[^}]*\}/)
  const menuButtonRule = workspaceCss.match(/\.admin-users-filter-menu \.workspace-tab\s*\{[^}]*\}/)

  assert.ok(toolbarRule, 'admin user filter toolbar rule should exist')
  assert.match(toolbarRule[0], /display:\s*grid/)
  assert.match(
    toolbarRule[0],
    /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(96px, 132px\) minmax\(108px, 148px\) minmax\(108px, 148px\)/,
  )
  assert.doesNotMatch(toolbarRule[0], /max-content/)

  assert.ok(searchRule, 'admin user search wrapper rule should exist')
  assert.match(searchRule[0], /display:\s*grid/)

  assert.ok(searchInputRule, 'admin user search input rule should exist')
  assert.match(searchInputRule[0], /border:\s*1px solid var\(--border\)/)
  assert.match(searchInputRule[0], /height:\s*40px/)

  assert.ok(searchFocusRule, 'admin user search focus rule should exist')
  assert.match(searchFocusRule[0], /border-color:\s*var\(--accent\)/)

  assert.ok(dropdownRule, 'admin user dropdown rule should exist')
  assert.match(dropdownRule[0], /min-width:\s*0/)
  assert.match(dropdownRule[0], /position:\s*relative/)

  assert.ok(summaryRule, 'admin user dropdown summary rule should exist')
  assert.match(summaryRule[0], /height:\s*40px/)
  assert.match(summaryRule[0], /width:\s*100%/)

  assert.ok(menuRule, 'admin user dropdown menu rule should exist')
  assert.match(menuRule[0], /position:\s*absolute/)
  assert.match(menuRule[0], /right:\s*0/)
  assert.match(menuRule[0], /z-index:\s*15/)

  assert.ok(menuButtonRule, 'admin user dropdown option buttons should be compact')
  assert.match(menuButtonRule[0], /padding:\s*8px 10px/)
})

test('admin user rows align role, campus, and status in explicit columns', () => {
  const tableRule = workspaceCss.match(/\.admin-users-table\s*\{[^}]*\}/)
  const headerAndRowRule = workspaceCss.match(
    /\.admin-users-table-header,\s*\.admin-users-row\s*\{[^}]*\}/,
  )
  const headerRule = workspaceCss.match(/\.admin-users-table-header\s*\{[^}]*\}/)
  const columnRule = workspaceCss.match(/\.admin-users-column\s*\{[^}]*\}/)
  const statusRule = workspaceCss.match(/\.admin-users-column--status\s*\{[^}]*\}/)

  assert.match(adminUsersPage, /className="workspace-panel admin-users-list-panel"/)
  assert.match(adminUsersPage, /className="admin-users-table-scroll"/)
  assert.match(adminUsersPage, /className="workspace-table admin-users-table"/)
  assert.match(adminUsersPage, /className="admin-users-table-header"/)
  assert.match(adminUsersPage, /<span>User<\/span>/)
  assert.match(adminUsersPage, /<span>User ID<\/span>/)
  assert.match(adminUsersPage, /<span>Role<\/span>/)
  assert.match(adminUsersPage, /<span>Campus<\/span>/)
  assert.match(adminUsersPage, /<span>Status<\/span>/)
  assert.match(adminUsersPage, /admin-users-row/)
  assert.match(adminUsersPage, /className="admin-users-user"/)
  assert.match(adminUsersPage, /className="admin-users-column admin-users-column--userid"/)
  assert.match(adminUsersPage, /className="admin-users-column admin-users-column--role"/)
  assert.match(adminUsersPage, /className="admin-users-column admin-users-column--campus"/)
  assert.match(adminUsersPage, /className="admin-users-column admin-users-column--status"/)

  assert.ok(tableRule, 'admin users table grid variable should exist')
  assert.match(tableRule[0], /grid-template-columns:\s*var\(--admin-users-grid\)/)

  assert.ok(headerAndRowRule, 'admin users header and rows should share columns')
  assert.match(headerAndRowRule[0], /grid-template-columns:\s*subgrid/)

  assert.ok(headerRule, 'admin users table header rule should exist')
  assert.match(headerRule[0], /text-transform:\s*uppercase/)

  assert.ok(columnRule, 'admin users column rule should exist')
  assert.match(columnRule[0], /min-width:\s*0/)

  assert.ok(statusRule, 'admin users status column rule should exist')
  assert.match(statusRule[0], /white-space:\s*nowrap/)
})

test('admin users page uses Excel import and export controls', () => {
  assert.match(adminUsersPage, /<h2>Excel import<\/h2>/)
  assert.match(adminUsersPage, /Download template/)
  assert.match(adminUsersPage, /downloadAdminUserImportTemplate/)
  assert.match(adminUsersPage, /handleDownloadTemplate/)
  assert.match(adminUsersPage, /importAdminUsersWorkbook/)
  assert.match(
    adminUsersPage,
    /accept="\.xlsx,application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/,
  )
  assert.match(adminUsersPage, /<h2>Excel import results<\/h2>/)
  assert.match(adminUsersPage, /Export pending password users/)
  assert.match(adminUsersPage, /Export pending credentials/)
  assert.match(adminUsersPage, /downloadUsersExport/)
  assert.match(adminUsersPage, /handleExportUsers\(false\)/)
  assert.match(adminUsersPage, /handleExportUsers\(true\)/)
  assert.match(adminUsersPage, /filteredProfiles\.map\(\(profile\) => profile\.id\)/)
  assert.match(adminUsersPage, /Download the users currently shown by your filters/)
  assert.match(adminUsersPage, /admin-users-export-actions/)
})
