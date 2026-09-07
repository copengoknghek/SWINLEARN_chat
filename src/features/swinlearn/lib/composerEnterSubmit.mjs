/**
 * @param {KeyboardEvent} event
 * @param {() => void} onSubmit
 * @param {{ canSubmit?: boolean }} [options]
 */
export function handleEnterToSubmit(event, onSubmit, { canSubmit = true } = {}) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
    return
  }

  event.preventDefault()

  if (canSubmit) {
    onSubmit()
  }
}
