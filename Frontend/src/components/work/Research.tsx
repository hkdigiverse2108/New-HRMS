import { useState } from "react";
import { X,  Search, BookOpen, Clock, TrendingUp, Sparkles, Filter, Bookmark, Plus, BarChart2  } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";

// Synced categories from project categories

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  author: { name: string; avatar: string };
  date: string;
  readTime: string;
  bookmarked?: boolean;
}

const MOCK_ARTICLES: Article[] = [
  {
    id: "1",
    title: "Q3 Competitor Analysis: Industry Shifts",
    excerpt: "An in-depth look at how our top 3 competitors are adjusting their pricing models and what it means for our upcoming launch.",
    content: "## Executive Summary\nOver the past quarter, we have observed a significant market shift in SaaS pricing models. Competitors are moving away from flat-rate monthly subscriptions towards value-based, consumption-driven pricing tiers.\n\n### Key Findings:\n1. **Usage-Based Invoicing**: Competitors have seen a 25% increase in customer expansion by invoicing dynamically based on active API requests or consumption metric units.\n2. **Hybrid Tiers**: Standard tier pricing now includes a low base fee + variable usage fees rather than all-inclusive pricing.\n3. **Customer Feedback**: Users indicate they prefer paying for only what they consume, especially during scaling phases.\n\n### Action Plan:\nWe should design our invoicing modules to support dynamic quantity rates, flat adjustments, and flexible billing cycles to capture this demand.",
    category: "Digital Marketing",
    author: { name: "Sarah Chen", avatar: "https://i.pravatar.cc/150?u=sarah" },
    date: "2 days ago",
    readTime: "8 min read",
    bookmarked: true,
  },
  {
    id: "2",
    title: "React 19 Migration Strategy",
    excerpt: "A comprehensive guide on how we plan to incrementally adopt React 19 features without blocking the main product roadmap.",
    content: "## Overview of React 19\nReact 19 introduces Server Actions, asset loading enhancements, and improved document metadata support. Our codebase relies heavily on client-side state management, meaning our migration must focus on minimal disruptions.\n\n### Migration Phases:\n- **Phase 1 (Audit)**: Identify libraries that are not yet compatible with React 19 (e.g. legacy form libraries or specific chart dependencies).\n- **Phase 2 (Preparation)**: Enable React Compiler eslint rules to prepare logic structure for automated optimizations.\n- **Phase 3 (Rollout)**: Migrate non-critical micro-frontends first, followed by key business portals.\n\n### Anticipated Challenges:\n- Third-party packages lacking peer dependency support.\n- Adapting asynchronous data fetching hooks.",
    category: "Web Dev",
    author: { name: "Alex Johnson", avatar: "https://i.pravatar.cc/150?u=alex" },
    date: "1 week ago",
    readTime: "12 min read",
  },
  {
    id: "3",
    title: "The New Glassmorphism Trend in B2B",
    excerpt: "Why enterprise software is moving towards softer, translucent UI elements and how we can apply it to our dashboard.",
    content: "## Modern B2B Design Language\nEnterprise software no longer needs to look dry and uninspiring. The rise of glassmorphism—translucent backdrops, fine borders, and colorful blurred gradients—creates a sense of depth and hierarchy that wows users.\n\n### Implementation Guidelines:\n- **Backdrop Blurs**: Use CSS `backdrop-filter: blur(12px)` selectively on sidebars and modal backdrops.\n- **Curated Gradients**: Use HSL-curated gradient backgrounds behind transparent panels instead of flat gray fills.\n- **Micro-shadows**: Fine-tune card shadows to utilize soft opacity spreads rather than harsh contrast borders.",
    category: "Design",
    author: { name: "Elena Rodriguez", avatar: "https://i.pravatar.cc/150?u=elena" },
    date: "Aug 10, 2026",
    readTime: "5 min read",
  },
  {
    id: "4",
    title: "Remote Work Policy Updates for 2027",
    excerpt: "Details on the updated hybrid work schedules, home office stipends, and core collaboration hours.",
    category: "General",
    author: { name: "HR Team", avatar: "https://i.pravatar.cc/150?u=hr" },
    date: "Aug 05, 2026",
    readTime: "4 min read",
  },
  {
    id: "5",
    title: "AI Integrations: Cost vs. Benefit",
    excerpt: "Evaluating the operational costs of using LLMs in our support pipeline versus the estimated deflection rate.",
    category: "Web Dev",
    author: { name: "David Kim", avatar: "https://i.pravatar.cc/150?u=david" },
    date: "Jul 28, 2026",
    readTime: "10 min read",
    bookmarked: true,
  },
  {
    id: "6",
    title: "User Onboarding Drop-off Investigation",
    excerpt: "Research findings from user testing on why 30% of users drop off at the billing step.",
    category: "Digital Marketing",
    author: { name: "Mia Wong", avatar: "https://i.pravatar.cc/150?u=mia" },
    date: "Jul 15, 2026",
    readTime: "15 min read",
  }
];

const TRENDING_TOPICS = [
  { name: "AI Adoption", count: 24, trend: "+12%" },
  { name: "Q4 Roadmap", count: 18, trend: "+5%" },
  { name: "Security Audit", count: 12, trend: "-2%" },
  { name: "Design System", count: 9, trend: "+8%" },
];

