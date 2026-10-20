import { FIELDS, type Field } from '../lib/validation'
import type { State } from '../state/store'
import { byId, setText } from './dom'

export interface FormHandlers {
  onInput(field: Field, value: string): void
  onBlur(field: Field): void
  onExample(): void
  onReset(): void
}

export interface FormView {
  render(state: State): void
  focusFirst(): void
}

export function createForm(handlers: FormHandlers): FormView {
  const form = byId<HTMLFormElement>('position-form')
  const controls = FIELDS.map((field) => ({
    field,
    input: byId<HTMLInputElement>(field),
    error: byId(`${field}-error`),
    wrapper: form.querySelector<HTMLElement>(`.field[data-field="${field}"]`)!,
  }))

  const validateAll = () => {
    for (const field of FIELDS) handlers.onBlur(field)
  }

  for (const { field, input } of controls) {
    input.addEventListener('input', () => handlers.onInput(field, input.value))
    input.addEventListener('blur', () => handlers.onBlur(field))
    // Enter shows every field's problems (the form has no submit button,
    // so browsers would otherwise ignore it).
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        validateAll()
      }
    })
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    validateAll()
  })
  form.addEventListener('reset', (event) => {
    event.preventDefault()
    handlers.onReset()
  })
  byId('example-button').addEventListener('click', () => handlers.onExample())

  return {
    render(state) {
      for (const { field, input, error, wrapper } of controls) {
        if (input.value !== state.raw[field]) input.value = state.raw[field]
        const message = state.errors[field]
        wrapper.classList.toggle('has-error', Boolean(message))
        error.hidden = !message
        setText(error, message ?? '')
        input.setAttribute('aria-invalid', message ? 'true' : 'false')
        input.setAttribute('aria-describedby', message ? `${field}-error ${field}-hint` : `${field}-hint`)
      }
    },
    focusFirst() {
      controls[0].input.focus()
    },
  }
}
