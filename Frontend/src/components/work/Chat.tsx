import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Plus, Hash, Settings, Bell, Info, Send, Smile, Paperclip, MoreVertical, Image as ImageIcon, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: string;
  avatar: string;
  time: string;
  content: string;
  isMe: boolean;
}

const CHANNELS = [
  { id: "1", name: "general", unread: 0 },
  { id: "2", name: "engineering", unread: 3 },
  { id: "3", name: "marketing", unread: 0 },
  { id: "4", name: "design", unread: 1 },
];

const DIRECT_MESSAGES = [
  { id: "1", name: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", online: true, unread: 2 },
  { id: "2", name: "John Doe", avatar: "https://i.pravatar.cc/150?u=john", online: false, unread: 0 },
  { id: "3", name: "Emily Chen", avatar: "https://i.pravatar.cc/150?u=emily", online: true, unread: 0 },
];

const MOCK_MESSAGES: Message[] = [
  { id: "1", sender: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", time: "10:24 AM", content: "Hey team, just deployed the new auth service. Can someone review the PR?", isMe: false },
  { id: "2", sender: "John Doe", avatar: "https://i.pravatar.cc/150?u=john", time: "10:26 AM", content: "I'll take a look right now.", isMe: false },
  { id: "3", sender: "Alex Johnson", avatar: "https://i.pravatar.cc/150?u=alex", time: "10:30 AM", content: "Thanks John. Let me know if you need any context on the token refresh logic.", isMe: true },
  { id: "4", sender: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", time: "10:32 AM", content: "Perfect. It should be pretty straightforward, mostly just updated the JWT expiration handling.", isMe: false },
];

export function Chat() {
  const [activeChannel, setActiveChannel] = useState("engineering");
  const [channels, setChannels] = useState([
    { id: "1", name: "general", unread: 0 },
    { id: "2", name: "engineering", unread: 3 },
    { id: "3", name: "marketing", unread: 0 },
    { id: "4", name: "design", unread: 1 },
  ]);
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const nameCleaned = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (channels.some(c => c.name === nameCleaned)) {
      alert("Channel already exists");
      return;
    }
    const newChan = { id: `chan-${Date.now()}`, name: nameCleaned, unread: 0 };
    setChannels([...channels, newChan]);
    setActiveChannel(nameCleaned);
    setNewChannelName("");
    setIsNewChannelOpen(false);
  };
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [canCreateChannels, setCanCreateChannels] = useState(() => {
    if (typeof window === "undefined") return true;
    return (typeof window !== 'undefined' ? localStorage.getItem("hrms_chat_can_create_channels") : null) !== "false";
  });
  const [canDeleteMessages, setCanDeleteMessages] = useState(() => {
    if (typeof window === "undefined") return true;
    return (typeof window !== 'undefined' ? localStorage.getItem("hrms_chat_can_delete_messages") : null) !== "false";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setCanCreateChannels((typeof window !== 'undefined' ? localStorage.getItem("hrms_chat_can_create_channels") : null) !== "false");
      setCanDeleteMessages((typeof window !== 'undefined' ? localStorage.getItem("hrms_chat_can_delete_messages") : null) !== "false");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleDeleteMessage = (id: string) => {
    if (window.confirm("Delete this message?")) {
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success("Message deleted");
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setMessages([...messages, {
      id: Date.now().toString(),
      sender: "Alex Johnson",
      avatar: "https://i.pravatar.cc/150?u=alex",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: newMessage,
      isMe: true
    }]);
    setNewMessage("");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-muted/10 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground tracking-tight">Messages</h2>
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Jump to..." 
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
          {/* Channels */}
          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Channels</span>
              {canCreateChannels && (
                <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-foreground" onClick={() => setIsNewChannelOpen(true)} />
              )}
            </div>
            <div className="space-y-0.5">
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors",
                    activeChannel === channel.name 
                      ? "bg-primary/10 text-primary font-bold" 
                      : "text-muted-foreground hover:bg-muted font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 opacity-70" />
                    {channel.name}
                  </div>
                  {channel.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded-full">
                      {channel.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* DMs */}
          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Direct Messages</span>
              <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-foreground" />
            </div>
            <div className="space-y-0.5">
              {DIRECT_MESSAGES.map(dm => (
                <button
                  key={dm.id}
                  onClick={() => setActiveChannel(dm.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors",
                    activeChannel === dm.name 
                      ? "bg-primary/10 text-primary font-bold" 
                      : "text-muted-foreground hover:bg-muted font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img src={dm.avatar} alt={dm.name} className="w-5 h-5 rounded-full" />
                      {dm.online && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-background rounded-full"></div>}
                    </div>
                    {dm.name}
                  </div>
                  {dm.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded-full">
                      {dm.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-foreground text-lg tracking-tight flex items-center gap-1">
              {activeChannel.toLowerCase() === activeChannel ? <Hash className="w-5 h-5 text-muted-foreground" /> : null}
              {activeChannel}
            </h2>
          </div>
          
          <div className="flex items-center gap-1">
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-4 max-w-3xl", msg.isMe ? "ml-auto flex-row-reverse" : "")}>
              <img src={msg.avatar} alt={msg.sender} className="w-10 h-10 rounded-full shrink-0 shadow-sm" />
              <div className={cn("flex flex-col gap-1", msg.isMe ? "items-end" : "items-start")}>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-foreground">{msg.sender}</span>
                  <span className="text-xs font-medium text-muted-foreground">{msg.time}</span>
                </div>
                <div className="relative group flex items-center gap-2">
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.isMe 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : "bg-muted text-foreground rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                  {canDeleteMessages && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Message Input */}
        <div className="p-4 bg-card border-t border-border shrink-0">
          <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-muted/20 border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
            <button type="button" className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Plus className="w-5 h-5" />
            </button>
            
            <textarea 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message ${activeChannel.toLowerCase() === activeChannel ? '#' : ''}${activeChannel}`}
              className="w-full bg-transparent border-none focus:outline-none resize-none max-h-32 min-h-[2.5rem] py-2 text-sm text-foreground"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            
            <div className="flex items-center gap-1 shrink-0 pb-1">
              <button type="button" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                <Smile className="w-5 h-5" />
              </button>
              <button type="button" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                <Paperclip className="w-5 h-5" />
              </button>
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] font-medium text-muted-foreground"><strong>Return</strong> to send, <strong>Shift + Return</strong> for new line</span>
          </div>
        </div>
      </div>
      {/* New Channel Dialog */}
      {isNewChannelOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-black text-foreground">Create New Channel</h3>
              <button 
                onClick={() => setIsNewChannelOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Channel Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. general-discussions"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsNewChannelOpen(false)}
                  className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
