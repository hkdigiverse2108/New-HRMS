// ─── Sales CRM Mock Data ────────────────────────────────────────────────────

export type LeadStage = string;

export type LeadCategory =
  | "Jewellery"
  | "Restaurants"
  | "Real Estate"
  | "Doctors"
  | "Education"
  | "Hospital"
  | "Manufacturing"
  | "Textile"
  | "Finance"
  | "Automobile"
  | "Travel"
  | "IT Company"
  | "Salon"
  | "Gym"
  | "Construction"
  | "Others";

export type LeadSource =
  | "Meta Ads"
  | "Google Ads"
  | "Website"
  | "Referral"
  | "Cold Call"
  | "LinkedIn"
  | "WhatsApp"
  | "Walk-in"
  | "Email Campaign"
  | "Trade Show"
  | "Partner"
  | "Instagram"
  | "YouTube"
  | "Just Dial"
  | "India Mart";

export type TeamMember = {
  name: string;
  role: string;
  region: string;
  avatar: string;
  target: number;
  achieved: number;
  assigned: number;
  contacted: number;
  meetings: number;
  demos: number;
  proposals: number;
  won: number;
  lost: number;
  collection: number;
  conversionRate: number;
  followUpDone: number;
  avgResponse: number;
};

export const teamMembers: TeamMember[] = [
  { name: "Aarav Shah", role: "Sales Executive", region: "Gujarat", avatar: "AS", target: 1200000, achieved: 1385000, assigned: 96, contacted: 88, meetings: 27, demos: 18, proposals: 14, won: 11, lost: 9, collection: 1090000, conversionRate: 11, followUpDone: 89, avgResponse: 22 },
  { name: "Karan Patel", role: "Sales Executive", region: "South", avatar: "KP", target: 1000000, achieved: 880000, assigned: 71, contacted: 66, meetings: 22, demos: 14, proposals: 11, won: 8, lost: 6, collection: 880000, conversionRate: 11, followUpDone: 91, avgResponse: 16 },
  { name: "Riya Mehta", role: "Sales Head", region: "West", avatar: "RM", target: 1500000, achieved: 1740000, assigned: 84, contacted: 79, meetings: 31, demos: 21, proposals: 17, won: 12, lost: 7, collection: 1740000, conversionRate: 14, followUpDone: 92, avgResponse: 18 },
  { name: "Devansh Rao", role: "Admin", region: "HQ", avatar: "DR", target: 500000, achieved: 430000, assigned: 28, contacted: 25, meetings: 8, demos: 5, proposals: 4, won: 3, lost: 2, collection: 430000, conversionRate: 11, followUpDone: 88, avgResponse: 25 },
  { name: "Neha Verma", role: "Sales Executive", region: "North", avatar: "NV", target: 1000000, achieved: 610000, assigned: 78, contacted: 62, meetings: 19, demos: 11, proposals: 9, won: 6, lost: 11, collection: 610000, conversionRate: 8, followUpDone: 74, avgResponse: 41 },
  { name: "Het Kansara", role: "CEO", region: "All India", avatar: "HK", target: 2000000, achieved: 2480000, assigned: 61, contacted: 58, meetings: 24, demos: 15, proposals: 12, won: 9, lost: 5, collection: 2480000, conversionRate: 15, followUpDone: 96, avgResponse: 12 },
  { name: "Simran Kaur", role: "Sales Executive", region: "East", avatar: "SK", target: 900000, achieved: 470000, assigned: 64, contacted: 44, meetings: 12, demos: 6, proposals: 5, won: 3, lost: 13, collection: 300000, conversionRate: 5, followUpDone: 61, avgResponse: 66 },
];

export type Lead = {
  id: string;
  company: string;
  contact: string;
  city: string;
  state: string;
  stage: LeadStage;
  category: LeadCategory;
  source: LeadSource;
  owner: string;
  priority: "High" | "Medium" | "Low";
  budget: number;
  aiScore: number;
  nextFollowUp: string;
  createdAt: string;
};

