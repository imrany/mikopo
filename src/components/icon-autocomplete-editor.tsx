import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Shield,
  Lock,
  Eye,
  FileText,
  UserCheck,
  CheckCircle2,
  DollarSign,
  Scale,
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  Building2,
  PhoneCall,
  Mail,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  Check,
  User,
  Users,
  Award,
  Star,
  Heart,
  TrendingUp,
  Percent,
  Calculator,
  Banknote,
  Briefcase,
  Globe,
  CreditCard,
  PieChart,
  Calendar,
  Bell,
  Key,
  Zap,
  Smile,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface IconItem {
  name: string;
  label: string;
  icon: LucideIcon;
}

export const SUPPORTED_ICONS: IconItem[] = [
  { name: "shield", label: "Shield / Security", icon: Shield },
  { name: "lock", label: "Lock / Privacy", icon: Lock },
  { name: "eye", label: "Eye / View", icon: Eye },
  { name: "file-text", label: "File Document", icon: FileText },
  { name: "user-check", label: "User Verified", icon: UserCheck },
  { name: "check-circle", label: "Checkmark Circle", icon: CheckCircle2 },
  { name: "dollar-sign", label: "Dollar / Finance", icon: DollarSign },
  { name: "scale", label: "Scale / Legal & Terms", icon: Scale },
  { name: "book-open", label: "Book / Manual", icon: BookOpen },
  { name: "shield-alert", label: "Shield Alert", icon: ShieldAlert },
  { name: "alert-triangle", label: "Warning / Alert", icon: AlertTriangle },
  { name: "building", label: "Building / Business", icon: Building2 },
  { name: "phone", label: "Phone / Support", icon: PhoneCall },
  { name: "mail", label: "Email / Contact", icon: Mail },
  { name: "help", label: "Help / FAQ", icon: HelpCircle },
  { name: "clock", label: "Clock / Time", icon: Clock },
  { name: "sparkles", label: "Sparkles / AI", icon: Sparkles },
  { name: "info", label: "Info / Details", icon: Info },
  { name: "check", label: "Checkmark", icon: Check },
  { name: "user", label: "User Account", icon: User },
  { name: "users", label: "Users / Community", icon: Users },
  { name: "award", label: "Award / Credibility", icon: Award },
  { name: "star", label: "Star / Rating", icon: Star },
  { name: "heart", label: "Heart / Favorites", icon: Heart },
  { name: "trending-up", label: "Trending / Growth", icon: TrendingUp },
  { name: "percent", label: "Percent / Rates", icon: Percent },
  { name: "calculator", label: "Calculator", icon: Calculator },
  { name: "banknote", label: "Banknote / Money", icon: Banknote },
  { name: "briefcase", label: "Briefcase / Business", icon: Briefcase },
  { name: "globe", label: "Globe / Public", icon: Globe },
  { name: "credit-card", label: "Credit Card", icon: CreditCard },
  { name: "pie-chart", label: "Pie Chart", icon: PieChart },
  { name: "calendar", label: "Calendar", icon: Calendar },
  { name: "bell", label: "Bell / Alert", icon: Bell },
  { name: "key", label: "Key / Access", icon: Key },
  { name: "zap", label: "Zap / Fast", icon: Zap },
];

export function getIconComponent(name: string): LucideIcon {
  const clean = name.toLowerCase().replace(/[-_]/g, "");
  const found = SUPPORTED_ICONS.find(
    (item) => item.name === name || item.name.replace(/[-_]/g, "") === clean,
  );
  return found ? found.icon : Shield;
}

interface IconAutocompleteTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
  showToolbar?: boolean;
}

export const IconAutocompleteTextarea = React.forwardRef<
  HTMLTextAreaElement,
  IconAutocompleteTextareaProps
