Hey @Aljon. here is the second coding exam. Your first code submission was great already. This second code exam will also be the last code exam. After this I will evaluate both submissions and come to a final decision. This task is harder than the first task to evaluate the depth of your coding abilities. But with AI assisted coding should be still psossible to be done in a reasonable amount of time.

🎯 AI Image Gallery - Developer Challenge

📋 Project Overview
Build a web application where users can upload images, get automatic AI-generated tags and descriptions, and search through their images using text or find similar images.

🎭 Core Requirements

⿡ Authentication
• Implement Supabase Auth (email/password)
• Sign up / Sign in pages
• Protected routes (gallery only accessible when logged in)
• Each user sees only their own images
• Logout functionality

⿢ Image Management
• Upload single or multiple images (drag & drop)
• Support JPEG, PNG formats
• Generate one thumbnail size (300x300)
• Store original + thumbnail
• Show upload progress
• Basic image grid view

⿣ AI Analysis
• Research & Choose: Select an appropriate AI service for image analysis
• Document why you chose this service (cost, features, ease of use)
• Include comparison of at least 2 options you considered

Required AI Features:
• Generate 5-10 relevant tags per image
• Create one descriptive sentence about the image
• Extract dominant colors (top 3)
• Process images async in background

⿤ Search Features
• Text Search: Search by tags or description
• Similar Images: Click "find similar" on any image
• Filter by Color: Click a color to find similar colored images
• Results should update without page reload
• Search only within user's own images

⿥ Frontend Requirements
• Auth Pages: Clean login/signup forms
• Gallery View: Responsive grid layout
• Image Modal: Click to view larger + see tags/description
• Search Bar: With instant results
• Upload Zone: Drag & drop area
• Loading States: Skeleton screens while processing
• User Menu: Show email and logout option
• Mobile responsive

⿦ Technical Requirements
• Use Supabase for auth and database
• Images processed in background (don't block upload)
• Handle errors gracefully (AI API failures)
• Paginate results (20 images per page)
• Basic caching of AI results
• Row Level Security (RLS) for multi-tenant data

📊 Suggested Tech Stack

Backend:
• Supabase (required for auth & database)
• Any backend language for AI processing:
  - FastAPI (Python) - recommended
  - Express.js (Node.js)
  - Edge Functions (Supabase)

Database:
• Supabase (PostgreSQL)
• Use Row Level Security (RLS)

Frontend:
• React or Vue.js
• Any CSS framework (Tailwind, Bootstrap, etc.)
• Vanilla JS also acceptable if well-structured

AI Integration:
• Your researched choice
• For similarity: cosine similarity on tags/colors
• No need for complex vector databases

Storage:
• Supabase Storage for images
• Organize by user_id folders

🔧 Simple Database Schema
sql
CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    filename VARCHAR(255),
    original_path TEXT,
    thumbnail_path TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE image_metadata (
    id SERIAL PRIMARY KEY,
    image_id INTEGER REFERENCES images(id),
    user_id UUID REFERENCES auth.users(id),
    description TEXT,
    tags TEXT[],
    colors VARCHAR(7)[],
    ai_processing_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see own images" ON images
    FOR ALL USING (auth.uid() = user_id);
    
CREATE POLICY "Users can only see own metadata" ON image_metadata
    FOR ALL USING (auth.uid() = user_id);


🎨 Evaluation Focus

Core Functionality (35%)
• Upload works smoothly
• AI integration functions properly
• Search returns relevant results
• Auth flow works correctly
• Error handling present

AI Service Research (15%)
• Clear comparison of options
• Justified decision based on requirements
• Understanding of trade-offs
• Cost awareness

Code Quality (25%)
• Clean, readable code
• Proper separation of concerns
• Comments where needed
• Git commit history
• Secure handling of API keys

UI/UX (20%)
• Intuitive interface
• Responsive design
• Loading/error states
• Smooth interactions

Technical Decisions (5%)
• Reasonable architecture choices
• Efficient AI API usage
• Performance considerations

⚡ Bonus Points (Optional)
• Deploy to free hosting (Vercel, Railway, etc.)
• Add image download feature
• Implement tag editing
• Dark mode toggle
• Export search results as JSON
• Unit tests for core functions

📝 Deliverables
1. GitHub repository with code
2. README with:
   - Setup instructions
   - API keys needed
   - Architecture decisions
   - AI service comparison document
3. Screenshots or short demo video
4. List of potential improvements

💡 Implementation Tips
• Start simple: Auth → Upload → Display → Add AI → Add Search
• Use Supabase quickstart guides for auth setup
• Test AI services with free tiers before committing
• Focus on core features first
• Console.log AI responses to understand the data
• Test with 5-10 images initially

🚫 What NOT to Do
• Don't overcomplicate the similarity search
• Don't build custom auth (use Supabase)
• Don't optimize prematurely
• Don't spend too much time on CSS
• Skip complex deployment configs
• Don't implement social login (just email/password)

📌 Example User Flow
1. User signs up with email/password
2. User logs in and sees empty gallery
3. User drags 3 vacation photos to upload area
4. Images appear in gallery with loading spinner
5. AI processes each image in background
6. Tags appear: "beach, sunset, ocean, people, vacation"
7. User searches "sunset" → sees relevant images
8. User clicks "Find similar" → sees other beach photos
9. User filters by blue color → sees ocean/sky images
10. User logs out and images are no longer accessible
