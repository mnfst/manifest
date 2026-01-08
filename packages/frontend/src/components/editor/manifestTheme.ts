/**
 * Manifest VS Code theme ported to CodeMirror 6.
 * Colors sourced from: https://github.com/mnfst/vscode-theme-manifest
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Manifest theme colors.
 */
export const manifestColors = {
  background: '#1c1c24',
  foreground: '#f2c79c',
  cursor: '#ddbb88',
  selection: '#2430f0',
  lineNumbers: '#6688cc',
  activeLineNumber: '#d8ddfc',
  activeLine: 'rgba(36, 48, 240, 0.1)',
  comments: '#6688cc',
  strings: '#f7d7bc',
  numbers: '#ff9e9c',
  keywords: '#F2C79C',
  variables: '#a8efe0',
  functions: '#2be1b7',
  types: '#82F0DD',
  operators: '#f2c79c',
  punctuation: '#f2c79c',
};

/**
 * CodeMirror editor theme (UI styling).
 */
export const manifestEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: manifestColors.background,
      color: manifestColors.foreground,
    },
    '.cm-content': {
      caretColor: manifestColors.cursor,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: '14px',
      lineHeight: '1.6',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: manifestColors.cursor,
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: manifestColors.selection,
    },
    '.cm-gutters': {
      backgroundColor: manifestColors.background,
      color: manifestColors.lineNumbers,
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      color: manifestColors.activeLineNumber,
      backgroundColor: 'transparent',
    },
    '.cm-activeLine': {
      backgroundColor: manifestColors.activeLine,
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 16px',
      minWidth: '40px',
    },
    '.cm-foldGutter': {
      width: '16px',
    },
    '.cm-tooltip': {
      backgroundColor: '#252530',
      border: '1px solid #3a3a4a',
      borderRadius: '4px',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: manifestColors.selection,
      },
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 255, 0, 0.3)',
      borderRadius: '2px',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(255, 200, 0, 0.5)',
    },
    '.cm-panels': {
      backgroundColor: '#252530',
      color: manifestColors.foreground,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #3a3a4a',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #3a3a4a',
    },
    '.cm-textfield': {
      backgroundColor: manifestColors.background,
      border: '1px solid #3a3a4a',
      borderRadius: '4px',
      color: manifestColors.foreground,
    },
    '.cm-button': {
      backgroundColor: '#3a3a4a',
      border: 'none',
      borderRadius: '4px',
      color: manifestColors.foreground,
    },
  },
  { dark: true }
);

/**
 * CodeMirror syntax highlighting styles.
 */
export const manifestHighlightStyle = HighlightStyle.define([
  // Comments
  { tag: tags.comment, color: manifestColors.comments, fontStyle: 'italic' },
  { tag: tags.lineComment, color: manifestColors.comments, fontStyle: 'italic' },
  { tag: tags.blockComment, color: manifestColors.comments, fontStyle: 'italic' },
  { tag: tags.docComment, color: manifestColors.comments, fontStyle: 'italic' },

  // Strings
  { tag: tags.string, color: manifestColors.strings },
  { tag: tags.special(tags.string), color: manifestColors.strings },
  { tag: tags.regexp, color: manifestColors.strings },

  // Numbers
  { tag: tags.number, color: manifestColors.numbers },
  { tag: tags.integer, color: manifestColors.numbers },
  { tag: tags.float, color: manifestColors.numbers },

  // Keywords
  { tag: tags.keyword, color: manifestColors.keywords },
  { tag: tags.controlKeyword, color: manifestColors.keywords },
  { tag: tags.operatorKeyword, color: manifestColors.keywords },
  { tag: tags.definitionKeyword, color: manifestColors.keywords },
  { tag: tags.moduleKeyword, color: manifestColors.keywords },

  // Variables and properties
  { tag: tags.variableName, color: manifestColors.variables },
  { tag: tags.propertyName, color: manifestColors.variables },
  { tag: tags.attributeName, color: manifestColors.variables },
  { tag: tags.special(tags.variableName), color: manifestColors.variables },
  { tag: tags.definition(tags.variableName), color: manifestColors.variables },

  // Functions
  { tag: tags.function(tags.variableName), color: manifestColors.functions },
  { tag: tags.function(tags.propertyName), color: manifestColors.functions },

  // Types and classes
  { tag: tags.typeName, color: manifestColors.types },
  { tag: tags.className, color: manifestColors.types },
  { tag: tags.namespace, color: manifestColors.types },
  { tag: tags.macroName, color: manifestColors.types },
  { tag: tags.labelName, color: manifestColors.types },

  // JSX/HTML tags
  { tag: tags.tagName, color: manifestColors.functions },
  { tag: tags.angleBracket, color: manifestColors.punctuation },

  // Operators and punctuation
  { tag: tags.operator, color: manifestColors.operators },
  { tag: tags.punctuation, color: manifestColors.punctuation },
  { tag: tags.bracket, color: manifestColors.punctuation },
  { tag: tags.paren, color: manifestColors.punctuation },
  { tag: tags.brace, color: manifestColors.punctuation },
  { tag: tags.squareBracket, color: manifestColors.punctuation },

  // Special
  { tag: tags.bool, color: manifestColors.numbers },
  { tag: tags.null, color: manifestColors.numbers },
  { tag: tags.self, color: manifestColors.keywords },
  { tag: tags.atom, color: manifestColors.numbers },

  // Invalid/error
  { tag: tags.invalid, color: '#ff5555', textDecoration: 'underline wavy' },
]);

/**
 * Complete Manifest theme extension for CodeMirror.
 * Use this in the extensions array when creating a CodeMirror instance.
 */
export const manifestTheme = [manifestEditorTheme, syntaxHighlighting(manifestHighlightStyle)];