export const leads: Lead[] = [
  { id: "LD-1000", company: "Shree Ganesh Jewellers", contact: "Mahesh Soni", city: "Surat", state: "Gujarat", stage: "New Lead", category: "Jewellery", source: "Meta Ads", owner: "Riya Mehta", priority: "High", budget: 60000, aiScore: 34, nextFollowUp: "2026-07-31", createdAt: "2026-07-15" },
  { id: "LD-1001", company: "Spice Route Restaurant", contact: "Ankit Raval", city: "Ahmedabad", state: "Gujarat", stage: "Contacted", category: "Restaurants", source: "Google Ads", owner: "Aarav Shah", priority: "Medium", budget: 145000, aiScore: 62, nextFollowUp: "2026-08-01", createdAt: "2026-07-10" },
  { id: "LD-1002", company: "Skyline Realtors", contact: "Priya Nair", city: "Mumbai", state: "Maharashtra", stage: "Meeting", category: "Real Estate", source: "Website", owner: "Neha Verma", priority: "High", budget: 320000, aiScore: 78, nextFollowUp: "2026-07-30", createdAt: "2026-07-05" },
  { id: "LD-1003", company: "Dr. Kapoor Clinic", contact: "Dr. Rohan Kapoor", city: "Delhi", state: "Delhi", stage: "Demo", category: "Doctors", source: "Referral", owner: "Karan Patel", priority: "High", budget: 285000, aiScore: 73, nextFollowUp: "2026-07-29", createdAt: "2026-06-20" },
  { id: "LD-1004", company: "BrightMind Academy", contact: "Sneha Iyer", city: "Pune", state: "Maharashtra", stage: "Proposal", category: "Education", source: "LinkedIn", owner: "Simran Kaur", priority: "Medium", budget: 180000, aiScore: 81, nextFollowUp: "2026-08-02", createdAt: "2026-06-15" },
  { id: "LD-1005", company: "Lifeline Hospital", contact: "Vikas Bhatt", city: "Rajkot", state: "Gujarat", stage: "Proposal", category: "Hospital", source: "Cold Call", owner: "Devansh Rao", priority: "High", budget: 520000, aiScore: 88, nextFollowUp: "2026-07-28", createdAt: "2026-06-10" },
  { id: "LD-1006", company: "Precision Industries", contact: "Jayesh Modi", city: "Vadodara", state: "Gujarat", stage: "Negotiation", category: "Manufacturing", source: "Trade Show", owner: "Riya Mehta", priority: "High", budget: 450000, aiScore: 90, nextFollowUp: "2026-07-31", createdAt: "2026-06-01" },
  { id: "LD-1007", company: "Anaya Textiles", contact: "Rekha Jain", city: "Bhilwara", state: "Rajasthan", stage: "Negotiation", category: "Textile", source: "Referral", owner: "Aarav Shah", priority: "Medium", budget: 585000, aiScore: 59, nextFollowUp: "2026-08-03", createdAt: "2026-05-20" },
  { id: "LD-1008", company: "TrustCap Finserv", contact: "Sameer Desai", city: "Bengaluru", state: "Karnataka", stage: "Won", category: "Finance", source: "Website", owner: "Neha Verma", priority: "High", budget: 390000, aiScore: 95, nextFollowUp: "", createdAt: "2026-05-15" },
  { id: "LD-1009", company: "Velocity Motors", contact: "Imran Shaikh", city: "Hyderabad", state: "Telangana", stage: "Won", category: "Automobile", source: "Google Ads", owner: "Karan Patel", priority: "Medium", budget: 275000, aiScore: 93, nextFollowUp: "", createdAt: "2026-05-10" },
  { id: "LD-1010", company: "Wanderlust Holidays", contact: "Meera Pillai", city: "Kochi", state: "Kerala", stage: "Lost", category: "Travel", source: "Instagram", owner: "Simran Kaur", priority: "Low", budget: 260000, aiScore: 98, nextFollowUp: "", createdAt: "2026-05-01" },
  { id: "LD-1011", company: "Nexlogic Softwares", contact: "Tarun Gupta", city: "Noida", state: "Uttar Pradesh", stage: "Demo", category: "IT Company", source: "LinkedIn", owner: "Devansh Rao", priority: "Medium", budget: 340000, aiScore: 70, nextFollowUp: "2026-08-01", createdAt: "2026-06-25" },
  { id: "LD-1012", company: "Glow Studio Salon", contact: "Nidhi Arora", city: "Chandigarh", state: "Punjab", stage: "Meeting", category: "Salon", source: "Meta Ads", owner: "Riya Mehta", priority: "Low", budget: 95000, aiScore: 55, nextFollowUp: "2026-07-30", createdAt: "2026-07-01" },
  { id: "LD-1013", company: "IronCore Fitness", contact: "Rahul Yadav", city: "Jaipur", state: "Rajasthan", stage: "Meeting", category: "Gym", source: "WhatsApp", owner: "Aarav Shah", priority: "Medium", budget: 185000, aiScore: 64, nextFollowUp: "2026-08-05", createdAt: "2026-07-12" },
  { id: "LD-1014", company: "Sthapati Constructions", contact: "Arvind Menon", city: "Chennai", state: "Tamil Nadu", stage: "New Lead", category: "Construction", source: "Just Dial", owner: "Neha Verma", priority: "High", budget: 560000, aiScore: 84, nextFollowUp: "2026-07-31", createdAt: "2026-07-20" },
  { id: "LD-1015", company: "Kamdhenu Traders", contact: "Bhavesh Trivedi", city: "Indore", state: "Madhya Pradesh", stage: "Contacted", category: "Others", source: "Cold Call", owner: "Karan Patel", priority: "Low", budget: 120000, aiScore: 42, nextFollowUp: "2026-08-02", createdAt: "2026-07-18" },
  { id: "LD-1016", company: "Zenith Diamonds", contact: "Falguni Shah", city: "Surat", state: "Gujarat", stage: "Meeting", category: "Jewellery", source: "Referral", owner: "Simran Kaur", priority: "High", budget: 780000, aiScore: 92, nextFollowUp: "2026-07-29", createdAt: "2026-06-28" },
  { id: "LD-1017", company: "Urban Tandoor", contact: "Deepak Sharma", city: "Gurugram", state: "Haryana", stage: "Demo", category: "Restaurants", source: "Google Ads", owner: "Devansh Rao", priority: "Medium", budget: 235000, aiScore: 57, nextFollowUp: "2026-08-04", createdAt: "2026-07-08" },
  { id: "LD-1018", company: "Green Acres Realty", contact: "Sunita Rane", city: "Nashik", state: "Maharashtra", stage: "Proposal", category: "Real Estate", source: "Website", owner: "Riya Mehta", priority: "High", budget: 680000, aiScore: 85, nextFollowUp: "2026-07-28", createdAt: "2026-06-18" },
  { id: "LD-1019", company: "Smile Dental Care", contact: "Dr. Alka Joshi", city: "Bhopal", state: "Madhya Pradesh", stage: "Proposal", category: "Doctors", source: "Partner", owner: "Aarav Shah", priority: "Medium", budget: 175000, aiScore: 76, nextFollowUp: "2026-08-01", createdAt: "2026-06-22" },
  { id: "LD-1020", company: "Scholars Point", contact: "Rajiv Kulkarni", city: "Nagpur", state: "Maharashtra", stage: "Negotiation", category: "Education", source: "Meta Ads", owner: "Neha Verma", priority: "Medium", budget: 210000, aiScore: 69, nextFollowUp: "2026-07-30", createdAt: "2026-06-05" },
  { id: "LD-1021", company: "Aarogya Multispeciality", contact: "Naveen Reddy", city: "Vijayawada", state: "Andhra Pradesh", stage: "Demo", category: "Hospital", source: "Referral", owner: "Karan Patel", priority: "High", budget: 480000, aiScore: 82, nextFollowUp: "2026-08-03", createdAt: "2026-06-30" },
  { id: "LD-1022", company: "Metalix Engineering", contact: "Suresh Pawar", city: "Aurangabad", state: "Maharashtra", stage: "Won", category: "Manufacturing", source: "Trade Show", owner: "Simran Kaur", priority: "Medium", budget: 350000, aiScore: 91, nextFollowUp: "", createdAt: "2026-05-05" },
  { id: "LD-1023", company: "Silk Trail Exports", contact: "Kavita Sen", city: "Kolkata", state: "West Bengal", stage: "Lost", category: "Textile", source: "Email Campaign", owner: "Devansh Rao", priority: "Low", budget: 220000, aiScore: 38, nextFollowUp: "", createdAt: "2026-04-15" },
  { id: "LD-1024", company: "FinEdge Advisors", contact: "Manoj Khurana", city: "Ludhiana", state: "Punjab", stage: "Contacted", category: "Finance", source: "LinkedIn", owner: "Riya Mehta", priority: "Medium", budget: 310000, aiScore: 58, nextFollowUp: "2026-08-05", createdAt: "2026-07-14" },
  { id: "LD-1025", company: "DriveOn Automobiles", contact: "Pankaj Bansal", city: "Lucknow", state: "Uttar Pradesh", stage: "Demo", category: "Automobile", source: "India Mart", owner: "Aarav Shah", priority: "High", budget: 420000, aiScore: 74, nextFollowUp: "2026-07-31", createdAt: "2026-06-28" },
  { id: "LD-1026", company: "Voyage Trips", contact: "Ritu Malhotra", city: "Goa", state: "Goa", stage: "Meeting", category: "Travel", source: "Instagram", owner: "Neha Verma", priority: "Low", budget: 145000, aiScore: 52, nextFollowUp: "2026-08-02", createdAt: "2026-07-05" },
  { id: "LD-1027", company: "CloudNova Labs", contact: "Aditya Menon", city: "Bengaluru", state: "Karnataka", stage: "Negotiation", category: "IT Company", source: "Website", owner: "Karan Patel", priority: "High", budget: 580000, aiScore: 87, nextFollowUp: "2026-07-29", createdAt: "2026-05-28" },
  { id: "LD-1028", company: "Blush Beauty Bar", contact: "Pooja Shetty", city: "Mangaluru", state: "Karnataka", stage: "New Lead", category: "Salon", source: "Meta Ads", owner: "Simran Kaur", priority: "Medium", budget: 88000, aiScore: 41, nextFollowUp: "2026-08-06", createdAt: "2026-07-22" },
  { id: "LD-1029", company: "PowerHouse Gym", contact: "Vivek Chauhan", city: "Dehradun", state: "Uttarakhand", stage: "Contacted", category: "Gym", source: "WhatsApp", owner: "Devansh Rao", priority: "Medium", budget: 195000, aiScore: 56, nextFollowUp: "2026-08-04", createdAt: "2026-07-16" },
  { id: "LD-1030", company: "Sunrise Infra", contact: "Harsh Vora", city: "Ahmedabad", state: "Gujarat", stage: "Meeting", category: "Construction", source: "Referral", owner: "Riya Mehta", priority: "High", budget: 720000, aiScore: 79, nextFollowUp: "2026-07-28", createdAt: "2026-06-20" },
  { id: "LD-1031", company: "Om Enterprises", contact: "Kiran Bhosale", city: "Kolhapur", state: "Maharashtra", stage: "Demo", category: "Others", source: "Cold Call", owner: "Aarav Shah", priority: "Low", budget: 155000, aiScore: 48, nextFollowUp: "2026-08-01", createdAt: "2026-07-02" },
  { id: "LD-1032", company: "Royal Gold Palace", contact: "Nirav Zaveri", city: "Rajkot", state: "Gujarat", stage: "Proposal", category: "Jewellery", source: "Referral", owner: "Neha Verma", priority: "High", budget: 920000, aiScore: 89, nextFollowUp: "2026-07-30", createdAt: "2026-06-12" },
  { id: "LD-1033", company: "Cafe Mocha House", contact: "Sagar Naik", city: "Panaji", state: "Goa", stage: "Negotiation", category: "Restaurants", source: "Google Ads", owner: "Karan Patel", priority: "Medium", budget: 165000, aiScore: 63, nextFollowUp: "2026-08-03", createdAt: "2026-06-08" },
  { id: "LD-1034", company: "Landmark Estates", contact: "Preeti Saxena", city: "Jaipur", state: "Rajasthan", stage: "Won", category: "Real Estate", source: "Partner", owner: "Simran Kaur", priority: "High", budget: 540000, aiScore: 96, nextFollowUp: "", createdAt: "2026-04-20" },
  { id: "LD-1035", company: "Ortho Plus Centre", contact: "Dr. Sanjay Rao", city: "Pune", state: "Maharashtra", stage: "Won", category: "Doctors", source: "Referral", owner: "Devansh Rao", priority: "Medium", budget: 290000, aiScore: 94, nextFollowUp: "", createdAt: "2026-05-08" },
  { id: "LD-1036", company: "EduSpark Institute", contact: "Ashwin Kumar", city: "Coimbatore", state: "Tamil Nadu", stage: "Contacted", category: "Education", source: "YouTube", owner: "Riya Mehta", priority: "Medium", budget: 195000, aiScore: 50, nextFollowUp: "2026-08-05", createdAt: "2026-07-19" },
  { id: "LD-1037", company: "Nova Care Hospital", contact: "Ramesh Iyengar", city: "Mysuru", state: "Karnataka", stage: "Lost", category: "Hospital", source: "Cold Call", owner: "Aarav Shah", priority: "Low", budget: 380000, aiScore: 32, nextFollowUp: "", createdAt: "2026-04-10" },
  { id: "LD-1038", company: "Apex Polymers", contact: "Girish Kadam", city: "Thane", state: "Maharashtra", stage: "Lost", category: "Manufacturing", source: "India Mart", owner: "Neha Verma", priority: "Low", budget: 410000, aiScore: 29, nextFollowUp: "", createdAt: "2026-04-01" },
  { id: "LD-1039", company: "Weavers Hub", contact: "Anita Das", city: "Bhubaneswar", state: "Odisha", stage: "Demo", category: "Textile", source: "Trade Show", owner: "Karan Patel", priority: "Medium", budget: 245000, aiScore: 66, nextFollowUp: "2026-08-02", createdAt: "2026-06-25" },
  { id: "LD-1040", company: "Prosperity Wealth", contact: "Nikhil Jain", city: "Raipur", state: "Chhattisgarh", stage: "Meeting", category: "Finance", source: "LinkedIn", owner: "Simran Kaur", priority: "Medium", budget: 330000, aiScore: 71, nextFollowUp: "2026-07-30", createdAt: "2026-07-08" },
  { id: "LD-1041", company: "Turbo Wheels", contact: "Faisal Khan", city: "Kanpur", state: "Uttar Pradesh", stage: "Negotiation", category: "Automobile", source: "Website", owner: "Devansh Rao", priority: "High", budget: 385000, aiScore: 83, nextFollowUp: "2026-07-29", createdAt: "2026-05-25" },
  { id: "LD-1042", company: "Himalaya Tours", contact: "Tenzin Dorjee", city: "Shimla", state: "Himachal Pradesh", stage: "New Lead", category: "Travel", source: "Instagram", owner: "Riya Mehta", priority: "Low", budget: 125000, aiScore: 45, nextFollowUp: "2026-08-06", createdAt: "2026-07-24" },
  { id: "LD-1043", company: "ByteWorks Systems", contact: "Shruti Kulkarni", city: "Hyderabad", state: "Telangana", stage: "Contacted", category: "IT Company", source: "Google Ads", owner: "Aarav Shah", priority: "High", budget: 470000, aiScore: 68, nextFollowUp: "2026-08-01", createdAt: "2026-07-17" },
  { id: "LD-1044", company: "Serene Spa & Salon", contact: "Anjali Gupta", city: "Kolkata", state: "West Bengal", stage: "Meeting", category: "Salon", source: "Meta Ads", owner: "Neha Verma", priority: "Low", budget: 105000, aiScore: 53, nextFollowUp: "2026-08-03", createdAt: "2026-07-09" },
  { id: "LD-1045", company: "FitZone Arena", contact: "Manish Tiwari", city: "Patna", state: "Bihar", stage: "Demo", category: "Gym", source: "WhatsApp", owner: "Karan Patel", priority: "Medium", budget: 215000, aiScore: 60, nextFollowUp: "2026-08-04", createdAt: "2026-07-06" },
  { id: "LD-1046", company: "Pinnacle Builders", contact: "Vinay Shetty", city: "Udaipur", state: "Rajasthan", stage: "Proposal", category: "Construction", source: "Referral", owner: "Simran Kaur", priority: "High", budget: 650000, aiScore: 86, nextFollowUp: "2026-07-28", createdAt: "2026-06-15" },
  { id: "LD-1047", company: "Vardhman Agencies", contact: "Alok Mishra", city: "Varanasi", state: "Uttar Pradesh", stage: "Negotiation", category: "Others", source: "Partner", owner: "Devansh Rao", priority: "Medium", budget: 195000, aiScore: 72, nextFollowUp: "2026-08-05", createdAt: "2026-06-02" },
];

