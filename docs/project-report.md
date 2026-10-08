# Project report outline

## 1. Abstract

Smart Wardrobe and Outfit Planner is a full-stack wardrobe assistant that helps users organize clothing items, analyze their wardrobe visually, and generate outfit recommendations by combining user preferences, weather, occasion, and color harmony rules. The project combines a Next.js frontend, FastAPI backend, MongoDB persistence, and a Python ML pipeline.

## 2. Literature survey

- Fashion recommendation systems and digital wardrobe management
- Clothing classification with MobileNetV2 and transfer learning
- Dominant color extraction using OpenCV and K-means clustering
- Rule-based outfit compatibility and personalization techniques
- Generative AI support for styling suggestions and accessory ideas

## 3. System design

### Architecture overview

```mermaid
flowchart LR
    User[User] --> FE[Next.js frontend]
    FE --> API[FastAPI backend]
    API --> DB[(MongoDB)]
    API --> Uploads[Local uploads]
    API --> ML[ML / CV services]
    ML --> Model[Classifier and color extraction]
    API --> Gemini[Gemini styling API]
```

### Design decisions

- Use a monorepo for clear separation of frontend, backend, and ML code.
- Keep ML inference in dedicated service modules so the algorithm can be swapped or tested independently.
- Secure per-user access with JWT auth and MongoDB ownership checks.
- Store wardrobe media in a local upload directory to allow future cloud-backed storage.

## 4. Data flow diagrams (DFDs)

### Level 0

```mermaid
flowchart LR
    User --> System[Smart Wardrobe Planner]
    System --> Wardrobe[Wardrobe data]
    System --> Recommendations[Outfit recommendations]
```

### Level 1

```mermaid
flowchart LR
    User --> Login[Register / Login]
    Login --> Auth[Auth service]
    User --> WardrobeUI[Wardrobe management UI]
    WardrobeUI --> WardrobeAPI[Wardrobe API]
    WardrobeAPI --> DB[(MongoDB)]
    WardrobeUI --> Classifier[Image classification]
    Classifier --> ML[ML pipeline]
    User --> Planner[Outfit planner]
    Planner --> Recommendation[Recommendation engine]
    Recommendation --> Preferences[User preferences]
```

## 5. ER diagram and schema overview

```mermaid
erDiagram
    USER ||--o{ PREFERENCE : has
    USER ||--o{ CLOTHING_ITEM : owns
    USER ||--o{ OUTFIT : saves
    CLOTHING_ITEM ||--o{ OUTFIT_ITEM : used_in
    OUTFIT ||--o{ OUTFIT_ITEM : contains

    USER {
      string id
      string email
      string password_hash
    }

    PREFERENCE {
      string user_id
      string[] favorite_colors
      string[] preferred_styles
      string[] disliked_colors
    }

    CLOTHING_ITEM {
      string id
      string user_id
      string category
      string subtype
      string[] dominant_colors
      string[] occasion_tags
      string image_url
    }

    OUTFIT {
      string id
      string user_id
      string name
      bool favorite
    }

    OUTFIT_ITEM {
      string outfit_id
      string clothing_item_id
      string slot
    }
```

## 6. Results and evaluation

- Backend test coverage includes recommendation, styling, classification, and route-level checks.
- Frontend tests validate core UI behavior and toast flows.
- The project demonstrates end-to-end wardrobe creation, analysis, and outfit scoring.
- Current performance is suitable for a prototype and can be upgraded with larger datasets and production hosting.

## 7. Limitations

- Fashion-MNIST is a small benchmark and is not representative of real-world wardrobe imagery.
- Local file storage is convenient for development but does not scale to multi-instance production deployments.
- Rule-based outfit scoring is interpretable but cannot fully capture human taste or style nuance.
- Gemini responses depend on external API availability and cost constraints.

## 8. Future scope

- Replace local storage with cloud storage and a managed object bucket.
- Train a custom clothing classifier on a real wardrobe dataset.
- Add user feedback loops to improve recommendation quality.
- Support multi-user social sharing and outfit trend analytics.
- Add advanced personalization, seasonal intelligence, and inventory forecasting.
