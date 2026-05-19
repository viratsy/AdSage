# Phase 1 Product Architecture — AI Ad Intelligence SaaS

## Project Overview

Build a SaaS platform that allows users to:

1. Save Meta ads (Facebook & Instagram initially)
2. Analyze ads using AI
3. Organize swipe files
4. Generate ad hooks/copy variations
5. Search saved creatives
6. Manage their own workspace

Phase 1 is focused on:
- Meta ad intelligence
- Static creatives/images
- AI hook analysis
- Chrome extension workflow
- Lightweight SaaS dashboard

NOT included in Phase 1:
- AI video generation
- TikTok/LinkedIn support
- Team collaboration
- Advanced analytics
- AI CTR prediction
- Competitor tracking automation
- OpenSearch
- Mobile app

---

# Primary Goal

The product should solve:

"Performance marketers waste time manually saving, organizing, and analyzing winning Meta ads."

The MVP should provide:
- Fast ad saving
- AI-driven insights
- Swipe library organization
- Hook inspiration
- Ad copy generation

---

# Tech Stack

## Frontend

- Next.js (App Router)
- Tailwind CSS
- TypeScript
- Amplify Hosting

---

## Backend

- AWS SAM
- AWS Lambda
- API Gateway
- DynamoDB
- S3
- CloudFront
- Cognito
- EventBridge
- SQS

---

## AI Services

Use abstraction layer so providers can be swapped.

Initial Providers:
- OpenAI
- Claude

---

## Chrome Extension

- Manifest V3
- TypeScript
- Content scripts
- Background service worker
- Chrome Storage API

---

# High-Level Architecture

## Workflow

User clicks "Save Ad" in Chrome extension
→ Extension extracts ad data
→ Sends payload to API Gateway
→ Lambda validates/authenticates
→ Media uploaded to S3
→ Metadata stored in DynamoDB
→ AI analysis triggered asynchronously
→ AI results stored in DynamoDB
→ Dashboard displays analyzed ad

---

# Product Modules

# MODULE 1 — Authentication

## Features

- Sign up
- Login
- Forgot password
- JWT auth
- Session management
- User profile

---

## AWS Services

- Cognito User Pool
- Cognito Identity Pool

---

## User Fields

### Users Table

| Field | Type |
|---|---|
| user_id | string |
| email | string |
| full_name | string |
| created_at | timestamp |
| subscription_plan | string |
| status | string |
| ads_saved_count | number |
| ai_credits | number |

---

# MODULE 2 — Chrome Extension

## Purpose

Allow users to save Meta ads directly from Facebook Ad Library and feeds.

---

## Core Features

### 1. Detect Ads

Extension should identify:
- Sponsored posts
- Meta Ad Library ads

---

### 2. Extract Data

Capture:

| Field |
|---|
| ad_id |
| advertiser_name |
| advertiser_page_url |
| primary_text |
| headline |
| CTA |
| landing_page |
| image_urls |
| video_urls |
| platform |
| timestamp |
| page_avatar |
| engagement_metrics_if_available |

---

### 3. Save Ad Button

Inject UI button:
- Save Ad
- Saved
- Analyze

---

### 4. Authentication

Extension should support:
- Login state
- Token refresh
- Logout

Token storage uses `chrome.storage.local` (not `sync`) to avoid quota limits and keep tokens device-scoped. The background service worker handles silent token refresh using the Cognito refresh token before expiry. On logout, all stored tokens are cleared.

---

### 5. Sync

Extension syncs with backend.

---

## Extension Architecture

### Components

#### Content Script
Responsible for:
- DOM scanning
- ad detection
- data extraction
- button injection

---

#### Background Worker
Responsible for:
- API communication
- auth handling
- retry queue

---

#### Popup UI
Responsible for:
- login
- account info
- recent saves

---

## Important Notes

Meta DOM changes frequently.
Selectors must be modular and configurable.

Selector config should be stored remotely (e.g. a versioned JSON file in S3/CloudFront) so selectors can be patched without publishing a new extension release. The background worker fetches this config on startup and caches it locally.

---

# MODULE 3 — Media Storage

## Purpose

Store:
- images
- thumbnails
- metadata

Phase 1 video handling should be minimal.

---

## AWS Services

- S3
- CloudFront

---

## S3 Structure

/users/{user_id}/ads/{ad_id}/
    metadata.json
    image_1.webp
    image_2.webp
    thumbnail.webp

---

## Image Optimization

Lambda should:
- compress images
- convert to WebP
- generate thumbnails

---

# MODULE 4 — Ad Database