export const pipelineStages: { stage: LeadStage; color: string }[] = [
  { stage: "New Lead", color: "#6366f1" },
  { stage: "Contacted", color: "#8b5cf6" },
  { stage: "Meeting", color: "#3b82f6" },
  { stage: "Demo", color: "#06b6d4" },
  { stage: "Proposal", color: "#f59e0b" },
  { stage: "Negotiation", color: "#f97316" },
  { stage: "Won", color: "#10b981" },
  { stage: "Lost", color: "#ef4444" },
];

export const dashboardStats = {
  todayRevenue: 142000,
  monthlyRevenue: 3410000,
  monthlyTarget: 5000000,
  achievementPct: 68.2,
  todayLeads: 37,
  activeLeads: 412,
  hotLeads: 64,
  qualifiedLeads: 148,
  proposalSent: 52,
  negotiation: 28,
  wonDeals: 31,
  wonTarget: 74,
  lostDeals: 17,
  todayFollowUps: 42,
  overdueFollowUps: 11,
  avgDealSize: 186000,
  leadConversionPct: 24.6,
  salesCycleDays: 27,
  revenueForecast: 4820000,
  collectionPending: 965000,
  targetRemaining: 1590000,
  salesHealthScore: 92,
};

export const revenueVsTarget = [
  { month: "Aug", revenue: 28, target: 40 },
  { month: "Sep", revenue: 32, target: 42 },
  { month: "Oct", revenue: 38, target: 44 },
  { month: "Nov", revenue: 35, target: 45 },
  { month: "Dec", revenue: 42, target: 48 },
  { month: "Jan", revenue: 30, target: 46 },
  { month: "Feb", revenue: 36, target: 48 },
  { month: "Mar", revenue: 44, target: 50 },
  { month: "Apr", revenue: 39, target: 50 },
  { month: "May", revenue: 46, target: 50 },
  { month: "Jun", revenue: 41, target: 50 },
  { month: "Jul", revenue: 34, target: 50 },
];

