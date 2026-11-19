import { describe, expect, it } from 'vitest'
import { Editor } from '@v5md/view'
import {
  createVideoPlugin,
  extensionOf,
  isPlatformPageUrl,
  parseVideoBlock,
  serializeVideoBlock,
  videoTypeFor,
  type VideoApi,
} from '../src/index.ts'

const F = '`'.repeat(3)
const fence = (lang: string, body: string): string => F + lang + '\n' + body + '\n' + F + '\n'

function mount(markdown: string, plugins = [createVideoPlugin()]) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({ element, value: markdown, outline: false, toolbar: false, plugins })
  return { element, editor }
}

describe('@v5md/plugin-video', () => {
  it('detects extensions and MIME types', () => {
    expect(extensionOf('https://cdn.x/a/clip.MP4?token=1')).toBe('mp4')
    expect(extensionOf('clip.v2.webm')).toBe('webm')
    expect(extensionOf('https://cdn.x/clip')).toBe('')
    expect(videoTypeFor('clip.mp4')).toBe('video/mp4')
    expect(videoTypeFor('clip.webm')).toBe('video/webm')
    expect(videoTypeFor('clip.mp3')).toBe('audio/mpeg')
    expect(videoTypeFor('clip.webm?x=1')).toBe('video/webm')
    expect(videoTypeFor('clip.exe')).toBeNull()
  })

  it('flags platform share pages but not direct media links', () => {
    expect(isPlatformPageUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true)
    expect(isPlatformPageUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isPlatformPageUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isPlatformPageUrl('https://vimeo.com/76979871')).toBe(false)
    expect(isPlatformPageUrl('https://cdn.x/clip.mp4')).toBe(false)
    expect(isPlatformPageUrl('not a url')).toBe(false)
  })

  it('parses bare URLs, links, key=value and JSON bodies', () => {
    expect(parseVideoBlock('clip.mp4')).toMatchObject({ src: 'clip.mp4', kind: 'video', hasSource: true, start: 0 })
    expect(parseVideoBlock('  https://cdn.x/a.mp4\n')).toMatchObject({ src: 'https://cdn.x/a.mp4' })
    expect(parseVideoBlock('[演示](clip.mp4)')).toMatchObject({ src: 'clip.mp4', title: '演示' })
    expect(parseVideoBlock('src=clip.mp4 poster="cover one.png" start=12s')).toMatchObject({
      src: 'clip.mp4',
      poster: 'cover one.png',
      start: 12,
    })
    expect(parseVideoBlock('{"src":"clip.mp4","title":"t","start":7}')).toMatchObject({
      src: 'clip.mp4',
      title: 't',
      start: 7,
    })
    expect(parseVideoBlock('', 'audio')).toMatchObject({ kind: 'audio', hasSource: false, reason: 'missing-src' })
  })

  it('keeps unplayable sources with a reason instead of dropping them', () => {
    expect(parseVideoBlock('https://www.bilibili.com/video/BV1xx411c7mD')).toMatchObject({ reason: 'platform-url' })
    expect(parseVideoBlock('clip.avi')).toMatchObject({ reason: 'unsupported', hasSource: true })
    expect(parseVideoBlock('')).toMatchObject({ reason: 'missing-src' })
    expect(parseVideoBlock('{bad json')).toMatchObject({ reason: 'missing-src' })
  })

  it('round-trips through serializeVideoBlock', () => {
    const source = serializeVideoBlock('clip.mp4', { poster: 'cover one.png', title: '演示', start: 12.4 })
    expect(source).toBe('src=clip.mp4 poster="cover one.png" title=演示 start=12s')
    expect(parseVideoBlock(source)).toMatchObject({ src: 'clip.mp4', poster: 'cover one.png', start: 12 })
  })

  it('renders a video fence as a native player', () => {
    const { element, editor } = mount('# t\n\n' + fence('video', 'src=clip.mp4 start=12s'))
    const video = element.querySelector<HTMLVideoElement>('.v5-video-preview > video')
    expect(video).not.toBeNull()
    expect(video?.querySelector('source')?.getAttribute('src')).toBe('clip.mp4')
    expect(video?.querySelector('source')?.getAttribute('type')).toBe('video/mp4')
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(video?.getAttribute('preload')).toBe('metadata')
    expect(element.querySelector('.v5-video-start')?.textContent).toBe('0:12')
    editor.destroy()
  })

  it('renders an audio fence inside an audio element', () => {
    const { element, editor } = mount(fence('audio', 'song.mp3'))
    const audio = element.querySelector<HTMLAudioElement>('.v5-video-preview > audio')
    expect(audio?.querySelector('source')?.getAttribute('type')).toBe('audio/mpeg')
    expect(element.querySelector<HTMLElement>('.v5-video-preview')?.dataset.videoKind).toBe('audio')
    editor.destroy()
  })

  it('renders a cover with the reason for platform URLs', () => {
    const { element, editor } = mount(fence('video', 'https://www.bilibili.com/video/BV1xx411c7mD'))
    expect(element.querySelector('video')).toBeNull()
    const cover = element.querySelector('.v5-video-cover')
    expect(cover).not.toBeNull()
    expect(cover?.querySelector('.v5-video-reason')?.textContent).toContain('mp4')
    expect(cover?.querySelector('.v5-video-url')?.textContent).toBe('https://www.bilibili.com/video/BV1xx411c7mD')
    editor.destroy()
  })

  it('keeps one player across edits and swaps it when the source changes', () => {
    const { element, editor } = mount(fence('video', 'a.mp4'))
    const source = () => element.querySelector('video source')?.getAttribute('src')
    expect(source()).toBe('a.mp4')
    // Metadata changes keep one player on screen.
    editor.setMarkdown('# t\n\n' + fence('video', 'src=a.mp4 title=演示'))
    expect(element.querySelectorAll('video')).toHaveLength(1)
    expect(source()).toBe('a.mp4')
    expect(element.querySelector('video')?.getAttribute('aria-label')).toBe('演示')
    // A new src swaps the player and leaves no stale element behind.
    editor.setMarkdown('# t\n\n' + fence('video', 'b.mp4'))
    expect(element.querySelectorAll('video')).toHaveLength(1)
    expect(source()).toBe('b.mp4')
    editor.destroy()
  })

  it('inserts a fence from the toolbar command and the API', async () => {
    const { element, editor } = mount('')
    await editor.runCommand('video.insert', 'clip.mp4')
    expect(editor.getMarkdown()).toContain('src=clip.mp4')
    const api = editor.getPlugin<VideoApi>('video')?.api
    expect(api?.insert('song.mp3', { audio: true, start: 30 })).toBe(true)
    expect(editor.getMarkdown()).toContain('src=song.mp3 start=30s')
    expect(element.querySelector('[data-command="video.insert"], [aria-label="视频"]')).toBeTruthy()
    editor.destroy()
  })

  it('leaves the default code block alone when the lang is not matched', () => {
    const { element, editor } = mount(fence('json', '{"a":1}'))
    expect(element.querySelector('.v5-video')).toBeNull()
    expect(element.querySelector('.v5-code')).not.toBeNull()
    editor.destroy()
  })
})
