import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  Hash,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  X,
  Trash2,
  Menu,
  Check,
  CheckCheck,
  CornerUpLeft,
  Download,
  Users,
  Image as ImageIcon,
  Mic,
  Play,
  Pause,
  BarChart2,
  Maximize2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  AlertCircle,
  Copy,
  Star,
  Pin,
  Share2,
  Info,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  UserPlus,
  FileText,
  Bell,
  BellOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { api, getAuthToken } from "@/lib/api";
import { getApiUrl, resolveApiUrl } from "@/lib/config";
import { WhatsAppEmojiPicker } from "./WhatsAppEmojiPicker";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export interface PollOption {
  id: string;
  text: string;
  voters: string[];
  voter_details?: Array<{ id: string; name: string; avatar?: string; time?: string }>;
  voters_count?: number;
  user_has_voted?: boolean;
}

export interface PollData {
  question: string;
  allow_multiple_answers: boolean;
  hide_voters_name: boolean;
  created_by: string;
  options: PollOption[];
}

export interface ReplyPreview {
  id: string;
  message_id?: string | undefined;
  sender_name: string;
  sender_id?: string | undefined;
  content: string;
  media_type?: string | null | undefined;
  message_type?: string | null | undefined;
  media_url?: string | null | undefined;
  file_name?: string | null | undefined;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null | undefined;
  content: string;
  media_url?: string | null | undefined;
  media_type?: "image" | "video" | "audio" | "document" | null | undefined;
  file_name?: string | null | undefined;
  file_size?: number | null | undefined;
  group_id?: string | null | undefined;
  is_forwarded?: boolean | undefined;
  reply_to?: ReplyPreview | null | undefined;
  reactions: Record<string, string[]>;
  read_by: string[];
  is_read_by?: any[];
  is_pinned?: boolean | undefined;
  poll?: PollData | null | undefined;
  created_at: string;
  isMe?: boolean | undefined;
}

export interface ChatChannel {
  id: string;
  _id?: string | undefined;
  name: string;
  type?: string | undefined;
  description?: string | null | undefined;
  is_dm?: boolean | undefined;
  members: string[];
  created_by?: string | undefined;
  created_at?: string | undefined;
  unread_count?: number | undefined;
  auto_join_new_employees?: boolean | undefined;
  other_user?: {
    id: string;
    name: string;
    avatar?: string | null | undefined;
    email?: string | undefined;
    is_online?: boolean | undefined;
  } | undefined;
}

// --- HELPER: Resolve Media URL ---
export const getMediaUrl = (url?: string | null): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  const apiUrl = resolveApiUrl();
  return `${apiUrl}${cleanPath}`;
};

// --- HELPER: Normalize Reactions ---
export const normalizeReactions = (reactions: any): Record<string, string[]> => {
  if (!reactions) return {};
  const map: Record<string, string[]> = {};
  if (Array.isArray(reactions)) {
    reactions.forEach((r: any) => {
      if (r && r.emoji) {
        map[r.emoji] = Array.isArray(r.users) ? r.users.map(String) : [];
      }
    });
    return map;
  }
  if (typeof reactions === "object") {
    Object.entries(reactions).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        map[k] = v.map(String);
      } else if (v && typeof v === "object" && Array.isArray((v as any).users)) {
        map[(v as any).emoji || k] = (v as any).users.map(String);
      }
    });
    return map;
  }
  return {};
};

const COMMON_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳",
  "😭", "😡", "😱", "🤔", "😐", "🙄", "😴", "🤯", "🥺", "😳",
  "👍", "👎", "👏", "🙏", "💪", "👋", "✌️", "🤝", "👌", "🫶",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯",
  "🔥", "🎉", "🎊", "✅", "❌", "⭐", "✨", "💡", "🎯", "🏆",
  "😮", "😢", "🙌", "👀", "💤", "🤞", "🤟", "🫡", "😇", "🤠"
];

// --- USER AVATAR HELPER ---
const UserAvatar = ({
  name,
  avatar,
  size = "w-8 h-8",
  isOnline = false,
  showStatus = false,
  className = ""
}: {
  name?: string | null | undefined;
  avatar?: string | null | undefined;
  size?: string | undefined;
  isOnline?: boolean | undefined;
  showStatus?: boolean | undefined;
  className?: string | undefined;
}) => {
  const [imgError, setImgError] = useState(false);
  const cleanedName = typeof name === "string" ? name.replace(/\s*\([^)]*\)/g, "").trim() : "";
  const safeName = cleanedName || (typeof name === "string" && name.trim() ? name : "User");
  const initials = safeName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const colors = [
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
  ];
  const charCode = safeName.charCodeAt(0) + safeName.length;
  const colorClass = colors[charCode % colors.length];

  const hasValidSrc = Boolean(avatar && typeof avatar === "string" && avatar.trim() !== "" && !imgError);

  return (
    <div className={cn("relative shrink-0 select-none", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden flex items-center justify-center font-bold text-xs border",
          size,
          colorClass
        )}
      >
        {hasValidSrc ? (
          <img
            src={avatar || undefined}
            alt={safeName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-card",
            isOnline ? "bg-emerald-500" : "bg-neutral-400"
          )}
        />
      )}
    </div>
  );
};

// --- WHATSAPP STYLE VOICE PLAYER (robust: works for webm/mp3/wav/ogg/m4a) ---
function VoicePlayer({
  audioUrl,
  isMe,
  fileName,
  onDownload
}: {
  audioUrl: string;
  isMe: boolean;
  fileName?: string | null | undefined;
  onDownload?: (url: string, name?: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [loadError, setLoadError] = useState(false);
  const src = getMediaUrl(audioUrl);

  const detectDuration = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setLoadError(false);

    let d = el.duration;
    if (isFinite(d) && !isNaN(d) && d > 0) {
      setDuration(d);
      return;
    }

    // WebM MediaRecorder Chrome bug: el.duration is Infinity for recorded webm audio.
    // Setting currentTime to a huge number forces Chrome to seek to the end and determine exact duration!
    if (d === Infinity || isNaN(d) || d === 0) {
      const prevTime = el.currentTime || 0;
      const handleSeeked = () => {
        el.removeEventListener("seeked", handleSeeked);
        const realD = el.duration;
        if (isFinite(realD) && !isNaN(realD) && realD > 0) {
          setDuration(realD);
        }
        el.currentTime = prevTime;
      };
      el.addEventListener("seeked", handleSeeked, { once: true });
      try {
        el.currentTime = 1e101;
      } catch {}
    }
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
  }, [src]);

  const togglePlay = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      try {
        el.pause();
      } catch {}
      setIsPlaying(false);
    } else {
      try {
        el.playbackRate = speed;
        const p = el.play();
        if (p && typeof (p as Promise<void>).then === "function") {
          (p as Promise<void>).then(() => setIsPlaying(true)).catch(() => setLoadError(true));
        } else {
          setIsPlaying(true);
        }
      } catch {
        setLoadError(true);
      }
    }
  };

  const handleSpeedChange = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatSec = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      className="flex items-center gap-2.5 p-1 rounded-xl min-w-[200px] sm:min-w-[240px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={detectDuration}
        onDurationChange={detectDuration}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const cur = el.currentTime || 0;
          setCurrentTime(cur);

          const realD = el.duration;
          if (isFinite(realD) && !isNaN(realD) && realD > 0) {
            setDuration(realD);
          } else if (cur > duration) {
            setDuration(cur);
          }
        }}
        onError={() => setLoadError(true)}
        onEnded={(e) => {
          setIsPlaying(false);
          setCurrentTime(0);
          const el = e.currentTarget;
          if (el.duration && isFinite(el.duration) && el.duration > 0) {
            setDuration(el.duration);
          }
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer",
          isMe ? "bg-white text-emerald-600" : "bg-emerald-600 text-white"
        )}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration && isFinite(duration) && duration > 0 ? duration : 1}
          step={0.1}
          value={currentTime}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setCurrentTime(val);
            if (audioRef.current) {
              try {
                audioRef.current.currentTime = val;
              } catch {}
            }
          }}
          className="w-full h-1.5 bg-foreground/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex items-center justify-between text-[10px] font-mono mt-0.5 opacity-80">
          <span>{formatSec(currentTime)}</span>
          <span>{formatSec(duration)}</span>
        </div>
        {loadError && (
          <div className="text-[10px] opacity-70 mt-0.5">
            Tap play to listen •{" "}
            <a href={src} target="_blank" rel="noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>
              Open / Download
            </a>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSpeedChange}
        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-foreground/10 hover:bg-foreground/20 transition-colors shrink-0 cursor-pointer"
        title="Playback Speed"
      >
        {speed}x
      </button>

      {onDownload && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(audioUrl, fileName || "voice-message.webm");
          }}
          className="p-1 rounded text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0 cursor-pointer"
          title="Download Audio (Save As)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// --- WHATSAPP STYLE REPLY QUOTE (unmissable: accent bar + sender + text + media thumb) ---
