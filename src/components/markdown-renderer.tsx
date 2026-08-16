import React from "react";
import Markdown from "react-markdown";
import {
  Shield,
  Lock,
  Eye,
  FileText,
  UserCheck,
  CheckCircle2,
  DollarSign,
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  Building2,
  PhoneCall,
  Mail,
  HelpCircle,
  Clock,
  Sparkles,
  Scale,
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
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  shield: Shield,
  lock: Lock,
  eye: Eye,
  "file-text": FileText,
  filetext: FileText,
  "user-check": UserCheck,
  usercheck: UserCheck,
  "check-circle": CheckCircle2,
  checkcircle: CheckCircle2,
  "dollar-sign": DollarSign,
  dollarsign: DollarSign,
  "book-open": BookOpen,
  bookopen: BookOpen,
  "shield-alert": ShieldAlert,
  shieldalert: ShieldAlert,
  "alert-triangle": AlertTriangle,
  alerttriangle: AlertTriangle,
  building: Building2,
  building2: Building2,
  phone: PhoneCall,
  "phone-call": PhoneCall,
  phonecall: PhoneCall,
  mail: Mail,
  help: HelpCircle,
  "help-circle": HelpCircle,
  helpcircle: HelpCircle,
  clock: Clock,
  sparkles: Sparkles,
  scale: Scale,
  info: Info,
  check: Check,
  user: User,
  users: Users,
  award: Award,
  star: Star,
  heart: Heart,
  "trending-up": TrendingUp,
  trendingup: TrendingUp,
  percent: Percent,
  calculator: Calculator,
  banknote: Banknote,
  briefcase: Briefcase,
  globe: Globe,
  "credit-card": CreditCard,
  creditcard: CreditCard,
  "pie-chart": PieChart,
  piechart: PieChart,
  calendar: Calendar,
  bell: Bell,
  key: Key,
  zap: Zap,
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`markdown-body space-y-4 text-sm leading-relaxed ${className}`}>
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold tracking-tight text-foreground border-b border-border/60 pb-2 mt-6 mb-3 flex flex-wrap items-center gap-2 font-display">
              {renderWithIcons(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold tracking-tight text-foreground border-b border-border/40 pb-1 mt-5 mb-2 flex flex-wrap items-center gap-2 font-display">
              {renderWithIcons(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-foreground mt-4 mb-2 flex flex-wrap items-center gap-2 font-display">
              {renderWithIcons(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-foreground mt-3 mb-1 flex flex-wrap items-center gap-2 font-display">
              {renderWithIcons(children)}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-muted-foreground leading-relaxed my-2">
              {renderWithIcons(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-2 text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-2 text-muted-foreground">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{renderWithIcons(children)}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/60 bg-primary/5 p-3 rounded-r-lg my-3 italic text-foreground/90 text-xs">
              {renderWithIcons(children)}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary font-semibold">
              {children}
            </code>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{renderWithIcons(children)}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/90">{renderWithIcons(children)}</em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary underline underline-offset-4 hover:text-primary/80 font-medium"
            >
              {renderWithIcons(children)}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function renderWithIcons(node: React.ReactNode): React.ReactNode {
  if (node === null || node === undefined || typeof node === "boolean") {
    return node;
  }

  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    const parts = text.split(/(\[icon:[a-z0-9-]+\])/gi);
    if (parts.length === 1) return node;

    return parts.map((part, index) => {
      const match = part.match(/^\[icon:([a-z0-9-]+)\]$/i);
      if (match && match[1]) {
        const rawKey = match[1].toLowerCase();
        const normalizedKey = rawKey.replace(/[-_]/g, "");
        const IconComp = ICON_MAP[rawKey] || ICON_MAP[normalizedKey] || Shield;
        return (
          <span
            key={index}
            className="inline-flex items-center justify-center p-1 rounded-md bg-primary/10 text-primary align-middle mx-1 shrink-0"
          >
            <IconComp className="h-4 w-4 inline-block" />
          </span>
        );
      }
      return part;
    });
  }

  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{renderWithIcons(child)}</React.Fragment>
    ));
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (element.props && element.props.children) {
      return React.cloneElement(
        element,
        { ...element.props },
        renderWithIcons(element.props.children),
      );
    }
  }

  return node;
}
