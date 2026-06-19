import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(
  new URL('./WorkspacePages.css', import.meta.url),
  'utf8',
)
const courseDetailPage = readFileSync(
  new URL('../pages/shared/CourseDetailPage.tsx', import.meta.url),
  'utf8',
)

test('course detail modules layout uses separate scroll panes for module list and content', () => {
  const modulesLayoutRule = css.match(/\.course-detail-layout--modules\s*\{[^}]*\}/)
  const modulesPaneRule = css.match(
    /\.course-detail-layout--modules \.course-detail-nav,\s*\.course-detail-layout--modules \.course-detail-main\s*\{[^}]*\}/,
  )

  assert.ok(modulesLayoutRule, 'modules layout rule should exist')
  assert.match(modulesLayoutRule[0], /align-items:\s*stretch/)
  assert.match(
    modulesLayoutRule[0],
    /grid-template-columns:\s*minmax\(190px, 240px\) minmax\(0, 1fr\)/,
  )
  assert.match(modulesLayoutRule[0], /height:\s*calc\(100vh - [^)]+\)/)

  assert.ok(modulesPaneRule, 'modules scroll pane rule should exist')
  assert.match(modulesPaneRule[0], /max-height:\s*100%/)
  assert.match(modulesPaneRule[0], /overflow-y:\s*auto/)
  assert.match(modulesPaneRule[0], /overscroll-behavior:\s*contain/)
})

test('course detail modules sidebar is compact so content has more room', () => {
  const modulesNavRule = css.match(/\.course-detail-layout--modules \.course-detail-nav\s*\{[^}]*\}/)
  const moduleListRule = css.match(
    /\.course-detail-layout--modules \.course-detail-module-list\s*\{[^}]*\}/,
  )
  const moduleHeadingRule = css.match(
    /\.course-detail-layout--modules \.course-detail-module-list h3\s*\{[^}]*\}/,
  )
  const moduleItemRule = css.match(
    /\.course-detail-layout--modules \.course-detail-item\s*\{[^}]*\}/,
  )

  assert.ok(modulesNavRule, 'compact modules nav rule should exist')
  assert.match(modulesNavRule[0], /padding:\s*16px/)

  assert.ok(moduleListRule, 'compact module list rule should exist')
  assert.match(moduleListRule[0], /gap:\s*14px/)

  assert.ok(moduleHeadingRule, 'compact module heading rule should exist')
  assert.match(moduleHeadingRule[0], /font-size:\s*0\.9rem/)
  assert.match(moduleHeadingRule[0], /margin-bottom:\s*8px/)

  assert.ok(moduleItemRule, 'compact module item rule should exist')
  assert.match(moduleItemRule[0], /padding:\s*8px 9px/)
})

test('course detail back button is compact black and includes a leading angle mark', () => {
  const backButtonRule = css.match(/\.course-detail-back\s*\{[^}]*\}/)
  const backButtonHoverRule = css.match(
    /\.course-detail-back:hover,\s*\.course-detail-back:focus-visible\s*\{[^}]*\}/,
  )

  assert.match(courseDetailPage, /&lt;\s*Back to courses/)

  assert.ok(backButtonRule, 'course detail back button rule should exist')
  assert.match(backButtonRule[0], /background:\s*#111111/)
  assert.match(backButtonRule[0], /border-color:\s*#111111/)
  assert.match(backButtonRule[0], /color:\s*#ffffff/)
  assert.match(backButtonRule[0], /font-size:\s*0\.82rem/)
  assert.match(backButtonRule[0], /padding:\s*7px 10px/)

  assert.ok(backButtonHoverRule, 'course detail back button hover rule should exist')
  assert.match(backButtonHoverRule[0], /background:\s*#000000/)
  assert.match(backButtonHoverRule[0], /color:\s*#ffffff/)
})

test('course detail modules page includes a fixed scroll-to-top button', () => {
  const scrollTopRule = css.match(/\.course-detail-scroll-top\s*\{[^}]*\}/)
  const scrollTopHoverRule = css.match(
    /\.course-detail-scroll-top:hover,\s*\.course-detail-scroll-top:focus-visible\s*\{[^}]*\}/,
  )

  assert.match(courseDetailPage, /const coursePageRef = useRef<HTMLElement \| null>\(null\)/)
  assert.match(
    courseDetailPage,
    /const scrollModulesToTop = \(\) => \{\s*scrollCourseContentIntoView\(coursePageRef\.current\)\s*\}/,
  )
  assert.doesNotMatch(
    courseDetailPage,
    /const scrollModulesToTop = \(\) => \{\s*scrollCourseContentIntoView\(moduleContentRef\.current\)\s*\}/,
  )
  assert.match(
    courseDetailPage,
    /<section className="workspace-page course-detail-page" ref=\{coursePageRef\}>/,
  )
  assert.match(courseDetailPage, /className="course-detail-scroll-top"/)
  assert.match(courseDetailPage, /aria-label="Scroll course page to top"/)
  assert.match(courseDetailPage, /onClick=\{scrollModulesToTop\}/)
  assert.match(courseDetailPage, /&uarr;/)

  assert.ok(scrollTopRule, 'modules scroll-to-top button rule should exist')
  assert.match(scrollTopRule[0], /align-items:\s*center/)
  assert.match(scrollTopRule[0], /bottom:\s*28px/)
  assert.match(scrollTopRule[0], /position:\s*fixed/)
  assert.match(scrollTopRule[0], /right:\s*28px/)
  assert.match(scrollTopRule[0], /z-index:\s*20/)

  assert.ok(scrollTopHoverRule, 'modules scroll-to-top button hover rule should exist')
  assert.match(scrollTopHoverRule[0], /background:\s*#000000/)
})
