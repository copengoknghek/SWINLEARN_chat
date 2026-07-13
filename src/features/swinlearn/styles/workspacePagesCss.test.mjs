import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(
  new URL('./WorkspacePages.css', import.meta.url),
  'utf8',
)
const globalCss = readFileSync(
  new URL('../../../styles/global.css', import.meta.url),
  'utf8',
)
const courseDetailPage = readFileSync(
  new URL('../pages/shared/CourseDetailPage.tsx', import.meta.url),
  'utf8',
)
const communityConfirmDialog = readFileSync(
  new URL('../components/CommunityConfirmDialog.tsx', import.meta.url),
  'utf8',
)
const adminCoursesCss = readFileSync(
  new URL('../pages/admin/AdminCoursesPage.css', import.meta.url),
  'utf8',
)
const adminCoursesPage = readFileSync(
  new URL('../pages/admin/AdminCoursesPage.tsx', import.meta.url),
  'utf8',
)
const inboxPage = readFileSync(
  new URL('../pages/shared/InboxPage.tsx', import.meta.url),
  'utf8',
)
const workspaceLayout = readFileSync(
  new URL('../layouts/WorkspaceLayout/WorkspaceLayout.tsx', import.meta.url),
  'utf8',
)
const workspaceLayoutCss = readFileSync(
  new URL('../layouts/WorkspaceLayout/WorkspaceLayout.css', import.meta.url),
  'utf8',
)

test('default workspace pages use the full workspace content width', () => {
  const workspacePageRule = css.match(/\.workspace-page\s*\{[^}]*\}/)

  assert.ok(workspacePageRule, 'workspace page base rule should exist')
  assert.match(workspacePageRule[0], /max-width:\s*none/)
  assert.match(workspacePageRule[0], /width:\s*100%/)
})

test('admin course management page uses the full workspace content width', () => {
  const adminCoursesPageRule = adminCoursesCss.match(/\.admin-courses-page\.workspace-page\s*\{[^}]*\}/)

  assert.match(adminCoursesPage, /<section className="workspace-page admin-courses-page">/)

  assert.ok(adminCoursesPageRule, 'admin courses page width override should exist')
  assert.match(adminCoursesPageRule[0], /max-width:\s*none/)
  assert.match(adminCoursesPageRule[0], /width:\s*100%/)
})

test('workspace navbar uses the SWINLEARN logo image as the SWINLEARN nav icon', () => {
  const stackedIconRule = workspaceLayoutCss.match(
    /\.workspace-nav-link--stacked \.workspace-nav-icon\s*\{[^}]*\}/,
  )
  const imageIconRule = workspaceLayoutCss.match(/\.workspace-nav-icon--image\s*\{[^}]*\}/)

  assert.match(workspaceLayout, /swinlearn:\s*\{[^}]*src:\s*'\/logoSwinlearn\.png'/s)
  assert.match(workspaceLayout, /className="workspace-nav-icon workspace-nav-icon--image"/)

  assert.ok(stackedIconRule, 'stacked workspace nav icon rule should exist')
  assert.match(stackedIconRule[0], /height:\s*1\.45rem/)
  assert.match(stackedIconRule[0], /width:\s*1\.45rem/)

  assert.ok(imageIconRule, 'workspace nav image icon rule should exist')
  assert.match(imageIconRule[0], /object-fit:\s*contain/)
  assert.doesNotMatch(imageIconRule[0], /filter:/)
  assert.doesNotMatch(imageIconRule[0], /fill:/)
})