export const conversionFunnel = [
  { stage: "Total Leads", value: 1240, color: "#6366f1" },
  { stage: "Contacted", value: 820, color: "#8b5cf6" },
  { stage: "Meetings", value: 310, color: "#3b82f6" },
  { stage: "Demos", value: 185, color: "#06b6d4" },
  { stage: "Proposals", value: 128, color: "#f59e0b" },
  { stage: "Won", value: 78, color: "#10b981" },
];

export const leadSourceData = [
  { source: "Meta Ads", leads: 180, won: 34 },
  { source: "Google Ads", leads: 156, won: 28 },
  { source: "Referral", leads: 142, won: 42 },
  { source: "Website", leads: 120, won: 22 },
  { source: "LinkedIn", leads: 98, won: 18 },
  { source: "Cold Call", leads: 85, won: 12 },
  { source: "WhatsApp", leads: 72, won: 14 },
  { source: "Trade Show", leads: 65, won: 20 },
  { source: "Instagram", leads: 58, won: 10 },
  { source: "Others", leads: 264, won: 38 },
];

export const categoryMix = [
  { name: "Jewellery", value: 22, color: "#f59e0b" },
  { name: "Real Estate", value: 18, color: "#3b82f6" },
  { name: "Restaurants", value: 14, color: "#ef4444" },
  { name: "Hospital", value: 12, color: "#10b981" },
  { name: "IT Company", value: 10, color: "#8b5cf6" },
  { name: "Manufacturing", value: 8, color: "#6366f1" },
  { name: "Others", value: 16, color: "#94a3b8" },
];

