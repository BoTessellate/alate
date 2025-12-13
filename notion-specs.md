# bits of tessellate


    ### Important links

      ### decisions + tasks

          ## The App Fatigue Problem
            Consumer Pain Points:
            - Too many apps to download, manage, update
            - Login fatigue (yet another account)
            - Learning curve for each new interface
            - Storage and notification overload
            - Preference for tools they already use daily
            Brand Pain Points:
            - Another platform to learn and manage
            - Content creation burden (uploading products, maintaining catalogs)
            - Fragmented analytics across platforms
            - Integration complexity with existing systems
            - ROI uncertainty on new platforms

          ## Questions to Clarify Product Vision
            1. Where do your target consumers already spend time? (Instagram, Pinterest, Canva, TikTok?)
              1. Persona 1: Hobbyist 
                1. 👥 comprises the largest user base >> transition to designers/content creators etc.. soon after for increased revenue growth
                1. ⌛ uses the plugin for 2-3 hours/week
                1. ⚙️ tools generally used: Canva, Insta, Tiktok
              1. Persona 2: Designer/Content designer
                1. 👥 comprises the second largest user base
                1. ⌛ uses the plugin for 20-30 hours/week
                1. ⚙️ tools generally used: Adobe, Framer, Canva, Figma, Insta, Tiktok
            1. What's the minimum viable friction?
              1. Browser extension they install once?
                1. easily clip product images to the database along with product information such as price, brand name, etc 🟢
              1. Plugin tools they use daily?
                1. Adobe, Sketchup, Canva, 
              1. Or does the value justify a standalone destination? 
                1. High time spent learning another new app 🔴
            1. For brands - integration or manual?
              1. Can you auto-pull from their Shopify store? YES
              1. Or do they need a "brand dashboard" on your platform? NICE TO HAVE - NOT A NEED
            1. What's the ONE thing Tessellate does that existing tools can't?
              1. The community gallery? #1
              1. The cross-brand curation? #2
              1. Is it the AI-powered product matching? #3
              1. The export to multiple formats? #4
            Decide which one to implement:
            - Pivot from web app → browser extension
            - Pivot from standalone → plugin ecosystem
            - Pivot from manual uploads → API integrations
            - Pivot from destination → embeddable widget

          ## Potential Low-Friction Approaches
            🟢 NEED  🔴 NICE TO HAVE
            Option 1: Browser Extension Strategy
              Transform Tessellate into a browser extension that lets users:
              - Clip products from ANY website while browsing 🟢
                - ❔ how do you prevent multiple products from appearing in the main DB
                - ❔ AI model needs training to be able to read information from the users screen and verify that it does not cause a duplication in the existing DB
              - Create moodboards without leaving their current context 🔴
              - One-click add to existing Pinterest/Canva boards 🟢
              - No separate app to visit 🟢
            Option 2: Plugin Ecosystem
              Build Tessellate as plugins for existing platforms:
              - Canva Plugin: Add product discovery inside Canva 🟢
              - Figma Plugin: Design with real shoppable products 🟢
              - Notion Widget: Embed moodboards in existing workflows 🟢
              - Users stay in their comfort zone 🟢
            Option 3: API-First, No-UI Brand Onboarding
              For brands:
              - Auto-sync with Shopify/WooCommerce APIs (no manual uploads) 🟢
              - Auto-pull from Instagram Shopping catalogs 🟢
              - Zero manual catalog maintenance 🟢
              - They just connect once and forget 🟢
                - ❔setup hook when brand updates their catalogue
                - ❔setup hook to update product portfolio when there’s a change
            Option 4: Embeddable Widget Strategy
              Instead of driving traffic to Tessellate: requires brand buy-in; they need to be convinced enough to do the following things
              - Brands embed your moodboard creator ON THEIR SITE 🔴
              - Drives discovery but keeps users on brand domains 🔴
              - Tessellate becomes infrastructure, not a destination 🔴

        [Database: Tasks]

      ### sprint

        [Database: Sprint board]

        [Database: Sprints]

      ### docs

      ### inspiration
        👆🏽 This one has ‘edits’ that do a good job bringing together a theme by different brands.
        👆🏽 This article does a good job explaining the movement of ‘shoppable rooms.’
        https://www.behance.net/gallery/185102241/Website-Design-A-Collage-of-Color-and-Creativity?tracking_source=search_projects%7Cwebsite+design&l=24

[Database: Projects]

### Crude roadmap

### Architecture

  ```mermaid
flowchart LR
    subgraph FrontendClients["Frontend Clients"]
        Canva["Canva Plugin (MVP)"]
        WebApp["Custom Canvas UI (Phase 2)"]
        MoodPage["Public Moodboard Viewer"]
    end

    subgraph Backend["Backend (Supabase + Pinecone + Claude/HF)"]
        APIGateway["API Gateway / Supabase Edge Functions"]
        DB["Supabase DB\nProducts, Brands, Moodboards"]
        VectorSearch["Pinecone\nSemantic Search & Similarity"]
        Storage["Cloudflare R2 / S3\nProduct Images CDN"]
        Enrichment["Claude / HuggingFace\nPrompt & Layout AI"]
    end

    subgraph BrandIntegrations["Brand Integrations"]
        Shopify["Shopify App"]
        Woo["WooCommerce Plugin"]
        Wix["Wix Plugin (Phase 2)"]
        CustomAPI["Custom API Connector"]
        CSV["CSV Upload"]
    end

    Canva -->|"Prompt → Claude"| Enrichment
    WebApp -->|"Prompt → Claude"| Enrichment
    MoodPage -->|"Request board data"| DB

    Enrichment -->|"Tags / Embeddings"| VectorSearch
    Enrichment -->|"Smart Label Rules + Colors"| DB
    Enrichment -->|"Board Layout JSON"| WebApp

    Canva -->|"Search Products"| APIGateway
    WebApp -->|"Search Products"| APIGateway

    APIGateway -->|"Query DB"| DB
    APIGateway -->|"Vector Match"| VectorSearch
    APIGateway -->|"Serve Optimized Images"| Storage
    APIGateway -->|"Enrich Product"| Enrichment

    Shopify -->|"Webhook / Sync"| APIGateway
    Woo -->|"Sync"| APIGateway
    Wix -->|"Sync"| APIGateway
    CustomAPI -->|"Scheduled Import"| APIGateway
    CSV -->|"Manual Upload"| APIGateway

    WebApp -->|"Export / Share"| MoodPage
    Canva -->|"Export"| MoodPage

```

  ```mermaid
flowchart TD

  %% Brand to DB (Data In)
  subgraph DataIn["Data In: Brand Upload & Enrichment"]
    A1["Brand Upload CSV / Plugin / API"]
    A2["Claude; Text Enrichment: Brand, Category, Tone"]
    A3["Vision Model; Color, Texture, Material"]
    A4["Supabase DB; Store Enriched Products"]
  end

  %% User to Canvas (Data Out)
  subgraph DataOut["Data Out: User Prompt to Moodboard"]
    B1["User Prompt e.g. 'organic decor for Bali'"]
    B2["Claude; Parse Prompt → Tags, Filters"]
    B3["Supabase DB; Query Enriched Products"]
    B4["Vision Model; Layout & Label Placement"]
    B5["Canvas UI; Moodboard Output"]
  end

  %% Flow connections
  A1 --> A2 --> A3 --> A4
  B1 --> B2 --> B3 --> B4 --> B5
```
