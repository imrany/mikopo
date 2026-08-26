import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  $createParagraphNode,
  type LexicalEditor,
  type ElementFormatType,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
  ListItemNode,
} from "@lexical/list";
import { LinkNode, AutoLinkNode, TOGGLE_LINK_COMMAND, $isLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $setBlocksType } from "@lexical/selection";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List as ListIcon,
  ListOrdered,
  Quote as QuoteIcon,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Maximize2,
  Minimize2,
  Code2,
  Eye,
  Smile,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SUPPORTED_ICONS } from "@/components/icon-autocomplete-editor";

const lexicalTheme = {
  paragraph: "mb-2 leading-relaxed text-sm text-foreground",
  heading: {
    h1: "text-2xl font-bold tracking-tight mb-3 mt-4 text-foreground",
    h2: "text-xl font-semibold tracking-tight mb-2 mt-3 text-foreground",
    h3: "text-lg font-medium tracking-tight mb-2 mt-2 text-foreground",
  },
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "list-decimal pl-5 space-y-1 mb-2 text-sm text-foreground",
    ul: "list-disc pl-5 space-y-1 mb-2 text-sm text-foreground",
    listitem: "leading-relaxed text-sm text-foreground",
  },
  quote:
    "border-l-4 border-primary/70 pl-3 italic my-3 text-sm text-muted-foreground bg-primary/5 py-1 rounded-r",
  code: "bg-muted/80 text-foreground font-mono text-xs p-3 rounded-md block overflow-x-auto my-2 border border-border/60",
  codeHighlight: {
    atrule: "text-blue-500",
    attr: "text-cyan-500",
    boolean: "text-purple-500",
    builtin: "text-amber-500",
    cdata: "text-gray-500",
    char: "text-emerald-500",
    class: "text-pink-500",
    "class-name": "text-pink-500",
    comment: "text-muted-foreground italic",
    constant: "text-purple-500",
    deleted: "text-destructive",
    doctype: "text-gray-500",
    entity: "text-yellow-500",
    function: "text-blue-600 dark:text-blue-400",
    important: "text-orange-500 font-bold",
    inserted: "text-emerald-600 dark:text-emerald-400",
    keyword: "text-purple-600 dark:text-purple-400 font-semibold",
    number: "text-amber-600 dark:text-amber-400",
    operator: "text-sky-500",
    prolog: "text-gray-500",
    property: "text-emerald-500",
    punctuation: "text-muted-foreground",
    regex: "text-red-500",
    selector: "text-blue-500",
    string: "text-emerald-600 dark:text-emerald-400",
    symbol: "text-amber-500",
    tag: "text-rose-500",
    url: "text-sky-500 underline",
    variable: "text-yellow-600 dark:text-yellow-400",
  },
  text: {
    bold: "font-bold text-foreground",
    italic: "italic",
    underline: "underline underline-offset-2",
    strikethrough: "line-through opacity-75",
    underlineStrikethrough: "underline line-through",
    code: "bg-muted text-primary px-1.5 py-0.5 rounded font-mono text-xs border border-border/50",
  },
  link: "text-primary hover:underline font-medium cursor-pointer",
};

export interface LexicalRichEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode?: "markdown" | "html" | "text";
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  disabled?: boolean;
  allowSourceToggle?: boolean;
  showIconPicker?: boolean;
}