export const monthlyGrowth = [
  { month: "Jan", growth: 8.2 },
  { month: "Feb", growth: 12.5 },
  { month: "Mar", growth: 6.1 },
  { month: "Apr", growth: -2.4 },
  { month: "May", growth: 15.8 },
  { month: "Jun", growth: 9.3 },
  { month: "Jul", growth: 11.7 },
];

export const aiInsights = [
  { type: "convert", title: "Likely to convert", text: "Zenith Diamonds (score 92) — send revised quote today." },
  { type: "cold", title: "Cold lead alert", text: "Silk Trail Exports untouched for 9 days — reassign or nurture." },
  { type: "timing", title: "Best follow-up time", text: "Tue\u2013Thu, 11:00 AM shows 2.3\u00d7 higher pickup rate." },
  { type: "action", title: "Next best action", text: "Schedule demo for CloudNova Labs before negotiation stalls." },
  { type: "summary", title: "AI follow-up summary", text: "Pipeline is healthy but proposal-stage velocity dropped 4.6%. Prioritise the 28 negotiation deals worth \u20b941 L." },
];

export const founderSnapshot = {
  topPerformer: { name: "Aarav Shah", pct: 115 },
  bottomPerformer: { name: "Simran Kaur", pct: 52 },
  revenueToday: 142000,
  revenuePayments: 6,
  revenueMonth: 3410000,
  revenueMonthPct: 68,
  pendingPayments: 965000,
  pendingInvoices: 14,
  pendingProposals: 52,
  pendingProposalValue: 11200000,
  highestLeadSource: "Meta Ads",
  highestLeadSourceLeads: 180,
  highestLeadSourceWon: 34,
  bestCategory: "Jewellery",
  bestCategoryRevenue: 980000,
  bestCampaign: "Growth-July",
  bestCampaignROAS: 6.4,
  upcomingClosings: 9,
  upcomingClosingsValue: 1280000,
  inactiveLeads: 38,
  inactiveDays: 14,
  overdueFollowUpOwners: ["Simran", "Neha", "Karan"],
};

