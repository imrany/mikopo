import React, { useState, useEffect, useRef } from "react";
import { Edit2, Check, X } from "lucide-react";
import {
  IconAutocompleteTextarea,
  IconAutocompleteInput,
} from "@/components/icon-autocomplete-editor";

interface EditableLandingTextProps {
  id: string;
  defaultText: string;
  contentMap: Record<string, string>;
  onChange: (id: string, text: string) => void;
  isStaff: boolean;
  multiline?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
}

export function EditableLandingText({
  id,
  defaultText,
  contentMap,
  onChange,
  isStaff,
  multiline = false,
  className = "",
  as: Component = "span",
}: EditableLandingTextProps) {
  const currentText = contentMap[id] ?? defaultText;
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(currentText);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(contentMap[id] ?? defaultText);
  }, [contentMap, id, defaultText]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (
        inputRef.current instanceof HTMLInputElement ||
        inputRef.current instanceof HTMLTextAreaElement
      ) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  if (!isStaff) {
    return <Component className={className}>{currentText}</Component>;
  }

  const handleSave = () => {
    setIsEditing(false);
    if (val !== currentText) {
      onChange(id, val);
    }
  };

  const handleCancel = () => {
    setVal(currentText);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="relative inline-block w-full my-1 z-30">
        {multiline ? (
          <IconAutocompleteTextarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={val}
            onValueChange={setVal}
            onKeyDown={handleKeyDown}
            showToolbar={false}
            className={`w-full p-2 rounded border-2 border-gold bg-background text-foreground shadow-lg focus:outline-hidden font-sans text-sm leading-relaxed ${className}`}
            rows={3}
          />
        ) : (
          <IconAutocompleteInput
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={val}
            onValueChange={setVal}
            onKeyDown={handleKeyDown}
            className={`w-full p-2 rounded border-2 border-gold bg-background text-foreground shadow-lg focus:outline-hidden font-sans ${className}`}
          />
        )}
        <div className="flex items-center gap-1.5 mt-1 justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-semibold flex items-center gap-1 hover:bg-primary/90 shadow-xs"
          >
            <Check className="size-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-medium flex items-center gap-1 hover:bg-muted/80"
          >
            <X className="size-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Component
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to edit text directly"
      className={`relative group/edit cursor-pointer transition-all rounded px-1 -mx-1 border border-transparent hover:border-gold/60 hover:bg-gold/10 hover:shadow-xs inline-block ${className}`}
    >
      {currentText}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1.5 p-0.5 rounded bg-gold text-white text-[10px] inline-flex items-center gap-0.5 align-middle shadow-xs hover:scale-105"
        title="Edit text"
      >
        <Edit2 className="size-3" />
        <span className="sr-only">Edit</span>
      </button>
    </Component>
  );
}