test('workspace navbar gives the active SWINLEARN link a white elevated style', () => {
  const activeRule = workspaceLayoutCss.match(
    /\.workspace-nav-link--swinlearn\.workspace-nav-link--active\s*\{[^}]*\}/,
  )
  const activeHoverRule = workspaceLayoutCss.match(
    /\.workspace-nav-link--swinlearn\.workspace-nav-link--active:hover,\s*\.workspace-nav-link--swinlearn\.workspace-nav-link--active:focus-visible\s*\{[^}]*\}/,
  )

  assert.match(workspaceLayout, /link\.path === 'swinlearn'/)
  assert.match(workspaceLayout, /workspace-nav-link--swinlearn/)

  assert.ok(activeRule, 'active SWINLEARN nav link rule should exist')
  assert.match(activeRule[0], /background:\s*#ffffff/)
  assert.match(activeRule[0], /color:\s*#111111/)
  assert.match(activeRule[0], /box-shadow:/)
  assert.match(activeRule[0], /rgb\(168 0 0 \//)
  assert.match(activeRule[0], /transform:\s*translateY\(-1px\)/)

  assert.ok(activeHoverRule, 'active SWINLEARN hover rule should exist')
  assert.match(activeHoverRule[0], /background:\s*#ffffff/)
  assert.match(activeHoverRule[0], /color:\s*#111111/)
  assert.match(activeHoverRule[0], /box-shadow:/)
  assert.match(activeHoverRule[0], /rgb\(168 0 0 \//)
})

test('workspace navbar releases floating hearts when the SWINLEARN link is clicked', () => {
  const heartBurstRule = workspaceLayoutCss.match(/\.workspace-nav-heart-burst\s*\{[^}]*\}/)
  const heartRule = workspaceLayoutCss.match(/\.workspace-nav-heart\s*\{[^}]*\}/)
  const heartKeyframes = workspaceLayoutCss.match(/@keyframes swinlearnHeartFly\s*\{[\s\S]*?translate\(calc\(-50% \+ var\(--heart-end-x\)\), -48px\)[\s\S]*?\}/)
  const reducedMotionRule = workspaceLayoutCss.match(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.workspace-nav-heart\s*\{[^}]*\}/,
  )

  assert.match(workspaceLayout, /const \[swinlearnHeartBursts, setSwinlearnHeartBursts\] = useState<WorkspaceHeartBurst\[\]>\(\[\]\)/)
  assert.match(workspaceLayout, /const handleSwinlearnLinkClick = \(\) => \{/)
  assert.match(workspaceLayout, /onClick=\{isSwinlearnLink \? handleSwinlearnLinkClick : undefined\}/)
  assert.match(workspaceLayout, /className="workspace-nav-heart-burst"/)
  assert.match(workspaceLayout, /className="workspace-nav-heart"/)
  assert.match(workspaceLayout, /&hearts;/)
  assert.match(workspaceLayout, /window\.setTimeout\(\(\) => \{/)

  assert.ok(heartBurstRule, 'heart burst container rule should exist')
  assert.match(heartBurstRule[0], /pointer-events:\s*none/)
  assert.match(heartBurstRule[0], /position:\s*absolute/)

  assert.ok(heartRule, 'floating heart rule should exist')
  assert.match(heartRule[0], /animation:\s*swinlearnHeartFly 1\.1s ease-out var\(--heart-delay\) forwards/)
  assert.match(heartRule[0], /color:\s*var\(--accent\)/)

  assert.ok(heartKeyframes, 'floating heart keyframes should move upward')
  assert.ok(reducedMotionRule, 'floating hearts should respect reduced motion')
  assert.match(reducedMotionRule[0], /display:\s*none/)
})

test('course detail modules layout uses separate scroll panes for module list and content', () => {
  const modulesLayoutRule = css.match(/\.course-detail-layout--modules\s*\{[^}]*\}/)
  const modulesPaneRule = css.match(
    /\.course-detail-layout--modules \.course-detail-nav,\s*\.course-detail-layout--modules \.course-detail-main\s*\{[^}]*\}/,
  )

  assert.ok(modulesLayoutRule, 'modules layout rule should exist')
  assert.match(modulesLayoutRule[0], /align-items:\s*stretch/)
  assert.match(
    modulesLayoutRule[0],
    /grid-template-columns:\s*minmax\(250px, 320px\) minmax\(0, 1fr\)/,
  )
  assert.match(modulesLayoutRule[0], /height:\s*calc\(100vh - [^)]+\)/)

  assert.ok(modulesPaneRule, 'modules scroll pane rule should exist')
  assert.match(modulesPaneRule[0], /max-height:\s*100%/)
  assert.match(modulesPaneRule[0], /overflow-y:\s*auto/)
  assert.match(modulesPaneRule[0], /overscroll-behavior:\s*contain/)
})

test('course detail modules sidebar can collapse inside its own panel', () => {
  const collapsedLayoutRule = css.match(/\.course-detail-layout--modules-collapsed\s*\{[^}]*\}/)
  const collapsedNavRule = css.match(/\.course-detail-nav--collapsed\s*\{[^}]*\}/)
  const moduleHeaderRule = css.match(/\.course-detail-module-header\s*\{[^}]*\}/)
  const toggleRule = css.match(/\.course-detail-module-toggle\s*\{[^}]*\}/)
  const toggleHoverRule = css.match(
    /\.course-detail-module-toggle:hover,\s*\.course-detail-module-toggle:focus-visible\s*\{[^}]*\}/,
  )

  assert.match(courseDetailPage, /const \[modulesCollapsed, setModulesCollapsed\] = useState\(false\)/)
  assert.match(courseDetailPage, /course-detail-layout--modules-collapsed/)
  assert.match(courseDetailPage, /course-detail-nav--collapsed/)
  assert.match(courseDetailPage, /course-detail-module-header/)
  assert.match(courseDetailPage, /id="course-detail-modules-panel"/)
  assert.match(courseDetailPage, /aria-controls="course-detail-modules-panel"/)
  assert.match(courseDetailPage, /aria-expanded=\{!modulesCollapsed\}/)
  assert.match(courseDetailPage, /aria-label=\{modulesCollapsed \? 'Show modules' : 'Collapse modules'\}/)
  assert.match(courseDetailPage, /setModulesCollapsed\(\(current\) => !current\)/)
  assert.match(courseDetailPage, /\{modulesCollapsed \? '>' : '<'\}/)
  assert.match(courseDetailPage, /\{!modulesCollapsed && \(/)
  assert.doesNotMatch(courseDetailPage, /hidden=\{modulesHidden\}/)

  assert.ok(collapsedLayoutRule, 'collapsed modules layout rule should exist')
  assert.match(collapsedLayoutRule[0], /grid-template-columns:\s*30px minmax\(0, 1fr\)/)

  assert.ok(collapsedNavRule, 'collapsed modules nav rule should exist')
  assert.match(collapsedNavRule[0], /padding:\s*8px 0/)

  assert.ok(moduleHeaderRule, 'modules header rule should exist')
  assert.match(moduleHeaderRule[0], /align-items:\s*center/)
  assert.match(moduleHeaderRule[0], /justify-content:\s*space-between/)

  assert.ok(toggleRule, 'modules toggle control rule should exist')
  assert.match(toggleRule[0], /background:\s*transparent/)
  assert.match(toggleRule[0], /border:\s*0/)
  assert.match(toggleRule[0], /height:\s*20px/)
  assert.match(toggleRule[0], /width:\s*20px/)

  assert.ok(toggleHoverRule, 'modules toggle hover rule should exist')
  assert.match(toggleHoverRule[0], /color:\s*var\(--accent\)/)
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

test('community delete confirmation uses red destructive styling', () => {
  const confirmRule = css.match(/\.course-detail-community-panel \.course-detail-community-confirm-btn\s*\{[^}]*\}/)
  const confirmHoverRule = css.match(
    /\.course-detail-community-panel \.course-detail-community-confirm-btn:hover:not\(:disabled\),\s*\.course-detail-community-panel \.course-detail-community-confirm-btn:focus-visible:not\(:disabled\)\s*\{[^}]*\}/,
  )

  assert.match(courseDetailPage, /title="Delete this post\?"/)
  assert.match(communityConfirmDialog, /className="course-detail-community-confirm-btn"/)

  assert.ok(confirmRule, 'community delete confirm button rule should exist')
  assert.match(confirmRule[0], /background:\s*#dc2626/)
  assert.match(confirmRule[0], /border-color:\s*#dc2626/)
  assert.match(confirmRule[0], /color:\s*#ffffff/)

  assert.ok(confirmHoverRule, 'community delete confirm button hover rule should exist')
  assert.match(confirmHoverRule[0], /background:\s*#b91c1c/)
  assert.match(confirmHoverRule[0], /border-color:\s*#b91c1c/)
  assert.match(confirmHoverRule[0], /color:\s*#ffffff/)
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

test('inbox conversation stays viewport-bound while messages scroll internally', () => {
  const workspaceRule = css.match(/\.inbox-workspace\s*\{[^}]*\}/)
  const shellRule = css.match(/\.inbox-shell\s*\{[^}]*\}/)
  const sidebarRule = css.match(/\.inbox-sidebar\s*\{[^}]*\}/)
  const conversationRule = css.match(/\.inbox-conversation\s*\{[^}]*\}/)
  const messageListRule = css.match(/\.inbox-message-list\s*\{[^}]*\}/)
  const replyFormRule = css.match(/\.inbox-reply-form\s*\{[^}]*\}/)

  assert.match(inboxPage, /<section className="workspace-page inbox-workspace">/)

  assert.ok(workspaceRule, 'inbox workspace rule should exist')
  assert.match(workspaceRule[0], /display:\s*flex/)
  assert.match(workspaceRule[0], /flex-direction:\s*column/)
  assert.match(workspaceRule[0], /height:\s*calc\(100vh - 30px\)/)
  assert.match(workspaceRule[0], /min-height:\s*0/)
  assert.match(workspaceRule[0], /overflow:\s*hidden/)

  assert.ok(shellRule, 'inbox shell rule should exist')
  assert.match(shellRule[0], /flex:\s*1/)
  assert.match(shellRule[0], /min-height:\s*0/)
  assert.match(shellRule[0], /overflow:\s*hidden/)
  assert.doesNotMatch(shellRule[0], /height:\s*calc\(100vh - [^)]+\)/)

  assert.ok(sidebarRule, 'inbox sidebar rule should exist')
  assert.match(sidebarRule[0], /min-height:\s*0/)

  assert.ok(conversationRule, 'inbox conversation rule should exist')
  assert.match(conversationRule[0], /min-height:\s*0/)

  assert.ok(messageListRule, 'inbox message list rule should exist')
  assert.match(messageListRule[0], /flex:\s*1/)
  assert.match(messageListRule[0], /min-height:\s*0/)
  assert.match(messageListRule[0], /overflow-y:\s*auto/)
  assert.match(messageListRule[0], /overscroll-behavior:\s*contain/)

  assert.ok(replyFormRule, 'inbox reply form rule should exist')
  assert.match(replyFormRule[0], /flex:\s*0 0 auto/)
})

test('inbox uses the global green token without green chat surfaces', () => {
  const globalRootRule = globalCss.match(/:root\s*\{[^}]*\}/)
  const inboxThemeRule = css.match(/\.inbox-workspace \.inbox-shell\s*\{[^}]*\}/)
  const inboxDisabledSendRule = css.match(
    /\.inbox-workspace \.inbox-shell \.workspace-form button:disabled\s*\{[^}]*\}/,
  )
  const inboxSectionStart = css.indexOf('.inbox-workspace {')
  const inboxSectionEnd = css.indexOf('.account-summary {')
  const inboxCss = css.slice(inboxSectionStart, inboxSectionEnd)

  assert.ok(globalRootRule, 'global root variables should exist')
  assert.match(globalRootRule[0], /--fpt-green:\s*#00A550/i)
  assert.notEqual(inboxSectionStart, -1, 'inbox section should exist')
  assert.notEqual(inboxSectionEnd, -1, 'account section should follow inbox section')

  assert.ok(inboxThemeRule, 'inbox theme rule should exist')
  assert.match(inboxThemeRule[0], /--inbox-accent:\s*var\(--fpt-green\)/)
  assert.match(inboxThemeRule[0], /--inbox-accent-hover:\s*var\(--fpt-green\)/)
  assert.doesNotMatch(inboxThemeRule[0], /--inbox-chat-bg/)
  assert.doesNotMatch(inboxThemeRule[0], /--inbox-accent-soft/)
  assert.doesNotMatch(inboxThemeRule[0], /--inbox-accent-border/)
  assert.ok(inboxDisabledSendRule, 'inbox disabled send button rule should exist')
  assert.match(inboxDisabledSendRule[0], /opacity:\s*1/)

  assert.doesNotMatch(inboxCss, /#e9f7ef/i)
  assert.doesNotMatch(inboxCss, /rgba\(0,\s*165,\s*80/)
  assert.doesNotMatch(
    inboxCss,
    /\.inbox-workspace \.inbox-shell \.inbox-message-list\s*\{[^}]*background:/,
  )

  const ownBubbleRule = css.match(/\.inbox-bubble--own\s*\{[^}]*\}/)
  assert.ok(ownBubbleRule, 'own inbox bubble rule should exist')
  assert.match(ownBubbleRule[0], /background:\s*var\(--inbox-accent\)/)
  assert.match(ownBubbleRule[0], /border-color:\s*var\(--inbox-accent\)/)
  assert.doesNotMatch(ownBubbleRule[0], /#00db6a/i)
})

test('inbox reply composer is a compact single lane with an icon-only send control', () => {
  const replyFormRule = css.match(/\.inbox-reply-form\s*\{[^}]*\}/)
  const replyRowRule = css.match(/\.inbox-reply-row\s*\{[^}]*\}/)
  const sendButtonRule = css.match(
    /\.inbox-workspace \.inbox-shell \.inbox-reply-form \.inbox-send-button\s*\{[^}]*\}/,
  )
  const sendIconRule = css.match(/\.inbox-send-icon\s*\{[^}]*\}/)

  assert.ok(replyFormRule, 'inbox reply form rule should exist')
  assert.match(replyFormRule[0], /display:\s*flex/)
  assert.match(replyFormRule[0], /flex-direction:\s*column/)
  assert.match(replyFormRule[0], /gap:\s*8px/)
  assert.match(replyFormRule[0], /padding:\s*10px 14px/)

  assert.ok(replyRowRule, 'inbox reply row rule should exist')
  assert.match(replyRowRule[0], /grid-template-columns:\s*minmax\(0, 1fr\) auto/)

  const replyComposerRule = css.match(/\.inbox-reply-composer\s*\{[^}]*\}/)
  const replyComposerTextareaRule = css.match(/\.inbox-reply-composer textarea\s*\{[^}]*\}/)

  assert.ok(replyComposerRule, 'inbox reply composer rule should exist')
  assert.match(replyComposerRule[0], /border:\s*1px solid var\(--border\)/)

  assert.ok(replyComposerTextareaRule, 'inbox reply composer textarea rule should exist')
  assert.match(replyComposerTextareaRule[0], /min-height:\s*32px/)

  assert.ok(sendButtonRule, 'inbox send button rule should exist')
  assert.match(sendButtonRule[0], /background:\s*transparent/)
  assert.match(sendButtonRule[0], /border:\s*0/)
  assert.match(sendButtonRule[0], /color:\s*var\(--inbox-accent\)/)
  assert.match(sendButtonRule[0], /width:\s*44px/)

  assert.ok(sendIconRule, 'inbox send icon rule should exist')
  assert.match(sendIconRule[0], /fill:\s*currentColor/)
  assert.match(sendIconRule[0], /height:\s*20px/)
  assert.match(sendIconRule[0], /width:\s*20px/)
})