export function Research() {
  const [articles, setArticles] = useState<Article[]>(MOCK_ARTICLES);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dynamic categories synced with project categories
  const [projectCategories, setProjectCategories] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem("hrms_categories") : null);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return ["Digital Marketing", "Social Media Management", "Web Dev", "App Dev", "Design", "Consulting", "General"];
  });

  // New Document State
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newExcerpt, setNewExcerpt] = useState("");
  const [newCategory, setNewCategory] = useState<string>(() => {
    return projectCategories[0] || "Digital Marketing";
  });

  const categories = ["All", ...projectCategories];

  const filteredArticles = articles.map(article => {
    // If the category is not present in active categories, default to General (if active) or the first active category
    const isValid = projectCategories.includes(article.category);
    const fallbackCategory = projectCategories.includes("General") 
      ? "General" 
      : (projectCategories[0] || "General");
    return {
      ...article,
      category: isValid ? article.category : fallbackCategory
    };
  }).filter(article => {
    const matchesCategory = activeCategory === "All" || article.category === activeCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (a.bookmarked && !b.bookmarked) return -1;
    if (!a.bookmarked && b.bookmarked) return 1;
    return 0;
  });

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newExcerpt.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const newDoc: Article = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      excerpt: newExcerpt,
      content: newExcerpt, // Excerpt acts as initial full content
      category: newCategory,
      author: { name: "Alex (You)", avatar: "https://i.pravatar.cc/150?u=alex" },
      date: "Just now",
      readTime: "1 min read",
    };

    setArticles([newDoc, ...articles]);
    setIsNewDocOpen(false);
    toast.success("Document created successfully!");
    
    // Reset form
    setNewTitle("");
    setNewExcerpt("");
    setNewCategory(projectCategories[0] || "Digital Marketing");
  };

  const handleToggleBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArticles(articles.map(article => {
      if (article.id === id) {
        const isNowBookmarked = !article.bookmarked;
        toast.success(isNowBookmarked ? `Bookmarked "${article.title}"` : `Removed "${article.title}" from bookmarks`);
        return { ...article, bookmarked: isNowBookmarked };
      }
      return article;
    }));
  };

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0 animate-in fade-in duration-300">
      {/* Clean Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Knowledge & Research Hub</h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">Discover internal documentation, market intelligence, and deep-dives from across the company</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search articles, policies..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Dialog open={isNewDocOpen} onOpenChange={setIsNewDocOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0">
                <Plus className="w-4 h-4" />
                <span>New Document</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">Create New Document</h2>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>
              <form onSubmit={handleCreateDocument} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Document Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Q4 Marketing Strategy"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Category</label>
                    <SearchableSelect 
                      value={newCategory}
                      onChange={(val) => setNewCategory(val)}
                      options={categories.filter(c => c !== "All").map(c => ({ label: c, value: c }))}
                      className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Summary / Excerpt</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Brief description of the document contents..."
                      value={newExcerpt}
                      onChange={e => setNewExcerpt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </div>
                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsNewDocOpen(false)}
                    className="px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-sm rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                  >
                    Publish Document
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide shrink-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border",
                  activeCategory === cat 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-white text-foreground/80 border-border hover:border-border hover:bg-muted/50"
                )}
              >
                {cat}
              </button>
            ))}
            <div className="flex-1"></div>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors bg-white border border-border rounded-xl shrink-0">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Articles Grid */}
          <div className="flex-1 overflow-y-auto pr-2 pb-10">
            {filteredArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredArticles.map(article => (
                  <div key={article.id} onClick={() => setSelectedArticle(article)} className="group bg-white border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 flex flex-col cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2.5 py-1 bg-muted text-foreground/80 text-xs font-bold rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {article.category}
                      </span>
                      <button 
                        onClick={(e) => handleToggleBookmark(e, article.id)}
                        className="text-border hover:text-amber-500 transition-colors"
                      >
                        <Bookmark className={cn("w-5 h-5", article.bookmarked && "fill-amber-500 text-amber-500")} />
                      </button>
                    </div>
                    
                    <h3 className="text-lg font-bold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
                      {article.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                      <div className="flex items-center gap-2">
                        <img src={article.author.avatar} alt={article.author.name} className="w-6 h-6 rounded-full ring-2 ring-white" />
                        <span className="text-xs font-medium text-foreground/80">{article.author.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 text-muted-foreground">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground/80 mb-1">No articles found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">We couldn't find any documents matching your search criteria. Try using different keywords.</p>
              </div>
            )}
          </div>
        </div>


      </div>
      {/* Research Document Reader Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-[700px] w-[calc(100%-2rem)] bg-card border border-border rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl h-[550px]">
          {selectedArticle && (
            <>
              {/* Header */}
              <div className="px-8 py-6 border-b border-border/50 bg-muted/30 flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {selectedArticle.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {selectedArticle.readTime}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground leading-tight">{selectedArticle.title}</h2>
                </div>
              </div>

              {/* Author Strip */}
              <div className="px-8 py-4 bg-muted/10 border-b border-border/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <img src={selectedArticle.author.avatar} alt={selectedArticle.author.name} className="w-8 h-8 rounded-full border border-border/50" />
                  <div>
                    <p className="text-xs font-black text-foreground">{selectedArticle.author.name}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold">Published {selectedArticle.date}</p>
                  </div>
                </div>
              </div>

              {/* Document Body */}
              <div className="p-8 overflow-y-auto flex-1 space-y-4 text-left">
                <p className="text-sm font-bold text-foreground leading-relaxed italic border-l-2 border-primary/50 pl-4 py-1 bg-primary/5 rounded-r-xl">
                  {selectedArticle.excerpt}
                </p>
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium pt-2">
                  {selectedArticle.content || "No detailed content available for this document."}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
