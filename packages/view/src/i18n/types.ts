/** Built-in UI locales. */
export type LocaleCode = 'zh-CN' | 'en'

export interface LocaleMessages {
  toolbar: {
    code: string
    table: string
    image: string
    orderedList: string
    bulletList: string
    taskList: string
    quote: string
    heading1: string
    heading2: string
    heading3: string
    rule: string
    link: string
    math: string
    inlineMath: string
    bold: string
    italic: string
    underline: string
    inlineCode: string
    strike: string
    highlight: string
    wechat: string
    wechatCopied: string
    wechatFailed: string
    more: string
    aria: string
  }
  slash: {
    paragraph: string
    heading1: string
    heading2: string
    heading3: string
    bulletList: string
    orderedList: string
    taskList: string
    quote: string
    code: string
    rule: string
    image: string
  }
  find: {
    query: string
    replacement: string
    previous: string
    next: string
    replace: string
    replaceAll: string
    close: string
    matchCase: string
    wholeWord: string
    regexp: string
    noResults: string
  }
  outline: {
    title: string
  }
  table: {
    aria: string
    insertRowAbove: string
    insertRowBelow: string
    deleteRow: string
    insertColumnLeft: string
    insertColumnRight: string
    deleteColumn: string
    alignLeft: string
    alignCenter: string
    alignRight: string
    deleteTable: string
  }
  block: {
    handle: string
    up: string
    down: string
    before: string
    after: string
    paragraph: string
    heading1: string
    heading2: string
    heading3: string
    bulletList: string
    orderedList: string
    taskList: string
    quote: string
    delete: string
  }
  aria: {
    taskChecked: string
    taskUnchecked: string
    resizeImage: string
  }
  link: {
    modifierCtrl: string
    openSystem: string
    openTab: string
    /** Full hover hint. `{modifier}` and `{where}` are replaced. */
    hint: string
  }
  /** Default empty-document placeholder when the host does not pass one. */
  placeholder: string
}
