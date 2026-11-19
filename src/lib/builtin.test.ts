import { afterEach, describe, expect, it } from 'vitest'
import { builtinJson, checkBuiltinAi } from './builtin'
import { LOCAL_TURN_SCHEMA } from './prompts'

const g = globalThis as unknown as { LanguageModel?: unknown }
afterEach(() => {
  delete g.LanguageModel
})

describe("phone's built-in AI", () => {
  it('reports missing when Chrome does not expose it', async () => {
    expect((await checkBuiltinAi()).state).toBe('missing')
  })

  it('detects Hindi support, and falls back to English-only availability', async () => {
    g.LanguageModel = { availability: async (o?: { expectedInputs?: unknown }) => (o?.expectedInputs ? 'available' : 'available'), create: async () => ({}) }
    expect(await checkBuiltinAi()).toEqual({ state: 'available', hindi: true })
    g.LanguageModel = { availability: async (o?: { expectedInputs?: unknown }) => (o?.expectedInputs ? 'unavailable' : 'downloadable'), create: async () => ({}) }
    expect(await checkBuiltinAi()).toEqual({ state: 'downloadable', hindi: false })
  })

  it('sends instructions as the system prompt, history as context and constrains the JSON', async () => {
    let created: { initialPrompts: { role: string; content: string }[] } | undefined
    let prompted: { input: string; constraint: { type: string } } | undefined
    let destroyed = false
    g.LanguageModel = {
      availability: async () => 'available',
      create: async (o: typeof created) => {
        created = o
        return {
          prompt: async (input: string, opts: { responseConstraint: { type: string } }) => {
            prompted = { input, constraint: opts.responseConstraint }
            return '{"reply":"बहुत अच्छा!"}'
          },
          destroy: () => {
            destroyed = true
          },
        }
      },
    }
    const out = await builtinJson<{ reply: string }>(
      {
        system: 'RULES',
        schema: LOCAL_TURN_SCHEMA,
        messages: [
          { role: 'user', text: '[Session start]' },
          { role: 'model', text: 'नमस्ते!' },
          { role: 'user', text: 'मैं ठीक हूँ' },
        ],
      },
      true,
    )
    expect(out.reply).toBe('बहुत अच्छा!')
    expect(created!.initialPrompts.map((m) => m.role)).toEqual(['system', 'user', 'assistant'])
    expect(created!.initialPrompts[0].content).toBe('RULES')
    expect(prompted!.input).toBe('मैं ठीक हूँ')
    expect(prompted!.constraint.type).toBe('object')
    expect(destroyed).toBe(true)
  })
})
