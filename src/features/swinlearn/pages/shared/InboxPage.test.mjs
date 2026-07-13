import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const inboxPage = readFileSync(
  new URL('./InboxPage.tsx', import.meta.url),
  'utf8',
)

test('people search empty state describes combined name and course filters', () => {
  assert.match(
    inboxPage,
    /const personSearchEmptyMessage = \(query: string, courseId: string\)/,
  )
  assert.match(inboxPage, /No people named "\$\{trimmedQuery\}" are in this course\./)
  assert.match(inboxPage, /personSearchEmptyMessage\(searchQuery, searchCourseId\)/)
})

test('reply composer uses an icon-only paper plane send button', () => {
  assert.match(inboxPage, /className="workspace-form inbox-reply-form"/)
  assert.match(inboxPage, /aria-label=\{saving \? 'Sending message' : 'Send message'\}/)
  assert.match(inboxPage, /className="inbox-send-button"/)
  assert.match(inboxPage, /className="inbox-send-icon"/)
  assert.match(inboxPage, /viewBox="0 0 512 512"/)
  assert.match(inboxPage, /M498\.1 5\.6c10\.1 7 15\.4 19\.1 13\.5 31\.2/)
  assert.doesNotMatch(inboxPage, /\{saving \? 'Sending\.\.\.' : 'Send'\}/)
})

test('conversation message list scrolls to the latest message when opened', () => {
  assert.match(inboxPage, /scrollMessagesToBottom/)
  assert.match(inboxPage, /messagesEndRef/)
  assert.match(inboxPage, /ref=\{messageListRef\}/)
  assert.match(inboxPage, /useLayoutEffect/)
  assert.match(inboxPage, /list\.scrollTop = list\.scrollHeight/)
  assert.match(inboxPage, /ResizeObserver/)
})

test('reply composer supports GIFs and Enter-to-send', () => {
  assert.match(inboxPage, /import \{ GiphyPicker \} from '\.\.\/\.\.\/components\/GiphyPicker'/)
  assert.match(inboxPage, /handleEnterToSubmit/)
  assert.match(inboxPage, /replyDraft/)
  assert.match(inboxPage, /inboxMessagePreview/)
  assert.match(inboxPage, /gif_url/)
  assert.match(inboxPage, /className="inbox-reply-composer"/)
  assert.match(inboxPage, /requestSubmit\(\)/)
  assert.match(inboxPage, /sendInboxMessage\(selectedConversationId, \{/)
})

test('sidebar exposes group creation and conversation search outside the chat frame', () => {
  assert.match(inboxPage, /className="inbox-create-group-button"/)
  assert.match(inboxPage, /Create group/)
  assert.match(inboxPage, /className="inbox-conversation-search"/)
  assert.match(inboxPage, /conversationSearchQuery/)
  assert.match(inboxPage, /conversationMatchesSearch/)
})

test('conversation settings use the Font Awesome ellipsis icon without a button background', () => {
  assert.match(inboxPage, /className="inbox-settings-button"/)
  assert.match(inboxPage, /className="inbox-settings-icon"/)
  assert.match(inboxPage, /viewBox="0 0 448 512"/)
  assert.match(inboxPage, /M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256/)
  assert.match(inboxPage, /renderSettingsPanel/)
  assert.match(inboxPage, /Change conversation color/)
  assert.match(inboxPage, /Search in conversation/)
})

test('inbox actions render the requested Font Awesome icons', () => {
  assert.match(inboxPage, /M416 208c0 45\.9-14\.9 88\.3-40 122\.7/)
  assert.match(inboxPage, /M471\.6 21\.7c-21\.9-21\.9-57\.3-21\.9-79\.2 0/)
  assert.match(inboxPage, /M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z/)
  assert.match(inboxPage, /M72 88a56 56 0 1 1 112 0A56 56 0 1 1 72 88z/)
  assert.match(inboxPage, /<InboxSearchIcon \/>/)
  assert.match(inboxPage, /<InboxNicknameIcon \/>/)
  assert.match(inboxPage, /<InboxDeleteIcon \/>/)
  assert.match(inboxPage, /<InboxGroupIcon \/>/)
})

test('settings polish uses popup delete, accent back button, and Font Awesome in-chat search navigation', () => {
  assert.match(inboxPage, /deleteModalOpen/)
  assert.match(inboxPage, /className="inbox-modal-danger"/)
  assert.match(inboxPage, /className="inbox-settings-back"/)
  assert.match(inboxPage, /renderHighlightedBody/)
  assert.match(inboxPage, /className="inbox-highlight"/)
  assert.match(inboxPage, /className="inbox-search-nav"/)
  assert.match(inboxPage, /inConversationMatchIndex/)
  assert.match(inboxPage, /scrollToConversationMatch/)
  assert.match(inboxPage, /import \{ faAngleDown, faAngleUp \} from '@fortawesome\/free-solid-svg-icons'/)
  assert.match(inboxPage, /import \{ FontAwesomeIcon \} from '@fortawesome\/react-fontawesome'/)
  assert.match(inboxPage, /icon=\{faAngleUp\}/)
  assert.match(inboxPage, /icon=\{faAngleDown\}/)
  assert.match(inboxPage, /<InboxAngleUpIcon \/>/)
  assert.match(inboxPage, /<InboxAngleDownIcon \/>/)
  assert.doesNotMatch(inboxPage, /settingsView === 'delete'/)
})

test('nickname settings list every participant first and open an editor popup on selection', () => {
  assert.match(inboxPage, /const \[selectedNicknameUserId, setSelectedNicknameUserId\] = useState\(''\)/)
  assert.match(inboxPage, /const handleOpenNicknameEditor = \(participant: ConversationParticipantRow\) => \{/)
  assert.match(inboxPage, /className="inbox-settings-panel inbox-settings-panel--nickname"/)
  assert.match(inboxPage, /aria-label="Conversation members"/)
  assert.match(inboxPage, /className="inbox-nickname-row"/)
  assert.match(inboxPage, /onClick=\{\(\) => handleOpenNicknameEditor\(participant\)\}/)
  assert.match(inboxPage, /const selectedNicknameUser = selectedNicknameParticipant\?\.user \?\? null/)
  assert.match(inboxPage, /selectedNicknameParticipant && selectedNicknameUser && \(/)
  assert.match(inboxPage, /aria-labelledby="inbox-nickname-modal-title"/)
  assert.match(inboxPage, /handleSaveNickname\(selectedNicknameUser\.id\)/)
  assert.doesNotMatch(inboxPage, /\.filter\(\(participant\) => participant\.user && participant\.user\.id !== user\?\.id\)/)
})