function ReplyQuote({
  reply,
  isMe,
  onNavigate
}: {
  reply: ReplyPreview;
  isMe: boolean;
  onNavigate: () => void;
}) {
  const rType = String(reply.media_type || reply.message_type || "").toLowerCase();
  const isImg = rType.includes("image") || (reply.media_url && /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(reply.media_url));
  const isVid = rType.includes("video") || (reply.media_url && /\.(mp4|mov|mkv|avi)(\?|$)/i.test(reply.media_url || ""));
  const label = reply.content && !/^\[.+?\]$/.test(reply.content.trim())
    ? reply.content
    : reply.media_type === "image" || isImg
    ? "📷 Photo"
    : reply.media_type === "video" || isVid
    ? "🎬 Video"
    : reply.media_type === "audio"
    ? "🎤 Voice message"
    : reply.media_type === "document" || reply.file_name
    ? `📄 ${reply.file_name || "Document"}`
    : reply.content || "Message";
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onNavigate();
      }}
      title={`Replied to ${reply.sender_name} — click to jump`}
      className={cn(
        "flex items-stretch gap-2 pl-2 pr-2 py-1.5 rounded-lg mb-2 cursor-pointer transition-opacity hover:opacity-85 text-left w-full border-l-4",
        isMe ? "bg-black/25 border-white/90" : "bg-emerald-500/10 border-emerald-500"
      )}
    >
      <div className="min-w-0 flex-1">
        <span className={cn("font-bold block text-[11px] leading-tight truncate", isMe ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400")}>
          {reply.sender_name}
        </span>
        <span className={cn("block text-[11px] leading-snug opacity-80 truncate", isMe ? "text-white" : "text-foreground")}>
          {label}
        </span>
      </div>
      {(isImg || isVid) && reply.media_url ? (
        <span className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-black/10 border border-black/10">
          {isVid ? (
            <video src={getMediaUrl(reply.media_url)} preload="metadata" className="w-full h-full object-cover" />
          ) : (
            <img src={getMediaUrl(reply.media_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
          )}
        </span>
      ) : null}
    </div>
  );
}

// --- MAIN CHAT CONTENT COMPONENT ---
function ChatInner() {
  const { user } = useAuth();
  const { employees } = useEmployeesContext();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileChannelsOpen, setIsMobileChannelsOpen] = useState(false);

  // WhatsApp Features State
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Lightbox Media Preview (WhatsApp style: index into channel media list)
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<"image" | "video" | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Forward / Copy
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);

  // PDF viewer
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>("document.pdf");

  // Clipboard Paste Modal
  const [pasteFile, setPasteFile] = useState<File | null>(null);
  const [pastePreviewUrl, setPastePreviewUrl] = useState<string | null>(null);
  const [pasteFiles, setPasteFiles] = useState<File[]>([]);
  const [pastePreviewUrls, setPastePreviewUrls] = useState<string[]>([]);
  const [pasteCaption, setPasteCaption] = useState("");
  const [activePasteIndex, setActivePasteIndex] = useState<number>(0);

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Modals & Popovers
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [isNewDmOpen, setIsNewDmOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // Channel Edit (creator only)
  const [isEditChannelOpen, setIsEditChannelOpen] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDesc, setEditChannelDesc] = useState("");
  const [editChannelMemberId, setEditChannelMemberId] = useState("");
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement | null>(null);

  // @ Mention State in Group chats (Issue 3)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(0);

  // Group Members Modal State (Issue 4)
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState("");

  // Channel Auto-Join Toggle State (Issue 5)
  const [newChannelAutoJoin, setNewChannelAutoJoin] = useState(false);
  const [editChannelAutoJoin, setEditChannelAutoJoin] = useState(false);

  // Desktop + in-app notification toast
  const [notifyToast, setNotifyToast] = useState<{
    id: string;
    sender: string;
    text: string;
    channelId: string;
  } | null>(null);

  // User ID and Role checks
  const myUserId = String((user as any)?._id || user?.id || "");
  const myEmployeeId = String((user as any)?.employee_id || "");
  const isAdminOrHR = user?.role === "admin" || user?.role === "superadmin" || user?.role === "hr";

  // User Request & Access Control check for deleting messages:
  // Admin can always delete messages.
  // Other employees can ONLY delete if granted delete permission in Access Control (department preset or employee override).
  const canDeleteChatMessages = Boolean(
    isUserAdmin(user) ||
    hasModulePermission(user, "/chat", "delete") ||
    user?.permissions?.["/chat"]?.delete || 
    user?.permissions?.["/chat"]?.all ||
    user?.permissions?.["chat"]?.delete ||
    user?.permissions?.["chat"]?.all
  );

  // Task 37: In-Chat Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  // Task 36: New DM Modal Search State
  const [newDmSearch, setNewDmSearch] = useState("");

  // Task 42: New Channel Members Selection State
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [newChannelMemberSearch, setNewChannelMemberSearch] = useState("");

  // Task 45: Hidden DMs State (persisted per user in localStorage)
  const [hiddenDms, setHiddenDms] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`hrms_hidden_dms_${myUserId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const hideDm = useCallback((dmId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHiddenDms((prev) => {
      const next = new Set(prev);
      next.add(dmId);
      try {
        localStorage.setItem(`hrms_hidden_dms_${myUserId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    toast.success("Conversation hidden from sidebar");
  }, [myUserId]);

  const unhideDm = useCallback((dmId: string) => {
    setHiddenDms((prev) => {
      if (!prev.has(dmId)) return prev;
      const next = new Set(prev);
      next.delete(dmId);
      try {
        localStorage.setItem(`hrms_hidden_dms_${myUserId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [myUserId]);

  // Task 39: Reactions Lock / Debounce Ref
  const reactingInProgressRef = useRef<Set<string>>(new Set());

  // Task 38: Drag & Drop State
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Double-send guard + sending lock
  const isSendingRef = useRef(false);
  const lastSentRef = useRef<{ content: string; at: number } | null>(null);

  // Poll Form State
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);

  // Online Presence & WebSocket
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeChannelIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // Focus message input caret automatically
  const focusMessageInput = useCallback(() => {
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  }, []);

  // Design-wise Confirmation Modal State (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Auto-focus input when reply is selected
  useEffect(() => {
    if (replyTo) {
      focusMessageInput();
    }
  }, [replyTo, focusMessageInput]);

  // Auto-focus input when channel is changed
  useEffect(() => {
    if (activeChannelId) {
      focusMessageInput();
    }
  }, [activeChannelId, focusMessageInput]);

  // --- SCROLL TO BOTTOM ---
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Copy real image bitmap to clipboard (fixes Issue 1: Windows clipboard Win+V shows actual image, not filename)
  const copyImageToClipboard = async (imgUrl: string): Promise<boolean> => {
    try {
      const fullUrl = getMediaUrl(imgUrl);
      const resp = await fetch(fullUrl, { mode: "cors" });
      const blob = await resp.blob();

      // Chromium clipboard write only allows image/png.
      // Convert any image (JPEG, WebP, etc.) to PNG via Canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image failed to load onto canvas"));
        img.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 300;
      canvas.height = img.naturalHeight || img.height || 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!pngBlob) throw new Error("Could not convert image to PNG");

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ]);
      return true;
    } catch (err) {
      console.error("Image copy to clipboard error:", err);
      return false;
    }
  };

  // Check if message is seen (read by other users)
  const isMessageSeen = useCallback(
    (msg: ChatMessage) => {
      if (!msg) return false;
      const ch = channels.find((c) => (c.id || (c as any)._id) === activeChannelId);
      const isSelfChat =
        ch?.type === "self" ||
        String(ch?.name || "").toLowerCase().includes("yourself") ||
        ch?.name === "You" ||
        ch?.name === "You (Message Yourself)";
      if (isSelfChat) return true;

      if (!Array.isArray(msg.read_by)) return false;
      return msg.read_by.some((uid) => {
        const sUid = String(uid).trim();
        return (
          sUid !== "" &&
          sUid !== myUserId &&
          sUid !== myEmployeeId &&
          sUid !== "me" &&
          sUid !== "undefined" &&
          sUid !== "null"
        );
      });
    },
    [myUserId, myEmployeeId, channels, activeChannelId]
  );

  // Clean display name - removes any bracket suffixes like "(admin)" or "(any role)" (Issue 1)
  const cleanDisplayName = useCallback((name?: string | null) => {
    if (!name) return "";
    const s = String(name);
    if (s.includes("(Message Yourself)")) return s;
    return s.replace(/\s*\([^)]*\)/g, "").trim();
  }, []);

  // WhatsApp-style rich text formatter (*bold*, _italic_, ~strike~, `code`, and links)
  // Issue: @mention must highlight ONLY the @token (no spaces) + bubble-aware colors
  const renderFormattedText = useCallback((rawText: string, isMeMsg: boolean = false) => {
    if (!rawText) return null;
    const lines = rawText.split(/\r?\n/);

    return (
      <div className="space-y-1">
        {lines.map((line, lIdx) => {
          if (!line || line.trim() === "") {
            return <div key={lIdx} className="h-2.5" />;
          }

          // Tokenize formatting markers: *bold*, _italic_, ~strike~, `code`, URLs, and @mentions
          // NOTE: mention = single @token WITHOUT spaces (so "@Admin hi" highlights only "@Admin")
          const regex = /(\*[^\*\r\n]+\*|_[^_\r\n]+_|~[^~\r\n]+~|`[^`\r\n]+`|https?:\/\/[^\s]+|@[A-Za-z0-9_.]+)/g;
          const segments = line.split(regex);

          const rendered = segments.map((seg, sIdx) => {
            if (!seg) return null;

            // Mention: @Name (only the token, rest of message stays normal)
            if (seg.startsWith("@") && seg.length > 1) {
              return (
                <span
                  key={sIdx}
                  className={
                    isMeMsg
                      ? "font-bold text-white bg-white/25 px-1 py-0.5 rounded cursor-pointer hover:bg-white/35"
                      : "font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1 py-0.5 rounded cursor-pointer hover:underline"
                  }
                >
                  {seg}
                </span>
              );
            }

            // Bold: *text*
            if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
              return (
                <strong key={sIdx} className="font-bold">
                  {seg.slice(1, -1)}
                </strong>
              );
            }

            // Italic: _text_
            if (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2) {
              return (
                <em key={sIdx} className="italic">
                  {seg.slice(1, -1)}
                </em>
              );
            }

            // Strikethrough: ~text~
            if (seg.startsWith("~") && seg.endsWith("~") && seg.length > 2) {
              return (
                <del key={sIdx} className="line-through opacity-85">
                  {seg.slice(1, -1)}
                </del>
              );
            }

            // Monospace/Code: `text`
            if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2) {
              return (
                <code
                  key={sIdx}
                  className="px-1.5 py-0.5 rounded font-mono text-[12px] bg-black/15 dark:bg-white/15"
                >
                  {seg.slice(1, -1)}
                </code>
              );
            }

            // Clickable URL
            if (/^https?:\/\/[^\s]+$/i.test(seg)) {
              return (
                <a
                  key={sIdx}
                  href={seg}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="underline text-sky-400 hover:text-sky-300 dark:text-sky-400 break-all"
                >
                  {seg}
                </a>
              );
            }

            // Highlight in-chat search query if active
            if (chatSearchQuery.trim() && seg.toLowerCase().includes(chatSearchQuery.toLowerCase())) {
              const q = chatSearchQuery.trim();
              const regexQ = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
              const parts = seg.split(regexQ);
              return (
                <span key={sIdx}>
                  {parts.map((p, pIdx) =>
                    p.toLowerCase() === q.toLowerCase() ? (
                      <mark key={pIdx} className="bg-amber-300 dark:bg-amber-500 text-black px-0.5 rounded font-bold">
                        {p}
                      </mark>
                    ) : (
                      p
                    )
                  )}
                </span>
              );
            }

            return <span key={sIdx}>{seg}</span>;
          });

          return (
            <div key={lIdx} className="leading-relaxed">
              {rendered}
            </div>
          );
        })}
      </div>
    );
  }, [chatSearchQuery]);

  // WhatsApp-style Right Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    msg: ChatMessage;
    mediaItem?: { url: string; name?: string; type?: string } | undefined;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Modals for Poll Votes and Message Info (WhatsApp style)
  const [viewVotesPollMsg, setViewVotesPollMsg] = useState<ChatMessage | null>(null);
  const [messageInfoMsg, setMessageInfoMsg] = useState<ChatMessage | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const hasUserDismissedActiveRef = useRef(false);

  const handleContextMenu = (
    e: React.MouseEvent,
    msg: ChatMessage,
    mediaItem?: { url: string; name?: string; type?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 230;
    const menuHeight = 360;
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 15));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 15));
    setContextMenu({ x, y, msg, mediaItem });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    const handleScroll = () => setContextMenu(null);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  // --- SAFE FORMAT MESSAGE ---
  const formatMessage = useCallback(
    (m: any): ChatMessage => {
      const sId = String(m?.sender_id || "").trim();
      const isMe = sId === myUserId || (myEmployeeId !== "" && sId === myEmployeeId) || sId === "me";
      const reactions = normalizeReactions(m?.reactions);
      const readBy = Array.isArray(m?.read_by)
        ? m.read_by.map(String)
        : Array.isArray(m?.is_read_by)
        ? m.is_read_by.map(String)
        : [];

      let pollData: PollData | null = null;
      if (m?.poll && typeof m.poll === "object") {
        pollData = {
          question: m.poll.question || "",
          allow_multiple_answers: Boolean(m.poll.allow_multiple_answers),
          hide_voters_name: Boolean(m.poll.hide_voters_name),
          created_by: String(m.poll.created_by || ""),
          options: Array.isArray(m.poll.options)
            ? m.poll.options.map((opt: any) => ({
                id: String(opt.id || ""),
                text: String(opt.text || ""),
                voters: Array.isArray(opt.voters) ? opt.voters.map(String) : []
              }))
            : []
        };
      }

      // Backend compatibility: file_url vs media_url, message_type vs media_type, timestamp vs created_at
      const rawMediaUrl = m?.media_url ?? m?.file_url ?? null;
      const rawMediaTypeRaw = m?.media_type ?? m?.message_type ?? m?.file_type ?? null;
      let rawMediaType: ChatMessage["media_type"] = null;
      if (typeof rawMediaTypeRaw === "string") {
        const t = rawMediaTypeRaw.toLowerCase();
        if (t.includes("image")) rawMediaType = "image";
        else if (t.includes("video")) rawMediaType = "video";
        else if (t.includes("audio") || t.includes("voice") || t.includes("webm") || t.includes("mp3") || t.includes("wav") || t.includes("ogg") || t.includes("m4a") || t.includes("aac")) rawMediaType = "audio";
        else if (t === "text" || t === "poll") rawMediaType = null;
        else if (rawMediaUrl) rawMediaType = "document";
      }
      // Fallback: detect audio/doc by file extension even when type is generic (file/document)
      const _fn = String(m?.file_name || rawMediaUrl || "");
      if ((rawMediaType === null || rawMediaType === "document") && /\.(webm|mp3|wav|ogg|m4a|aac)(\?|$)/i.test(_fn)) {
        rawMediaType = "audio";
      } else if ((rawMediaType === null || rawMediaType === "document") && /\.(mp4|mov|mkv|avi)(\?|$)/i.test(_fn)) {
        rawMediaType = "video";
      } else if ((rawMediaType === null || rawMediaType === "document") && /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(_fn)) {
        rawMediaType = "image";
      }

      // Normalize reply_to: backend may send {message_id,sender_id,message_type} (WS path)
      // while REST create sends {id,sender_name,content,media_type}. Accept both.
      let replyNorm: ChatMessage["reply_to"] = null;
      const _r = m?.reply_to;
      if (_r && typeof _r === "object") {
        const rid = String(_r.id || _r.message_id || _r._id || "");
        if (rid) {
          replyNorm = {
            id: rid,
            sender_name: String(_r.sender_name || _r.senderName || "User"),
            sender_id: _r.sender_id ? String(_r.sender_id) : undefined,
            content: String(_r.content || (_r.media_type || _r.message_type ? `[${_r.media_type || _r.message_type}]` : "")),
            media_type: (_r.media_type || _r.message_type || null) as any,
            message_type: (_r.message_type || _r.media_type || null) as any,
            media_url: (_r.media_url || _r.file_url || null) as any,
            file_name: (_r.file_name || null) as any
          };
        }
      }

      return {
        id: String(m?.id || m?._id || `msg-${Date.now()}-${Math.random()}`),
        channel_id: String(m?.channel_id || ""),
        sender_id: String(m?.sender_id || ""),
        sender_name: m?.sender_name || (isMe ? (user?.name || "You") : "User"),
        sender_avatar: m?.sender_avatar || (isMe ? (user?.avatar || user?.profile_photo) : undefined),
        content: String(m?.content || ""),
        media_url: rawMediaUrl,
        media_type: rawMediaType,
        file_name: m?.file_name || null,
        file_size: m?.file_size ?? m?.fileSize ?? null,
        group_id: m?.group_id || null,
        is_forwarded: Boolean(m?.is_forwarded),
        reply_to: replyNorm,
        reactions,
        read_by: readBy,
        is_read_by: Array.isArray(m?.is_read_by) ? m.is_read_by : readBy,
        is_pinned: Boolean(m?.is_pinned),
        poll: pollData,
        created_at: m?.created_at || m?.timestamp || m?.createdAt || new Date().toISOString(),
        isMe
      };
    },
    [myUserId, myEmployeeId, user?.name, user?.avatar, user?.profile_photo]
  );

  // Explicit desktop notification permission requester (triggered by click gesture)
  const requestDesktopNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Desktop notifications are not supported in this browser.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        toast.success("Desktop notifications enabled!");
        try {
          new Notification("HK DigiVerse HRMS", {
            body: "Desktop notifications are now active. You will receive alerts when new messages arrive!",
            icon: "/favicon.ico",
          });
        } catch {}
      } else if (perm === "denied") {
        toast.warning("Notifications blocked. Please allow notifications from your browser site settings.");
      }
    } catch {
      // ignore
    }
  };

  // Safe Desktop Notification dispatcher (works across desktop tabs and window unfocused)
  const showDesktopNotification = useCallback((title: string, body: string, channelId: string, avatarUrl?: string | null) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    
    let finalIcon = "/favicon.ico";
    if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.trim()) {
      const clean = avatarUrl.trim();
      if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("data:")) {
        finalIcon = clean;
      } else {
        const base = getApiUrl().replace(/\/+$/, "");
        const path = clean.startsWith("/") ? clean : `/${clean}`;
        finalIcon = `${base}${path}`;
      }
    }
    
    try {
      const n = new Notification(title, {
        body,
        icon: finalIcon,
        tag: `chat-${channelId}-${Date.now()}`,
      });
      n.onclick = () => {
        try {
          window.focus();
        } catch {}
        hasUserDismissedActiveRef.current = false;
        setActiveChannelId(channelId);
        n.close();
      };
    } catch {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: finalIcon,
            tag: `chat-${channelId}-${Date.now()}`,
          });
        }).catch(() => {});
      }
    }
  }, []);

  // Global ESC key listener to deselect active chat into WhatsApp empty state or close active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (reactionPickerMsgId) {
          setReactionPickerMsgId(null);
          return;
        }
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
          return;
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setChatSearchQuery("");
          return;
        }
        if (isPollModalOpen) {
          setIsPollModalOpen(false);
          return;
        }
        if (viewVotesPollMsg) {
          setViewVotesPollMsg(null);
          return;
        }
        if (messageInfoMsg) {
          setMessageInfoMsg(null);
          return;
        }
        // Deselect chat and show empty state (WhatsApp Web ESC behavior)
        if (activeChannelId) {
          hasUserDismissedActiveRef.current = true;
          setActiveChannelId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    contextMenu,
    reactionPickerMsgId,
    showEmojiPicker,
    isSearchOpen,
    isPollModalOpen,
    viewVotesPollMsg,
    messageInfoMsg,
    activeChannelId,
  ]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDown = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!isMemberDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isMemberDropdownOpen]);

  // --- Notification sound (WebAudio beep, no asset needed) ---
  const playNotifySound = useCallback(() => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 400);
    } catch {
      // ignore
    }
  }, []);

  // All image/video messages in the active channel (for WhatsApp-style viewer + strip)
  const channelMedia = React.useMemo(
    () => messages.filter((m) => m.media_url && (m.media_type === "image" || m.media_type === "video")),
    [messages]
  );

  const openMediaViewer = useCallback(
    (msg: ChatMessage) => {
      const idx = channelMedia.findIndex((m) => m.id === msg.id);
      setPreviewIndex(idx >= 0 ? idx : 0);
      setPreviewMediaUrl(msg.media_url!);
      setPreviewMediaType(msg.media_type === "video" ? "video" : "image");
    },
    [channelMedia]
  );

  const navigatePreview = useCallback(
    (direction: "prev" | "next") => {
      if (!channelMedia || channelMedia.length === 0) return;
      setPreviewIndex((prevIdx) => {
        const nextIdx =
          direction === "next"
            ? (prevIdx + 1) % channelMedia.length
            : (prevIdx - 1 + channelMedia.length) % channelMedia.length;
        const target = channelMedia[nextIdx];
        if (target && target.media_url) {
          setPreviewMediaUrl(target.media_url);
          setPreviewMediaType(target.media_type === "video" ? "video" : "image");
        }
        return nextIdx;
      });
    },
    [channelMedia]
  );

  // Keyboard navigation for Lightbox (Left/Right arrows to navigate, ESC to close)
  useEffect(() => {
    if (!previewMediaUrl && !pdfUrl && !pastePreviewUrl && pasteFiles.length === 0 && !pasteFile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPreviewMediaUrl(null);
        setPdfUrl(null);
        setPastePreviewUrl(null);
        setPastePreviewUrls([]);
        setPasteFile(null);
        setPasteFiles([]);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "ArrowLeft") {
        if (previewMediaUrl) {
          e.preventDefault();
          navigatePreview("prev");
        }
      } else if (e.key === "ArrowRight") {
        if (previewMediaUrl) {
          e.preventDefault();
          navigatePreview("next");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewMediaUrl, pdfUrl, pastePreviewUrl, pasteFiles.length, pasteFile, navigatePreview]);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || isNaN(Number(bytes))) return "";
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  // --- Force Save-As dialog (audio/video/image/pdf/document) ---
  const downloadViaBlob = useCallback(async (url: string | null | undefined, filename?: string | null) => {
    if (!url) return;
    const src = getMediaUrl(url);
    let name = (filename || src.split("/").pop()?.split("?")[0] || "download").trim() || "download";
    if (!name.includes(".")) {
      if (src.endsWith(".webm") || url.includes(".webm")) name += ".webm";
      else if (src.endsWith(".mp3") || url.includes(".mp3")) name += ".mp3";
      else if (src.endsWith(".mp4") || url.includes(".mp4")) name += ".mp4";
      else if (src.endsWith(".pdf") || url.includes(".pdf")) name += ".pdf";
      else if (src.endsWith(".png") || url.includes(".png")) name += ".png";
      else if (src.endsWith(".jpg") || src.endsWith(".jpeg") || url.includes(".jpg")) name += ".jpg";
    }

    try {
      let blob: Blob | null = null;
      try {
        const resp = await fetch(src, { mode: "cors" });
        if (resp.ok) {
          blob = await resp.blob();
        }
      } catch {
        // Direct fetch failed (e.g. cross-origin), try backend download endpoint
      }

      if (!blob) {
        const downloadApiUrl = `${resolveApiUrl()}/chat/download?file_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}`;
        try {
          const resp = await fetch(downloadApiUrl);
          if (resp.ok) {
            blob = await resp.blob();
          }
        } catch {}
      }

      // 1. Native OS "Save As" file picker dialog (Chromium on Windows/Mac)
      if (blob && typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const ext = name.split(".").pop()?.toLowerCase();
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: name,
            types: ext ? [{
              description: `${ext.toUpperCase()} File`,
              accept: { [blob.type || "application/octet-stream"]: [`.${ext}`] }
            }] : undefined
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("File saved successfully");
          return;
        } catch (pickerErr: any) {
          if (pickerErr.name === "AbortError") {
            // User cancelled in Save As picker dialog
            return;
          }
          // Fall through to object URL anchor download
        }
      }

      // 2. Blob object URL trigger download
      if (blob) {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => {
          try {
            URL.revokeObjectURL(objUrl);
          } catch {}
        }, 10000);
        return;
      }

      // 3. Fallback: navigate or trigger direct download link via backend endpoint
      const directDownloadUrl = `${resolveApiUrl()}/chat/download?file_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}`;
      const link = document.createElement("a");
      link.href = directDownloadUrl;
      link.download = name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      try {
        window.open(src, "_blank", "noopener");
      } catch {}
    }
  }, []);

  // --- 1. FETCH CHANNELS ---
  // Stable (no state deps): uses activeChannelIdRef so background refetches
  // (WS events, focus) never hijack the open chat with a stale closure.
  // Also reconciles removal: if the open channel vanished (I was removed),
  // it clears the view even when the WS event was missed.
  const fetchChannels = useCallback(async () => {
    try {
      const res = await api.get<ChatChannel[]>("/chat/channels", { showErrorToast: false });
      if (res && res.length > 0) {
        setChannels(res);
        const currentActive = activeChannelIdRef.current;
        if (!currentActive && !hasUserDismissedActiveRef.current) {
          const firstChan = res[0] as ChatChannel | undefined;
          const firstId = firstChan?.id || (firstChan as any)?._id;
          if (firstId) setActiveChannelId(firstId);
        } else if (!res.some((c) => String(c.id || (c as any)._id) === String(currentActive))) {
          // Open channel no longer in my list (removed from group) -> leave view
          setActiveChannelId(null);
          setMessages([]);
        }
      } else {
        // Fallback default channels matching the user's design
        const defaultChannels: ChatChannel[] = [
          { id: "chan-general", name: "general", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 0 },
          { id: "chan-engineering", name: "engineering", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 3 },
          { id: "chan-marketing", name: "marketing", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 0 },
          { id: "chan-design", name: "design", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 1 }
        ];
        setChannels(defaultChannels);
        if (!activeChannelIdRef.current && !hasUserDismissedActiveRef.current) setActiveChannelId("chan-engineering");
      }
    } catch {
      // Default fallback
      const defaultChannels: ChatChannel[] = [
        { id: "chan-general", name: "general", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 0 },
        { id: "chan-engineering", name: "engineering", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 3 },
        { id: "chan-marketing", name: "marketing", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 0 },
        { id: "chan-design", name: "design", is_dm: false, members: [], created_by: "system", created_at: "", unread_count: 1 }
      ];
      setChannels(defaultChannels);
      if (!activeChannelIdRef.current && !hasUserDismissedActiveRef.current) setActiveChannelId("chan-engineering");
    }
  }, []);

  // --- 2. FETCH MESSAGES FOR ACTIVE CHANNEL ---
  const fetchMessages = useCallback(
    async (channelId: string) => {
      try {
        const res = await api.get<any[]>(`/chat/channels/${channelId}/messages`, { showErrorToast: false });
        if (Array.isArray(res)) {
          const formatted = res.map((m) => formatMessage(m));
          // Dedupe by id + sort by time ASC (oldest first, newest last)
          const seen = new Set<string>();
          const deduped = formatted.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          deduped.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setMessages(deduped);
        } else {
          setMessages([]);
        }
        setTimeout(() => scrollToBottom("auto"), 100);

        // Mark read via WebSocket (0 HTTP requests, 0 CORS preflight)
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          try {
            socketRef.current.send(JSON.stringify({
              action: "mark_read",
              channel_id: channelId,
              user_name: user?.name
            }));
          } catch {}
        }
        setChannels((prev) =>
          prev.map((c) =>
            (c.id || (c as any)._id) === channelId ? { ...c, unread_count: 0 } : c
          )
        );
      } catch {
        // If channel is mock or newly created, show initial mock messages for demonstration
        if (channelId === "chan-engineering" || channelId === "2" || channelId.includes("engineering")) {
          setMessages([
            formatMessage({
              id: "m1",
              channel_id: channelId,
              sender_id: "u1",
              sender_name: "Sarah Connor",
              sender_avatar: "https://i.pravatar.cc/150?u=sarah",
              content: "Hey team, just deployed the new auth service. Can someone review the PR?",
              reactions: [],
              read_by: [],
              created_at: new Date(Date.now() - 3600000).toISOString()
            }),
            formatMessage({
              id: "m2",
              channel_id: channelId,
              sender_id: "u2",
              sender_name: "John Doe",
              sender_avatar: "https://i.pravatar.cc/150?u=john",
              content: "I'll take a look right now.",
              reactions: [],
              read_by: [],
              created_at: new Date(Date.now() - 3000000).toISOString()
            }),
            formatMessage({
              id: "m3",
              channel_id: channelId,
              sender_id: String(user?.id || "u3"),
              sender_name: user?.name || "Alex Johnson",
              sender_avatar: user?.avatar || user?.profile_photo || "https://i.pravatar.cc/150?u=alex",
              content: "Thanks John. Let me know if you need any context on the token refresh logic.",
              reactions: [],
              read_by: ["u1", "u2"],
              created_at: new Date(Date.now() - 1800000).toISOString()
            }),
            formatMessage({
              id: "m4",
              channel_id: channelId,
              sender_id: "u1",
              sender_name: "Sarah Connor",
              sender_avatar: "https://i.pravatar.cc/150?u=sarah",
              content: "Perfect. It should be pretty straightforward, mostly just updated the JWT expiration handling.",
              reactions: [],
              read_by: [],
              created_at: new Date(Date.now() - 600000).toISOString()
            })
          ]);
        } else {
          setMessages([]);
        }
      }
    },
    [user?.id, user?.name, user?.avatar, user?.profile_photo, formatMessage]
  );

  // Initial load
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Load messages on channel change
  useEffect(() => {
    if (activeChannelId) {
      fetchMessages(activeChannelId);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          action: "messages_read",
          channel_id: activeChannelId
        }));
      }
    }
  }, [activeChannelId, fetchMessages]);

  // --- 3. REAL-TIME WEBSOCKET CONNECTION (AUTO-RECONNECT + HEARTBEAT) ---
  useEffect(() => {
    if (!user?.id) return;

    let isDisposed = false;
    let reconnectTimer: any = null;
    let pingInterval: any = null;

    const connectWs = () => {
      if (isDisposed) return;
      try {
        const token = getAuthToken();
        const apiUrl = resolveApiUrl();
        const isSsl = apiUrl.startsWith("https://");
        const wsHost = apiUrl.replace(/^https?:\/\//, "");
        const wsUrl = `${isSsl ? "wss://" : "ws://"}${wsHost}/chat/ws/${user.id}${token ? `?token=${token}` : ""}`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          // Connected! Request presence & send read receipt over WebSocket
          try {
            socket.send(JSON.stringify({ action: "get_presence" }));
            if (activeChannelIdRef.current) {
              socket.send(JSON.stringify({
                action: "mark_read",
                channel_id: activeChannelIdRef.current,
                user_name: user?.name
              }));
            }
          } catch {}
          // Heartbeat ping every 20 seconds
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            try {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "ping", action: "ping" }));
              }
            } catch {}
          }, 20000);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "pong" || data.action === "pong") return;

            // --- group membership changed (backend sends action, no type) ---
            if (data.action === "group_member_updated" || data.type === "group_member_updated") {
              const updatedChan = data.channel;
              const evtType = data.event_type;
              const memberId = String(data.member_id || "");
              const myId = String(user?.id || "");
              if (updatedChan) {
                const nid = String((updatedChan as any).id || (updatedChan as any)._id || data.channel_id || "");
                setChannels((prev) => {
                  const exists = prev.some((c) => String(c.id || (c as any)._id) === nid);
                  if (exists) {
                    return prev.map((c) =>
                      String(c.id || (c as any)._id) === nid ? { ...(c as any), ...(updatedChan as any), id: nid } as any : c
                    );
                  }
                  // I was just added (or new group) -> show immediately, no refresh
                  if (evtType === "member_added" && (memberId === myId || (updatedChan.members || []).map(String).includes(myId))) {
                    return [...prev, { ...(updatedChan as any), id: nid } as any];
                  }
                  return prev;
                });
              } else {
                fetchChannels();
              }
              // If I was removed, leave the channel view
              if (evtType === "member_removed" && memberId === myId && data.channel_id === activeChannelIdRef.current) {
                setActiveChannelId(null);
                setMessages([]);
              }
              // If someone added me, refetch to get full list + toast
              if (evtType === "member_added" && memberId === myId) {
                fetchChannels();
                setNotifyToast({
                  id: `added-${Date.now()}`,
                  sender: "New group",
                  text: "You were added to a group",
                  channelId: String(data.channel_id || ""),
                });
                setTimeout(() => setNotifyToast((t) => (t && t.id.startsWith("added-") ? null : t)), 6000);
              }
              return;
            }

            if (data.type === "new_message") {
              const msg = formatMessage(data.message);
              const isMeMsg = String(msg.sender_id) === String(user?.id);
              const isCurrentChat = String(msg.channel_id) === String(activeChannelIdRef.current);

              // --- unread + channel list update (all channels, not only active) ---
              setChannels((prev) => {
                const exists = prev.some((c) => String(c.id || (c as any)._id) === String(msg.channel_id));
                let next = prev.map((c) => {
                  if (String(c.id || (c as any)._id) !== String(msg.channel_id)) return c;
                  // active channel opened -> keep 0, else +1
                  const shouldInc = !isMeMsg && !isCurrentChat;
                  return {
                    ...c,
                    unread_count: shouldInc ? (c.unread_count || 0) + 1 : 0,
                    last_message: {
                      content: msg.content,
                      sender_id: msg.sender_id,
                      timestamp: msg.created_at,
                    } as any,
                  };
                });
                if (!exists) {
                  // new DM arrived that is not in list yet -> refetch channels
                  fetchChannels();
                  return prev;
                }
                // Sort: latest message first
                next = [...next].sort((a: any, b: any) => {
                  const ta = new Date(a?.last_message?.timestamp || a?.created_at || 0).getTime() || 0;
                  const tb = new Date(b?.last_message?.timestamp || b?.created_at || 0).getTime() || 0;
                  return tb - ta;
                });
                return next;
              });

              // --- desktop + in-app notification for others' messages ---
              if (!isMeMsg) {
                const preview = msg.content || (msg.media_type ? `[${msg.media_type}]` : "New message");
                const isViewingThisChat =
                  isCurrentChat &&
                  typeof document !== "undefined" &&
                  !document.hidden &&
                  document.hasFocus();
                if (!isViewingThisChat) {
                  setNotifyToast({
                    id: msg.id,
                    sender: msg.sender_name || "New message",
                    text: preview.slice(0, 120),
                    channelId: msg.channel_id,
                  });
                  setTimeout(() => {
                    setNotifyToast((t) => (t && t.id === msg.id ? null : t));
                  }, 6000);
                }
                try {
                  const tabHidden = typeof document !== "undefined" && (document.hidden || !document.hasFocus());
                  if (tabHidden || !isViewingThisChat) {
                    showDesktopNotification(msg.sender_name || "New message", preview.slice(0, 150), msg.channel_id, msg.sender_avatar);
                  }
                } catch {
                  // ignore
                }
                try {
                  if (typeof document === "undefined" || document.hidden || !document.hasFocus()) {
                    playNotifySound();
                  }
                } catch {}
              }

              if (isCurrentChat) {
                setMessages((prev) => {
                  // 1. Same server id already exists -> skip (POST + WS race)
                  if (prev.some((m) => String(m.id) === String(msg.id))) return prev;

                  // 2. This is echo of our own optimistic temp msg -> replace temp instead of append
                  const tempIdx = prev.findIndex(
                    (m) =>
                      typeof m.id === "string" &&
                      m.id.startsWith("temp-") &&
                      m.content === msg.content &&
                      String(m.sender_id) === String(msg.sender_id) &&
                      String(m.channel_id) === String(msg.channel_id)
                  );
                  if (tempIdx !== -1) {
                    const next = [...prev];
                    next[tempIdx] = msg;
                    return next;
                  }

                  const next = [...prev, msg];
                  next.sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  );
                  return next;
                });
                setTimeout(() => scrollToBottom("smooth"), 100);
                // active channel opened -> mark read immediately via WebSocket
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  try {
                    socketRef.current.send(JSON.stringify({
                      action: "mark_read",
                      channel_id: msg.channel_id,
                      user_name: user?.name
                    }));
                  } catch {}
                }
              }
            } else if (data.type === "reaction_updated" || data.action === "reaction_updated") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === data.message_id ? { ...m, reactions: normalizeReactions(data.reactions) } : m
                )
              );
            } else if (data.type === "poll_voted" || data.type === "poll_updated" || data.action === "poll_updated") {
              setMessages((prev) =>
                prev.map((m) => (m.id === data.message_id ? { ...m, poll: data.poll } : m))
              );
              setViewVotesPollMsg((prev) => (prev && prev.id === data.message_id ? { ...prev, poll: data.poll } : prev));
            } else if (data.type === "message_deleted" || data.action === "message_deleted") {
              setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
            } else if (data.type === "read_receipt" || data.action === "read_receipt" || data.type === "messages_read" || data.action === "messages_read") {
              if (String(data.channel_id) === String(activeChannelIdRef.current)) {
                const readerId = String(data.user_id);
                const readerName = data.user_name || "";
                const readAt = data.timestamp || new Date().toISOString();
                setMessages((prev) =>
                  prev.map((m) => {
                    const currentRead = Array.isArray(m.read_by) ? [...m.read_by] : [];
                    const currentIsRead = Array.isArray(m.is_read_by) ? [...m.is_read_by] : [];
                    const nextRead = currentRead.includes(readerId) ? currentRead : [...currentRead, readerId];
                    const nextIsRead = currentIsRead.some((r: any) => (typeof r === "object" ? String(r.id) === readerId : String(r) === readerId))
                      ? currentIsRead
                      : [...currentIsRead, { id: readerId, name: readerName, time: readAt }];
                    return {
                      ...m,
                      read_by: nextRead,
                      is_read_by: nextIsRead
                    };
                  })
                );
                setMessageInfoMsg((prev) => {
                  if (!prev) return null;
                  const currentRead = Array.isArray(prev.read_by) ? [...prev.read_by] : [];
                  const currentIsRead = Array.isArray(prev.is_read_by) ? [...prev.is_read_by] : [];
                  const nextRead = currentRead.includes(readerId) ? currentRead : [...currentRead, readerId];
                  const nextIsRead = currentIsRead.some((r: any) => (typeof r === "object" ? String(r.id) === readerId : String(r) === readerId))
                    ? currentIsRead
                    : [...currentIsRead, { id: readerId, name: readerName, time: readAt }];
                  return {
                    ...prev,
                    read_by: nextRead,
                    is_read_by: nextIsRead
                  };
                });
              }
            } else if (data.action === "presence_state" || data.type === "presence_state") {
              if (Array.isArray(data.online_users)) {
                const pMap: Record<string, boolean> = {};
                data.online_users.forEach((uid: string) => {
                  pMap[String(uid)] = true;
                });
                setPresenceMap((prev) => ({ ...prev, ...pMap }));
              }
            } else if (data.type === "user_presence" || data.action === "user_presence_updated" || data.type === "user_presence_updated") {
              const pDoc = data.presence || data;
              const uid = String(pDoc.user_id || data.user_id || "");
              const isOnline = pDoc.is_online !== undefined ? pDoc.is_online : data.is_online;
              if (uid) {
                setPresenceMap((prev) => ({
                  ...prev,
                  [uid]: Boolean(isOnline)
                }));
              }
            }
          } catch {
            // ignore
          }
        };

        socket.onerror = () => {
          try {
            socket.close();
          } catch {}
        };

        socket.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          if (!isDisposed) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connectWs, 2000);
          }
        };
      } catch {
        if (!isDisposed) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectWs, 2500);
        }
      }
    };

    connectWs();

    return () => {
      isDisposed = true;
      clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }
    };
  }, [user?.id, formatMessage, fetchChannels, fetchMessages, playNotifySound]);

  // Refetch channels and active messages when tab regains focus or visibility
  useEffect(() => {
    const onFocus = () => {
      fetchChannels();
      if (activeChannelIdRef.current) {
        fetchMessages(activeChannelIdRef.current);
      }
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      } catch {}
    };
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchChannels]);

  // --- 4. SEND MESSAGE (TEXT / REPLY) ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChannelId) return;
    // Prevent double-enter / double-click sending same text twice (fixes 3x hello)
    if (isSendingRef.current) return;
    const content = inputText.trim();
    const nowTs = Date.now();
    if (
      lastSentRef.current &&
      lastSentRef.current.content === content &&
      nowTs - lastSentRef.current.at < 1500
    ) {
      return;
    }
    isSendingRef.current = true;
    lastSentRef.current = { content, at: nowTs };
    setInputText("");

    const payload: any = {
      content,
      channel_id: activeChannelId
    };

    if (replyTo) {
      payload.reply_to = {
        id: replyTo.id,
        sender_name: replyTo.sender_name,
        content: replyTo.content || (replyTo.media_type ? `[${replyTo.media_type}]` : ""),
        media_type: replyTo.media_type || undefined
      };
      setReplyTo(null);
    }

    // Optimistic message update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = formatMessage({
      id: tempId,
      channel_id: activeChannelId,
      sender_id: String(user?.id || "me"),
      sender_name: user?.name || "You",
      sender_avatar: user?.avatar || user?.profile_photo,
      content,
      reply_to: payload.reply_to,
      reactions: {},
      read_by: [],
      created_at: new Date().toISOString()
    });
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      const res = await api.post<ChatMessage>(`/chat/channels/${activeChannelId}/messages`, payload, {
        showErrorToast: false
      });
      if (res) {
        const formatted = formatMessage(res);
        // Never lose the reply quote: if the server echo drops reply_to
        // (older backend), keep the optimistic one so the quote always shows.
        const withReply: ChatMessage = formatted.reply_to
          ? formatted
          : { ...formatted, reply_to: optimisticMsg.reply_to || null };
        const finalId = withReply.id;
        setMessages((prev) => {
          // If WS already added the real message, patch its reply (if missing) + drop temp
          if (prev.some((m) => m.id === finalId)) {
            return prev
              .filter((m) => m.id !== tempId)
              .map((m) => (m.id === finalId && !m.reply_to && withReply.reply_to ? { ...m, reply_to: withReply.reply_to } : m));
          }
          // Otherwise replace temp with real server message
          return prev.map((m) => (m.id === tempId ? withReply : m));
        });
      }
    } catch {
      // Keep optimistic
    } finally {
      isSendingRef.current = false;
    }
  };

  // --- 5. FILE UPLOAD (Image, Video, Audio, Doc) — supports MULTI files + caption ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !activeChannelId) return;

    setIsUploading(true);
    // One group so multi images render as a WhatsApp grid (issue 8)
    const groupId = files.length > 1 ? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : undefined;
    const caption = inputText.trim();

    try {
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx] as File | undefined;
        if (!file) continue;
        
        // Sanitize filename to avoid multipart header issues with unicode/middle dots from ChatGPT
        const rawName = file.name || "image.png";
        const safeName = rawName.replace(/[^\x00-\x7F]/g, "_") || "image.png";
        const uploadFile = safeName !== file.name ? new File([file], safeName, { type: file.type || "image/png" }) : file;

        const formData = new FormData();
        formData.append("file", uploadFile);

        const uploadRes: any = await api.post(
          "/chat/upload",
          formData
        );

        const fileUrl = uploadRes?.url || uploadRes?.file_url || "";
        if (!fileUrl) {
          throw new Error(`Failed to upload ${file.name}. Please try again.`);
        }

        let mediaType: "image" | "video" | "audio" | "document" = "document";
        const cType = (file.type || uploadRes?.file_type || "").toLowerCase();
        if (cType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) mediaType = "image";
        else if (cType.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(file.name)) mediaType = "video";
        else if (cType.startsWith("audio/") || /\.(webm|mp3|wav|ogg|m4a|aac)$/i.test(file.name)) mediaType = "audio";

        const fileName = uploadRes?.file_name || uploadRes?.fileName || file.name;
        const fileSize = uploadRes?.file_size || uploadRes?.fileSize || file.size;

        const payload: any = {
          content: idx === files.length - 1 ? caption || file.name : file.name,
          channel_id: activeChannelId,
          media_url: fileUrl,
          media_type: mediaType,
          file_name: fileName,
          file_size: fileSize,
          ...(groupId ? { group_id: groupId } : {})
        };

        if (replyTo) {
          payload.reply_to = {
            id: replyTo.id,
            sender_name: replyTo.sender_name,
            content: replyTo.content || `[${replyTo.media_type || "Media"}]`,
            media_type: replyTo.media_type || undefined,
            media_url: replyTo.media_url || undefined,
            file_name: replyTo.file_name || undefined
          };
        }

        const res = await api.post<ChatMessage>(`/chat/channels/${activeChannelId}/messages`, payload, {
          showErrorToast: true
        });
        if (res) {
          const _fmt = formatMessage(res);
          const sentReply = payload.reply_to
            ? formatMessage({ reply_to: payload.reply_to } as any).reply_to
            : null;
          const withReply: ChatMessage = _fmt.reply_to ? _fmt : { ..._fmt, reply_to: sentReply };
          setMessages((prev) => (prev.some((m) => m.id === withReply.id) ? prev : [...prev, withReply]));
        }
      }
      if (replyTo) setReplyTo(null);
      setInputText("");
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Failed to upload file(s)");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- COPY message/image (fixes Issue 1: actual image bitmap to clipboard) ---
  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      if (msg.media_url && (msg.media_type === "image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.media_url))) {
        const ok = await copyImageToClipboard(msg.media_url);
        if (ok) {
          toast.success("Image copied to clipboard!");
        } else {
          toast.error("Could not copy image");
        }
      } else if (msg.content) {
        await navigator.clipboard.writeText(msg.content);
        toast.success("Message copied!");
      }
    } catch {
      // Fallback: copy text
      try {
        if (msg.content) {
          await navigator.clipboard.writeText(msg.content);
          toast.success("Message copied!");
        }
      } catch {}
    }
  };

  // Toggle Pin message
  const handleTogglePin = async (messageId: string) => {
    try {
      const res = await api.post<any>(`/chat/messages/${messageId}/pin`, {}, { showErrorToast: false });
      const isPinned = Boolean(res?.is_pinned);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: isPinned } : m))
      );
      toast.success(isPinned ? "Message pinned" : "Message unpinned");
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m))
      );
      toast.info("Pinned status updated");
    }
  };

  // Helper for DM detection
  const isDirect = (c: any) => Boolean(c?.is_dm || c?.type === "direct");

  const getDmOtherUser = (c: any) => {
    if (!c) return { id: "", name: "Direct Message", avatar: undefined, is_online: false, subtitle: "" };
    if (c.other_user) {
      return {
        ...c.other_user,
        name: cleanDisplayName(c.other_user.name)
      };
    }
    const otherId = (c.members || []).find((m: any) => String(m) !== String(user?.id));
    const emp = (employees || []).find((e) => String(e?.id) === String(otherId));
    const rawName = cleanDisplayName(emp?.name || c.name || "Direct Message");
    return {
      id: otherId || "",
      name: rawName,
      rawName: rawName,
      subtitle: emp?.email || emp?.role || "",
      avatar: emp?.avatar || emp?.profile_photo,
      is_online: otherId ? Boolean(presenceMap[otherId]) : false
    };
  };

  const messageIdsToForward = React.useMemo(() => {
    if (!forwardMsg) return [];
    if ((forwardMsg as any).group_id) {
      const groupMsgs = messages.filter((m) => (m as any).group_id === (forwardMsg as any).group_id);
      if (groupMsgs.length > 0) return groupMsgs.map((m) => m.id);
    }
    return [forwardMsg.id];
  }, [forwardMsg, messages]);

  const forwardOptions = React.useMemo(() => {
    const list: Array<{ id: string; name: string; avatar?: string | undefined; is_dm: boolean; is_user?: boolean | undefined; raw: any }> = [];

    channels.forEach((c) => {
      const cid = String(c.id || (c as any)._id);
      if (cid === String(forwardMsg?.channel_id)) return;

      if (isDirect(c as any)) {
        const dmUser = getDmOtherUser(c);
        list.push({
          id: cid,
          name: dmUser.name || c.name || "Direct Message",
          avatar: dmUser.avatar || undefined,
          is_dm: true,
          raw: c
        });
      } else {
        list.push({
          id: cid,
          name: c.name || "channel",
          avatar: undefined,
          is_dm: false,
          raw: c
        });
      }
    });

    (employees || []).forEach((emp) => {
      if (String(emp.id) === String(user?.id)) return;
      const alreadyInList = list.some(
        (item) => item.is_dm && (item.id === String(emp.id) || (item.raw as any)?.members?.includes(String(emp.id)))
      );
      if (!alreadyInList) {
        list.push({
          id: String(emp.id),
          name: emp.name || "Employee",
          avatar: emp.avatar || emp.profile_photo || undefined,
          is_dm: true,
          is_user: true,
          raw: emp
        });
      }
    });

    return list;
  }, [channels, employees, forwardMsg, user?.id]);

  // --- FORWARD message(s) to one or many chats ---
  const handleForwardConfirm = async () => {
    if (messageIdsToForward.length === 0 || forwardTargets.length === 0) return;
    setIsForwarding(true);
    try {
      for (const targetId of forwardTargets) {
        const targetOption = forwardOptions.find((opt) => opt.id === targetId);
        const isDirectUser =
          targetOption?.is_user ||
          (!channels.some((c) => String(c.id || (c as any)._id) === String(targetId)) &&
            (employees || []).some((e) => String(e.id) === String(targetId)));

        const payload: any = {
          message_ids: messageIdsToForward,
          ...(isDirectUser ? { target_receiver_id: targetId } : { target_channel_id: targetId })
        };

        await api.post("/chat/forward", payload, { showErrorToast: false });
      }
      setForwardMsg(null);
      setForwardTargets([]);
      setForwardSearch("");
      fetchChannels();
    } catch {
      // quiet
    } finally {
      setIsForwarding(false);
    }
  };

  // --- 6. CLIPBOARD IMAGE PASTE (Ctrl+V) — multi images + discard support ---
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const found: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as DataTransferItem | undefined;
      if (item && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) found.push(file);
      }
    }

    // Fallback: If no direct image item found, check for HTML containing <img> (common with ChatGPT / web copy)
    if (found.length === 0) {
      const html = e.clipboardData?.getData("text/html");
      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          const src = match[1];
          try {
            if (src.startsWith("data:image/")) {
              const res = await fetch(src);
              const blob = await res.blob();
              found.push(new File([blob], `chatgpt-image-${Date.now()}.png`, { type: blob.type || "image/png" }));
            }
          } catch {}
        }
      }
    }

    if (found.length > 0) {
      e.preventDefault();
      const newUrls = found.map((f) => URL.createObjectURL(f));
      if (pasteFiles.length > 0) {
        // Append to existing pasted files
        setPasteFiles((prev) => [...prev, ...found]);
        setPastePreviewUrls((prev) => [...prev, ...newUrls]);
      } else {
        setPasteFiles(found);
        setPastePreviewUrls(newUrls);
        setPasteFile(found[0] as File);
        setPastePreviewUrl(newUrls[0] as string);
        setActivePasteIndex(0);
        setPasteCaption(inputText);
        setInputText("");
      }
    }
  };

  const addMorePasteImages = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const newUrls = arr.map((f) => URL.createObjectURL(f));
    setPasteFiles((prev) => [...prev, ...arr]);
    setPastePreviewUrls((prev) => [...prev, ...newUrls]);
  };

  const removePasteImage = (idxToRemove: number) => {
    setPastePreviewUrls((prevUrls) => {
      const urlToRevoke = prevUrls[idxToRemove];
      if (urlToRevoke) {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch {}
      }
      return prevUrls.filter((_, i) => i !== idxToRemove);
    });

    setPasteFiles((prevFiles) => {
      const nextFiles = prevFiles.filter((_, i) => i !== idxToRemove);
      if (nextFiles.length === 0) {
        closePasteModal();
      } else {
        setActivePasteIndex((prev) => {
          if (prev >= nextFiles.length) return nextFiles.length - 1;
          return prev;
        });
      }
      return nextFiles;
    });
  };

  const closePasteModal = () => {
    setPasteFiles([]);
    setPastePreviewUrls((prev) => {
      prev.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      return [];
    });
    setPasteFile(null);
    setPastePreviewUrl(null);
    setPasteCaption("");
    setActivePasteIndex(0);
  };

  const handleSendPastedImage = async () => {
    const filesToSend = pasteFiles.length > 0 ? pasteFiles : pasteFile ? [pasteFile] : [];
    if (filesToSend.length === 0 || !activeChannelId) return;
    setIsUploading(true);
    // Shared group -> all pasted images render as ONE album bubble (issue 5)
    const groupId =
      filesToSend.length > 1 ? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : undefined;

    try {
      for (let idx = 0; idx < filesToSend.length; idx++) {
        const pf = filesToSend[idx] as File;
        const safeName = (pf.name || "image.png").replace(/[^\x00-\x7F]/g, "_") || "image.png";
        const uploadFile = safeName !== pf.name ? new File([pf], safeName, { type: pf.type || "image/png" }) : pf;

        const formData = new FormData();
        formData.append("file", uploadFile);
        const uploadRes: any = await api.post(
          "/chat/upload",
          formData
        );

        const fileUrl = uploadRes?.url || uploadRes?.file_url || "";
        if (!fileUrl) {
          throw new Error("Failed to upload image. Please try again.");
        }

        const payload: any = {
          content: idx === filesToSend.length - 1 ? pasteCaption.trim() || pf.name || "" : pf.name || "",
          channel_id: activeChannelId,
          media_url: fileUrl,
          media_type: "image",
          file_name: uploadRes?.file_name || pf.name,
          file_size: uploadRes?.file_size || pf.size,
          ...(groupId ? { group_id: groupId } : {})
        };

        if (replyTo) {
          payload.reply_to = {
            id: replyTo.id,
            sender_name: replyTo.sender_name,
            content: replyTo.content || `[${replyTo.media_type || "Image"}]`,
            media_type: replyTo.media_type || undefined,
            media_url: replyTo.media_url || undefined,
            file_name: replyTo.file_name || undefined
          };
        }

        const res = await api.post<ChatMessage>(`/chat/channels/${activeChannelId}/messages`, payload, {
          showErrorToast: true
        });
        if (res) {
          const _fmt = formatMessage(res);
          const sentReply = payload.reply_to
            ? formatMessage({ reply_to: payload.reply_to } as any).reply_to
            : null;
          const withReply: ChatMessage = _fmt.reply_to ? _fmt : { ..._fmt, reply_to: sentReply };
          setMessages((prev) => (prev.some((m) => m.id === withReply.id) ? prev : [...prev, withReply]));
        }
      }
      if (replyTo) setReplyTo(null);
      closePasteModal();
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Failed to send pasted image");
    } finally {
      setIsUploading(false);
    }
  };

  // --- 7. VOICE RECORDER (WhatsApp Style) ---
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Audio recording is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length > 0) {
          await sendAudioBlob(audioBlob);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      toast.error("Microphone access denied or microphone not found. Please allow mic permissions in your browser.");
    }
  };

  const togglePauseResumeRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
        setIsRecordingPaused(true);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      } catch {}
    } else if (mediaRecorderRef.current.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
        setIsRecordingPaused(false);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch {}
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
        const stream = mediaRecorderRef.current.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch {}
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioChunksRef.current = [];
    }
  };

  const sendAudioBlob = async (blob: Blob) => {
    if (!activeChannelId) return;
    setIsUploading(true);
    try {
      const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes: any = await api.post(
        "/chat/upload",
        formData,
        { showErrorToast: false }
      );

      const payload: any = {
        content: "🎤 Voice Message",
        channel_id: activeChannelId,
        media_url: uploadRes?.url || uploadRes?.file_url || "",
        media_type: "audio",
        file_name: uploadRes?.file_name || file.name,
        file_size: uploadRes?.file_size || file.size
      };

      if (replyTo) {
        payload.reply_to = {
          id: replyTo.id,
          sender_name: replyTo.sender_name,
          content: replyTo.content || (replyTo.media_type ? `[${replyTo.media_type}]` : ""),
          media_type: replyTo.media_type || undefined,
          media_url: replyTo.media_url || undefined,
          file_name: replyTo.file_name || undefined
        };
        setReplyTo(null);
      }

      const res = await api.post<ChatMessage>(`/chat/channels/${activeChannelId}/messages`, payload, {
        showErrorToast: false
      });
      if (res) {
        const _fmt = formatMessage(res);
        const sentReply = payload.reply_to
          ? formatMessage({ reply_to: payload.reply_to } as any).reply_to
          : null;
        const withReply: ChatMessage = _fmt.reply_to ? _fmt : { ..._fmt, reply_to: sentReply };
        setMessages((prev) => (prev.some((m) => m.id === withReply.id) ? prev : [...prev, withReply]));
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
    } catch {
      // quiet fail
    } finally {
      setIsUploading(false);
    }
  };

  // --- 8. WHATSAPP STYLE QUOTED REPLY SCROLL ---
  const scrollToOriginalMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
      return;
    }
    // Fallback: original may be grouped inside an album bubble (only first has its own id)
    const albumEl = document.querySelector(`[data-album-containing~="${CSS.escape(msgId)}"]`);
    if (albumEl) {
      albumEl.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstId = albumEl.getAttribute("id")?.replace(/^msg-/, "");
      if (firstId) {
        setHighlightedMsgId(firstId);
        setTimeout(() => setHighlightedMsgId(null), 2000);
      }
    }
  };

  // --- 9. READ MORE / SHOW LESS TOGGLE ---
  const toggleExpandMessage = (msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // --- 10. EMOJI REACTIONS (Instant optimistic update + debounce) ---
  const handleReact = async (messageId: string, emoji: string) => {
    const lockKey = `${messageId}_${emoji}`;
    if (reactingInProgressRef.current.has(lockKey)) return;
    reactingInProgressRef.current.add(lockKey);

    setShowEmojiPicker(false);
    setReactionPickerMsgId(null);

    const prevMessages = [...messages];
    const myId = myUserId;

    // 1. Instant optimistic update (WhatsApp style: 1 reaction per person per message)
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const current: Record<string, string[]> = {};
        let hadThisEmoji = false;

        // Clean out myId from all emojis
        Object.entries(m.reactions || {}).forEach(([em, users]) => {
          if (em === emoji && users.includes(myId)) {
            hadThisEmoji = true;
          }
          const filtered = users.filter((id) => id !== myId);
          if (filtered.length > 0) {
            current[em] = filtered;
          }
        });

        // Toggle: if I didn't already have this emoji, add it
        if (!hadThisEmoji) {
          current[emoji] = [...(current[emoji] || []), myId];
        }

        return { ...m, reactions: current };
      })
    );

    // 2. Network call
    try {
      await api.post(`/chat/messages/${messageId}/react`, { emoji }, { showErrorToast: false });
    } catch {
      // Rollback on failure
      setMessages(prevMessages);
    } finally {
      setTimeout(() => {
        reactingInProgressRef.current.delete(lockKey);
      }, 350);
    }
  };

  // --- 11. POLL CREATION & VOTING ---
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || !activeChannelId) return;
    const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (validOpts.length < 2) {
      return;
    }

    try {
      const res = await api.post<ChatMessage>(
        `/chat/channels/${activeChannelId}/polls`,
        {
          question: pollQuestion.trim(),
          options: validOpts,
          allow_multiple_answers: pollMultiple
        },
        { showErrorToast: false }
      );
      if (res) {
        const _fmt = formatMessage(res);
        setMessages((prev) => (prev.some((m) => m.id === _fmt.id) ? prev : [...prev, _fmt]));
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
      setIsPollModalOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollMultiple(false);
    } catch {
      // quiet fail
    }
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    const myId = myUserId;
    if (!myId) return;

    const myEmp = (employees || []).find(
      (e) => String(e.id) === myId || String((e as any)._id) === myId || (myEmployeeId && String(e.id) === myEmployeeId)
    );
    const myName = myEmp?.name || user?.name || "You";

    // 1. Instant optimistic update for poll vote (0ms delay)
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.poll) return m;
        const allowMultiple = Boolean(m.poll.allow_multiple_answers);
        const options = (m.poll.options || []).map((opt) => {
          let voters = Array.isArray(opt.voters) ? [...opt.voters] : [];
          let voter_details = Array.isArray(opt.voter_details) ? [...opt.voter_details] : [];
          const hasVoted = voters.includes(myId);

          if (opt.id === optionId) {
            if (hasVoted) {
              voters = voters.filter((id) => id !== myId);
              voter_details = voter_details.filter((v) => (typeof v === "object" ? String(v.id) !== myId : String(v) !== myId));
            } else {
              voters.push(myId);
              voter_details.push({ id: myId, name: myName, time: new Date().toISOString() });
            }
          } else if (!allowMultiple) {
            voters = voters.filter((id) => id !== myId);
            voter_details = voter_details.filter((v) => (typeof v === "object" ? String(v.id) !== myId : String(v) !== myId));
          }
          return {
            ...opt,
            voters,
            voter_details,
            voters_count: voters.length,
            user_has_voted: voters.includes(myId)
          };
        });
        return {
          ...m,
          poll: {
            ...m.poll,
            options
          }
        };
      })
    );

    // Sync open View Votes modal
    setViewVotesPollMsg((prev) => {
      if (!prev || prev.id !== messageId || !prev.poll) return prev;
      const allowMultiple = Boolean(prev.poll.allow_multiple_answers);
      const options = (prev.poll.options || []).map((opt) => {
        let voters = Array.isArray(opt.voters) ? [...opt.voters] : [];
        let voter_details = Array.isArray(opt.voter_details) ? [...opt.voter_details] : [];
        const hasVoted = voters.includes(myId);
        if (opt.id === optionId) {
          if (hasVoted) {
            voters = voters.filter((id) => id !== myId);
            voter_details = voter_details.filter((v) => (typeof v === "object" ? String(v.id) !== myId : String(v) !== myId));
          } else {
            voters.push(myId);
            voter_details.push({ id: myId, name: myName, time: new Date().toISOString() });
          }
        } else if (!allowMultiple) {
          voters = voters.filter((id) => id !== myId);
          voter_details = voter_details.filter((v) => (typeof v === "object" ? String(v.id) !== myId : String(v) !== myId));
        }
        return {
          ...opt,
          voters,
          voter_details,
          voters_count: voters.length,
          user_has_voted: voters.includes(myId)
        };
      });
      return { ...prev, poll: { ...prev.poll, options } };
    });

    // 2. Network call
    try {
      await api.post(`/chat/messages/${messageId}/vote`, { option_id: optionId }, { showErrorToast: false });
    } catch {
      // quiet fail
    }
  };

  // --- 12. DELETE & PIN MESSAGE ---
  const handleDeleteMessage = (msgId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/chat/messages/${msgId}`, { showErrorToast: false });
          setMessages((prev) => prev.filter((m) => m.id !== msgId));
        } catch {
          // quiet fail
        }
      }
    });
  };

  // --- 13. CREATE NEW CHANNEL ---
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const cleanName = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    const memberIds = Array.from(new Set([myUserId, ...newChannelMembers])).filter(Boolean);

    try {
      const res = await api.post<ChatChannel>(
        "/chat/channels",
        {
          name: cleanName,
          description: newChannelDesc.trim() || undefined,
          is_dm: false,
          members: memberIds,
          auto_join_new_employees: newChannelAutoJoin
        },
        { showErrorToast: false }
      );
      if (res) {
        const nid = (res as any).id || (res as any)._id;
        setChannels((prev) =>
          prev.some((c) => (c.id || (c as any)._id) === nid) ? prev : [...prev, res]
        );
        setActiveChannelId(nid);
      }
      setIsNewChannelOpen(false);
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelMembers([]);
      setNewChannelMemberSearch("");
      setNewChannelAutoJoin(false);
    } catch {
      // Mock fallback
      const mockChan: ChatChannel = {
        id: `chan-${Date.now()}`,
        name: cleanName,
        is_dm: false,
        members: memberIds,
        created_by: myUserId,
        created_at: new Date().toISOString(),
        auto_join_new_employees: newChannelAutoJoin
      };
      setChannels((prev) => [...prev, mockChan]);
      setActiveChannelId(mockChan.id);
      setIsNewChannelOpen(false);
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelMembers([]);
      setNewChannelMemberSearch("");
      setNewChannelAutoJoin(false);
    }
  };

  // --- 13b. EDIT CHANNEL + ADD/REMOVE MEMBER (creator only) ---
  const isChannelCreator = (c: any) => {
    if (!c || !user?.id) return false;
    return String(c.created_by || "") === String(user.id);
  };

  const openEditChannel = () => {
    if (!activeChannel) return;
    setEditChannelName(activeChannel.name || "");
    setEditChannelDesc((activeChannel as any).description || "");
    setEditChannelAutoJoin(Boolean((activeChannel as any).auto_join_new_employees));
    setEditChannelMemberId("");
    setMemberSearch("");
    setIsMemberDropdownOpen(false);
    setIsEditChannelOpen(true);
  };

  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId || !activeChannel) return;
    if (!isChannelCreator(activeChannel)) return;
    const cleanName = editChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleanName) return;
    try {
      await api.put(
        `/chat/channels/${activeChannelId}`,
        {
          name: cleanName,
          description: editChannelDesc.trim() || undefined,
          auto_join_new_employees: editChannelAutoJoin
        },
        { showErrorToast: false }
      );
    } catch {
      // ignore, still update locally
    }
    setChannels((prev) =>
      prev.map((c) =>
        (c.id || (c as any)._id) === activeChannelId
          ? {
              ...c,
              name: cleanName,
              description: editChannelDesc.trim(),
              auto_join_new_employees: editChannelAutoJoin
            } as any
          : c
      )
    );
    setIsEditChannelOpen(false);
  };

  const handleAddMember = async () => {
    if (!activeChannelId || !editChannelMemberId || !activeChannel) return;
    if (!isChannelCreator(activeChannel)) return;
    // avoid duplicates
    if ((activeChannel.members || []).map(String).includes(String(editChannelMemberId))) {
      setEditChannelMemberId("");
      setIsMemberDropdownOpen(false);
      return;
    }
    try {
      const res: any = await api.post(
        `/chat/channels/${activeChannelId}/members?member_id=${encodeURIComponent(editChannelMemberId)}`,
        {},
        { showErrorToast: false }
      );
      const serverMembers = res?.channel?.members;
      const updatedMembers = Array.isArray(serverMembers)
        ? serverMembers.map(String)
        : [...(activeChannel.members || []).map(String), String(editChannelMemberId)];
      setChannels((prev) =>
        prev.map((c) =>
          (c.id || (c as any)._id) === activeChannelId ? { ...c, members: updatedMembers } : c
        )
      );
      setEditChannelMemberId("");
      setMemberSearch("");
      setIsMemberDropdownOpen(false);
      // keep modal open so creator sees the updated member list (issue 2)
      // the newly added user gets the group instantly via WS + cache bust (issue 3)
      // + local refetch so my own list stays fresh even if the event loops back
      fetchChannels();
    } catch {
      // quiet
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!activeChannelId || !activeChannel) return;
    if (!isChannelCreator(activeChannel)) return;
    if (String(memberId) === String(user?.id)) return; // creator cannot remove self here
    const targetEmp = (employees || []).find((e) => String(e.id) === String(memberId));
    const memberName = targetEmp?.name || "this member";
    setConfirmDialog({
      isOpen: true,
      title: "Remove Member",
      message: `Are you sure you want to remove ${memberName} from #${activeChannel.name}?`,
      confirmText: "Remove Member",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(
            `/chat/channels/${activeChannelId}/members/${encodeURIComponent(memberId)}`,
            { showErrorToast: false }
          );
        } catch {
          // ignore, update locally anyway
        }
        setChannels((prev) =>
          prev.map((c) =>
            (c.id || (c as any)._id) === activeChannelId
              ? { ...c, members: (c.members || []).filter((m) => String(m) !== String(memberId)) }
              : c
          )
        );
        fetchChannels();
      }
    });
  };

  const handleDeleteChannel = () => {
    if (!activeChannelId || !activeChannel) return;
    if (!isChannelCreator(activeChannel)) return;
    setConfirmDialog({
      isOpen: true,
      title: "Delete Channel",
      message: `Are you sure you want to permanently delete #${activeChannel.name}? All message history in this channel will be removed.`,
      confirmText: "Delete Channel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/chat/channels/${activeChannelId}`, { showErrorToast: false });
        } catch {
          // ignore
        }
        setChannels((prev) => prev.filter((c) => (c.id || (c as any)._id) !== activeChannelId));
        setActiveChannelId(null);
        setMessages([]);
        setIsEditChannelOpen(false);
      }
    }); 
  };

  // --- 14. START DIRECT MESSAGE (guard against double-click creating duplicates) ---
  const startingDmRef = useRef(false);
  const handleStartDm = async (empId: string) => {
    if (startingDmRef.current) return;
    startingDmRef.current = true;
    try {
      const res = await api.post<ChatChannel>(
        "/chat/channels/dm",
        { other_user_id: empId },
        { showErrorToast: false }
      );
      if (res) {
        const id = (res as any).id || (res as any)._id;
        setChannels((prev) => {
          if (!prev.some((c) => (c.id || (c as any)._id) === id)) {
            return [...prev, res];
          }
          return prev;
        });
        // set active only if changed - avoids refetch loop that caused 3x hello
        if (activeChannelIdRef.current !== id) {
          setActiveChannelId(id);
        }
        focusMessageInput();
      }
      unhideDm(empId);
      setIsNewDmOpen(false);
    } catch {
      // quiet fail
    } finally {
      setTimeout(() => {
        startingDmRef.current = false;
      }, 800);
    }
  };

  // Filter channels & DMs by search
  const filteredChannels = channels.filter(
    (c) => !isDirect(c) && (c.name || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  const filteredDms = channels
    .filter((c) => isDirect(c))
    .map((c) => ({
      ...c,
      other_user: getDmOtherUser(c)
    }))
    .filter((c) => (c.other_user?.name || c.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()));

  // If no DMs in DB yet, show fallback direct messages from employees (filter out hidden DMs - Task 45)
  const displayDms = (
    filteredDms.length > 0
      ? filteredDms
      : (employees || []).slice(0, 4).map((emp) => ({
          id: `dm-${emp.id}`,
          name: emp.name,
          type: "direct",
          is_dm: true,
          members: [emp.id],
          created_by: "system",
          created_at: "",
          unread_count: emp.id === employees?.[0]?.id ? 2 : 0,
          other_user: {
            id: emp.id,
            name: emp.name,
            avatar: emp.avatar || emp.profile_photo,
            is_online: presenceMap[emp.id] ?? false
          }
        }))
  ).filter((dm) => {
    const dmId = String(dm.id || (dm as any)._id);
    const targetUserId = String(dm.other_user?.id || "");
    if (
      (hiddenDms.has(dmId) || hiddenDms.has(targetUserId)) &&
      activeChannelId !== dmId &&
      !dm.unread_count
    ) {
      return false;
    }
    return true;
  });

  // Active channel details
  const activeChannel = channels.find((c) => (c.id || (c as any)._id) === activeChannelId);
  const isCurrentDm = activeChannel ? isDirect(activeChannel) : false;
  const currentDmUser = activeChannel && isCurrentDm ? getDmOtherUser(activeChannel) : null;
  const isSelfChat = Boolean(
    activeChannel?.type === "self" ||
    String(activeChannel?.name || "").toLowerCase().includes("yourself") ||
    activeChannel?.name === "You" ||
    activeChannel?.name === "You (Message Yourself)"
  );
  const activeChannelName = isSelfChat
    ? "You (Message Yourself)"
    : isCurrentDm
    ? currentDmUser?.name || activeChannel?.name || "Direct Message"
    : activeChannel?.name || "engineering";

  // Members of active channel (matches both emp.id and emp._id - Task 42)
  const activeChannelMemberEmployees = React.useMemo(() => {
    if (!activeChannel || isCurrentDm) return [];
    const memberIds = (activeChannel.members || []).map(String);
    return (employees || []).filter((emp) => {
      const eId = String(emp.id);
      const eAltId = String((emp as any)?._id || "");
      return memberIds.includes(eId) || (eAltId && memberIds.includes(eAltId));
    });
  }, [activeChannel, isCurrentDm, employees]);

  // In-Chat Search matches & navigation (Task 37)
  const matchingMessageIds = React.useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase();
    return messages
      .filter((m) =>
        (m.content && m.content.toLowerCase().includes(q)) ||
        (m.file_name && m.file_name.toLowerCase().includes(q))
      )
      .map((m) => m.id);
  }, [messages, chatSearchQuery]);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  }, []);

  const handleNextSearchMatch = useCallback(() => {
    if (matchingMessageIds.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % matchingMessageIds.length;
    setSearchMatchIndex(nextIdx);
    const targetId = matchingMessageIds[nextIdx];
    if (targetId) scrollToMessage(targetId);
  }, [matchingMessageIds, searchMatchIndex, scrollToMessage]);

  const handlePrevSearchMatch = useCallback(() => {
    if (matchingMessageIds.length === 0) return;
    const prevIdx = (searchMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setSearchMatchIndex(prevIdx);
    const targetId = matchingMessageIds[prevIdx];
    if (targetId) scrollToMessage(targetId);
  }, [matchingMessageIds, searchMatchIndex, scrollToMessage]);

  const matchingMentionMembers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return activeChannelMemberEmployees;
    return activeChannelMemberEmployees.filter((emp) =>
      (emp.name || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q)
    );
  }, [mentionQuery, activeChannelMemberEmployees]);

  const insertMention = (emp: any) => {
    if (!emp) return;
    const name = cleanDisplayName(emp.name);
    const cursorPos = messageInputRef.current?.selectionStart ?? inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");
    if (lastAtIdx !== -1) {
      const newText = textBeforeCursor.slice(0, lastAtIdx) + `@${name} ` + textAfterCursor;
      setInputText(newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus();
          const newPos = lastAtIdx + name.length + 2;
          messageInputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  // --- IST time display (issue: server stores UTC naive stamps like "2026-09-27T11:30:31"
  // which browsers parse as LOCAL time -> wrong clock). Treat tz-less stamps as UTC
  // and always render in Asia/Kolkata. ---
  const parseAsUtc = (dateStr: string): Date => {
    const s = String(dateStr || "").trim();
    if (!s) return new Date(NaN);
    // If no explicit timezone designator, the stamp is UTC from the server -> append Z
    if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
    // Space-separated "YYYY-MM-DD HH:mm:ss" -> ISO
    const iso = s.includes("T") ? s : s.replace(" ", "T");
    return new Date(iso + "Z");
  };

  const formatMsgTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = parseAsUtc(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "";
    }
  };

  // --- Group consecutive image/video messages (WhatsApp album grid, issue 8) ---
  // Same sender + same group_id, or same sender within 90s when both are images.
  type DisplayItem = { kind: "single"; msg: ChatMessage } | { kind: "album"; key: string; msgs: ChatMessage[] };
  const displayItems: DisplayItem[] = React.useMemo(() => {
    const items: DisplayItem[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i] as ChatMessage | undefined;
      if (!m) {
        i++;
        continue;
      }
      const isAlbumMedia = Boolean(m.media_url && (m.media_type === "image" || m.media_type === "video"));
      if (isAlbumMedia) {
        const group: ChatMessage[] = [m];
        let j = i + 1;
        while (j < messages.length) {
          const n = messages[j] as ChatMessage | undefined;
          if (!n) break;
          const nIsMedia = Boolean(n.media_url && (n.media_type === "image" || n.media_type === "video"));
          if (!nIsMedia) break;
          if (String(n.sender_id) !== String(m.sender_id)) break;
          const sameGroup = Boolean(m.group_id && n.group_id && String(m.group_id) === String(n.group_id));
          let closeInTime = false;
          try {
            closeInTime = Math.abs(new Date(n.created_at).getTime() - new Date(m.created_at).getTime()) < 90000;
          } catch {}
          if (!sameGroup && !closeInTime) break;
          // don't merge if either has reply/poll (keep context clear)
          if (n.reply_to || n.poll || m.poll) break;
          group.push(n);
          j++;
          if (group.length >= 8) break;
        }
        if (group.length > 1) {
          items.push({ kind: "album", key: `album-${(group[0] as ChatMessage).id}`, msgs: group });
          i = j;
          continue;
        }
      }
      items.push({ kind: "single", msg: m });
      i++;
    }
    return items;
  }, [messages]);

  const isPdfMsg = (m: ChatMessage) => {
    const n = `${m.file_name || ""} ${m.media_url || ""}`.toLowerCase();
    return m.media_type === "document" && (/\.pdf(\?|$)/.test(n) || (m.file_name || "").toLowerCase().endsWith(".pdf"));
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-card rounded-2xl border border-border overflow-hidden shadow-xs relative">
      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR (EXACT CLEAN SLACK / HRMS DESIGN)        */}
      {/* ======================================================== */}
      <div
        className={cn(
          "w-64 border-r border-border bg-muted/10 flex flex-col shrink-0 transition-all duration-300 md:flex",
          isMobileChannelsOpen ? "fixed inset-y-0 left-0 z-50 bg-background w-72 shadow-xl" : "hidden md:flex"
        )}
      >
        {/* Sidebar Header: "Messages" + Plus button */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-foreground tracking-tight text-base">Messages</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsNewChannelOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              title="New Channel or Message"
            >
              <Plus className="w-4 h-4" />
            </button>
            {isMobileChannelsOpen && (
              <button
                type="button"
                onClick={() => setIsMobileChannelsOpen(false)}
                className="p-1.5 md:hidden text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Jump to... Search Input */}
        <div className="p-3 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Jump to..."
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-muted-foreground transition-all"
            />
          </div>
        </div>

        {/* Desktop Notification Alert Enable Banner */}
        {notifPermission === "default" && (
          <div className="mx-3 mb-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">Desktop Alerts</p>
                <p className="text-[11px] text-muted-foreground truncate">Alerts when app is in background</p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestDesktopNotificationPermission}
              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shrink-0 shadow-xs cursor-pointer transition-all active:scale-95"
            >
              Enable
            </button>
          </div>
        )}

        {/* Sidebar Navigation: CHANNELS & DIRECT MESSAGES */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
          {/* CHANNELS SECTION */}
          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Channels</span>
              <button
                type="button"
                onClick={() => setIsNewChannelOpen(true)}
                className="hover:text-foreground transition-colors cursor-pointer"
                title="Create Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {filteredChannels.map((channel) => {
                const chanId = channel.id || (channel as any)._id;
                const isActive = activeChannelId === chanId;
                return (
                  <button
                    key={chanId}
                    type="button"
                    onClick={() => {
                      setActiveChannelId(chanId);
                      setIsMobileChannelsOpen(false);
                      focusMessageInput();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "text-muted-foreground hover:bg-muted font-medium hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className={cn("w-4 h-4 shrink-0", isActive ? "text-emerald-600" : "opacity-70")} />
                      <span className="truncate">{channel.name}</span>
                    </div>
                    {Boolean(channel.unread_count && channel.unread_count > 0) && (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                        {channel.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Direct Messages</span>
              <button
                type="button"
                onClick={() => setIsNewDmOpen(true)}
                className="hover:text-foreground transition-colors cursor-pointer"
                title="New Direct Message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {displayDms.map((dm) => {
                const dmId = dm.id || (dm as any)._id;
                const isActive = activeChannelId === dmId;
                const dmUser = dm.other_user;
                const isOnline = dmUser ? presenceMap[dmUser.id] ?? dmUser.is_online : false;

                return (
                  <button
                    key={dmId}
                    type="button"
                    onClick={() => {
                      const targetId = (dm.id && !dm.id.startsWith("dm-")) ? dm.id : (dmId || "");
                      if (targetId && !targetId.startsWith("dm-")) {
                        setActiveChannelId(targetId);
                      } else if (dmUser) {
                        handleStartDm(dmUser.id);
                      } else if (targetId) {
                        setActiveChannelId(targetId);
                      }
                      setIsMobileChannelsOpen(false);
                      focusMessageInput();
                    }}
                    className={cn(
                      "w-full group/dm flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "text-muted-foreground hover:bg-muted font-medium hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="relative shrink-0">
                        <UserAvatar
                          name={cleanDisplayName(dmUser?.name || dm.name)}
                          avatar={dmUser?.avatar}
                          size="w-6 h-6"
                          isOnline={isOnline}
                          showStatus={true}
                        />
                      </div>
                      <span className="truncate">{cleanDisplayName(dmUser?.name || dm.name)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {Boolean(dm.unread_count && dm.unread_count > 0) ? (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                          {dm.unread_count}
                        </span>
                      ) : (
                        <span
                          role="button"
                          onClick={(e) => hideDm(String(dmId), e)}
                          title="Hide chat from sidebar"
                          className="opacity-0 group-hover/dm:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN CHAT AREA (OR WHATSAPP-STYLE BLANK SCREEN ON ESC) */}
      {/* ======================================================== */}
      {!activeChannelId || !activeChannel ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 p-8 text-center select-none relative overflow-hidden">
          {/* Mobile open button */}
          <button
            type="button"
            onClick={() => setIsMobileChannelsOpen(true)}
            className="md:hidden absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground bg-card border border-border rounded-xl shadow-xs"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* WhatsApp Web style center illustration & text */}
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 ring-8 ring-emerald-500/5">
            <MessageSquare className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">HK DigiVerse Workplace Chat</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
            Select a conversation from the sidebar to start chatting, or press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded shadow-xs">Esc</kbd> anytime to return to this screen.
          </p>

          <div className="flex items-center gap-8 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setIsNewDmOpen(true)}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:border-emerald-500 group-hover:text-emerald-600 transition-all shadow-xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="group-hover:text-foreground font-medium">New chat</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewChannelOpen(true)}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:border-emerald-500 group-hover:text-emerald-600 transition-all shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <span className="group-hover:text-foreground font-medium">New group</span>
            </button>
          </div>

          <div className="absolute bottom-6 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <ShieldCheck className="w-4 h-4 text-emerald-600/70" />
            <span>End-to-end encrypted internal team communication</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Chat Header: # engineering + Menu & 3 Dots */}
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileChannelsOpen(true)}
              className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground md:hidden rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Open channels"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground text-base sm:text-lg tracking-tight flex items-center gap-1.5 leading-tight truncate">
                {!isCurrentDm && <Hash className="w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground shrink-0" />}
                <span className="truncate">{cleanDisplayName(activeChannelName)}</span>
              </h2>
              {!isCurrentDm && !isSelfChat && activeChannel && (
                <button
                  type="button"
                  onClick={() => {
                    setGroupMemberSearch("");
                    setIsGroupMembersModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer mt-0.5 text-left font-medium"
                  title="View group members (click to see all joined members)"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {(activeChannel.members || []).length} {((activeChannel.members || []).length === 1) ? "member" : "members"}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isCurrentDm && !isSelfChat && activeChannel && (
              <button
                type="button"
                onClick={() => {
                  setGroupMemberSearch("");
                  setIsGroupMembersModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                title="View group members"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">
                  {(activeChannel.members || []).length} members
                </span>
              </button>
            )}

            {/* Task 37: In-Chat Message Search Button */}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
                if (isSearchOpen) setChatSearchQuery("");
              }}
              className={cn(
                "p-2 rounded-lg transition-colors cursor-pointer",
                isSearchOpen
                  ? "text-emerald-600 bg-emerald-500/10 font-bold"
                  : "text-muted-foreground hover:text-emerald-600 hover:bg-muted"
              )}
              title="Search messages in this conversation"
            >
              <Search className="w-4 h-4" />
            </button>

            {!isSelfChat && !isCurrentDm && (
              <button
                type="button"
                onClick={() => setIsPollModalOpen(true)}
                className="p-2 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                title="Create a Poll"
              >
                <BarChart2 className="w-4 h-4" />
              </button>
            )}
            {!isCurrentDm && !isSelfChat && activeChannel && isChannelCreator(activeChannel) && (
              <button
                type="button"
                onClick={openEditChannel}
                className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Edit channel (creator only)"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              title="Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Task 37: In-Chat Search Bar Dropdown */}
        {isSearchOpen && (
          <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-150 shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                value={chatSearchQuery}
                onChange={(e) => {
                  setChatSearchQuery(e.target.value);
                  setSearchMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) handlePrevSearchMatch();
                    else handleNextSearchMatch();
                  } else if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setChatSearchQuery("");
                  }
                }}
                placeholder="Find in this chat... (Press Enter for next, Esc to close)"
                className="w-full pl-9 pr-8 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {chatSearchQuery && (
                <button
                  type="button"
                  onClick={() => setChatSearchQuery("")}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {chatSearchQuery.trim() && (
                <span className="font-mono text-[11px]">
                  {matchingMessageIds.length > 0
                    ? `${searchMatchIndex + 1} / ${matchingMessageIds.length}`
                    : "No matches"}
                </span>
              )}
              <button
                type="button"
                disabled={matchingMessageIds.length === 0}
                onClick={handlePrevSearchMatch}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
                title="Previous match (Shift + Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={matchingMessageIds.length === 0}
                onClick={handleNextSearchMatch}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setChatSearchQuery("");
                }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                title="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* In-app slide-in notification (top-right) - click opens that chat */}
        {notifyToast && (
          <div
            onClick={() => {
              setActiveChannelId(notifyToast.channelId);
              setNotifyToast(null);
            }}
            className="absolute top-3 right-3 z-40 w-80 max-w-[calc(100%-2rem)] bg-card border border-border shadow-2xl rounded-2xl p-3 flex items-start gap-2.5 cursor-pointer animate-in slide-in-from-right duration-300 hover:shadow-xl"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
              {(notifyToast.sender || "N").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-foreground truncate">{notifyToast.sender}</div>
              <div className="text-[11px] text-muted-foreground truncate">{notifyToast.text}</div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Click to open chat</div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNotifyToast(null);
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. MESSAGE LIST (AVATAR + NAME + TIMESTAMP + BUBBLES)     */}
        {/* ======================================================== */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 relative transition-colors",
            isDraggingOver && "bg-emerald-500/10 ring-2 ring-emerald-500/50 ring-inset"
          )}
          onPaste={handlePaste}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
            if (droppedFiles.length === 0) return;
            const imgFiles = droppedFiles.filter(
              (f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)
            );
            if (imgFiles.length > 0) {
              addMorePasteImages(imgFiles);
            } else {
              handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
            }
          }}
        >
          {isDraggingOver && (
            <div className="absolute inset-4 z-40 border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded-2xl flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs animate-in fade-in">
              <ImageIcon className="w-10 h-10 text-emerald-600 mb-2 animate-bounce" />
              <p className="text-sm font-bold text-foreground">Drop images or files here to send</p>
              <p className="text-xs text-muted-foreground mt-0.5">Supports PNG, JPG, WebP, PDF & documents</p>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
                <Hash className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground text-base">This is the start of #{activeChannelName}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Send a message, upload images/files, or record voice notes to start chatting.
              </p>
            </div>
          ) : (
            displayItems.map((item) => {
              const isAlbum = item.kind === "album";
              const albumMsgs: ChatMessage[] = isAlbum ? (item as any).msgs : [];
              const msg: ChatMessage = isAlbum ? (albumMsgs[0] as ChatMessage) : ((item as any).msg as ChatMessage);
              const isMe = Boolean(msg.isMe);
              const isHighlighted = highlightedMsgId === msg.id;

              // --- WhatsApp album grid (issue 8): 1 full, 2 side-by-side, 3 = 1+2, 4 = 2x2, 4+ = overlay +N ---
              if (isAlbum) {
                const total = albumMsgs.length;
                const shown = albumMsgs.slice(0, 4);
                const extra = total - 4;
                const captionMsg = [...albumMsgs].reverse().find((a) => (a.content || "").trim() && !/^.+\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test((a.content || "").trim())) || (albumMsgs[albumMsgs.length - 1] as ChatMessage);
                const caption = (captionMsg?.content || "").trim();
                const showCaption = caption && !/^.+\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|pdf|doc|docx)$/i.test(caption);
                return (
                  <div
                    key={(item as any).key}
                    id={`msg-${msg.id}`}
                    data-album-containing={albumMsgs.map((a) => a.id).join(" ")}
                    className={cn(
                      "flex gap-2.5 items-start w-full transition-all duration-300 rounded-lg px-1 py-0.5",
                      isMe ? "flex-row-reverse" : "flex-row",
                      isHighlighted ? "bg-emerald-500/15 ring-2 ring-emerald-500" : ""
                    )}
                  >
                    <div className="pt-5 shrink-0">
                      <UserAvatar name={msg.sender_name} avatar={msg.sender_avatar} size="w-9 h-9" showStatus={false} />
                    </div>
                    <div className={cn("flex flex-col gap-1 min-w-0 max-w-[75%] sm:max-w-[65%]", isMe ? "items-end" : "items-start")}>
                      <div className={cn("flex items-baseline gap-1.5 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                        <span className="font-bold text-[13px] leading-none text-foreground whitespace-nowrap">{cleanDisplayName(msg.sender_name)}</span>
                        <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">{formatMsgTime(msg.created_at)}</span>
                      </div>
                      <div className={cn("relative group flex items-end gap-1.5 max-w-full mb-2", isMe ? "flex-row-reverse" : "flex-row")}>
                        <div
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                          className={cn("rounded-[18px] p-1.5 w-fit max-w-full", isMe ? "bg-[#00a36c] dark:bg-emerald-600" : "bg-[#f0f2f5] dark:bg-muted")}
                        >
                          {(() => {
                            const albumReply = albumMsgs.map((a) => a.reply_to).find(Boolean) || msg.reply_to;
                            return albumReply ? (
                              <ReplyQuote reply={albumReply} isMe={isMe} onNavigate={() => scrollToOriginalMessage(albumReply.id)} />
                            ) : null;
                          })()}
                          <div className={cn("grid gap-1 rounded-xl overflow-hidden", total === 2 ? "grid-cols-2" : total === 3 ? "grid-cols-2" : "grid-cols-2")}>
                            {shown.map((am, idx2) => (
                              <div
                                key={am.id}
                                onClick={() => openMediaViewer(am)}
                                onContextMenu={(e) => handleContextMenu(e, am, { url: am.media_url || "", name: am.file_name || "image.jpg", type: am.media_type || "image" })}
                                className={cn(
                                  "relative overflow-hidden cursor-pointer bg-black/10",
                                  total === 3 && idx2 === 0 ? "col-span-2 h-44" : "h-32 sm:h-36",
                                  total === 1 ? "col-span-2 h-56" : ""
                                )}
                              >
                                {am.media_type === "video" ? (
                                  <video src={getMediaUrl(am.media_url)} preload="metadata" className="w-full h-full object-cover" />
                                ) : (
                                  <img src={getMediaUrl(am.media_url)} alt="attachment" className="w-full h-full object-cover" loading="lazy" />
                                )}
                                {idx2 === 3 && extra > 0 && (
                                  <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-2xl font-bold">+{extra + 1}</div>
                                )}
                                {am.media_type === "video" && (
                                  <div className="absolute inset-0 flex items-center justify-center"><span className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"><Play className="w-4 h-4 ml-0.5 fill-current" /></span></div>
                                )}
                              </div>
                            ))}
                          </div>
                          {showCaption && (
                            <div className={cn("px-2 pt-1.5 pb-1 text-[13.5px] break-words whitespace-pre-wrap select-text", isMe ? "text-white" : "text-[#111b21] dark:text-foreground")}>
                              {renderFormattedText(caption)}
                            </div>
                          )}
                          {/* Status checkmarks (no duplicate time - time is already in top header) */}
                          {isMe && (
                            <div className="px-2 pb-0.5 text-[10px] flex items-center justify-end">
                              {isMessageSeen(msg) ? (
                                <span title="Seen"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} /></span>
                              ) : (
                                <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-white/70" strokeWidth={2} /></span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-xs p-0.5", isMe ? "flex-row-reverse" : "")}>
                          <button
                            type="button"
                            onClick={() => { setReplyTo(msg); focusMessageInput(); }}
                            title="Reply"
                            className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded cursor-pointer"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            title="Copy image / album"
                            className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForwardMsg(msg);
                              setForwardTargets([]);
                              setForwardSearch("");
                            }}
                            title="Forward"
                            className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded cursor-pointer text-xs font-bold"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/40 ml-0.5">
                            {DEFAULT_REACTIONS.map((emoji) => {
                              const isReacted = (msg.reactions?.[emoji] || []).includes(String(user?.id));
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleReact(msg.id, emoji)}
                                  title={`React ${emoji}`}
                                  className={cn(
                                    "w-6 h-6 flex items-center justify-center text-sm hover:scale-130 active:scale-95 transition-transform duration-150 rounded-full cursor-pointer",
                                    isReacted && "bg-emerald-500/20 scale-110"
                                  )}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setReactionPickerMsgId(msg.id)}
                              title="More reactions (+)"
                              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full text-xs font-bold transition-transform hover:scale-115 cursor-pointer ml-0.5"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={cn(
                    "flex gap-2.5 items-start w-full transition-all duration-300 rounded-lg px-1 py-0.5",
                    isMe ? "flex-row-reverse" : "flex-row",
                    isHighlighted ? "bg-emerald-500/15 ring-2 ring-emerald-500" : ""
                  )}
                >
                  {/* Sender Avatar - left for others, right for me (like reference image) */}
                  <div className="pt-5 shrink-0">
                    <UserAvatar
                      name={msg.sender_name}
                      avatar={msg.sender_avatar}
                      size="w-9 h-9"
                      isOnline={presenceMap[msg.sender_id] ?? false}
                      showStatus={false}
                    />
                  </div>

                  {/* Message Content Stack */}
                  <div
                    className={cn(
                      "flex flex-col gap-1 min-w-0 max-w-[75%] sm:max-w-[65%]",
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    {/* Header: Sender Name + Timestamp (like reference: Sarah Connor 10:24 AM) */}
                    <div className={cn("flex items-baseline gap-1.5 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                      <span className="font-bold text-[13px] leading-none text-foreground whitespace-nowrap">
                        {cleanDisplayName(msg.sender_name)}
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">
                        {formatMsgTime(msg.created_at)}
                      </span>
                    </div>

                    {/* Speech Bubble Container with Hover Actions */}
                    <div className={cn("relative group flex items-end gap-1.5 max-w-full mb-2", isMe ? "flex-row-reverse" : "flex-row")}>
                      {/* Bubble - fully rounded like reference image */}
                      <div
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                        className={cn(
                          "px-3.5 py-2 rounded-[18px] text-[13.5px] leading-[1.45] shadow-none relative transition-all w-fit max-w-full break-words",
                          isMe
                            ? "bg-[#00a36c] dark:bg-emerald-600 text-white"
                            : "bg-[#f0f2f5] dark:bg-muted text-[#111b21] dark:text-foreground"
                        )}
                      >
                        {/* Forwarded label (issue 7) */}
                        {msg.is_forwarded && (
                          <div className={cn("flex items-center gap-1 text-[10px] italic opacity-70 mb-1", isMe ? "text-white" : "text-muted-foreground")}>
                            <span>➦</span>
                            <span>Forwarded</span>
                          </div>
                        )}
                        {/* QUOTED REPLY PREVIEW (WhatsApp Style with Click-to-Scroll) */}
                        {msg.reply_to && (
                          <ReplyQuote reply={msg.reply_to} isMe={isMe} onNavigate={() => scrollToOriginalMessage(msg.reply_to!.id)} />
                        )}

                        {/* INLINE MEDIA (Image, Video, Audio, Doc) - auto-detect audio by extension too */}
                        {msg.media_url && (
                          <div className="mb-2">
                            {msg.media_type === "image" && (
                              <div
                                onClick={() => openMediaViewer(msg)}
                                onContextMenu={(e) => handleContextMenu(e, msg, { url: msg.media_url!, name: msg.file_name || "image.jpg", type: "image" })}
                                className="rounded-xl overflow-hidden cursor-pointer max-w-sm max-h-72 border border-black/10 group/img relative"
                              >
                                <img
                                  src={getMediaUrl(msg.media_url)}
                                  alt={msg.file_name || "attachment"}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform group-hover/img:scale-105 duration-200"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Maximize2 className="w-5 h-5" />
                                </div>
                              </div>
                            )}

                            {msg.media_type === "video" && (
                              <div
                                onContextMenu={(e) => handleContextMenu(e, msg, { url: msg.media_url!, name: msg.file_name || "video.mp4", type: "video" })}
                                className="rounded-xl overflow-hidden max-w-sm border border-black/10 bg-black relative group/vid"
                              >
                                <video
                                  src={getMediaUrl(msg.media_url)}
                                  controls
                                  preload="metadata"
                                  className="w-full max-h-64 object-contain cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadViaBlob(msg.media_url, msg.file_name || "video.mp4");
                                  }}
                                  title="Download Video (Save As)"
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover/vid:opacity-100 cursor-pointer z-10"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {(msg.media_type === "audio" ||
                              (msg.file_name && /\.(webm|mp3|wav|ogg|m4a|aac)$/i.test(msg.file_name)) ||
                              (msg.media_url && /\.(webm|mp3|wav|ogg|m4a|aac)(\?|$)/i.test(msg.media_url))) && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <VoicePlayer audioUrl={msg.media_url} isMe={isMe} fileName={msg.file_name} onDownload={downloadViaBlob} />
                              </div>
                            )}

                            {(msg.media_type === "document" ||
                              (!msg.media_type &&
                                msg.media_url &&
                                !/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|mp3|wav|ogg|m4a)$/i.test(
                                  msg.file_name || msg.media_url
                                ))) && (
                              <>
                                {isPdfMsg(msg) ? (
                                  <div className={cn("rounded-xl overflow-hidden min-w-[240px] sm:min-w-[280px]", isMe ? "bg-black/15" : "bg-card border border-border")}>
                                    <div className="px-3 pt-2.5 pb-1 text-[11px] opacity-70 font-medium">{msg.sender_name}</div>
                                    <div className={cn("mx-2.5 rounded-lg px-3 py-2.5 flex items-center gap-2.5", isMe ? "bg-black/20" : "bg-muted/60")}>
                                      <span className="w-9 h-11 rounded bg-rose-600 text-white flex flex-col items-center justify-center text-[8px] font-black shrink-0">PDF</span>
                                      <div className="min-w-0 flex-1">
                                        <div className={cn("text-xs font-bold truncate", isMe ? "text-white" : "text-foreground")}>{msg.file_name || "document.pdf"}</div>
                                        <div className={cn("text-[10px] opacity-70", isMe ? "text-white" : "text-muted-foreground")}>
                                          {formatFileSize(msg.file_size) ? `${formatFileSize(msg.file_size)} • ` : ""}PDF
                                          <span className="float-right">{formatMsgTime(msg.created_at)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center text-[12px] font-bold">
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setPdfUrl(getMediaUrl(msg.media_url!)); setPdfName(msg.file_name || "document.pdf"); }} className={cn("flex-1 py-2 hover:opacity-80 cursor-pointer", isMe ? "text-white" : "text-emerald-700")}>View</button>
                                      <span className="opacity-20">|</span>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); downloadViaBlob(msg.media_url, msg.file_name || "document.pdf"); }} className={cn("flex-1 py-2 hover:opacity-80 cursor-pointer", isMe ? "text-white" : "text-emerald-700")}>Save as…</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadViaBlob(msg.media_url, msg.file_name || "Attachment"); }}
                                    className={cn(
                                      "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold underline cursor-pointer",
                                      isMe ? "bg-white/10 text-white" : "bg-foreground/5 text-foreground"
                                    )}
                                  >
                                    <Download className="w-4 h-4" />
                                    <span className="truncate max-w-[200px]">{msg.file_name || "Attachment"}</span>
                                    {msg.file_size ? <span className="opacity-60 no-underline">• {formatFileSize(msg.file_size)}</span> : null}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* POLL INTERFACE - WhatsApp Style */}
                        {Boolean(msg.poll && Array.isArray(msg.poll.options) && msg.poll.options.length > 0) && (
                          <div className="min-w-[260px] sm:min-w-[300px] max-w-[360px] space-y-2.5 py-0.5">
                            {/* Poll Header: Question + Selection Mode */}
                            <div className="space-y-0.5 pr-1">
                              <h4 className={cn(
                                "font-bold text-[15px] leading-snug tracking-tight select-text",
                                isMe ? "text-white" : "text-[#111b21] dark:text-foreground"
                              )}>
                                {msg.poll!.question}
                              </h4>
                              <p className={cn(
                                "text-[11px] font-normal tracking-wide",
                                isMe ? "text-white/80" : "text-muted-foreground"
                              )}>
                                {msg.poll!.allow_multiple_answers ? "Select one or more" : "Select one"}
                              </p>
                            </div>

                            {/* Options List */}
                            <div className="space-y-2">
                              {msg.poll!.options.map((opt) => {
                                const totalVotes =
                                  msg.poll!.options.reduce((acc, o) => acc + (Array.isArray(o.voters) ? o.voters.length : 0), 0) || 1;
                                const votes = Array.isArray(opt.voters) ? opt.voters.length : 0;
                                const percent = Math.round((votes / totalVotes) * 100);
                                const hasVoted = Array.isArray(opt.voters) && opt.voters.some((v) => String(v) === myUserId || (myEmployeeId && String(v) === myEmployeeId));

                                // Resolve voter names with fallback
                                const voterItems: Array<{ id: string; name: string }> = (opt.voter_details && opt.voter_details.length > 0)
                                  ? opt.voter_details.map((vd) => {
                                      const sVid = String(vd.id);
                                      const isSelf = sVid === myUserId || (myEmployeeId && sVid === myEmployeeId);
                                      return { id: sVid, name: isSelf ? "You" : (vd.name || "Colleague") };
                                    })
                                  : (opt.voters || []).map((vid) => {
                                      const sVid = String(vid);
                                      const isSelf = sVid === myUserId || (myEmployeeId && sVid === myEmployeeId);
                                      const found = (employees || []).find((e) => String(e.id) === sVid || String((e as any)._id) === sVid);
                                      return { id: sVid, name: isSelf ? "You" : (found?.name || "Colleague") };
                                    });

                                return (
                                  <div key={opt.id} className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleVotePoll(msg.id, opt.id)}
                                      className={cn(
                                        "w-full text-left relative overflow-hidden rounded-xl p-2.5 sm:p-3 text-xs transition-all duration-200 cursor-pointer border select-none group",
                                        isMe
                                          ? hasVoted
                                            ? "bg-black/25 border-white/50 shadow-xs ring-1 ring-white/30"
                                            : "bg-black/15 hover:bg-black/25 border-white/20 hover:border-white/40"
                                          : hasVoted
                                            ? "bg-emerald-500/10 border-emerald-600/60 shadow-xs ring-1 ring-emerald-500/30 dark:bg-emerald-500/15"
                                            : "bg-white dark:bg-card hover:bg-card/80 border-border/80 hover:border-emerald-500/40"
                                      )}
                                    >
                                      {/* Smooth Progress Fill */}
                                      <div
                                        className={cn(
                                          "absolute inset-y-0 left-0 transition-all duration-300 rounded-xl",
                                          isMe ? "bg-white/20" : "bg-emerald-500/15 dark:bg-emerald-500/25"
                                        )}
                                        style={{ width: `${percent}%` }}
                                      />

                                      {/* Option Info Row */}
                                      <div className="relative flex items-center justify-between gap-3 z-10">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          {/* Checkbox / Radio Circle */}
                                          <span
                                            className={cn(
                                              "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-150",
                                              hasVoted
                                                ? isMe
                                                  ? "bg-white text-emerald-800 shadow-xs"
                                                  : "bg-emerald-600 text-white shadow-xs"
                                                : isMe
                                                  ? "border-2 border-white/60 group-hover:border-white"
                                                  : "border-2 border-muted-foreground/50 group-hover:border-emerald-600"
                                            )}
                                          >
                                            {hasVoted && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                                          </span>
                                          <span className={cn(
                                            "text-[13px] font-semibold truncate",
                                            isMe ? "text-white" : "text-foreground"
                                          )}>
                                            {opt.text}
                                          </span>
                                        </div>

                                        {/* Percentage and Vote Count */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={cn(
                                            "text-[11px] font-mono",
                                            isMe ? "text-white/80" : "text-muted-foreground"
                                          )}>
                                            {votes > 0 ? `${votes}` : ""}
                                          </span>
                                          <span className={cn(
                                            "text-[11.5px] font-bold font-mono px-1.5 py-0.5 rounded-md",
                                            isMe ? "bg-white/20 text-white" : "bg-muted text-foreground"
                                          )}>
                                            {percent}%
                                          </span>
                                        </div>
                                      </div>
                                    </button>

                                    {/* High-Contrast Voter Badges */}
                                    {voterItems.length > 0 && !msg.poll?.hide_voters_name && (
                                      <div className="flex items-center flex-wrap gap-1 px-1 pt-0.5">
                                        {voterItems.slice(0, 3).map((voter, vIdx) => (
                                          <span
                                            key={vIdx}
                                            className={cn(
                                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium transition-colors",
                                              isMe
                                                ? "bg-black/35 text-white border border-white/25 shadow-xs"
                                                : "bg-card text-foreground border border-border/80 shadow-2xs"
                                            )}
                                          >
                                            <span className={cn(
                                              "w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0",
                                              isMe ? "bg-white/25 text-white" : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                                            )}>
                                              {voter.name.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="max-w-[120px] truncate">{voter.name}</span>
                                          </span>
                                        ))}
                                        {voterItems.length > 3 && (
                                          <span className={cn(
                                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                            isMe ? "bg-black/30 text-white/90" : "bg-muted text-muted-foreground"
                                          )}>
                                            +{voterItems.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* WhatsApp Style Footer: "View votes" + Count + Time & Status Tick */}
                            <div className={cn(
                              "pt-2 mt-2 border-t flex items-center justify-between gap-2",
                              isMe ? "border-white/20" : "border-border/60"
                            )}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewVotesPollMsg(msg);
                                }}
                                className={cn(
                                  "text-[11.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors px-2 py-1 rounded-lg",
                                  isMe
                                    ? "bg-white/15 text-white hover:bg-white/25"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                                )}
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>View votes</span>
                              </button>

                              <div className="flex items-center gap-2">
                                <span className={cn("text-[11px] font-medium", isMe ? "text-white/85" : "text-muted-foreground")}>
                                  {msg.poll!.options.reduce((acc, o) => acc + (Array.isArray(o.voters) ? o.voters.length : 0), 0)} votes
                                </span>
                                <span className={cn("text-[10px] flex items-center gap-1 ml-0.5", isMe ? "text-white/75" : "text-muted-foreground")}>
                                  <span>{formatMsgTime(msg.created_at)}</span>
                                  {isMe && (
                                    <span title={isMessageSeen(msg) ? "Seen / Read" : "Delivered"}>
                                      {isMessageSeen(msg) ? (
                                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} />
                                      ) : (
                                        <CheckCheck className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
                                      )}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TEXT MESSAGE CONTENT - WhatsApp style (tick inline, no extra line) */}
                        {msg.content && !msg.poll && (
                          <div className={cn("break-words select-text relative", isMe && "pr-6")}>
                            {msg.content.length > 700 && !expandedMessages.has(msg.id) ? (
                              <>
                                <div>{renderFormattedText(msg.content.slice(0, 700), isMe)}</div>
                                <button
                                  type="button"
                                  onClick={() => toggleExpandMessage(msg.id)}
                                  className={cn(
                                    "mt-1 text-xs font-bold underline cursor-pointer",
                                    isMe ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400"
                                  )}
                                >
                                  Read more
                                </button>
                              </>
                            ) : (
                              <>
                                <div>{renderFormattedText(msg.content, isMe)}</div>
                                {msg.content.length > 700 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandMessage(msg.id)}
                                    className={cn(
                                      "mt-1 text-xs font-bold underline cursor-pointer",
                                      isMe ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400"
                                    )}
                                  >
                                    Show less
                                  </button>
                                )}
                              </>
                            )}
                            {/* WhatsApp style tick — absolute at end of last line, never a new line */}
                            {isMe && (
                              <span
                                className="absolute bottom-0 right-0 inline-flex items-center leading-none"
                                title={isMessageSeen(msg) ? "Seen / Read" : "Delivered"}
                              >
                                {isMessageSeen(msg) ? (
                                  <CheckCheck
                                    className="w-4 h-4 text-[#53bdeb]"
                                    strokeWidth={2.5}
                                  />
                                ) : (
                                  <CheckCheck
                                    className="w-4 h-4 text-white/70 dark:text-muted-foreground"
                                    strokeWidth={2}
                                  />
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Fallback tick for media-only messages (no text) - also inline */}
                        {isMe && !msg.content && !msg.poll && (
                          <span
                            className="float-right inline-flex items-center ml-2 mt-1"
                            title={isMessageSeen(msg) ? "Seen / Read" : "Delivered"}
                          >
                            {isMessageSeen(msg) ? (
                              <CheckCheck className="w-4 h-4 text-[#53bdeb]" strokeWidth={2.5} />
                            ) : (
                              <CheckCheck className="w-4 h-4 text-white/70 dark:text-muted-foreground" strokeWidth={2} />
                            )}
                          </span>
                        )}

                        {/* EMOJI REACTIONS BADGE - Overlapping bubble bottom corner (WhatsApp style) */}
                        {Boolean(msg.reactions && typeof msg.reactions === "object" && Object.values(msg.reactions).some(u => Array.isArray(u) && u.length > 0)) && (
                          <div
                            className={cn(
                              "absolute -bottom-3 z-10 flex items-center gap-1 bg-card dark:bg-card border border-border shadow-md rounded-full px-2 py-0.5 text-xs select-none transition-transform hover:scale-105",
                              isMe ? "right-3" : "left-3"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                              if (!Array.isArray(userIds) || userIds.length === 0) return null;
                              const hasReacted = userIds.includes(String(user?.id));
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(msg.id, emoji);
                                  }}
                                  title={`${userIds.length} reactions`}
                                  className={cn(
                                    "flex items-center gap-0.5 transition-transform hover:scale-110 cursor-pointer",
                                    hasReacted ? "opacity-100 font-bold" : "opacity-80"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  {userIds.length > 1 && (
                                    <span className="text-[10px] text-muted-foreground font-semibold">{userIds.length}</span>
                                  )}
                                </button>
                              );
                            })}
                            {(() => {
                              const total = (Object.values(msg.reactions) as string[][]).reduce(
                                (a, u) => a + (Array.isArray(u) ? u.length : 0),
                                0
                              );
                              const activeEmojis = Object.keys(msg.reactions).filter(
                                (k) => Array.isArray(msg.reactions[k]) && msg.reactions[k].length > 0
                              );
                              return total > 1 && activeEmojis.length > 1 ? (
                                <span className="text-[10px] font-semibold text-muted-foreground pl-0.5">{total}</span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* HOVER QUICK ACTIONS (REPLY, COPY, FORWARD, REACT, DOWNLOAD, DELETE) */}
                      <div
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-xs p-0.5",
                          isMe ? "flex-row-reverse" : ""
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(msg);
                            focusMessageInput();
                          }}
                          title="Reply"
                          className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded transition-colors cursor-pointer"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          title={msg.media_type === "image" ? "Copy image" : "Copy text"}
                          className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForwardMsg(msg);
                            setForwardTargets([]);
                            setForwardSearch("");
                          }}
                          title="Forward (multiple chats)"
                          className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        {msg.media_url && (
                          <button
                            type="button"
                            onClick={() => downloadViaBlob(msg.media_url, msg.file_name || "media")}
                            title="Download (Save As)"
                            className="p-1 text-muted-foreground hover:text-emerald-600 hover:bg-muted rounded transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* WhatsApp Reaction Pill (Screenshot 3: 👍 ❤️ 😂 😮 😢 🙏 +) */}
                        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/40">
                          {DEFAULT_REACTIONS.map((emoji) => {
                            const isReacted = (msg.reactions?.[emoji] || []).includes(String(user?.id));
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(msg.id, emoji)}
                                title={`React ${emoji}`}
                                className={cn(
                                  "w-6 h-6 flex items-center justify-center text-sm hover:scale-130 active:scale-95 transition-transform duration-150 rounded-full cursor-pointer",
                                  isReacted && "bg-emerald-500/20 scale-110"
                                )}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setReactionPickerMsgId(msg.id)}
                            title="More reactions (+)"
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full text-xs font-bold transition-transform hover:scale-115 cursor-pointer ml-0.5"
                          >
                            +
                          </button>
                        </div>
                        {canDeleteChatMessages && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete message"
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ======================================================== */}
        {/* 4. MESSAGE INPUT (EXACT ROUNDED CONTAINER WITH + & G)    */}
        {/* ======================================================== */}
        <div className="p-4 bg-card border-t border-border shrink-0">
          {/* Active Reply Banner (WhatsApp Style) */}
          {replyTo && (
            <div className="flex items-center justify-between bg-muted/60 border-l-4 border-emerald-500 px-3 py-1.5 rounded-t-lg mb-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-150 gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-emerald-600 block text-[11px]">
                  Replying to {replyTo.sender_name}
                </span>
                <span className="text-muted-foreground truncate block text-[11px]">
                  {replyTo.content && !/^.+\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|pdf)$/i.test(replyTo.content.trim())
                    ? replyTo.content
                    : replyTo.media_type === "image"
                    ? "📷 Photo"
                    : replyTo.media_type === "video"
                    ? "🎬 Video"
                    : replyTo.media_type === "audio"
                    ? "🎤 Voice message"
                    : replyTo.file_name || (replyTo.media_type ? `[${replyTo.media_type}]` : "")}
                </span>
              </div>
              {replyTo.media_url && (replyTo.media_type === "image" || replyTo.media_type === "video") && (
                <span className="w-9 h-9 rounded-md overflow-hidden shrink-0 bg-black/10 border border-black/10">
                  {replyTo.media_type === "video" ? (
                    <video src={getMediaUrl(replyTo.media_url)} preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={getMediaUrl(replyTo.media_url)} alt="" className="w-full h-full object-cover" />
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  focusMessageInput();
                }}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Live Voice Recording Active Bar - WhatsApp Style matching Screenshot */}
          {isRecording ? (
            <div className="flex items-center justify-between bg-card border border-border rounded-full px-3 py-1.5 shadow-sm gap-2 sm:gap-3 transition-all">
              {/* Trash can button (Green circular outline) */}
              <button
                type="button"
                onClick={cancelRecording}
                className="w-9 h-9 rounded-full border border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Cancel & Delete Recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Red dot indicator */}
              <span className={cn("w-2.5 h-2.5 rounded-full bg-red-600 shrink-0", isRecordingPaused ? "opacity-40" : "animate-pulse")} />

              {/* Timer text */}
              <span className="text-sm font-semibold text-foreground font-mono shrink-0 select-none">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>

              {/* Animated audio sound wave visualizer bars */}
              <div className="flex-1 flex items-center justify-center gap-1 h-6 overflow-hidden px-2 select-none">
                {[14, 22, 10, 26, 18, 28, 12, 24, 16, 26, 10, 20, 16, 24, 18, 12].map((baseH, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-1 rounded-full transition-all duration-150",
                      isRecordingPaused ? "bg-muted-foreground/30 h-1.5" : "bg-emerald-500 dark:bg-emerald-400"
                    )}
                    style={{
                      height: isRecordingPaused
                        ? "4px"
                        : `${Math.max(4, (baseH * (((recordingSeconds + i) % 4) + 1) * 0.3) % 24)}px`,
                      animation: isRecordingPaused ? "none" : `pulse 0.7s ease-in-out infinite ${(i * 0.05).toFixed(2)}s`
                    }}
                  />
                ))}
              </div>

              {/* Pause / Resume Button (Red Pause icon) */}
              <button
                type="button"
                onClick={togglePauseResumeRecording}
                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-full transition-colors cursor-pointer shrink-0"
                title={isRecordingPaused ? "Resume recording" : "Pause recording"}
              >
                {isRecordingPaused ? (
                  <Play className="w-5 h-5 fill-rose-600 text-rose-600" />
                ) : (
                  <Pause className="w-5 h-5 fill-rose-600 text-rose-600" />
                )}
              </button>

              {/* Green Circular Send Button */}
              <button
                type="button"
                onClick={stopRecording}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer shrink-0 ml-1"
                title="Send Voice Message"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </div>
          ) : (
            /* Input Box matching the user screenshot */
            <form
              onSubmit={handleSendMessage}
              className="relative flex items-end gap-2 bg-background border border-emerald-300 dark:border-emerald-600 rounded-2xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-400/30 transition-all"
            >
              {/* WhatsApp-style @ Mention Popup for Group Members (Issue 3) */}
              {mentionQuery !== null && matchingMentionMembers.length > 0 && !isCurrentDm && (
                <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 max-h-56 overflow-y-auto bg-card border border-border shadow-2xl rounded-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1 flex items-center justify-between">
                    <span>Group Members</span>
                    <span className="text-[10px] lowercase text-emerald-600 font-semibold">{matchingMentionMembers.length} matches</span>
                  </div>
                  <div className="space-y-0.5">
                    {matchingMentionMembers.map((emp, idx) => (
                      <button
                        key={emp.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(emp);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer",
                          idx === mentionIndex
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <UserAvatar
                          name={cleanDisplayName(emp.name)}
                          avatar={emp.avatar || emp.profile_photo}
                          size="w-7 h-7"
                          isOnline={Boolean(presenceMap[emp.id])}
                          showStatus={true}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{cleanDisplayName(emp.name)}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{emp.role || emp.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Plus icon button on left */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer shrink-0 mb-0.5"
                title="Attach Document or Image"
              >
                <Plus className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              />

              {/* Textarea: Suppresses Grammarly 'G' icon (Issue 2) & Handles @ Mentions (Issue 3) */}
              <textarea
                ref={messageInputRef}
                rows={1}
                value={inputText}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                spellCheck={false}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;

                  // WhatsApp-style @ mention trigger for group chats
                  if (!isCurrentDm && activeChannel) {
                    const cursorPos = e.target.selectionStart ?? val.length;
                    const textBeforeCursor = val.slice(0, cursorPos);
                    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\. -]*)$/);
                    if (match) {
                      setMentionQuery(match[1] ?? "");
                      setMentionIndex(0);
                    } else {
                      setMentionQuery(null);
                    }
                  } else {
                    setMentionQuery(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && matchingMentionMembers.length > 0 && !isCurrentDm) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIndex((prev) => (prev + 1) % matchingMentionMembers.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIndex((prev) => (prev - 1 + matchingMentionMembers.length) % matchingMentionMembers.length);
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      const selected = matchingMentionMembers[mentionIndex] || matchingMentionMembers[0];
                      if (selected) {
                        insertMention(selected);
                      }
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                    if (messageInputRef.current) {
                      messageInputRef.current.style.height = "auto";
                    }
                  }
                }}
                onPaste={handlePaste}
                placeholder={isSelfChat ? "Message yourself..." : isCurrentDm ? `Message ${cleanDisplayName(activeChannelName)}` : `Message #${cleanDisplayName(activeChannelName)}`}
                className="w-full bg-transparent border-none focus:outline-none text-sm text-foreground placeholder:text-muted-foreground resize-none max-h-40 overflow-y-auto leading-relaxed py-1.5"
              />

              {/* Action Icons on Right */}
              <div className="flex items-center gap-1 shrink-0 mb-0.5">

                {/* Emoji Picker Button - WhatsApp Web Full Categorized & Searchable Picker */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={cn(
                      "p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg",
                      showEmojiPicker && "text-emerald-600 bg-emerald-500/10"
                    )}
                    title="Insert Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 right-0 sm:-right-4 z-50 shadow-2xl">
                      <WhatsAppEmojiPicker
                        onSelect={(emoji) => {
                          setInputText((prev) => prev + emoji);
                          focusMessageInput();
                        }}
                        onClose={() => setShowEmojiPicker(false)}
                        className="w-[92vw] sm:w-[380px] max-w-[380px]"
                      />
                    </div>
                  )}
                </div>

                {/* Paperclip attachment */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Attach File"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Voice Note Mic */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-1.5 text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Circular Mint/Green Send Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-8 h-8 rounded-full bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-400 text-white flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer ml-1"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </form>
          )}

          <div className="text-center mt-2">
            <span className="text-[10px] font-medium text-muted-foreground">
              <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line, <strong>Ctrl + V</strong> to paste image
            </span>
          </div>
        </div>
      </div>
    )}

      {/* ======================================================== */}
      {/* 5. CLIPBOARD IMAGE PASTE MODAL (WhatsApp Web multi-image style) */}
      {/* ======================================================== */}
      {(pasteFiles.length > 0 || (pasteFile && pastePreviewUrl)) && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="w-full max-w-4xl flex items-center justify-between py-2 shrink-0">
            <button
              type="button"
              onClick={closePasteModal}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
              title="Close / Discard"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center min-w-0">
              <span className="font-bold text-sm text-foreground block truncate">
                {activeChannel?.name ? `#${activeChannel.name}` : "Send Image"}
              </span>
              <span className="text-xs text-muted-foreground">
                {pastePreviewUrls.length} {pastePreviewUrls.length === 1 ? "image" : "images"} selected
              </span>
            </div>
            <div className="w-10" />
          </div>

          {/* Main Preview Area */}
          <div className="flex-1 w-full max-w-3xl flex flex-col items-center justify-center min-h-0 relative my-2">
            <div className="relative max-h-[55vh] w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/10 dark:bg-white/5 border border-border p-2">
              <img
                src={pastePreviewUrls[activePasteIndex] || pastePreviewUrl || ""}
                alt="Selected preview"
                className="max-h-[50vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-lg transition-all"
              />
            </div>

            {/* Caption Input */}
            <div className="w-full max-w-md mt-4 relative">
              <input
                type="text"
                value={pasteCaption}
                onChange={(e) => setPasteCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPastedImage();
                  }
                }}
                placeholder="Add a caption..."
                className="w-full px-4 py-3 bg-muted/80 border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-foreground pr-10 shadow-xs"
              />
            </div>
          </div>

          {/* Bottom Thumbnails & Send Control Strip */}
          <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-3 shadow-xl flex items-center justify-between gap-3 shrink-0">
            {/* Thumbnail Strip */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 flex-1 min-w-0 no-scrollbar">
              {pastePreviewUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePasteIndex(idx)}
                  className={cn(
                    "relative group w-14 h-14 rounded-xl overflow-hidden cursor-pointer shrink-0 border-2 transition-all",
                    activePasteIndex === idx
                      ? "border-emerald-500 scale-105 shadow-md"
                      : "border-transparent opacity-75 hover:opacity-100"
                  )}
                >
                  <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  {/* Discard / Delete button on thumbnail */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePasteImage(idx);
                    }}
                    title="Discard image"
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center opacity-90 transition-colors shadow-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Add More Images Button */}
              <label
                title="Add more images"
                className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-emerald-500 bg-muted/30 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addMorePasteImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="text-xl font-bold">+</span>
              </label>
            </div>

            {/* Send Button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={handleSendPastedImage}
              className="relative w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white flex items-center justify-center transition-all shadow-lg shrink-0 cursor-pointer"
              title="Send images"
            >
              <Send className="w-5 h-5 ml-0.5" />
              {pastePreviewUrls.length > 1 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-800 border-2 border-background text-[10px] font-black flex items-center justify-center text-white">
                  {pastePreviewUrls.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. LIGHTBOX MEDIA PREVIEW MODAL (WhatsApp style, issue 5)   */}
      {/* Header: sender + actions (reply/star/forward/download/menu/close), */}
      {/* arrows, bottom thumbnail strip                                 */}
      {/* ======================================================== */}
      {previewMediaUrl && (
        <div className="fixed inset-0 bg-[#0b141a]/95 z-50 flex flex-col backdrop-blur-md">
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 text-white shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {(() => {
                const cur = (channelMedia[previewIndex] as ChatMessage | undefined) || channelMedia.find((m) => m.media_url === previewMediaUrl);
                return (
                  <>
                    <UserAvatar name={cur?.sender_name || "User"} avatar={cur?.sender_avatar} size="w-9 h-9" showStatus={false} />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{cur?.sender_name || "Media"}</div>
                      <div className="text-[11px] text-white/60">{cur ? formatMsgTime(cur.created_at) : ""}{channelMedia.length > 1 ? ` • ${previewIndex + 1} of ${channelMedia.length}` : ""}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 text-white/85">
              <button type="button" title="Reply" onClick={() => { const cur = (channelMedia[previewIndex] as ChatMessage | undefined) || channelMedia.find((m) => m.media_url === previewMediaUrl); if (cur) setReplyTo(cur); setPreviewMediaUrl(null); }} className="p-2 hover:bg-white/10 rounded-full cursor-pointer"><CornerUpLeft className="w-5 h-5" /></button>
              <button type="button" title="React ❤" onClick={() => { const cur = (channelMedia[previewIndex] as ChatMessage | undefined) || channelMedia.find((m) => m.media_url === previewMediaUrl); if (cur) handleReact(cur.id, "❤️"); }} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-base">❤️</button>
              <button type="button" title="Forward" onClick={() => { const cur = (channelMedia[previewIndex] as ChatMessage | undefined) || channelMedia.find((m) => m.media_url === previewMediaUrl); if (cur) { setForwardMsg(cur); setForwardTargets([]); setForwardSearch(""); } }} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-lg font-bold">➦</button>
              <button type="button" title="Download (Save As)" onClick={() => { const cur = (channelMedia[previewIndex] as ChatMessage | undefined) || channelMedia.find((m) => m.media_url === previewMediaUrl); downloadViaBlob(previewMediaUrl, cur?.file_name || (previewMediaType === "video" ? "video.mp4" : "image.jpg")); }} className="p-2 hover:bg-white/10 rounded-full cursor-pointer"><Download className="w-5 h-5" /></button>
              <button type="button" title="Close (Esc)" onClick={() => setPreviewMediaUrl(null)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
          </div>
          {/* Main stage */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-10 sm:px-16">
            {channelMedia.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => navigatePreview("prev")}
                  title="Previous (Left Arrow)"
                  className="absolute left-2 sm:left-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer select-none text-xl"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => navigatePreview("next")}
                  title="Next (Right Arrow)"
                  className="absolute right-2 sm:right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer select-none text-xl"
                >
                  ›
                </button>
              </>
            )}
            <div onClick={(e) => e.stopPropagation()} className="max-w-4xl max-h-full flex items-center justify-center">
              {previewMediaType === "video" ? (
                <video src={getMediaUrl(previewMediaUrl)} controls autoPlay className="max-h-[68vh] max-w-full rounded-lg shadow-2xl" />
              ) : (
                <img src={getMediaUrl(previewMediaUrl)} alt="fullscreen preview" className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl" />
              )}
            </div>
          </div>
          {/* Bottom thumbnail strip */}
          {channelMedia.length > 1 && (
            <div className="shrink-0 border-t border-white/10 bg-black/30 px-3 py-2 flex gap-1.5 overflow-x-auto justify-start sm:justify-center">
              {channelMedia.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPreviewIndex(idx);
                    setPreviewMediaUrl(m.media_url!);
                    setPreviewMediaType(m.media_type === "video" ? "video" : "image");
                  }}
                  className={cn("w-12 h-12 rounded-md overflow-hidden shrink-0 border-2 cursor-pointer", idx === previewIndex ? "border-emerald-400" : "border-transparent opacity-60 hover:opacity-100")}
                >
                  {m.media_type === "video" ? (
                    <video src={getMediaUrl(m.media_url)} preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={getMediaUrl(m.media_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setPreviewMediaUrl(null)} className="absolute inset-0 -z-10 cursor-zoom-out" aria-hidden />
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CREATE NEW CHANNEL MODAL                               */}
      {/* ======================================================== */}
      {isNewChannelOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Create New Channel</h3>
              <button
                type="button"
                onClick={() => setIsNewChannelOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. general-discussions"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Task 42: Member selection with search */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    Add Members ({newChannelMembers.length > 0 ? `${newChannelMembers.filter((m, i, a) => a.indexOf(m) === i).length} selected` : "Optional"})
                  </label>
                  {newChannelMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNewChannelMembers([])}
                      className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={newChannelMemberSearch}
                    onChange={(e) => setNewChannelMemberSearch(e.target.value)}
                    placeholder="Search colleagues to add..."
                    className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-muted/20 rounded-xl border border-border/60">
                  {(employees || [])
                    .filter((emp) => String(emp.id) !== myUserId && String((emp as any)._id) !== myUserId)
                    .filter((emp) =>
                      !newChannelMemberSearch.trim() ||
                      (emp.name || "").toLowerCase().includes(newChannelMemberSearch.toLowerCase()) ||
                      (emp.email || "").toLowerCase().includes(newChannelMemberSearch.toLowerCase())
                    )
                    .map((emp) => {
                      const empKey = String((emp as any)._id || emp.id);
                      const isSelected = newChannelMembers.includes(empKey) || newChannelMembers.includes(String(emp.id));
                      return (
                        <label
                          key={emp.id}
                          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setNewChannelMembers((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== empKey && id !== String(emp.id))
                                  : [...prev, empKey, String(emp.id)]
                              );
                            }}
                            className="accent-emerald-600 w-3.5 h-3.5 rounded cursor-pointer"
                          />
                          <UserAvatar name={emp.name} avatar={emp.avatar || emp.profile_photo} size="w-6 h-6" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold block truncate">{emp.name}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{emp.designation || emp.email}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Auto-join toggle for future new employees (Issue 5 - default off) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/80">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-semibold text-foreground">Auto-join new employees</div>
                  <div className="text-[10px] text-muted-foreground">
                    Automatically add newly registered employees to this channel (Default: Off)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewChannelAutoJoin(!newChannelAutoJoin)}
                  className={cn(
                    "w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0",
                    newChannelAutoJoin ? "bg-emerald-600 justify-end" : "bg-muted-foreground/30 justify-start"
                  )}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelOpen(false)}
                  className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7b. EDIT CHANNEL MODAL (creator only) */}
      {isEditChannelOpen && activeChannel && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-bold text-foreground text-sm">Edit Channel (creator only)</h3>
              <button
                type="button"
                onClick={() => setIsEditChannelOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditChannel} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={editChannelName}
                  onChange={(e) => setEditChannelName(e.target.value)}
                  placeholder="hello"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-full text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={editChannelDesc}
                  onChange={(e) => setEditChannelDesc(e.target.value)}
                  placeholder="Channel topic..."
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {/* Auto-join toggle for future new employees (Issue 5) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/80">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-semibold text-foreground">Auto-join new employees</div>
                  <div className="text-[10px] text-muted-foreground">
                    Newly added employees in the system will automatically join this channel. Existing members remain unchanged.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditChannelAutoJoin(!editChannelAutoJoin)}
                  className={cn(
                    "w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0",
                    editChannelAutoJoin ? "bg-emerald-600 justify-end" : "bg-muted-foreground/30 justify-start"
                  )}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>
              {/* Issue 1: design-wise custom dropdown (not native select) */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Add member (select employee)
                </label>
                <div className="flex gap-2 items-start" ref={memberDropdownRef}>
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setIsMemberDropdownOpen((v) => !v)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-full text-sm flex items-center justify-between gap-2 hover:border-emerald-500 transition-colors cursor-pointer"
                    >
                      <span className={cn("truncate", editChannelMemberId ? "text-foreground font-semibold" : "text-muted-foreground")}>
                        {editChannelMemberId
                          ? (employees || []).find((e) => String(e.id) === String(editChannelMemberId))?.name || "Selected"
                          : "Select..."}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isMemberDropdownOpen && "rotate-180")} />
                    </button>
                    {isMemberDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            autoFocus
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search employee..."
                            className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto p-1.5">
                          {(employees || [])
                            .filter((emp) => (emp.name || "").toLowerCase().includes(memberSearch.toLowerCase()))
                            .map((emp) => {
                              const already = (activeChannel.members || []).map(String).includes(String(emp.id));
                              const selected = String(editChannelMemberId) === String(emp.id);
                              return (
                                <button
                                  key={emp.id}
                                  type="button"
                                  disabled={already}
                                  onClick={() => {
                                    setEditChannelMemberId(String(emp.id));
                                    setIsMemberDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors",
                                    already ? "opacity-40 cursor-not-allowed" : "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer",
                                    selected ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                                  )}
                                >
                                  <UserAvatar name={emp.name} avatar={emp.avatar || (emp as any).profile_photo} size="w-7 h-7" showStatus={false} />
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-xs font-bold text-foreground truncate">{emp.name}</span>
                                    <span className="block text-[10px] text-muted-foreground truncate">{(emp as any).designation || (emp as any).email || ""}</span>
                                  </span>
                                  {already ? (
                                    <span className="text-[10px] font-bold text-emerald-600">Added ✓</span>
                                  ) : selected ? (
                                    <Check className="w-4 h-4 text-emerald-600" />
                                  ) : null}
                                </button>
                              );
                            })}
                          {(employees || []).filter((emp) => (emp.name || "").toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                            <div className="p-3 text-center text-[11px] text-muted-foreground">No employees found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!editChannelMemberId}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  Members: {(activeChannel.members || []).length} • Only creator can add/edit
                </div>
              </div>
              {/* Issue 2: already-added users list with remove */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Current members ({(activeChannel.members || []).length})
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-2xl border border-border p-1.5 bg-muted/20">
                  {(activeChannel.members || []).length === 0 && (
                    <div className="p-2.5 text-[11px] text-muted-foreground text-center">No members yet</div>
                  )}
                  {(activeChannel.members || []).map((mid) => {
                    const emp = (employees || []).find((e) => String(e.id) === String(mid));
                    const isCreator = String(activeChannel.created_by || "") === String(mid);
                    return (
                      <div key={String(mid)} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-background transition-colors">
                        <UserAvatar name={emp?.name || "User"} avatar={emp?.avatar || (emp as any)?.profile_photo} size="w-7 h-7" showStatus={false} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-bold text-foreground truncate">
                            {emp?.name || String(mid).slice(0, 8)}
                            {String(mid) === String(user?.id) ? " (You)" : ""}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">{isCreator ? "Creator" : (emp as any)?.designation || "Member"}</span>
                        </span>
                        {!isCreator && String(mid) !== String(user?.id) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(String(mid))}
                            title="Remove member"
                            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={handleDeleteChannel}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"
                >
                  Delete channel
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditChannelOpen(false)}
                    className="px-4 py-2 border border-border rounded-full text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7c. GROUP MEMBERS LIST MODAL (Issue 4: visible to all)    */}
      {/* ======================================================== */}
      {isGroupMembersModalOpen && activeChannel && !isCurrentDm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[460px] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-sm truncate flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{cleanDisplayName(activeChannel.name)}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {(activeChannel.members || []).length} {((activeChannel.members || []).length === 1) ? "member joined" : "members joined"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupMembersModalOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Box inside modal */}
            <div className="p-3 border-b border-border bg-muted/20 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={groupMemberSearch}
                  onChange={(e) => setGroupMemberSearch(e.target.value)}
                  placeholder="Search members in this group..."
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Members List */}
            <div className="overflow-y-auto p-3 space-y-1 flex-1">
              {activeChannelMemberEmployees
                .filter((emp) =>
                  !groupMemberSearch.trim() ||
                  (emp.name || "").toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                  (emp.email || "").toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                  (emp.role || "").toLowerCase().includes(groupMemberSearch.toLowerCase())
                )
                .map((emp) => {
                  const isCreator = String(activeChannel.created_by) === String(emp.id);
                  const isCurrent = String(user?.id) === String(emp.id);
                  const isOnline = Boolean(presenceMap[emp.id]);

                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <UserAvatar
                          name={cleanDisplayName(emp.name)}
                          avatar={emp.avatar || emp.profile_photo}
                          size="w-9 h-9"
                          isOnline={isOnline}
                          showStatus={true}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {cleanDisplayName(emp.name)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.2 rounded-md">
                                You
                              </span>
                            )}
                            {isCreator && (
                              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                                Group Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {emp.designation || emp.role || emp.department || emp.email}
                          </div>
                        </div>
                      </div>

                      {/* Direct message button if not current user */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsGroupMembersModalOpen(false);
                            handleStartDm(String(emp.id));
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                          title={`Message ${cleanDisplayName(emp.name)}`}
                        >
                          Message
                        </button>
                      )}
                    </div>
                  );
                })}

              {activeChannelMemberEmployees.filter((emp) =>
                !groupMemberSearch.trim() ||
                (emp.name || "").toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                (emp.email || "").toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                (emp.role || "").toLowerCase().includes(groupMemberSearch.toLowerCase())
              ).length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No group members found matching "{groupMemberSearch}"
                </div>
              )}
            </div>

            {/* Footer with Edit bridge for admin/creator */}
            {isChannelCreator(activeChannel) && (
              <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-muted-foreground">You are the admin of this channel</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsGroupMembersModalOpen(false);
                    openEditChannel();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Manage Members
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. CREATE POLL MODAL                                      */}
      {/* ======================================================== */}
      {isPollModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[420px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                Create a Poll
              </h3>
              <button
                type="button"
                onClick={() => setIsPollModalOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePoll} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g. Which sprint goal should we prioritize?"
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Options
                </label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="multiVote"
                  checked={pollMultiple}
                  onChange={(e) => setPollMultiple(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <label htmlFor="multiVote" className="text-xs text-foreground cursor-pointer">
                  Allow multiple answers
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPollModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700"
                >
                  Create Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. DIRECT MESSAGE USER SELECTION MODAL                    */}
      {/* ======================================================== */}
      {isNewDmOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[390px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                New Direct Message
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsNewDmOpen(false);
                  setNewDmSearch("");
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Task 36: Search colleagues in modal */}
            <div className="p-3 border-b border-border bg-muted/20">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={newDmSearch}
                  onChange={(e) => setNewDmSearch(e.target.value)}
                  placeholder="Search by name, email, designation..."
                  className="w-full pl-8 pr-7 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
                {newDmSearch && (
                  <button
                    type="button"
                    onClick={() => setNewDmSearch("")}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {(employees || [])
                .filter((emp) => String(emp.id) !== myUserId && String((emp as any)._id) !== myUserId)
                .filter((emp) => {
                  if (!newDmSearch.trim()) return true;
                  const q = newDmSearch.toLowerCase();
                  return (
                    (emp.name || "").toLowerCase().includes(q) ||
                    (emp.email || "").toLowerCase().includes(q) ||
                    (emp.designation || "").toLowerCase().includes(q) ||
                    String((emp as any).department || "").toLowerCase().includes(q)
                  );
                })
                .map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setNewDmSearch("");
                      handleStartDm(emp.id);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    <UserAvatar
                      name={emp.name}
                      avatar={emp.avatar || emp.profile_photo}
                      size="w-8 h-8"
                      isOnline={presenceMap[emp.id] ?? false}
                      showStatus={true}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-foreground block truncate">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {emp.designation || (emp as any).department || emp.email}
                      </span>
                    </div>
                  </button>
                ))}
              {(employees || [])
                .filter((emp) => String(emp.id) !== myUserId && String((emp as any)._id) !== myUserId)
                .filter((emp) => {
                  if (!newDmSearch.trim()) return true;
                  const q = newDmSearch.toLowerCase();
                  return (
                    (emp.name || "").toLowerCase().includes(q) ||
                    (emp.email || "").toLowerCase().includes(q) ||
                    (emp.designation || "").toLowerCase().includes(q) ||
                    String((emp as any).department || "").toLowerCase().includes(q)
                  );
                }).length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No colleagues found matching "{newDmSearch}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. FORWARD MODAL (support single/album & contact names)  */}
      {/* ======================================================== */}
      {forwardMsg && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-bold text-foreground text-sm">
                Forward {messageIdsToForward.length > 1 ? `${messageIdsToForward.length} items` : "message"} ({forwardTargets.length} selected)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setForwardMsg(null);
                  setForwardTargets([]);
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-border shrink-0">
              <input
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Search contacts & chats..."
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="mt-2 rounded-xl bg-muted/40 border border-border px-2.5 py-2 text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">➦</span>
                <span className="truncate">
                  {messageIdsToForward.length > 1
                    ? `${messageIdsToForward.length} images/messages`
                    : (forwardMsg.content || (forwardMsg.media_type ? `[${forwardMsg.media_type}]` : "Media") || "").slice(0, 80)}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {forwardOptions
                .filter((opt) => opt.name.toLowerCase().includes(forwardSearch.toLowerCase()))
                .map((opt) => {
                  const checked = forwardTargets.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForwardTargets((prev) => (checked ? prev.filter((t) => t !== opt.id) : [...prev, opt.id]))
                        }
                        className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
                      />
                      {opt.is_dm ? (
                        <UserAvatar name={opt.name} avatar={opt.avatar} size="w-7 h-7" showStatus={false} />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #
                        </span>
                      )}
                      <span className="text-xs font-bold text-foreground truncate flex-1">{opt.name}</span>
                    </label>
                  );
                })}
              {forwardOptions.filter((opt) => opt.name.toLowerCase().includes(forwardSearch.toLowerCase())).length === 0 && (
                <div className="p-4 text-center text-[11px] text-muted-foreground">No matching chats or contacts found</div>
              )}
            </div>
            <div className="p-3 border-t border-border flex justify-end gap-2 shrink-0 bg-muted/20">
              <button
                type="button"
                onClick={() => {
                  setForwardMsg(null);
                  setForwardTargets([]);
                }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={forwardTargets.length === 0 || isForwarding}
                onClick={handleForwardConfirm}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {isForwarding ? "Forwarding..." : `Forward → ${forwardTargets.length ? `(${forwardTargets.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. PDF VIEWER MODAL (issue: PDF like screenshot)          */}
      {/* ======================================================== */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-[#0b141a]/95 z-50 flex flex-col">
          <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 text-white shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-10 rounded bg-rose-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">PDF</span>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate max-w-[50vw]">{pdfName}</div>
                <div className="text-[11px] text-white/60">PDF viewer</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/85">
              <button type="button" onClick={() => downloadViaBlob(pdfUrl, pdfName)} title="Download (Save as…)" className="p-2 hover:bg-white/10 rounded-full cursor-pointer"><Download className="w-5 h-5" /></button>
              <button type="button" onClick={() => setPdfUrl(null)} title="Close" className="p-2 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-white m-2 sm:m-4 rounded-lg overflow-hidden">
            <iframe src={pdfUrl} title={pdfName} className="w-full h-full border-0" />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 12. DESIGN-WISE CONFIRMATION MODAL (Replaces window.confirm) */}
      {/* ======================================================== */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150 p-6 text-center">
            <div
              className={cn(
                "w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-lg font-bold shadow-xs",
                confirmDialog.variant === "danger"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {confirmDialog.variant === "danger" ? (
                <Trash2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <h3 className="font-bold text-foreground text-base mb-1.5">{confirmDialog.title}</h3>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await cb();
                }}
                className={cn(
                  "px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer",
                  confirmDialog.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {confirmDialog.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 13. WHATSAPP REACTION PICKER MODAL (Opened via '+' on message) */}
      {/* ======================================================== */}
      {reactionPickerMsgId && (
        <div
          className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setReactionPickerMsgId(null)}
        >
          <div
            className="w-full max-w-[360px] sm:max-w-[400px] shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <WhatsAppEmojiPicker
              autoFocusSearch={true}
              onSelect={(emoji) => {
                handleReact(reactionPickerMsgId, emoji);
                setReactionPickerMsgId(null);
              }}
              onClose={() => setReactionPickerMsgId(null)}
              className="w-full max-h-[460px]"
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 14. WHATSAPP-STYLE RIGHT CLICK CONTEXT MENU              */}
      {/* ======================================================== */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[220px] bg-card dark:bg-[#233138] border border-border shadow-2xl rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 select-none text-[13px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Reaction Pill on Top (Screenshot 2/3) */}
          <div className="flex items-center justify-between px-2 py-1.5 mb-1 bg-muted/60 dark:bg-[#111b21] rounded-xl border border-border/40">
            {DEFAULT_REACTIONS.map((emoji) => {
              const isReacted = (contextMenu.msg.reactions?.[emoji] || []).includes(String(user?.id));
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    handleReact(contextMenu.msg.id, emoji);
                    setContextMenu(null);
                  }}
                  title={`React ${emoji}`}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center text-base hover:scale-130 active:scale-95 transition-transform rounded-full cursor-pointer",
                    isReacted && "bg-emerald-500/20 scale-110"
                  )}
                >
                  {emoji}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const targetId = contextMenu.msg.id;
                setContextMenu(null);
                setReactionPickerMsgId(targetId);
              }}
              title="More reactions (+)"
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/30 rounded-full text-xs font-bold transition-transform hover:scale-115 cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Context Menu Options */}
          <div className="py-0.5 space-y-0.5">
            {/* WhatsApp style Message Info */}
            <button
              type="button"
              onClick={() => {
                setMessageInfoMsg(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <Info className="w-4 h-4 text-emerald-600" />
              <span>Message info</span>
            </button>

            {/* Poll view votes */}
            {contextMenu.msg.poll && (
              <button
                type="button"
                onClick={() => {
                  setViewVotesPollMsg(contextMenu.msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                <span>View votes</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setReplyTo(contextMenu.msg);
                focusMessageInput();
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <CornerUpLeft className="w-4 h-4 text-muted-foreground" />
              <span>Reply</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const targetMsg = contextMenu.msg;
                const media = contextMenu.mediaItem;
                setContextMenu(null);
                if (media?.url || (targetMsg.media_type === "image" && targetMsg.media_url)) {
                  const urlToCopy = media?.url || targetMsg.media_url!;
                  const ok = await copyImageToClipboard(urlToCopy);
                  if (ok) {
                    toast.success("Image copied to clipboard!");
                  } else {
                    toast.error("Could not copy image");
                  }
                } else if (targetMsg.content) {
                  await navigator.clipboard.writeText(targetMsg.content);
                  toast.success("Message copied!");
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span>
                {contextMenu.mediaItem || contextMenu.msg.media_type === "image" ? "Copy image" : "Copy"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForwardMsg(contextMenu.msg);
                setForwardTargets([]);
                setForwardSearch("");
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
              <span>Forward</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleTogglePin(contextMenu.msg.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <Pin className="w-4 h-4 text-muted-foreground" />
              <span>{contextMenu.msg.is_pinned ? "Unpin message" : "Pin"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toast.info("Starred message");
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium"
            >
              <Star className="w-4 h-4 text-muted-foreground" />
              <span>Star</span>
            </button>

            {(contextMenu.mediaItem || contextMenu.msg.media_url) && (
              <button
                type="button"
                onClick={() => {
                  const url = contextMenu.mediaItem?.url || contextMenu.msg.media_url!;
                  const name = contextMenu.mediaItem?.name || contextMenu.msg.file_name || "media";
                  downloadViaBlob(url, name);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-[#182229] text-foreground transition-colors cursor-pointer text-left font-medium border-t border-border/60 pt-2 mt-1"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                <span>Save as…</span>
              </button>
            )}

            {/* Task 41 & User Access Control: Delete message option strictly governed by Access Control permissions */}
            {canDeleteChatMessages && (
              <button
                type="button"
                onClick={() => {
                  const msgId = contextMenu.msg.id;
                  setContextMenu(null);
                  handleDeleteMessage(msgId);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors cursor-pointer text-left font-medium border-t border-border/60 pt-2 mt-1"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
                <span>Delete message</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 15. POLL VOTES DETAILS MODAL (WhatsApp style)            */}
      {/* ======================================================== */}
      {viewVotesPollMsg && viewVotesPollMsg.poll && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-sm sm:text-base truncate">Poll Details</h3>
                  <p className="text-xs text-muted-foreground truncate">{viewVotesPollMsg.poll.question}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewVotesPollMsg(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {viewVotesPollMsg.poll.options.map((opt, oIdx) => {
                const totalVotes =
                  viewVotesPollMsg.poll!.options.reduce((acc, o) => acc + (Array.isArray(o.voters) ? o.voters.length : 0), 0) || 1;
                const votesCount = Array.isArray(opt.voters) ? opt.voters.length : 0;
                const pct = Math.round((votesCount / totalVotes) * 100);

                const votersList = (opt.voter_details && opt.voter_details.length > 0)
                  ? opt.voter_details
                  : (opt.voters || []).map((vid) => {
                      const sVid = String(vid);
                      const found = (employees || []).find((e) => String(e.id) === sVid || String((e as any)._id) === sVid);
                      return {
                        id: sVid,
                        name: sVid === myUserId || (myEmployeeId && sVid === myEmployeeId) ? "You" : found?.name || "Colleague",
                        avatar: found?.profile_photo || found?.avatar,
                        time: undefined
                      };
                    });

                return (
                  <div key={opt.id || oIdx} className="bg-muted/15 border border-border/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-foreground text-sm flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">
                          {oIdx + 1}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground font-mono">
                        {votesCount} {votesCount === 1 ? "vote" : "votes"} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>

                    {votersList.length > 0 ? (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Voted by ({votersList.length}):
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {votersList.map((voter: any, vIdx: number) => {
                            const vId = String(voter.id || voter);
                            const isMe = vId === myUserId || (myEmployeeId && vId === myEmployeeId);
                            const foundEmp = (employees || []).find((e) => String(e.id) === vId || String((e as any)._id) === vId);
                            const name = isMe ? "You" : (voter.name || foundEmp?.name || "Colleague");
                            const designation = (foundEmp as any)?.work_details?.designation || (foundEmp as any)?.designation || (foundEmp as any)?.role || "";

                            return (
                              <div key={vIdx} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {foundEmp?.profile_photo || foundEmp?.avatar ? (
                                      <img src={foundEmp.profile_photo || foundEmp.avatar} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                      name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                                      <span>{name}</span>
                                      {isMe && <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1 rounded">You</span>}
                                    </p>
                                    {designation && (
                                      <p className="text-[10px] text-muted-foreground truncate">{designation}</p>
                                    )}
                                  </div>
                                </div>
                                {voter.time && (
                                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                    {new Date(voter.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">No votes yet for this option</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-border bg-muted/10 text-right shrink-0">
              <button
                type="button"
                onClick={() => setViewVotesPollMsg(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 16. MESSAGE INFO MODAL (WhatsApp style Read / Delivered) */}
      {/* ======================================================== */}
      {messageInfoMsg && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Message Info</h3>
                  <p className="text-xs text-muted-foreground">Read receipts & delivery details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessageInfoMsg(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-muted/30 border border-border rounded-2xl">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Message</p>
                <p className="text-xs text-foreground font-medium break-words">
                  {messageInfoMsg.content || (messageInfoMsg.media_type ? `[${messageInfoMsg.media_type}] ${messageInfoMsg.file_name || ""}` : "Message")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-right font-mono">
                  Sent: {new Date(messageInfoMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>

              {(() => {
                const readIds = new Set<string>();
                (messageInfoMsg.read_by || []).forEach((id) => readIds.add(String(id)));
                (Array.isArray(messageInfoMsg.is_read_by) ? messageInfoMsg.is_read_by : []).forEach((item: any) => {
                  if (typeof item === "object" && item.id) readIds.add(String(item.id));
                  else if (typeof item === "string") readIds.add(String(item));
                });
                readIds.delete(String(messageInfoMsg.sender_id));
                const readMembers = Array.from(readIds);

                const allMembers = (activeChannel?.members || []).map(String);
                const deliveredMembers = allMembers.filter(
                  (mid) => !readIds.has(mid) && mid !== String(messageInfoMsg.sender_id)
                );

                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <div className="flex items-center gap-1.5 text-sky-500">
                          <CheckCheck className="w-4 h-4" />
                          <span>Read by ({readMembers.length})</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                          Live sync
                        </span>
                      </div>

                      {readMembers.length > 0 ? (
                        <div className="space-y-1.5 bg-muted/15 border border-border rounded-xl p-2 max-h-44 overflow-y-auto">
                          {readMembers.map((uid) => {
                            const isMe = uid === myUserId || (myEmployeeId && uid === myEmployeeId);
                            const emp = (employees || []).find((e) => String(e.id) === uid || String((e as any)._id) === uid);
                            const name = isMe ? "You" : emp?.name || "Colleague";
                            const designation = (emp as any)?.work_details?.designation || (emp as any)?.designation || (emp as any)?.role || "";

                            return (
                              <div key={uid} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {emp?.profile_photo || emp?.avatar ? (
                                      <img src={emp.profile_photo || emp.avatar} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                      name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                      <span>{name}</span>
                                      {isMe && <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1 rounded">You</span>}
                                    </p>
                                    {designation && <p className="text-[10px] text-muted-foreground truncate">{designation}</p>}
                                  </div>
                                </div>
                                <span className="text-[10px] text-sky-500 font-medium shrink-0 flex items-center gap-1">
                                  <CheckCheck className="w-3.5 h-3.5" /> Seen
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic pl-1">No one has seen this message yet</p>
                      )}
                    </div>

                    {deliveredMembers.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                          <Check className="w-4 h-4" />
                          <span>Delivered to ({deliveredMembers.length})</span>
                        </div>
                        <div className="space-y-1.5 bg-muted/15 border border-border rounded-xl p-2 max-h-36 overflow-y-auto">
                          {deliveredMembers.map((uid) => {
                            const emp = (employees || []).find((e) => String(e.id) === uid || String((e as any)._id) === uid);
                            const name = emp?.name || "Colleague";
                            const designation = (emp as any)?.work_details?.designation || (emp as any)?.designation || (emp as any)?.role || "";
                            return (
                              <div key={uid} className="flex items-center justify-between p-1.5 rounded-lg opacity-85">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground">
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{name}</p>
                                    {designation && <p className="text-[10px] text-muted-foreground truncate">{designation}</p>}
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">Delivered</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-3 border-t border-border bg-muted/10 text-right shrink-0">
              <button
                type="button"
                onClick={() => setMessageInfoMsg(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ERROR BOUNDARY WRAPPER ---
class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  override componentDidCatch(error: any) {
    console.error("Chat rendering error:", error);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-card rounded-2xl border border-border p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 mb-3">
            <Hash className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-foreground text-base mb-1">Chat Encountered an Issue</h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            An unexpected error occurred while rendering chat messages.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            Reload Chat
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Chat() {
  return (
    <ChatErrorBoundary>
      <ChatInner />
    </ChatErrorBoundary>
  );
}
