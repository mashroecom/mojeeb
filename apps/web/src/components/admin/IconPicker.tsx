'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import {
  MessageSquare,
  Heart,
  GitBranch,
  UserCheck,
  BarChart3,
  Clock,
  Bot,
  Shield,
  Zap,
  Globe,
  Lock,
  Star,
  Settings,
  Users,
  Bell,
  Mail,
  Phone,
  Camera,
  Image,
  FileText,
  Folder,
  Database,
  Cloud,
  Wifi,
  Monitor,
  Smartphone,
  Headphones,
  Mic,
  Video,
  Play,
  Music,
  Map,
  Navigation,
  Compass,
  Target,
  Award,
  Trophy,
  Gift,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  PieChart,
  Activity,
  Cpu,
  Code,
  Terminal,
  Layers,
  Layout,
  Grid,
  Palette,
  Brush,
  Pen,
  Bookmark,
  Tag,
  Hash,
  Link,
  Paperclip,
  Send,
  Inbox,
  Archive,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Sparkles,
  Rocket,
  Flame,
  Lightbulb,
  Key,
  Fingerprint,
  QrCode,
  Wifi as WifiIcon,
  Radio,
  Rss,
  Share2,
  ThumbsUp,
  MessageCircle,
  AtSign,
  Calendar,
  AlarmClock,
  Timer,
  Repeat,
  RefreshCw,
  RotateCw,
  Download,
  Upload,
  ExternalLink,
  Maximize,
  Minimize,
  Copy,
  Scissors,
  Wand2,
  Puzzle,
  BookOpen,
  GraduationCap,
  Building2,
  Home,
  MapPin,
  Briefcase,
  Truck,
  Package,
  type LucideIcon,
} from 'lucide-react';

// Curated icon set with display names
const ICON_ENTRIES: { name: string; icon: LucideIcon }[] = [
  { name: 'MessageSquare', icon: MessageSquare },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Heart', icon: Heart },
  { name: 'GitBranch', icon: GitBranch },
  { name: 'UserCheck', icon: UserCheck },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Clock', icon: Clock },
  { name: 'Bot', icon: Bot },
  { name: 'Shield', icon: Shield },
  { name: 'Zap', icon: Zap },
  { name: 'Globe', icon: Globe },
  { name: 'Lock', icon: Lock },
  { name: 'Star', icon: Star },
  { name: 'Settings', icon: Settings },
  { name: 'Users', icon: Users },
  { name: 'Bell', icon: Bell },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Camera', icon: Camera },
  { name: 'Image', icon: Image },
  { name: 'FileText', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Database', icon: Database },
  { name: 'Cloud', icon: Cloud },
  { name: 'Wifi', icon: Wifi },
  { name: 'Monitor', icon: Monitor },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Headphones', icon: Headphones },
  { name: 'Mic', icon: Mic },
  { name: 'Video', icon: Video },
  { name: 'Play', icon: Play },
  { name: 'Music', icon: Music },
  { name: 'Map', icon: Map },
  { name: 'Navigation', icon: Navigation },
  { name: 'Compass', icon: Compass },
  { name: 'Target', icon: Target },
  { name: 'Award', icon: Award },
  { name: 'Trophy', icon: Trophy },
  { name: 'Gift', icon: Gift },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'PieChart', icon: PieChart },
  { name: 'Activity', icon: Activity },
  { name: 'Cpu', icon: Cpu },
  { name: 'Code', icon: Code },
  { name: 'Terminal', icon: Terminal },
  { name: 'Layers', icon: Layers },
  { name: 'Layout', icon: Layout },
  { name: 'Grid', icon: Grid },
  { name: 'Palette', icon: Palette },
  { name: 'Brush', icon: Brush },
  { name: 'Pen', icon: Pen },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Tag', icon: Tag },
  { name: 'Hash', icon: Hash },
  { name: 'Link', icon: Link },
  { name: 'Paperclip', icon: Paperclip },
  { name: 'Send', icon: Send },
  { name: 'Inbox', icon: Inbox },
  { name: 'Archive', icon: Archive },
  { name: 'Trash2', icon: Trash2 },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'AlertTriangle', icon: AlertTriangle },
  { name: 'Info', icon: Info },
  { name: 'HelpCircle', icon: HelpCircle },
  { name: 'Eye', icon: Eye },
  { name: 'EyeOff', icon: EyeOff },
  { name: 'Sun', icon: Sun },
  { name: 'Moon', icon: Moon },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Rocket', icon: Rocket },
  { name: 'Flame', icon: Flame },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Key', icon: Key },
  { name: 'Fingerprint', icon: Fingerprint },
  { name: 'QrCode', icon: QrCode },
  { name: 'Radio', icon: Radio },
  { name: 'Rss', icon: Rss },
  { name: 'Share2', icon: Share2 },
  { name: 'ThumbsUp', icon: ThumbsUp },
  { name: 'AtSign', icon: AtSign },
  { name: 'Calendar', icon: Calendar },
  { name: 'AlarmClock', icon: AlarmClock },
  { name: 'Timer', icon: Timer },
  { name: 'Repeat', icon: Repeat },
  { name: 'RefreshCw', icon: RefreshCw },
  { name: 'RotateCw', icon: RotateCw },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'ExternalLink', icon: ExternalLink },
  { name: 'Maximize', icon: Maximize },
  { name: 'Minimize', icon: Minimize },
  { name: 'Copy', icon: Copy },
  { name: 'Scissors', icon: Scissors },
  { name: 'Wand2', icon: Wand2 },
  { name: 'Puzzle', icon: Puzzle },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Building2', icon: Building2 },
  { name: 'Home', icon: Home },
  { name: 'MapPin', icon: MapPin },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Truck', icon: Truck },
  { name: 'Package', icon: Package },
];

// Export the icon map for use in FeaturesSection
export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_ENTRIES.map((e) => [e.name, e.icon]),
);

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return ICON_ENTRIES;
    const q = search.toLowerCase();
    return ICON_ENTRIES.filter((e) => e.name.toLowerCase().includes(q));
  }, [search]);

  const SelectedIcon = ICON_MAP[value] || null;

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={cn(
          'mt-1 w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm outline-none hover:bg-muted/50 transition-colors text-start focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          open && 'ring-2 ring-primary/40 border-primary',
        )}
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{value}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select icon...</span>
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="ms-auto shrink-0 rounded p-0.5 hover:bg-muted"
            aria-label="Clear icon"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-lg border bg-card shadow-lg">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                autoFocus
                className="w-full rounded-lg border bg-background ps-8 pe-3 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {/* Icon grid */}
          <div className="p-2 max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                No icons found
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {filtered.map((entry) => {
                  const Icon = entry.icon;
                  const isSelected = value === entry.name;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      title={entry.name}
                      onClick={() => { onChange(entry.name); setOpen(false); }}
                      className={cn(
                        'flex items-center justify-center rounded-lg p-2 transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