## DynamoDB Tables

# Table: ads

| Field | Type |
|---|---|
| ad_id | string |
| user_id | string |
| advertiser_name | string |
| primary_text | string |
| headline | string |
| cta | string |
| landing_page | string |
| platform | string |
| image_urls | list |
| video_urls | list |
| ai_analysis_status | string |
| created_at | timestamp |
| tags | list |
| favorite | boolean |

---

## GSIs

### GSI 1
PK: user_id
SK: created_at

---

### GSI 2
PK: user_id
SK: advertiser_name

---

### GSI 3 (on ai_analysis table)
PK: ad_id
SK: created_at

Required to fetch AI analysis results by ad_id without a full table scan.

---

# Table: ai_analysis

| Field | Type |
|---|---|
| analysis_id | string |
| ad_id | string |
| hook_type | string |
| emotional_trigger | string |
| audience_type | string |
| funnel_stage | string |
| cta_strength | string |
| ai_score | number |
| generated_hooks | list |
| generated_ctas | list |
| created_at | timestamp |

---

# MODULE 5 — AI Analysis Engine

## Purpose

Analyze saved ads and generate insights.

---

## AI Tasks

### 1. Hook Analysis

Identify:
- curiosity hook
- fear hook
- urgency hook
- authority hook
- transformation hook
- social proof hook

---

### 2. Emotional Analysis

Determine:
- pain point
- aspiration
- fear
- greed
- status
- trust

---

### 3. Funnel Classification

Classify:
- lead generation
- webinar funnel
- workshop funnel
- eCommerce
- coaching
- SaaS

---

### 4. Audience Analysis

Predict:
- beginner
- advanced
- business owner
- creator
- job seeker
- student

---

### 5. AI Score

Generate internal quality score.

Example:
- hook quality
- CTA strength
- clarity
- urgency

---

### 6. Generate Variations

Generate:
- 10 hooks
- 5 CTA variations
- short ad copy
- long ad copy

---

## AI Processing Flow

New ad saved
→ EventBridge event
→ SQS queue
→ AI Lambda
→ Store result

---

## Prompt Engineering

All prompts should be centralized.

Use:
- versioned prompts
- JSON output schema
- validation layer

---

# MODULE 6 — Dashboard

## Main Pages

### 1. Login

---

### 2. Dashboard Home

Display:
- total ads
- favorites
- recent saves
- AI credits

---

### 3. Ad Library

Features:
- grid layout
- filters
- search
- sort
- favorites

---

### 4. Ad Details Page

Display:
- image preview
- ad copy
- AI analysis
- generated hooks
- CTA suggestions
- notes

---

### 5. Profile Settings

- update profile
- API usage
- logout

---

# MODULE 7 — Search System

## Phase 1 Search

Use DynamoDB filtering.

Search by:
- advertiser
- tags
- keywords
- hook type

---

## OpenSearch

NOT needed in Phase 1.

Add later.

---

# MODULE 8 — Tags & Favorites

## Features

Users can:
- add tags
- mark favorite
- create collections later

---

# MODULE 9 — Subscription System

## Phase 1

Simple plan system.

---

## Plans

### Free
- 5 ads saved
- 5 AI analyses

### Pro
- 40 ads saved
- 40 AI analyses

AI credit deduction must be enforced server-side in the AI Lambda before triggering analysis. The Lambda checks the user's remaining `ai_credits` in DynamoDB, decrements atomically using a conditional update, and rejects the request with a 402 if credits are exhausted. Credits are topped up on successful payment webhook.

---

## Payment Gateway

Use:
- Razorpay

---

## Webhooks

Handle:
- successful payment
- renewal
- cancellation

All incoming Razorpay webhooks must be verified using HMAC-SHA256 signature validation against `RAZORPAY_WEBHOOK_SECRET` before any processing occurs. Reject requests with invalid or missing signatures with a 400 response.

---

# MODULE 10 — Notifications

## Email Notifications

Use:
- SES

Notifications:
- welcome email
- payment success
- quota warning

---

# Backend API Structure

# Auth APIs

POST /auth/signup
POST /auth/login
POST /auth/logout
POST /auth/refresh

---

# Ads APIs

POST /ads/save
GET /ads
GET /ads/{id}
DELETE /ads/{id}
PATCH /ads/{id}

---

# AI APIs

POST /ai/analyze/{ad_id}
GET /ai/result/{ad_id}

---

# Favorites APIs

POST /favorites/{ad_id}
DELETE /favorites/{ad_id}

---

# Tags APIs

POST /tags
PATCH /tags/{id}
DELETE /tags/{id}