test('active inbox request badge stays visible on the active tab background', () => {
  const activeBadgeRule = css.match(
    /\.inbox-workspace \.inbox-shell \.inbox-tab--active \.inbox-badge\s*\{[^}]*\}/,
  )

  assert.ok(activeBadgeRule, 'scoped active inbox badge rule should exist')
  assert.match(activeBadgeRule[0], /background:\s*#ffffff/)
  assert.match(activeBadgeRule[0], /color:\s*var\(--inbox-accent\)/)
})

test('inbox settings polish styles compact menu, accent back button, and search highlights', () => {
  const menuItemRule = css.match(/\.inbox-settings-menu-item\s*\{[^}]*\}/)
  const backRule = css.match(/\.inbox-settings-back\s*\{[^}]*\}/)
  const highlightRule = css.match(/\.inbox-highlight\s*\{[^}]*\}/)
  const dangerRule = css.match(/\.inbox-modal-danger\s*\{[^}]*\}/)

  assert.ok(menuItemRule, 'settings menu item rule should exist')
  assert.match(menuItemRule[0], /padding:\s*9px 12px/)
  assert.match(menuItemRule[0], /font-size:\s*0\.9rem/)

  assert.ok(backRule, 'settings back button rule should exist')
  assert.match(backRule[0], /border:\s*1px solid var\(--inbox-accent\)/)
  assert.match(backRule[0], /color:\s*var\(--inbox-accent\)/)

  assert.ok(highlightRule, 'inbox highlight rule should exist')
  assert.match(highlightRule[0], /color-mix/)

  assert.ok(dangerRule, 'modal danger button rule should exist')
  assert.match(dangerRule[0], /background:\s*var\(--inbox-accent\)/)
})