>(({ value, onValueChange, showToolbar = true, className = "", rows = 12, ...props }, ref) => {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matchRange, setMatchRange] = useState<{ start: number; end: number } | null>(null);

  const filteredIcons = SUPPORTED_ICONS.filter(
    (item) =>
      item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.label.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  const checkCursorForIconTrigger = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const cursorPos = el.selectionStart;
    const textBefore = value.slice(0, cursorPos);

    // Look for last unclosed [icon: query before cursor
    const match = textBefore.match(/\[icon:([a-zA-Z0-9_-]*)$/i);
    if (match) {
      const query = match[1];
      const matchStart = cursorPos - match[0].length;
      setFilterQuery(query);
      setMatchRange({ start: matchStart, end: cursorPos });
      setSelectedIndex(0);
      setAutocompleteOpen(true);
    } else {
      setAutocompleteOpen(false);
      setMatchRange(null);
    }
  }, [value, textareaRef]);

  const insertIconTag = (iconName: string) => {
    const el = textareaRef.current;
    const tag = `[icon:${iconName}]`;

    if (matchRange) {
      const newValue = value.slice(0, matchRange.start) + tag + value.slice(matchRange.end);
      onValueChange(newValue);
      setAutocompleteOpen(false);
      setMatchRange(null);

      setTimeout(() => {
        if (el) {
          const newPos = matchRange.start + tag.length;
          el.focus();
          el.setSelectionRange(newPos, newPos);
        }
      }, 10);
    } else if (el) {
      const pos = el.selectionStart || value.length;
      const newValue = value.slice(0, pos) + tag + value.slice(pos);
      onValueChange(newValue);

      setTimeout(() => {
        const newPos = pos + tag.length;
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }, 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocompleteOpen && filteredIcons.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredIcons.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredIcons.length) % filteredIcons.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertIconTag(filteredIcons[selectedIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setAutocompleteOpen(false);
        return;
      }
    }

    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(e.target.value);
  };

  useEffect(() => {
    checkCursorForIconTrigger();
  }, [value, checkCursorForIconTrigger]);

  return (
    <div className="relative w-full space-y-1.5">
      {/* Icon Selector Quick Bar */}
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-muted/40 border rounded-t-lg text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Smile className="size-3.5 text-gold" />
            <span>
              Type{" "}
              <code className="bg-background px-1 py-0.5 rounded border text-[11px] font-mono text-foreground">
                [icon:
              </code>{" "}
              for icon suggestions or press{" "}
              <kbd className="bg-background px-1 border rounded text-[10px] font-mono text-foreground">
                Tab
              </kbd>
            </span>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px] px-2 gap-1 border-gold/40 hover:bg-gold/10"
              >
                <Sparkles className="size-3 text-gold" />
                Insert Icon Tag
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2 max-h-64 overflow-y-auto">
              <div className="text-[11px] font-semibold text-muted-foreground px-1 pb-1 mb-1 border-b">
                Click any icon to insert tag:
              </div>
              <div className="grid grid-cols-2 gap-1">
                {SUPPORTED_ICONS.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => insertIconTag(item.name)}
                      className="flex items-center gap-2 p-1.5 rounded text-xs text-left hover:bg-accent transition-colors group"
                    >
                      <span className="p-1 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <IconComp className="size-3.5" />
                      </span>
                      <div className="truncate">
                        <div className="font-mono text-[11px] font-semibold text-foreground">
                          {item.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Main Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyUp={checkCursorForIconTrigger}
        onClick={checkCursorForIconTrigger}
        onKeyDown={handleKeyDown}
        rows={rows}
        className={`w-full p-3 rounded-b-lg border bg-background text-foreground text-xs font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-gold/50 transition-all ${className}`}
        {...props}
      />

      {/* Autocomplete Suggestion Popup */}
      {autocompleteOpen && (
        <div className="absolute left-2 bottom-full mb-1 z-50 w-72 bg-popover border-2 border-gold text-popover-foreground rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="bg-gold/20 px-3 py-1.5 text-[11px] font-semibold text-gold-foreground flex items-center justify-between border-b border-gold/30">
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" /> Lucide Icon Autocomplete
            </span>
            <span className="text-[10px] opacity-80 font-mono">Press Tab ↹ or Enter ↵</span>
          </div>

          <div className="max-h-52 overflow-y-auto p-1 divide-y divide-border/40">
            {filteredIcons.length > 0 ? (
              filteredIcons.map((item, index) => {
                const IconComp = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => insertIconTag(item.name)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded text-xs transition-colors text-left ${
                      isSelected
                        ? "bg-gold text-gold-foreground font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span
                      className={`p-1.5 rounded ${
                        isSelected ? "bg-black/20 text-white" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <IconComp className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold flex items-center gap-1">
                        <span>[icon:{item.name}]</span>
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? "text-gold-foreground/90" : "text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching icon found for &quot;{filterQuery}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
IconAutocompleteTextarea.displayName = "IconAutocompleteTextarea";

/* Input version for single-line editable text */
interface IconAutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (val: string) => void;
}

export const IconAutocompleteInput = React.forwardRef<HTMLInputElement, IconAutocompleteInputProps>(
  ({ value, onValueChange, className = "", ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    const [autocompleteOpen, setAutocompleteOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [matchRange, setMatchRange] = useState<{ start: number; end: number } | null>(null);

    const filteredIcons = SUPPORTED_ICONS.filter(
      (item) =>
        item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        item.label.toLowerCase().includes(filterQuery.toLowerCase()),
    );

    const checkCursorForIconTrigger = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart || 0;
      const textBefore = value.slice(0, cursorPos);

      const match = textBefore.match(/\[icon:([a-zA-Z0-9_-]*)$/i);
      if (match) {
        const query = match[1];
        const matchStart = cursorPos - match[0].length;
        setFilterQuery(query);
        setMatchRange({ start: matchStart, end: cursorPos });
        setSelectedIndex(0);
        setAutocompleteOpen(true);
      } else {
        setAutocompleteOpen(false);
        setMatchRange(null);
      }
    }, [value, inputRef]);

    const insertIconTag = (iconName: string) => {
      const el = inputRef.current;
      const tag = `[icon:${iconName}]`;

      if (matchRange) {
        const newValue = value.slice(0, matchRange.start) + tag + value.slice(matchRange.end);
        onValueChange(newValue);
        setAutocompleteOpen(false);
        setMatchRange(null);

        setTimeout(() => {
          if (el) {
            const newPos = matchRange.start + tag.length;
            el.focus();
            el.setSelectionRange(newPos, newPos);
          }
        }, 10);
      } else if (el) {
        const pos = el.selectionStart || value.length;
        const newValue = value.slice(0, pos) + tag + value.slice(pos);
        onValueChange(newValue);

        setTimeout(() => {
          const newPos = pos + tag.length;
          el.focus();
          el.setSelectionRange(newPos, newPos);
        }, 10);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (autocompleteOpen && filteredIcons.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredIcons.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredIcons.length) % filteredIcons.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          insertIconTag(filteredIcons[selectedIndex].name);
          return;
        }
        if (e.key === "Escape") {
          setAutocompleteOpen(false);
          return;
        }
      }

      if (props.onKeyDown) {
        props.onKeyDown(e);
      }
    };

    useEffect(() => {
      checkCursorForIconTrigger();
    }, [value, checkCursorForIconTrigger]);

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyUp={checkCursorForIconTrigger}
          onClick={checkCursorForIconTrigger}
          onKeyDown={handleKeyDown}
          className={className}
          {...props}
        />

        {/* Autocomplete Popup */}
        {autocompleteOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-popover border-2 border-gold text-popover-foreground rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-gold/20 px-3 py-1.5 text-[11px] font-semibold text-gold-foreground flex items-center justify-between border-b border-gold/30">
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" /> Icon Autocomplete
              </span>
              <span className="text-[10px] opacity-80 font-mono">Tab ↹ or Enter ↵</span>
            </div>

            <div className="max-h-48 overflow-y-auto p-1 divide-y divide-border/40">
              {filteredIcons.length > 0 ? (
                filteredIcons.map((item, index) => {
                  const IconComp = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => insertIconTag(item.name)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-2.5 p-1.5 rounded text-xs transition-colors text-left ${
                        isSelected
                          ? "bg-gold text-gold-foreground font-semibold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span
                        className={`p-1 rounded ${
                          isSelected ? "bg-black/20 text-white" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <IconComp className="size-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-bold truncate">
                          [icon:{item.name}]
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  No icon matching &quot;{filterQuery}&quot;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
IconAutocompleteInput.displayName = "IconAutocompleteInput";