export type SalesTask = {
  id: string;
  type: string;
  company: string;
  assignee: string;
  dueDate: string;
  status: "overdue" | "today" | "upcoming" | "completed";
  priority: "High" | "Medium" | "Low";
};

export const salesTasks: SalesTask[] = [
  { id: "T-001", type: "Call Client", company: "Shree Ganesh Jewellers", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "High" },
  { id: "T-002", type: "Payment Collection", company: "Glow Studio Salon", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "High" },
  { id: "T-003", type: "Recurring Follow-up", company: "FinEdge Advisors", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "Medium" },
  { id: "T-004", type: "Proposal", company: "EduSpark Institute", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "High" },
  { id: "T-005", type: "Birthday Wish", company: "Shree Ganesh Jewellers", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "Low" },
  { id: "T-006", type: "Call Client", company: "Glow Studio Salon", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "Medium" },
  { id: "T-007", type: "Payment Collection", company: "FinEdge Advisors", assignee: "Riya Mehta", dueDate: "2026-07-30", status: "today", priority: "High" },
  { id: "T-008", type: "Call Client", company: "Zenith Diamonds", assignee: "Aarav Shah", dueDate: "2026-07-28", status: "overdue", priority: "High" },
  { id: "T-009", type: "Meeting", company: "CloudNova Labs", assignee: "Karan Patel", dueDate: "2026-07-27", status: "overdue", priority: "High" },
  { id: "T-010", type: "Demo", company: "Royal Gold Palace", assignee: "Neha Verma", dueDate: "2026-07-29", status: "overdue", priority: "Medium" },
  { id: "T-011", type: "Proposal", company: "Precision Industries", assignee: "Riya Mehta", dueDate: "2026-07-26", status: "overdue", priority: "High" },
  { id: "T-012", type: "WhatsApp", company: "DriveOn Automobiles", assignee: "Aarav Shah", dueDate: "2026-08-01", status: "upcoming", priority: "Medium" },
  { id: "T-013", type: "Call Client", company: "Skyline Realtors", assignee: "Neha Verma", dueDate: "2026-08-02", status: "upcoming", priority: "High" },
  { id: "T-014", type: "Meeting", company: "Anaya Textiles", assignee: "Aarav Shah", dueDate: "2026-08-03", status: "upcoming", priority: "Medium" },
  { id: "T-015", type: "Email", company: "BrightMind Academy", assignee: "Simran Kaur", dueDate: "2026-08-04", status: "upcoming", priority: "Low" },
  { id: "T-016", type: "Demo", company: "Lifeline Hospital", assignee: "Devansh Rao", dueDate: "2026-08-05", status: "upcoming", priority: "High" },
  { id: "T-017", type: "Payment Collection", company: "TrustCap Finserv", assignee: "Neha Verma", dueDate: "2026-07-25", status: "completed", priority: "High" },
  { id: "T-018", type: "Call Client", company: "Velocity Motors", assignee: "Karan Patel", dueDate: "2026-07-24", status: "completed", priority: "Medium" },
];