---

# Subscription APIs

POST /billing/create-order
POST /billing/webhook
GET /billing/status

---

# AWS SAM Structure

## Suggested Repository Structure

/backend
    /template.yaml

    /src
        /auth
        /ads
        /ai
        /billing
        /search
        /shared

/frontend
    /nextjs-app

/chrome-extension

/infrastructure
    /env
    /scripts

/docs

---

# Lambda Functions

## Auth

- auth_signup
- auth_login
- auth_refresh

---

## Ads

- save_ad
- get_ads
- get_ad_details
- delete_ad

---

## AI

- trigger_ai_analysis
- process_ai_analysis

---

## Media

- optimize_image
- generate_thumbnail

---

## Billing

- create_payment_order
- payment_webhook

---

# Event-Driven Architecture

## Flow

Ad saved
→ EventBridge
→ SQS
→ AI Lambda
→ DynamoDB update

This prevents slow API responses.

---

# Security Requirements

## Required

- JWT validation
- rate limiting
- API throttling
- signed S3 URLs
- environment secrets in Secrets Manager
- CORS protection
- Razorpay webhook signature verification (HMAC-SHA256)

---

## Data & Privacy

- Users are saving third-party ad creatives. Do not expose stored media publicly — all S3 access must go through signed URLs or CloudFront with signed cookies.
- If serving users in the EU, ensure DynamoDB and S3 resources are in an appropriate region and review GDPR obligations around storing ad content and user data.
- Do not log ad content or AI outputs to CloudWatch in plain text — log metadata only (ad_id, user_id, status).

---

# Logging & Monitoring

## Use

- CloudWatch Logs
- CloudWatch Metrics
- X-Ray later

---

## Monitor

- Lambda failures
- AI failures
- API latency
- queue depth

---

# Environment Variables

## Backend

OPENAI_API_KEY
CLAUDE_API_KEY
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
ADS_BUCKET
CLOUDFRONT_URL
DYNAMODB_TABLE_ADS
DYNAMODB_TABLE_AI
RAZORPAY_KEY
RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET
SELECTOR_CONFIG_URL

---

# AI Output Schema Example

{
  "hook_type": "curiosity",
  "emotional_trigger": "fear_of_missing_out",
  "audience_type": "business_owners",
  "funnel_stage": "lead_generation",
  "cta_strength": "high",
  "ai_score": 82,
  "generated_hooks": [
    "Most workshop ads fail because of this mistake",
    "The hidden psychology behind high converting ads"
  ],
  "generated_ctas": [
    "Book your seat now",
    "Register before prices increase"
  ]
}

---

# UI Design Guidelines

## Design Style

Modern SaaS UI.

Use:
- dark mode
- clean spacing
- minimal clutter
- responsive layout
- fast-loading grids

---

## Important UX Goals

- One-click ad save
- Fast dashboard loading
- Quick search
- Minimal friction
- Swipe-file feel

---

# Phase 1 Limitations

DO NOT build:
- AI video generation
- full analytics engine
- team collaboration
- competitor automation
- OpenSearch cluster
- complex permissions
- mobile app
- browser support beyond Chrome

---

# Recommended Development Order

## Phase 1A

1. Cognito auth
2. Backend APIs
3. DynamoDB schema
4. S3 upload flow

---

## Phase 1B

1. Chrome extension
2. Meta extraction
3. Save ad flow

---

## Phase 1C

1. AI analysis engine
2. Prompt engineering
3. AI results storage

---

## Phase 1D

1. Dashboard UI
2. Ad library
3. Filters/search
4. Ad details page

---

## Phase 1E

1. Billing
2. Limits
3. Production hardening

---

# Initial Success Metrics

Track:
- ads saved/day
- AI analyses/day
- DAU
- retention
- average ads/user
- favorite rate
- generated hook usage

---

# Future Roadmap (NOT Phase 1)

## Phase 2

- TikTok support
- LinkedIn support
- Collections
- Team collaboration
- OpenSearch
- Semantic search
- AI chat assistant

---

## Phase 3

- AI video generation
- Competitor monitoring
- Ad trend detection
- AI CTR prediction
- Creative fatigue detection
- Automated landing page analysis

---

# Final Notes For Development

The main focus of Phase 1 is:

1. Stability
2. Fast UX
3. Accurate extraction
4. High-quality AI analysis
5. Low AWS cost
6. Scalable architecture

The architecture must remain fully serverless and event-driven using AWS SAM.

Avoid overengineering.

The goal is to launch quickly with a stable and useful MVP.