function ValueSyncPlugin({
  value,
  mode,
  isSourceMode,
  lastEmittedValueRef,
}: {
  value: string;
  mode: "markdown" | "html" | "text";
  isSourceMode: boolean;
  lastEmittedValueRef: React.MutableRefObject<string | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isSourceMode) return;

    // 1. If incoming value is identical to what the editor itself just emitted, ignore!
    if (isInitializedRef.current && value === lastEmittedValueRef.current) {
      return;
    }

    // 2. Check current editor contents before clearing/rebuilding
    editor.getEditorState().read(() => {
      let currentVal = "";
      if (mode === "html") {
        currentVal = $generateHtmlFromNodes(editor);
      } else if (mode === "markdown") {
        currentVal = $convertToMarkdownString(TRANSFORMERS);
      } else {
        const root = $getRoot();
        currentVal = root.getTextContent();
      }

      // If existing content matches incoming value, avoid resetting selection
      if (isInitializedRef.current && currentVal === value) {
        lastEmittedValueRef.current = value;
        return;
      }

      // Only perform rebuild when value came from external source or during initial load
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        isInitializedRef.current = true;
        lastEmittedValueRef.current = value;

        if (!value) return;

        if (mode === "html") {
          const parser = new DOMParser();
          const dom = parser.parseFromString(value, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          root.append(...nodes);
        } else if (mode === "markdown") {
          $convertFromMarkdownString(value, TRANSFORMERS);
        } else {
          const p = $createParagraphNode();
          p.append(
            ...$generateNodesFromDOM(editor, new DOMParser().parseFromString(value, "text/html")),
          );
          root.append(p);
        }
      });
    });
  }, [editor, mode, isSourceMode, value, lastEmittedValueRef]);

  return null;
}