test('nickname settings keep the member list at the top and use a popup editor', () => {
  const nicknamePanelRule = css.match(/\.inbox-settings-panel--nickname\s*\{[^}]*\}/)
  const nicknameListRule = css.match(/\.inbox-nickname-list\s*\{[^}]*\}/)
  const nicknameRowRule = css.match(/\.inbox-nickname-row\s*\{[^}]*\}/)
  const nicknameModalPersonRule = css.match(/\.inbox-nickname-modal-person\s*\{[^}]*\}/)

  assert.ok(nicknamePanelRule, 'nickname settings panel rule should exist')
  assert.match(nicknamePanelRule[0], /align-content:\s*start/)
  assert.match(nicknamePanelRule[0], /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/)

  assert.ok(nicknameListRule, 'nickname list rule should exist')
  assert.match(nicknameListRule[0], /align-content:\s*start/)
  assert.match(nicknameListRule[0], /align-self:\s*start/)

  assert.ok(nicknameRowRule, 'nickname row button rule should exist')
  assert.match(nicknameRowRule[0], /cursor:\s*pointer/)
  assert.match(nicknameRowRule[0], /text-align:\s*left/)
  assert.match(nicknameRowRule[0], /width:\s*100%/)

  assert.ok(nicknameModalPersonRule, 'nickname modal selected person rule should exist')
  assert.match(nicknameModalPersonRule[0], /grid-template-columns:\s*36px minmax\(0,\s*1fr\)/)
})