export const quarterlyGrowth = [
  { quarter: "Q1 FY26", revenue: 92, growth: 12.4 },
  { quarter: "Q2 FY26", revenue: 108, growth: 17.4 },
  { quarter: "Q3 FY26", revenue: 124, growth: 14.8 },
  { quarter: "Q4 FY26", revenue: 120, growth: -3.2 },
];

export const revenueForecast = [
  { month: "Aug", actual: 0, forecast: 52 },
  { month: "Sep", actual: 0, forecast: 55 },
  { month: "Oct", actual: 0, forecast: 58 },
  { month: "Nov", actual: 0, forecast: 54 },
  { month: "Dec", actual: 0, forecast: 60 },
  { month: "Jan", actual: 0, forecast: 48 },
];

export const avgDealSizeTrend = [
  { month: "Jan", size: 1.52 },
  { month: "Feb", size: 1.58 },
  { month: "Mar", size: 1.65 },
  { month: "Apr", size: 1.71 },
  { month: "May", size: 1.78 },
  { month: "Jun", size: 1.82 },
  { month: "Jul", size: 1.86 },
];

export const lostReasons = [
  { reason: "Budget constraints", count: 32, pct: 30.8 },
  { reason: "Chose competitor", count: 24, pct: 23.1 },
  { reason: "No response", count: 18, pct: 17.3 },
  { reason: "Timing not right", count: 14, pct: 13.5 },
  { reason: "Feature gap", count: 10, pct: 9.6 },
  { reason: "Other", count: 6, pct: 5.8 },
];