function EditorToolbar({
  mode,
  isSourceMode,
  setIsSourceMode,
  isFullScreen,
  setIsFullScreen,
  showIconPicker,
  allowSourceToggle,
  onInsertText,
}: {
  mode: "markdown" | "html" | "text";
  isSourceMode: boolean;
  setIsSourceMode: React.Dispatch<React.SetStateAction<boolean>>;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  showIconPicker: boolean;
  allowSourceToggle: boolean;
  onInsertText: (text: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<string>("paragraph");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [iconFilter, setIconFilter] = useState("");
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      const node = selection.anchor.getNode();
      const parent = node.getParent();
      setIsLink($isLinkNode(parent) || $isLinkNode(node));

      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = element.getParent();
          const type =
            parentList && $isListNode(parentList)
              ? (parentList as ListNode).getListType()
              : element.getListType();
          setBlockType(type === "number" ? "number" : "bullet");
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : $isQuoteNode(element)
              ? "quote"
              : element.getType();
          setBlockType(type);
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, updateToolbar]);

  const formatHeading = (tag: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (blockType === tag) {
          $setBlocksType(selection, () => $createParagraphNode());
          setBlockType("paragraph");
        } else {
          $setBlocksType(selection, () => $createHeadingNode(tag));
          setBlockType(tag);
        }
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (blockType === "quote") {
          $setBlocksType(selection, () => $createParagraphNode());
          setBlockType("paragraph");
        } else {
          $setBlocksType(selection, () => $createQuoteNode());
          setBlockType("quote");
        }
      }
    });
  };

  const formatBulletList = () => {
    if (blockType === "bullet") {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      setBlockType("paragraph");
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      setBlockType("bullet");
    }
  };

  const formatNumberedList = () => {
    if (blockType === "number") {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      setBlockType("paragraph");
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      setBlockType("number");
    }
  };

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const formatted =
        linkUrl.startsWith("http://") ||
        linkUrl.startsWith("https://") ||
        linkUrl.startsWith("mailto:")
          ? linkUrl
          : `https://${linkUrl}`;
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, formatted);
    }
    setLinkPopoverOpen(false);
    setLinkUrl("");
  };

  const filteredIcons = SUPPORTED_ICONS.filter(
    (i) =>
      i.name.toLowerCase().includes(iconFilter.toLowerCase()) ||
      i.label.toLowerCase().includes(iconFilter.toLowerCase()),
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 border-b bg-muted/40 text-xs rounded-t-lg select-none">
      <div className="flex flex-wrap items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        <Button
          type="button"
          variant={blockType === "h1" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => formatHeading("h1")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Heading 1"
        >
          <Heading1 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={blockType === "h2" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => formatHeading("h2")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Heading 2"
        >
          <Heading2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={blockType === "h3" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => formatHeading("h3")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Heading 3"
        >
          <Heading3 className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        <Button
          type="button"
          variant={isBold ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground font-bold"
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={isItalic ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={isUnderline ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Underline (Ctrl+U)"
        >
          <Underline className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={isStrikethrough ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={isCode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Inline Code"
        >
          <Code className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        <Button
          type="button"
          variant={blockType === "bullet" ? "secondary" : "ghost"}
          size="sm"
          onClick={formatBulletList}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Bulleted List"
        >
          <ListIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={blockType === "number" ? "secondary" : "ghost"}
          size="sm"
          onClick={formatNumberedList}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={blockType === "quote" ? "secondary" : "ghost"}
          size="sm"
          onClick={formatQuote}
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Quote Block"
        >
          <QuoteIcon className="size-3.5" />
        </Button>

        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={isLink ? "secondary" : "ghost"}
              size="sm"
              disabled={isSourceMode}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Insert / Edit Link"
            >
              <LinkIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-2" align="start">
            <div className="text-xs font-semibold text-foreground">Insert Link URL</div>
            <div className="flex gap-1.5">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={applyLink} className="h-8 px-3 text-xs">
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border/80 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left" as ElementFormatType)
          }
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Align Left"
        >
          <AlignLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center" as ElementFormatType)
          }
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Align Center"
        >
          <AlignCenter className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right" as ElementFormatType)
          }
          disabled={isSourceMode}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Align Right"
        >
          <AlignRight className="size-3.5" />
        </Button>

        {showIconPicker && (
          <>
            <div className="h-4 w-px bg-border/80 mx-1" />
            <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs text-primary hover:text-primary/90 font-medium"
                  title="Insert Icon Tag"
                >
                  <Smile className="size-3.5" />
                  <span>Icon</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    placeholder="Search icons..."
                    value={iconFilter}
                    onChange={(e) => setIconFilter(e.target.value)}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1 pr-1">
                    {filteredIcons.map((item) => {
                      const IconCmp = item.icon;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            onInsertText(`[icon:${item.name}] `);
                            setIconPopoverOpen(false);
                            setIconFilter("");
                          }}
                          className="flex items-center gap-1.5 p-1.5 rounded hover:bg-accent text-left text-xs cursor-pointer text-foreground"
                        >
                          <IconCmp className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {allowSourceToggle && (
          <Button
            type="button"
            variant={isSourceMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsSourceMode((prev) => !prev)}
            className="h-7 px-2 gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            title={
              isSourceMode ? "Switch to Visual WYSIWYG" : `Edit Raw ${mode.toUpperCase()} Code`
            }
          >
            {isSourceMode ? (
              <>
                <Eye className="size-3" />
                <span>Visual</span>
              </>
            ) : (
              <>
                <Code2 className="size-3" />
                <span>{mode.toUpperCase()}</span>
              </>
            )}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsFullScreen((prev) => !prev)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
        >
          {isFullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function LexicalRichEditor({
  id,
  value,
  onChange,
  placeholder = "Write your content here...",
  mode = "markdown",
  minHeight = "160px",
  maxHeight = "500px",
  className = "",
  disabled = false,
  allowSourceToggle = true,
  showIconPicker = true,
}: LexicalRichEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [rawText, setRawText] = useState(value);
  const editorRef = useRef<LexicalEditor | null>(null);
  const lastEmittedValueRef = useRef<string | null>(value);

  useEffect(() => {
    setRawText(value);
  }, [value]);

  const initialConfig = {
    namespace: id || "LexicalEditor",
    theme: lexicalTheme,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      CodeNode,
      CodeHighlightNode,
    ],
    onError(error: Error) {
      console.error("Lexical error:", error);
    },
  };

  const handleEditorChange = (editorState: any, editor: LexicalEditor) => {
    editorRef.current = editor;
    editorState.read(() => {
      let output = "";
      if (mode === "html") {
        output = $generateHtmlFromNodes(editor);
      } else if (mode === "markdown") {
        output = $convertToMarkdownString(TRANSFORMERS);
      } else {
        const root = $getRoot();
        output = root.getTextContent();
      }

      lastEmittedValueRef.current = output;
      setRawText(output);
      onChange(output);
    });
  };

  const handleInsertText = (textToInsert: string) => {
    if (isSourceMode) {
      const next = rawText + textToInsert;
      lastEmittedValueRef.current = next;
      setRawText(next);
      onChange(next);
      return;
    }

    if (editorRef.current) {
      editorRef.current.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(textToInsert);
        } else {
          const root = $getRoot();
          const p = $createParagraphNode();
          p.append($createParagraphNode());
          root.append(p);
        }
      });
    }
  };

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    lastEmittedValueRef.current = val;
    setRawText(val);
    onChange(val);

    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        root.clear();
        if (!val) return;
        if (mode === "markdown") {
          $convertFromMarkdownString(val, TRANSFORMERS);
        } else if (mode === "html") {
          const parser = new DOMParser();
          const dom = parser.parseFromString(val, "text/html");
          const nodes = $generateNodesFromDOM(editorRef.current!, dom);
          root.append(...nodes);
        }
      });
    }
  };

  const wordCount = rawText ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = rawText.length;

  return (
    <div
      className={cn(
        "flex flex-col border rounded-lg bg-card text-card-foreground shadow-xs transition-all",
        isFullScreen
          ? "fixed inset-4 z-50 bg-background shadow-2xl border-primary/40 flex flex-col"
          : "relative",
        className,
      )}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <ValueSyncPlugin
          value={value}
          mode={mode}
          isSourceMode={isSourceMode}
          lastEmittedValueRef={lastEmittedValueRef}
        />

        <EditorToolbar
          mode={mode}
          isSourceMode={isSourceMode}
          setIsSourceMode={setIsSourceMode}
          isFullScreen={isFullScreen}
          setIsFullScreen={setIsFullScreen}
          showIconPicker={showIconPicker}
          allowSourceToggle={allowSourceToggle}
          onInsertText={handleInsertText}
        />

        <div className="relative flex-1">
          {isSourceMode ? (
            <textarea
              id={id}
              value={rawText}
              onChange={handleRawChange}
              disabled={disabled}
              placeholder={placeholder}
              className="w-full h-full p-3.5 bg-background font-mono text-xs text-foreground focus:outline-none resize-y rounded-b-lg border-none leading-relaxed"
              style={{
                minHeight: isFullScreen ? "calc(100vh - 140px)" : minHeight,
                maxHeight: isFullScreen ? "none" : maxHeight,
              }}
            />
          ) : (
            <div
              className="relative p-3.5 overflow-y-auto cursor-text rounded-b-lg focus-within:ring-1 focus-within:ring-primary/40"
              style={{
                minHeight: isFullScreen ? "calc(100vh - 140px)" : minHeight,
                maxHeight: isFullScreen ? "none" : maxHeight,
              }}
            >
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    id={id}
                    className="outline-none min-h-full prose prose-sm dark:prose-invert max-w-none focus:outline-none"
                  />
                }
                placeholder={
                  <div className="absolute top-3.5 left-3.5 text-xs text-muted-foreground pointer-events-none select-none">
                    {placeholder}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin />
              <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
              <OnChangePlugin onChange={handleEditorChange} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-t text-[11px] text-muted-foreground select-none">
          <span className="flex items-center gap-2">
            <span className="capitalize font-medium text-foreground/80">
              {`Lexical • ${mode === "markdown" ? "Markdown Mode" : mode === "html" ? "HTML Mode" : "Rich Text"}`}
            </span>
            {isSourceMode && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono text-[10px]">
                Raw Code
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span>
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
            <span>•</span>
            <span>
              {charCount} {charCount === 1 ? "character" : "characters"}
            </span>
          </span>
        </div>
      </LexicalComposer>
    </div>
  );
}