export const salespersonPerformance = [
  { name: "Aarav Shah", revenue: 13.85, target: 12 },
  { name: "Riya Mehta", revenue: 17.4, target: 15 },
  { name: "Karan Patel", revenue: 8.8, target: 10 },
  { name: "Het Kansara", revenue: 24.8, target: 20 },
  { name: "Neha Verma", revenue: 6.1, target: 10 },
  { name: "Devansh Rao", revenue: 4.3, target: 5 },
  { name: "Simran Kaur", revenue: 4.7, target: 9 },
];

export const leadCategories = [
  { name: "Jewellery", icon: "Gem" },
  { name: "Restaurants", icon: "UtensilsCrossed" },
  { name: "Real Estate", icon: "Building2" },
  { name: "Doctors", icon: "Stethoscope" },
  { name: "Education", icon: "GraduationCap" },
  { name: "Hospital", icon: "HeartPulse" },
  { name: "Manufacturing", icon: "Factory" },
  { name: "Textile", icon: "Shirt" },
  { name: "Finance", icon: "Landmark" },
  { name: "Automobile", icon: "Car" },
  { name: "Travel", icon: "Plane" },
  { name: "IT Company", icon: "Cpu" },
  { name: "Salon", icon: "Scissors" },
  { name: "Gym", icon: "Dumbbell" },
  { name: "Construction", icon: "HardHat" },
  { name: "Others", icon: "Shapes" },
];

export const leadSources = [
  "Meta Ads", "Google Ads", "Website", "Referral", "Cold Call",
  "LinkedIn", "WhatsApp", "Walk-in", "Email Campaign", "Trade Show",
  "Partner", "Instagram", "YouTube", "Just Dial", "India Mart",
];

export const reportTypes = [
  { title: "Daily Sales Report", subtitle: "Today \u00b7 37 leads, \u20b91.42 L revenue", icon: "CalendarDays" },
  { title: "Weekly Report", subtitle: "Week 31 \u00b7 \u20b99.8 L revenue, 18 deals", icon: "CalendarRange" },
  { title: "Monthly Report", subtitle: "July 2026 \u00b7 68% of target", icon: "Calendar" },
  { title: "Employee Report", subtitle: "7 members \u00b7 scorecards + targets", icon: "Users" },
  { title: "Lead Source Report", subtitle: "15 channels \u00b7 CAC & ROAS", icon: "Target" },
  { title: "Category Report", subtitle: "16 categories \u00b7 revenue mix", icon: "PieChart" },
  { title: "Revenue Report", subtitle: "FY 26-27 \u00b7 \u20b94.44 Cr booked", icon: "TrendingUp" },
  { title: "Collection Report", subtitle: "\u20b99.65 L pending across 14 invoices", icon: "Wallet" },
  { title: "Target Report", subtitle: "Company + per-member target tracking", icon: "Crosshair" },
];

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `\u20b9${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `\u20b9${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `\u20b9${(amount / 1000).toFixed(1)}K`;
  return `\u20b9${amount.toLocaleString("en-IN")}`;
}

export function formatCompact(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString("en-IN");
}
